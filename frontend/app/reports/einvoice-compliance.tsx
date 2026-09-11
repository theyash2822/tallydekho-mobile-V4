import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import Svg, { Path, Circle, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getEInvoiceStatus } from '../../src/services/api';
import { fyInfoToParam } from '../../src/context/AuthContext';

const { width: W } = Dimensions.get('window');
const DONUT_W   = Math.min(140, (W - SPACING.md * 4) * 0.42);
const BAR_H     = 140;
const BAR_PAD_T = 18;
const BAR_PAD_B = 18;
const CHART_H   = BAR_H - BAR_PAD_T - BAR_PAD_B;
const BAR_W     = 18;
const BAR_GAP   = 6;
const MAX_Y     = 100;
const Y_AXIS_W  = 28;
const Y_LEVELS  = [0, 25, 50, 75, 100];

// ── Donut ─────────────────────────────────────────────────────────────────────
function EInvDonut({ generated, pending, errors, cancelled }: {
  generated: number; pending: number; errors: number; cancelled: number;
}) {
  const total = generated + pending + errors + cancelled;
  const r = DONUT_W * 0.38; const ir = DONUT_W * 0.26;
  const cx = DONUT_W / 2;   const cy = DONUT_W / 2;

  if (total === 0) {
    return (
      <Svg width={DONUT_W} height={DONUT_W}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.borderDefault} strokeWidth={r - ir} />
        <Circle cx={cx} cy={cy} r={ir - 1} fill={COLORS.cardBg} />
        <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={16} fontWeight="700" fill={COLORS.textTertiary}>0</SvgText>
        <SvgText x={cx} y={cy + 11} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>Total</SvgText>
      </Svg>
    );
  }

  const segs = [
    { label: 'Generated', count: generated, color: '#2D7D46' },
    { label: 'Pending',   count: pending,   color: '#D97706' },
    { label: 'Errors',    count: errors,    color: '#DC2626' },
    { label: 'Cancelled', count: cancelled, color: '#6B7280' },
  ].filter(s => s.count > 0);

  let angle = -Math.PI / 2;
  return (
    <Svg width={DONUT_W} height={DONUT_W}>
      {segs.map(seg => {
        const sweep  = (seg.count / total) * 2 * Math.PI;
        const startA = angle; angle += sweep; const endA = angle;
        const large = sweep > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(startA); const y1 = cy + r * Math.sin(startA);
        const x2 = cx + r * Math.cos(endA);   const y2 = cy + r * Math.sin(endA);
        const xi1 = cx + ir * Math.cos(startA); const yi1 = cy + ir * Math.sin(startA);
        const xi2 = cx + ir * Math.cos(endA);   const yi2 = cy + ir * Math.sin(endA);
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${ir} ${ir} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z`;
        return <Path key={seg.label} d={d} fill={seg.color} />;
      })}
      <Circle cx={cx} cy={cy} r={ir - 1} fill={COLORS.cardBg} />
      <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={16} fontWeight="700" fill={COLORS.textPrimary}>{total}</SvgText>
      <SvgText x={cx} y={cy + 11} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>Total</SvgText>
    </Svg>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────
function EInvBarChart({ data }: { data: number[] }) {
  const bars = data.length > 0 ? data : Array(10).fill(0);
  const totalW = bars.length * (BAR_W + BAR_GAP);
  const maxVal = Math.max(...bars, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ width: Y_AXIS_W, height: BAR_H, paddingBottom: BAR_PAD_B, paddingTop: BAR_PAD_T, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
        {[100, 75, 50, 25, 0].map(v => (
          <Text key={v} style={{ fontSize: 8, color: COLORS.textTertiary, lineHeight: 10 }}>{v}</Text>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <Svg width={totalW} height={BAR_H}>
          {Y_LEVELS.map(v => {
            const gy = BAR_PAD_T + CHART_H - (v / MAX_Y) * CHART_H;
            return <Line key={v} x1={0} y1={gy} x2={totalW} y2={gy} stroke={COLORS.borderDefault} strokeWidth={1} strokeDasharray={v === 0 ? undefined : '4,4'} />;
          })}
          {bars.map((v, i) => {
            const bh = data.length === 0 ? 0 : Math.max((v / maxVal) * CHART_H, v > 0 ? 2 : 0);
            const x  = i * (BAR_W + BAR_GAP);
            const y  = BAR_PAD_T + CHART_H - bh;
            return <Rect key={i} x={x} y={y} width={BAR_W} height={bh} rx={3} fill={data.length === 0 ? COLORS.borderDefault : '#A89060'} />;
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EInvoiceComplianceScreen() {
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const { formatDate } = useSettings();
  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';
  const [fromDate,       setFromDate]       = useState(fyFrom);
  const [toDate,         setToDate]         = useState(fyTo);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [einvStatus,     setEinvStatus]     = useState<any>(null);

  useEffect(() => {
    if (fyFrom && fyTo) {
      setFromDate(fyFrom);
      setToDate(fyTo);
    }
  }, [fyFrom, fyTo]);

  const isDateActive = !!(fromDate && toDate) && (fromDate !== fyFrom || toDate !== fyTo);

  useEffect(() => {
    if (!company?.guid) return;
    const fyParam = fyInfoToParam(selectedFY);
    const params: Record<string, string> = {};
    if (fromDate && toDate) {
      params.from = fromDate;
      params.to = toDate;
    } else if (fyParam) {
      params.fy = fyParam;
    }
    getEInvoiceStatus(company.guid, params)
      .then((res: any) => { if (res?.data) setEinvStatus(res.data); })
      .catch(() => {});
  }, [company?.guid, selectedFY, fromDate, toDate]);

  const generatedCount = einvStatus?.generated_count  ?? 0;
  const pendingCount   = einvStatus?.pending_count    ?? 0;
  const cancelledCount = einvStatus?.cancelled_count  ?? 0;
  const errorCount     = einvStatus?.error_count      ?? 0;

  const donutSegs = [
    { label: 'Generated', count: generatedCount, color: '#2D7D46' },
    { label: 'Pending',   count: pendingCount,   color: '#D97706' },
    { label: 'Errors',    count: errorCount,     color: '#DC2626' },
    { label: 'Cancelled', count: cancelledCount, color: '#6B7280' },
  ];

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>E-Invoicing</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20}
            color={isDateActive ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Date Strip */}
      <TouchableOpacity style={s.dateStrip} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={13} color={isDateActive ? COLORS.brandPrimary : COLORS.textTertiary} />
        <Text style={[s.dateStripTxt, isDateActive && s.dateStripActive]}>
          {fromDate && toDate ? `${formatDate(fromDate)}  →  ${formatDate(toDate)}` : 'All Dates'}
        </Text>
        {!isDateActive && <Ionicons name="chevron-down" size={11} color={COLORS.textTertiary} />}
        {isDateActive && (
          <TouchableOpacity onPress={() => { setFromDate(fyFrom); setToDate(fyTo); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── KPI Stats 2×2 ──────────────────────────────────────────────── */}
        <View style={s.statsCard}>
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>Pending IRN</Text>
              <Text style={[s.statValue, { color: pendingCount > 0 ? '#D97706' : COLORS.textPrimary }]}>{pendingCount}</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>Errors</Text>
              <Text style={[s.statValue, { color: errorCount > 0 ? '#DC2626' : COLORS.textPrimary }]}>{errorCount}</Text>
            </View>
          </View>
          <View style={s.statDivH} />
          <View style={s.statsRow}>
            <View style={s.statCell}>
              <Text style={s.statLabel}>Cancelled</Text>
              <Text style={s.statValue}>{cancelledCount}</Text>
            </View>
            <View style={s.statDivV} />
            <View style={s.statCell}>
              <Text style={s.statLabel}>Generated</Text>
              <Text style={[s.statValue, { color: generatedCount > 0 ? '#2D7D46' : COLORS.textPrimary }]}>{generatedCount}</Text>
            </View>
          </View>
        </View>

        {/* ── Generated CTA ──────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.generatedBtn}
          onPress={() => safePush(router, '/reports/einvoice-list' as any)}
          activeOpacity={0.85}
        >
          <Text style={s.generatedBtnTxt}>Generated  {generatedCount}</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* ── Donut + Legend ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.donutRow}>
            <EInvDonut
              generated={generatedCount}
              pending={pendingCount}
              errors={errorCount}
              cancelled={cancelledCount}
            />
            <View style={s.legendList}>
              {donutSegs.map(seg => (
                <View key={seg.label} style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: seg.count > 0 ? seg.color : COLORS.borderStrong }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.legendLbl}>{seg.label}</Text>
                    <Text style={[s.legendCount, { color: seg.count > 0 ? seg.color : COLORS.textTertiary }]}>{seg.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Bar Chart ──────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>IRNs Generated Per Day</Text>
          <EInvBarChart data={[]} />
          {generatedCount === 0 && (
            <Text style={s.chartEmptyTxt}>No IRNs generated in this period</Text>
          )}
        </View>

        {/* ── View Details — NIC portal ───────────────────────────────────── */}
        <TouchableOpacity
          style={s.viewDetailsBtn}
          onPress={() => Linking.openURL('https://einvoice1.gst.gov.in/')}
          activeOpacity={0.85}
        >
          <Ionicons name="open-outline" size={16} color={COLORS.white} />
          <Text style={s.viewDetailsTxt}>View on NIC Portal</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate || fyFrom}
        toDate={toDate || fyTo}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
        onApply={(f, t) => { if (f && t) { setFromDate(f); setToDate(t); } }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      {
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
  statsRow:  { flexDirection: 'row' },
  statCell:  { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  statDivV:  { width: 1, backgroundColor: COLORS.borderDefault },
  statDivH:  { height: 1, backgroundColor: COLORS.borderDefault },
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

  donutRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  legendList:  { flex: 1, gap: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendLbl:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  legendCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' },

  chartEmptyTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', marginTop: 6 },

  viewDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, marginBottom: SPACING.sm,
  },
  viewDetailsTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
