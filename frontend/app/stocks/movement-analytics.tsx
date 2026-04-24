import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { G, Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─── DATA ─────────────────────────────────────────────────────────────────────

const FAST_MOVING = [
  { id: 'FM01', name: 'USB-C Cable 3A',        sku: 'USB-3A-1M',  sales: 1240, velocity: 'Very Fast', change: +22, category: 'Accessories' },
  { id: 'FM02', name: 'Wireless Mouse M220',   sku: 'LOG-M220',   sales: 980,  velocity: 'Fast',      change: +15, category: 'Peripherals' },
  { id: 'FM03', name: 'HDMI Cable 1.5m',       sku: 'HDM-1.5',    sales: 870,  velocity: 'Fast',      change: +8,  category: 'Accessories' },
  { id: 'FM04', name: 'Laptop Stand Adj.',     sku: 'LST-ADJ01',  sales: 760,  velocity: 'Moderate',  change: -3,  category: 'Furniture'  },
  { id: 'FM05', name: 'Keyboard MK235',        sku: 'LOG-MK235',  sales: 690,  velocity: 'Moderate',  change: +5,  category: 'Peripherals' },
  { id: 'FM06', name: 'Power Bank 20000mAh',   sku: 'AMZ-PB20K',  sales: 620,  velocity: 'Moderate',  change: +12, category: 'Mobiles'    },
  { id: 'FM07', name: 'Screen Guard iPhone',   sku: 'SG-IP14',    sales: 580,  velocity: 'Moderate',  change: -8,  category: 'Accessories' },
  { id: 'FM08', name: 'TWS Earbuds Pro',       sku: 'TWS-PRO-01', sales: 510,  velocity: 'Normal',    change: +3,  category: 'Audio'      },
  { id: 'FM09', name: 'Type-C Hub 7-in-1',     sku: 'USB-C71',    sales: 460,  velocity: 'Normal',    change: -1,  category: 'Accessories' },
  { id: 'FM10', name: 'Smart Watch Band 44mm', sku: 'SWB-44',     sales: 390,  velocity: 'Normal',    change: +9,  category: 'Wearables'  },
];

const VELOCITY_CONFIG = {
  'Very Fast': { color: '#2D7D46', bg: '#F0FBF4' },
  'Fast':      { color: '#059669', bg: '#ECFDF5' },
  'Moderate':  { color: '#2563EB', bg: '#EFF6FF' },
  'Normal':    { color: '#6B7280', bg: '#F3F4F6' },
};

const CATEGORIES = ['All', 'Accessories', 'Peripherals', 'Audio', 'Mobiles', 'Wearables'];
const maxSales = Math.max(...FAST_MOVING.map(f => f.sales));

const TREND_DATA: Record<'7D' | '1M' | '3M', { labels: string[]; values: number[] }> = {
  '7D': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [420,  385,  510,  465,  590,  720,  680],
  },
  '1M': {
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
    values: [3200, 2850, 3750, 4100, 3650, 4480, 5100],
  },
  '3M': {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    values: [11800, 10200, 14100, 12900, 16500, 15200, 18400],
  },
};

// ─── CHART COMPONENT (defined outside screen) ─────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const CHART_W  = SCREEN_W - SPACING.md * 2;
const CHART_H  = 160;
const PAD      = { top: 20, right: 16, bottom: 28, left: 44 };
const INNER_W  = CHART_W - PAD.left - PAD.right;
const INNER_H  = CHART_H - PAD.top - PAD.bottom;

type ChartProps = { values: number[]; labels: string[] };

function SalesLineChart({ values, labels }: ChartProps) {
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);

  const n      = values.length;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range  = maxVal - minVal || 1;

  const pts = values.map((v, i) => ({
    x: PAD.left + (i / (n - 1)) * INNER_W,
    y: PAD.top  + (1 - (v - minVal) / range) * INNER_H,
    v,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L${pts[n - 1].x.toFixed(1)},${(PAD.top + INNER_H).toFixed(1)}` +
    ` L${pts[0].x.toFixed(1)},${(PAD.top + INNER_H).toFixed(1)} Z`;

  const gridRatios = [0, 0.25, 0.5, 0.75, 1];

  const cursor   = cursorIdx !== null ? pts[cursorIdx] : null;
  const tipCx    = cursor
    ? Math.max(PAD.left + 30, Math.min(cursor.x, CHART_W - PAD.right - 30))
    : 0;
  const tipCy    = cursor ? Math.max(PAD.top + 14, cursor.y - 26) : 0;

  const fmtVal = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString();

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={e => {
        const x   = e.nativeEvent.locationX;
        const idx = Math.round(((x - PAD.left) / INNER_W) * (n - 1));
        setCursorIdx(Math.max(0, Math.min(n - 1, idx)));
      }}
      onResponderMove={e => {
        const x   = e.nativeEvent.locationX;
        const idx = Math.round(((x - PAD.left) / INNER_W) * (n - 1));
        setCursorIdx(Math.max(0, Math.min(n - 1, idx)));
      }}
      onResponderRelease={() => {
        setTimeout(() => setCursorIdx(null), 2500);
      }}
    >
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={COLORS.brandPrimary} stopOpacity="0.18" />
            <Stop offset="1" stopColor={COLORS.brandPrimary} stopOpacity="0.01" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines + Y-axis labels */}
        {gridRatios.map((r, i) => {
          const gy  = PAD.top + r * INNER_H;
          const gv  = Math.round(maxVal - r * range);
          return (
            <G key={i}>
              <Line
                x1={PAD.left} y1={gy}
                x2={CHART_W - PAD.right} y2={gy}
                stroke={COLORS.borderDefault}
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <SvgText
                x={PAD.left - 5} y={gy + 4}
                textAnchor="end" fontSize="9" fill={COLORS.textTertiary}
              >
                {fmtVal(gv)}
              </SvgText>
            </G>
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#aGrad)" />

        {/* Line stroke */}
        <Path
          d={linePath}
          stroke={COLORS.brandPrimary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Idle data-point circles */}
        {pts.map((p, i) => (
          <Circle
            key={i} cx={p.x} cy={p.y} r={3.5}
            fill={COLORS.cardBg}
            stroke={COLORS.brandPrimary}
            strokeWidth={2}
          />
        ))}

        {/* X-axis labels */}
        {labels.map((l, i) => (
          <SvgText
            key={i} x={pts[i].x} y={CHART_H - 4}
            textAnchor="middle" fontSize="9" fill={COLORS.textTertiary}
          >
            {l}
          </SvgText>
        ))}

        {/* Cursor overlay */}
        {cursor && (
          <G>
            {/* Vertical dashed rule */}
            <Line
              x1={cursor.x} y1={PAD.top}
              x2={cursor.x} y2={PAD.top + INNER_H}
              stroke={COLORS.brandPrimary}
              strokeWidth={1.5}
              strokeDasharray="4,3"
              opacity="0.55"
            />
            {/* Highlighted point */}
            <Circle
              cx={cursor.x} cy={cursor.y} r={7}
              fill={COLORS.brandPrimary}
              stroke={COLORS.cardBg}
              strokeWidth={2.5}
            />
            {/* Tooltip pill */}
            <Rect
              x={tipCx - 30} y={tipCy - 12}
              width={60} height={22}
              rx={11} ry={11}
              fill={COLORS.brandPrimary}
            />
            <SvgText
              x={tipCx} y={tipCy + 3}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={COLORS.white}
            >
              {fmtVal(cursor.v)}
            </SvgText>
          </G>
        )}
      </Svg>
    </View>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function MovementAnalyticsScreen() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState('All');
  const [period, setPeriod]       = useState<'7D' | '1M' | '3M'>('1M');

  const filtered   = activeCat === 'All'
    ? FAST_MOVING
    : FAST_MOVING.filter(i => i.category === activeCat);
  const trendData  = TREND_DATA[period];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fast Moving Items</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period toggle */}
      <View style={styles.periodRow}>
        {(['7D', '1M', '3M'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPI strip */}
      <View style={styles.kpiRow}>
        {[
          { label: 'Fast-Moving SKUs', value: '130',  icon: 'flash-outline',       color: '#7C3AED' },
          { label: 'Total Units Sold', value: '7.1K', icon: 'trending-up-outline', color: '#2D7D46' },
          { label: 'Avg Velocity',     value: '54/d', icon: 'speedometer-outline', color: '#2563EB' },
        ].map(k => (
          <View key={k.label} style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: k.color + '18' }]}>
              <Ionicons name={k.icon as any} size={18} color={k.color} />
            </View>
            <Text style={styles.kpiVal}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Interactive trend chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <Ionicons name="stats-chart-outline" size={15} color={COLORS.textPrimary} />
              <Text style={styles.chartTitle}>Sales Trend</Text>
            </View>
            <View style={styles.chartHintRow}>
              <Ionicons name="finger-print-outline" size={13} color={COLORS.textTertiary} />
              <Text style={styles.chartHint}>Touch to inspect</Text>
            </View>
          </View>
          {/* key=period remounts chart when period changes, resetting cursor */}
          <SalesLineChart key={period} values={trendData.values} labels={trendData.labels} />
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, activeCat === cat && styles.catChipActive]}
              onPress={() => setActiveCat(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catText, activeCat === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Ranked item list */}
        <Text style={styles.sectionTitle}>Top Fast-Moving Items</Text>
        {filtered.map((item, idx) => {
          const vc     = VELOCITY_CONFIG[item.velocity as keyof typeof VELOCITY_CONFIG];
          const barPct = (item.sales / maxSales) * 100;
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <Text style={styles.rank}>{idx + 1}</Text>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemSku}>{item.sku} · {item.category}</Text>
                </View>
                <View style={[styles.velocityBadge, { backgroundColor: vc.bg }]}>
                  <Text style={[styles.velocityText, { color: vc.color }]}>{item.velocity}</Text>
                </View>
              </View>
              <View style={styles.barRow}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barPct}%` as any, backgroundColor: vc.color }]} />
                </View>
                <Text style={styles.salesVal}>{item.sales.toLocaleString()}</Text>
                <Text style={[styles.changeVal, { color: item.change >= 0 ? '#2D7D46' : '#DC2626' }]}>
                  {item.change >= 0 ? '+' : ''}{item.change}%
                </Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },

  periodRow:       {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  periodBtn:       {
    paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  periodBtnActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  periodText:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodTextActive:{ color: COLORS.white },

  kpiRow:  {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    padding: SPACING.sm,
  },
  kpiCard: { flex: 1, alignItems: 'center', gap: 4 },
  kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kpiVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  kpiLabel:{ fontSize: 10, color: COLORS.textTertiary, textAlign: 'center' },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 12 },

  chartCard:    {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  chartHeader:  {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  chartTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartTitle:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chartHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartHint:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },

  catRow:       { paddingVertical: 4, gap: 8 },
  catChip:      {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  catChipActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  catText:      { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  catTextActive:{ color: COLORS.white },

  sectionTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  itemCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  itemTop:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rank:     {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.pageBg, textAlign: 'center',
    lineHeight: 22, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemSku:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  velocityBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  velocityText:  { fontSize: 10, fontWeight: '700' },

  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 6, backgroundColor: COLORS.borderDefault, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
  salesVal: { width: 40, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  changeVal:{ width: 40, fontSize: TYPOGRAPHY.xs, fontWeight: '700', textAlign: 'right' },
});
