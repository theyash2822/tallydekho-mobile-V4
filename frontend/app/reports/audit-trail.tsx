import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Modal, Alert, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { getVouchers, getMyEntries, retryMyEntry, getInvoicePreview } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';
import { socketService } from '../../src/services/socketService';
import {
  buildProformaToInvoicePrefillFromPreview,
  proformaPrefillStorageKey,
} from '../../src/utils/proformaToInvoicePrefill';

const SCREEN_W = Dimensions.get('window').width;
const AMBER = '#A89060';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = 'myentries' | 'daybook';
type SyncStatus = 'synced' | 'pending' | 'processing' | 'failed';
type VoucherType =
  | 'ALL' | 'Sales' | 'Proforma Invoice' | 'Sales Order' | 'Purchase' | 'Payment' | 'Receipt'
  | 'Journal' | 'Contra' | 'Debit Note' | 'Credit Note' | 'Delivery Note'
  | 'Stock Transfer' | 'Adjustment' | 'Stock Edit' | 'New Item' | 'New Ledger' | 'New Warehouse';

type LifecycleFilter =
  | 'all' | 'pending_sync' | 'regular' | 'optional'
  | 'originally_optional' | 'failed' | 'irn_pending' | 'ewb_pending';

const LIFECYCLE_FILTERS: { key: LifecycleFilter; label: string }[] = [
  { key: 'all',               label: 'All' },
  { key: 'pending_sync',      label: 'Pending Sync' },
  { key: 'regular',           label: 'Regular' },
  { key: 'optional',          label: 'Optional' },
  { key: 'originally_optional', label: 'Orig. Optional' },
  { key: 'failed',            label: 'Failed' },
  { key: 'irn_pending',       label: 'IRN Pending' },
  { key: 'ewb_pending',       label: 'EWB Pending' },
];

interface VoucherEntry {
  id: string;
  ref: string;
  date: string;
  month: string;
  type: Exclude<VoucherType, 'ALL'>;
  party: string;
  description: string;
  amount: string;
  isCredit: boolean;
  syncStatus?: SyncStatus;
  action?: 'Created' | 'Edited' | 'Deleted';
  isMine: boolean;
  /** Master writes (ledger/bank/warehouse/item) — no Regular/Optional badges */
  isMaster?: boolean;
  queueId?: number | string | null;
  // Lifecycle fields
  tdkRef?: string;
  tallyVoucherNo?: string;
  originalEntryType?: 'regular' | 'optional';
  currentEntryType?: 'regular' | 'optional';
  booksImpactStatus?: 'posted' | 'not_posted';
  conversionStatus?: 'pending' | 'converted' | 'cancelled';
  eInvoiceStatus?: string;
  eWayBillStatus?: string;
  // For Receipt vouchers auto-created by a collect_payment Sales invoice
  // Invoice+Receipt split (2026-06-30): parent linkage exposed by /vouchers/my-entries
  parentInvoiceUuid?: string | null;
  parentTdkRef?: string | null;
  parentTallyVoucherNo?: string | null;
  rawAmount?: number;          // raw numeric amount for linking
  rawDate?: string;
  rawParty?: string;
  rawPayload?: any;            // _payload for queue rows
}

const MASTER_ENTRY_TYPES = new Set(['party', 'bank', 'warehouse', 'item', 'alter_stock_item']);
const isMasterEntryType = (t?: string) => !!t && MASTER_ENTRY_TYPES.has(String(t).toLowerCase());

// ─── Voucher Types ────────────────────────────────────────────────────────────
const VOUCHER_TYPES: VoucherType[] = [
  'ALL', 'Sales', 'Proforma Invoice', 'Sales Order', 'Purchase', 'Payment', 'Receipt',
  'Journal', 'Contra', 'Debit Note', 'Credit Note', 'Delivery Note',
  'Stock Transfer', 'Adjustment', 'Stock Edit', 'New Item', 'New Ledger', 'New Warehouse',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatMonth = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
};

const isCreditVoucher = (voucherType: string): boolean => {
  const t = (voucherType || '').toLowerCase();
  if (t.includes('receipt'))     return true;
  // Match both 'credit note' (Tally sync rows) and 'credit_note' (write_queue entry_type)
  if (t.includes('credit note') || t.includes('credit_note')) return true;
  if (t.includes('proforma')) return true;
  if (t.includes('sales') && !t.includes('return') && !t.includes('order')) return true;
  return false;
};

const mapVoucherType = (raw: string): Exclude<VoucherType, 'ALL'> => {
  const s = (raw || '').toLowerCase();
  if (s.includes('proforma')) return 'Proforma Invoice';
  if (s.includes('sales') && s.includes('order')) return 'Sales Order';
  if (s.includes('sales')) return 'Sales';
  if (s.includes('purchase') && s.includes('order')) return 'Purchase';
  if (s.includes('purchase')) return 'Purchase';
  if (s.includes('payment')) return 'Payment';
  if (s.includes('receipt')) return 'Receipt';
  if (s.includes('journal')) return 'Journal';
  if (s.includes('contra')) return 'Contra';
  if (s.includes('debit')) return 'Debit Note';
  if (s.includes('credit')) return 'Credit Note';
  if (s.includes('delivery')) return 'Delivery Note';
  if (s.includes('transfer')) return 'Stock Transfer';
  if (s.includes('adjustment')) return 'Adjustment';
  if (s.includes('stock edit') || s.includes('alter')) return 'Stock Edit';
  if (s.includes('new item') || s === 'item') return 'New Item';
  if (s.includes('new ledger') || s.includes('party') || s === 'bank' || s.includes('new party')) return 'New Ledger';
  if (s.includes('new warehouse') || s.includes('warehouse')) return 'New Warehouse';
  return 'Journal';
};

const isConvertedProformaRow = (r: any) => {
  const appType = String(r.app_voucher_type || r.voucher_type || '').toLowerCase();
  const ref = String(r.tdk_reference_no || '');
  const isPf = appType.includes('proforma') || ref.startsWith('TDK-PRF-');
  return isPf && (r.conversion_status === 'converted' || r.current_entry_type === 'regular');
};

const isProformaOrigin = (entry: { type?: string; tdkRef?: string }) =>
  entry.type === 'Proforma Invoice' || (entry.tdkRef || '').startsWith('TDK-PRF-');

const mapApiRow = (r: any, fmt: (n: number) => string = (n) => String(n)): VoucherEntry => ({
  // Prefer TDK ref + DB id — vouchers.guid alone can repeat when my-entries JOIN fans out
  // (e.g. Journal #1 vs Payment #1 same day under loose voucher_type match).
  id: [
    r.tdk_reference_no || '',
    r.guid || '',
    r.id != null ? String(r.id) : '',
    r.av_id != null ? String(r.av_id) : '',
    r._queue_id != null ? `wq${r._queue_id}` : '',
  ].filter(Boolean).join('_') || `row_${Math.random().toString(36).slice(2, 9)}`,
  ref: r.voucher_number || '',
  date: r.date || '',
  month: formatMonth(r.date),
  type: isConvertedProformaRow(r) ? 'Sales' : mapVoucherType(r.app_voucher_type || r.voucher_type),
  party: r.party_name || '',
  description: r.voucher_type || '',
  amount: fmt(Math.abs(+r.amount || 0)),
  rawAmount: Math.abs(+r.amount || 0),
  rawDate: r.date || '',
  rawParty: r.party_name || '',
  isCredit: isCreditVoucher(r.app_voucher_type || r.voucher_type),
  syncStatus: 'synced' as const,
  isMine: true,
  isMaster: !!(r._is_master || isMasterEntryType(r.voucher_type)),
  queueId: r._queue_id ?? null,
  tdkRef: r.tdk_reference_no || '',
  tallyVoucherNo: r.av_tally_voucher_no || r.voucher_number || '',
  originalEntryType: r.original_entry_type,
  currentEntryType: r.current_entry_type,
  booksImpactStatus: r.books_impact_status,
  conversionStatus: r.conversion_status,
  eInvoiceStatus: r.e_invoice_status,
  eWayBillStatus: r.e_way_bill_status,
  parentInvoiceUuid: r.parent_invoice_uuid || null,
  parentTdkRef: r.parent_tdk_reference_no || null,
  parentTallyVoucherNo: r.parent_tally_voucher_no || null,
});

// ─── Color Maps ───────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  'Sales': '#2D7D46', 'Proforma Invoice': '#1A1A1A', 'Sales Order': '#059669', 'Purchase': '#2563EB', 'Payment': '#C0392B',
  'Receipt': '#2D7D46', 'Journal': '#D97706', 'Contra': '#7C3AED',
  'Debit Note': '#C0392B', 'Credit Note': '#2D7D46', 'Delivery Note': '#0891B2',
};
const ACTION_COLORS: Record<string, string> = {
  Created: '#2D7D46', Edited: '#D97706', Deleted: '#C0392B',
};

// ─── Type Breakdown Card ──────────────────────────────────────────────────────
function TypeBreakdownCard({ entries }: { entries: VoucherEntry[] }) {
  const breakdown = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => { map[e.type] = (map[e.type] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  if (breakdown.length === 0) return null;

  return (
    <View style={tc.card}>
      <Text style={tc.title}>Voucher Breakdown</Text>
      <View style={tc.grid}>
        {breakdown.map(([type, count]) => {
          const color = TYPE_COLORS[type] || COLORS.textSecondary;
          return (
            <View key={type} style={tc.cell}>
              <View style={[tc.dot, { backgroundColor: color }]} />
              <Text style={tc.typeLabel} numberOfLines={1}>{type}</Text>
              <Text style={[tc.count, { color }]}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  title: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  typeLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, maxWidth: 80 },
  count: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
});

// ─── Voucher Type Dropdown ────────────────────────────────────────────────────
function VTypeDropdown({
  value, onSelect, visible, onClose,
}: { value: VoucherType; onSelect: (v: VoucherType) => void; visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={onClose}>
        <View style={dd.sheet}>
          <View style={dd.sheetHandle} />
          <View style={dd.sheetHeader}>
            <Text style={dd.sheetTitle}>Voucher Type</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          {VOUCHER_TYPES.map(vt => (
            <TouchableOpacity
              key={vt}
              style={[dd.option, value === vt && dd.optionActive]}
              onPress={() => { onSelect(vt); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[dd.optionTxt, value === vt && dd.optionTxtActive]}>
                {vt === 'ALL' ? 'All Types' : vt}
              </Text>
              {value === vt && <Ionicons name="checkmark" size={16} color={AMBER} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 20 }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const dd = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  sheetTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  option:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  optionActive:{ backgroundColor: '#FDF9F4' },
  optionTxt:   { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  optionTxtActive: { color: AMBER, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AuditTrailScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;

  const defaultFrom = () => {
    if (selectedFY?.startDate) return selectedFY.startDate;
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };
  const defaultTo = () => selectedFY?.endDate || new Date().toISOString().split('T')[0];

  const [activeTab,      setActiveTab]      = useState<TabType>('myentries');
  const [fromDate,       setFromDate]       = useState(defaultFrom);
  const [toDate,         setToDate]         = useState(defaultTo);

  // Sync dates when selectedFY loads asynchronously (prevents stale initial state)
  const fySynced = React.useRef(false);
  useEffect(() => {
    if (selectedFY?.startDate && !fySynced.current) {
      fySynced.current = true;
      setFromDate(selectedFY.startDate);
      setToDate(selectedFY.endDate || new Date().toISOString().split('T')[0]);
    }
  }, [selectedFY?.startDate]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [voucherType,    setVoucherType]    = useState<VoucherType>('ALL');
  const [showVTypeModal, setShowVTypeModal] = useState(false);
  const [showDr,         setShowDr]         = useState(true);
  const [showCr,         setShowCr]         = useState(true);
  const [multiSelect,    setMultiSelect]    = useState(false);
  const [selected,       setSelected]       = useState<string[]>([]);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>('all');
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const retryingRef = useRef<Set<string>>(new Set());
  const bulkRetryingRef = useRef(false);
  const convertingRef = useRef<Set<string>>(new Set());
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  // ── API State ─────────────────────────────────────────────
  const [apiEntries, setApiEntries] = useState<VoucherEntry[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshKey,    setRefreshKey]    = useState(0);

  // ── Refresh on screen focus (catches Optional→Regular conversions + Tally syncs) ──
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(k => k + 1);
    }, [])
  );

  // ── Auto-refresh when backend reconciles a TDK voucher number after Tally sync ──
  useEffect(() => {
    socketService.setOnVoucherSynced(() => {
      setRefreshKey(k => k + 1);
    });
    return () => { socketService.setOnVoucherSynced(null); };
  }, []);

  // ── write_queue entry_type → display label ─────────────────
  const WQ_ENTRY_LABEL: Record<string, string> = {
    sales: 'Sales', purchase: 'Purchase', payment: 'Payment',
    receipt: 'Receipt', journal: 'Journal', contra: 'Contra',
    stock_transfer: 'Stock Transfer', stock_adjustment: 'Adjustment',
    alter_stock_item: 'Stock Edit', item: 'New Item',
    party: 'New Party', bank: 'Bank', warehouse: 'Warehouse',
    sales_order: 'Sales Order', purchase_order: 'Purchase Order',
    credit_note: 'Credit Note', debit_note: 'Debit Note',
    delivery_note: 'Delivery Note',
    proforma: 'Proforma Invoice', proforma_invoice: 'Proforma Invoice',
  };

  // Build a human-readable changes summary for alter_stock_item tiles
  const buildChangeSummary = (payload: any): string => {
    try {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const changes = data?.changes || {};
      const parts: string[] = [];
      if (changes.hsnCode)           parts.push(`HSN → ${changes.hsnCode}`);
      if (changes.taxRate != null)   parts.push(`GST → ${changes.taxRate}%`);
      if (changes.groupName)         parts.push(`Group → ${changes.groupName}`);
      if (changes.reorderLevel != null) parts.push(`Reorder → ${changes.reorderLevel}`);
      if (changes.name)              parts.push(`Renamed → ${changes.name}`);
      return parts.length > 0 ? parts.join(' · ') : 'No changes recorded';
    } catch { return ''; }
  };

  const mapQueueRow = (p: any): VoucherEntry => ({
    id: 'wq_' + String(p._queue_id),
    ref:  p.voucher_number || '',
    date: p.date || '',
    month: formatMonth(p.date),
    type: isConvertedProformaRow(p) ? 'Sales' : mapVoucherType(WQ_ENTRY_LABEL[p.app_voucher_type || p.voucher_type || ''] || p.app_voucher_type || p.voucher_type || 'Journal'),
    // For stock edits: show item name as party, changes as description
    party: p.voucher_type === 'alter_stock_item'
      ? (p.party_name || '')
      : (p.party_name || ''),
    description: p.voucher_type === 'alter_stock_item'
      ? buildChangeSummary(p._payload)
      : (WQ_ENTRY_LABEL[p.voucher_type || ''] || (p.voucher_type || '').replace(/_/g, ' ')),
    amount: formatAmount(Math.abs(+(p.amount || 0))),
    rawAmount: Math.abs(+(p.amount || 0)),
    rawDate: p.date || '',
    rawParty: p.party_name || '',
    rawPayload: p._payload,
    // Phase D11(b): use the same Sales=Cr/Receipt=Cr/Payment=Dr classifier as posted rows
    // so a queue+posted pair of the same voucher render with matching Dr/Cr semantics.
    isCredit: isCreditVoucher(p.voucher_type || ''),
    syncStatus: p._queue_status === 'success' ? 'synced'
      : p._queue_status === 'failed' ? 'failed'
      : p._queue_status === 'processing' ? 'processing' : 'pending',
    action: 'Created',
    isMine: true,
    isMaster: !!(p._is_master || isMasterEntryType(p.voucher_type)),
    queueId: p._queue_id ?? null,
    tdkRef: p.tdk_reference_no || '',
    // av_tally_voucher_no = app_vouchers.tally_voucher_no (populated by ingestProcessor reconciliation).
    // p.voucher_number = wq.tally_voucher_number which is often empty (Tally ImportData doesn't return it).
    tallyVoucherNo: p.av_tally_voucher_no || p.voucher_number || '',
    originalEntryType: p.original_entry_type,
    currentEntryType: p.current_entry_type,
    booksImpactStatus: p.books_impact_status || 'not_posted',
    conversionStatus: p.conversion_status,
    eInvoiceStatus: p.e_invoice_status,
    eWayBillStatus: p.e_way_bill_status,
    parentInvoiceUuid: p.parent_invoice_uuid || null,
    parentTdkRef: p.parent_tdk_reference_no || null,
    parentTallyVoucherNo: p.parent_tally_voucher_no || null,
  });

  // ── Fetch data ────────────────────────────────────────────
  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    setPage(1);
    setHasMore(false);

    if (activeTab === 'myentries') {
      // My Entries: merge posted vouchers (res.data) + ALL write_queue entries (res.pending)
      getMyEntries(companyGuid, { from: fromDate, to: toDate, limit: String(PAGE_SIZE), page: 1, lifecycleFilter })
        .then((res: any) => {
          const postedRows = (res?.data ?? []).map((r: any) => ({ ...mapApiRow(r, formatAmount), isMine: true }));
          // Collapse JOIN fan-out duplicates (same TDK ref / same guid+amount) before render.
          const postedDeduped: VoucherEntry[] = [];
          const seenPosted = new Set<string>();
          for (const p of postedRows) {
            const k = p.tdkRef || p.id;
            if (seenPosted.has(k)) continue;
            seenPosted.add(k);
            postedDeduped.push(p);
          }
          const queueRows  = (res?.pending ?? []).map(mapQueueRow);
          // Phase D11(a): dedupe by tdkRef (always populated on both sides) instead of
          // ref/voucher_number which is empty on queue rows (Tally doesn't return it on
          // ImportData). Prefer the POSTED version since it has the real Tally voucher
          // number for display — drop the queue duplicate when a posted row exists for
          // the same TDK reference.
          const queueFiltered = queueRows.filter((q: VoucherEntry) =>
            !q.tdkRef || !postedDeduped.some((p: VoucherEntry) => p.tdkRef && p.tdkRef === q.tdkRef)
          );
          // 2026-07-01 R4: Merge queue + posted, then sort the WHOLE combined list by
          // rawDate DESC (business date, YYYY-MM-DD text so lexicographic works) with
          // stable tiebreak preserving each group's own order for same-date entries.
          // Why the re-sort: stale/failed queue rows can be months old (May/June leftovers
          // from earlier debugging). Previous naive `[...queue, ...posted]` prepended ALL
          // pending above ALL posted — which pushed old-month failed rows above current-
          // month posted rows in Audit Trail, breaking chronological display.
          // Backend already sorts posted rows by v.date DESC + av.created_at DESC + av.id ASC,
          // so JS Array.sort's stability preserves that intra-day order.
          const combined = [...queueFiltered, ...postedDeduped];
          const allMerged = combined.slice().sort((a, b) => {
            const da = a.rawDate || '';
            const db = b.rawDate || '';
            if (da === db) return 0; // stable — keeps original relative order within same date
            return db.localeCompare(da); // DESC (newest date first)
          });

          // 2026-07-01 UX decision: Receipt tiles render as normal receipt entries — no explicit
          // "Linked to Sales" subtitle. Sales + Receipt appear sequentially in the same date group,
          // so the linkage is visually implied. Parent linkage data (parentTdkRef / parentTallyVoucherNo)
          // still flows through the model in case a future drill-down surface uses it.
          setApiEntries(allMerged);
          setHasMore(false);
        })
        .catch((err: any) => setApiError(err?.message || 'Failed to load entries'))
        .finally(() => setIsLoading(false));
    } else {
      getVouchers(companyGuid, undefined, { from: fromDate, to: toDate, limit: PAGE_SIZE, page: 1 })
        .then((res: any) => {
          const rows = res?.data ?? [];
          setApiEntries(rows.map((r: any) => ({ ...mapApiRow(r, formatAmount), isMine: false })));
          setHasMore(rows.length === PAGE_SIZE);
        })
        .catch((err: any) => setApiError(err?.message || 'Failed to load vouchers'))
        .finally(() => setIsLoading(false));
    }
  }, [companyGuid, fromDate, toDate, activeTab, refreshKey]);

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore || activeTab === 'myentries') return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    getVouchers(companyGuid, undefined, { from: fromDate, to: toDate, limit: PAGE_SIZE, page: nextPage })
      .then((res: any) => {
        const rows = res?.data ?? [];
        setApiEntries(prev => [...prev, ...rows.map((r: any) => ({ ...mapApiRow(r, formatAmount), isMine: false }))]);
        setHasMore(rows.length === PAGE_SIZE);
        setPage(nextPage);
      })
      .finally(() => setIsLoadingMore(false));
  };

  const isDateActive = fromDate.length > 0 && toDate.length > 0;
  // Both tabs use the same live data
  const allSource = apiEntries;

  // ── KPI Stats (computed from live data) ───────────────────
  const kpiData = useMemo(() => {
    const total = allSource.length;
    let drTotal = 0, crTotal = 0;
    allSource.forEach(e => {
      const raw = parseFloat(e.amount.replace(/[₹,]/g, '')) || 0;
      if (e.isCredit) crTotal += raw; else drTotal += raw;
    });
    const fmt = (n: number) =>
      n >= 1e7 ? `₹${(n / 1e7).toFixed(1)}Cr`
      : n >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L`
      : n >= 1e3 ? `₹${(n / 1e3).toFixed(0)}K`
      : `₹${n}`;
    return [
      { label: 'Total Vouchers', value: String(total) },
      { label: 'Dr Total',       value: fmt(drTotal) },
      { label: 'Cr Total',       value: fmt(crTotal) },
      { label: 'Net Amount',     value: fmt(Math.abs(drTotal - crTotal)) },
    ];
  }, [allSource]);

  // ── Filtered & Grouped ────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = allSource;
    if (voucherType !== 'ALL') arr = arr.filter(e => e.type === voucherType);
    if (showDr !== showCr) {
      if (showDr && !showCr) arr = arr.filter(e => !e.isCredit);
      if (!showDr && showCr) arr = arr.filter(e => e.isCredit);
    }
    // Lifecycle filter (My Entries tab only)
    if (activeTab === 'myentries' && lifecycleFilter !== 'all') {
      arr = arr.filter(e => {
        const ct = e.currentEntryType;
        const ot = e.originalEntryType;
        const ss = e.syncStatus;
        const ei = e.eInvoiceStatus;
        const ew = e.eWayBillStatus;
        if (lifecycleFilter === 'pending_sync')       return ss === 'pending' || ss === 'processing'
          || (e.isMaster && e.booksImpactStatus === 'not_posted' && ss === 'synced');
        if (lifecycleFilter === 'regular')            return e.isMaster || ct === 'regular' || (!ct && ss === 'synced');
        if (lifecycleFilter === 'optional')           return !e.isMaster && ct === 'optional';
        if (lifecycleFilter === 'originally_optional') return !e.isMaster && ot === 'optional' && ct === 'regular';
        if (lifecycleFilter === 'failed')             return ss === 'failed';
        if (lifecycleFilter === 'irn_pending')        return !['not_applicable','not_required','generated','cancelled'].includes(ei || 'not_applicable');
        if (lifecycleFilter === 'ewb_pending')        return !['not_applicable','not_required','generated','cancelled'].includes(ew || 'not_applicable');
        return true;
      });
    }
    return arr;
  }, [allSource, voucherType, showDr, showCr, activeTab, lifecycleFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, VoucherEntry[]> = {};
    filtered.forEach(e => {
      if (!map[e.month]) map[e.month] = [];
      map[e.month].push(e);
    });
    return Object.entries(map);
  }, [filtered]);

  // ── Helpers ────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const clearSelection = () => { setSelected([]); setMultiSelect(false); };
  const selectAll      = () => setSelected(filtered.map(e => e.id));

  const switchTab = (tab: TabType) => { setActiveTab(tab); clearSelection(); setVoucherType('ALL'); setLifecycleFilter('all'); };

  const toggleMonth = (month: string) =>
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month); else next.add(month);
      return next;
    });

  const getSyncInfo = (status?: SyncStatus) => {
    if (status === 'pending')    return { icon: 'time-outline'            as const, color: AMBER,           borderColor: AMBER };
    if (status === 'processing') return { icon: 'sync-outline'            as const, color: AMBER,           borderColor: AMBER };
    if (status === 'failed')     return { icon: 'alert-circle-outline'    as const, color: COLORS.negative, borderColor: COLORS.negative };
    return                              { icon: 'checkmark-circle-outline' as const, color: COLORS.positive, borderColor: 'transparent' };
  };

  // Queued/failed can be retried once. Synced and in-flight must not re-push —
  // re-forwarding the same XML creates duplicate vouchers in Tally.
  const canRetryEntry = (entry: VoucherEntry) =>
    entry.syncStatus === 'pending' || entry.syncStatus === 'failed';

  const markRetrying = (id: string, on: boolean) => {
    if (on) retryingRef.current.add(id);
    else retryingRef.current.delete(id);
    setRetryingIds(new Set(retryingRef.current));
  };

  const handleSinglePush = async (entry: VoucherEntry) => {
    const rawId = (entry.id || '').replace('wq_', '');
    if (!rawId) return;
    if (!canRetryEntry(entry)) {
      Toast.show({
        type: 'info',
        text1: entry.syncStatus === 'processing' ? 'Already pushing' : 'Already synced',
        text2: entry.syncStatus === 'processing'
          ? 'Wait for the current push to finish.'
          : 'This entry is already in Tally.',
        visibilityTime: 2200,
      });
      return;
    }
    if (retryingRef.current.has(rawId)) return;

    markRetrying(rawId, true);
    Toast.show({ type: 'info', text1: 'Retrying...', text2: `${entry.ref || entry.tdkRef || ''} — ${entry.party}`, visibilityTime: 1400 });
    try {
      const result: any = await retryMyEntry(rawId);
      if (result?.alreadySuccess) {
        Toast.show({ type: 'success', text1: 'Already in Tally', text2: result?.message || 'No need to retry.', visibilityTime: 2500 });
      } else if (result?.alreadyProcessing) {
        Toast.show({ type: 'info', text1: 'Push in progress', text2: result?.message || 'Wait for it to finish.', visibilityTime: 2500 });
      } else if (result?.success === false) {
        Toast.show({ type: 'error', text1: 'Retry failed', text2: result?.message || 'Please try again.', visibilityTime: 2500 });
      } else {
        Toast.show({
          type: 'info',
          text1: result?.queued ? 'Still queued' : 'Pushed',
          text2: result?.message || (result?.queued ? 'Will push when desktop connects.' : 'Sent to Tally.'),
          visibilityTime: 2500,
        });
      }
      setRefreshKey(k => k + 1);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Retry failed', text2: err?.message || 'Please try again.', visibilityTime: 2500 });
    } finally {
      markRetrying(rawId, false);
    }
  };

  const handleBulkPush = async () => {
    if (selected.length === 0 || bulkRetryingRef.current) return;
    const retryable = selected
      .map(id => apiEntries.find(e => e.id === id) || filtered.find(e => e.id === id))
      .filter((e): e is VoucherEntry => !!e && canRetryEntry(e));
    if (retryable.length === 0) {
      Toast.show({ type: 'info', text1: 'Nothing to retry', text2: 'Select queued or failed entries only.', visibilityTime: 2500 });
      return;
    }

    bulkRetryingRef.current = true;
    const count = retryable.length;
    Toast.show({ type: 'info', text1: `Retrying ${count} entr${count === 1 ? 'y' : 'ies'}...`, text2: 'Syncing to Tally Prime', visibilityTime: 1600 });
    const ids = retryable.map(e => (e.id || '').replace('wq_', '')).filter(Boolean);
    ids.forEach(id => markRetrying(id, true));
    let failed = 0;
    let skipped = 0;
    await Promise.allSettled(ids.map(async id => {
      try {
        const result: any = await retryMyEntry(id);
        if (result?.alreadyProcessing || result?.alreadySuccess) skipped++;
        else if (result?.success === false) failed++;
      } catch {
        failed++;
      } finally {
        markRetrying(id, false);
      }
    }));
    bulkRetryingRef.current = false;
    if (failed === 0) {
      Toast.show({
        type: 'info',
        text1: `${count - skipped} entr${count - skipped === 1 ? 'y' : 'ies'} queued`,
        text2: skipped ? `${skipped} already handled.` : 'Will push when desktop connects.',
        visibilityTime: 3000,
      });
    } else {
      Toast.show({ type: 'error', text1: `${failed} failed`, text2: `${count - failed} handled, ${failed} errored.`, visibilityTime: 3000 });
    }
    setRefreshKey(k => k + 1);
    clearSelection();
  };

  const canConvertProformaEntry = (entry: VoucherEntry) =>
    entry.type === 'Proforma Invoice'
    && entry.currentEntryType === 'optional'
    && entry.conversionStatus !== 'converted'
    && !!entry.tdkRef
    && (!!entry.tallyVoucherNo || entry.syncStatus === 'synced');

  const handleConvertProforma = (entry: VoucherEntry) => {
    if (!entry.tdkRef || !company?.guid) return;
    if (!canConvertProformaEntry(entry)) {
      Toast.show({
        type: 'info',
        text1: 'Wait for sync',
        text2: 'Convert after Tally syncs this Proforma.',
        visibilityTime: 2800,
      });
      return;
    }
    if (convertingRef.current.has(entry.tdkRef)) return;
    convertingRef.current.add(entry.tdkRef);
    setConvertingIds(new Set(convertingRef.current));
    (async () => {
      try {
        const res: any = await getInvoicePreview(entry.tdkRef!, company.guid);
        if (!res?.status || !res?.data) throw new Error(res?.message || 'Could not load Proforma');
        const prefill = buildProformaToInvoicePrefillFromPreview(res.data, entry.tdkRef!);
        await AsyncStorage.setItem(proformaPrefillStorageKey(company.guid), JSON.stringify(prefill));
        router.push('/sales/create-invoice' as any);
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Could not start invoice', text2: e?.message || 'Try again after sync.' });
      } finally {
        convertingRef.current.delete(entry.tdkRef!);
        setConvertingIds(new Set(convertingRef.current));
      }
    })();
  };

  const handleShare = () =>
    Alert.alert('Export', `Export ${selected.length > 0 ? selected.length : 'all'} entries?`, [
      { text: 'Cancel',     style: 'cancel' },
      { text: 'Share PDF',  onPress: () => clearSelection() },
      { text: 'Export CSV', onPress: () => clearSelection() },
    ]);

  const showBottomBar = multiSelect && selected.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        {multiSelect ? (
          <View style={s.selectHeaderInner}>
            <Text style={s.selectCountTxt}>{selected.length} Selected</Text>
            <TouchableOpacity onPress={selected.length === filtered.length ? clearSelection : selectAll}>
              <Text style={s.selectAllTxt}>
                {selected.length === filtered.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={s.headerTitle}>Audit Trail</Text>
        )}

        {multiSelect ? (
          <TouchableOpacity style={s.iconBtn} onPress={clearSelection} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
            <Ionicons
              name="calendar-outline" size={20}
              color={isDateActive ? AMBER : COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tab Toggle ─────────────────────────────────────────────────── */}
      <View style={s.tabRow}>
        {(['myentries', 'daybook'] as TabType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
            onPress={() => switchTab(tab)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab === 'myentries' ? 'create-outline' : 'book-outline'}
              size={15}
              color={activeTab === tab ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
              {tab === 'myentries' ? 'My Entries' : 'Day Book'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Date Range Strip ───────────────────────────────────────────── */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={isDateActive ? AMBER : COLORS.textTertiary} />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {isDateActive ? `${fromDate}  →  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity
            onPress={() => {
              const d = new Date(); d.setDate(d.getDate() - 30);
              setFromDate(d.toISOString().split('T')[0]);
              setToDate(new Date().toISOString().split('T')[0]);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={AMBER} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: showBottomBar ? 110 + insets.bottom : 40 + insets.bottom },
        ]}
      >
        {/* Error Banner */}
        {apiError ? (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={s.errorBannerTxt}>{apiError}</Text>
          </View>
        ) : null}

        {/* Loading Indicator */}
        {isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={AMBER} />
            <Text style={s.loadingTxt}>Loading vouchers...</Text>
          </View>
        ) : (
          <>
            {/* Lifecycle Filter Chips — My Entries only */}
            {activeTab === 'myentries' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={lf.row}
                style={{ marginBottom: SPACING.sm }}
              >
                {LIFECYCLE_FILTERS.map(f => (
                  <TouchableOpacity
                    key={f.key}
                    style={[lf.chip, lifecycleFilter === f.key && lf.chipActive]}
                    onPress={() => setLifecycleFilter(f.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[lf.chipTxt, lifecycleFilter === f.key && lf.chipTxtActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* KPI Cards — 2×2 Grid */}
            <View style={s.kpiCard}>
              <View style={s.kpiRow}>
                <View style={[s.kpiCell, s.kpiCellRight]}>
                  <Text style={s.kpiLabel}>{kpiData[0].label}</Text>
                  <Text style={s.kpiValue}>{kpiData[0].value}</Text>
                </View>
                <View style={s.kpiCell}>
                  <Text style={s.kpiLabel}>{kpiData[1].label}</Text>
                  <Text style={s.kpiValue}>{kpiData[1].value}</Text>
                </View>
              </View>
              <View style={s.kpiDivH} />
              <View style={s.kpiRow}>
                <View style={[s.kpiCell, s.kpiCellRight]}>
                  <Text style={s.kpiLabel}>{kpiData[2].label}</Text>
                  <Text style={s.kpiValue}>{kpiData[2].value}</Text>
                </View>
                <View style={s.kpiCell}>
                  <Text style={s.kpiLabel}>{kpiData[3].label}</Text>
                  <Text style={s.kpiValue}>{kpiData[3].value}</Text>
                </View>
              </View>
            </View>

            {/* Type Breakdown (replaces bar chart) */}
            <TypeBreakdownCard entries={allSource} />

            {/* Filter Row */}
            <View style={s.filterRow}>
              <TouchableOpacity style={s.vTypeBtn} onPress={() => setShowVTypeModal(true)} activeOpacity={0.8}>
                <Ionicons
                  name="filter-outline" size={14}
                  color={voucherType !== 'ALL' ? AMBER : COLORS.textSecondary}
                />
                <Text style={[s.vTypeTxt, voucherType !== 'ALL' && s.vTypeTxtActive]} numberOfLines={1}>
                  {voucherType === 'ALL' ? 'Voucher Type' : voucherType}
                </Text>
                <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
              </TouchableOpacity>

              <View style={s.drCrGroup}>
                <TouchableOpacity
                  style={[s.drCrChip, showDr && s.drCrChipActive]}
                  onPress={() => setShowDr(v => !v)}
                  activeOpacity={0.8}
                >
                  {showDr && <Ionicons name="checkmark" size={11} color={COLORS.white} />}
                  <Text style={[s.drCrChipTxt, showDr && s.drCrChipTxtActive]}>Dr</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.drCrChip, showCr && s.drCrChipActive]}
                  onPress={() => setShowCr(v => !v)}
                  activeOpacity={0.8}
                >
                  {showCr && <Ionicons name="checkmark" size={11} color={COLORS.white} />}
                  <Text style={[s.drCrChipTxt, showCr && s.drCrChipTxtActive]}>Cr</Text>
                </TouchableOpacity>
              </View>
            </View>

            {grouped.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={48} color={COLORS.borderStrong} />
                <Text style={s.emptyTxt}>
                  {activeTab === 'myentries'
                    ? 'No entries yet'
                    : 'No entries found'}
                </Text>
                {activeTab === 'myentries' && (
                  <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center', paddingHorizontal: 24, marginTop: 4 }}>
                    Create your first voucher from the sales or purchase screens.
                  </Text>
                )}
              </View>
            ) : <>{grouped.map(([month, entries]) => (
              <View key={month}>
                {/* Month Header — tap to collapse */}
                <TouchableOpacity
                  style={s.monthHdr}
                  onPress={() => toggleMonth(month)}
                  activeOpacity={0.7}
                >
                  <Text style={s.monthTxt}>{month}</Text>
                  <View style={s.monthLine} />
                  <View style={s.monthCountBadge}>
                    <Text style={s.monthCountTxt}>{entries.length}</Text>
                  </View>
                  <Ionicons
                    name={collapsedMonths.has(month) ? 'chevron-down' : 'chevron-up'}
                    size={14} color={COLORS.textTertiary}
                  />
                </TouchableOpacity>

                {/* Entries — hidden when collapsed */}
                {collapsedMonths.has(month) ? null : (
                  <View style={s.monthCard}>
                    {entries.map((entry, idx) => {
                      const isSel  = selected.includes(entry.id);
                      const color  = TYPE_COLORS[entry.type] || COLORS.textSecondary;
                      const sInfo  = activeTab === 'myentries' ? getSyncInfo(entry.syncStatus) : null;
                      const hasBorder =
                        activeTab === 'myentries' &&
                        (entry.syncStatus === 'pending' || entry.syncStatus === 'failed');

                      return (
                        <View key={`${entry.id}_${idx}`}>
                          <TouchableOpacity
                            style={[
                              s.entryRow,
                              isSel && s.entryRowSelected,
                              hasBorder
                                ? { borderLeftWidth: 3, borderLeftColor: sInfo!.borderColor }
                                : null,
                            ]}
                            activeOpacity={0.75}
                            onPress={() => {
                              if (multiSelect) {
                                toggleSelect(entry.id);
                              } else if (entry.isMaster || entry.queueId) {
                                const qid = entry.queueId
                                  || (String(entry.id).startsWith('wq_') ? String(entry.id).replace(/^wq_/, '') : null);
                                if (qid && (entry.isMaster || ['New Ledger', 'New Warehouse', 'New Item', 'Stock Edit'].includes(entry.type))) {
                                  router.push(`/masters/preview?queueId=${encodeURIComponent(String(qid))}` as any);
                                  return;
                                }
                              }
                              if (!multiSelect) {
                                // Use Tally voucher number when available (My Entries queue rows have
                                // empty ref since wq.tally_voucher_number is never returned by Tally's
                                // ImportData API — tallyVoucherNo is the reconciled value from app_vouchers)
                                const docId = entry.tallyVoucherNo || entry.ref;
                                if (!docId) {
                                  // Route provisional preview by TDK voucher family (not always Sales invoice UI)
                                  if (entry.tdkRef) {
                                    const ref = entry.tdkRef;
                                    let route = `/sales/invoice-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    if (/TDK-(?:OPT-)?SOR-/i.test(ref) || entry.type === 'Sales Order') {
                                      route = `/sales/order-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    } else if (/TDK-(?:OPT-)?CON-/i.test(ref)) {
                                      route = `/voucher/contra-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    } else if (/TDK-(?:OPT-)?JOR-/i.test(ref)) {
                                      route = `/voucher/journal-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    } else if (/TDK-(?:OPT-)?PAY-/i.test(ref)) {
                                      route = `/voucher/payment-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    } else if (/TDK-(?:OPT-)?RCP-/i.test(ref)) {
                                      route = `/voucher/receipt-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    } else if (/TDK-(?:OPT-)?PHY-/i.test(ref)) {
                                      route = `/stocks/adjustment-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    } else if (/TDK-(?:OPT-)?STJ-/i.test(ref)) {
                                      route = `/stocks/transfer-preview?tdkRef=${encodeURIComponent(ref)}`;
                                    }
                                    router.push(route as any);
                                  } else {
                                    Alert.alert(
                                      'Not yet synced',
                                      'Preview is not available yet. Check again after Tally syncs.',
                                      [{ text: 'OK' }]
                                    );
                                  }
                                  return;
                                }
                                router.push(`/document/${docId}` as any);
                              }
                            }}
                            onLongPress={() => { setMultiSelect(true); toggleSelect(entry.id); }}
                            delayLongPress={450}
                          >
                            {/* Checkbox */}
                            {multiSelect ? (
                              <View style={[s.checkbox, isSel && s.checkboxActive]}>
                                {isSel ? <Ionicons name="checkmark" size={12} color={COLORS.white} /> : null}
                              </View>
                            ) : null}

                            {/* Sync icon — My Entries */}
                            {!multiSelect && activeTab === 'myentries' && sInfo ? (
                              <TouchableOpacity
                                style={[s.statusIcon, { backgroundColor: sInfo.color + '18' }]}
                                onPress={() => {
                                  if (canRetryEntry(entry)) handleSinglePush(entry);
                                }}
                                activeOpacity={canRetryEntry(entry) ? 0.7 : 1}
                                disabled={!canRetryEntry(entry) || retryingIds.has((entry.id || '').replace('wq_', ''))}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                {retryingIds.has((entry.id || '').replace('wq_', '')) ? (
                                  <ActivityIndicator size="small" color={sInfo.color} />
                                ) : (
                                  <Ionicons name={sInfo.icon} size={19} color={sInfo.color} />
                                )}
                              </TouchableOpacity>
                            ) : null}

                            {/* Action icon — Day Book */}
                            {!multiSelect && activeTab === 'daybook' ? (
                              <View style={[s.statusIcon, { backgroundColor: (ACTION_COLORS[entry.action || 'Created'] || '#999') + '18' }]}>
                                <Ionicons
                                  name="book-outline"
                                  size={19}
                                  color={color}
                                />
                              </View>
                            ) : null}

                            {/* Entry detail */}
                            <View style={s.entryInfo}>
                              <View style={s.entryTopRow}>
                                <View style={[s.vtypePill, { backgroundColor: color + '18' }]}>
                                  <Text style={[s.vtypePillTxt, { color }]}>{entry.type}</Text>
                                </View>
                                <Text style={s.refTxt}>
                                  {(() => {
                                    if (activeTab !== 'myentries') return entry.ref;
                                    // Once Tally assigns a real number → always show it
                                    if (entry.tallyVoucherNo) return entry.tallyVoucherNo;
                                    // Posted but tallyVoucherNo somehow missing → fall back to ref
                                    if (entry.booksImpactStatus === 'posted' && entry.ref) return entry.ref;
                                    // Optional not yet converted → show TDK ref
                                    if (entry.currentEntryType === 'optional' && entry.conversionStatus !== 'converted') {
                                      return entry.tdkRef || entry.ref || 'Opt. Ref';
                                    }
                                    // Pending/queued → show TDK ref so user knows it's ours
                                    if (entry.tdkRef) return entry.tdkRef;
                                    return entry.ref || '—';
                                  })()}
                                </Text>
                              </View>
                              {/* Lifecycle Badges — My Entries only */}
                              {activeTab === 'myentries' && (
                                <View style={lb.row}>
                                  {!entry.isMaster && entry.type === 'Proforma Invoice' && entry.currentEntryType === 'optional' && (
                                    <View style={[lb.badge, lb.optional]}>
                                      <Text style={[lb.badgeTxt, { color: AMBER }]}>Proforma</Text>
                                    </View>
                                  )}
                                  {!entry.isMaster && entry.type !== 'Proforma Invoice' && entry.currentEntryType === 'optional' && (
                                    <View style={[lb.badge, lb.optional]}>
                                      <Text style={[lb.badgeTxt, { color: AMBER }]}>Optional</Text>
                                    </View>
                                  )}
                                  {!entry.isMaster && (entry.currentEntryType === 'regular' || (!entry.currentEntryType && entry.syncStatus === 'synced')) && (
                                    <View style={[lb.badge, lb.regular]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.positive }]}>Regular</Text>
                                    </View>
                                  )}
                                  {!entry.isMaster && isProformaOrigin(entry) && entry.originalEntryType === 'optional' && entry.currentEntryType === 'regular' && (
                                    <View style={[lb.badge, lb.origOptional]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.info }]}>From Proforma</Text>
                                    </View>
                                  )}
                                  {!entry.isMaster && !isProformaOrigin(entry) && entry.originalEntryType === 'optional' && entry.currentEntryType === 'regular' && (
                                    <View style={[lb.badge, lb.origOptional]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.info }]}>Orig. Optional</Text>
                                    </View>
                                  )}
                                  {entry.syncStatus === 'pending' && (
                                    <View style={[lb.badge, lb.pendingSync]}>
                                      <Text style={[lb.badgeTxt, { color: AMBER }]}>Pending Sync</Text>
                                    </View>
                                  )}
                                  {entry.syncStatus === 'failed' && (
                                    <View style={[lb.badge, lb.failed]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.negative }]}>Failed</Text>
                                    </View>
                                  )}
                                  {entry.isMaster && entry.booksImpactStatus === 'not_posted' && entry.syncStatus === 'synced' && (
                                    <View style={[lb.badge, lb.notPosted]}>
                                      <Text style={[lb.badgeTxt, { color: AMBER }]}>Awaiting Sync</Text>
                                    </View>
                                  )}
                                  {entry.booksImpactStatus === 'not_posted' && entry.syncStatus !== 'failed' && !(entry.isMaster && entry.syncStatus === 'synced') && (
                                    <View style={[lb.badge, lb.notPosted]}>
                                      <Text style={[lb.badgeTxt, { color: AMBER }]}>Not Posted</Text>
                                    </View>
                                  )}
                                  {entry.booksImpactStatus === 'posted' && (
                                    <View style={[lb.badge, lb.posted]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.positive }]}>Posted</Text>
                                    </View>
                                  )}
                                  {entry.eInvoiceStatus === 'generated' && (
                                    <View style={[lb.badge, lb.irnDone]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.info }]}>IRN ✓</Text>
                                    </View>
                                  )}
                                  {['generating','failed'].includes(entry.eInvoiceStatus || '') && (
                                    <View style={[lb.badge, lb.irnPending]}>
                                      <Text style={[lb.badgeTxt, { color: COLORS.info }]}>{entry.eInvoiceStatus === 'failed' ? 'IRN Failed' : 'IRN Pending'}</Text>
                                    </View>
                                  )}
                                </View>
                              )}
                              {/* Receipt rows render as normal tiles (2026-07-01 UX decision). Sales+Receipt
                                  always appear sequentially in the same date group, so users infer the pairing
                                  visually — no explicit "Linked to Sales" subtitle needed. Parent linkage data
                                  (parentTdkRef / parentTallyVoucherNo) still flows through the model for future
                                  drill-down features. */}
                              <Text style={s.partyTxt}>{entry.party}</Text>
                              <Text style={s.descTxt}>{entry.description}</Text>
                              {activeTab === 'myentries' && entry.type === 'Proforma Invoice' && entry.currentEntryType === 'optional' && entry.conversionStatus !== 'converted' && (
                                <Text style={{ fontSize: 9, color: AMBER, fontWeight: '700' }}>PROFORMA (OPTIONAL)</Text>
                              )}
                              {activeTab === 'myentries' && entry.type !== 'Proforma Invoice' && entry.currentEntryType === 'optional' && entry.conversionStatus !== 'converted' && (
                                <Text style={{ fontSize: 9, color: AMBER, fontWeight: '700' }}>OPTIONAL VOUCHER NO.</Text>
                              )}
                              {activeTab === 'myentries' && isProformaOrigin(entry) && entry.originalEntryType === 'optional' && entry.currentEntryType === 'regular' && (
                                <Text style={{ fontSize: 9, color: COLORS.info, fontWeight: '700' }}>CONVERTED FROM PROFORMA</Text>
                              )}
                              {activeTab === 'myentries' && !isProformaOrigin(entry) && entry.originalEntryType === 'optional' && entry.currentEntryType === 'regular' && (
                                <Text style={{ fontSize: 9, color: COLORS.info, fontWeight: '700' }}>ORIG. ENTRY TYPE: OPTIONAL</Text>
                              )}
                              <Text style={s.entryDateTxt}>{entry.date}</Text>
                            </View>

                            {/* Amount + SO convert shortcut */}
                            <View style={s.amtCol}>
                              <Text style={[s.amtTxt, { color: entry.isCredit ? COLORS.negative : COLORS.positive }]}>
                                {entry.amount}
                              </Text>
                              <Text style={[s.drCrLbl, { color: entry.isCredit ? COLORS.negative : COLORS.positive }]}>
                                {entry.isCredit ? 'Cr' : 'Dr'}
                              </Text>
                              {activeTab === 'myentries' && isProformaOrigin(entry) && entry.tdkRef && !multiSelect ? (
                                <View style={{ marginTop: 6, gap: 4, alignItems: 'flex-end' }}>
                                  <TouchableOpacity
                                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: COLORS.brandPrimary + '14' }}
                                    onPress={() => router.push(`/sales/invoice-preview?tdkRef=${encodeURIComponent(entry.tdkRef!)}` as any)}
                                    activeOpacity={0.75}
                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  >
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.brandPrimary }}>Preview</Text>
                                  </TouchableOpacity>
                                  {entry.currentEntryType === 'optional' && entry.conversionStatus !== 'converted' ? (
                                    <TouchableOpacity
                                      style={{
                                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                                        backgroundColor: COLORS.brandPrimary,
                                        opacity: convertingIds.has(entry.tdkRef) ? 0.6 : 1,
                                      }}
                                      onPress={() => handleConvertProforma(entry)}
                                      activeOpacity={0.75}
                                      disabled={convertingIds.has(entry.tdkRef)}
                                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.white }}>
                                        {convertingIds.has(entry.tdkRef) ? '…' : 'Convert'}
                                      </Text>
                                    </TouchableOpacity>
                                  ) : null}
                                </View>
                              ) : null}
                              {activeTab === 'myentries' && entry.type === 'Sales Order' && entry.tdkRef && !multiSelect ? (
                                <TouchableOpacity
                                  style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#05966918' }}
                                  onPress={() => router.push(`/sales/order-preview?tdkRef=${encodeURIComponent(entry.tdkRef!)}` as any)}
                                  activeOpacity={0.75}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Convert</Text>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </TouchableOpacity>
                          {idx < entries.length - 1 ? <View style={s.divider} /> : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
            {hasMore && (
              <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} activeOpacity={0.8}>
                {isLoadingMore
                  ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  : <Text style={s.loadMoreTxt}>Load More</Text>
                }
              </TouchableOpacity>
            )}
            {!hasMore && apiEntries.length > 0 && (
              <Text style={s.endTxt}>All {apiEntries.length} entries loaded</Text>
            )}
          </> }
          </>
        )}
      </ScrollView>

      {/* ── Bottom Action Bar ──────────────────────────────────────────── */}
      {showBottomBar && (
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {activeTab === 'myentries' ? (
            <View style={s.bottomBtnPair}>
              <TouchableOpacity style={s.bottomBtnFull} onPress={handleBulkPush} activeOpacity={0.85}>
                <Ionicons name="cloud-upload-outline" size={18} color={COLORS.white} />
                <Text style={s.bottomBtnTxt}>Push {selected.length} to Tally</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bottomBtnFull, s.bottomBtnOutline]}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Ionicons name="share-outline" size={18} color={COLORS.textPrimary} />
                <Text style={[s.bottomBtnTxt, { color: COLORS.textPrimary }]}>Share</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.bottomBtnPair}>
              <TouchableOpacity style={s.bottomBtnFull} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color={COLORS.white} />
                <Text style={s.bottomBtnTxt}>Share PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.bottomBtnFull, s.bottomBtnOutline]}
                onPress={handleShare}
                activeOpacity={0.85}
              >
                <Ionicons name="download-outline" size={18} color={COLORS.textPrimary} />
                <Text style={[s.bottomBtnTxt, { color: COLORS.textPrimary }]}>Export CSV</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
        onApply={(f, t) => { if (f && t) { setFromDate(f); setToDate(t); } }}
        onClose={() => setShowDatePicker(false)}
      />
      <VTypeDropdown
        value={voucherType}
        onSelect={setVoucherType}
        visible={showVTypeModal}
        onClose={() => setShowVTypeModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  selectHeaderInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: SPACING.sm,
  },
  selectCountTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  selectAllTxt:   { fontSize: TYPOGRAPHY.sm,   fontWeight: '600', color: AMBER },

  // Tab Toggle
  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.cardBg, padding: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  tabBtnActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  tabTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: COLORS.white, fontWeight: '700' },

  // Date Strip
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: AMBER },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Error Banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEE2E2', borderRadius: RADIUS.md,
    padding: SPACING.sm, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorBannerTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: '#DC2626' },

  // Loading
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  // KPI Grid (2×2)
  kpiCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  kpiRow:       { flexDirection: 'row' },
  kpiCell:      { flex: 1, padding: SPACING.md },
  kpiCellRight: { borderRightWidth: 1, borderRightColor: COLORS.borderDefault },
  kpiDivH:      { height: 1, backgroundColor: COLORS.borderDefault },
  kpiLabel:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 6 },
  kpiValue:     { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },

  // Filter Row
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  vTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  vTypeTxt:       { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  vTypeTxtActive: { color: AMBER, fontWeight: '700' },

  drCrGroup: { flexDirection: 'row', gap: 6 },
  drCrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 13, paddingVertical: 11,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  drCrChipActive:  { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  drCrChipTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  drCrChipTxtActive:{ color: COLORS.white },

  // Month headers
  monthHdr: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: SPACING.xs, marginTop: SPACING.sm,
  },
  monthTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  monthLine:      { flex: 1, height: 1, backgroundColor: COLORS.borderDefault },
  monthCountBadge:{ backgroundColor: COLORS.activeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  monthCountTxt:  { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },

  // Month card + rows
  monthCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden', marginBottom: SPACING.sm,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12,
  },
  entryRowSelected: { backgroundColor: COLORS.activeBg },

  checkbox:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:{ backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },

  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  entryInfo:    { flex: 1, gap: 3 },
  entryTopRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  vtypePill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.sm },
  vtypePillTxt: { fontSize: 10, fontWeight: '700' },
  refTxt:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },

  partyTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  descTxt:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  entryDateTxt: { fontSize: 10, color: COLORS.textTertiary },

  amtCol:  { alignItems: 'flex-end', gap: 2 },
  amtTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  drCrLbl: { fontSize: 10, fontWeight: '600' },

  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 64 },

  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  loadMoreBtn: { margin:16,padding:14,borderRadius:10,backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center' },
  loadMoreTxt: { fontSize:14,fontWeight:'600',color:COLORS.brandPrimary },
  endTxt:      { textAlign:'center',fontSize:12,color:COLORS.textTertiary,padding:16 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  bottomBtnPair: { flexDirection: 'row', gap: 10 },
  bottomBtnFull: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.md, paddingVertical: 15,
  },
  bottomBtnOutline: {
    backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  bottomBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ─── Lifecycle Filter Chip Styles ─────────────────────────────────────────────
const lf = StyleSheet.create({
  row:     { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  chipActive:    { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipTxt:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white },
});

// ─── Lifecycle Badge Styles ───────────────────────────────────────────────────
const lb = StyleSheet.create({
  row:         { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 3 },
  // Phase D11(c): elevate Posted / Not Posted into bolder pills so status reads at-a-glance.
  // Regular/Optional kept as low-contrast outline tags (informational, not status).
  badge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  badgeTxt:    { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  regular:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.borderDefault },
  optional:    { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#E8C77A' },
  origOptional:{ backgroundColor: COLORS.infoBg },
  pendingSync: { backgroundColor: '#FDF3E0', borderWidth: 1, borderColor: '#F4C77E' },
  failed:      { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#F4B4B4' },
  notPosted:   { backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#F4C77E' },
  posted:      { backgroundColor: COLORS.positiveBg, borderWidth: 1, borderColor: COLORS.positive },
  irnDone:     { backgroundColor: COLORS.infoBg },
  irnPending:  { backgroundColor: COLORS.infoBg },
});
