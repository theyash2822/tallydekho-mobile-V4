import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Modal, Alert, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { getVouchers, getMyEntries } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

const SCREEN_W = Dimensions.get('window').width;
const AMBER = '#A89060';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabType = 'myentries' | 'daybook';
type SyncStatus = 'synced' | 'pending' | 'failed';
type VoucherType =
  | 'ALL' | 'Sales' | 'Purchase' | 'Payment' | 'Receipt'
  | 'Journal' | 'Contra' | 'Debit Note' | 'Credit Note' | 'Delivery Note';

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
}

// ─── Voucher Types ────────────────────────────────────────────────────────────
const VOUCHER_TYPES: VoucherType[] = [
  'ALL', 'Sales', 'Purchase', 'Payment', 'Receipt',
  'Journal', 'Contra', 'Debit Note', 'Credit Note', 'Delivery Note',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatMonth = (dateStr: string) => {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
};

const mapVoucherType = (raw: string): Exclude<VoucherType, 'ALL'> => {
  const s = (raw || '').toLowerCase();
  if (s.includes('sales')) return 'Sales';
  if (s.includes('purchase')) return 'Purchase';
  if (s.includes('payment')) return 'Payment';
  if (s.includes('receipt')) return 'Receipt';
  if (s.includes('journal')) return 'Journal';
  if (s.includes('contra')) return 'Contra';
  if (s.includes('debit')) return 'Debit Note';
  if (s.includes('credit')) return 'Credit Note';
  if (s.includes('delivery')) return 'Delivery Note';
  return 'Journal';
};

const mapApiRow = (r: any, fmt: (n: number) => string = (n) => String(n)): VoucherEntry => ({
  id: r.guid || String(r.id),
  ref: r.voucher_number || '',
  date: r.date || '',
  month: formatMonth(r.date),
  type: mapVoucherType(r.voucher_type),
  party: r.party_name || '',
  description: r.voucher_type || '',
  amount: fmt(Math.abs(+r.amount || 0)),
  isCredit: +r.amount < 0,
  syncStatus: 'synced' as const,
  isMine: true,
});

// ─── Color Maps ───────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  'Sales': '#2D7D46', 'Purchase': '#2563EB', 'Payment': '#C0392B',
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [voucherType,    setVoucherType]    = useState<VoucherType>('ALL');
  const [showVTypeModal, setShowVTypeModal] = useState(false);
  const [showDr,         setShowDr]         = useState(true);
  const [showCr,         setShowCr]         = useState(true);
  const [multiSelect,    setMultiSelect]    = useState(false);
  const [selected,       setSelected]       = useState<string[]>([]);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // ── API State ─────────────────────────────────────────────
  const [apiEntries, setApiEntries] = useState<VoucherEntry[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);

  // ── Fetch data ────────────────────────────────────────────
  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    const fetchFn = activeTab === 'myentries'
      ? getMyEntries(companyGuid, { from: fromDate, to: toDate, limit: '500' })
      : getVouchers(companyGuid, undefined, { from: fromDate, to: toDate, limit: 500 });
    fetchFn
      .then((res: any) => {
        const rows = res?.data ?? [];
        setApiEntries(rows.map((r: any) => ({ ...mapApiRow(r, formatAmount), isMine: activeTab === 'myentries' })));
      })
      .catch((err: any) => {
        setApiError(err?.message || 'Failed to load vouchers');
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid, fromDate, toDate, activeTab]);

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
    return arr;
  }, [allSource, voucherType, showDr, showCr]);

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

  const switchTab = (tab: TabType) => { setActiveTab(tab); clearSelection(); setVoucherType('ALL'); };

  const toggleMonth = (month: string) =>
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month); else next.add(month);
      return next;
    });

  const getSyncInfo = (status?: SyncStatus) => {
    if (status === 'pending') return { icon: 'time-outline'         as const, color: AMBER,             borderColor: AMBER };
    if (status === 'failed')  return { icon: 'alert-circle-outline' as const, color: COLORS.negative,   borderColor: COLORS.negative };
    return                           { icon: 'checkmark-circle-outline' as const, color: COLORS.positive, borderColor: 'transparent' };
  };

  const handleSinglePush = (entry: VoucherEntry) => {
    Toast.show({
      type: 'info',
      text1: 'Pushing to Tally...',
      text2: `${entry.ref} — ${entry.party}`,
      visibilityTime: 1400,
    });
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: 'Pushed Successfully!',
        text2: `${entry.ref} synced to Tally Prime`,
        visibilityTime: 2500,
      });
    }, 1600);
  };

  const handleBulkPush = () => {
    if (selected.length === 0) return;
    const count = selected.length;
    Toast.show({
      type: 'info',
      text1: `Pushing ${count} entr${count === 1 ? 'y' : 'ies'}...`,
      text2: 'Syncing to Tally Prime',
      visibilityTime: 1600,
    });
    setTimeout(() => {
      Toast.show({
        type: 'success',
        text1: `${count} Entr${count === 1 ? 'y' : 'ies'} Pushed!`,
        text2: `All vouchers synced to Tally Prime`,
        visibilityTime: 3000,
      });
      clearSelection();
    }, 1800);
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
            ) : grouped.map(([month, entries]) => (
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
                        <View key={entry.id}>
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
                              } else {
                                router.push(`/document/${entry.ref}` as any);
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
                                  if (entry.syncStatus !== 'synced') handleSinglePush(entry);
                                }}
                                activeOpacity={entry.syncStatus !== 'synced' ? 0.7 : 1}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name={sInfo.icon} size={19} color={sInfo.color} />
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
                                <Text style={s.refTxt}>{entry.ref}</Text>
                              </View>
                              <Text style={s.partyTxt}>{entry.party}</Text>
                              <Text style={s.descTxt}>{entry.description}</Text>
                              <Text style={s.entryDateTxt}>{entry.date}</Text>
                            </View>

                            {/* Amount */}
                            <View style={s.amtCol}>
                              <Text style={[s.amtTxt, { color: entry.isCredit ? COLORS.negative : COLORS.positive }]}>
                                {entry.amount}
                              </Text>
                              <Text style={[s.drCrLbl, { color: entry.isCredit ? COLORS.negative : COLORS.positive }]}>
                                {entry.isCredit ? 'Cr' : 'Dr'}
                              </Text>
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
