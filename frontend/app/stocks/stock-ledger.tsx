import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useSettings } from '../../src/context/SettingsContext';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { getStockLedger, getStocks } from '../../src/services/api';
import { LoadingState, ErrorState } from '../../src/components/ApiStateViews';

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'chronological' | 'byItem' | 'byDocument';
type TxnType  = 'Sales' | 'Purchase' | 'Transfer' | 'Adjustment' | 'Opening';
type VoucherType = 'Sales Invoice' | 'Purchase Invoice' | 'Credit Note' | 'Debit Note';

interface TxEntry {
  id: string; sku: string; item: string; batch: string;
  txnId: string; docRef: string; docType: string;
  date: string; time: string; qty: number;
  unitCost: string; balance: string; value: string;
  warehouse: string; postedBy: string; note: string;
  type: TxnType;
}

const VOUCHER_TYPES: VoucherType[] = ['Sales Invoice', 'Purchase Invoice', 'Credit Note', 'Debit Note'];

// ── Helpers ───────────────────────────────────────────────────────────────────
// Convert dd/mm/yy → ISO (YYYY-MM-DD) for API
function ddmmyyToISO(d: string): string {
  const p = d.split('/');
  if (p.length < 3) return '';
  const yr = parseInt(p[2]);
  return `${yr < 50 ? 2000 + yr : 1900 + yr}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
}

// Convert ISO date → dd/mm/yy for display
function isoToDdmmyy(d: string): string {
  if (!d) return '--';
  const raw = d.split('T')[0].split('-');
  return raw.length < 3 ? d : `${raw[2]}/${raw[1]}/${raw[0].slice(2)}`;
}

// Derive TxnType from voucher_type string
function deriveType(vt: string): TxnType {
  const v = (vt || '').toLowerCase();
  if (v.includes('sales'))                             return 'Sales';
  if (v.includes('purchase'))                          return 'Purchase';
  if (v.includes('journal') || v.includes('transfer')) return 'Transfer';
  if (v.includes('physical') || v.includes('adjust'))  return 'Adjustment';
  if (v.includes('opening'))                           return 'Opening';
  return 'Sales';
}

// Map chronological API item → TxEntry
function mapChronoItem(e: any): TxEntry {
  return {
    id:        String(e.transactionId),
    sku:       e.sku          || '',
    item:      e.itemName     || '',
    batch:     e.batchSerial  || '',
    txnId:     e.voucherGuid  || String(e.transactionId),
    docRef:    e.documentNumber || '',
    docType:   e.voucherType  || '',
    date:      isoToDdmmyy(e.date),
    time:      '--',
    qty:       parseFloat(e.quantity || 0),
    unitCost:  `₹${parseFloat(e.unitCost || 0).toFixed(2)}`,
    balance:   '--',
    value:     `₹${Math.abs(parseFloat(e.value || 0)).toFixed(2)}`,
    warehouse: e.warehouse    || 'Main',
    postedBy:  '--',
    note:      e.note         || '',
    type:      deriveType(e.voucherType),
  };
}

// Map by_item transaction row → TxEntry
function mapItemTxn(t: any): TxEntry {
  return {
    id:        String(t.transactionId),
    sku:       '',
    item:      '',
    batch:     '',
    txnId:     t.voucherGuid  || String(t.transactionId),
    docRef:    t.docRef       || '',
    docType:   t.voucherType  || '',
    date:      isoToDdmmyy(t.date),
    time:      '--',
    qty:       parseFloat(t.quantity || 0),
    unitCost:  `₹${parseFloat(t.rate || 0).toFixed(2)}`,
    balance:   '--',
    value:     `₹${Math.abs(parseFloat(t.value || 0)).toFixed(2)}`,
    warehouse: t.warehouse    || '',
    postedBy:  '--',
    note:      '',
    type:      deriveType(t.voucherType),
  };
}

// Map by_document stock line → TxEntry
function mapDocLine(l: any): TxEntry {
  return {
    id:        l.stockGuid    || l.itemName || '',
    sku:       l.sku          || '',
    item:      l.itemName     || '',
    batch:     l.batchSerial  || '',
    txnId:     '',
    docRef:    '',
    docType:   '',
    date:      '--',
    time:      '--',
    qty:       parseFloat(l.quantity || 0),
    unitCost:  `₹${parseFloat(l.unitCost || 0).toFixed(2)}`,
    balance:   '--',
    value:     `₹${Math.abs(parseFloat(l.value || 0)).toFixed(2)}`,
    warehouse: l.warehouse    || '',
    postedBy:  '--',
    note:      '',
    type:      deriveType(''),
  };
}

const TYPE_COLOR: Record<TxnType, string> = {
  Sales: '#A89060', Purchase: COLORS.textPrimary, Transfer: '#7C3AED', Adjustment: '#D97706', Opening: '#3A3A3A',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function StockLedgerScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  // View & UI state
  const [viewMode,    setViewMode]    = useState<ViewMode>('chronological');
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [selected,    setSelected]    = useState<Set<string>>(new Set());

  // Filter modal
  const [filterApplied,      setFilterApplied]      = useState(0);
  const [showFilter,         setShowFilter]         = useState(false);
  const [showDatePick,       setShowDatePick]        = useState(false);
  const [pendingReopenFilter,setPendingReopenFilter] = useState(false);

  // Applied filters
  const [dateFrom,    setDateFrom]    = useState('01/04/24');
  const [dateTo,      setDateTo]      = useState('31/03/25');
  const [selWH,       setSelWH]       = useState<Set<string>>(new Set());
  const [selItems,    setSelItems]    = useState<Set<string>>(new Set());
  const [batchSearch, setBatchSearch] = useState('');
  const [selVouchers, setSelVouchers] = useState<Set<VoucherType>>(new Set());

  // Draft filters (inside modal before Apply)
  const [draftWH,         setDraftWH]         = useState<Set<string>>(new Set());
  const [draftWHSearch,   setDraftWHSearch]   = useState('');
  const [draftItems,      setDraftItems]      = useState<Set<string>>(new Set());
  const [draftItemSearch, setDraftItemSearch] = useState('');
  const [draftBatch,      setDraftBatch]      = useState('');
  const [draftVouchers,   setDraftVouchers]   = useState<Set<VoucherType>>(new Set());
  const [draftFrom,       setDraftFrom]       = useState('01/04/24');
  const [draftTo,         setDraftTo]         = useState('31/03/25');

  // Item autocomplete list
  const [stockItemsList, setStockItemsList] = useState<string[]>([]);
  const [itemsLoading,   setItemsLoading]   = useState(false);

  // Open filter → copy applied → draft
  const openFilter = () => {
    setDraftWH(new Set(selWH));
    setDraftWHSearch('');
    setDraftItems(new Set(selItems));
    setDraftItemSearch('');
    setDraftBatch(batchSearch);
    setDraftVouchers(new Set(selVouchers));
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
    setShowFilter(true);
    loadStockItems();
  };

  const applyFilters = () => {
    setSelWH(new Set(draftWH));
    setSelItems(new Set(draftItems));
    setBatchSearch(draftBatch);
    setSelVouchers(new Set(draftVouchers));
    setDateFrom(draftFrom);
    setDateTo(draftTo);
    setShowFilter(false);
    // Increment trigger — useEffect fires AFTER re-render when fetchLedger has fresh state
    setFilterApplied(n => n + 1);
  };

  const resetFilters = () => {
    const f = selectedFY?.startDate ? isoToDdmmyy(selectedFY.startDate) : '01/04/24';
    const t = selectedFY?.endDate   ? isoToDdmmyy(selectedFY.endDate)   : '31/03/25';
    setDraftWH(new Set()); setDraftWHSearch('');
    setDraftItems(new Set()); setDraftItemSearch('');
    setDraftBatch('');
    setDraftVouchers(new Set());
    setDraftFrom(f); setDraftTo(t);
  };

  // Issue 1 fix: close filter → open date picker → reopen filter on apply
  const openDateFromFilter = () => {
    setShowFilter(false);
    setPendingReopenFilter(true);
    setTimeout(() => setShowDatePick(true), 350);
  };

  const handleDateApply = (f: string, t: string) => {
    setDraftFrom(f);
    setDraftTo(t);
    setShowDatePick(false);
    if (pendingReopenFilter) {
      setPendingReopenFilter(false);
      setTimeout(() => setShowFilter(true), 350);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const fmtDateLabel = (s: string) => {
    const p = s.split('/');
    if (p.length < 3) return s;
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${p[0]} ${m[parseInt(p[1])-1]} ${p[2]}`;
  };

  // ── Auth ────────────────────────────────────────────────────────────────
  const { company, selectedFY } = useAuth();

  // Load stock items for autocomplete (once per session)
  const loadStockItems = useCallback(async () => {
    if (!company?.guid || stockItemsList.length > 0 || itemsLoading) return;
    setItemsLoading(true);
    try {
      const res = await getStocks(company.guid, { limit: 500 });
      if (res?.data?.items) {
        setStockItemsList(res.data.items.map((i: any) => i.name).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b)));
      }
    } catch {}
    finally { setItemsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.guid, stockItemsList.length, itemsLoading]);

  // Sync date range to selected FY whenever FY changes
  useEffect(() => {
    if (selectedFY?.startDate && selectedFY?.endDate) {
      const f = isoToDdmmyy(selectedFY.startDate);
      const t = isoToDdmmyy(selectedFY.endDate);
      setDateFrom(f); setDateTo(t);
      setDraftFrom(f); setDraftTo(t);
    }
  }, [selectedFY?.startDate, selectedFY?.endDate]);

  // ── API state ───────────────────────────────────────────────────────────
  // Separate data per mode (API returns different shapes per mode)
  const [chronoData,   setChronoData]   = useState<TxEntry[]>([]);
  const [byItemGroups, setByItemGroups] = useState<{ key: string; item: string; sku: string; value: string; items: TxEntry[] }[]>([]);
  const [byDocGroups,  setByDocGroups]  = useState<{ docRef: string; docType: string; date: string; warehouse: string; items: TxEntry[]; value: string }[]>([]);

  const [loading,    setLoading]    = useState(false);
  const [isLoadMore, setIsLoadMore] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [summary,    setSummary]    = useState({ entries: 0, totalIn: 0, totalOut: 0, value: 0 });

  // Map viewMode → API mode param
  const apiMode = viewMode === 'byItem' ? 'by_item' : viewMode === 'byDocument' ? 'by_document' : 'chronological';

  // Fetch ledger from API — pg=1 resets list for active mode
  const fetchLedger = useCallback(async (pg: number, reset = false) => {
    if (!company?.guid) return;
    pg === 1 ? setLoading(true) : setIsLoadMore(true);
    setError(null);
    try {
      const fyParam = fyInfoToParam(selectedFY);
      const params: Record<string, any> = { mode: apiMode, page: pg, limit: 25 };
      if (fyParam)          params.fy          = fyParam;
      if (dateFrom)        { params.from        = ddmmyyToISO(dateFrom); delete params.fy; }
      if (dateTo)            params.to          = ddmmyyToISO(dateTo);
      if (selItems.size > 0) params.item        = [...selItems].join(',');
      if (batchSearch)       params.batch       = batchSearch;
      if (selWH.size > 0)    params.warehouse   = [...selWH].join(',');
      if (selVouchers.size > 0) params.voucherType = [...selVouchers].join(',');

      const res = await getStockLedger(company.guid, params);
      if (res?.data) {
        const d = res.data;

        if (apiMode === 'chronological') {
          const mapped = (d.items || []).map(mapChronoItem);
          setChronoData(prev => (pg === 1 || reset) ? mapped : [...prev, ...mapped]);
        } else if (apiMode === 'by_item') {
          const mapped = (d.items || []).map((it: any) => ({
            key:   `${it.itemName}|${it.stockGuid || ''}`,
            item:  it.itemName  || '',
            sku:   it.sku       || '',
            value: `₹${parseFloat(it.latestRate || 0).toFixed(2)}`,
            items: (it.transactions || []).map(mapItemTxn),
          }));
          setByItemGroups(prev => (pg === 1 || reset) ? mapped : [...prev, ...mapped]);
        } else {
          const mapped = (d.items || []).map((doc: any) => ({
            docRef:    doc.voucherNumber || doc.voucherGuid || '',
            docType:   doc.voucherType  || '',
            date:      isoToDdmmyy(doc.date),
            warehouse: doc.warehouse    || '',
            value:     `₹${Math.abs(parseFloat(doc.amount || 0)).toFixed(2)}`,
            items:     (doc.stockLines  || []).map(mapDocLine),
          }));
          setByDocGroups(prev => (pg === 1 || reset) ? mapped : [...prev, ...mapped]);
        }

        if (d.warehouses?.length) setWarehouses(d.warehouses);
        if (d.summary)            setSummary(d.summary);
        const { page: p, pageSize: ps, total: t } = d.pagination || {};
        setHasMore(((p || 1) * (ps || 25)) < (t || 0));
        setPage(pg);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load stock ledger');
    } finally {
      setLoading(false);
      setIsLoadMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.guid, selectedFY, apiMode, dateFrom, dateTo, selItems, batchSearch, selWH, selVouchers]);

  // Re-fetch on company / FY change
  useEffect(() => { fetchLedger(1, true); }, [company?.guid, selectedFY]);
  // Re-fetch when tab switches
  useEffect(() => { fetchLedger(1, true); }, [apiMode]);
  // Re-fetch when filters are applied (filterApplied > 0 skips the initial mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (filterApplied > 0) fetchLedger(1, true); }, [filterApplied]);

  // Chronological: filters already sent to API — just use data as-is
  const filtered = chronoData;

  const activeFilterCount =
    selWH.size + selVouchers.size + selItems.size +
    (batchSearch ? 1 : 0);

  // Active item count for empty-state check
  const activeCount = viewMode === 'chronological' ? filtered.length
    : viewMode === 'byItem' ? byItemGroups.length
    : byDocGroups.length;

  // ── Render helpers ──────────────────────────────────────────────────────────
  const DetailRow = ({ label, value, label2, value2 }: { label: string; value: string; label2?: string; value2?: string }) => (
    <View style={s.detailRow}>
      <View style={s.detailCol}>
        <Text style={s.detailLbl}>{label}</Text>
        <Text style={s.detailVal}>{value}</Text>
      </View>
      {label2 && (
        <View style={s.detailCol}>
          <Text style={s.detailLbl}>{label2}</Text>
          <Text style={s.detailVal}>{value2 ?? ''}</Text>
        </View>
      )}
    </View>
  );

  // ── Chronological Card ───────────────────────────────────────────────────────
  const renderChronCard = (tx: TxEntry, idx: number = 0) => {
    const isExp  = expanded.has(tx.id);
    const isSel  = selected.has(tx.id);
    const tc     = TYPE_COLOR[tx.type];
    const isIn   = tx.qty > 0;
    return (
      <TouchableOpacity
        key={`chron-${tx.id || idx}-${idx}`}
        style={[s.card, isSel && s.cardSel]}
        activeOpacity={0.7}
        onPress={() => selected.size > 0 ? toggleSelect(tx.id) : toggleExpand(tx.id)}
        onLongPress={() => toggleSelect(tx.id)}
      >
        <View style={s.cardTop}>
          <View style={[s.typeBadgeBox, { backgroundColor: tc + '18' }]}>
            {isSel
              ? <Ionicons name="checkmark" size={15} color={tc} />
              : <Text style={[s.typeBadgeTxt, { color: tc }]}>{tx.type.slice(0, 2).toUpperCase()}</Text>
            }
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle} numberOfLines={1}>{tx.item || tx.docRef || '—'}</Text>
            <Text style={s.cardSub} numberOfLines={1}>
              {[tx.docRef, tx.date, tx.warehouse && tx.warehouse !== 'Main' ? tx.warehouse : null]
                .filter(Boolean).join('  ·  ')}
            </Text>
          </View>
          <View style={s.cardRight}>
            <Text style={[s.cardQty, { color: isIn ? COLORS.positive : COLORS.negative }]}>
              {isIn ? '+' : '−'}{Math.abs(tx.qty) % 1 === 0 ? Math.abs(tx.qty) : Math.abs(tx.qty).toFixed(2)}
            </Text>
            <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
          </View>
        </View>
        {isExp && (
          <View style={s.expandBody}>
            <View style={s.expandDivider} />
            {tx.batch  && tx.batch  !== '' && <DetailRow label="Batch/Serial" value={tx.batch} />}
            {tx.unitCost && <DetailRow label="Unit cost" value={tx.unitCost} label2="Value" value2={tx.value} />}
            <DetailRow label="Document" value={tx.docRef || '—'} label2="Type" value2={tx.docType || '—'} />
            <DetailRow label="Warehouse" value={tx.warehouse || '—'} />
            {tx.note && tx.note !== '' && <DetailRow label="Note" value={tx.note} />}
            <View style={[s.typePill, { backgroundColor: tc + '18', alignSelf: 'flex-start', marginTop: 6 }]}>
              <Text style={[s.typePillTxt, { color: tc }]}>{tx.type}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── By Item Card ─────────────────────────────────────────────────────────────
  const renderByItemCard = (grp: typeof byItemGroups[0], idx: number = 0) => {
    const isExp = expanded.has(grp.key);
    const isSel = grp.items.length > 0 && grp.items.every(t => selected.has(t.id));
    return (
      <TouchableOpacity
        key={`item-${grp.key || idx}-${idx}`}
        style={[s.card, isSel && s.cardSel]}
        activeOpacity={0.7}
        onPress={() => selected.size > 0
          ? grp.items.forEach(t => toggleSelect(t.id))
          : toggleExpand(grp.key)
        }
        onLongPress={() => grp.items.forEach(t => toggleSelect(t.id))}
      >
        <View style={s.cardTop}>
          <View style={s.avatar}>
            {isSel
              ? <Ionicons name="checkmark" size={16} color="#fff" />
              : <Text style={s.avatarTxt}>{grp.item.charAt(0)}</Text>
            }
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle} numberOfLines={1}>{grp.item || '—'}</Text>
            <Text style={s.cardSub} numberOfLines={1}>
              {grp.sku ? `SKU: ${grp.sku}  ·  ` : ''}{grp.items.length} movement{grp.items.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={s.cardRight}>
            <Text style={s.cardValue} numberOfLines={1}>{grp.value}</Text>
            <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </View>
        </View>
        {isExp && (
          <View style={s.expandBody}>
            {grp.items.map((tx, i) => (
              <View key={`bi-${tx.id || grp.key}-${i}`}>
                {i > 0 && <View style={s.innerDivider} />}
                <View style={s.expandDivider} />
                <DetailRow label="Date"     value={tx.date}    label2="Doc Ref"  value2={tx.docRef || '—'}   />
                <DetailRow label="Qty"      value={`${tx.qty > 0 ? '+' : '−'}${Math.abs(tx.qty)}`} label2="Warehouse" value2={tx.warehouse || '—'} />
                <DetailRow label="Type"     value={tx.docType || '—'} />
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── By Document Card ──────────────────────────────────────────────────────────
  const renderByDocCard = (grp: typeof byDocGroups[0], idx: number = 0) => {
    const isExp = expanded.has(grp.docRef);
    return (
      <View key={`doc-${grp.docRef || idx}-${idx}`} style={s.docGroup}>
        {/* Document Group Header */}
        <View style={s.docHeader}>
          <View style={s.docTypeBadge}>
            <Text style={s.docTypeTxt}>{grp.docType}</Text>
          </View>
          <View style={s.docMeta}>
            <Text style={s.docMetaTxt}>{grp.date}</Text>
            <View style={s.docDot} />
            <Text style={s.docMetaTxt}>{grp.warehouse}</Text>
          </View>
        </View>
        {/* Document Card */}
        <TouchableOpacity
          style={[s.card, { marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 }]}
          activeOpacity={0.7}
          onPress={() => toggleExpand(grp.docRef)}
          onLongPress={() => grp.items.forEach(t => toggleSelect(t.id))}
        >
          <View style={s.cardTop}>
            <View style={[s.avatar, { backgroundColor: COLORS.pageBg }]}>
              <Ionicons name="document-outline" size={18} color={COLORS.brandPrimary} />
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardTitle}>{grp.docRef}</Text>
              <Text style={s.cardSub}>{grp.items.length} item{grp.items.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={s.cardRight}>
              <Text style={s.cardValue}>{grp.value}</Text>
              <Ionicons name={isExp ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
            </View>
          </View>
          {isExp && (
            <View style={s.expandBody}>
              {grp.items.map((tx, i) => (
                <View key={`dl-${tx.id || tx.item}-${i}`}>
                  {i > 0 && <View style={s.innerDivider} />}
                  <View style={s.expandDivider} />
                  <DetailRow label="Item"      value={tx.item}      label2="Batch/Serial" value2={tx.batch}    />
                  <DetailRow label="Unit cost" value={tx.unitCost}  label2="Balance"      value2={tx.balance}  />
                  <DetailRow label="Posted-by" value={tx.postedBy}                                              />
                  <DetailRow label="Note"      value={tx.note}                                                  />
                </View>
              ))}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Ledger</Text>
        <TouchableOpacity style={s.headerBtn} onPress={openFilter} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={COLORS.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeTxt}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* View Mode Tabs */}
      <View style={s.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
          {([
            { key: 'chronological', icon: 'time-outline',        label: 'Chronological' },
            { key: 'byItem',        icon: 'cube-outline',         label: 'By Item'       },
            { key: 'byDocument',    icon: 'document-text-outline', label: 'By Document'  },
          ] as { key: ViewMode; icon: string; label: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, viewMode === tab.key && s.tabActive]}
              onPress={() => { setViewMode(tab.key); setExpanded(new Set()); setSelected(new Set()); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={14}
                color={viewMode === tab.key ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[s.tabTxt, viewMode === tab.key && s.tabTxtActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Summary Strip — from API summary */}
      <View style={s.summaryStrip}>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{summary.entries}</Text>
          <Text style={s.summaryLbl}>Entries</Text>
        </View>
        <View style={s.summarySep} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: COLORS.positive }]}>
            +{summary.totalIn % 1 === 0 ? summary.totalIn : summary.totalIn.toFixed(2)}
          </Text>
          <Text style={s.summaryLbl}>Total In</Text>
        </View>
        <View style={s.summarySep} />
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: COLORS.negative }]}>
            -{summary.totalOut % 1 === 0 ? summary.totalOut : summary.totalOut.toFixed(2)}
          </Text>
          <Text style={s.summaryLbl}>Total Out</Text>
        </View>
        <View style={s.summarySep} />
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>
            {summary.value >= 100000
              ? `₹${(summary.value/100000).toFixed(1)}L`
              : summary.value >= 1000
              ? `₹${(summary.value/1000).toFixed(1)}K`
              : `₹${summary.value.toFixed(0)}`}
          </Text>
          <Text style={s.summaryLbl}>Value</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1 }}><LoadingState message="Loading stock ledger..." /></View>
      ) : error ? (
        <View style={{ flex: 1 }}>
          <ErrorState message={error} onRetry={() => fetchLedger(1, true)} />
        </View>
      ) : (
        <ScrollView style={s.list} showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
          {viewMode === 'chronological' && filtered.map((tx, i) => renderChronCard(tx, i))}
          {viewMode === 'byItem'        && byItemGroups.map((g, i) => renderByItemCard(g, i))}
          {viewMode === 'byDocument'    && byDocGroups.map((g, i) => renderByDocCard(g, i))}
          {activeCount === 0 && (
            <View style={s.empty}>
              <Ionicons name="document-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>No stock movements found</Text>
              <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', paddingHorizontal: 24 }}>
                Try adjusting your filters or date range
              </Text>
            </View>
          )}
          {hasMore && (
            <TouchableOpacity
              style={s.loadMoreBtn}
              onPress={() => fetchLedger(page + 1)}
              activeOpacity={0.7}
              disabled={isLoadMore}
            >
              {isLoadMore
                ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                : <Text style={s.loadMoreTxt}>Load More</Text>}
            </TouchableOpacity>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Multi-select bottom bar */}
      {selected.size > 0 && (
        <View style={[s.selBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity onPress={() => setSelected(new Set())} activeOpacity={0.7} style={s.selCancel}>
            <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            <Text style={s.selCancelTxt}>{selected.size} selected</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.selShare} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={16} color="#fff" />
            <Text style={s.selShareTxt}>Share PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Modal — inlined (NOT a sub-component) to prevent remount on re-render */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowFilter(false)} activeOpacity={1} />
          <View style={[s.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Date Range */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Date range</Text>
                <TouchableOpacity style={s.dateRangeRow} onPress={openDateFromFilter} activeOpacity={0.8}>
                  <View style={s.dateField}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
                    <Text style={s.dateFieldTxt}>{fmtDateLabel(draftFrom)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.textTertiary} />
                  <View style={s.dateField}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
                    <Text style={s.dateFieldTxt}>{fmtDateLabel(draftTo)}</Text>
                  </View>
                </TouchableOpacity>
              </View>
              {/* Warehouse */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Warehouse</Text>

                {/* Selected chips */}
                {draftWH.size > 0 && (
                  <View style={s.chipWrap}>
                    {[...draftWH].map(w => (
                      <TouchableOpacity
                        key={w}
                        style={s.filterChipActive}
                        onPress={() => setDraftWH(prev => { const n = new Set(prev); n.delete(w); return n; })}
                        activeOpacity={0.7}
                      >
                        <Text style={s.filterChipTxtActive}>{w}</Text>
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Search bar */}
                <View style={[s.searchInput, { marginTop: draftWH.size > 0 ? 8 : 0 }]}>
                  <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                  <TextInput
                    style={s.searchTxt}
                    placeholder="Search warehouse..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftWHSearch}
                    onChangeText={setDraftWHSearch}
                  />
                  {draftWHSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setDraftWHSearch('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Results — always visible, filtered by search text */}
                {warehouses.length > 0 && (
                  <View style={s.whList}>
                    {warehouses
                      .filter(w => !draftWHSearch || w.toLowerCase().includes(draftWHSearch.toLowerCase()))
                      .map((w, idx, arr) => {
                        const checked = draftWH.has(w);
                        return (
                          <TouchableOpacity
                            key={w}
                            style={[s.whRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => {
                              setDraftWH(prev => { const n = new Set(prev); checked ? n.delete(w) : n.add(w); return n; });
                              if (!checked) setDraftWHSearch('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="business-outline" size={15} color={COLORS.textSecondary} />
                            <Text style={s.whRowTxt}>{w}</Text>
                            <View style={[s.checkbox, checked && s.checkboxActive]}>
                              {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    }
                  </View>
                )}
              </View>
              {/* Item / SKU */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Item / SKU</Text>

                {/* Selected item chips */}
                {draftItems.size > 0 && (
                  <View style={s.chipWrap}>
                    {[...draftItems].map(itm => (
                      <TouchableOpacity
                        key={itm}
                        style={s.filterChipActive}
                        onPress={() => setDraftItems(prev => { const n = new Set(prev); n.delete(itm); return n; })}
                        activeOpacity={0.7}
                      >
                        <Text style={s.filterChipTxtActive} numberOfLines={1}>{itm}</Text>
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Search input */}
                <View style={[s.searchInput, { marginTop: draftItems.size > 0 ? 8 : 0 }]}>
                  <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                  <TextInput
                    style={s.searchTxt}
                    placeholder="Search item or SKU"
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftItemSearch}
                    onChangeText={setDraftItemSearch}
                  />
                  {draftItemSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setDraftItemSearch('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Item suggestion list */}
                {(itemsLoading || stockItemsList.length > 0) && (
                  <View style={s.whList}>
                    {itemsLoading ? (
                      <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ padding: 12 }} />
                    ) : (
                      stockItemsList
                        .filter(itm => !draftItemSearch || itm.toLowerCase().includes(draftItemSearch.toLowerCase()))
                        .filter(itm => !draftItems.has(itm))
                        .slice(0, 25)
                        .map((itm, idx, arr) => (
                          <TouchableOpacity
                            key={itm}
                            style={[s.whRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => {
                              setDraftItems(prev => { const n = new Set(prev); n.add(itm); return n; });
                              setDraftItemSearch('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="cube-outline" size={15} color={COLORS.textSecondary} />
                            <Text style={s.whRowTxt} numberOfLines={1}>{itm}</Text>
                          </TouchableOpacity>
                        ))
                    )}
                  </View>
                )}
              </View>

              {/* Batch / Serial */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Batch / Serial</Text>
                <View style={s.searchInput}>
                  <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                  <TextInput
                    style={s.searchTxt}
                    placeholder="Search batch or serial no."
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftBatch}
                    onChangeText={setDraftBatch}
                  />
                  {draftBatch.length > 0 && (
                    <TouchableOpacity onPress={() => setDraftBatch('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {/* Transaction type */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Transaction type</Text>
                <View style={s.typeList}>
                  {VOUCHER_TYPES.map((v, idx) => {
                    const active = draftVouchers.has(v);
                    return (
                      <TouchableOpacity
                        key={v}
                        style={[s.typeRow, idx === VOUCHER_TYPES.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => setDraftVouchers(prev => { const n = new Set(prev); active ? n.delete(v) : n.add(v); return n; })}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.typeRowTxt, active && s.typeRowTxtActive]}>{v}</Text>
                        <View style={[s.checkbox, active && s.checkboxActive]}>
                          {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={resetFilters} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={s.applyTxt}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DateRangePicker — outside filter modal, no nesting */}
      <DateRangePickerModal
        visible={showDatePick}
        fromDate={draftFrom}
        toDate={draftTo}
        onApply={handleDateApply}
        onClose={() => {
          setShowDatePick(false);
          if (pendingReopenFilter) {
            setPendingReopenFilter(false);
            setTimeout(() => setShowFilter(true), 350);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  filterBadge: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // View Mode Tabs
  tabRow:    { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tabScroll: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8 },
  tab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  tabActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  tabTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: '#fff' },

  // Summary Strip
  summaryStrip: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  summaryItem:  { flex: 1, paddingVertical: 12, alignItems: 'center', gap: 2 },
  summarySep:   { width: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8 },
  summaryVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl:   { fontSize: 10, color: COLORS.textSecondary },

  // List
  list:        { flex: 1 },
  listContent: { padding: SPACING.md, gap: 10 },

  // Cards
  card:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  cardSel: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },

  avatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  cardInfo:  { flex: 1, gap: 3 },
  cardTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  cardSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardQty:   { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  cardValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  expandBody:    { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  expandDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: SPACING.sm },
  innerDivider:  { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  detailRow: { flexDirection: 'row', marginBottom: 8 },
  detailCol: { flex: 1, gap: 2 },
  detailLbl: { fontSize: 10, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  detailVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  typePill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  typePillTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // By Document
  docGroup:   { gap: 0 },
  docHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingBottom: 6 },
  docTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.brandPrimary + '18' },
  docTypeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  docMeta:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docMetaTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  docDot:     { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textTertiary },

  // Selection bar
  selBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  selCancel:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selShare:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.textPrimary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.full },
  selShareTxt:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },

  // Empty
  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  // Load More
  loadMoreBtn: { alignSelf: 'center', marginVertical: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  loadMoreTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  // Type badge (replaces letter avatar in chronological cards)
  typeBadgeBox: { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeBadgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  // Filter Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingHorizontal: SPACING.md },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 8 },
  modalTitle:   { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  filterSection:      { marginBottom: 20 },
  filterSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateField:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  dateFieldTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dateTo:       { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },

  chipWrap:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  filterChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipActive:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.textPrimary, borderWidth: 0 },
  filterChipTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  filterChipTxtActive: { fontSize: TYPOGRAPHY.sm, color: '#fff', fontWeight: '600' },

  // Warehouse search list
  whList:   { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', marginTop: 8 },
  whRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  whRowTxt: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },

  searchInput: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  searchTxt:   { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  typeList:   { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  typeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  typeRowTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  typeRowTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  checkbox:       { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  modalFooter: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelBtn:   { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.pageBg, alignItems: 'center' },
  cancelTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  applyBtn:    { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.textPrimary, alignItems: 'center' },
  applyTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
