import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Pressable, PanResponder, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getAlerts } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from 'react-i18next';

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
// EWB segments computed dynamically inside component

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ComplianceHubScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const { company, selectedFY } = useAuth();

  // Real alert counts from backend — re-fetch when FY changes
  const [alerts, setAlerts] = useState<any>(null);

  const fetchAlerts = useCallback(() => {
    if (!company?.guid) return;
    const fyParam = fyInfoToParam(selectedFY);
    getAlerts(company.guid, fyParam ? { fy: fyParam } : undefined)
      .then((res: any) => { if (res?.data) setAlerts(res.data); })
      .catch(() => {});
  }, [company?.guid, selectedFY]);

  // Re-fetch when FY or company changes
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Re-fetch when screen comes back into focus (catches FY changes on other screens)
  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

  const pendingIRN      = alerts?.pendingIRNCount   ?? 0;
  const pendingEWB      = alerts?.pendingEWBCount   ?? 0;
  const expiredEWB      = alerts?.expiredEWBCount   ?? 0;
  const ewbGenerated    = alerts?.ewbGeneratedCount ?? 0;
  const irnGenerated    = alerts?.irnGeneratedCount ?? 0;
  const unmatchedGST    = alerts?.unmatchedGSTCount ?? 0;
  const gstPercent      = alerts?.gstPercent        ?? 0;
  const gstStatus       = alerts?.gstStatus         ?? 'Pending';
  const otherTaxCount   = alerts?.otherTaxCount     ?? 0;
  const otherTaxTotal   = alerts?.otherTaxTotal     ?? 0;
  const otherTaxTopType = alerts?.otherTaxTopType   ?? null;

  // E-Invoice: pending IRN + progress %
  const irnTotal       = pendingIRN + irnGenerated;
  const irnProgressPct = irnTotal > 0 ? Math.round((irnGenerated / irnTotal) * 100) : 0;

  // EWB: always show all 3 segments — use 0 when no data, grey ring when total=0
  const ewbTotal = ewbGenerated + pendingEWB + expiredEWB;
  const ewbDonutSegs = ewbTotal > 0
    ? [
        { pct: Math.round((ewbGenerated / ewbTotal) * 100), color: '#2D7D46', label: 'Generated',  value: `${ewbGenerated}`,  count: `${ewbGenerated} bill${ewbGenerated !== 1 ? 's' : ''} generated` },
        { pct: Math.round((pendingEWB   / ewbTotal) * 100), color: '#D97706', label: 'Pending',    value: `${pendingEWB}`,    count: `${pendingEWB} bill${pendingEWB !== 1 ? 's' : ''} pending` },
        { pct: Math.round((expiredEWB   / ewbTotal) * 100), color: '#DC2626', label: 'Expired',    value: `${expiredEWB}`,    count: `${expiredEWB} bill${expiredEWB !== 1 ? 's' : ''} expired` },
      ].filter(s => s.pct > 0) // remove 0-pct slices from donut only; pills still rendered below
    : [{ pct: 100, color: COLORS.borderStrong, label: 'No Data', value: '—', count: 'No EWBs in this period' }];

  // Always 3 pill rows regardless of data
  const ewbPillRows = [
    { color: '#2D7D46', label: 'Generated',  value: ewbGenerated > 0 ? `${ewbGenerated}` : '0', count: `${ewbGenerated} bills generated` },
    { color: '#D97706', label: 'Pending',    value: pendingEWB   > 0 ? `${pendingEWB}`   : '0', count: `${pendingEWB} bills pending` },
    { color: '#DC2626', label: 'Expired',    value: expiredEWB   > 0 ? `${expiredEWB}`   : '0', count: `${expiredEWB} bills expired` },
  ];

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
        <View style={{ alignItems: 'center' }}>
          <Text style={s.headerTitle}>{t('reports.compliance')}</Text>
          {selectedFY && (
            <Text style={s.headerFY}>{selectedFY.finYear || (selectedFY.startDate ? `FY ${selectedFY.startDate.slice(0,4)}-${(parseInt(selectedFY.startDate.slice(0,4))+1).toString().slice(2)}` : '')}</Text>
          )}
        </View>
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

              {/* Filing status badge — N/A until GST portal integration is live */}
              <View style={s.gstCell}>
                <View style={[s.pendingBadge, s.pendingBadgeNA]}>
                  <Text style={s.pendingTxt}>N/A</Text>
                </View>
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
                <Text style={s.gstBigNum}>{unmatchedGST}</Text>
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
            <DonutChart segments={ewbDonutSegs} />

            {/* Tappable legend rows */}
            <View style={s.legendCol}>
              {ewbPillRows.map((seg, i) => (
                <Pressable
                  key={seg.label}
                  style={[s.legendRow, activeEwb === i && s.legendRowActive]}
                  onPress={() => toggleEwb(i)}
                >
                  <View style={[s.legendDot, { backgroundColor: seg.value === '0' ? COLORS.borderStrong : seg.color }]} />
                  <Text style={s.legendLbl}>{seg.label}</Text>
                  <Text style={[s.legendVal, { color: seg.value === '0' ? COLORS.textTertiary : COLORS.textPrimary }]}>{seg.value}</Text>
                  {activeEwb === i
                    ? <Ionicons name="chevron-up"   size={12} color={COLORS.textTertiary} />
                    : <Ionicons name="chevron-down" size={12} color={COLORS.textTertiary} />}
                </Pressable>
              ))}

              {/* Expanded count row */}
              {activeEwb !== null && (
                <View style={s.ewbCountRow}>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.textTertiary} />
                  <Text style={s.ewbCountTxt}>{ewbPillRows[activeEwb].count}</Text>
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
              <Text style={s.progressLbl}>Pending IRN</Text>
              <Pressable
                onPress={einvTip.visible ? einvTip.hide : einvTip.show}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.progressNum}>{pendingIRN}</Text>
              </Pressable>
            </View>

            {einvTip.visible && (
              <TooltipChip text={irnTotal > 0 ? `${irnGenerated} of ${irnTotal} invoices have IRN · ${irnProgressPct}% generated` : 'No eligible invoices (≥₹50K) in this period'} />
            )}

            <ProgressBar
              pct={irnProgressPct}
              tooltipText={`${irnGenerated} of ${irnTotal} invoices have IRN · ${irnProgressPct}% generated`}
            />
          </View>
        </View>

        {/* ── 4. Other Taxes ────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader icon="calculator-outline" title="Other Taxes" onPress={() => router.push('/reports/other-taxes' as any)} />
          <Divider />

          <View style={s.progressBody}>
            <View style={s.progressRow}>
              <Text style={s.progressLbl}>
                {otherTaxTopType ? `${otherTaxTopType} Transactions` : 'Tax Transactions'}
              </Text>
              <Pressable
                onPress={otherTip.visible ? otherTip.hide : otherTip.show}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={s.progressNum}>{otherTaxCount}</Text>
              </Pressable>
            </View>

            {otherTip.visible && (
              <TooltipChip text={
                otherTaxCount > 0
                  ? `${otherTaxCount} ${otherTaxTopType || 'tax'} transaction${otherTaxCount !== 1 ? 's' : ''} · ₹${Math.round(otherTaxTotal).toLocaleString('en-IN')}`
                  : 'No other tax data in synced Tally vouchers'
              } />
            )}

            <ProgressBar
              pct={otherTaxCount > 0 ? 100 : 0}
              tooltipText={otherTaxCount > 0 ? `₹${Math.round(otherTaxTotal).toLocaleString('en-IN')} total ${otherTaxTopType || 'tax'}` : 'No tax data'}
            />
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
  headerFY:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },

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
  pendingTxt:          { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
  pendingBadgeFiled:   { backgroundColor: COLORS.positive },
  pendingBadgePartial: { backgroundColor: '#A89060' },
  pendingBadgeNA:      { backgroundColor: COLORS.textTertiary },

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
  progressEmptyTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 6 },
});

