import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { getFullFinancialReport } from '../../src/services/api';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { CardSkeleton } from '../../src/components/ShimmerPlaceholder';

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
  const { t } = useTranslation();
  // STRICT PRODUCTION DATA RULE: show real data or zeros. NEVER mock.
  // pl is null while loading or if API failed — show empty state.
  if (!pl) {
    return (
      <View style={plg.grid}>
        <View style={plg.demoBanner}>
          <Text style={plg.demoTxt}>{t('screens.reportsFinancial.noDataPl')}</Text>
        </View>
      </View>
    );
  }

  const rows = [
    { left: t('screens.reportsFinancial.openingStock'),   leftAmt: pl.openingStock    ?? 0, right: t('screens.reportsFinancial.closingStock'),    rightAmt: pl.closingStock    ?? 0 },
    { left: t('screens.reportsFinancial.purchase'),        leftAmt: pl.purchase        ?? 0, right: t('screens.reportsFinancial.sales'),            rightAmt: pl.sales           ?? 0 },
    { left: t('screens.reportsFinancial.directExpense'),  leftAmt: pl.directExpenses  ?? 0, right: t('screens.reportsFinancial.indirectExpense'), rightAmt: pl.indirectExpenses ?? 0 },
    { left: t('screens.reportsFinancial.indirectIncome'), leftAmt: pl.indirectIncome  ?? 0, right: t('screens.reportsFinancial.directIncome'),    rightAmt: pl.directIncome    ?? 0 },
    { left: t('screens.reportsFinancial.grossProfit'),    leftAmt: pl.grossProfit     ?? 0, right: t('screens.reportsFinancial.grossLoss'),       rightAmt: pl.grossLoss       ?? 0 },
    { left: t('screens.reportsFinancial.netProfit'),      leftAmt: pl.netProfit       ?? 0, right: t('screens.reportsFinancial.netLoss'),         rightAmt: pl.netLoss         ?? 0 },
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
  const { t } = useTranslation();
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
        {(['liability', 'assets'] as const).map(k => (
          <TouchableOpacity
            key={k}
            style={[bss.tab, tab === k && bss.tabActive]}
            onPress={() => setTab(k)}
            activeOpacity={0.7}
          >
            <Text style={[bss.tabTxt, tab === k && bss.tabTxtActive]}>
              {k === 'liability' ? t('screens.reportsFinancial.liability') : t('screens.reportsFinancial.assets')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={bss.table}>
        {tab === 'liability' ? (
          <>
            {/* 3-column liability table: Particular | Opening | Current */}
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2.5 }]}>{t('screens.reportsFinancial.particular')}</Text>
              <Text style={[bss.cell, bss.amtHdrTxt, bss.right, { flex: 1.5 }]}>{t('screens.reportsFinancial.opening')}</Text>
              <Text style={[bss.cell, bss.amtHdrTxt, bss.right, { flex: 1.5 }]}>{t('screens.reportsFinancial.current')}</Text>
            </View>
            {liabilities.length === 0 && (
              <View style={bss.tableRow}>
                <Text style={[bss.cell, { color: '#AEACA8', textAlign: 'center', flex: 1 }]}>{t('screens.reportsFinancial.noData')}</Text>
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
              <Text style={[bss.cell, bss.totalName, { flex: 2.5 }]}>{t('screens.reportsFinancial.totalLiabilities')}</Text>
              <Text style={[bss.cell, bss.totalVal, bss.right, { flex: 3 }]}>
                {fmtInr(totalLiab)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={[bss.tableRow, bss.hdrRow]}>
              <Text style={[bss.cell, bss.hdrTxt, { flex: 2 }]}>{t('screens.reportsFinancial.asset')}</Text>
              <Text style={[bss.cell, bss.hdrTxt, bss.right, { flex: 1 }]}>{t('screens.reportsFinancial.amountInr')}</Text>
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
              <Text style={[bss.cell, bss.totalName, { flex: 2 }]}>{t('screens.reportsFinancial.totalAssets')}</Text>
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

// Each row: name on left, Dr amount (red) + Cr amount (green) stacked on right
function TbRow({ name, debit, credit, isTotal = false, alt = false }: {
  name: string; debit: number; credit: number; isTotal?: boolean; alt?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View style={[tbg.row, alt && tbg.rowAlt, isTotal && tbg.totalRow]}>
      <Text style={[tbg.name, isTotal && tbg.totalName]} numberOfLines={2}>{name}</Text>
      <View style={tbg.amts}>
        {debit > 0.01 && (
          <Text style={[tbg.drLine, isTotal && tbg.totalAmt]}>
            {fmtTb(debit)} <Text style={tbg.drTag}>{t('screens.reportsFinancial.dr')}</Text>
          </Text>
        )}
        {credit > 0.01 && (
          <Text style={[tbg.crLine, isTotal && tbg.totalAmt]}>
            {fmtTb(credit)} <Text style={tbg.crTag}>{t('screens.reportsFinancial.cr')}</Text>
          </Text>
        )}
        {debit < 0.01 && credit < 0.01 && (
          <Text style={tbg.dashTxt}>—</Text>
        )}
      </View>
    </View>
  );
}

function TrialBalanceGrid({ tb }: { tb?: any }) {
  const { t } = useTranslation();
  const ledgers: any[] = tb?.ledgers || [];

  if (ledgers.length === 0) {
    return (
      <View style={tbg.container}>
        <Text style={tbg.emptyTxt}>{t('screens.reportsFinancial.noData')}</Text>
      </View>
    );
  }

  const totalDebit  = tb?.totalDebit  ?? 0;
  const totalCredit = tb?.totalCredit ?? 0;
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 1;

  return (
    <View style={tbg.container}>
      {ledgers.map((l: any, i: number) => (
        <TbRow key={i} name={l.name.trim()} debit={l.debit} credit={l.credit} alt={i % 2 !== 0} />
      ))}

      {/* Grand Total */}
      <TbRow name={t('screens.reportsFinancial.grandTotal')} debit={totalDebit} credit={totalCredit} isTotal />

      {/* Imbalance warning — only if data issue */}
      {!isBalanced && (
        <View style={tbg.imbalanceRow}>
          <Text style={tbg.imbalanceTxt}>
            {t('screens.reportsFinancial.difference', { amount: Math.abs(totalDebit - totalCredit).toLocaleString('en-IN', { maximumFractionDigits: 2 }) })}
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
  const { t } = useTranslation();
  const router = useRouter();
  const { company: selectedCompany, selectedFY, lastSyncAt } = useAuth();
  const { formatDate } = useSettings();

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

  const fromDate = customFrom ?? fyStartISO;
  const toDate   = customTo   ?? fyEndISO;

  const [showDateSheet, setShowDateSheet] = useState(false);

  // When FY changes → clear custom range so next fetch uses full FY
  // startDate always changes on FY switch (finYear was unreliable)
  const [prevFyStart, setPrevFyStart] = useState(selectedFY?.startDate);
  if (prevFyStart !== selectedFY?.startDate) {
    setPrevFyStart(selectedFY?.startDate);
    setCustomFrom(null);
    setCustomTo(null);
  }

  const [loading, setLoading] = useState(true);
  const [plData, setPlData]   = useState<any>(null);
  const [bsData, setBsData]   = useState<any>(null);
  const [tbData, setTbData]   = useState<any>(null);
  const [error,  setError]    = useState<string | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const hasReportRef = useRef(false);
  const requestGenRef = useRef(0);

  // Resolve FY param — finYear (e.g. '2025-2026') or derived from startDate
  const fyParam = fyInfoToParam(selectedFY) ?? selectedFY?.finYear;
  const companyGuid = selectedCompany?.guid;

  // Core fetch — soft when report already showing (no spinner wipe)
  const fetchReport = useCallback((opts?: { soft?: boolean }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasReportRef.current;
    if (!soft) setLoading(true);
    setError(null);
    const gen = ++requestGenRef.current;
    getFullFinancialReport(
      companyGuid,
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
        if (d?.pl || d?.bs || d?.trialBalance) {
          hasReportRef.current = true;
          setHasReport(true);
        }
      })
      .catch((err: any) => {
        if (gen !== requestGenRef.current) return;
        setError(err?.message || t('screens.reportsFinancial.loadFailed'));
      })
      .finally(() => {
        if (gen === requestGenRef.current) setLoading(false);
      });
  }, [companyGuid, fyParam, customFrom, customTo, t]);

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
        <Text style={s.headerTitle}>{t('screens.reportsFinancial.title')}</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDateSheet(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Date range strip ── */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDateSheet(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={COLORS.textTertiary} />
        <Text style={s.dateStripTxt}>{formatDate(fromDate)}{'  →  '}{formatDate(toDate)}</Text>
        <Ionicons name="chevron-down" size={13} color={COLORS.textTertiary} />
      </TouchableOpacity>

      {/* ── Error banner ── */}
      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorTxt}>⚠️ {error}</Text>
        </View>
      )}

      {/* ── Loading (first paint only) — soft refresh keeps prior numbers ── */}
      {loading && !hasReport ? (
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
          title={t('screens.reportsFinancial.profitLoss')}
          open={openSection === 'pl'}
          onToggle={toggleSection}
        >
          <PLCardGrid pl={plData} />
        </AccSection>

        <AccSection
          sectionKey="bs"
          title={t('screens.reportsFinancial.balanceSheet')}
          open={openSection === 'bs'}
          onToggle={toggleSection}
        >
          <BalanceSheetSection bs={bsData} />
        </AccSection>

        <AccSection
          sectionKey="tb"
          title={t('screens.reportsFinancial.trialBalance')}
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
        minDate={fyStartISO}
        maxDate={fyEndISO}
        onApply={(from, to) => {
          if (from && to) {
            setCustomFrom(from);
            setCustomTo(to);
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
