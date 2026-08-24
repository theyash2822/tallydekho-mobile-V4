import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { useAuth } from '../src/context/AuthContext';
import { useSettings } from '../src/context/SettingsContext';
import { getCashflow } from '../src/services/api';
import { ErrorBanner } from '../src/components/ApiStateViews';
import {
  CASHFLOW_PERIOD_KEY,
  isSyncPeriod,
  resolvePeriodDates,
  type DashboardPeriod,
} from '../src/utils/periodDates';

const SEG_COUNT  = 24;
const SEG_GAP    = 3;
const BAR_H      = 14;
const ANIM_MS    = 950;

const PERIODS = ['7D', '1M', '3M'] as const;
type Period = typeof PERIODS[number];

// ── Segmented Bar ─────────────────────────────────────────────────────────────
function SegmentedBar({ value, maxValue, color, delay = 0 }: {
  value: number; maxValue: number; color: string; delay?: number;
}) {
  const pct    = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const target = Math.round(pct * SEG_COUNT);
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') { setFilled(target); return; }
    setFilled(0);
    if (target === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < target; i++) {
      timers.push(setTimeout(() => setFilled(i + 1), delay + Math.round((i / target) * ANIM_MS)));
    }
    return () => timers.forEach(clearTimeout);
  }, [target, delay]);

  return (
    <View style={b.row}>
      {Array.from({ length: SEG_COUNT }, (_, i) => (
        <View
          key={i}
          style={[b.seg, { backgroundColor: i < filled ? color : COLORS.borderDefault }]}
        />
      ))}
    </View>
  );
}

const b = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: SEG_GAP, height: BAR_H, alignItems: 'stretch' },
  seg: { flex: 1, height: BAR_H, borderRadius: 0 },
});

// ── Mini Day/Period Chart ─────────────────────────────────────────────────────
function AnimatedBar({ target, color, delay = 0 }: {
  target: number; color: string; delay?: number;
}) {
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    h.setValue(0);
    const anim = Animated.timing(h, {
      toValue: target,
      duration: 550,
      delay,
      useNativeDriver: false, // height cannot use native driver
    });
    anim.start();
    return () => anim.stop();
  }, [target, delay]);
  return <Animated.View style={[ch.bar, { height: h, backgroundColor: color }]} />;
}

function TrendChart({ days, maxVal }: {
  days: { label: string; income: number; expense: number }[];
  maxVal: number;
}) {
  const CHART_H = 72;
  return (
    <View style={ch.wrap}>
      {days.map((d, i) => {
        const inH = Math.max(3, (d.income / maxVal) * CHART_H);
        const exH = Math.max(3, (d.expense / maxVal) * CHART_H);
        return (
          <View key={i} style={ch.col}>
            <View style={[ch.bars, { height: CHART_H }]}>
              <AnimatedBar target={inH} color={COLORS.positive} delay={i * 60} />
              <AnimatedBar target={exH} color={COLORS.negative} delay={i * 60 + 40} />
            </View>
            <Text style={ch.label}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ch = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col:  { flex: 1, alignItems: 'center', gap: 5 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, width: '100%', justifyContent: 'center' },
  bar:  { width: 7, borderRadius: 0 },
  label:{ fontSize: 9, color: COLORS.textTertiary, fontWeight: '500' },
});

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, valueColor }: {
  label: string; value: string; valueColor?: string;
}) {
  return (
    <View style={mc.card}>
      <Text style={mc.label}>{label}</Text>
      <Text style={[mc.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    padding: SPACING.sm + 2, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  label: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 5, fontWeight: '500' },
  value: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CashflowReportScreen() {
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const { formatAmountCompact } = useSettings();
  const fmt = (v: number) => formatAmountCompact(Math.round(v));

  const [period, setPeriod] = useState<Period>('7D');
  const [periodReady, setPeriodReady] = useState(false);
  const [cf, setCf] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const readStoredPeriod = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(CASHFLOW_PERIOD_KEY);
      if (saved && (PERIODS as readonly string[]).includes(saved)) {
        setPeriod(saved as Period);
      } else if (isSyncPeriod(saved) && saved === '6M') {
        setPeriod('3M');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    readStoredPeriod().finally(() => setPeriodReady(true));
  }, [readStoredPeriod]);

  useFocusEffect(useCallback(() => {
    readStoredPeriod();
  }, [readStoredPeriod]));

  const load = useCallback(async () => {
    if (!companyGuid || !periodReady) return;
    setLoading(true);
    setApiError(null);
    try {
      const { from, to } = resolvePeriodDates(period as DashboardPeriod, {
        from: selectedFY?.startDate,
        to: selectedFY?.endDate,
      });
      const data = await getCashflow(companyGuid, period, from, to);
      setCf(data);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load cashflow');
    } finally {
      setLoading(false);
    }
  }, [companyGuid, period, periodReady, selectedFY?.startDate, selectedFY?.endDate]);

  useEffect(() => { load(); }, [load]);

  const changePeriod = (p: Period) => {
    setPeriod(p);
    AsyncStorage.setItem(CASHFLOW_PERIOD_KEY, p).catch(() => {});
  };

  const income = Number(cf?.totalIncome ?? 0);
  const expense = Number(cf?.totalExpense ?? 0);
  const netCash = Number(cf?.netCash ?? 0);
  const incomePct = Number(cf?.incomePercentage ?? 0);
  const maxVal = Math.max(income, expense, 1);
  const isHealthy = netCash >= 0;
  const days = [{ label: period, income, expense }];
  const maxDayVal = Math.max(income, expense, 1);

  if (loading && !cf) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Cashflow Report</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {apiError && <ErrorBanner message={apiError} onRetry={load} />}
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cashflow Report</Text>
        {/* Period Chips */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodChip, period === p && s.periodChipActive]}
              onPress={() => changePeriod(p)}
              activeOpacity={0.7}
            >
              <Text style={[s.periodTxt, period === p && s.periodTxtActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Net Cash Hero ── */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View>
              <Text style={s.heroLabel}>Net Cash</Text>
              <Text style={s.heroValue}>₹{netCash.toLocaleString('en-IN')}</Text>
              <Text style={s.heroSub}>Updated {cf?.updatedAt || 'just now'}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: isHealthy ? COLORS.positiveBg : COLORS.negativeBg }]}>
              <Ionicons
                name={isHealthy ? 'trending-up-outline' : 'trending-down-outline'}
                size={15}
                color={isHealthy ? COLORS.positive : COLORS.negative}
              />
              <Text style={[s.statusTxt, { color: isHealthy ? COLORS.positive : COLORS.negative }]}>
                {isHealthy ? '+' : ''}{incomePct}%{'  '}{isHealthy ? 'Healthy' : 'Watch'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Income / Expense Bars ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Income vs Expense</Text>

          {/* Income */}
          <View style={s.barRow}>
            <View style={s.barMeta}>
              <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.positive} />
              <Text style={s.barLabel}>Income</Text>
            </View>
            <SegmentedBar value={income} maxValue={maxVal} color={COLORS.positive} delay={80} />
            <View style={s.barRight}>
              <Text style={s.barAmt}>{fmt(income)}</Text>
              <View style={s.pctChip}>
                <Text style={s.pctTxt}>{incomePct}%</Text>
              </View>
            </View>
          </View>
          <Text style={s.barSubtxt}>Inflows · net {fmt(income - expense)}</Text>

          <View style={s.sep} />

          {/* Expense */}
          <View style={s.barRow}>
            <View style={s.barMeta}>
              <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.negative} />
              <Text style={s.barLabel}>Expense</Text>
            </View>
            <SegmentedBar value={expense} maxValue={maxVal} color={COLORS.negative} delay={360} />
            <View style={s.barRight}>
              <Text style={s.barAmt}>{fmt(expense)}</Text>
            </View>
          </View>
          <Text style={s.barSubtxt}>Outflows</Text>
        </View>

        {/* ── Trend Chart ── */}
        <View style={s.card}>
          <View style={s.chartHeader}>
            <Text style={s.sectionTitle}>Daily Trend</Text>
            <View style={s.legend}>
              <View style={[s.legendDot, { backgroundColor: COLORS.positive }]} />
              <Text style={s.legendTxt}>Income</Text>
              <View style={[s.legendDot, { backgroundColor: COLORS.negative, marginLeft: 10 }]} />
              <Text style={s.legendTxt}>Expense</Text>
            </View>
          </View>
          <TrendChart key={period} days={days} maxVal={maxDayVal} />
        </View>

        {/* ── Metrics Grid ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Key Metrics</Text>
          <View style={s.metricsGrid}>
            <MetricCard label="Total Income"  value={fmt(income)}  valueColor={COLORS.positive} />
            <MetricCard label="Total Expense" value={fmt(expense)} valueColor={COLORS.negative} />
          </View>
          <View style={[s.metricsGrid, { marginTop: SPACING.sm }]}>
            <MetricCard
              label="Gross Profit"
              value={fmt(Number(cf?.grossProfit ?? 0))}
              valueColor={Number(cf?.grossProfit ?? 0) >= 0 ? COLORS.positive : COLORS.negative}
            />
            <MetricCard
              label="Net Profit"
              value={fmt(Number(cf?.netProfit ?? 0))}
              valueColor={Number(cf?.netProfit ?? 0) >= 0 ? COLORS.positive : COLORS.negative}
            />
          </View>
          <View style={[s.metricsGrid, { marginTop: SPACING.sm }]}>
            <MetricCard
              label="Gross Profit vs Sales"
              value={`${Number(cf?.grossProfitVsSalesPct ?? incomePct)}%`}
              valueColor={Number(cf?.grossProfitVsSalesPct ?? incomePct) >= 0 ? COLORS.positive : COLORS.negative}
            />
            <MetricCard label="Sales" value={fmt(Number(cf?.sales ?? 0))} />
          </View>
          <View style={[s.metricsGrid, { marginTop: SPACING.sm }]}>
            <MetricCard label="Gross Cash"     value={fmt(Number(cf?.grossCash ?? netCash))} />
            <MetricCard label="Net Realisable" value={fmt(Number(cf?.netRealisableBalance ?? netCash))} />
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  headerTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },
  periodRow: { flexDirection: 'row', gap: 4 },
  periodChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  periodChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  periodTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: COLORS.white, fontWeight: '700' },

  // Scroll
  scroll: { padding: SPACING.md, gap: SPACING.sm },

  // Hero card
  heroCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary,
    marginBottom: 4, fontWeight: '500',
  },
  heroValue: {
    fontSize: 28, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: -1,
  },
  heroSub: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full,
  },
  statusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // Section card
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700',
    color: COLORS.textPrimary, marginBottom: SPACING.sm + 2,
    letterSpacing: 0.1,
  },
  sep: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  // Bars
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 78 },
  barLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 88, justifyContent: 'flex-end' },
  barAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  barSubtxt: { fontSize: 10, color: COLORS.textTertiary, marginTop: 5, marginLeft: 88, fontWeight: '500' },
  pctChip: {
    backgroundColor: COLORS.positiveBg, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.positive + '30',
  },
  pctTxt: { fontSize: 10, fontWeight: '800', color: COLORS.positive },

  // Chart
  chartHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: SPACING.sm + 2,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 0 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },

  // Metrics
  metricsGrid: { flexDirection: 'row', gap: SPACING.sm },
});
