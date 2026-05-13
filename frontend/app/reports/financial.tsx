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

// ── Mock Data (Tally Prime format) — shown when no real data available ───────
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
  return '₹' + Math.abs(n).toLocaleString('en-IN');
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
function PLCardGrid({ pl }: { pl?: any }) {
  // Use real data if available, otherwise mock
  const hasRealData = pl && (pl.sales > 0 || pl.purchase > 0 || pl.openingStock > 0);

  const rows = hasRealData ? [
    { left: 'Opening Stock',   leftAmt: pl.openingStock   ?? 0, right: 'Closing Stock',    rightAmt: pl.closingStock   ?? 0 },
    { left: 'Purchase',        leftAmt: pl.purchase       ?? 0, right: 'Sales',            rightAmt: pl.sales          ?? 0 },
    { left: 'Direct Expense',  leftAmt: pl.directExpenses ?? 0, right: 'Indirect Expense', rightAmt: pl.indirectExpenses ?? 0 },
    { left: 'Indirect Income', leftAmt: pl.indirectIncome ?? 0, right: 'Direct Income',    rightAmt: pl.directIncome   ?? 0 },
    { left: 'Gross Profit',    leftAmt: pl.grossProfit    ?? 0, right: 'Gross Loss',       rightAmt: pl.grossLoss      ?? 0 },
    { left: 'Net Profit',      leftAmt: pl.netProfit      ?? 0, right: 'Net Loss',         rightAmt: pl.netLoss        ?? 0 },
  ] : [
    { left: 'Opening Stock',   leftAmt: MOCK_PL.openingStock,   right: 'Closing Stock',    rightAmt: MOCK_PL.closingStock    },
    { left: 'Purchase',        leftAmt: MOCK_PL.purchase,       right: 'Sales',            rightAmt: MOCK_PL.sales           },
    { left: 'Direct Expense',  leftAmt: MOCK_PL.directExpense,  right: 'Indirect Expense', rightAmt: MOCK_PL.indirectExpense },
    { left: 'Indirect Income', leftAmt: MOCK_PL.indirectIncome, right: 'Direct Income',    rightAmt: MOCK_PL.directIncome   },
    { left: 'Gross Profit',    leftAmt: MOCK_PL.grossProfit,    right: 'Gross Loss',       rightAmt: MOCK_PL.grossLoss      },
    { left: 'Net Profit',      leftAmt: MOCK_PL.netProfit,      right: 'Net Loss',         rightAmt: MOCK_PL.netLoss        },
  ];

  return (
    <View style={plg.grid}>
      {!hasRealData && (
        <View style={plg.demoBanner}>
          <Text style={plg.demoTxt}>Showing sample data — sync Tally to see real figures</Text>
        </View>
      )}
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
  demoBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  demoTxt: { fontSize: TYPOGRAPHY.xs, color: '#92400E', textAlign: 'center' },
});

// ══════════════════════════════════════════════════════════════════════════════
// Balance Sheet — Liability / Assets tab + tables
// ══════════════════════════════════════════════════════════════════════════════
function BalanceSheetSection({ bs }: { bs?: any }) {
  const [tab, setTab] = useState<'liability' | 'assets'>('liability');

  const hasRealData = bs && (bs.assets?.length > 0 || bs.liabilities?.length > 0);
  const liabilities = hasRealData
    ? (bs.liabilities || []).map((l: any) => ({ name: l.name, opening: 0, current: l.amount ?? l.closing_balance ?? 0 }))
    : MOCK_LIABILITIES;
  const assets = hasRealData
    ? (bs.assets || []).map((l: any) => ({ name: l.name, amount: l.amount ?? l.closing_balance ?? 0 }))
    : MOCK_ASSETS;
  const totalLiab   = hasRealData ? (bs.totalLiabilities ?? 0) : MOCK_TOTAL_LIAB;
  const totalAssets = hasRealData ? (bs.totalAssets ?? 0)      : MOCK_TOTAL_ASSETS;

  return (
    <View>
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

      <View style={bss.table}>
        {tab === 'liability' ? (
          <>
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2 }]}>Liability</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1.2 }]}>Opening Bal.</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1.3 }]}>Current Period</Text>
            </View>
            {liabilities.map((row: any, i: number) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2 }]} numberOfLines={1}>{row.name}</Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1.2 }]}>
                  {row.opening === 0 ? '₹0' : fmtInr(row.opening)}
                </Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1.3 }]}>
                  {fmtInr(row.current)}
                </Text>
              </View>
            ))}
            <View style={[bss.tableRow, bss.totalRow]}>
              <Text style={[bss.cell, bss.totalName, { flex: 2 }]}>Total Liabilities</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 2.5 }]}>
                {fmtInr(totalLiab)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2 }]}>Asset</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1 }]}>Amount (INR)</Text>
            </View>
            {assets.map((row: any, i: number) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2 }]} numberOfLines={1}>{row.name}</Text>
                <Text style={[bss.cell, bss.rowVal, bss.right, { flex: 1 }]}>
                  {fmtInr(row.amount)}
                </Text>
              </View>
            ))}
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
// Trial Balance — 2-column card grid
// ══════════════════════════════════════════════════════════════════════════════
function TrialBalanceGrid({ tb }: { tb?: any }) {
  const hasRealData = tb?.ledgers?.length > 0;

  if (!hasRealData) {
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

  // Real data: show debit/credit columns
  return (
    <View style={tbg.table}>
      <View style={[tbg.tableRow, tbg.hdrRow]}>
        <Text style={[tbg.cell, tbg.hdrTxt, { flex: 2 }]}>Ledger</Text>
        <Text style={[tbg.cell, tbg.hdrTxt, tbg.right, { flex: 1 }]}>Debit</Text>
        <Text style={[tbg.cell, tbg.hdrTxt, tbg.right, { flex: 1 }]}>Credit</Text>
      </View>
      {(tb.ledgers || []).slice(0, 50).map((l: any, i: number) => (
        <View key={i} style={[tbg.tableRow, i % 2 !== 0 && tbg.altRow]}>
          <Text style={[tbg.cell, tbg.rowName, { flex: 2 }]} numberOfLines={1}>{l.name}</Text>
          <Text style={[tbg.cell, tbg.rowVal, tbg.right, { flex: 1 }]}>{l.debit > 0 ? fmtInr(l.debit) : '-'}</Text>
          <Text style={[tbg.cell, tbg.rowVal, tbg.right, { flex: 1 }]}>{l.credit > 0 ? fmtInr(l.credit) : '-'}</Text>
        </View>
      ))}
      <View style={[tbg.tableRow, tbg.totalRow]}>
        <Text style={[tbg.cell, tbg.totalName, { flex: 2 }]}>Total</Text>
        <Text style={[tbg.cell, tbg.totalVal, tbg.right, { flex: 1 }]}>{fmtInr(tb.totalDebit ?? 0)}</Text>
        <Text style={[tbg.cell, tbg.totalVal, tbg.right, { flex: 1 }]}>{fmtInr(tb.totalCredit ?? 0)}</Text>
      </View>
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
  // Table styles for real data
  table: { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10 },
  hdrRow: { backgroundColor: COLORS.pageBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  altRow: { backgroundColor: COLORS.pageBg },
  totalRow: { backgroundColor: COLORS.activeBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cell: { fontSize: TYPOGRAPHY.sm },
  right: { textAlign: 'right' },
  hdrTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowName: { color: COLORS.textPrimary, fontWeight: '500' },
  rowVal: { color: COLORS.textPrimary, fontWeight: '600' },
  totalName: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  totalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// Main Screen
// ══════════════════════════════════════════════════════════════════════════════
export default function FinancialReportScreen() {
  const router = useRouter();
  const { company: selectedCompany, selectedFY, lastSyncAt } = useAuth();

  const [openSection, setOpenSection] = useState<SectionKey | null>('pl');
  const toggleSection = (k: SectionKey) =>
    setOpenSection(prev => (prev === k ? null : k));

  const today   = new Date();
  const fyYear  = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const fyStart = new Date(fyYear, 3, 1);
  const fyEnd   = new Date(fyYear + 1, 2, 31);
  const [fromDate, setFromDate]           = useState(fmtDMY(fyStart));
  const [toDate,   setToDate]             = useState(fmtDMY(fyEnd));
  const [showDateSheet, setShowDateSheet] = useState(false);

  const [loading, setLoading] = useState(false);
  const [plData, setPlData]   = useState<any>(null);
  const [bsData, setBsData]   = useState<any>(null);
  const [tbData, setTbData]   = useState<any>(null);
  const [error,  setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompany?.guid) return;
    setLoading(true);
    setError(null);
    getFullFinancialReport(selectedCompany.guid, selectedFY?.finYear)
      .then((res: any) => {
        const d = res?.data;
        if (d?.pl)           setPlData(d.pl);
        if (d?.bs)           setBsData(d.bs);
        if (d?.trialBalance) setTbData(d.trialBalance);
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load financial data');
      })
      .finally(() => setLoading(false));
  }, [selectedCompany?.guid, selectedFY?.finYear, lastSyncAt]);

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Financial Report</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDateSheet(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Date range strip ── */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDateSheet(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.textTertiary} />
        <Text style={s.dateStripTxt}>{fromDate}{'  →  '}{toDate}</Text>
        <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
      </TouchableOpacity>

      {/* ── Error banner ── */}
      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorTxt}>⚠️ {error}</Text>
        </View>
      )}

      {/* ── Loading ── */}
      {loading && (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>Loading financial data…</Text>
        </View>
      )}

      {/* ── Scroll content ── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: SPACING.md, paddingBottom: 60 }}
      >
        <AccSection
          sectionKey="pl"
          title="Profit & Loss"
          open={openSection === 'pl'}
          onToggle={toggleSection}
        >
          <PLCardGrid pl={plData} />
        </AccSection>

        <AccSection
          sectionKey="bs"
          title="Balance Sheet"
          open={openSection === 'bs'}
          onToggle={toggleSection}
        >
          <BalanceSheetSection bs={bsData} />
        </AccSection>

        <AccSection
          sectionKey="tb"
          title="Trial Balance"
          open={openSection === 'tb'}
          onToggle={toggleSection}
        >
          <TrialBalanceGrid tb={tbData} />
        </AccSection>
      </ScrollView>

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
  errorBanner: {
    backgroundColor: '#FEF2F2', borderBottomWidth: 1, borderBottomColor: '#FECACA',
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  errorTxt: { fontSize: TYPOGRAPHY.xs, color: '#DC2626' },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
  },
  loadingTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
});
