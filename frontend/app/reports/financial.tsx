import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { fmtDMY } from '../../src/components/DateRangePickerModal';
import { getFullFinancialReport } from '../../src/services/api';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { CardSkeleton } from '../../src/components/ShimmerPlaceholder';

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
  // STRICT PRODUCTION DATA RULE: show real data or zeros. NEVER mock.
  // pl is null while loading or if API failed — show empty state.
  if (!pl) {
    return (
      <View style={plg.grid}>
        <View style={plg.demoBanner}>
          <Text style={plg.demoTxt}>No data — sync Tally to load P&amp;L</Text>
        </View>
      </View>
    );
  }

  const rows = [
    { left: 'Opening Stock',   leftAmt: pl.openingStock    ?? 0, right: 'Closing Stock',    rightAmt: pl.closingStock    ?? 0 },
    { left: 'Purchase',        leftAmt: pl.purchase        ?? 0, right: 'Sales',            rightAmt: pl.sales           ?? 0 },
    { left: 'Direct Expense',  leftAmt: pl.directExpenses  ?? 0, right: 'Indirect Expense', rightAmt: pl.indirectExpenses ?? 0 },
    { left: 'Indirect Income', leftAmt: pl.indirectIncome  ?? 0, right: 'Direct Income',    rightAmt: pl.directIncome    ?? 0 },
    { left: 'Gross Profit',    leftAmt: pl.grossProfit     ?? 0, right: 'Gross Loss',       rightAmt: pl.grossLoss       ?? 0 },
    { left: 'Net Profit',      leftAmt: pl.netProfit       ?? 0, right: 'Net Loss',         rightAmt: pl.netLoss         ?? 0 },
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

  // Real data from API — group-level totals matching Tally BS format
  const liabilities = (bs?.liabilities || []).map((l: any) => ({
    name:    l.name,
    opening: Math.abs(parseFloat(l.opening ?? 0)),
    current: Math.abs(parseFloat(l.amount  ?? 0)),
  }));
  const assets = (bs?.assets || []).map((l: any) => ({
    name:   l.name,
    amount: Math.abs(parseFloat(l.amount ?? 0)),
  }));
  const totalLiab   = Math.abs(bs?.totalLiabilities ?? 0);
  const totalAssets = Math.abs(bs?.totalAssets      ?? 0);

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
            {/* 3-column liability table: Particular | Opening | Current */}
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2.5 }]}>Particular</Text>
              <Text style={[bss.cell, bss.amtHdrTxt, bss.right, { flex: 1.5 }]}>Opening</Text>
              <Text style={[bss.cell, bss.amtHdrTxt, bss.right, { flex: 1.5 }]}>Current</Text>
            </View>
            {liabilities.length === 0 && (
              <View style={bss.tableRow}>
                <Text style={[bss.cell, { color: '#AEACA8', textAlign: 'center', flex: 1 }]}>No data — sync Tally to load</Text>
              </View>
            )}
            {liabilities.map((row: any, i: number) => (
              <View key={i} style={[bss.tableRow, i % 2 !== 0 && bss.altRow]}>
                <Text style={[bss.cell, bss.rowName, { flex: 2.5 }]} numberOfLines={2}>{row.name}</Text>
                <Text style={[bss.cell, bss.amtTxt, bss.right, { flex: 1.5 }]} numberOfLines={1}>
                  {row.opening > 0 ? fmtInr(row.opening) : '—'}
                </Text>
                <Text style={[bss.cell, bss.amtTxt, bss.right, { flex: 1.5 }]} numberOfLines={1}>
                  {fmtInr(row.current)}
                </Text>
              </View>
            ))}
            <View style={[bss.tableRow, bss.totalRow]}>
              <Text style={[bss.cell, bss.totalName, { flex: 2.5 }]}>Total Liabilities</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 3 }]}>
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
  amtHdrTxt: { fontSize: 9, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  rowName:   { color: COLORS.textPrimary, fontWeight: '500' },
  rowVal:    { color: COLORS.textPrimary, fontWeight: '600' },
  amtTxt:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600' },
  totalName: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  totalVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
});

// ══════════════════════════════════════════════════════════════════════════════
// Trial Balance — 2-line stacked rows (name on top, Dr / Cr side-by-side below)
// Full numbers always visible, no truncation, no horizontal scroll.
// ══════════════════════════════════════════════════════════════════════════════
function fmtTb(n: number): string {
  if (!n || n < 0.01) return '—';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TrialBalanceGrid({ tb }: { tb?: any }) {
  const ledgers: any[] = tb?.ledgers || [];

  if (ledgers.length === 0) {
    return (
      <View style={tbg.container}>
        <Text style={tbg.emptyTxt}>No data — sync Tally to load</Text>
      </View>
    );
  }

  const totalDebit  = tb?.totalDebit  ?? 0;
  const totalCredit = tb?.totalCredit ?? 0;
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 1;

  // Each row: name on left, Dr amount (red) + Cr amount (green) stacked on right
  const TbRow = ({ name, debit, credit, isTotal = false, alt = false }: {
    name: string; debit: number; credit: number; isTotal?: boolean; alt?: boolean;
  }) => (
    <View style={[tbg.row, alt && tbg.rowAlt, isTotal && tbg.totalRow]}>
      <Text style={[tbg.name, isTotal && tbg.totalName]} numberOfLines={2}>{name}</Text>
      <View style={tbg.amts}>
        {debit > 0.01 && (
          <Text style={[tbg.drLine, isTotal && tbg.totalAmt]}>
            {fmtTb(debit)} <Text style={tbg.drTag}>Dr</Text>
          </Text>
        )}
        {credit > 0.01 && (
          <Text style={[tbg.crLine, isTotal && tbg.totalAmt]}>
            {fmtTb(credit)} <Text style={tbg.crTag}>Cr</Text>
          </Text>
        )}
        {debit < 0.01 && credit < 0.01 && (
          <Text style={tbg.dashTxt}>—</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={tbg.container}>
      {ledgers.map((l: any, i: number) => (
        <TbRow key={i} name={l.name.trim()} debit={l.debit} credit={l.credit} alt={i % 2 !== 0} />
      ))}

      {/* Grand Total */}
      <TbRow name="Grand Total" debit={totalDebit} credit={totalCredit} isTotal />

      {/* Imbalance warning — only if data issue */}
      {!isBalanced && (
        <View style={tbg.imbalanceRow}>
          <Text style={tbg.imbalanceTxt}>
            ⚠️ Difference: ₹{Math.abs(totalDebit - totalCredit).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </Text>
        </View>
      )}
    </View>
  );
}

const tbg = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  emptyTxt: { color: '#AEACA8', textAlign: 'center', fontSize: TYPOGRAPHY.sm, padding: 16 },
  // Each list row — alternating white / cream (same as Balance Sheet)
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,       // even rows: white
  },
  rowAlt:   { backgroundColor: COLORS.pageBg },  // odd rows: cream
  totalRow: {
    backgroundColor: COLORS.activeBg,
    borderTopWidth: 2,
    borderTopColor: COLORS.borderDefault,
  },
  // Left: group name
  name: {
    flex: 1,
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '500',
    color: COLORS.textPrimary,
    paddingRight: 10,
    lineHeight: 20,
  },
  totalName: { fontWeight: '800' },
  // Right: amounts stacked
  amts: { alignItems: 'flex-end' },
  drLine: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,   // amount in black
    lineHeight: 20,
  },
  crLine: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,   // amount in black
    lineHeight: 20,
  },
  drTag: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#C0392B' },  // Dr tag red
  crTag: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#27AE60' },  // Cr tag green
  totalAmt: { fontWeight: '800', fontSize: TYPOGRAPHY.sm },
  dashTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  // Imbalance
  imbalanceRow: { backgroundColor: '#FFF3CD', paddingHorizontal: 12, paddingVertical: 8 },
  imbalanceTxt: { fontSize: TYPOGRAPHY.xs, color: '#856404', textAlign: 'center' },
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

  // FY boundaries — derived from selectedFY (dropdown), fallback to current FY
  const fyStartISO = selectedFY?.startDate ?? (() => {
    const today = new Date();
    const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${y}-04-01`;
  })();
  const fyEndISO = selectedFY?.endDate ?? (() => {
    const today = new Date();
    const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return `${y + 1}-03-31`;
  })();

  // Custom date range — null means "use full FY" (no custom selection)
  // Stored as ISO strings (YYYY-MM-DD)
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo,   setCustomTo]   = useState<string | null>(null);

  // Display dates for the date strip (DD/MM/YY format)
  const fromDate = fmtDMY(new Date((customFrom ?? fyStartISO) + 'T00:00:00'));
  const toDate   = fmtDMY(new Date((customTo   ?? fyEndISO)   + 'T00:00:00'));

  const [showDateSheet, setShowDateSheet] = useState(false);

  // When FY changes → clear custom range so next fetch uses full FY
  useEffect(() => {
    setCustomFrom(null);
    setCustomTo(null);
  }, [selectedFY?.startDate]);  // startDate always changes on FY switch (finYear was unreliable)

  const [loading, setLoading] = useState(true);
  const [plData, setPlData]   = useState<any>(null);
  const [bsData, setBsData]   = useState<any>(null);
  const [tbData, setTbData]   = useState<any>(null);
  const [error,  setError]    = useState<string | null>(null);
  const hasReportRef = useRef(false);
  const requestGenRef = useRef(0);

  // Convert DD/MM/YY display to ISO for API (only used for custom range)
  const toISO = (dmy: string): string => {
    const [d, m, y] = dmy.split('/');
    const fullYear = parseInt(y) < 50 ? `20${y}` : `19${y}`;
    return `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  };

  // Resolve FY param — finYear (e.g. '2025-2026') or derived from startDate
  const fyParam = fyInfoToParam(selectedFY) ?? selectedFY?.finYear;

  // Core fetch — soft when report already showing (no spinner wipe)
  const fetchReport = useCallback((opts?: { soft?: boolean }) => {
    if (!selectedCompany?.guid) return;
    const soft = opts?.soft ?? hasReportRef.current;
    if (!soft) setLoading(true);
    setError(null);
    const gen = ++requestGenRef.current;
    getFullFinancialReport(
      selectedCompany.guid,
      fyParam,
      customFrom ?? undefined,
      customTo   ?? undefined
    )
      .then((res: any) => {
        if (gen !== requestGenRef.current) return;
        const d = res?.data;
        if (d?.pl)           setPlData(d.pl);
        if (d?.bs)           setBsData(d.bs);
        if (d?.trialBalance) setTbData(d.trialBalance);
        if (d?.pl || d?.bs || d?.trialBalance) hasReportRef.current = true;
      })
      .catch((err: any) => {
        if (gen !== requestGenRef.current) return;
        setError(err?.message || 'Failed to load financial data');
      })
      .finally(() => {
        if (gen === requestGenRef.current) setLoading(false);
      });
  }, [selectedCompany?.guid, fyParam, customFrom, customTo]);

  // Single fetch path — drop duplicate useFocusEffect (Phase 3 hygiene)
  useEffect(() => {
    fetchReport({ soft: hasReportRef.current });
  }, [fetchReport, selectedFY?.startDate, lastSyncAt]);

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

      {/* ── Loading (first paint only) — soft refresh keeps prior numbers ── */}
      {loading && !hasReportRef.current ? (
        <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, flex: 1 }}>
          <CardSkeleton height={180} />
          <CardSkeleton height={140} />
          <CardSkeleton height={140} />
        </View>
      ) : (
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
      )}

      <DateRangePickerModal
        visible={showDateSheet}
        fromDate={fromDate}
        toDate={toDate}
        minDate={fyStartISO}  // constrain calendar to FY start
        maxDate={fyEndISO}    // constrain calendar to FY end
        onApply={(from, to) => {
          if (from && to) {
            // from/to from the picker are DD/MM/YY — convert to ISO for state
            const conv = (dmy: string) => {
              const [d, m, y] = dmy.split('/');
              const fullYear = parseInt(y) < 50 ? `20${y}` : `19${y}`;
              return `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
            };
            setCustomFrom(conv(from));
            setCustomTo(conv(to));
          }
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
