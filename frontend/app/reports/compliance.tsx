import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Pressable, PanResponder, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getAlerts } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';

const W = Dimensions.get('window').width;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY — auto-dismiss tooltip helper
// ─────────────────────────────────────────────────────────────────────────────
function useToggleTip(delay = 2800) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), delay);
  }, [delay]);
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);
  return { visible, show, hide };
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE TOOLTIP CHIP
// ─────────────────────────────────────────────────────────────────────────────
function TooltipChip({ text }: { text: string }) {
  return (
    <View style={t.chip}>
      <Text style={t.chipTxt}>{text}</Text>
    </View>
  );
}

const t = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 6,
  },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.white, lineHeight: 16 },
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
interface ProgressBarProps {
  pct:         number;
  tooltipText: string;
}

function ProgressBar({ pct, tooltipText }: ProgressBarProps) {
  const [touchX,   setTouchX]   = useState<number | null>(null);
  const [barWidth, setBarWidth]  = useState(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:     () => true,
      onMoveShouldSetPanResponder:      () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setTouchX(e.nativeEvent.locationX);
      },
      onPanResponderMove:    (e) => setTouchX(e.nativeEvent.locationX),
      onPanResponderRelease: () => {
        hideTimer.current = setTimeout(() => setTouchX(null), 2000);
      },
    })
  ).current;

  return (
    <View>
      {/* Floating tooltip above bar */}
      {touchX !== null && (
        <View style={[pb.tooltip, {
          left: Math.max(0, Math.min(barWidth - 120, touchX - 60)),
        }]}>
          <Text style={pb.tooltipTxt}>{tooltipText}</Text>
        </View>
      )}
      <View
        {...pan.panHandlers}
        style={pb.track}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <View style={[pb.fill, { width: `${Math.min(100, pct)}%` as any }]} />
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  track:   { height: 8, backgroundColor: COLORS.borderDefault, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill:    { height: '100%' as any, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.full },
  tooltip: {
    position: 'absolute', bottom: 14,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10, paddingVertical: 5,
    zIndex: 10, minWidth: 110,
  },
  tooltipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
});

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART
// ─────────────────────────────────────────────────────────────────────────────
const DS  = 104;
const R_O = 46;
const R_I = 30;
const CXY = DS / 2;

function ff(n: number) { return n.toFixed(2); }

function DonutChart({ segments }: { segments: { pct: number; color: string }[] }) {
  let angle = -Math.PI / 2;
  const paths = segments.map((seg, i) => {
    const sweep  = (seg.pct / 100) * 2 * Math.PI;
    const startA = angle;
    angle       += sweep;
    const endA   = angle;
    const large  = sweep > Math.PI ? 1 : 0;
    const o1 = { x: CXY + R_O * Math.cos(startA), y: CXY + R_O * Math.sin(startA) };
    const o2 = { x: CXY + R_O * Math.cos(endA),   y: CXY + R_O * Math.sin(endA)   };
    const i1 = { x: CXY + R_I * Math.cos(startA), y: CXY + R_I * Math.sin(startA) };
    const i2 = { x: CXY + R_I * Math.cos(endA),   y: CXY + R_I * Math.sin(endA)   };
    const d = [
      `M ${ff(o1.x)} ${ff(o1.y)}`,
      `A ${R_O} ${R_O} 0 ${large} 1 ${ff(o2.x)} ${ff(o2.y)}`,
      `L ${ff(i2.x)} ${ff(i2.y)}`,
      `A ${R_I} ${R_I} 0 ${large} 0 ${ff(i1.x)} ${ff(i1.y)}`,
      'Z',
    ].join(' ');
    return <Path key={i} d={d} fill={seg.color} />;
  });
  return (
    <Svg width={DS} height={DS}>
      {paths}
      <Circle cx={CXY} cy={CXY} r={R_I - 1} fill={COLORS.cardBg} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CARD HEADER
// ─────────────────────────────────────────────────────────────────────────────
function CardHeader({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.cardHeader} onPress={onPress} activeOpacity={0.78}>
      <View style={s.cardIconWrap}>
        <Ionicons name={icon as any} size={20} color={COLORS.brandPrimary} />
      </View>
      <Text style={s.cardTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

function Divider() { return <View style={s.divider} />; }

// ─────────────────────────────────────────────────────────────────────────────
// EWB SEGMENT DATA  (with bill counts)
// ─────────────────────────────────────────────────────────────────────────────
const EWB_SEGMENTS = [
  { pct: 0, color: COLORS.brandPrimary, label: 'Active',        value: '0%', count: '0 bills active' },
  { pct: 0, color: '#A89060',           label: 'Expiring soon', value: '0%', count: '0 bills · — days left' },
  { pct: 100, color: COLORS.borderStrong, label: 'No Data',     value: '—',  count: 'Sync EWB data first' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ComplianceHubScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const { company } = useAuth();

  // Real alert counts from backend
  const [alerts, setAlerts] = useState<any>(null);
  useEffect(() => {
    if (company?.guid) {
      getAlerts(company.guid).then((res: any) => {
        if (res?.data) setAlerts(res.data);
      }).catch(() => {});
    }
  }, [company?.guid]);

  const pendingIRN  = alerts?.pendingIRNCount  ?? 0;
  const pendingEWB  = alerts?.pendingEWBCount  ?? 0;
  const unmatchedGST = alerts?.unmatchedGSTCount ?? 0;

  // GST tooltips
  const pendingTip  = useToggleTip();
  const unmatchedTip = useToggleTip();

  // E-Way Bill — expand one legend row at a time
  const [activeEwb, setActiveEwb] = useState<number | null>(null);
  const toggleEwb = (i: number) => setActiveEwb(prev => prev === i ? null : i);

  // E-Invoicing count tooltip
  const einvTip = useToggleTip();

  // Other Taxes count tooltip
  const otherTip = useToggleTip();

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Compliance</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── 1. GST ────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader icon="document-text-outline" title="GST" onPress={() => router.push('/reports/gst' as any)} />
          <Divider />

          <View style={s.gstOuter}>
            <View style={s.gstRow}>

              {/* Filing Status — static label */}
              <View style={s.gstCell}>
                <Text style={s.gstMuted}>Filing Status</Text>
              </View>

              <View style={s.gstSep} />

              {/* Pending badge — tap for invoice count tooltip */}
              <View style={s.gstCell}>
                <Pressable
                  style={s.pendingBadge}
                  onPress={pendingTip.visible ? pendingTip.hide : pendingTip.show}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={s.pendingTxt}>Pending</Text>
                </Pressable>
              </View>

              <View style={s.gstSep} />

              {/* Unmatched + 7 — tap to open unmatched list */}
              <Pressable
                style={[s.gstCell, s.unmatchedGroup]}
                onPress={() => router.push('/reports/unmatched-list' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.gstMuted}>Unmatched</Text>
              </Pressable>

              <View style={s.gstSep} />

              <Pressable
                style={s.gstCell}
                onPress={() => router.push('/reports/unmatched-list' as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[s.gstBigNum, s.gstNumLink]}>{unmatchedGST}</Text>
              </Pressable>
            </View>

            {/* Pending tooltip */}
            {pendingTip.visible && (
              <View style={s.gstTooltipRow}>
                <TooltipChip text={`${pendingIRN} invoice${pendingIRN !== 1 ? 's' : ''} pending for IRN / GSTR-1 filing`} />
              </View>
            )}
          </View>
        </View>

        {/* ── 2. E-Way Bill ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader icon="car-outline" title="E-Way Bill" onPress={() => router.push('/reports/ewb-compliance' as any)} />
          <Divider />

          <View style={s.ewbBody}>
            <DonutChart segments={EWB_SEGMENTS} />

            {/* Tappable legend rows */}
            <View style={s.legendCol}>
              {EWB_SEGMENTS.map((seg, i) => (
                <Pressable
                  key={seg.label}
                  style={[s.legendRow, activeEwb === i && s.legendRowActive]}
                  onPress={() => toggleEwb(i)}
                >
                  <View style={[s.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={s.legendLbl}>{seg.label}</Text>
                  <Text style={s.legendVal}>{seg.value}</Text>
                  {activeEwb === i && (
                    <Ionicons name="chevron-up" size={12} color={COLORS.textTertiary} />
                  )}
                  {activeEwb !== i && (
                    <Ionicons name="chevron-down" size={12} color={COLORS.textTertiary} />
                  )}
                </Pressable>
              ))}

              {/* Expanded count row */}
              {activeEwb !== null && (
                <View style={s.ewbCountRow}>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.textTertiary} />
                  <Text style={s.ewbCountTxt}>{EWB_SEGMENTS[activeEwb].count}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── 3. E-Invoicing ────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader icon="receipt-outline" title="E-Invoicing" onPress={() => router.push('/reports/einvoice-compliance' as any)} />
          <Divider />

          <View style={s.progressBody}>
            <View style={s.progressRow}>
              <Text style={s.progressLbl}>Unreconciled vouchers</Text>
              <Pressable
                onPress={einvTip.visible ? einvTip.hide : einvTip.show}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[s.progressNum, s.numTappable]}>14</Text>
              </Pressable>
            </View>

            {einvTip.visible && <TooltipChip text="14 of 70 vouchers unreconciled · 80% matched" />}

            <ProgressBar pct={80} tooltipText="80% vouchers reconciled" />
          </View>
        </View>

        {/* ── 4. Other Taxes ────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader icon="calculator-outline" title="Other Taxes" onPress={() => router.push('/reports/other-taxes' as any)} />
          <Divider />

          <View style={s.progressBody}>
            <View style={s.progressRow}>
              <Text style={s.progressLbl}>TDS Pending</Text>
              <Pressable
                onPress={otherTip.visible ? otherTip.hide : otherTip.show}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[s.progressNum, s.numTappable]}>14</Text>
              </Pressable>
            </View>

            {otherTip.visible && <TooltipChip text="TDS: ₹24,500 pending · Due 15 May" />}

            <ProgressBar pct={40} tooltipText="40% TDS challans filed" />
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.md, gap: SPACING.sm },

  // Card shell
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.borderDefault },

  // Card header
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // GST
  gstOuter:        { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  gstRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  gstCell:         { flex: 1, alignItems: 'center' },
  gstSep:          { width: 1, height: 30, backgroundColor: COLORS.borderDefault },
  gstMuted:        { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  gstBigNum:       { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  gstNumLink:      { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  unmatchedGroup:  { gap: 2 },
  gstTooltipRow:   { alignItems: 'center', marginTop: 0, marginBottom: 4 },

  // Pending badge
  pendingBadge: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  pendingTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },

  // E-Way Bill
  ewbBody: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  legendCol:    { flex: 1, gap: 10 },
  legendRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  legendRowActive: { backgroundColor: COLORS.pageBg, paddingHorizontal: 6 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
  legendLbl:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  legendVal:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginRight: 4 },
  ewbCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 4, paddingHorizontal: 2 },
  ewbCountTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },

  // Progress section
  progressBody: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 10 },
  progressRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLbl:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  progressNum:  { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  numTappable:  { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});

