import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Modal,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

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

// ─── Mock Data — My Entries ───────────────────────────────────────────────────
const MY_ENTRIES: VoucherEntry[] = [
  { id: 'm1', ref: 'PV-2098', date: '07 May', month: 'May 25', type: 'Payment', party: 'Netaji Industries', description: 'HDFC → Rent', amount: '₹75,000', isCredit: true, syncStatus: 'pending', isMine: true },
  { id: 'm2', ref: 'JV-0142', date: '08 May', month: 'May 25', type: 'Journal', party: 'Netaji Industries', description: 'Journal → Salary Accrual', amount: '₹75,000', isCredit: true, syncStatus: 'pending', isMine: true },
  { id: 'm3', ref: 'INV-0901', date: '09 May', month: 'May 25', type: 'Sales', party: 'ABC Traders', description: 'Sales → Export Invoice', amount: '₹42,500', isCredit: false, syncStatus: 'failed', isMine: true },
  { id: 'm4', ref: 'PO-0234', date: '12 May', month: 'May 25', type: 'Purchase', party: 'Delhi Suppliers', description: 'Purchase → Raw Material', amount: '₹62,400', isCredit: true, syncStatus: 'synced', isMine: true },
  { id: 'm5', ref: 'RV-0062', date: '15 May', month: 'May 25', type: 'Receipt', party: 'XYZ Retail', description: 'Receipt → Payment Received', amount: '₹33,200', isCredit: false, syncStatus: 'synced', isMine: true },
  { id: 'm6', ref: 'INV-0912', date: '01 Jun', month: 'Jun 25', type: 'Sales', party: 'Kumar & Sons', description: 'Sales → Export Invoice', amount: '₹28,000', isCredit: false, syncStatus: 'synced', isMine: true },
  { id: 'm7', ref: 'PV-0089', date: '04 Jun', month: 'Jun 25', type: 'Payment', party: 'Indian Export House', description: 'HDFC → Salary', amount: '₹44,000', isCredit: true, syncStatus: 'pending', isMine: true },
  { id: 'm8', ref: 'CV-0012', date: '08 Jun', month: 'Jun 25', type: 'Contra', party: 'HDFC → SBI', description: 'Fund Transfer', amount: '₹1,00,000', isCredit: false, syncStatus: 'synced', isMine: true },
  { id: 'm9', ref: 'DN-0034', date: '10 Jun', month: 'Jun 25', type: 'Debit Note', party: 'Sharma Electronics', description: 'Return Debit Note', amount: '₹18,750', isCredit: false, syncStatus: 'failed', isMine: true },
];

// ─── Mock Data — Day Book ─────────────────────────────────────────────────────
const DAYBOOK_ENTRIES: VoucherEntry[] = [
  { id: 'd1', ref: 'INV-30979', date: '15 Jun', month: 'Jun 25', type: 'Sales', party: 'ABC Traders', description: 'Payment HDFC → Rent', amount: '₹42,500', isCredit: false, action: 'Edited', isMine: true },
  { id: 'd2', ref: 'PV-00081', date: '14 Jun', month: 'Jun 25', type: 'Payment', party: 'Kumar & Sons', description: 'Payment → Vendor', amount: '₹15,000', isCredit: true, action: 'Created', isMine: false },
  { id: 'd3', ref: 'INV-30975', date: '13 Jun', month: 'Jun 25', type: 'Sales', party: 'Sharma Electronics', description: 'Sales → GST Invoice', amount: '₹18,750', isCredit: false, action: 'Deleted', isMine: false },
  { id: 'd4', ref: 'JV-00015', date: '13 Jun', month: 'Jun 25', type: 'Journal', party: 'Capital Account', description: 'Journal → Capital Adjustment', amount: '₹5,000', isCredit: true, action: 'Created', isMine: true },
  { id: 'd5', ref: 'PO-00123', date: '12 Jun', month: 'Jun 25', type: 'Purchase', party: 'Delhi Suppliers', description: 'Purchase → Raw Material', amount: '₹62,400', isCredit: true, action: 'Edited', isMine: false },
  { id: 'd6', ref: 'RV-00062', date: '12 Jun', month: 'Jun 25', type: 'Receipt', party: 'XYZ Retail', description: 'Receipt → Sales GST', amount: '₹33,200', isCredit: false, action: 'Created', isMine: false },
  { id: 'd7', ref: 'INV-30940', date: '05 May', month: 'May 25', type: 'Sales', party: 'Raj Enterprises', description: 'Sales → Export Invoice', amount: '₹27,300', isCredit: false, action: 'Created', isMine: true },
  { id: 'd8', ref: 'PV-00070', date: '02 May', month: 'May 25', type: 'Payment', party: 'Indian Export House', description: 'Payment → Salary', amount: '₹44,000', isCredit: true, action: 'Edited', isMine: false },
  { id: 'd9', ref: 'CN-00015', date: '28 Apr', month: 'Apr 25', type: 'Credit Note', party: 'ABC Traders', description: 'Credit Note Return', amount: '₹8,200', isCredit: true, action: 'Created', isMine: true },
];

// ─── KPI Data ─────────────────────────────────────────────────────────────────
const KPI_MY_ENTRIES = [
  { label: 'Vouchers Created', value: '265' },
  { label: 'Pending Push',     value: '12'  },
  { label: 'Sync Failed',      value: '3'   },
  { label: 'Net Amount',       value: '₹4.2L'},
];

const KPI_DAYBOOK = [
  { label: 'Edited',  value: '117'    },
  { label: 'Deleted', value: '8'      },
  { label: 'Net Dr',  value: '₹42K'   },
  { label: 'Net Cr',  value: '₹72.4M' },
];

// ─── Bar Chart Data ───────────────────────────────────────────────────────────
const genBars = (seed: number) =>
  Array.from({ length: 30 }, (_, i) => ({ day: i + 1, count: Math.floor(((seed * (i + 3)) % 16) + 2) }));
const BAR_DATA_MY = genBars(7);
const BAR_DATA_DB = genBars(13);

// ─── Color Maps ───────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  'Sales': '#2D7D46', 'Purchase': '#2563EB', 'Payment': '#C0392B',
  'Receipt': '#2D7D46', 'Journal': '#D97706', 'Contra': '#7C3AED',
  'Debit Note': '#C0392B', 'Credit Note': '#2D7D46', 'Delivery Note': '#0891B2',
};
const ACTION_COLORS: Record<string, string> = {
  Created: '#2D7D46', Edited: '#D97706', Deleted: '#C0392B',
};

// ─── Interactive Bar Chart (with fixed Y-axis + scrollable bars) ─────────────
function InteractiveBarChart({ data }: { data: { day: number; count: number }[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const YAXIS_W = 32;
  const BAR_W   = 20; const GAP = 4; const H = 140;
  const PAD_B   = 20; const PAD_T = 30;
  const chartH  = H - PAD_B - PAD_T;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  // Round up to nearest 5 for clean Y-axis ticks
  const niceMax  = Math.ceil(maxCount / 5) * 5 || 5;
  const barAreaW = (BAR_W + GAP) * data.length;
  const yTicks   = [0, Math.round(niceMax * 0.5), niceMax];

  return (
    <View style={{ flexDirection: 'row', height: H }}>
      {/* ── Fixed Y-Axis ── */}
      <Svg width={YAXIS_W} height={H}>
        {/* Vertical axis line */}
        <Rect x={YAXIS_W - 1} y={PAD_T - 4} width={1} height={chartH + 6} fill={COLORS.borderStrong} />
        {yTicks.map(tick => {
          const y = PAD_T + chartH - (tick / niceMax) * chartH;
          return (
            <SvgText key={tick} x={YAXIS_W - 5} y={y + 4} textAnchor="end" fontSize={8} fill={COLORS.textTertiary}>
              {tick}
            </SvgText>
          );
        })}
      </Svg>

      {/* ── Scrollable Bar Area ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <Svg width={barAreaW + 4} height={H}>
          {/* Horizontal guide lines */}
          {yTicks.map(tick => {
            const y = PAD_T + chartH - (tick / niceMax) * chartH;
            return (
              <Rect key={tick} x={0} y={y} width={barAreaW} height={0.5}
                fill={COLORS.borderDefault} opacity={0.9} />
            );
          })}
          {/* X-axis baseline */}
          <Rect x={0} y={PAD_T + chartH} width={barAreaW} height={1} fill={COLORS.borderStrong} />

          {/* Bars */}
          {data.map((d, i) => {
            const bh = Math.max((d.count / niceMax) * chartH, 3);
            const x  = i * (BAR_W + GAP);
            const y  = PAD_T + chartH - bh;
            const isActive = activeIdx === i;
            return (
              <G key={i} onPress={() => setActiveIdx(isActive ? null : i)}>
                <Rect x={x} y={y} width={BAR_W} height={bh} rx={3}
                  fill={isActive ? COLORS.textPrimary : AMBER}
                  opacity={isActive ? 1 : 0.85}
                />
                {/* X-axis day label */}
                {(d.day === 1 || d.day % 5 === 0) && (
                  <SvgText x={x + BAR_W / 2} y={H - 4} textAnchor="middle" fontSize={7} fill={COLORS.textTertiary}>
                    {d.day}
                  </SvgText>
                )}
                {/* Tap tooltip */}
                {isActive && (
                  <G>
                    <Rect x={Math.max(0, x - 8)} y={2} width={BAR_W + 16} height={24} rx={5} fill={COLORS.textPrimary} />
                    <SvgText x={x + BAR_W / 2} y={18} textAnchor="middle" fontSize={11} fill="#FFFFFF" fontWeight="700">
                      {d.count}
                    </SvgText>
                  </G>
                )}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

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
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [activeTab,      setActiveTab]      = useState<TabType>('myentries');
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [voucherType,    setVoucherType]    = useState<VoucherType>('ALL');
  const [showVTypeModal, setShowVTypeModal] = useState(false);
  const [showDr,         setShowDr]         = useState(true);
  const [showCr,         setShowCr]         = useState(true);
  const [multiSelect,     setMultiSelect]     = useState(false);
  const [selected,        setSelected]        = useState<string[]>([]);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const isDateActive = fromDate.length > 0 && toDate.length > 0;
  const kpiData   = activeTab === 'myentries' ? KPI_MY_ENTRIES : KPI_DAYBOOK;
  const barData   = activeTab === 'myentries' ? BAR_DATA_MY    : BAR_DATA_DB;
  const allSource = activeTab === 'myentries' ? MY_ENTRIES     : DAYBOOK_ENTRIES;

  // ── Filtered & Grouped ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let arr = allSource;
    if (voucherType !== 'ALL') arr = arr.filter(e => e.type === voucherType);
    // Dr/Cr: both checked OR both unchecked → show all; only one → filter
    if (showDr !== showCr) {
      if (showDr && !showCr) arr = arr.filter(e => !e.isCredit);  // Dr only
      if (!showDr && showCr) arr = arr.filter(e => e.isCredit);   // Cr only
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

  // ── Helpers ────────────────────────────────────────────────────────────
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
            onPress={() => { setFromDate(''); setToDate(''); }}
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

        {/* Bar Chart */}
        <View style={s.chartCard}>
          <Text style={s.chartTitle}>
            {activeTab === 'myentries' ? 'My Entries (Last 30 Days)' : 'Daily Activity (Last 30 Days)'}
          </Text>
          <InteractiveBarChart data={barData} />
        </View>

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
            <Text style={s.emptyTxt}>No entries found</Text>
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
                  const tc     = TYPE_COLORS[entry.type] || COLORS.textSecondary;
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
                          <View style={[s.statusIcon, { backgroundColor: (ACTION_COLORS[entry.action!] || '#999') + '18' }]}>
                            <Ionicons
                              name={
                                entry.action === 'Created' ? 'add-circle-outline' :
                                entry.action === 'Edited'  ? 'create-outline' : 'trash-outline'
                              }
                              size={19}
                              color={ACTION_COLORS[entry.action!] || COLORS.textSecondary}
                            />
                          </View>
                        ) : null}

                        {/* Entry detail */}
                        <View style={s.entryInfo}>
                          <View style={s.entryTopRow}>
                            <View style={[s.vtypePill, { backgroundColor: tc + '18' }]}>
                              <Text style={[s.vtypePillTxt, { color: tc }]}>{entry.type}</Text>
                            </View>
                            <Text style={s.refTxt}>{entry.ref}</Text>
                            {activeTab === 'myentries' && entry.syncStatus === 'pending' ? (
                              <View style={s.pendingBadge}>
                                <Text style={s.pendingBadgeTxt}>Pending</Text>
                              </View>
                            ) : null}
                            {activeTab === 'myentries' && entry.syncStatus === 'failed' ? (
                              <View style={s.failedBadge}>
                                <Text style={s.failedBadgeTxt}>Failed</Text>
                              </View>
                            ) : null}
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

  // Chart
  chartCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  chartTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },

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

  pendingBadge: { backgroundColor: AMBER + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  pendingBadgeTxt:{ fontSize: 9, fontWeight: '700', color: AMBER },
  failedBadge:  { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  failedBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#DC2626' },

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
