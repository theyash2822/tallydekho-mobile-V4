import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Rect, G, Text as SvgText, Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../src/context/AuthContext';
import { getAIInsights, getAIInsightsHistory } from '../../src/services/api';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER       = '#A89060';
const AMBER_LIGHT = '#D4BC94';
const AMBER_DARK  = '#6B5830';

// ─── Donut Helpers ────────────────────────────────────────────────────────────
function polarToCart(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function donutArc(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number) {
  const os  = polarToCart(cx, cy, outerR, startDeg);
  const oe  = polarToCart(cx, cy, outerR, endDeg);
  const ie  = polarToCart(cx, cy, innerR, endDeg);
  const is_ = polarToCart(cx, cy, innerR, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${os.x.toFixed(2)} ${os.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oe.x.toFixed(2)} ${oe.y.toFixed(2)}`,
    `L ${ie.x.toFixed(2)} ${ie.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${is_.x.toFixed(2)} ${is_.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// No mock data — real data only or empty state

// ─── Revenue Forecast Line Chart ──────────────────────────────────────────────
type ForecastPoint = { month: string; actual: number | null; forecast: number | null };
function ForecastLineChart({ data }: { data: ForecastPoint[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const MONTH_W = 70; const YAXIS_W = 40;
  const H = 155; const PAD_B = 26; const PAD_T = 38;
  const chartH = H - PAD_B - PAD_T;
  const niceMax = Math.ceil(Math.max(...data.map(d => d.forecast ?? 0)) / 5) * 5 || 20;
  const yTicks  = [0, Math.round(niceMax * 0.5), niceMax];
  const chartW  = data.length * MONTH_W;
  const xAt = (i: number) => i * MONTH_W + MONTH_W / 2;
  const yAt = (v: number) => PAD_T + chartH - (v / niceMax) * chartH;

  // Actual path segments (skip null values)
  const actualPath = data.reduce<string[]>((acc, d, i) => {
    if (d.actual === null) return acc;
    const prevHasActual = i > 0 && data[i - 1].actual !== null;
    acc.push(`${prevHasActual ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(d.actual).toFixed(1)}`);
    return acc;
  }, []).join(' ');

  // Forecast path (all points)
  const forecastPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d.forecast ?? 0).toFixed(1)}`)
    .join(' ');

  return (
    <View style={{ flexDirection: 'row', height: H }}>
      {/* Fixed Y-axis */}
      <Svg width={YAXIS_W} height={H}>
        <Rect x={YAXIS_W - 1} y={PAD_T - 6} width={1} height={chartH + 8} fill={COLORS.borderStrong} />
        {yTicks.map(tick => (
          <SvgText key={tick}
            x={YAXIS_W - 5} y={yAt(tick) + 4}
            textAnchor="end" fontSize={8} fill={COLORS.textTertiary}
          >
            {tick === 0 ? '0' : `₹${tick}L`}
          </SvgText>
        ))}
      </Svg>

      {/* Scrollable area */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ flex: 1 }}>
        <Svg width={chartW + 8} height={H}>
          {/* Guide lines */}
          {yTicks.map(tick => (
            <Rect key={tick} x={0} y={yAt(tick)} width={chartW} height={0.5}
              fill={COLORS.borderDefault} opacity={0.9}
            />
          ))}
          {/* Baseline */}
          <Rect x={0} y={PAD_T + chartH} width={chartW} height={1} fill={COLORS.borderStrong} />

          {/* Forecast zone shading */}
          {data.map((d, i) => (
            d.actual === null ? (
              <Rect key={`z-${i}`}
                x={i * MONTH_W} y={PAD_T}
                width={MONTH_W} height={chartH}
                fill={COLORS.borderDefault} opacity={0.22}
              />
            ) : null
          ))}

          {/* Forecast dashed line */}
          <Path d={forecastPath} stroke={COLORS.textPrimary} strokeWidth={1.5}
            fill="none" strokeDasharray="5,3" strokeLinecap="round"
          />

          {/* Actual solid line */}
          {actualPath ? (
            <Path d={actualPath} stroke={AMBER} strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          ) : null}

          {/* Interactive dots + labels */}
          {data.map((d, i) => {
            const isActual = d.actual !== null;
            const val      = isActual ? d.actual! : (d.forecast ?? 0);
            const x        = xAt(i);
            const y        = yAt(val);
            const isActive = activeIdx === i;
            return (
              <G key={i} onPress={() => setActiveIdx(isActive ? null : i)}>
                {/* Transparent touch zone */}
                <Rect x={i * MONTH_W} y={PAD_T} width={MONTH_W} height={chartH} fill="transparent" />
                {/* Dot */}
                <Circle cx={x} cy={y} r={isActive ? 7 : 4}
                  fill={isActual ? AMBER : COLORS.textPrimary}
                  stroke={COLORS.cardBg} strokeWidth={2}
                />
                {/* Tooltip */}
                {isActive ? (
                  <G>
                    <Rect x={Math.max(2, x - 30)} y={PAD_T - 30} width={60} height={24} rx={5}
                      fill={COLORS.textPrimary}
                    />
                    <SvgText x={x} y={PAD_T - 14} textAnchor="middle"
                      fontSize={10} fill="#FFFFFF" fontWeight="700"
                    >
                      {`\u20B9${val}L`}
                    </SvgText>
                  </G>
                ) : null}
                {/* Month label */}
                <SvgText x={x} y={H - 6} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>
                  {d.month}
                </SvgText>
                {/* AI label on forecast months */}
                {d.actual === null ? (
                  <SvgText x={x} y={H - 16} textAnchor="middle" fontSize={7}
                    fill={COLORS.textSecondary} opacity={0.55}
                  >
                    AI
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

// ─── Expense Spike Bar Chart ──────────────────────────────────────────────────
type ExpensePoint = { month: string; amount: number; isSpike: boolean };
function ExpenseSpikeChart({ data }: { data: ExpensePoint[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const YAXIS_W = 40; const BAR_W = 36; const GAP = 16;
  const H = 130; const PAD_B = 24; const PAD_T = 30;
  const chartH   = H - PAD_B - PAD_T;
  const niceMax  = Math.ceil(Math.max(...data.map(d => d.amount)) / 2) * 2 || 10;
  const yTicks   = [0, niceMax / 2, niceMax];
  const barAreaW = (BAR_W + GAP) * data.length;
  const yAt      = (v: number) => PAD_T + chartH - (v / niceMax) * chartH;

  return (
    <View style={{ flexDirection: 'row', height: H }}>
      <Svg width={YAXIS_W} height={H}>
        <Rect x={YAXIS_W - 1} y={PAD_T - 4} width={1} height={chartH + 6} fill={COLORS.borderStrong} />
        {yTicks.map(tick => (
          <SvgText key={tick}
            x={YAXIS_W - 5} y={yAt(tick) + 4}
            textAnchor="end" fontSize={8} fill={COLORS.textTertiary}
          >
            {tick === 0 ? '0' : `${tick}L`}
          </SvgText>
        ))}
      </Svg>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={{ flex: 1 }}>
        <Svg width={barAreaW + 8} height={H}>
          {yTicks.map(tick => (
            <Rect key={tick} x={0} y={yAt(tick)} width={barAreaW} height={0.5}
              fill={COLORS.borderDefault} opacity={0.9}
            />
          ))}
          <Rect x={0} y={PAD_T + chartH} width={barAreaW} height={1} fill={COLORS.borderStrong} />

          {data.map((d, i) => {
            const bh       = Math.max((d.amount / niceMax) * chartH, 3);
            const x        = i * (BAR_W + GAP);
            const y        = yAt(d.amount);
            const isActive = activeIdx === i;
            const fill     = d.isSpike
              ? (isActive ? '#991B1B' : '#DC2626')
              : (isActive ? COLORS.textPrimary : AMBER_LIGHT);

            return (
              <G key={i} onPress={() => setActiveIdx(isActive ? null : i)}>
                <Rect x={x} y={y} width={BAR_W} height={bh} rx={4} fill={fill} opacity={0.9} />
                {/* Spike triangle indicator */}
                {d.isSpike ? (
                  <SvgText x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={13} fill="#DC2626">
                    ▲
                  </SvgText>
                ) : null}
                {/* Tooltip */}
                {isActive ? (
                  <G>
                    <Rect x={Math.max(0, x - 4)} y={2} width={BAR_W + 8} height={24} rx={5}
                      fill={COLORS.textPrimary}
                    />
                    <SvgText x={x + BAR_W / 2} y={18} textAnchor="middle"
                      fontSize={10} fill="#FFFFFF" fontWeight="700"
                    >
                      {`\u20B9${d.amount}L`}
                    </SvgText>
                  </G>
                ) : null}
                <SvgText x={x + BAR_W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>
                  {d.month}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

// ─── Receivables Donut Chart ──────────────────────────────────────────────────
type DonutSegment = { label: string; pct: number; color: string };
function ReceivablesDonut({ segments }: { segments: DonutSegment[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const SIZE = 130; const cx = SIZE / 2; const cy = SIZE / 2;
  const outerR = 52; const innerR = 30;

  const total = segments.reduce((s, seg) => s + seg.pct, 0);
  let angle   = -90;
  const arcs  = segments.map((seg, i) => {
    const sweep = (seg.pct / total) * 360;
    const start = angle;
    const end   = angle + sweep - 1.5; // gap between segments
    angle += sweep;
    const r    = activeIdx === i ? outerR + 5 : outerR;
    const path = donutArc(cx, cy, r, innerR, start, end);
    return { ...seg, path, idx: i };
  });

  const activeSeg = activeIdx !== null ? segments[activeIdx] : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Svg width={SIZE} height={SIZE}>
        {arcs.map(arc => (
          <G key={arc.idx} onPress={() => setActiveIdx(activeIdx === arc.idx ? null : arc.idx)}>
            <Path d={arc.path} fill={arc.color} />
          </G>
        ))}
        {/* Center label */}
        {activeSeg ? (
          <G>
            <SvgText x={cx} y={cy - 6} textAnchor="middle"
              fontSize={18} fill={activeSeg.color} fontWeight="800"
            >
              {activeSeg.pct}%
            </SvgText>
            <SvgText x={cx} y={cy + 11} textAnchor="middle"
              fontSize={8} fill={COLORS.textSecondary}
            >
              {activeSeg.label}
            </SvgText>
          </G>
        ) : (
          <G>
            <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>
              Receivables
            </SvgText>
            <SvgText x={cx} y={cy + 11} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>
              Risk
            </SvgText>
          </G>
        )}
      </Svg>

      {/* Legend */}
      <View style={{ flex: 1, gap: 14 }}>
        {segments.map((seg, i) => (
          <TouchableOpacity
            key={i}
            style={dn.legendRow}
            onPress={() => setActiveIdx(activeIdx === i ? null : i)}
            activeOpacity={0.8}
          >
            <View style={[dn.dot, { backgroundColor: seg.color }]} />
            <Text style={dn.legendLabel}>{seg.label}</Text>
            <Text style={[dn.legendPct, { color: activeIdx === i ? seg.color : COLORS.textPrimary }]}>
              {seg.pct}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const dn = StyleSheet.create({
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:        { width: 11, height: 11, borderRadius: 6 },
  legendLabel:{ flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  legendPct:  { fontSize: TYPOGRAPHY.base, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AIInsightsScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [aiData,         setAiData]         = useState<any>(null);

  // Cache disclaimer helpers
  const fmtDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const generatedAt  = aiData?._cacheGeneratedAt ? fmtDate(aiData._cacheGeneratedAt) : null;
  const nextUpdateAt = aiData?._cacheValidUntil  ? fmtDate(aiData._cacheValidUntil)  : null;

  const isDateActive = fromDate.length > 0 && toDate.length > 0;

  // Detect if selectedFY is the current (active) financial year
  const isCurrFY = useMemo(() => {
    if (!selectedFY?.endDate) return true;
    const today = new Date().toISOString().slice(0, 10);
    return today <= selectedFY.endDate;
  }, [selectedFY?.endDate]);

  // Real data from API — no mock fallbacks, show empty state when null
  const revenueForecast: any[] = aiData?.revenueForecast ?? [];
  const expenseDataRaw: any[]  = aiData?.expenseData     ?? [];
  const receivablesAging: any[]= aiData?.receivablesAging?? [];
  const topSuppliers: any[]    = aiData?.topSuppliers    ?? [];
  const topCustomers: any[]    = aiData?.topCustomers    ?? [];
  const stockoutData: any[]    = aiData?.stockout        ?? [];
  const recommendations: any[] = aiData?.recommendations ?? [];
  const summaryData: any       = aiData?.summary         ?? {};

  // ── Chart data: convert raw rupees → Lakhs for chart rendering ──────────────
  const revenueForecastForChart = useMemo(() =>
    revenueForecast.map((d: any) => ({
      ...d,
      actual:   d.actual   != null ? d.actual   / 100000 : null,
      forecast: d.forecast != null ? d.forecast / 100000 : null,
    })),
  [revenueForecast]);

  const expenseDataForChart = useMemo(() =>
    expenseDataRaw.map((d: any) => ({ ...d, amount: (d.amount || 0) / 100000 })),
  [expenseDataRaw]);

  // ── Revenue KPI badge from real summary data ─────────────────────────────────
  const revenueKPI = useMemo(() => {
    if (!aiData?.summary) return null;
    const total = summaryData.totalRevenue || 0;
    const actuals = revenueForecast.filter((d: any) => d.actual != null);
    let pctChange: number | null = null;
    if (actuals.length >= 2) {
      const last = actuals[actuals.length - 1].actual;
      const prev = actuals[actuals.length - 2].actual;
      if (prev > 50000) pctChange = Math.round(((last - prev) / prev) * 100);
    }
    return { total, pctChange };
  }, [aiData?.summary, revenueForecast]);

  // ── Cashflow from real summary ───────────────────────────────────────────────
  const cashflowData = aiData?.summary ? [
    { label: 'Revenue (Inflows)',   value: `+${formatAmountCompact(summaryData.totalRevenue  || 0)}`, color: COLORS.positive },
    { label: 'Expenses (Outflows)', value: `-${formatAmountCompact(summaryData.totalExpenses || 0)}`, color: COLORS.negative },
    { label: 'Net',                 value: `${(summaryData.totalRevenue||0)-(summaryData.totalExpenses||0) >= 0 ? '+' : ''}${formatAmountCompact((summaryData.totalRevenue||0)-(summaryData.totalExpenses||0))}`, color: AMBER },
  ] : [];

  const fetchInsights = useCallback(async () => {
    if (!company?.guid) return;
    setRefreshing(true);
    try {
      let res: any;
      if (isCurrFY || isDateActive) {
        // Current FY or custom date range — use main endpoint
        const from = fromDate || selectedFY?.startDate || undefined;
        const to   = toDate   || selectedFY?.endDate   || undefined;
        res = await getAIInsights(company.guid, from, to);
      } else {
        // Historical FY — use dedicated deterministic endpoint (no LLM, no forecast)
        const fyParam = fyInfoToParam(selectedFY);
        if (!fyParam) throw new Error('Invalid FY');
        res = await getAIInsightsHistory(company.guid, fyParam);
      }
      if (res?.data) setAiData(res.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load insights', text2: 'Check your connection' });
    } finally {
      setRefreshing(false);
    }
  }, [company?.guid, fromDate, toDate, selectedFY?.startDate, isCurrFY, isDateActive]);

  useEffect(() => { fetchInsights(); }, [company?.guid, selectedFY?.startDate]);

  const handleRefresh = () => fetchInsights();

  const handleShare = () => {
    Toast.show({
      type: 'info',
      text1: 'Generating PDF…',
      text2: 'Preparing AI Insights report',
      visibilityTime: 2000,
    });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{isCurrFY || isDateActive ? 'AI Insights' : 'FY Summary'}</Text>
          <View style={[s.aiBadge, !isCurrFY && !isDateActive ? s.aiBadgeHistory : null]}>
            <Ionicons name={isCurrFY || isDateActive ? 'sparkles' : 'bar-chart-outline'} size={10} color={COLORS.white} />
            <Text style={s.aiBadgeTxt}>{isCurrFY || isDateActive ? 'Powered by AI' : 'Historical Analysis'}</Text>
          </View>
        </View>
        <TouchableOpacity style={s.iconBtn} onPress={handleRefresh} activeOpacity={0.7}>
          {refreshing
            ? <ActivityIndicator size="small" color={AMBER} />
            : <Ionicons name="refresh-outline" size={20} color={AMBER} />}
        </TouchableOpacity>
      </View>

      {/* ── Date Range Strip ── */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={isDateActive ? AMBER : COLORS.textTertiary} />
        <Text style={[s.dateStripTxt, isDateActive ? s.dateStripActive : null]}>
          {isDateActive ? `${fromDate}  →  ${toDate}` : 'All Dates'}
        </Text>
        {isDateActive ? null : <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive ? (
          <TouchableOpacity
            onPress={() => { setFromDate(''); setToDate(''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={AMBER} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 96 + insets.bottom }]}
      >
        {/* ── Loading Skeleton (first load, no data yet) ── */}
        {refreshing && !aiData && [
          { h: 180 }, { h: 100 }, { h: 120 }, { h: 140 }, { h: 100 }
        ].map((card, ci) => (
          <View key={ci} style={[s.card, { gap: 10, paddingVertical: 20 }]}>
            <View style={{ height: 14, width: '55%', backgroundColor: COLORS.borderDefault, borderRadius: 6, opacity: 0.5 }} />
            <View style={{ height: card.h, width: '100%', backgroundColor: COLORS.borderDefault, borderRadius: 8, opacity: 0.25, marginTop: 4 }} />
          </View>
        ))}

        {/* ── Content (only when data loaded) ── */}
        {(!refreshing || aiData) && <>

        {/* Last updated + AI disclaimer */}
        <View style={s.updatedRow}>
          <Ionicons name="time-outline" size={12} color={COLORS.textTertiary} />
          <Text style={s.updatedTxt}>
            {isDateActive
              ? `Custom range: ${fromDate} → ${toDate}`
              : !isCurrFY
                ? `Historical highlights — ${selectedFY?.label ?? 'Past FY'} · Deterministic analysis`
                : generatedAt
                  ? `AI insights generated on ${generatedAt}`
                  : 'Smart insights based on your current business activity'}
          </Text>
        </View>
        {/* Next update disclaimer (current FY only, when cached, not on custom date range) */}
        {isCurrFY && !isDateActive && nextUpdateAt && (
          <View style={s.disclaimerRow}>
            <Ionicons name="information-circle-outline" size={11} color={COLORS.textTertiary} />
            <Text style={s.disclaimerTxt}>
              Recommendations refresh on {nextUpdateAt} · Live analytics update on every sync
            </Text>
          </View>
        )}

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 1. Revenue {isCurrFY ? 'Forecast' : 'Trend'} */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>{isCurrFY || isDateActive ? 'Revenue Forecast' : 'Revenue Trend'}</Text>
            {revenueKPI ? (
              <View style={[
                s.kpiBadge,
                revenueKPI.pctChange != null && revenueKPI.pctChange < 0
                  ? { backgroundColor: '#FEE2E2' } : null,
              ]}>
                <Ionicons
                  name={revenueKPI.pctChange != null && revenueKPI.pctChange < 0 ? 'trending-down' : 'trending-up'}
                  size={13}
                  color={revenueKPI.pctChange != null && revenueKPI.pctChange < 0 ? COLORS.negative : COLORS.positive}
                />
                <Text style={[
                  s.kpiBadgeTxt,
                  revenueKPI.pctChange != null && revenueKPI.pctChange < 0 ? { color: COLORS.negative } : null,
                ]}>
                  {formatAmountCompact(revenueKPI.total)}
                  {revenueKPI.pctChange != null ? `  ${revenueKPI.pctChange > 0 ? '+' : ''}${revenueKPI.pctChange}%` : ''}
                </Text>
              </View>
            ) : refreshing ? null : null}
          </View>
          {revenueForecastForChart.length === 0 ? (
            <Text style={s.emptyTxt}>No revenue data for this period</Text>
          ) : (
            <>
              <View style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: AMBER }]} />
                <Text style={s.legendTxt}>Actual</Text>
                {(isCurrFY || isDateActive) && revenueForecastForChart.some((d: any) => d.actual == null) && (
                  <>
                    <View style={[s.legendDash, { backgroundColor: COLORS.textPrimary }]} />
                    <Text style={s.legendTxt}>AI Forecast</Text>
                    <View style={[s.legendDot, { backgroundColor: COLORS.borderDefault, opacity: 0.5 }]} />
                    <Text style={s.legendTxt}>Forecast Zone</Text>
                  </>
                )}
              </View>
              <ForecastLineChart data={revenueForecastForChart} />
            </>
          )}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 2. Cash-Flow Projection */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{isCurrFY || isDateActive ? 'Cash-Flow Projection' : 'Cash Flow Summary'}</Text>
          {cashflowData.length === 0 ? (
            <Text style={s.emptyTxt}>No cash flow data for this period</Text>
          ) : cashflowData.map((row: any, i: number) => (
            <View key={row.label}
              style={[s.cashRow, i < cashflowData.length - 1 ? s.cashRowBorder : null]}
            >
              <Text style={s.cashLabel}>{row.label}</Text>
              <Text style={[s.cashValue, { color: row.color }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 3. Stock-out Risk */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Stock-out Risk</Text>
            <View style={[s.kpiBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning" size={12} color={COLORS.negative} />
              <Text style={[s.kpiBadgeTxt, { color: COLORS.negative }]}>
                {stockoutData.filter((i: any) => i.critical).length} critical
              </Text>
            </View>
          </View>
          {stockoutData.length === 0 ? (
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 }}>No low-stock items detected</Text>
          ) : stockoutData.map((item: any, i: number) => (
            <View key={item.item ?? item.name}
              style={[s.stockRow, i < stockoutData.length - 1 ? s.stockRowBorder : null]}
            >
              <View style={s.stockLeft}>
                <Text style={s.stockItem}>{item.item ?? item.name}</Text>
                <Text style={s.stockCat}>{item.category ?? `${item.qty ?? 0} ${item.unit ?? ''} left`}</Text>
              </View>
              <View style={s.stockRight}>
                <Text style={[s.stockDays, { color: item.critical ? COLORS.negative : AMBER }]}>
                  {item.days ? `${item.days} days left` : (item.critical ? 'Out of stock' : `${item.qty} ${item.unit}`)}
                </Text>
                <Ionicons name="warning" size={16} color={item.critical ? COLORS.negative : AMBER} />
              </View>
            </View>
          ))}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 4. Expense Spike Alert */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Expense Spike Alert</Text>
            {expenseDataForChart.some((d: any) => d.isSpike) && (
              <View style={s.spikeBadge}>
                <Ionicons name="warning" size={11} color={COLORS.negative} />
                <Text style={s.spikeBadgeTxt}>{expenseDataForChart.filter((d: any) => d.isSpike).length} spike{expenseDataForChart.filter((d: any) => d.isSpike).length > 1 ? 's' : ''} detected</Text>
              </View>
            )}
          </View>
          {expenseDataForChart.length === 0 ? (
            <Text style={s.emptyTxt}>No expense data for this period</Text>
          ) : (
            <ExpenseSpikeChart data={expenseDataForChart} />
          )}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 5. Receivables Risk Donut */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Receivables Risk</Text>
          {receivablesAging.length === 0 ? (
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, paddingVertical: 8 }}>No outstanding receivables</Text>
          ) : (
            <ReceivablesDonut segments={receivablesAging} />
          )}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 6. Top Customers */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Top Customers</Text>
          {topCustomers.length === 0 ? (
            <Text style={s.emptyTxt}>No sales data for this period</Text>
          ) : topCustomers.map((cust: any, i: number) => (
            <View key={cust.name ?? i}
              style={[s.supRow, i < topCustomers.length - 1 ? s.supRowBorder : null]}
            >
              <View style={[s.supRankBox, { backgroundColor: AMBER + '15', borderColor: AMBER + '40' }]}>
                <Text style={[s.supRank, { color: AMBER_DARK }]}>{i + 1}</Text>
              </View>
              <Text style={s.supName} numberOfLines={1}>{cust.name}</Text>
              <View style={s.supRight}>
                <Text style={s.supPct}>{cust.pct}% of revenue</Text>
                <Text style={s.supSpend}>
                  {cust.revenue ? `₹${(cust.revenue / 100000).toFixed(1)}L` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 7. Top Suppliers */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Top Suppliers</Text>
          {topSuppliers.length === 0 ? (
            <Text style={s.emptyTxt}>No purchase data for this period</Text>
          ) : topSuppliers.map((sup: any, i: number) => (
            <View key={sup.name ?? i}
              style={[s.supRow, i < topSuppliers.length - 1 ? s.supRowBorder : null]}
            >
              <View style={s.supRankBox}><Text style={s.supRank}>{i + 1}</Text></View>
              <Text style={s.supName} numberOfLines={1}>{sup.name}</Text>
              <View style={s.supRight}>
                <Text style={s.supPct}>{sup.pct}% of spend</Text>
                <Text style={s.supSpend}>
                  {sup.spend ? `₹${(typeof sup.spend === 'number' ? sup.spend / 100000 : parseFloat(sup.spend)).toFixed(1)}L` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ──────────────────────────────────────────────────────────────── */}
        {/* 9. Recommendations */}
        {/* ──────────────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{isCurrFY || isDateActive ? 'AI Recommendations' : 'Business Highlights'}</Text>
          {recommendations.map((rec: any, i: number) => {
            const severity = rec.severity || 'info';
            const iconColor = severity === 'critical' ? COLORS.negative : severity === 'warning' ? AMBER : severity === 'success' ? COLORS.positive : COLORS.brandPrimary;
            const iconBg = severity === 'critical' ? '#FEE2E2' : severity === 'warning' ? AMBER + '18' : severity === 'success' ? '#F0FBF4' : COLORS.brandPrimary + '15';
            return (
              <View key={i} style={[s.recRow, i < recommendations.length - 1 ? s.recRowBorder : null]}>
                <View style={[s.recIcon, { backgroundColor: iconBg }]}>
                  <Ionicons name={rec.icon as any} size={16} color={iconColor} />
                </View>
                <Text style={s.recTxt}>{rec.text}</Text>
              </View>
            );
          })}
        </View>

        </> }{/* end: (!refreshing || aiData) block */}
      </ScrollView>

      {/* ── Share PDF Button ── */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={COLORS.white} />
          <Text style={s.shareBtnTxt}>Share PDF</Text>
        </TouchableOpacity>
      </View>

      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(f, t) => { if (f && t) { setFromDate(f); setToDate(t); } }}
        onClose={() => setShowDatePicker(false)}
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
  iconBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  headerTitle:  { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  aiBadgeHistory: { backgroundColor: AMBER_DARK },
  aiBadgeTxt: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  // Date strip
  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: AMBER },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },

  updatedRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  updatedTxt:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, flex: 1 },
  disclaimerRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8, opacity: 0.75 },
  disclaimerTxt:  { fontSize: 10, color: COLORS.textTertiary, flex: 1, fontStyle: 'italic' },

  // Card shell
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: 12,
  },
  cardTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },

  // KPI badge
  kpiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F0FBF4',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full,
  },
  kpiBadgeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.positive },

  // Chart legend
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendDash: { width: 16, height: 2, borderRadius: 1 },
  legendTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginRight: 8 },

  // Cash Flow
  cashRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  cashRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  cashLabel:     { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  cashValue:     { fontSize: TYPOGRAPHY.base, fontWeight: '700' },

  // Stock-out
  stockRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  stockRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  stockLeft:      { gap: 3 },
  stockItem:      { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  stockCat:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  stockRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockDays:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600' },

  // Expense spike
  spikeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.sm,
  },
  spikeBadgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.negative },

  // Suppliers
  supRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  supRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  supRankBox:   {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },
  supRank:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  supName:  { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  supRight: { alignItems: 'flex-end', gap: 2 },
  supPct:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  supSpend: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Recommendations
  recRow:       { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 12 },
  recRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  recIcon:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recTxt:       { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
  emptyTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, paddingVertical: 10, textAlign: 'center' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 8,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.md, paddingVertical: 15,
  },
  shareBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
