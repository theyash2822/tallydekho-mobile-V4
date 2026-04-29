import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { fmtDMY } from '../../src/components/DateRangePickerModal';
import { getFullFinancialReport } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

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
// Profit & Loss — real data summary
// ══════════════════════════════════════════════════════════════════════════════
function PLCardGrid({ pl }: { pl?: any }) {
  const income   = pl?.totalIncome   ?? 0;
  const expenses = pl?.totalExpenses ?? 0;
  const net      = pl?.netProfit     ?? (income - expenses);
  const rows = [
    { left: 'Total Income',   leftAmt: income,   right: 'Total Expenses', rightAmt: expenses },
    { left: net >= 0 ? 'Net Profit' : 'Net Loss', leftAmt: Math.abs(net), right: 'Income Ledgers', rightAmt: pl?.income?.length ?? 0 },
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
      {pl?.income?.slice(0, 5).map((l: any, i: number) => (
        <View key={`inc-${i}`} style={[plg.row]}>
          <View style={[plg.card, { flex: 2 }]}><Text style={plg.lbl} numberOfLines={1}>{l.name}</Text></View>
          <View style={[plg.card, { flex: 1 }]}><Text style={[plg.val, { color: COLORS.positive }]}>{fmtInr(l.amount)}</Text></View>
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
function BalanceSheetSection({ bs }: { bs?: any }) {
  const [tab, setTab] = useState<'liability' | 'assets'>('liability');
  const liabilities = bs?.liabilities ?? MOCK_LIABILITIES.map(r => ({ name: r.name, amount: r.current }));
  const assets      = bs?.assets      ?? MOCK_ASSETS;
  const totalLiab   = bs?.totalLiabilities ?? MOCK_TOTAL_LIAB;
  const totalAssets = bs?.totalAssets      ?? MOCK_TOTAL_ASSETS;

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
            {liabilities.map((row: any, i: number) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2 }]} numberOfLines={1}>{row.name}</Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1.3 }]}>
                  {fmtInr(row.amount ?? row.current ?? 0)}
                </Text>
              </View>
            ))}
            {/* Total row */}
            <View style={[bss.tableRow, bss.totalRow]}>
              <Text style={[bss.cell, bss.totalName, { flex: 2 }]}>Total Liabilities</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 1.3 }]}>
                {fmtInr(totalLiab)}
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
            {assets.map((row: any, i: number) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2 }]} numberOfLines={1}>{row.name}</Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1 }]}>
                  {fmtInr(row.amount ?? 0)}
                </Text>
              </View>
            ))}
            {/* Total row */}
            <View style={[bss.tableRow, bss.totalRow]}>
              <Text style={[bss.cell, bss.totalName, { flex: 2 }]}>Total Assets</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 1 }]}>
                {fmtInr(totalAssets)}
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
function TrialBalanceGrid({ tb }: { tb?: any }) {
  const ledgers     = tb?.ledgers    ?? [];
  const totalDebit  = tb?.totalDebit  ?? 0;
  const totalCredit = tb?.totalCredit ?? 0;
  if (ledgers.length === 0) {
    return (
      <View style={tbg.grid}>
        <Text style={{ color: COLORS.textSecondary, textAlign: 'center', padding: 16 }}>No trial balance data</Text>
      </View>
    );
  }
  return (
    <View style={tbg.grid}>
      <View style={[tbg.row, { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingBottom: 8, marginBottom: 4 }]}>
        <View style={tbg.card}><Text style={tbg.lbl}>Total Debit</Text><Text style={[tbg.val, { color: COLORS.negative }]}>{fmtInr(totalDebit)}</Text></View>
        <View style={tbg.card}><Text style={tbg.lbl}>Total Credit</Text><Text style={[tbg.val, { color: COLORS.positive }]}>{fmtInr(totalCredit)}</Text></View>
      </View>
      {ledgers.slice(0, 10).map((l: any, i: number) => (
        <View key={i} style={tbg.row}>
          <View style={[tbg.card, { flex: 2 }]}><Text style={tbg.lbl} numberOfLines={1}>{l.name}</Text></View>
          <View style={tbg.card}><Text style={tbg.lbl}>Dr</Text><Text style={tbg.val}>{fmtInr(l.debit)}</Text></View>
          <View style={tbg.card}><Text style={tbg.lbl}>Cr</Text><Text style={tbg.val}>{fmtInr(l.credit)}</Text></View>
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
// Main Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function FinancialReportScreen() {
  const router = useRouter();
  const { company } = useAuth();

  // Accordion — 'pl' open by default
  const [openSection, setOpenSection] = useState<SectionKey | null>('pl');
  const toggleSection = (k: SectionKey) =>
    setOpenSection(prev => (prev === k ? null : k));

  // Date range — default to current FY (Apr 1 → Mar 31)
  const today     = new Date();
  const fyYear    = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyStart   = new Date(fyYear, 3, 1);
  const fyEnd     = new Date(fyYear + 1, 2, 31);
  const [fromDate, setFromDate]           = useState(fmtDMY(fyStart));
  const [toDate,   setToDate]             = useState(fmtDMY(fyEnd));
  const [showDateSheet, setShowDateSheet] = useState(false);

  // Real financial data from backend
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFullFinancialReport(company?.guid).then(res => {
      if (!cancelled && res?.success && res.data) setReportData(res.data);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [company?.guid]);

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
          {loading ? <ActivityIndicator color={COLORS.brandPrimary} style={{ padding: 20 }} /> : <PLCardGrid pl={reportData?.pl} />}
        </AccSection>

        {/* 2. Balance Sheet */}
        <AccSection
          sectionKey="bs"
          title="Balance Sheet"
          open={openSection === 'bs'}
          onToggle={toggleSection}
        >
          {loading ? <ActivityIndicator color={COLORS.brandPrimary} style={{ padding: 20 }} /> : <BalanceSheetSection bs={reportData?.bs} />}
        </AccSection>

        {/* 3. Trial Balance */}
        <AccSection
          sectionKey="tb"
          title="Trial Balance"
          open={openSection === 'tb'}
          onToggle={toggleSection}
        >
          {loading ? <ActivityIndicator color={COLORS.brandPrimary} style={{ padding: 20 }} /> : <TrialBalanceGrid tb={reportData?.trialBalance} />}
        </AccSection>
      </ScrollView>

      {/* ── Date Range Picker (shared full-calendar component) ── */}
      <DateRangePickerModal
        visible={showDateSheet}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(from, to) => {
          if (from && to) { setFromDate(from); setToDate(to); }
        }}
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
