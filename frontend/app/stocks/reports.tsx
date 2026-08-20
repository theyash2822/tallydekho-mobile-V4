import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_STOCK_REPORTS } from '../../src/data/mockData';

const SW = Dimensions.get('window').width;
const ACCENT = COLORS.info; // minimalist blue accent for the trend
const fmtL = (v: number) => `₹${(v / 1_00_000).toFixed(2)}L`;

// ── Report links ──────────────────────────────────────────────────────────────
interface ReportItem { id: string; label: string; desc: string; icon: string; route: string; }
const REPORTS: ReportItem[] = [
  { id: 'stock-ledger', label: 'Stock Ledger',              desc: 'Item-wise inward & outward log',   icon: 'book-outline',            route: '/stocks/stock-ledger' },
  { id: 'valuation',    label: 'Valuation Summary',         desc: 'Total stock value by category',    icon: 'document-text-outline',   route: '/stocks/valuation-summary' },
  { id: 'expiry',       label: 'Expiry Schedule',           desc: 'Items expiring by date',           icon: 'timer-outline',           route: '/stocks/expiry-schedule' },
  { id: 'fast-slow',    label: 'Fast vs Slow Moving',       desc: 'Velocity analysis of all SKUs',    icon: 'swap-horizontal-outline', route: '/stocks/fast-slow' },
  { id: 'transfer',     label: 'Transfer History',          desc: 'Inter-warehouse stock transfers',  icon: 'repeat-outline',          route: '/stocks/transfer-history' },
  { id: 'snapshot',     label: 'Stock Snapshot',            desc: 'Point-in-time stock position',     icon: 'camera-outline',          route: '/stocks/stock-snapshot' },
  { id: 'negative',     label: 'Negative Stock Exceptions', desc: 'Items with below-zero quantities', icon: 'alert-circle-outline',    route: '/stocks/negative-stock' },
];

// ── Interactive Stock Value Trend (tap a point to see its value) ───────────────
function TrendAreaChart({ data }: { data: { label: string; value: number }[] }) {
  const [sel, setSel] = useState(data.length - 1);
  const W = SW - SPACING.md * 2 - SPACING.md * 2;
  const H = 120;
  const PAD = 10;
  const vals = data.map(d => d.value);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const pts = data.map((d, i) => ({
    x: PAD + i * stepX,
    y: PAD + (1 - (d.value - min) / range) * (H - PAD * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;
  const sp = pts[sel];

  return (
    <View style={{ width: W, height: H + 22 }}>
      <Svg width={W} height={H + 22}>
        <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={COLORS.borderDefault} strokeWidth={1} />
        {/* selected vertical guide */}
        <Line x1={sp.x} y1={PAD} x2={sp.x} y2={H - PAD} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
        <Path d={area} fill="rgba(37,99,235,0.08)" />
        <Path d={line} stroke={ACCENT} strokeWidth={2} fill="none" />
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === sel ? 5 : 2.5}
            fill={i === sel ? ACCENT : COLORS.cardBg}
            stroke={ACCENT}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {/* value tooltip pill above the selected point */}
      <View style={[t.tip, { left: Math.min(Math.max(sp.x - 26, 0), W - 52), top: Math.max(sp.y - 30, 0) }]} pointerEvents="none">
        <Text style={t.tipTxt}>₹{data[sel].value.toFixed(1)}L</Text>
      </View>

      {/* touch targets + x labels */}
      <View style={StyleSheet.absoluteFill}>
        {pts.map((p, i) => (
          <TouchableOpacity
            key={i}
            testID={`trend-point-${i}`}
            activeOpacity={0.6}
            onPress={() => setSel(i)}
            style={{ position: 'absolute', left: p.x - 18, top: 0, width: 36, height: H }}
          />
        ))}
        {data.map((d, i) => (
          <Text
            key={i}
            style={[t.xlabel, { left: pts[i].x - 18, width: 36, color: i === sel ? COLORS.textPrimary : COLORS.textTertiary }]}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const t = StyleSheet.create({
  tip: {
    position: 'absolute',
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    minWidth: 52,
    alignItems: 'center',
  },
  tipTxt: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  xlabel: { position: 'absolute', bottom: 0, fontSize: 9, fontWeight: '600', textAlign: 'center' },
});

// ── Interactive Category Donut ─────────────────────────────────────────────────
function Donut({ data, selected, onSelect, size = 128, stroke = 20 }: {
  data: { label: string; value: number; color: string }[];
  selected: number | null;
  onSelect: (i: number) => void;
  size?: number; stroke?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.borderDefault} strokeWidth={stroke} fill="none" />
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const active = selected === null || selected === i;
          const el = (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={d.color}
              strokeWidth={selected === i ? stroke + 4 : stroke}
              strokeOpacity={active ? 1 : 0.25}
              fill="none"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              onPress={() => onSelect(i)}
            />
          );
          offset += len;
          return el;
        })}
      </G>
    </Svg>
  );
}

export default function StockReportsScreen() {
  const router = useRouter();
  const d = MOCK_STOCK_REPORTS;
  const compTotal = d.composition.reduce((s, c) => s + c.value, 0);
  const [selCat, setSelCat] = useState<number | null>(null);
  const toggleCat = (i: number) => setSelCat(prev => (prev === i ? null : i));

  const centerVal = selCat === null ? fmtL(compTotal) : fmtL(d.composition[selCat].value);
  const centerLbl = selCat === null ? 'Total' : d.composition[selCat].label;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Reports</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Summary strip ── */}
        <View style={s.summary}>
          <View style={s.sumCell}>
            <View style={[s.sumDot, { backgroundColor: ACCENT }]} />
            <Text style={s.sumValue}>{d.totalValue}</Text>
            <Text style={s.sumLabel}>Total Value</Text>
          </View>
          <View style={s.sumSep} />
          <View style={s.sumCell}>
            <View style={[s.sumDot, { backgroundColor: COLORS.warning }]} />
            <Text style={s.sumValue}>{d.totalSkus}</Text>
            <Text style={s.sumLabel}>SKUs</Text>
          </View>
          <View style={s.sumSep} />
          <View style={s.sumCell}>
            <View style={[s.sumDot, { backgroundColor: COLORS.positive }]} />
            <Text style={s.sumValue}>{d.turnover}</Text>
            <Text style={s.sumLabel}>Turnover</Text>
          </View>
        </View>

        {/* ── Stock Value Trend ── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardTitle}>Stock Value Trend</Text>
              <Text style={s.cardSub}>Tap a point to see its value</Text>
            </View>
            <View style={[s.trendPill, { backgroundColor: d.valueTrendPositive ? COLORS.positiveBg : COLORS.negativeBg }]}>
              <Ionicons
                name={d.valueTrendPositive ? 'trending-up' : 'trending-down'}
                size={13}
                color={d.valueTrendPositive ? COLORS.positive : COLORS.negative}
              />
              <Text style={[s.trendTxt, { color: d.valueTrendPositive ? COLORS.positive : COLORS.negative }]}>
                {d.valueTrendPositive ? '+' : ''}{d.valueTrend}%
              </Text>
            </View>
          </View>
          <TrendAreaChart data={d.trend} />
        </View>

        {/* ── Value by Category (interactive donut) ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Value by Category</Text>
          <View style={s.donutRow}>
            <View style={s.donutWrap}>
              <Donut data={d.composition} selected={selCat} onSelect={toggleCat} />
              <View style={s.donutCenter}>
                <Text style={s.donutCenterVal}>{centerVal}</Text>
                <Text style={s.donutCenterLbl} numberOfLines={1}>{centerLbl}</Text>
              </View>
            </View>
            <View style={s.legend}>
              {d.composition.map((c, i) => {
                const pct = Math.round((c.value / compTotal) * 100);
                const active = selCat === i;
                return (
                  <TouchableOpacity
                    key={c.label}
                    testID={`legend-${i}`}
                    style={[s.legendRow, active && s.legendRowActive]}
                    activeOpacity={0.7}
                    onPress={() => toggleCat(i)}
                  >
                    <View style={[s.legendDot, { backgroundColor: c.color }]} />
                    <Text style={[s.legendLabel, active && { color: COLORS.textPrimary }]} numberOfLines={1}>{c.label}</Text>
                    <Text style={s.legendPct}>{pct}%</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── All Reports list ── */}
        <Text style={s.sectionLabel}>All Reports</Text>
        <View style={s.listCard}>
          {REPORTS.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity style={s.row} onPress={() => router.push(item.route as any)} activeOpacity={0.7}>
                <View style={s.iconBox}>
                  <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
                </View>
                <View style={s.rowInfo}>
                  <Text style={s.rowLabel}>{item.label}</Text>
                  <Text style={s.rowDesc}>{item.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {idx < REPORTS.length - 1 && <View style={s.divider} />}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  scroll: { padding: SPACING.md, gap: SPACING.md },

  // Summary strip
  summary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingVertical: 14,
  },
  sumCell: { flex: 1, alignItems: 'center', gap: 3 },
  sumDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 2 },
  sumValue: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  sumLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  sumSep: { width: 1, height: 34, backgroundColor: COLORS.borderDefault },

  // Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.1 },
  cardSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2, fontWeight: '500' },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  trendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // Donut
  donutRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.md },
  donutWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', pointerEvents: 'none' },
  donutCenterVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  donutCenterLbl: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', marginTop: 1, maxWidth: 90, textAlign: 'center' },
  legend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 6, borderRadius: RADIUS.sm },
  legendRowActive: { backgroundColor: COLORS.pageBg },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  legendPct: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '700' },

  // Section label
  sectionLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, marginBottom: -4, paddingLeft: 4,
  },

  // List
  listCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  rowDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md + 40 + 12 },
});
