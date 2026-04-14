import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - SPACING.md * 2;

const STOCK_REPORT_DATA = [
  { month: 'Jan', inward: 320, outward: 280 },
  { month: 'Feb', inward: 290, outward: 250 },
  { month: 'Mar', inward: 410, outward: 370 },
  { month: 'Apr', inward: 380, outward: 340 },
  { month: 'May', inward: 520, outward: 480 },
  { month: 'Jun', inward: 460, outward: 420 },
];

const maxVal = Math.max(...STOCK_REPORT_DATA.flatMap(d => [d.inward, d.outward]));

function BarChart() {
  const chartH = 120;
  const barW = 18;
  const gap = 6;
  const groupW = barW * 2 + gap + 16;
  const padLeft = 36;
  const padBottom = 24;
  const svgW = CARD_W - SPACING.md * 2;
  const svgH = chartH + padBottom + 16;

  return (
    <Svg width={svgW} height={svgH}>
      {STOCK_REPORT_DATA.map((d, i) => {
        const x = padLeft + i * groupW;
        const inH = (d.inward / maxVal) * chartH;
        const outH = (d.outward / maxVal) * chartH;
        const baseline = chartH + 8;
        return (
          <React.Fragment key={d.month}>
            <Rect x={x} y={baseline - inH} width={barW} height={inH} rx={3} fill="#2D7D46" opacity={0.85} />
            <Rect x={x + barW + gap} y={baseline - outH} width={barW} height={outH} rx={3} fill="#D97706" opacity={0.85} />
            <SvgText x={x + barW + gap / 2} y={svgH - 4} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>{d.month}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const REPORT_CARDS = [
  { id: 'r1', title: 'Stock Valuation',        icon: 'cash-outline',          value: '₹13,00,000', label: 'Total stock value',         color: '#2D7D46', bg: '#F0FBF4' },
  { id: 'r2', title: 'Turnover Rate',          icon: 'refresh-circle-outline', value: '4.2x',       label: 'Annual inventory turns',    color: '#2563EB', bg: '#EFF6FF' },
  { id: 'r3', title: 'Gross Margin',           icon: 'trending-up-outline',    value: '34.5%',      label: 'Avg gross margin',          color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'r4', title: 'Dead Stock Value',       icon: 'time-outline',           value: '₹12,500',    label: 'Aged 90+ days',             color: '#D97706', bg: '#FFFBEB' },
];

export default function StockReportsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stock Reports</Text>
        <TouchableOpacity style={styles.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Fast vs Slow Moving CTA */}
        <TouchableOpacity
          style={styles.fastSlowBanner}
          onPress={() => router.push('/stocks/fast-slow' as any)}
          activeOpacity={0.85}
        >
          <View style={styles.fastSlowLeft}>
            <View style={styles.fastSlowIcon}>
              <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.fastSlowTitle}>Fast vs Slow Moving Analysis</Text>
              <Text style={styles.fastSlowSub}>62% fast · 38% slow · 377 total SKUs</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          {REPORT_CARDS.map(c => (
            <View key={c.id} style={[styles.kpiCard, { borderLeftColor: c.color }]}>
              <View style={[styles.kpiIcon, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon as any} size={18} color={c.color} />
              </View>
              <Text style={styles.kpiVal}>{c.value}</Text>
              <Text style={styles.kpiTitle}>{c.title}</Text>
              <Text style={styles.kpiLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Inward vs Outward Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Inward vs Outward</Text>
            <View style={styles.legend}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#2D7D46' }]} />
                <Text style={styles.legendText}>Inward</Text>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.legendText}>Outward</Text>
              </View>
            </View>
          </View>
          <BarChart />
        </View>

        {/* Category breakdown */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Stock by Category</Text>
          {[
            { label: 'Electronics',  pct: 42, value: '₹5.46L' },
            { label: 'Peripherals',  pct: 28, value: '₹3.64L' },
            { label: 'Accessories',  pct: 18, value: '₹2.34L' },
            { label: 'Audio',        pct: 8,  value: '₹1.04L' },
            { label: 'Others',       pct: 4,  value: '₹0.52L' },
          ].map(cat => (
            <View key={cat.label} style={styles.catRow}>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <View style={styles.catBarBg}>
                <View style={[styles.catBarFill, { width: `${cat.pct}%` as any }]} />
              </View>
              <Text style={styles.catPct}>{cat.pct}%</Text>
              <Text style={styles.catVal}>{cat.value}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn:   { width: 40, alignItems: 'flex-end' },
  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md },

  fastSlowBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 4, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, padding: SPACING.md },
  fastSlowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  fastSlowIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fastSlowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  fastSlowSub: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: (CARD_W - 10) / 2, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, padding: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderLeftWidth: 3, gap: 4,
  },
  kpiIcon:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiVal:   { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  kpiTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  chartCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  chartTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  legend:      { flexDirection: 'row', gap: 10 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  catRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catLabel:  { width: 80, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  catBarBg:  { flex: 1, height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  catBarFill:{ height: '100%', backgroundColor: COLORS.brandPrimary, borderRadius: 4 },
  catPct:    { width: 30, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  catVal:    { width: 48, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'right' },
});
