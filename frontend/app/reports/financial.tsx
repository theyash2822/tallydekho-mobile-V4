import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText, Line, Path, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CHART_W = W - SPACING.md * 2 - 32; // card width minus padding

// ── Period Filters ──────────────────────────────────────────────────────────
const PERIODS = [
  { id: 'this_m', label: 'This Month' },
  { id: 'q1',    label: 'Q1' },
  { id: 'q2',    label: 'Q2' },
  { id: 'h1',    label: 'H1' },
  { id: 'fy',    label: 'Full Year' },
] as const;
type Period = typeof PERIODS[number]['id'];

// ── Period-specific data ────────────────────────────────────────────────────
const PERIOD_DATA: Record<string, {
  revenue: number; expenses: number; grossProfit: number; netProfit: number;
  grossMargin: number; netMargin: number;
  months: string[]; revenueArr: number[]; expenseArr: number[];
}> = {
  this_m: {
    revenue: 920000, expenses: 630000, grossProfit: 420000, netProfit: 290000,
    grossMargin: 45.7, netMargin: 31.5,
    months: ['Wk1','Wk2','Wk3','Wk4'],
    revenueArr: [195000, 240000, 280000, 205000],
    expenseArr: [140000, 165000, 190000, 135000],
  },
  q1: {
    revenue: 2740000, expenses: 1850000, grossProfit: 1210000, netProfit: 890000,
    grossMargin: 44.2, netMargin: 32.5,
    months: ['Apr','May','Jun'],
    revenueArr: [820000, 980000, 940000],
    expenseArr: [560000, 680000, 610000],
  },
  q2: {
    revenue: 3120000, expenses: 2050000, grossProfit: 1380000, netProfit: 1070000,
    grossMargin: 44.2, netMargin: 34.3,
    months: ['Jul','Aug','Sep'],
    revenueArr: [980000, 1050000, 1090000],
    expenseArr: [650000, 700000, 700000],
  },
  h1: {
    revenue: 5860000, expenses: 3900000, grossProfit: 2590000, netProfit: 1960000,
    grossMargin: 44.2, netMargin: 33.4,
    months: ['Apr','May','Jun','Jul','Aug','Sep'],
    revenueArr: [820000, 980000, 940000, 980000, 1050000, 1090000],
    expenseArr: [560000, 680000, 610000, 650000, 700000, 700000],
  },
  fy: {
    revenue: 12400000, expenses: 7900000, grossProfit: 5400000, netProfit: 4500000,
    grossMargin: 43.5, netMargin: 36.3,
    months: ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
    revenueArr: [820000, 980000, 940000, 980000, 1050000, 1090000, 1180000, 1050000, 1200000, 980000, 1130000, 1000000],
    expenseArr: [560000, 680000, 610000, 650000, 700000, 700000, 750000, 670000, 780000, 620000, 720000, 660000],
  },
};

function fmt(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000)  return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)    return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

// ── Summary Card ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: string; color: string; sub?: string;
}) {
  return (
    <View style={mc.card}>
      <View style={[mc.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={mc.val}>{value}</Text>
      <Text style={mc.lbl}>{label}</Text>
      {sub && <Text style={mc.sub}>{sub}</Text>}
    </View>
  );
}
const mc = StyleSheet.create({
  card: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 6, minWidth: 140 },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  val: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  lbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  sub: { fontSize: 10, color: COLORS.textTertiary },
});

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ months, revenueArr, expenseArr }: { months: string[]; revenueArr: number[]; expenseArr: number[] }) {
  const H = 140;
  const PAD_L = 40; const PAD_R = 8; const PAD_T = 10; const PAD_B = 24;
  const chartW = CHART_W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const n = months.length;
  const maxVal = Math.max(...revenueArr, ...expenseArr);
  const grpW = chartW / n;
  const barW = Math.min((grpW - 8) / 2, 18);

  const yToSvg = (v: number) => PAD_T + chartH - (v / maxVal) * chartH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <Svg width={CHART_W} height={H}>
      {/* Y grid + labels */}
      {yTicks.map(v => {
        const y = yToSvg(v);
        return (
          <G key={v}>
            <Line x1={PAD_L} y1={y} x2={PAD_L + chartW} y2={y} stroke={COLORS.borderDefault} strokeWidth={1} />
            <SvgText x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize={7.5} fill={COLORS.textTertiary}>
              {fmt(v)}
            </SvgText>
          </G>
        );
      })}
      {/* Bars */}
      {months.map((m, i) => {
        const cx = PAD_L + i * grpW + grpW / 2;
        const rh = (revenueArr[i] / maxVal) * chartH;
        const eh = (expenseArr[i] / maxVal) * chartH;
        return (
          <G key={m}>
            <Rect x={cx - barW - 1} y={PAD_T + chartH - rh} width={barW} height={rh} fill="#2D7D46" rx={2} />
            <Rect x={cx + 1}       y={PAD_T + chartH - eh} width={barW} height={eh} fill="#D97706" rx={2} />
            <SvgText x={cx} y={H - 4} textAnchor="middle" fontSize={7.5} fill={COLORS.textSecondary}>{m}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ── Expense Category Row ────────────────────────────────────────────────────
function ExpCategoryRow({ label, amount, pct, color }: { label: string; amount: string; pct: number; color: string }) {
  return (
    <View style={ex.row}>
      <View style={ex.left}>
        <Text style={ex.label}>{label}</Text>
        <View style={ex.track}>
          <View style={[ex.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
      </View>
      <View style={ex.right}>
        <Text style={ex.amount}>{amount}</Text>
        <Text style={ex.pct}>{pct}%</Text>
      </View>
    </View>
  );
}
const ex = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  left: { flex: 1, gap: 4 },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  track: { height: 6, backgroundColor: COLORS.borderDefault, borderRadius: 3 },
  fill: { height: 6, borderRadius: 3 },
  right: { alignItems: 'flex-end', width: 70 },
  amount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  pct: { fontSize: 11, color: COLORS.textTertiary },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function FinancialReportScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('this_m');
  const d = PERIOD_DATA[period];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Financial Report</Text>
        <TouchableOpacity style={s.exportBtn} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Period Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[s.filterChip, period === p.id && s.filterChipActive]}
            onPress={() => setPeriod(p.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.filterChipTxt, period === p.id && s.filterChipTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Summary Cards 2x2 */}
        <View style={s.cardsRow}>
          <SummaryCard label="Revenue" value={fmt(d.revenue)} icon="trending-up" color="#2D7D46" sub={`Margin ${d.grossMargin}%`} />
          <SummaryCard label="Expenses" value={fmt(d.expenses)} icon="trending-down" color="#C0392B" />
        </View>
        <View style={[s.cardsRow, { marginTop: 10 }]}>
          <SummaryCard label="Gross Profit" value={fmt(d.grossProfit)} icon="stats-chart" color="#2563EB" sub={`${d.grossMargin}% margin`} />
          <SummaryCard label="Net Profit" value={fmt(d.netProfit)} icon="wallet" color="#7C3AED" sub={`${d.netMargin}% margin`} />
        </View>

        {/* Revenue vs Expense Bar Chart */}
        <View style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>Revenue vs Expenses</Text>
            <View style={s.legend}>
              <View style={s.legendRow}><View style={[s.legendDot, { backgroundColor: '#2D7D46' }]} /><Text style={s.legendTxt}>Revenue</Text></View>
              <View style={s.legendRow}><View style={[s.legendDot, { backgroundColor: '#D97706' }]} /><Text style={s.legendTxt}>Expenses</Text></View>
            </View>
          </View>
          <BarChart months={d.months} revenueArr={d.revenueArr} expenseArr={d.expenseArr} />
        </View>

        {/* Expense Breakdown */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Expense Breakdown</Text>
          <View style={{ marginTop: 14 }}>
            <ExpCategoryRow label="Cost of Goods" amount="₹3.2L" pct={40} color="#E53935" />
            <ExpCategoryRow label="Staff Salaries" amount="₹1.8L" pct={23} color="#D97706" />
            <ExpCategoryRow label="Logistics" amount="₹1.2L" pct={15} color="#2563EB" />
            <ExpCategoryRow label="Marketing" amount="₹0.9L" pct={11} color="#7C3AED" />
            <ExpCategoryRow label="Overheads" amount="₹0.8L" pct={10} color="#0891B2" />
          </View>
        </View>

        {/* P&L Summary Table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Profit & Loss Summary</Text>
          <View style={s.plTable}>
            {[
              { label: 'Gross Revenue',      value: fmt(d.revenue),    indent: false, bold: false },
              { label: 'Less: Cost of Sales',value: `-${fmt(Math.round(d.expenses * 0.4))}`, indent: true, bold: false },
              { label: 'Gross Profit',        value: fmt(d.grossProfit), indent: false, bold: true },
              { label: 'Less: Operating Exp.',value: `-${fmt(Math.round(d.expenses * 0.6))}`, indent: true, bold: false },
              { label: 'EBITDA',              value: fmt(Math.round(d.netProfit * 1.15)), indent: false, bold: false },
              { label: 'Less: D&A + Tax',     value: `-${fmt(Math.round(d.netProfit * 0.15))}`, indent: true, bold: false },
              { label: 'Net Profit (PAT)',    value: fmt(d.netProfit),  indent: false, bold: true },
            ].map((row, i) => (
              <View key={i} style={[s.plRow, i % 2 === 0 && s.plRowAlt, row.bold && s.plRowBold]}>
                <Text style={[s.plLabel, row.indent && s.plLabelIndent, row.bold && s.plBoldTxt]}>{row.label}</Text>
                <Text style={[s.plValue, row.bold && s.plBoldTxt, row.value.startsWith('-') && { color: COLORS.negative }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  filterScroll: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterContent: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  filterChipTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  filterChipTxtActive: { color: COLORS.white, fontWeight: '700' },

  scroll: { flex: 1 },
  cardsRow: { flexDirection: 'row', gap: 10, marginHorizontal: SPACING.md, marginTop: SPACING.md },

  section: {
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  legend: { flexDirection: 'row', gap: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  plTable: { borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderDefault },
  plRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  plRowAlt: { backgroundColor: COLORS.pageBg },
  plRowBold: { backgroundColor: COLORS.activeBg },
  plLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  plLabelIndent: { paddingLeft: 16, color: COLORS.textSecondary, fontSize: TYPOGRAPHY.xs },
  plValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  plBoldTxt: { fontWeight: '800', fontSize: TYPOGRAPHY.base },
});
