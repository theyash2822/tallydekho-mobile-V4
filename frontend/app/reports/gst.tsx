import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { parseDMY, fmtDMY } from '../../src/components/DateRangePickerModal';

// ── GSTR Tabs ─────────────────────────────────────────────────────────────────
const GSTR_TABS = ['GSTR-1', 'GSTR-2A', 'GSTR-9', 'GSTR-4', 'GSTR-3B', 'GSTR-6'];

// ── Mock Invoice Data ─────────────────────────────────────────────────────────
interface Invoice {
  id: string;
  invoiceNo: string;
  type: string;
  party: string;
  date: string;
  dateObj: Date;
  amount: string;
  matched: boolean;
  gstr: string[];
}

const MOCK_INVOICES: Invoice[] = [
  { id: '1',  invoiceNo: 'XYD-0909A', type: 'Sales',    party: 'Netaji Industries',  date: '25 July 2025', dateObj: new Date(2025, 6, 25), amount: '₹3,60,000', matched: false, gstr: ['GSTR-1', 'GSTR-6'] },
  { id: '2',  invoiceNo: 'XYD-0908B', type: 'Sales',    party: 'ABC Corporation',    date: '24 July 2025', dateObj: new Date(2025, 6, 24), amount: '₹2,80,000', matched: true,  gstr: ['GSTR-1', 'GSTR-2A', 'GSTR-6'] },
  { id: '3',  invoiceNo: 'XYD-0907C', type: 'Sales',    party: 'XYZ Limited',        date: '23 July 2025', dateObj: new Date(2025, 6, 23), amount: '₹1,95,000', matched: true,  gstr: ['GSTR-1', 'GSTR-2A', 'GSTR-9', 'GSTR-6'] },
  { id: '4',  invoiceNo: 'XYD-0906D', type: 'Sales',    party: 'Tech Solutions Ltd', date: '22 July 2025', dateObj: new Date(2025, 6, 22), amount: '₹4,20,000', matched: false, gstr: ['GSTR-1', 'GSTR-3B'] },
  { id: '5',  invoiceNo: 'XYD-0905E', type: 'Sales',    party: 'Global Industries',  date: '21 July 2025', dateObj: new Date(2025, 6, 21), amount: '₹1,80,000', matched: true,  gstr: ['GSTR-1', 'GSTR-2A', 'GSTR-9', 'GSTR-4'] },
  { id: '6',  invoiceNo: 'XYD-0904F', type: 'Sales',    party: 'Prime Services',     date: '20 July 2025', dateObj: new Date(2025, 6, 20), amount: '₹3,20,000', matched: true,  gstr: ['GSTR-2A', 'GSTR-3B'] },
  { id: '7',  invoiceNo: 'XYD-0903G', type: 'Purchase', party: 'Innovation Corp',    date: '19 July 2025', dateObj: new Date(2025, 6, 19), amount: '₹2,75,000', matched: false, gstr: ['GSTR-2A', 'GSTR-4', 'GSTR-3B', 'GSTR-6'] },
  { id: '8',  invoiceNo: 'XYD-0902H', type: 'Purchase', party: 'Metro Traders',      date: '18 July 2025', dateObj: new Date(2025, 6, 18), amount: '₹1,50,000', matched: true,  gstr: ['GSTR-9', 'GSTR-4'] },
  { id: '9',  invoiceNo: 'XYD-0901I', type: 'Sales',    party: 'Sunrise Exports',    date: '17 July 2025', dateObj: new Date(2025, 6, 17), amount: '₹5,10,000', matched: false, gstr: ['GSTR-1', 'GSTR-3B', 'GSTR-6'] },
  { id: '10', invoiceNo: 'XYD-0900J', type: 'Sales',    party: 'Apex Distributors',  date: '16 July 2025', dateObj: new Date(2025, 6, 16), amount: '₹2,10,000', matched: true,  gstr: ['GSTR-9', 'GSTR-4', 'GSTR-3B'] },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GSTScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [activeTab,       setActiveTab]       = useState('GSTR-1');
  const [fromDate,        setFromDate]        = useState('');
  const [toDate,          setToDate]          = useState('');
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [selected,        setSelected]        = useState<string[]>([]);

  const isDateActive = fromDate.length > 0 && toDate.length > 0;

  // Filter by tab + date range
  const filteredInvoices = MOCK_INVOICES.filter((inv) => {
    if (!inv.gstr.includes(activeTab)) return false;
    if (isDateActive) {
      const from = parseDMY(fromDate);
      const to   = parseDMY(toDate);
      if (from && to) return inv.dateObj >= from && inv.dateObj <= to;
    }
    return true;
  });

  const unmatchedCount = MOCK_INVOICES.filter(
    (inv) => !inv.matched && inv.gstr.includes(activeTab)
  ).length;

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelected([]);
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>GST</Text>
        <TouchableOpacity
          style={s.iconBtn}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Date Range Strip (unified, same as financial/ledger) ─────── */}
      <TouchableOpacity
        style={s.dateStrip}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.8}
      >
        <Ionicons
          name="calendar-outline"
          size={13}
          color={isDateActive ? COLORS.brandPrimary : COLORS.textTertiary}
        />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {isDateActive ? `${fromDate}  \u2192  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && (
          <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />
        )}
        {isDateActive && (
          <TouchableOpacity
            onPress={() => { setFromDate(''); setToDate(''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* ── Summary Card ────────────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>GST Collected</Text>
            <Text style={s.summaryValue}>{'₹4,75,000'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>ITC Balance</Text>
            <Text style={s.summaryValue}>{'₹3,92,000'}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Net Payable</Text>
            <Text style={s.summaryValue}>{'₹83,000'}</Text>
          </View>
        </View>

        {/* ── Unmatched CTA ───────────────────────────────────────────── */}
        {unmatchedCount > 0 && (
          <TouchableOpacity
            style={s.unmatchedBtn}
            onPress={() => router.push('/reports/unmatched-list' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.unmatchedBtnTxt}>Unmatched {unmatchedCount} Invoices</Text>
          </TouchableOpacity>
        )}

        {/* ── GST Ledger Section ──────────────────────────────────────── */}
        <Text style={s.sectionLabel}>GST Ledger</Text>

        {/* ── GSTR Tab Pills (horizontal scroll) ─────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabBarContent}
          style={s.tabBarWrap}
        >
          {GSTR_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[s.tabPill, activeTab === tab && s.tabPillActive]}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabPillTxt, activeTab === tab && s.tabPillTxtActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Invoice List ─────────────────────────────────────────────── */}
        {filteredInvoices.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={44} color={COLORS.positive} />
            <Text style={s.emptyTxt}>All invoices matched</Text>
          </View>
        ) : (
          filteredInvoices.map((inv) => {
            const isSelected = selected.includes(inv.id);
            return (
              <TouchableOpacity
                key={inv.id}
                style={[s.invoiceCard, isSelected && s.invoiceCardSelected]}
                onPress={() => {
                  if (selected.length > 0) {
                    toggleSelect(inv.id);
                  } else {
                    router.push(`/document/${inv.id}` as any);
                  }
                }}
                onLongPress={() => toggleSelect(inv.id)}
                delayLongPress={500}
                activeOpacity={0.8}
              >
                {/* Top row: Invoice ID + type */}
                <View style={s.invTopRow}>
                  <Text style={s.invId}>{inv.invoiceNo}</Text>
                  <Text style={s.invSep}> \u2022 </Text>
                  <Text style={s.invType}>{inv.type}</Text>
                </View>

                {/* Body: Status icon + Party info + Amount */}
                <View style={s.invBodyRow}>
                  <View
                    style={[
                      s.statusIcon,
                      { backgroundColor: inv.matched ? '#F0FBF4' : '#FEF2F2' },
                    ]}
                  >
                    <Ionicons
                      name={inv.matched ? 'checkmark' : 'warning'}
                      size={15}
                      color={inv.matched ? COLORS.positive : '#DC2626'}
                    />
                  </View>
                  <View style={s.invInfo}>
                    <Text style={s.invParty}>{inv.party}</Text>
                    <Text style={s.invDate}>{inv.date}</Text>
                  </View>
                  <Text style={s.invAmount}>{inv.amount}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: selected.length > 0 ? 90 : 40 }} />
      </ScrollView>

      {/* ── Share Bar (appears on long-press selection) ──────────────── */}
      {selected.length > 0 && (
        <View style={[s.shareBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{selected.length} selected</Text>
            <TouchableOpacity
              onPress={() => setSelected([])}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Text style={s.shareCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.shareActionBtn} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={s.shareActionTxt}>Share PDF / XLS</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Date Range Modal (shared component) ─────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(from, to) => {
          if (from && to) { setFromDate(from); setToDate(to); }
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  iconBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  // Date Strip
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: COLORS.brandPrimary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  // Summary Card
  summaryCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  summaryDivider: { height: 1, backgroundColor: COLORS.borderDefault },
  summaryLabel: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  summaryValue: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Unmatched CTA
  unmatchedBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  unmatchedBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },

  // Section label
  sectionLabel: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  // Tab bar
  tabBarWrap: { marginBottom: SPACING.sm },
  tabBarContent: { gap: 8, paddingRight: SPACING.md },
  tabPill: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  tabPillActive: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.brandPrimary,
  },
  tabPillTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabPillTxtActive: { color: COLORS.brandPrimary, fontWeight: '700' },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '500' },

  // Invoice cards
  invoiceCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 8,
  },
  invoiceCardSelected: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 2,
  },

  invTopRow: { flexDirection: 'row', alignItems: 'center' },
  invId:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  invSep:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invType: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  invBodyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  invInfo:   { flex: 1, gap: 3 },
  invParty:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  invDate:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  invAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Share bar
  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 12,
  },
  shareLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
