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
import { getVouchers } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

const DAYBOOK_TYPE_MAP: Record<string, string> = {
  Sales:    'sales_invoice',
  Purchase: 'purchase_invoice',
  Payment:  'payment_voucher',
  Receipt:  'receipt_voucher',
  Journal:  'journal_voucher',
  Contra:   'contra_voucher',
};

type ViewMode = 'daybook' | 'myentries';
type VType = 'ALL' | 'Sales' | 'Purchase' | 'Payment' | 'Receipt' | 'Journal' | 'Contra';

const VTYPES: VType[] = ['ALL', 'Sales', 'Purchase', 'Payment', 'Receipt', 'Journal', 'Contra'];

interface Entry {
  id: string; date: string; month: string; type: VType;
  party: string; ref: string; amount: string;
  isCredit: boolean; status: 'posted' | 'pending'; isMine: boolean;
  isOptional: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const mapVoucherType = (raw: string): VType => {
  const s = (raw || '').toLowerCase();
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
  if (t.includes('receipt'))     return true;  // Cash/bank receipt = Cr
  if (t.includes('credit note')) return true;  // Credit note = Cr
  if (t.includes('sales') && !t.includes('return') && !t.includes('order')) return true; // Sales = Cr
  // Payment, Purchase, Debit Note, Journal, Contra, Orders = Dr
  return false;
};

const TYPE_COLORS: Record<string,string> = {
  Sales: COLORS.positive, Purchase: COLORS.info, Payment: COLORS.negative,
  Receipt: COLORS.positive, Journal: COLORS.warning, Contra: '#7C3AED',
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
  const [isLoading,   setIsLoading]   = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const mapEntry = (r: any): Entry => ({
    id: r.guid || String(r.id),
    date: r.date || today,
    month: new Date(r.date || today).toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
    type: mapVoucherType(r.voucher_type) as VType,
    ref: r.voucher_number || '',
    party: r.party_name || '',
    amount: formatAmount(Math.abs(+r.amount || 0)),
    isCredit: isCreditVoucher(r.voucher_type),
    status: 'posted' as const,
    isMine: true,
    isOptional: !!(r.is_optional),
  });

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
      {multiSelect && selected.length > 0 && mode === 'myentries' && (
        <View style={s.actionBar}>
          <Text style={s.actionTxt}>{selected.length} selected</Text>
          <TouchableOpacity style={s.pushBtn} onPress={handlePush} activeOpacity={0.8}>
            <Ionicons name="cloud-upload-outline" size={16} color={COLORS.white} />
            <Text style={s.pushTxt}>Push to Tally</Text>
          </TouchableOpacity>
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
      {isLoading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>Loading entries...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: Math.max(insets.bottom,20)+16}} keyboardShouldPersistTaps="handled">
          {grouped.map(([month, entries]) => {
            const isCollapsed = collapsedMonths.has(month);
            return (
            <View key={month}>
              {/* Month header — collapsible */}
              <TouchableOpacity style={s.monthHdr} onPress={() => toggleMonth(month)} activeOpacity={0.7}>
                <Text style={s.monthTxt}>{month}</Text>
                <View style={s.monthLine} />
                <Text style={s.monthCount}>{entries.length}</Text>
                <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {/* Entries */}
              {!isCollapsed && <View style={s.card}>
                {entries.map((entry, idx) => {
                  const isSel = selected.includes(entry.id);
                  const tc = TYPE_COLORS[entry.type] || COLORS.textSecondary;
                  return (
                    <View key={entry.id}>
                      <TouchableOpacity
                        style={[s.row, isSel && s.rowSelected]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (multiSelect) {
                            toggleSelect(entry.id);
                          } else {
                            const docType = DAYBOOK_TYPE_MAP[entry.type] || 'sales_invoice';
                            router.push(`/document/${entry.ref}?type=${docType}` as any);
                          }
                        }}
                        onLongPress={() => { if (mode==='myentries') { setMultiSelect(true); toggleSelect(entry.id); } }}
                      >
                        {multiSelect && mode==='myentries' && (
                          <View style={[s.checkbox, isSel && s.checkboxActive]}>
                            {isSel && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                          </View>
                        )}
                        <View style={[s.typeIcon, {backgroundColor: tc+'15'}]}>
                          <Ionicons name={entry.isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={18} color={tc} />
                        </View>
                        <View style={s.entryInfo}>
                          <View style={s.entryTop}>
                            <View style={[s.vTypePill, {backgroundColor: tc+'18'}]}>
                              <Text style={[s.vTypeTxt, {color:tc}]}>{entry.type}</Text>
                            </View>
                            <Text style={s.refTxt}>{entry.ref}</Text>
                            {entry.status === 'pending' && (
                              <View style={s.pendingBadge}><Text style={s.pendingTxt}>Pending</Text></View>
                            )}
                            {entry.isOptional && (
                              <View style={s.draftBadge}><Text style={s.draftTxt}>Draft</Text></View>
                            )}
                          </View>
                          <Text style={s.partyTxt}>{entry.party}</Text>
                          <Text style={s.dateTxt}>{entry.date}</Text>
                        </View>
                        <View style={s.amtCol}>
                          <Text style={[s.amtTxt, {color: entry.isCredit ? COLORS.negative : COLORS.positive}]}>{entry.amount}</Text>
                          <Text style={[s.drCrTxt, {color: entry.isCredit ? COLORS.negative : COLORS.positive}]}>{entry.isCredit?'Cr':'Dr'}</Text>
                        </View>
                      </TouchableOpacity>
                      {idx < entries.length-1 && <View style={s.divider} />}
                    </View>
                  );
                })}
              </View>}
            </View>
            );
          })}
          {hasMore && (
            <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} activeOpacity={0.8}>
              {isLoadingMore
                ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                : <Text style={s.loadMoreTxt}>Load More</Text>
              }
            </TouchableOpacity>
          )}
          {!hasMore && liveEntries.length > 0 && (
            <Text style={s.endTxt}>All {liveEntries.length} entries loaded</Text>
          )}
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.borderStrong} />
              <Text style={s.emptyTxt}>No entries found</Text>
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
