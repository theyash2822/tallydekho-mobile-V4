import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DatePickerModal, { formatDMY } from '../../src/components/forms/DatePickerModal';

// ── Mock Data (Tally Prime format) ─────────────────────────────────────────
const MOCK_PL = {
  openingStock:     150000,
  closingStock:    7400000,
  purchase:         150000,
  sales:           7400000,
  directExpense:    150000,
  indirectExpense: 7400000,
  indirectIncome:   150000,
  directIncome:    7400000,
  grossProfit:      150000,
  grossLoss:       7400000,
  netProfit:        150000,
  netLoss:         7400000,
};

const MOCK_LIABILITIES = [
  { name: 'Capital Account',        opening: 500000, current: 520000 },
  { name: 'Current Liability',      opening: 120000, current: 100000 },
  { name: 'Loan Liabilities',       opening: 300000, current: 280000 },
  { name: 'Miscellaneous Expenses', opening:  25000, current:  30000 },
  { name: 'Profit & Loss',          opening:      0, current:  40000 },
];
const MOCK_TOTAL_LIAB = 970000;

const MOCK_ASSETS = [
  { name: 'Fixed Asset',                   amount: 600000 },
  { name: 'Current Assets',                amount: 250000 },
  { name: 'Investments',                   amount:  50000 },
  { name: 'Difference in Opening Balance', amount:  70000 },
];
const MOCK_TOTAL_ASSETS = 970000;

const MOCK_TRIAL = [
  { left: 'Current Assets',  leftAmt: 250000, right: 'Miscellaneous Expenses', rightAmt:  15000 },
  { left: 'Sales Account',   leftAmt: 480000, right: 'Purchase Accounts',      rightAmt: 320000 },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtInr(n: number): string {
  return '\u20b9' + n.toLocaleString('en-IN');
}

type SectionKey = 'pl' | 'bs' | 'tb';

// ══════════════════════════════════════════════════════════════════════════════
// Accordion Section wrapper
// ══════════════════════════════════════════════════════════════════════════════
function AccSection({
  sectionKey, title, open, onToggle, children,
}: {
  sectionKey: SectionKey;
  title: string;
  open: boolean;
  onToggle: (k: SectionKey) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={acc.container}>
      <TouchableOpacity
        style={acc.header}
        onPress={() => onToggle(sectionKey)}
        activeOpacity={0.7}
      >
        <Text style={acc.title}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={COLORS.textSecondary}
        />
      </TouchableOpacity>
      {open && <View style={acc.body}>{children}</View>}
    </View>
  );
}

const acc = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  title: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// Profit & Loss — 2-column card grid
// ══════════════════════════════════════════════════════════════════════════════
function PLCardGrid() {
  const rows = [
    { left: 'Opening Stock',   leftAmt: MOCK_PL.openingStock,   right: 'Closing Stock',    rightAmt: MOCK_PL.closingStock    },
    { left: 'Purchase',        leftAmt: MOCK_PL.purchase,       right: 'Sales',            rightAmt: MOCK_PL.sales           },
    { left: 'Direct Expense',  leftAmt: MOCK_PL.directExpense,  right: 'Indirect Expense', rightAmt: MOCK_PL.indirectExpense },
    { left: 'Indirect Income', leftAmt: MOCK_PL.indirectIncome, right: 'Direct Income',    rightAmt: MOCK_PL.directIncome   },
    { left: 'Gross Profit',    leftAmt: MOCK_PL.grossProfit,    right: 'Gross Loss',       rightAmt: MOCK_PL.grossLoss      },
    { left: 'Net Profit',      leftAmt: MOCK_PL.netProfit,      right: 'Net Loss',         rightAmt: MOCK_PL.netLoss        },
  ];
  return (
    <View style={plg.grid}>
      {rows.map((row, i) => (
        <View key={i} style={plg.row}>
          <View style={plg.card}>
            <Text style={plg.lbl}>{row.left}</Text>
            <Text style={plg.val}>{fmtInr(row.leftAmt)}</Text>
          </View>
          <View style={plg.card}>
            <Text style={plg.lbl}>{row.right}</Text>
            <Text style={plg.val}>{fmtInr(row.rightAmt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const plg = StyleSheet.create({
  grid: { gap: SPACING.sm },
  row:  { flexDirection: 'row', gap: SPACING.sm },
  card: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 5 },
  val: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// Balance Sheet — Liability / Assets tab + tables
// ══════════════════════════════════════════════════════════════════════════════
function BalanceSheetSection() {
  const [tab, setTab] = useState<'liability' | 'assets'>('liability');

  return (
    <View>
      {/* Tab switcher */}
      <View style={bss.tabs}>
        {(['liability', 'assets'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[bss.tab, tab === t && bss.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[bss.tabTxt, tab === t && bss.tabTxtActive]}>
              {t === 'liability' ? 'Liability' : 'Assets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table */}
      <View style={bss.table}>
        {tab === 'liability' ? (
          <>
            {/* Header row */}
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2 }]}>Liability</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1.2 }]}>Opening Bal.</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1.3 }]}>Current Period</Text>
            </View>
            {/* Data rows */}
            {MOCK_LIABILITIES.map((row, i) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2 }]}>{row.name}</Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1.2 }]}>
                  {row.opening === 0 ? '\u20b90' : fmtInr(row.opening)}
                </Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1.3 }]}>
                  {fmtInr(row.current)}
                </Text>
              </View>
            ))}
            {/* Total row */}
            <View style={[bss.tableRow, bss.totalRow]}>
              <Text style={[bss.cell, bss.totalName, { flex: 2 }]}>Total Liabilities</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 2.5 }]}>
                {fmtInr(MOCK_TOTAL_LIAB)}
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* Header row */}
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2 }]}>Asset</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1 }]}>Amount (INR)</Text>
            </View>
            {/* Data rows */}
            {MOCK_ASSETS.map((row, i) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2 }]}>{row.name}</Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1 }]}>
                  {fmtInr(row.amount)}
                </Text>
              </View>
            ))}
            {/* Total row */}
            <View style={[bss.tableRow, bss.totalRow]}>
              <Text style={[bss.cell, bss.totalName, { flex: 2 }]}>Total Assets</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 1 }]}>
                {fmtInr(MOCK_TOTAL_ASSETS)}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const bss = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    padding: 3,
    marginBottom: SPACING.sm,
  },
  tab:         { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabActive:   { backgroundColor: COLORS.brandPrimary },
  tabTxt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive:{ color: COLORS.white, fontWeight: '700' },

  table: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  hdrRow: {
    backgroundColor: COLORS.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  altRow:   { backgroundColor: COLORS.pageBg },
  totalRow: {
    backgroundColor: COLORS.activeBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
  },

  cell:      { fontSize: TYPOGRAPHY.sm },
  right:     { textAlign: 'right' },
  hdrTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowName:   { color: COLORS.textPrimary, fontWeight: '500' },
  rowVal:    { color: COLORS.textPrimary, fontWeight: '600' },
  totalName: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  totalVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// Trial Balance — 2-column card grid (4 cards, 2 rows)
// ══════════════════════════════════════════════════════════════════════════════
function TrialBalanceGrid() {
  return (
    <View style={tbg.grid}>
      {MOCK_TRIAL.map((row, i) => (
        <View key={i} style={tbg.row}>
          <View style={tbg.card}>
            <Text style={tbg.lbl}>{row.left}</Text>
            <Text style={tbg.val}>{fmtInr(row.leftAmt)}</Text>
          </View>
          <View style={tbg.card}>
            <Text style={tbg.lbl}>{row.right}</Text>
            <Text style={tbg.val}>{fmtInr(row.rightAmt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const tbg = StyleSheet.create({
  grid: { gap: SPACING.sm },
  row:  { flexDirection: 'row', gap: SPACING.sm },
  card: {
    flex: 1,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 5 },
  val: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// Date Range Bottom Sheet
// ══════════════════════════════════════════════════════════════════════════════
function DateRangeSheet({
  visible, fromDate, toDate, onApply, onClose,
}: {
  visible: boolean;
  fromDate: string;
  toDate: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const [localFrom, setLocalFrom] = useState(fromDate);
  const [localTo,   setLocalTo]   = useState(toDate);
  const [showFrom,  setShowFrom]  = useState(false);
  const [showTo,    setShowTo]    = useState(false);

  useEffect(() => {
    if (visible) { setLocalFrom(fromDate); setLocalTo(toDate); }
  }, [visible]);

  const canApply = !!localFrom && !!localTo;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={drs.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={drs.sheet}>
          <View style={drs.handle} />
          <Text style={drs.title}>Select Date Range</Text>

          {/* From */}
          <TouchableOpacity style={drs.dateRow} onPress={() => setShowFrom(true)} activeOpacity={0.7}>
            <View style={drs.dateLabel}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.textTertiary} />
              <Text style={drs.dateLabelTxt}>From</Text>
            </View>
            <Text style={[drs.dateValue, !localFrom && drs.datePlaceholder]}>
              {localFrom || 'DD / MM / YY'}
            </Text>
          </TouchableOpacity>

          <View style={drs.divider} />

          {/* To */}
          <TouchableOpacity style={drs.dateRow} onPress={() => setShowTo(true)} activeOpacity={0.7}>
            <View style={drs.dateLabel}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.textTertiary} />
              <Text style={drs.dateLabelTxt}>To</Text>
            </View>
            <Text style={[drs.dateValue, !localTo && drs.datePlaceholder]}>
              {localTo || 'DD / MM / YY'}
            </Text>
          </TouchableOpacity>

          {/* Buttons */}
          <View style={drs.btnRow}>
            <TouchableOpacity style={drs.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={drs.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[drs.applyBtn, !canApply && drs.applyBtnDis]}
              onPress={() => { if (canApply) { onApply(localFrom, localTo); onClose(); } }}
              activeOpacity={0.8}
              disabled={!canApply}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
              <Text style={drs.applyTxt}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Single-date pickers (reuse existing component) */}
      <DatePickerModal
        visible={showFrom}
        value={localFrom}
        onSelect={setLocalFrom}
        onClose={() => setShowFrom(false)}
        title="Select From Date"
      />
      <DatePickerModal
        visible={showTo}
        value={localTo}
        onSelect={setLocalTo}
        onClose={() => setShowTo(false)}
        title="Select To Date"
      />
    </>
  );
}

const drs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  title: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center', marginBottom: 20,
  },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 4,
  },
  dateLabel:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabelTxt:   { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, fontWeight: '600' },
  dateValue:      { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  datePlaceholder:{ color: COLORS.textTertiary, fontWeight: '400' },
  divider:        { height: 1, backgroundColor: COLORS.borderDefault },
  btnRow:  { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center',
  },
  cancelTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 14,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  applyBtnDis: { backgroundColor: COLORS.borderStrong },
  applyTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ══════════════════════════════════════════════════════════════════════════════
// Main Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function FinancialReportScreen() {
  const router = useRouter();

  // Accordion — 'pl' open by default
  const [openSection, setOpenSection] = useState<SectionKey | null>('pl');
  const toggleSection = (k: SectionKey) =>
    setOpenSection(prev => (prev === k ? null : k));

  // Date range — default to current FY (Apr 1 → Mar 31)
  const today     = new Date();
  const fyYear    = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyStart   = new Date(fyYear, 3, 1);       // Apr 1
  const fyEnd     = new Date(fyYear + 1, 2, 31);  // Mar 31
  const [fromDate, setFromDate]       = useState(formatDMY(fyStart));
  const [toDate,   setToDate]         = useState(formatDMY(fyEnd));
  const [showDateSheet, setShowDateSheet] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Financial Report</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDateSheet(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Date range strip ────────────────────────────────────────── */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDateSheet(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.textTertiary} />
        <Text style={s.dateStripTxt}>{fromDate}{'  →  '}{toDate}</Text>
        <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
      </TouchableOpacity>

      {/* ── Scroll content ──────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: 60 }}
      >
        {/* 1. Profit & Loss */}
        <AccSection
          sectionKey="pl"
          title="Profit & Loss"
          open={openSection === 'pl'}
          onToggle={toggleSection}
        >
          <PLCardGrid />
        </AccSection>

        {/* 2. Balance Sheet */}
        <AccSection
          sectionKey="bs"
          title="Balance Sheet"
          open={openSection === 'bs'}
          onToggle={toggleSection}
        >
          <BalanceSheetSection />
        </AccSection>

        {/* 3. Trial Balance */}
        <AccSection
          sectionKey="tb"
          title="Trial Balance"
          open={openSection === 'tb'}
          onToggle={toggleSection}
        >
          <TrialBalanceGrid />
        </AccSection>
      </ScrollView>

      {/* ── Date Range Sheet ────────────────────────────────────────── */}
      <DateRangeSheet
        visible={showDateSheet}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(from, to) => { setFromDate(from); setToDate(to); }}
        onClose={() => setShowDateSheet(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  iconBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  scroll: { flex: 1 },
});
