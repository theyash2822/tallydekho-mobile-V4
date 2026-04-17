import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

const { width: W } = Dimensions.get('window');
const CARD_INNER = W - SPACING.md * 2 - SPACING.md * 2; // card content width
const DONUT_W = Math.min(140, CARD_INNER * 0.42);

// ── Chart Data ───────────────────────────────────────────────────────────────
const TOTAL_BILLS = 319;
const GENERATED  = 265;

const DONUT_SEGS = [
  { label: 'Generated', pct: 74, count: 236, color: '#2D7D46' },
  { label: 'Pending',   pct: 11, count: 35,  color: '#D97706' },
  { label: 'Errors',    pct: 3,  count: 9,   color: '#DC2626' },
  { label: 'Expiring',  pct: 12, count: 38,  color: '#2563EB' },
];

const BAR_DATA = [4,7,3,8,12,6,9,5,11,8,14,7,10,6,13,9,8,12,7,11,6,9,14,8,10,7,12,5,9,11];
const MAX_BAR = Math.max(...BAR_DATA);

const TRANSPORT = [
  { mode: 'Road', count: 240 },
  { mode: 'Rail', count: 20  },
  { mode: 'Air',  count: 38  },
  { mode: 'Sea',  count: 6   },
];

const RECENT_ACTIVITY = [
  { text: '14 bills generated',  time: '10 Jul 14:42' },
  { text: '9 bills extended',    time: '10 Jul 14:42' },
  { text: '1 bill cancelled',    time: '10 Jul 14:42' },
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
function InteractiveBarChart({
  active, onPress,
}: {
  active: number | null;
  onPress: (i: number | null) => void;
}) {
  const H = 100; const PAD_B = 18; const PAD_T = 18; const chartH = H - PAD_B - PAD_T;
  const barW = 10; const gap = 3;
  const totalW = BAR_DATA.length * (barW + gap);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={totalW} height={H}>
        {BAR_DATA.map((v, i) => {
          const bh = (v / MAX_BAR) * chartH;
          const x = i * (barW + gap);
          const y = PAD_T + chartH - bh;
          const isActive = active === i;
          return (
            <G key={i} onPress={() => onPress(active === i ? null : i)}>
              <Rect
                x={x} y={y} width={barW} height={bh} rx={3}
                fill={isActive ? COLORS.brandPrimary : '#4B7BE5'}
                opacity={active !== null && !isActive ? 0.4 : 0.85}
              />
              {isActive && (
                <>
                  <Rect x={Math.max(0, x - 5)} y={y - 20} width={20} height={16} rx={3} fill={COLORS.brandPrimary} />
                  <SvgText x={x + barW / 2} y={y - 9} textAnchor="middle" fontSize={8} fontWeight="700" fill="#FFF">{v}</SvgText>
                </>
              )}
              {(i === 0 || (i + 1) % 7 === 0) && (
                <SvgText x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={6.5} fill={COLORS.textTertiary}>
                  {`${i + 1} Aug`}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EWBComplianceScreen() {
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
        <Text style={s.headerTitle}>E-Way Bill</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons
            name="calendar-outline" size={20}
            color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary}
          />
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
              <Text style={s.statLabel}>Pending Gen</Text>
              <Text style={s.statValue}>33</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>Errors</Text>
              <Text style={[s.statValue, { color: '#DC2626' }]}>9</Text>
            </View>
          </View>
          <View style={s.statDivH} />
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>Expiring {'<'}24h</Text>
              <Text style={[s.statValue, { color: '#D97706' }]}>12</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>Generated</Text>
              <Text style={[s.statValue, { color: '#2D7D46' }]}>{GENERATED}</Text>
            </View>
          </View>
        </View>

        {/* Generated CTA */}
        <TouchableOpacity
          style={s.generatedBtn}
          onPress={() => router.push('/reports/ewb-list' as any)}
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
                    <Text style={[s.legendLbl, activeSeg === i && { color: COLORS.textPrimary, fontWeight: '700' }]}>
                      {seg.label}
                    </Text>
                    <Text style={[s.legendPct, { color: seg.color }]}>{seg.pct}%</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {/* Touch tooltip */}
          {activeSeg !== null && (
            <View style={[s.tooltip, { borderLeftColor: DONUT_SEGS[activeSeg].color }]}>
              <Text style={s.tooltipTxt}>
                <Text style={{ fontWeight: '800', color: DONUT_SEGS[activeSeg].color }}>
                  {DONUT_SEGS[activeSeg].label}
                </Text>
                {`  —  ${DONUT_SEGS[activeSeg].count} bills  (${DONUT_SEGS[activeSeg].pct}%)`}
              </Text>
            </View>
          )}
        </View>

        {/* Bar Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bills generated per day (Aug 1–31)</Text>
          <InteractiveBarChart active={activeBar} onPress={setActiveBar} />
          {activeBar !== null && (
            <View style={s.tooltip}>
              <Text style={s.tooltipTxt}>
                <Text style={{ fontWeight: '800', color: COLORS.textPrimary }}>{`Aug ${activeBar + 1}`}</Text>
                {`  —  ${BAR_DATA[activeBar]} bills generated`}
              </Text>
            </View>
          )}
        </View>

        {/* Transport Mode */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Transport Mode</Text>
          <View style={s.modesGrid}>
            {TRANSPORT.map((tm) => (
              <View key={tm.mode} style={s.modeCell}>
                <Text style={s.modeName}>{tm.mode}</Text>
                <Text style={s.modeCount}>{tm.count}</Text>
              </View>
            ))}
          </View>
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
          onPress={() => Linking.openURL('https://ewaybillgst.gov.in/')}
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

  // Stats
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

  // Generated CTA
  generatedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, marginBottom: SPACING.sm,
  },
  generatedBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },

  // Card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },

  // Donut layout
  donutRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendList: { flex: 1, gap: 8 },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 3, paddingHorizontal: 6, borderRadius: 6,
  },
  legendItemActive: { backgroundColor: COLORS.pageBg },
  legendDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  legendLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  legendPct: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' },

  // Tooltip (shared for both charts)
  tooltip: {
    marginTop: 12, borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary,
    paddingLeft: 10, paddingVertical: 9,
    backgroundColor: COLORS.pageBg, borderRadius: 6,
  },
  tooltipTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  // Transport
  modesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeCell: {
    width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  modeName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  modeCount: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },

  // Activity
  actRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
  },
  actBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  actTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  actTime:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  // View Details
  viewDetailsBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center', marginBottom: SPACING.sm,
  },
  viewDetailsTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
});
