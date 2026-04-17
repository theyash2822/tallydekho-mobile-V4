import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART  (brand-toned 3-segment ring)
// ─────────────────────────────────────────────────────────────────────────────
const DS   = 104;          // total svg canvas size
const R_O  = 46;           // outer radius
const R_I  = 30;           // inner (hole) radius
const CXY  = DS / 2;       // centre x & y

function f(n: number) { return n.toFixed(2); }

function DonutChart({ segments }: { segments: { pct: number; color: string }[] }) {
  let angle = -Math.PI / 2;
  const paths = segments.map((seg, i) => {
    const sweep  = (seg.pct / 100) * 2 * Math.PI;
    const startA = angle;
    angle        += sweep;
    const endA   = angle;
    const large  = sweep > Math.PI ? 1 : 0;
    const o1 = { x: CXY + R_O * Math.cos(startA), y: CXY + R_O * Math.sin(startA) };
    const o2 = { x: CXY + R_O * Math.cos(endA),   y: CXY + R_O * Math.sin(endA)   };
    const i1 = { x: CXY + R_I * Math.cos(startA), y: CXY + R_I * Math.sin(startA) };
    const i2 = { x: CXY + R_I * Math.cos(endA),   y: CXY + R_I * Math.sin(endA)   };
    const d = [
      `M ${f(o1.x)} ${f(o1.y)}`,
      `A ${R_O} ${R_O} 0 ${large} 1 ${f(o2.x)} ${f(o2.y)}`,
      `L ${f(i2.x)} ${f(i2.y)}`,
      `A ${R_I} ${R_I} 0 ${large} 0 ${f(i1.x)} ${f(i1.y)}`,
      'Z',
    ].join(' ');
    return <Path key={i} d={d} fill={seg.color} />;
  });
  return (
    <Svg width={DS} height={DS}>
      {paths}
      {/* inner hole */}
      <Circle cx={CXY} cy={CXY} r={R_I - 1} fill={COLORS.cardBg} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${Math.min(100, pct)}%` as any }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CARD HEADER
// ─────────────────────────────────────────────────────────────────────────────
function CardHeader({
  icon, title, onPress,
}: { icon: string; title: string; onPress: () => void }) {
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

function Divider() {
  return <View style={s.divider} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// E-WAY BILL SEGMENTS  (brand-toned)
// ─────────────────────────────────────────────────────────────────────────────
const EWB_SEGMENTS = [
  { pct: 32, color: COLORS.brandPrimary, label: 'Active',        value: '32%' },
  { pct: 21, color: '#A89060',           label: 'Expiring soon', value: '21%' },
  { pct: 47, color: COLORS.borderStrong, label: 'Expired',       value: '47%' },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ComplianceHubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Compliance</Text>
        {/* placeholder to keep title centered */}
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 1. GST ────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader
            icon="document-text-outline"
            title="GST"
            onPress={() => router.push('/reports/gst' as any)}
          />
          <Divider />

          {/* Filing-status stats row */}
          <View style={s.gstRow}>
            <View style={s.gstCell}>
              <Text style={s.gstMuted}>Filing Status</Text>
            </View>

            <View style={s.gstSep} />

            <View style={s.gstCell}>
              <View style={s.pendingBadge}>
                <Text style={s.pendingTxt}>Pending</Text>
              </View>
            </View>

            <View style={s.gstSep} />

            <View style={s.gstCell}>
              <Text style={s.gstMuted}>Unmatched</Text>
            </View>

            <View style={s.gstSep} />

            <View style={s.gstCell}>
              <Text style={s.gstBigNum}>7</Text>
            </View>
          </View>
        </View>

        {/* ── 2. E-Way Bill ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader
            icon="car-outline"
            title="E-Way Bill"
            onPress={() => router.push('/reports/ewb-compliance' as any)}
          />
          <Divider />

          <View style={s.ewbBody}>
            <DonutChart segments={EWB_SEGMENTS} />

            {/* Legend */}
            <View style={s.legendCol}>
              {EWB_SEGMENTS.map(seg => (
                <View key={seg.label} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={s.legendLbl}>{seg.label}</Text>
                  <Text style={s.legendVal}>{seg.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── 3. E-Invoicing ────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader
            icon="receipt-outline"
            title="E-Invoicing"
            onPress={() => router.push('/reports/einvoice-compliance' as any)}
          />
          <Divider />

          <View style={s.progressBody}>
            <View style={s.progressRow}>
              <Text style={s.progressLbl}>Unreconciled vouchers</Text>
              <Text style={s.progressNum}>14</Text>
            </View>
            <ProgressBar pct={80} />
          </View>
        </View>

        {/* ── 4. Other Taxes ────────────────────────────────────────────── */}
        <View style={s.card}>
          <CardHeader
            icon="calculator-outline"
            title="Other Taxes"
            onPress={() => router.push('/reports/other-taxes' as any)}
          />
          <Divider />

          <View style={s.progressBody}>
            <View style={s.progressRow}>
              <Text style={s.progressLbl}>TDS Pending</Text>
              <Text style={s.progressNum}>14</Text>
            </View>
            <ProgressBar pct={40} />
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

  // ── Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  // ── Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: SPACING.md, gap: SPACING.sm },

  // ── Card Shell
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.borderDefault },

  // ── Card header row
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

  // ── GST row
  gstRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 16,
  },
  gstCell:   { flex: 1, alignItems: 'center' },
  gstSep:    { width: 1, height: 30, backgroundColor: COLORS.borderDefault },
  gstMuted:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  gstBigNum: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },

  // Pending badge
  pendingBadge: {
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  pendingTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },

  // ── E-Way Bill body
  ewbBody: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  legendCol: { flex: 1, gap: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLbl: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  legendVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // ── Progress section
  progressBody: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 10,
  },
  progressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  progressLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  progressNum: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },

  // Progress bar
  barTrack: {
    height: 8, backgroundColor: COLORS.borderDefault,
    borderRadius: RADIUS.full, overflow: 'hidden',
  },
  barFill: {
    height: '100%' as any,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.full,
  },
});
