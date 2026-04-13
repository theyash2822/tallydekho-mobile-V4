import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Line, G, Text as SvgText, Path } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CHART_W = W - SPACING.md * 2 - 32;

// ── AI Insights Data ──────────────────────────────────────────────────────
const AI_INSIGHTS = [
  {
    id: 'trend',
    icon: 'trending-up',
    color: '#2D7D46',
    bg: '#F0FBF4',
    title: 'Revenue up 18% vs last month',
    body: 'Your Sales Invoice volume increased by 18% compared to previous month. Electronics category driving 62% of growth.',
    action: 'View breakdown',
  },
  {
    id: 'anomaly',
    icon: 'warning-outline',
    color: '#D97706',
    bg: '#FFFBEB',
    title: 'Unusual expense spike detected',
    body: 'Logistics costs are 34% higher than your 3-month average. Check freight invoices from ABC Transporters.',
    action: 'Review invoices',
  },
  {
    id: 'receivable',
    icon: 'alert-circle-outline',
    color: '#C0392B',
    bg: '#FDECEA',
    title: '₹2.4L overdue (30+ days)',
    body: 'PQR Exports (₹1.2L) and Kumar & Sons (₹1.2L) have outstanding invoices over 30 days. Send payment reminders.',
    action: 'Send reminders',
  },
  {
    id: 'opportunity',
    icon: 'sparkles-outline',
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'New product opportunity identified',
    body: 'Bluetooth speakers show 42% higher margin vs headphones. Consider increasing inventory allocation for Q4.',
    action: 'View analysis',
  },
];

const FORECAST_MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun'];
const FORECAST_ACTUAL  = [920000, 1050000, 980000, null, null];
const FORECAST_PRED    = [920000, 1050000, 1120000, 1280000, 1350000];

const TOP_PRODUCTS = [
  { name: 'JBL Portable Speaker', revenue: '₹4.2L', growth: 28, margin: 42 },
  { name: 'Sony WH-1000XM5',      revenue: '₹3.8L', growth: 15, margin: 38 },
  { name: 'Samsung Galaxy BT',    revenue: '₹2.1L', growth: -8, margin: 22 },
  { name: 'Lycan Wireless',       revenue: '₹1.9L', growth: 5,  margin: 31 },
  { name: 'JBL Wired Speaker',    revenue: '₹1.4L', growth: 12, margin: 35 },
];

// ── Forecast Chart ────────────────────────────────────────────────────────
function ForecastChart() {
  const H = 150;
  const PAD_L = 44; const PAD_R = 16; const PAD_T = 14; const PAD_B = 28;
  const chartW = CHART_W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const n = FORECAST_MONTHS.length;
  const maxVal = 1500000;

  const xAt = (i: number) => PAD_L + (i / (n - 1)) * chartW;
  const yAt = (v: number) => PAD_T + chartH - (v / maxVal) * chartH;

  // Actual line points
  const actualPts = FORECAST_ACTUAL
    .map((v, i) => v !== null ? `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v!).toFixed(1)}` : null)
    .filter(Boolean).join(' ');

  // Forecast line (all)
  const forecastPts = FORECAST_PRED
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');

  return (
    <Svg width={CHART_W} height={H}>
      {[0, 500000, 1000000, 1500000].map(v => (
        <G key={v}>
          <Line x1={PAD_L} y1={yAt(v)} x2={PAD_L + chartW} y2={yAt(v)} stroke={COLORS.borderDefault} strokeWidth={1} />
          <SvgText x={PAD_L - 4} y={yAt(v) + 3.5} textAnchor="end" fontSize={7.5} fill={COLORS.textTertiary}>
            {v === 0 ? '0' : v === 500000 ? '₹5L' : v === 1000000 ? '₹10L' : '₹15L'}
          </SvgText>
        </G>
      ))}

      {/* Forecast dashed line */}
      <Path d={forecastPts} stroke="#7C3AED" strokeWidth={2} fill="none"
        strokeDasharray="6,3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Actual solid line */}
      <Path d={actualPts} stroke="#2D7D46" strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Prediction zone shading - use rects as overlay */}
      {FORECAST_PRED.map((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        const isPred = FORECAST_ACTUAL[i] === null;
        if (!isPred) return null;
        return <Rect key={i} x={x - 2} y={y - 4} width={4} height={4} rx={2} fill="#7C3AED" opacity={0.8} />;
      })}

      {/* X labels */}
      {FORECAST_MONTHS.map((m, i) => (
        <G key={m}>
          <SvgText x={xAt(i).toFixed(1)} y={H - 4} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>{m}</SvgText>
          {FORECAST_ACTUAL[i] === null && (
            <SvgText x={xAt(i).toFixed(1)} y={H - 14} textAnchor="middle" fontSize={7} fill="#7C3AED">AI</SvgText>
          )}
        </G>
      ))}
    </Svg>
  );
}

// ── Insight Card ──────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: typeof AI_INSIGHTS[0] }) {
  return (
    <View style={[ic.card, { borderLeftColor: insight.color, borderLeftWidth: 3 }]}>
      <View style={ic.top}>
        <View style={[ic.iconBox, { backgroundColor: insight.bg }]}>
          <Ionicons name={insight.icon as any} size={18} color={insight.color} />
        </View>
        <Text style={ic.title}>{insight.title}</Text>
      </View>
      <Text style={ic.body}>{insight.body}</Text>
      <TouchableOpacity style={ic.action} onPress={() => {}} activeOpacity={0.7}>
        <Text style={[ic.actionTxt, { color: insight.color }]}>{insight.action} →</Text>
      </TouchableOpacity>
    </View>
  );
}
const ic = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, gap: 8, marginBottom: 12,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  body:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  action: { alignSelf: 'flex-start' },
  actionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AIInsightsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1800);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>AI Insights</Text>
          <View style={s.aiBadge}>
            <Ionicons name="sparkles" size={10} color={COLORS.white} />
            <Text style={s.aiBadgeTxt}>Powered by AI</Text>
          </View>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={handleRefresh} activeOpacity={0.7}>
          {refreshing
            ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
            : <Ionicons name="refresh-outline" size={20} color={COLORS.brandPrimary} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Last updated */}
        <View style={s.updatedRow}>
          <Ionicons name="time-outline" size={12} color={COLORS.textTertiary} />
          <Text style={s.updatedTxt}>Insights updated 5 mins ago · Based on FY 2025-26 data</Text>
        </View>

        {/* AI Insight Cards */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Key Insights</Text>
          {AI_INSIGHTS.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </View>

        {/* Sales Forecast */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Sales Forecast</Text>
            <View style={s.forecastLegend}>
              <View style={s.legendRow}><View style={[s.legendLine, { backgroundColor: '#2D7D46' }]} /><Text style={s.legendTxt}>Actual</Text></View>
              <View style={s.legendRow}><View style={[s.legendLine, { backgroundColor: '#7C3AED' }]} /><Text style={s.legendTxt}>AI Forecast</Text></View>
            </View>
          </View>
          <ForecastChart />
          <View style={s.forecastNote}>
            <Ionicons name="bulb-outline" size={13} color="#7C3AED" />
            <Text style={s.forecastNoteTxt}>AI predicts ₹13.5L revenue for June 2025 based on current growth trajectory</Text>
          </View>
        </View>

        {/* Top Products */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Top Products by Revenue</Text>
          {TOP_PRODUCTS.map((p, i) => (
            <View key={i} style={s.prodRow}>
              <View style={s.prodRank}><Text style={s.prodRankTxt}>{i + 1}</Text></View>
              <View style={s.prodInfo}>
                <Text style={s.prodName}>{p.name}</Text>
                <Text style={s.prodMargin}>Margin: {p.margin}%</Text>
              </View>
              <View style={s.prodRight}>
                <Text style={s.prodRev}>{p.revenue}</Text>
                <View style={[s.growthBadge, { backgroundColor: p.growth >= 0 ? '#F0FBF4' : '#FDECEA' }]}>
                  <Ionicons name={p.growth >= 0 ? 'trending-up' : 'trending-down'} size={10} color={p.growth >= 0 ? '#2D7D46' : '#C0392B'} />
                  <Text style={[s.growthTxt, { color: p.growth >= 0 ? '#2D7D46' : '#C0392B' }]}>{Math.abs(p.growth)}%</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Recommendations */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>AI Recommendations</Text>
          {[
            { icon: 'rocket-outline',     color: '#2563EB', text: 'Increase JBL Speaker stock by 20% before festive season' },
            { icon: 'card-outline',       color: '#2D7D46', text: 'Offer 2% early payment discount to reduce receivables aging' },
            { icon: 'alert-circle-outline', color: '#D97706', text: 'Review Samsung Galaxy BT pricing — 8% decline in sales' },
            { icon: 'layers-outline',     color: '#7C3AED', text: 'Bundle headphones + speakers to increase avg. order value' },
            { icon: 'calendar-outline',   color: '#0891B2', text: 'File GSTR-1 for Jan 2025 before 11-Feb deadline' },
          ].map((rec, i) => (
            <View key={i} style={s.recRow}>
              <View style={[s.recIcon, { backgroundColor: rec.color + '18' }]}>
                <Ionicons name={rec.icon as any} size={15} color={rec.color} />
              </View>
              <Text style={s.recTxt}>{rec.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter:{ flex: 1, alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  aiBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  aiBadgeTxt:  { fontSize: 10, fontWeight: '700', color: COLORS.white },
  refreshBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 4 },
  updatedTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  scroll: { flex: 1 },
  section: { marginHorizontal: SPACING.md, marginTop: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },

  forecastLegend: { flexDirection: 'row', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  forecastNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, padding: 10, backgroundColor: '#F5F3FF', borderRadius: RADIUS.md },
  forecastNoteTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: '#7C3AED', lineHeight: 17 },

  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  prodRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  prodRankTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  prodInfo: { flex: 1, gap: 2 },
  prodName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  prodMargin: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  prodRight: { alignItems: 'flex-end', gap: 4 },
  prodRev: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  growthTxt: { fontSize: 10, fontWeight: '700' },

  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  recIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
});
