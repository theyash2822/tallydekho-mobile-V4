import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, G, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import Header from '../../src/components/Header';
import { getReports } from '../../src/services/api';
import { MOCK_REPORTS, MOCK_MONTHLY_REVENUE } from '../../src/data/mockData';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Bar Chart Component ───────────────────────────────────────────────────────
interface BarDataPoint {
  month: string;
  sales: number;
  purchases: number;
}

interface BarChartProps {
  data: BarDataPoint[];
  width?: number;
  height?: number;
}

function BarChart({ data, width = SCREEN_WIDTH - 32, height = 160 }: BarChartProps) {
  const PADDING_LEFT = 44;
  const PADDING_RIGHT = 12;
  const PADDING_TOP = 12;
  const PADDING_BOTTOM = 32;

  const chartW = width - PADDING_LEFT - PADDING_RIGHT;
  const chartH = height - PADDING_TOP - PADDING_BOTTOM;

  const allValues = data.flatMap(d => [d.sales, d.purchases]);
  const maxVal = Math.ceil(Math.max(...allValues) * 1.15);

  const barGroupW = chartW / data.length;
  const barW = barGroupW * 0.3;
  const gap = barGroupW * 0.06;

  const toY = (val: number) => chartH - (val / maxVal) * chartH + PADDING_TOP;

  // Y-axis labels
  const yLabels = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal];

  const formatLabel = (v: number) => v >= 10 ? `${v}L` : `${v}L`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={COLORS.brandPrimary} stopOpacity="1" />
          <Stop offset="100%" stopColor={COLORS.brandPrimary} stopOpacity="0.75" />
        </LinearGradient>
        <LinearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={COLORS.textTertiary} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={COLORS.textTertiary} stopOpacity="0.35" />
        </LinearGradient>
      </Defs>

      {/* Grid lines + Y labels */}
      {yLabels.map((v, i) => {
        const y = toY(v);
        return (
          <G key={i}>
            <Line
              x1={PADDING_LEFT}
              y1={y}
              x2={PADDING_LEFT + chartW}
              y2={y}
              stroke={COLORS.borderDefault}
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '3,3'}
            />
            <SvgText
              x={PADDING_LEFT - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill={COLORS.textTertiary}
            >
              {v === 0 ? '0' : formatLabel(v)}
            </SvgText>
          </G>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const groupX = PADDING_LEFT + i * barGroupW + barGroupW * 0.15;
        const salesH = (d.sales / maxVal) * chartH;
        const purchH = (d.purchases / maxVal) * chartH;
        const salesY = toY(d.sales);
        const purchY = toY(d.purchases);
        const centerX = groupX + barW + gap / 2;

        return (
          <G key={d.month}>
            {/* Sales bar */}
            <Rect
              x={groupX}
              y={salesY}
              width={barW}
              height={salesH}
              fill="url(#salesGrad)"
              rx={3}
            />
            {/* Purchase bar */}
            <Rect
              x={groupX + barW + gap}
              y={purchY}
              width={barW}
              height={purchH}
              fill="url(#purchGrad)"
              rx={3}
            />
            {/* Month label */}
            <SvgText
              x={centerX}
              y={height - PADDING_BOTTOM + 14}
              textAnchor="middle"
              fontSize={10}
              fill={COLORS.textSecondary}
              fontWeight="500"
            >
              {d.month}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Report Sections ───────────────────────────────────────────────────────────
const REPORT_SECTIONS = [
  {
    id: 'financial',
    title: 'Financial Reports',
    icon: 'trending-up-outline' as const,
    items: [
      { id: 'pl', label: 'Profit & Loss', icon: 'analytics-outline' as const, desc: 'Income, expenses & net profit' },
      { id: 'bs', label: 'Balance Sheet', icon: 'scale-outline' as const, desc: 'Assets, liabilities & equity' },
      { id: 'tb', label: 'Trial Balance', icon: 'list-outline' as const, desc: 'Debit & credit balances' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: 'shield-checkmark-outline' as const,
    items: [
      { id: 'gst', label: 'GST Filing', icon: 'receipt-outline' as const, desc: 'IGST, CGST, SGST summary' },
      { id: 'eway', label: 'E-Way Bills', icon: 'car-outline' as const, desc: '265 generated, 33 pending' },
      { id: 'einvoice', label: 'E-Invoicing', icon: 'document-text-outline' as const, desc: 'IRN generation & status' },
      { id: 'othertax', label: 'Other Taxes', icon: 'cash-outline' as const, desc: 'TDS, TCS, Excise, VAT' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit & Logs',
    icon: 'search-outline' as const,
    items: [
      { id: 'trail', label: 'Audit Trail', icon: 'time-outline' as const, desc: 'All user actions & changes' },
      { id: 'daybook', label: 'Day Book', icon: 'calendar-outline' as const, desc: 'Daily transaction summary' },
    ],
  },
  {
    id: 'ai',
    title: 'AI Insights',
    icon: 'bulb-outline' as const,
    items: [
      { id: 'insights', label: 'AI Financial Insights', icon: 'sparkles-outline' as const, desc: 'Smart analysis & recommendations' },
    ],
  },
];

// ─── Main Reports Screen ───────────────────────────────────────────────────────
export default function ReportsScreen() {
  const [reports, setReports] = useState(MOCK_REPORTS);
  const [monthlyData] = useState(MOCK_MONTHLY_REVENUE);
  const [refreshing, setRefreshing] = useState(false);
  const [activePeriod, setActivePeriod] = useState<'6M' | '1Y'>('6M');

  useEffect(() => { getReports().then((d: any) => setReports(d)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getReports() as any;
    setReports(d);
    setRefreshing(false);
  };

  const chartData = activePeriod === '6M'
    ? monthlyData.slice(-6)
    : monthlyData;

  return (
    <SafeAreaView testID="reports-screen" style={styles.safe}>
      <Header companyName="Reports" />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {/* KPI Summary */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { flex: 1 }]}>
            <Text style={styles.kpiValue}>{reports.salesSummary.today}</Text>
            <Text style={styles.kpiLabel}>Today</Text>
            <View style={styles.growthBadge}>
              <Ionicons name="trending-up" size={10} color={COLORS.positive} />
              <Text style={styles.growthText}>▲ 12%</Text>
            </View>
          </View>
          <View style={[styles.kpiCard, { flex: 1 }]}>
            <Text style={styles.kpiValue}>{reports.salesSummary.mtd}</Text>
            <Text style={styles.kpiLabel}>MTD Sales</Text>
          </View>
          <View style={[styles.kpiCard, { flex: 1 }]}>
            <Text style={styles.kpiValue}>{reports.salesSummary.ytd}</Text>
            <Text style={styles.kpiLabel}>YTD Sales</Text>
          </View>
        </View>

        {/* Revenue Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Revenue Overview</Text>
              <Text style={styles.chartSubtitle}>Sales vs Purchases (in Lakhs)</Text>
            </View>
            <View style={styles.periodTabs}>
              {(['6M', '1Y'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodTab, activePeriod === p && styles.periodTabActive]}
                  onPress={() => setActivePeriod(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodTabText, activePeriod === p && styles.periodTabTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <BarChart data={chartData} width={SCREEN_WIDTH - 32} height={170} />

          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.brandPrimary }]} />
              <Text style={styles.legendText}>Sales</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.textTertiary }]} />
              <Text style={styles.legendText}>Purchases</Text>
            </View>
          </View>
        </View>

        {/* E-way Bills */}
        <View testID="eway-stats" style={styles.ewayCard}>
          <View style={styles.ewayHeader}>
            <View style={styles.ewayIconBox}>
              <Ionicons name="car-outline" size={16} color={COLORS.textPrimary} />
            </View>
            <Text style={styles.ewayTitle}>E-Way Bills</Text>
            <Text style={styles.ewayFy}>FY 2025-26</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>
          <View style={styles.ewayStats}>
            {[
              { label: 'Generated', value: reports.ewayBills.generated, color: COLORS.positive },
              { label: 'Pending', value: reports.ewayBills.pending, color: COLORS.warning },
              { label: 'Errors', value: reports.ewayBills.errors, color: COLORS.negative },
              { label: 'Expiring', value: reports.ewayBills.expiring, color: COLORS.info },
            ].map(stat => (
              <View key={stat.label} style={styles.ewayStat}>
                <Text style={[styles.ewayStatValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.ewayStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* GST Summary */}
        <View style={styles.gstCard}>
          <Text style={styles.gstTitle}>GST Summary</Text>
          <View style={styles.gstRow}>
            {[
              { label: 'IGST', value: reports.gst.igst },
              { label: 'CGST', value: reports.gst.cgst },
              { label: 'SGST', value: reports.gst.sgst },
            ].map((g, i) => (
              <View key={g.label} style={[styles.gstItem, i < 2 && styles.gstItemBorder]}>
                <Text style={styles.gstValue}>{g.value}</Text>
                <Text style={styles.gstLabel}>{g.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.gstTotal}>
            <Text style={styles.gstTotalLabel}>Total Tax Collected</Text>
            <Text style={styles.gstTotalValue}>{reports.gst.totalTaxCollected}</Text>
          </View>
        </View>

        {/* Report Sections */}
        {REPORT_SECTIONS.map(section => (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={14} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <View key={item.id}>
                  <TouchableOpacity
                    testID={`report-${item.id}`}
                    style={styles.reportItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reportIconBox}>
                      <Ionicons name={item.icon} size={18} color={COLORS.textSecondary} />
                    </View>
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportLabel}>{item.label}</Text>
                      <Text style={styles.reportDesc}>{item.desc}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && <View style={styles.itemSep} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { flex: 1 },

  // KPI Row
  kpiRow: { flexDirection: 'row', gap: 8, padding: SPACING.md, paddingBottom: 8 },
  kpiCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  kpiValue: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, textAlign: 'center' },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  growthText: { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600' },

  // Chart
  chartCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  chartHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  chartSubtitle: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  periodTabs: {
    flexDirection: 'row', gap: 2,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  periodTab: {
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: COLORS.cardBg,
  },
  periodTabActive: { backgroundColor: COLORS.brandPrimary },
  periodTabText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  periodTabTextActive: { color: COLORS.white },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // E-way Bills
  ewayCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  ewayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ewayIconBox: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  ewayTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  ewayFy: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  ewayStats: { flexDirection: 'row', justifyContent: 'space-between' },
  ewayStat: { alignItems: 'center', gap: 4 },
  ewayStatValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '700' },
  ewayStatLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // GST
  gstCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  gstTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  gstRow: { flexDirection: 'row', marginBottom: 12 },
  gstItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  gstItemBorder: { borderRightWidth: 1, borderRightColor: COLORS.borderDefault },
  gstValue: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  gstLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  gstTotal: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  gstTotalLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  gstTotalValue: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },

  // Report Sections
  section: { marginBottom: SPACING.xs },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  reportItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  reportIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  reportInfo: { flex: 1 },
  reportLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  reportDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemSep: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 66 },
});
