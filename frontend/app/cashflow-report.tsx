import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ScrollViewInstance,
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Animated, RefreshControl,
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
import { formatLoadedAt } from '../src/components/CashflowCard';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
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

/** Same periods as Home; the API answers daily (7D, 1M), weekly (3M) or monthly (6M) points. */
const PERIODS: readonly DashboardPeriod[] = ['7D', '1M', '3M', '6M'];
type Period = DashboardPeriod;

// ── Segmented Bar ─────────────────────────────────────────────────────────────
function SegmentedBar({ value, maxValue, color, delay = 0 }: {
  value: number; maxValue: number; color: string; delay?: number;
}) {
  const pct    = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const target = Math.round(pct * SEG_COUNT);
  const [animFilled, setFilled] = useState(0);
  const [prevAnim, setPrevAnim] = useState<{ target: number; delay: number } | null>(null);
  if (Platform.OS !== 'web' && (!prevAnim || prevAnim.target !== target || prevAnim.delay !== delay)) {
    setPrevAnim({ target, delay });
    setFilled(0);
  }
  const filled = Platform.OS === 'web' ? target : animFilled;

  useEffect(() => {
    if (Platform.OS === 'web') return;
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

// ── Trend Chart (one income + expense pair per API series point) ─────────────
type TrendPoint = { date: string; label: string; inflow: number; outflow: number };

const CHART_H = 96;
/** Narrowest slot a point gets; below this the chart scrolls sideways instead. */
const MIN_SLOT = 10;
/** Width one x-axis label needs — decides how many points carry a label. */
const LABEL_W = 44;

function TrendChart({ points }: { points: TrendPoint[] }) {
  const [width, setWidth] = useState(0);
  const grow = useState(() => new Animated.Value(0))[0];
  const scrollRef = useRef<ScrollViewInstance>(null);
  const signature = points.map((p) => `${p.date}:${p.inflow}:${p.outflow}`).join('|');

  useEffect(() => {
    grow.setValue(0);
    const anim = Animated.timing(grow, {
      toValue: 1,
      duration: 550,
      useNativeDriver: false, // height cannot use native driver
    });
    anim.start();
    return () => anim.stop();
  }, [signature, grow]);

  const n = Math.max(points.length, 1);
  const maxVal = Math.max(1, ...points.map((p) => Math.max(p.inflow, p.outflow)));
  const slot = width > 0 ? Math.max(MIN_SLOT, width / n) : MIN_SLOT;
  const contentW = Math.max(width, slot * n);
  const barW = Math.max(2, Math.min(10, Math.floor((slot - 4) / 2)));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(contentW / LABEL_W))));
  const barHeight = (v: number) => (v > 0 ? Math.max(2, (v / maxVal) * CHART_H) : 0);

  const body = (
    <View style={{ width: contentW }}>
      <View style={[ch.plot, { height: CHART_H }]}>
        {points.map((p, i) => (
          <View key={`${p.date}-${i}`} style={[ch.slot, { width: slot }]}>
            <Animated.View
              style={[ch.bar, {
                width: barW,
                backgroundColor: COLORS.positive,
                height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, barHeight(p.inflow)] }),
              }]}
            />
            <Animated.View
              style={[ch.bar, {
                width: barW,
                backgroundColor: COLORS.negative,
                height: grow.interpolate({ inputRange: [0, 1], outputRange: [0, barHeight(p.outflow)] }),
              }]}
            />
          </View>
        ))}
      </View>
      <View style={ch.axis}>
        {points.map((p, i) => {
          if (i % labelEvery !== 0) return null;
          const left = Math.min(Math.max(0, i * slot + slot / 2 - LABEL_W / 2), Math.max(0, contentW - LABEL_W));
          return (
            <Text key={`${p.date}-${i}`} numberOfLines={1} style={[ch.label, { left }]}>{p.label}</Text>
          );
        })}
      </View>
    </View>
  );

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width === 0 ? null : contentW > width + 1 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {body}
        </ScrollView>
      ) : body}
    </View>
  );
}

const ch = StyleSheet.create({
  plot:  { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  slot:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1 },
  bar:   { borderRadius: 0 },
  axis:  { height: 14, marginTop: 5 },
  label: {
    position: 'absolute', top: 0, width: LABEL_W, textAlign: 'center',
    fontSize: 9, color: COLORS.textTertiary, fontWeight: '500',
  },
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
  const { t } = useTranslation();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;
  const { formatAmountCompact, formatAmount } = useSettings();
  const fmt = (v: number) => formatAmountCompact(Math.round(v));
  const fmtFull = (v: number) => formatAmount(Math.round(v));

  const [period, setPeriod] = useState<Period>('7D');
  const [periodReady, setPeriodReady] = useState(false);
  const [cf, setCf] = useState<any>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /** Bumped per request — a response to an older period / company is dropped. */
  const requestGenRef = useRef(0);

  const readStoredPeriod = useCallback(() => {
    return AsyncStorage.getItem(CASHFLOW_PERIOD_KEY)
      .then((saved) => {
        if (isSyncPeriod(saved)) setPeriod(saved);
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    readStoredPeriod().finally(() => setPeriodReady(true));
  }, [readStoredPeriod]);

  useFocusEffect(useCallback(() => {
    readStoredPeriod();
  }, [readStoredPeriod]));

  const fyStart = selectedFY?.startDate;
  const fyEnd = selectedFY?.endDate;

  const fetchCashflow = useCallback(() => {
    if (!companyGuid || !periodReady) return;
    const gen = ++requestGenRef.current;
    Promise.resolve()
      .then(() => {
        const { from, to } = resolvePeriodDates(period, { from: fyStart, to: fyEnd });
        return getCashflow(companyGuid, period, from, to);
      })
      .then((data) => {
        if (gen !== requestGenRef.current) return;
        setCf(data);
        setLoadedAt(new Date());
        setApiError(null);
      })
      .catch((err: any) => {
        if (gen !== requestGenRef.current) return;
        setApiError(err?.message || i18n.t('screens.cashflowReport.loadFailed'));
      })
      .finally(() => {
        if (gen !== requestGenRef.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [companyGuid, period, periodReady, fyStart, fyEnd]);

  const load = useCallback(() => {
    if (!companyGuid || !periodReady) return;
    setLoading(true);
    setApiError(null);
    fetchCashflow();
  }, [companyGuid, periodReady, fetchCashflow]);

  const onRefresh = useCallback(() => {
    if (!companyGuid || !periodReady) return;
    setRefreshing(true);
    fetchCashflow();
  }, [companyGuid, periodReady, fetchCashflow]);

  const [loadKey, setLoadKey] = useState({ companyGuid, period, periodReady, fyStart, fyEnd });
  if (
    loadKey.companyGuid !== companyGuid || loadKey.period !== period || loadKey.periodReady !== periodReady
    || loadKey.fyStart !== fyStart || loadKey.fyEnd !== fyEnd
  ) {
    setLoadKey({ companyGuid, period, periodReady, fyStart, fyEnd });
    if (companyGuid && periodReady) {
      setLoading(true);
      setApiError(null);
    }
  }

  // A finished Tally sync bumps lastSyncAt: refetch in place, keeping the figures on screen.
  useEffect(() => { fetchCashflow(); }, [fetchCashflow, lastSyncAt]);

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

  const series: TrendPoint[] = (Array.isArray(cf?.series) ? cf.series : []).map((p: any) => ({
    date: String(p?.date ?? ''),
    label: String(p?.label || p?.date || ''),
    inflow: Math.abs(Number(p?.inflow) || 0),
    outflow: Math.abs(Number(p?.outflow) || 0),
  }));
  // An API without series still gets one income / expense pair for the whole period.
  const trendPoints: TrendPoint[] = series.length
    ? series
    : (income || expense) ? [{ date: period, label: period, inflow: income, outflow: expense }] : [];
  const hasMovement = trendPoints.some((p) => p.inflow > 0 || p.outflow > 0);
  const trendTitle = cf?.interval === 'month'
    ? t('screens.cashflowReport.monthlyTrend')
    : cf?.interval === 'week'
      ? t('screens.cashflowReport.weeklyTrend')
      : t('screens.cashflowReport.dailyTrend');

  if (loading && !cf) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('screens.cashflowReport.title')}</Text>
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
        <Text style={s.headerTitle} numberOfLines={1}>{t('screens.cashflowReport.title')}</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {/* ── Net Cash Hero ── */}
        <View style={s.heroCard}>
          <View style={s.heroRow}>
            <View>
              <Text style={s.heroLabel}>{t('dashboard.netCash')}</Text>
              <Text style={s.heroValue}>₹{netCash.toLocaleString('en-IN')}</Text>
              {loadedAt ? (
                <Text style={s.heroSub}>{t('screens.cashflowReport.updated', { time: formatLoadedAt(loadedAt) })}</Text>
              ) : null}
            </View>
            <View style={[s.statusPill, { backgroundColor: isHealthy ? COLORS.positiveBg : COLORS.negativeBg }]}>
              <Ionicons
                name={isHealthy ? 'trending-up-outline' : 'trending-down-outline'}
                size={15}
                color={isHealthy ? COLORS.positive : COLORS.negative}
              />
              <Text style={[s.statusTxt, { color: isHealthy ? COLORS.positive : COLORS.negative }]}>
                {isHealthy ? '+' : ''}{incomePct}%{'  '}{isHealthy ? t('dashboard.healthy') : t('dashboard.watch')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Income / Expense Bars ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('screens.cashflowReport.incomeVsExpense')}</Text>

          {/* Income */}
          <View style={s.barRow}>
            <View style={s.barMeta}>
              <Ionicons name="arrow-up-circle-outline" size={16} color={COLORS.positive} />
              <Text style={s.barLabel}>{t('dashboard.income')}</Text>
            </View>
            <SegmentedBar value={income} maxValue={maxVal} color={COLORS.positive} delay={80} />
            <View style={s.barRight}>
              <Text style={s.barAmt}>{fmt(income)}</Text>
              <View style={s.pctChip}>
                <Text style={s.pctTxt}>{incomePct}%</Text>
              </View>
            </View>
          </View>
          <Text style={s.barSubtxt}>{t('screens.cashflowReport.inflowsNet', { amount: fmt(income - expense) })}</Text>

          <View style={s.sep} />

          {/* Expense */}
          <View style={s.barRow}>
            <View style={s.barMeta}>
              <Ionicons name="arrow-down-circle-outline" size={16} color={COLORS.negative} />
              <Text style={s.barLabel}>{t('dashboard.expense')}</Text>
            </View>
            <SegmentedBar value={expense} maxValue={maxVal} color={COLORS.negative} delay={360} />
            <View style={s.barRight}>
              <Text style={s.barAmt}>{fmt(expense)}</Text>
            </View>
          </View>
          <Text style={s.barSubtxt}>{t('screens.cashflowReport.outflows')}</Text>
        </View>

        {/* ── Trend Chart ── */}
        <View style={s.card}>
          <View style={s.chartHeader}>
            <Text style={s.sectionTitle}>{trendTitle}</Text>
            <View style={s.legend}>
              <View style={[s.legendDot, { backgroundColor: COLORS.positive }]} />
              <Text style={s.legendTxt}>{t('dashboard.income')}</Text>
              <View style={[s.legendDot, { backgroundColor: COLORS.negative, marginLeft: 10 }]} />
              <Text style={s.legendTxt}>{t('dashboard.expense')}</Text>
            </View>
          </View>
          {hasMovement ? (
            <TrendChart points={trendPoints} />
          ) : (
            <Text style={s.chartEmpty}>{t('screens.cashflowReport.noMovement')}</Text>
          )}
        </View>

        {/* ── Metrics Grid ── */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>{t('screens.cashflowReport.keyMetrics')}</Text>
          <View style={s.metricsGrid}>
            <MetricCard label={t('screens.cashflowReport.totalIncome')}  value={fmt(income)}  valueColor={COLORS.positive} />
            <MetricCard label={t('screens.cashflowReport.totalExpense')} value={fmt(expense)} valueColor={COLORS.negative} />
          </View>
          <View style={[s.metricsGrid, { marginTop: SPACING.sm }]}>
            <MetricCard
              label={t('dashboard.grossProfit')}
              value={fmtFull(Number(cf?.grossProfit ?? 0))}
              valueColor={Number(cf?.grossProfit ?? 0) >= 0 ? COLORS.positive : COLORS.negative}
            />
            <MetricCard
              label={t('dashboard.netProfit')}
              value={fmtFull(Number(cf?.netProfit ?? 0))}
              valueColor={Number(cf?.netProfit ?? 0) >= 0 ? COLORS.positive : COLORS.negative}
            />
          </View>
          <View style={[s.metricsGrid, { marginTop: SPACING.sm }]}>
            <MetricCard
              label={t('screens.cashflowReport.gpVsSales')}
              value={`${Number(cf?.grossProfitVsSalesPct ?? incomePct)}%`}
              valueColor={Number(cf?.grossProfitVsSalesPct ?? incomePct) >= 0 ? COLORS.positive : COLORS.negative}
            />
            <MetricCard label={t('nav.sales')} value={fmt(Number(cf?.sales ?? 0))} />
          </View>
          <View style={[s.metricsGrid, { marginTop: SPACING.sm }]}>
            <MetricCard label={t('screens.cashflowReport.grossCash')} value={fmt(Number(cf?.grossCash ?? netCash))} />
            <MetricCard label={t('screens.cashflowReport.netRealisable')} value={fmt(Number(cf?.netRealisableBalance ?? netCash))} />
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
    paddingHorizontal: 8, paddingVertical: 5,
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
  chartEmpty: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', paddingVertical: SPACING.lg },

  // Metrics
  metricsGrid: { flexDirection: 'row', gap: SPACING.sm },
});
