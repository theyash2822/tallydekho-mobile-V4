import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Rect, Line, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

const { width: W } = Dimensions.get('window');
const DONUT_W = Math.min(140, (W - SPACING.md * 4) * 0.42);

// ── Chart Data ───────────────────────────────────────────────────────────────
const TOTAL_BILLS = 319;
const GENERATED  = 265;

const DONUT_SEGS = [
  { label: 'Generated', pct: 74, count: 236, color: '#2D7D46' },
  { label: 'Pending',   pct: 11, count: 35,  color: '#D97706' },
  { label: 'Errors',    pct: 3,  count: 9,   color: '#DC2626' },
  { label: 'Expiring',  pct: 12, count: 38,  color: '#2563EB' },
];

const BAR_DATA = [22,48,15,58,72,30,65,18,52,38,80,28,44,68,20,55,40,74,32,58,35,66,45,85,40,18,60,76,48,30,55];
const MAX_Y    = 100;
const Y_AXIS_W = 28;

const ERROR_BOARD = [
  { rank: 1, label: 'Amount Mismatch', count: 9 },
  { rank: 2, label: 'GST Mismatch',    count: 5 },
  { rank: 3, label: 'Name Mismatch',   count: 3 },
];

const RECENT_ACTIVITY = [
  { text: '14 IRNs generated',                    time: '10 Jul 14:42' },
  { text: '9 IRNs retry (success 8)',              time: '10 Jul 14:42' },
  { text: '9 IRNs Modified (success 3, Failed 6)', time: '10 Jul 14:42' },
];

// ── Interactive Donut ────────────────────────────────────────────────────────
function InteractiveDonut({
  active, onPress,
}: {
  active: number | null;
  onPress: (i: number | null) => void;
}) {
  const r = DONUT_W * 0.38; const ir = DONUT_W * 0.26;
  const cx = DONUT_W / 2;   const cy = DONUT_W / 2;
  let angle = -Math.PI / 2;
  const paths = DONUT_SEGS.map((seg, i) => {
    const startA = angle;
    const sweep  = (seg.pct / 100) * 2 * Math.PI;
    angle += sweep;
    const endA = angle; const large = sweep > Math.PI ? 1 : 0;
    const outerR = active === i ? r + 5 : r;
    const x1 = cx + outerR * Math.cos(startA); const y1 = cy + outerR * Math.sin(startA);
    const x2 = cx + outerR * Math.cos(endA);   const y2 = cy + outerR * Math.sin(endA);
    const xi1 = cx + ir * Math.cos(startA);    const yi1 = cy + ir * Math.sin(startA);
    const xi2 = cx + ir * Math.cos(endA);      const yi2 = cy + ir * Math.sin(endA);
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${outerR} ${outerR} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${ir} ${ir} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z`;
    return { seg, d, i };
  });
  const dCount = active !== null ? DONUT_SEGS[active].count : TOTAL_BILLS;
  const dLabel = active !== null ? `${DONUT_SEGS[active].pct}%` : 'Total';
  return (
    <Svg width={DONUT_W} height={DONUT_W}>
      {paths.map(({ seg, d, i }) => (
        <G key={i} onPress={() => onPress(active === i ? null : i)}>
          <Path d={d} fill={seg.color} opacity={active !== null && active !== i ? 0.3 : 1} />
        </G>
      ))}
      <Circle cx={cx} cy={cy} r={ir - 1} fill={COLORS.cardBg} />
      <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={16} fontWeight="700" fill={COLORS.textPrimary}>{dCount}</SvgText>
      <SvgText x={cx} y={cy + 11} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>{dLabel}</SvgText>
    </Svg>
  );
}

// ── Interactive Bar Chart ─────────────────────────────────────────────────────
const BAR_H     = 160;
const BAR_PAD_T = 22;
const BAR_PAD_B = 22;
const CHART_H   = BAR_H - BAR_PAD_T - BAR_PAD_B;
const BAR_W     = 18;
const BAR_GAP   = 6;
const Y_LEVELS  = [0, 25, 50, 75, 100];

function InteractiveBarChart({
  active, onPress,
}: {
  active: number | null;
  onPress: (i: number | null) => void;
}) {
  const totalW = BAR_DATA.length * (BAR_W + BAR_GAP);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>

      {/* Fixed Y-axis labels */}
      <View style={{ width: Y_AXIS_W, height: BAR_H, paddingBottom: BAR_PAD_B, paddingTop: BAR_PAD_T, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
        {[100, 75, 50, 25, 0].map(v => (
          <Text key={v} style={{ fontSize: 8, color: COLORS.textTertiary, lineHeight: 10 }}>{v}</Text>
        ))}
      </View>

      {/* Scrollable bars */}
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
        <Svg width={totalW} height={BAR_H}>

          {/* Horizontal dashed grid lines */}
          {Y_LEVELS.map(v => {
            const gy = BAR_PAD_T + CHART_H - (v / MAX_Y) * CHART_H;
            return (
              <Line
                key={v}
                x1={0} y1={gy} x2={totalW} y2={gy}
                stroke={COLORS.borderDefault}
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : '4,4'}
              />
            );
          })}

          {/* Bars */}
          {BAR_DATA.map((v, i) => {
            const bh       = (v / MAX_Y) * CHART_H;
            const x        = i * (BAR_W + BAR_GAP);
            const y        = BAR_PAD_T + CHART_H - bh;
            const isActive = active === i;
            return (
              <G key={i} onPress={() => onPress(active === i ? null : i)}>
                <Rect
                  x={x} y={y} width={BAR_W} height={bh} rx={4}
                  fill={isActive ? COLORS.brandPrimary : '#A89060'}
                  opacity={active !== null && !isActive ? 0.35 : 1}
                />
                {isActive && (
                  <>
                    <Rect x={Math.max(0, x - 4)} y={y - 22} width={26} height={18} rx={4} fill={COLORS.brandPrimary} />
                    <SvgText x={x + BAR_W / 2} y={y - 10} textAnchor="middle" fontSize={9} fontWeight="700" fill="#FFF">{v}</SvgText>
                  </>
                )}
                {(i === 0 || (i + 1) % 7 === 0) && (
                  <SvgText
                    x={x + BAR_W / 2} y={BAR_H - 6}
                    textAnchor="middle" fontSize={8} fill={COLORS.textTertiary}
                  >
                    {i === 0 ? 'Aug' : `${i + 1} Aug`}
                  </SvgText>
                )}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EInvoiceComplianceScreen() {
  const router = useRouter();
  const [fromDate,       setFromDate]       = useState('');
  const [toDate,         setToDate]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeSeg,      setActiveSeg]      = useState<number | null>(null);
  const [activeBar,      setActiveBar]      = useState<number | null>(null);

  const isDateActive = fromDate.length > 0 && toDate.length > 0;

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>E-Invoicing</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Date Strip */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={isDateActive ? COLORS.brandPrimary : COLORS.textTertiary} />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {isDateActive ? `${fromDate}  →  ${toDate}` : 'All Dates'}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* Stats 2×2 grid */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>Pending</Text>
              <Text style={[s.statValue, { color: '#D97706' }]}>33</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>Error</Text>
              <Text style={[s.statValue, { color: '#DC2626' }]}>9</Text>
            </View>
          </View>
          <View style={s.statDivH} />
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>Cancelled</Text>
              <Text style={s.statValue}>0</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>Avg Gen-Time</Text>
              <Text style={[s.statValue, { color: '#2D7D46' }]}>3.4s</Text>
            </View>
          </View>
        </View>

        {/* Generated CTA */}
        <TouchableOpacity
          style={s.generatedBtn}
          onPress={() => router.push('/reports/einvoice-list' as any)}
          activeOpacity={0.85}
        >
          <Text style={s.generatedBtnTxt}>Generated  {GENERATED}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* Donut + Legend */}
        <View style={s.card}>
          <View style={s.donutRow}>
            <InteractiveDonut active={activeSeg} onPress={setActiveSeg} />
            <View style={s.legendList}>
              {DONUT_SEGS.map((seg, i) => (
                <TouchableOpacity
                  key={seg.label}
                  style={[s.legendItem, activeSeg === i && s.legendItemActive]}
                  onPress={() => setActiveSeg(activeSeg === i ? null : i)}
                  activeOpacity={0.7}
                >
                  <View style={[s.legendDot, { backgroundColor: seg.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.legendLbl, activeSeg === i && { color: COLORS.textPrimary, fontWeight: '700' }]}>{seg.label}</Text>
                    <Text style={[s.legendPct, { color: seg.color }]}>{seg.pct}%</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {activeSeg !== null && (
            <View style={[s.tooltip, { borderLeftColor: DONUT_SEGS[activeSeg].color }]}>
              <Text style={s.tooltipTxt}>
                <Text style={{ fontWeight: '800', color: DONUT_SEGS[activeSeg].color }}>
                  {DONUT_SEGS[activeSeg].label}
                </Text>
                {`  —  ${DONUT_SEGS[activeSeg].count} invoices  (${DONUT_SEGS[activeSeg].pct}%)`}
              </Text>
            </View>
          )}
        </View>

        {/* Bar Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Daily Trend Bars (Aug 1–31)</Text>
          <InteractiveBarChart active={activeBar} onPress={setActiveBar} />
          {activeBar !== null && (
            <View style={s.tooltip}>
              <Text style={s.tooltipTxt}>
                <Text style={{ fontWeight: '800', color: COLORS.textPrimary }}>{`Aug ${activeBar + 1}`}</Text>
                {`  —  ${BAR_DATA[activeBar]} IRNs generated`}
              </Text>
            </View>
          )}
        </View>

        {/* Error Leaderboard */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Error Leaderboard</Text>
          {ERROR_BOARD.map((item, idx) => (
            <View key={item.rank} style={[s.errorRow, idx < ERROR_BOARD.length - 1 && s.errorBorder]}>
              <Text style={s.errorRank}>{item.rank}.</Text>
              <Text style={s.errorLbl}>{item.label}</Text>
              <View style={s.errorRight}>
                <Text style={s.errorCount}>{item.count} Bills</Text>
                <Ionicons name="warning" size={16} color="#DC2626" />
              </View>
            </View>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Recent Activity</Text>
          {RECENT_ACTIVITY.map((item, idx) => (
            <View key={idx} style={[s.actRow, idx < RECENT_ACTIVITY.length - 1 && s.actBorder]}>
              <Text style={s.actTxt}>{item.text}</Text>
              <Text style={s.actTime}>{item.time}</Text>
            </View>
          ))}
        </View>

        {/* View Details — opens portal */}
        <TouchableOpacity
          style={s.viewDetailsBtn}
          onPress={() => Linking.openURL('https://einvoice1.gst.gov.in/')}
          activeOpacity={0.85}
        >
          <Text style={s.viewDetailsTxt}>View Details</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
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
    paddingVertical: 9, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dateStripTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  dateStripActive: { color: COLORS.brandPrimary },

  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  statsCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  statsRow: { flexDirection: 'row' },
  statCell: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  statDivV: { width: 1, backgroundColor: COLORS.borderDefault },
  statDivH: { height: 1, backgroundColor: COLORS.borderDefault },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },

  generatedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, marginBottom: SPACING.sm,
  },
  generatedBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },

  donutRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendList: { flex: 1, gap: 8 },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6,
  },
  legendItemActive: { backgroundColor: COLORS.pageBg },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  legendPct: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' },

  tooltip: {
    marginTop: 12, borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary,
    paddingLeft: 10, paddingVertical: 9,
    backgroundColor: COLORS.pageBg, borderRadius: 6,
  },
  tooltipTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  // Error leaderboard
  errorRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  errorBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  errorRank:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textTertiary, width: 22 },
  errorLbl:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  errorRight:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#DC2626' },

  actRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  actBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  actTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  actTime:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  viewDetailsBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginBottom: SPACING.sm,
  },
  viewDetailsTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
});
