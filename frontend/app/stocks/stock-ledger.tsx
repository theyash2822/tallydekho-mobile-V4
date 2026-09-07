import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import SearchBar from '../../src/components/SearchBar';
import FilterBottomSheet, {
  FilterCheckRow,
  filterSheetContentStyles as fm,
  isFilterAllSelected,
  isFilterOptionChecked,
  toggleFilterFromAll,
  toggleFilterAll,
  useMultiFilterHydration,
  isFilterSelectionValid,
  normalizeFilterAllSelection,
} from '../../src/components/FilterBottomSheet';
import { FilterIconWithBadge, ActiveFilterChips } from '../../src/components/voucherHomeFilters';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useSettings } from '../../src/context/SettingsContext';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { getStockLedger } from '../../src/services/api';
import { LoadingState, ErrorState } from '../../src/components/ApiStateViews';
import { useTranslation } from 'react-i18next';
import { shareStockRegisterPdf, companyFromAuth } from '../../src/utils/multiShare';

// ── Types ─────────────────────────────────────────────────────────────────────
type ViewMode = 'chronological' | 'byItem' | 'byDocument';
type TxnType  = 'Sales' | 'Purchase' | 'Transfer' | 'Adjustment' | 'Opening';
// VoucherType is now a plain string — actual types come dynamically from the API
// (Tally companies use custom names like 'Sales GST', 'Purchase GST', not always 'Sales Invoice')
type VoucherType = string;

interface TxEntry {
  id: string; sku: string; item: string; batch: string;
  txnId: string; docRef: string; docType: string;
  date: string; time: string; qty: number;
  unitCost: string; balance: string; value: string;
  warehouse: string; postedBy: string; note: string;
  type: TxnType;
}

// No hardcoded voucher types — loaded dynamically from API per company

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

// ── Filter modal (Warehouse | Transaction Type — Ledger-style R2 multi-select) ─

function StockLedgerFilterModal({ visible, onClose, onApply, initWh, initTypes, whOptions, typeOptions }: {
  visible: boolean; onClose: () => void;
  onApply: (wh: string[], types: string[]) => void;
  initWh: string[]; initTypes: string[];
  whOptions: { id: string; label: string }[];
  typeOptions: { id: string; label: string }[];
}) {
  const [tab, setTab] = useState<'Warehouse' | 'Type'>('Warehouse');
  const [selWh, setSelWh] = useState<string[]>([]);
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [whSearch, setWhSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');

  const whIds = useMemo(() => whOptions.map(w => w.id), [whOptions]);
  const typeIds = useMemo(() => typeOptions.map(t => t.id), [typeOptions]);

  useMultiFilterHydration(visible, initWh, whIds, setSelWh);
  useMultiFilterHydration(visible, initTypes, typeIds, setSelTypes);

  useEffect(() => {
    if (visible) {
      setWhSearch('');
      setTypeSearch('');
      setTab('Warehouse');
    }
  }, [visible]);

  const isAllWh = isFilterAllSelected(selWh, whIds);
  const isAllTypes = isFilterAllSelected(selTypes, typeIds);
  const activeCount = (isAllWh ? 0 : selWh.length) + (isAllTypes ? 0 : selTypes.length);
  const canApply =
    isFilterSelectionValid(selWh, whIds) && isFilterSelectionValid(selTypes, typeIds);

  const filteredWh = useMemo(() => {
    const q = whSearch.trim().toLowerCase();
    const list = whOptions.filter(Boolean);
    if (!q) return list;
    return list.filter(w => w.label.toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
  }, [whOptions, whSearch]);

  const filteredTypes = useMemo(() => {
    const q = typeSearch.trim().toLowerCase();
    const list = typeOptions.filter(Boolean);
    if (!q) return list;
    return list.filter(t => t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  }, [typeOptions, typeSearch]);

  const handleApply = () => {
    if (!canApply) return;
    onApply(normalizeFilterAllSelection(selWh, whIds), normalizeFilterAllSelection(selTypes, typeIds));
    onClose();
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Stock Ledger"
      activeCount={activeCount}
      onClear={() => { setSelWh([...whIds]); setSelTypes([...typeIds]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
      applyDisabled={!canApply}
      heightFraction={0.68}
    >
      <View style={fm.tabs}>
        {(['Warehouse', 'Type'] as const).map(cat => (
          <TouchableOpacity key={cat} style={[fm.tab, tab === cat && fm.tabActive]} onPress={() => setTab(cat)} activeOpacity={0.7}>
            <Text style={[fm.tabTxt, tab === cat && fm.tabTxtActive]}>{cat === 'Type' ? 'Transaction Type' : cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'Warehouse' ? (
        <View style={fm.panel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput style={fm.searchInput} placeholder="Search warehouse..." placeholderTextColor={COLORS.textTertiary} value={whSearch} onChangeText={setWhSearch} />
          </View>
          <FilterCheckRow label="All warehouses" selected={isAllWh} onPress={() => setSelWh(prev => toggleFilterAll(prev, whIds))} />
          {whOptions.length === 0 ? (
            <Text style={fm.hint}>No warehouses available</Text>
          ) : filteredWh.length === 0 ? (
            <Text style={fm.hint}>No warehouses match your search</Text>
          ) : filteredWh.map(w => (
            <FilterCheckRow key={w.id} label={w.label} selected={isFilterOptionChecked(selWh, w.id)} onPress={() => setSelWh(prev => toggleFilterFromAll(prev, w.id, whIds))} />
          ))}
        </View>
      ) : (
        <View style={fm.panel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput style={fm.searchInput} placeholder="Search transaction type..." placeholderTextColor={COLORS.textTertiary} value={typeSearch} onChangeText={setTypeSearch} />
          </View>
          <FilterCheckRow label="All types" selected={isAllTypes} onPress={() => setSelTypes(prev => toggleFilterAll(prev, typeIds))} />
          {typeOptions.length === 0 ? (
            <Text style={fm.hint}>No transaction types found</Text>
          ) : filteredTypes.length === 0 ? (
            <Text style={fm.hint}>No types match your search</Text>
          ) : filteredTypes.map(t => (
            <FilterCheckRow key={t.id} label={t.label} selected={isFilterOptionChecked(selTypes, t.id)} onPress={() => setSelTypes(prev => toggleFilterFromAll(prev, t.id, typeIds))} />
          ))}
        </View>
      )}
    </FilterBottomSheet>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function StockLedgerScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  // View & UI state
  const [viewMode,    setViewMode]    = useState<ViewMode>('chronological');
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [isSharing,   setIsSharing]   = useState(false);

  // Filters & search
  const [showFilter,   setShowFilter]   = useState(false);
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom,     setDateFrom]     = useState('01/04/24');
  const [dateTo,       setDateTo]       = useState('31/03/25');
  const [selWH,        setSelWH]        = useState<string[]>([]);
  const [selVouchers,  setSelVouchers]  = useState<string[]>([]);
  const [search,       setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleShareSelected = async () => {
    if (selected.size === 0 || isSharing) return;
    const allTx = viewMode === 'chronological'
      ? chronoData
      : viewMode === 'byItem'
        ? byItemGroups.flatMap(g => g.items)
        : byDocGroups.flatMap(g => g.items);
    const rows = allTx.filter(t => selected.has(t.id));
    if (!rows.length) return;
    setIsSharing(true);
    try {
      await shareStockRegisterPdf({
        company: companyFromAuth(company),
        title: 'Stock Ledger',
        period: `${dateFrom} – ${dateTo}`,
        rows: rows.map(tx => ({
          date: tx.date,
          particulars: tx.item || tx.docRef,
          vchType: tx.docType || tx.type,
          vchNo: tx.docRef,
          inwardsQty: tx.qty > 0 ? String(Math.abs(tx.qty)) : '',
          outwardsQty: tx.qty < 0 ? String(Math.abs(tx.qty)) : '',
        })),
      }, { onBeforeShare: () => setIsSharing(false) });
      setSelected(new Set());
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not share PDF.');
    } finally {
      setIsSharing(false);
    }
  };

  // ── Auth ────────────────────────────────────────────────────────────────
  const { company, selectedFY } = useAuth();

  // Sync date range to selected FY whenever FY changes
  useEffect(() => {
    if (selectedFY?.startDate && selectedFY?.endDate) {
      setDateFrom(isoToDdmmyy(selectedFY.startDate));
      setDateTo(isoToDdmmyy(selectedFY.endDate));
    }
  }, [selectedFY?.startDate, selectedFY?.endDate]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── API state ───────────────────────────────────────────────────────────
  // Separate data per mode (API returns different shapes per mode)
  const [chronoData,   setChronoData]   = useState<TxEntry[]>([]);
  const [byItemGroups, setByItemGroups] = useState<{ key: string; item: string; sku: string; value: string; items: TxEntry[] }[]>([]);
  const [byDocGroups,  setByDocGroups]  = useState<{ docRef: string; docType: string; date: string; warehouse: string; note: string; items: TxEntry[]; value: string }[]>([]);

  const [loading,    setLoading]    = useState(false);
  const [isLoadMore, setIsLoadMore] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(false);
  const [warehouses,    setWarehouses]    = useState<string[]>([]);
  const [apiVoucherTypes, setApiVoucherTypes] = useState<string[]>([]);
  const [summary,    setSummary]    = useState({ entries: 0, totalIn: 0, totalOut: 0, value: 0 });

  const [voucherTypesLoading, setVoucherTypesLoading] = useState(false);

  const whOptions = useMemo(() => warehouses.map(w => ({ id: w, label: w })), [warehouses]);
  const typeOptions = useMemo(() => apiVoucherTypes.map(v => ({ id: v, label: v })), [apiVoucherTypes]);
  const activeFilterCount = (selWH.length > 0 ? selWH.length : 0) + (selVouchers.length > 0 ? selVouchers.length : 0);

  // Load voucher types independently — called on mount + FY change so filter is always ready
  const loadVoucherTypes = useCallback(async () => {
    if (!company?.guid || voucherTypesLoading) return;
    setVoucherTypesLoading(true);
    try {
      const fyParam = fyInfoToParam(selectedFY);
      const params: Record<string, any> = { mode: 'chronological', page: 1, limit: 1 };
      if (fyParam) params.fy = fyParam;
      const res = await getStockLedger(company.guid, params);
      if (res?.data?.voucherTypes?.length) {
        setApiVoucherTypes(res.data.voucherTypes);
      }
    } catch {}
    finally { setVoucherTypesLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.guid, selectedFY]);

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
      if (debouncedSearch)   params.search      = debouncedSearch;
      if (selWH.length > 0)    params.warehouse   = selWH.join(',');
      if (selVouchers.length > 0) params.voucherType = selVouchers.join(',');

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
            note:      doc.note         || '',
            value:     `₹${Math.abs(parseFloat(doc.amount || 0)).toFixed(2)}`,
            items:     (doc.stockLines  || []).map(mapDocLine),
          }));
          setByDocGroups(prev => (pg === 1 || reset) ? mapped : [...prev, ...mapped]);
        }

        if (d.warehouses?.length)    setWarehouses(d.warehouses);
        if (d.voucherTypes?.length)  setApiVoucherTypes(d.voucherTypes);
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
  }, [company?.guid, selectedFY, apiMode, dateFrom, dateTo, debouncedSearch, selWH, selVouchers]);

  // Always keep a ref to the latest fetchLedger so effects never call a stale closure
  const fetchLedgerRef = useRef(fetchLedger);
  useEffect(() => { fetchLedgerRef.current = fetchLedger; }); // runs every render, no deps

  // Re-fetch on company / FY / filters / search / tab change
  useEffect(() => { fetchLedgerRef.current(1, true); }, [company?.guid, selectedFY, apiMode, dateFrom, dateTo, debouncedSearch, selWH.join(','), selVouchers.join(',')]);
  useEffect(() => { loadVoucherTypes(); }, [company?.guid, selectedFY]);

  // Chronological: filters already sent to API — just use data as-is
  const filtered = chronoData;

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
              <Text style={s.cardSub}>{grp.items.length} item{grp.items.length !== 1 ? 's' : ''}{grp.note ? ` · ${grp.note}` : ''}</Text>
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
      <ScreenHeader
        title={t('stocks.stockLedger')}
        onBack={() => router.back()}
        right={(
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIconBtn} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <FilterIconWithBadge count={activeFilterCount} onPress={() => setShowFilter(true)} />
          </View>
        )}
      />

      <ActiveFilterChips
        variant="amber"
        chips={[
          ...selWH.map(w => ({ id: `wh:${w}`, label: w })),
          ...selVouchers.map(v => ({ id: `vt:${v}`, label: v })),
        ]}
        onRemove={(chipId) => {
          if (chipId.startsWith('wh:')) setSelWH(p => p.filter(x => x !== chipId.slice(3)));
          if (chipId.startsWith('vt:')) setSelVouchers(p => p.filter(x => x !== chipId.slice(3)));
        }}
        onClearAll={() => { setSelWH([]); setSelVouchers([]); }}
      />

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

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search items, documents..." />

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
          <TouchableOpacity
            style={[s.selShare, isSharing && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleShareSelected}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="share-social-outline" size={16} color="#fff" />
            }
            <Text style={s.selShareTxt}>{isSharing ? 'Preparing…' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <StockLedgerFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={(wh, types) => { setSelWH(wh); setSelVouchers(types); }}
        initWh={selWH}
        initTypes={selVouchers}
        whOptions={whOptions}
        typeOptions={typeOptions}
      />

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom}
        toDate={dateTo}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); setShowDatePick(false); }}
        onClose={() => setShowDatePick(false)}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'visible' },
  headerIconBtn: { width: 38, height: 38, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
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
