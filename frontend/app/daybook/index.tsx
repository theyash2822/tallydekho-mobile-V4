import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getVouchers, getMyEntries, retryMyEntry } from '../../src/services/api';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import Toast from 'react-native-toast-message';
import { useSettings } from '../../src/context/SettingsContext';

const DAYBOOK_TYPE_MAP: Record<string, string> = {
  Sales:    'sales_invoice',
  Purchase: 'purchase_invoice',
  Payment:  'payment_voucher',
  Receipt:  'receipt_voucher',
  Journal:  'journal_voucher',
  Contra:   'contra_voucher',
  Transfer: 'stock_journal',
};

type ViewMode = 'daybook' | 'myentries';
type VType = 'ALL' | 'Sales' | 'Purchase' | 'Payment' | 'Receipt' | 'Journal' | 'Contra' | 'Transfer';

const VTYPES: VType[] = ['ALL', 'Sales', 'Purchase', 'Payment', 'Receipt', 'Journal', 'Contra', 'Transfer'];

interface Entry {
  id: string; date: string; month: string; type: VType;
  party: string; ref: string; amount: string;
  isCredit: boolean; status: 'posted' | 'pending'; isMine: boolean;
  isOptional: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mapVoucherType = (raw: string): VType => {
  const s = (raw || '').toLowerCase();
  if (s.includes('stock journal') || s.includes('stock_transfer') || s.includes('stock transfer')) return 'Transfer';
  if (s.includes('sales')) return 'Sales';
  if (s.includes('purchase')) return 'Purchase';
  if (s.includes('payment')) return 'Payment';
  if (s.includes('receipt')) return 'Receipt';
  if (s.includes('journal')) return 'Journal';
  if (s.includes('contra')) return 'Contra';
  return 'Journal';
};

// Cr = money in / revenue received (from company's perspective)
// Dr = money out / expense / purchase
const isCreditVoucher = (voucherType: string): boolean => {
  const t = (voucherType || '').toLowerCase();
  if (t.includes('stock journal') || t.includes('stock_transfer')) return false; // Transfer = neutral, show as Dr
  if (t.includes('receipt'))     return true;  // Cash/bank receipt = Cr
  if (t.includes('credit note')) return true;  // Credit note = Cr
  if (t.includes('sales') && !t.includes('return') && !t.includes('order')) return true; // Sales = Cr
  // Payment, Purchase, Debit Note, Journal, Contra, Orders = Dr
  return false;
};

const TYPE_COLORS: Record<string,string> = {
  Sales: COLORS.positive, Purchase: COLORS.info, Payment: COLORS.negative,
  Receipt: COLORS.positive, Journal: COLORS.warning, Contra: '#7C3AED', Transfer: '#0891B2',
};

export default function DaybookScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;

  const today = new Date().toISOString().split('T')[0];
  // Derive dates directly from selectedFY so they update when FY changes (no stale init)
  const fromDate = selectedFY?.startDate || today;
  const toDate   = today;

  const [liveEntries, setLiveEntries] = useState<Entry[]>([]);
  const [pendingEntries,       setPendingEntries]       = useState<any[]>([]);
  const [isLoadingMyEntries,   setIsLoadingMyEntries]   = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const mapEntry = (r: any): Entry => {
    const vtype = mapVoucherType(r.voucher_type) as VType;
    // For Stock Journal / transfer: show narration or entry_label as party (no party_name exists)
    const partyDisplay = r.party_name || r.narration || r.entry_label || '';
    return {
      id: r.guid || String(r.id),
      date: r.date || today,
      month: new Date(r.date || today).toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      type: vtype,
      ref: r.voucher_number || '',
      party: partyDisplay,
      amount: formatAmount(Math.abs(+r.amount || 0)),
      isCredit: isCreditVoucher(r.voucher_type),
      status: 'posted' as const,
      isMine: true,
      isOptional: !!(r.is_optional),
    };
  };

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    setPage(1);
    setHasMore(false);
    getVouchers(companyGuid, undefined, { from: fromDate, to: toDate, limit: PAGE_SIZE, page: 1 })
      .then((res: any) => {
        const rows = res?.data ?? [];
        setLiveEntries(rows.map(mapEntry));
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((err: any) => {
        setApiError(err?.message || 'Failed to load entries');
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid, fromDate, toDate]);

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    getVouchers(companyGuid, undefined, { from: fromDate, to: toDate, limit: PAGE_SIZE, page: nextPage })
      .then((res: any) => {
        const rows = res?.data ?? [];
        setLiveEntries(prev => [...prev, ...rows.map(mapEntry)]);
        setHasMore(rows.length === PAGE_SIZE);
        setPage(nextPage);
      })
      .finally(() => setIsLoadingMore(false));
  };

  const [mode, setMode] = useState<ViewMode>('daybook');
  const [vType, setVType] = useState<VType>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);

  // Fetch write_queue entries for My Entries tab
  const loadPendingEntries = () => {
    if (!companyGuid) return;
    setIsLoadingMyEntries(true);
    getMyEntries(companyGuid).then((res: any) => {
      setPendingEntries(Array.isArray(res?.pending) ? res.pending : []);
    }).catch(() => {}).finally(() => setIsLoadingMyEntries(false));
  };

  useEffect(() => {
    if (mode === 'myentries') loadPendingEntries();
  }, [mode, companyGuid]);

  const handleRetry = async (queueId: string) => {
    try {
      await retryMyEntry(queueId);
      Toast.show({ type: 'info', text1: 'Retrying…', text2: 'Will push to Tally if desktop is connected.' });
      setTimeout(loadPendingEntries, 2000);
    } catch { Toast.show({ type: 'error', text1: 'Retry failed' }); }
  };

  const sourceEntries = liveEntries;

  const filtered = useMemo(() => {
    let arr = mode === 'myentries' ? sourceEntries.filter(e => e.isMine) : sourceEntries;
    if (vType !== 'ALL') arr = arr.filter(e => e.type === vType);
    if (search) arr = arr.filter(e =>
      e.party.toLowerCase().includes(search.toLowerCase()) ||
      e.ref.toLowerCase().includes(search.toLowerCase())
    );
    return arr;
  }, [mode, vType, search, sourceEntries]);

  // Group by month
  const grouped = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    filtered.forEach(e => {
      if (!map[e.month]) map[e.month] = [];
      map[e.month].push(e);
    });
    return Object.entries(map);
  }, [filtered]);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const toggleMonth = (month: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const handlePush = () => {
    if (selected.length === 0) return;
    setSelected([]);
    setMultiSelect(false);
  };

  // ─── My Entries — map write_queue entry_type to display label + type chip ────
  const WQ_TYPE_MAP: Record<string, { label: string; vtype: VType; icon: string }> = {
    sales:              { label: 'Sales',       vtype: 'Sales',    icon: 'arrow-down-circle-outline' },
    purchase:           { label: 'Purchase',    vtype: 'Purchase', icon: 'arrow-up-circle-outline' },
    payment:            { label: 'Payment',     vtype: 'Payment',  icon: 'arrow-up-circle-outline' },
    receipt:            { label: 'Receipt',     vtype: 'Receipt',  icon: 'arrow-down-circle-outline' },
    journal:            { label: 'Journal',     vtype: 'Journal',  icon: 'document-text-outline' },
    contra:             { label: 'Contra',      vtype: 'Contra',   icon: 'shuffle-outline' },
    stock_transfer:     { label: 'Transfer',    vtype: 'Transfer', icon: 'swap-horizontal-outline' },
    stock_adjustment:   { label: 'Adjustment',  vtype: 'Transfer', icon: 'options-outline' },
    alter_stock_item:   { label: 'Stock Edit',  vtype: 'Journal',  icon: 'create-outline' },
    item:               { label: 'New Item',    vtype: 'Journal',  icon: 'cube-outline' },
    party:              { label: 'New Party',   vtype: 'Journal',  icon: 'person-add-outline' },
    bank:               { label: 'Bank',        vtype: 'Journal',  icon: 'card-outline' },
    warehouse:          { label: 'Warehouse',   vtype: 'Journal',  icon: 'business-outline' },
    sales_order:        { label: 'Sales Order', vtype: 'Sales',    icon: 'receipt-outline' },
    purchase_order:     { label: 'PO',          vtype: 'Purchase', icon: 'receipt-outline' },
    credit_note:        { label: 'Credit Note', vtype: 'Receipt',  icon: 'arrow-down-circle-outline' },
    debit_note:         { label: 'Debit Note',  vtype: 'Payment',  icon: 'arrow-up-circle-outline' },
    delivery_note:      { label: 'Delivery',    vtype: 'Sales',    icon: 'cube-outline' },
  };

  const myEntriesFiltered = useMemo(() => {
    let arr = pendingEntries;
    if (vType !== 'ALL') {
      arr = arr.filter((p: any) => {
        const mapped = WQ_TYPE_MAP[p.voucher_type || '']?.vtype;
        return mapped === vType;
      });
    }
    if (search) {
      arr = arr.filter((p: any) =>
        (p.party_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.voucher_number || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    return arr;
  }, [pendingEntries, vType, search]);

  const myEntriesGrouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    myEntriesFiltered.forEach((p: any) => {
      const month = new Date(p.date || new Date()).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      if (!map[month]) map[month] = [];
      map[month].push(p);
    });
    return Object.entries(map);
  }, [myEntriesFiltered]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{mode === 'myentries' ? 'My Entries' : 'Day Book'}</Text>
        <TouchableOpacity style={s.filterBtn}>
          <Ionicons name="options-outline" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={s.modeRow}>
        {(['daybook','myentries'] as ViewMode[]).map(m => (
          <TouchableOpacity key={m} style={[s.modeBtn, mode===m && s.modeBtnActive]} onPress={()=>{setMode(m);setSelected([]);setMultiSelect(false);}} activeOpacity={0.7}>
            <Text style={[s.modeTxt, mode===m && s.modeTxtActive]}>{m==='daybook'?'Day Book':'My Entries'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Voucher Type Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
        {VTYPES.map(vt=>(
          <TouchableOpacity key={vt} style={[s.typeChip, vType===vt && s.typeChipActive]} onPress={()=>setVType(vt)} activeOpacity={0.7}>
            <Text style={[s.typeChipTxt, vType===vt && s.typeChipTxtActive]}>{vt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput style={s.searchIn} placeholder="Search party, reference..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        {search.length>0 && <TouchableOpacity onPress={()=>setSearch('')}><Ionicons name="close-circle" size={16} color={COLORS.textTertiary} /></TouchableOpacity>}
      </View>

      {/* Multi-select action bar */}
      {multiSelect && selected.length > 0 && (
        <View style={s.actionBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
            <Text style={s.actionTxt}>{selected.length} selected</Text>
            <TouchableOpacity onPress={() => { setSelected([]); setMultiSelect(false); }} hitSlop={{top:8,bottom:8,left:8,right:8}} activeOpacity={0.7}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#888' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          {mode === 'myentries' && (
            <TouchableOpacity style={s.pushBtn} onPress={handlePush} activeOpacity={0.8}>
              <Ionicons name="cloud-upload-outline" size={16} color={COLORS.white} />
              <Text style={s.pushTxt}>Push to Tally</Text>
            </TouchableOpacity>
          )}
          {mode === 'daybook' && (
            <TouchableOpacity style={s.pushBtn} activeOpacity={0.8} onPress={() => {
              const lines = liveEntries.filter(e => selected.includes(e.id)).map(e => `${e.ref}  ${e.party}  ${e.amount}  ${e.isCredit?'Cr':'Dr'}`);
              require('react-native').Share.share({ message: `TallyDekho — Day Book\n${lines.join('\n')}` }).catch(() => {});
              setSelected([]); setMultiSelect(false);
            }}>
              <Ionicons name="share-outline" size={16} color={COLORS.white} />
              <Text style={s.pushTxt}>Export</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Error Banner */}
      {apiError ? (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
          <Text style={s.errorBannerTxt}>{apiError}</Text>
        </View>
      ) : null}

      {/* Loading */}
      {(mode === 'daybook' ? isLoading : isLoadingMyEntries) ? (
        <View style={{ paddingTop: 8 }}>
          {[...Array(6)].map((_, i) => <LedgerRowSkeleton key={i} />)}
        </View>
      ) : mode === 'daybook' ? (
        /* ─── DAY BOOK — all Tally vouchers ─────────────────────────────────── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: Math.max(insets.bottom,20)+16}} keyboardShouldPersistTaps="handled">
          {grouped.map(([month, entries]) => {
            const isCollapsed = collapsedMonths.has(month);
            return (
            <View key={month}>
              <TouchableOpacity style={s.monthHdr} onPress={() => toggleMonth(month)} activeOpacity={0.7}>
                <Text style={s.monthTxt}>{month}</Text>
                <View style={s.monthLine} />
                <Text style={s.monthCount}>{entries.length}</Text>
                <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {!isCollapsed && entries.map((entry) => {
                const isSel = selected.includes(entry.id);
                const tc = TYPE_COLORS[entry.type] || COLORS.textSecondary;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    style={[s.entryCard, isSel && s.entryCardSel]}
                    activeOpacity={0.8}
                    delayLongPress={500}
                    onPress={() => {
                      if (multiSelect) { toggleSelect(entry.id); }
                      else { const docType = DAYBOOK_TYPE_MAP[entry.type] || 'sales_invoice'; router.push(`/document/${entry.ref}?type=${docType}` as any); }
                    }}
                    onLongPress={() => { setMultiSelect(true); toggleSelect(entry.id); }}
                  >
                    {multiSelect && (
                      <View style={[s.checkbox, isSel && s.checkboxActive]}>
                        {isSel && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                      </View>
                    )}
                    <View style={[s.typeIcon, {backgroundColor: tc+'15'}]}>
                      <Ionicons name={entry.type === 'Transfer' ? 'swap-horizontal-outline' : entry.isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={18} color={tc} />
                    </View>
                    <View style={s.entryInfo}>
                      <View style={s.entryTop}>
                        <View style={[s.vTypePill, {backgroundColor: tc+'18'}]}>
                          <Text style={[s.vTypeTxt, {color:tc}]}>{entry.type}</Text>
                        </View>
                        <Text style={s.refTxt}>{entry.ref}</Text>
                        {entry.isOptional && <View style={s.draftBadge}><Text style={s.draftTxt}>Draft</Text></View>}
                      </View>
                      <Text style={s.partyTxt}>{entry.party}</Text>
                      <Text style={s.dateTxt}>{entry.date}</Text>
                    </View>
                    <View style={s.amtCol}>
                      <Text style={[s.amtTxt, {color: entry.isCredit ? COLORS.negative : COLORS.positive}]}>{entry.amount}</Text>
                      <Text style={[s.drCrTxt, {color: entry.isCredit ? COLORS.negative : COLORS.positive}]}>{entry.isCredit?'Cr':'Dr'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            );
          })}
          {hasMore && (
            <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} activeOpacity={0.8}>
              {isLoadingMore ? <ActivityIndicator size="small" color={COLORS.brandPrimary} /> : <Text style={s.loadMoreTxt}>Load More</Text>}
            </TouchableOpacity>
          )}
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.borderStrong} />
              <Text style={s.emptyTxt}>No entries found</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        /* ─── MY ENTRIES — ONLY write_queue (app-created) entries ─────────── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: Math.max(insets.bottom,20)+16}} keyboardShouldPersistTaps="handled">
          {myEntriesGrouped.map(([month, entries]) => {
            const isCollapsed = collapsedMonths.has(month);
            return (
              <View key={month}>
                <TouchableOpacity style={s.monthHdr} onPress={() => toggleMonth(month)} activeOpacity={0.7}>
                  <Text style={s.monthTxt}>{month}</Text>
                  <View style={s.monthLine} />
                  <Text style={s.monthCount}>{entries.length}</Text>
                  <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
                </TouchableOpacity>
                {!isCollapsed && entries.map((p: any) => {
                  const isSuccess = p._queue_status === 'success';
                  const isFailed  = p._queue_status === 'failed';
                  const wqInfo    = WQ_TYPE_MAP[p.voucher_type || ''] || { label: p.voucher_type || 'Entry', vtype: 'Journal' as VType, icon: 'document-text-outline' };
                  const tc        = TYPE_COLORS[wqInfo.vtype] || COLORS.textSecondary;
                  const borderColor = isFailed ? COLORS.negative : isSuccess ? COLORS.positive : COLORS.warning;
                  const badgeBg    = isFailed ? '#FEE2E2' : isSuccess ? '#D1FAE5' : '#FEF9C3';
                  const badgeColor = isFailed ? COLORS.negative : isSuccess ? '#065F46' : '#A16207';
                  const badgeText  = isFailed ? 'Failed' : isSuccess ? '✓ In Tally' : 'Queued ⏳';
                  return (
                    <View
                      key={String(p._queue_id)}
                      style={[s.entryCard, { borderLeftWidth: 3, borderLeftColor: borderColor }]}
                    >
                      {/* Type icon */}
                      <View style={[s.typeIcon, { backgroundColor: tc + '15' }]}>
                        <Ionicons name={wqInfo.icon as any} size={18} color={tc} />
                      </View>
                      {/* Info */}
                      <View style={s.entryInfo}>
                        <View style={s.entryTop}>
                          <View style={[s.vTypePill, { backgroundColor: tc + '18' }]}>
                            <Text style={[s.vTypeTxt, { color: tc }]}>{wqInfo.label}</Text>
                          </View>
                          {p.voucher_number ? <Text style={s.refTxt}>#{p.voucher_number}</Text> : null}
                          <View style={[s.pendingBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[s.pendingTxt, { color: badgeColor }]}>{badgeText}</Text>
                          </View>
                        </View>
                        <Text style={s.partyTxt} numberOfLines={1}>{p.party_name || '—'}</Text>
                        <Text style={s.dateTxt}>{p.date}</Text>
                        {isFailed && p._queue_error && (
                          <Text style={{ fontSize: 11, color: COLORS.negative, marginTop: 2 }} numberOfLines={1}>
                            {p._queue_error}
                          </Text>
                        )}
                      </View>
                      {/* Right col — amount + retry */}
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        {p.amount ? (
                          <Text style={[s.amtTxt, { color: COLORS.textPrimary }]}>
                            {formatAmount(Math.abs(+p.amount || 0))}
                          </Text>
                        ) : null}
                        {!isSuccess && (
                          <TouchableOpacity
                            style={[s.pushBtn, { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#1A1A1A' }]}
                            onPress={() => handleRetry(String(p._queue_id))}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="refresh-outline" size={12} color={COLORS.white} />
                            <Text style={[s.pushTxt, { fontSize: 11 }]}>Retry</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}
          {myEntriesGrouped.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="cloud-upload-outline" size={48} color={COLORS.borderStrong} />
              <Text style={s.emptyTxt}>No entries yet</Text>
              <Text style={[s.emptyTxt, { fontSize: 12, marginTop: 4 }]}>Entries you create from the app{`\n`}will appear here</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  header:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  filterBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  modeRow:{flexDirection:'row',backgroundColor:COLORS.cardBg,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  modeBtn:{flex:1,paddingVertical:12,alignItems:'center',borderBottomWidth:2,borderBottomColor:'transparent'},
  modeBtnActive:{borderBottomColor:COLORS.brandPrimary},
  modeTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'500',color:COLORS.textSecondary},
  modeTxtActive:{fontWeight:'700',color:COLORS.textPrimary},
  typeScroll:{backgroundColor:COLORS.cardBg,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  typeRow:{flexDirection:'row',gap:8,paddingHorizontal:SPACING.md,paddingVertical:10},
  typeChip:{paddingHorizontal:12,paddingVertical:7,borderRadius:RADIUS.full,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  typeChipActive:{backgroundColor:COLORS.brandPrimary,borderColor:COLORS.brandPrimary},
  typeChipTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'500'},
  typeChipTxtActive:{color:COLORS.white,fontWeight:'700'},
  searchBox:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,marginHorizontal:SPACING.md,marginTop:SPACING.md,paddingHorizontal:14,paddingVertical:11,borderRadius:RADIUS.md,borderWidth:1,borderColor:COLORS.borderDefault},
  searchIn:{flex:1,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary},
  actionBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#1A1A1A',paddingHorizontal:SPACING.md,paddingVertical:12,marginHorizontal:SPACING.md,marginTop:SPACING.sm,borderRadius:RADIUS.md},
  actionTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.white,fontWeight:'600'},
  pushBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.positive,paddingHorizontal:14,paddingVertical:8,borderRadius:RADIUS.md},
  pushTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.white,fontWeight:'700'},
  errorBanner:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FEE2E2',borderRadius:RADIUS.md,padding:SPACING.sm,marginHorizontal:SPACING.md,marginTop:SPACING.sm,borderWidth:1,borderColor:'#FECACA'},
  errorBannerTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:'#DC2626'},
  loadingBox:{alignItems:'center',justifyContent:'center',paddingVertical:80,gap:12},
  loadingTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  monthHdr:{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:SPACING.md,marginTop:SPACING.lg,marginBottom:SPACING.sm},
  monthTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textSecondary},
  monthLine:{flex:1,height:1,backgroundColor:COLORS.borderDefault},
  monthCount:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary,fontWeight:'600'},
  entryCard:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,borderWidth:1,borderColor:COLORS.borderDefault,padding:SPACING.md,marginHorizontal:SPACING.md,marginBottom:8,flexDirection:'row',alignItems:'center',gap:12},
  entryCardSel:{borderColor:COLORS.brandPrimary,borderWidth:2,backgroundColor:COLORS.brandPrimary+'06'},
  card:{backgroundColor:COLORS.cardBg,marginHorizontal:SPACING.md,borderRadius:RADIUS.lg,borderWidth:1,borderColor:COLORS.borderDefault,overflow:'hidden'},
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:SPACING.md,paddingVertical:13,gap:12},
  rowSelected:{backgroundColor:COLORS.infoBg},
  checkbox:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:COLORS.borderStrong,alignItems:'center',justifyContent:'center'},
  checkboxActive:{backgroundColor:COLORS.info,borderColor:COLORS.info},
  typeIcon:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},
  entryInfo:{flex:1,gap:3},
  entryTop:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
  vTypePill:{paddingHorizontal:7,paddingVertical:2,borderRadius:RADIUS.sm},
  vTypeTxt:{fontSize:10,fontWeight:'700'},
  refTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary},
  pendingBadge:{backgroundColor:COLORS.warningBg,paddingHorizontal:6,paddingVertical:2,borderRadius:RADIUS.sm},
  pendingTxt:{fontSize:10,fontWeight:'600',color:COLORS.warning},
  draftBadge:{backgroundColor:'#EDE9FE',paddingHorizontal:6,paddingVertical:2,borderRadius:RADIUS.sm,borderWidth:1,borderColor:'#C4B5FD'},
  draftTxt:{fontSize:10,fontWeight:'600',color:'#7C3AED'},
  partyTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary},
  dateTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
  amtCol:{alignItems:'flex-end',gap:2},
  amtTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700'},
  drCrTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'600'},
  divider:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:60},
  empty:{alignItems:'center',paddingVertical:60,gap:12},
  emptyTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textSecondary},
  loadMoreBtn:{ margin:16,padding:14,borderRadius:10,backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center' },
  loadMoreTxt:{ fontSize:14,fontWeight:'600',color:COLORS.brandPrimary },
  endTxt:{ textAlign:'center',fontSize:12,color:COLORS.textTertiary,padding:16 },
});
