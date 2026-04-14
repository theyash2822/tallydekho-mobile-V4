import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CARD_W = W - SPACING.md * 2;

// ── Tiny Donut Chart ──────────────────────────────────────────────────────
function MiniDonut({ segments }: { segments: { pct: number; color: string }[] }) {
  const r = 28; const cx = 36; const cy = 36;
  let angle = -Math.PI / 2;
  const paths: JSX.Element[] = [];
  segments.forEach((seg, i) => {
    const startA = angle;
    const sweep = (seg.pct / 100) * 2 * Math.PI;
    angle += sweep;
    const endA = angle;
    const large = sweep > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startA); const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(endA);   const y2 = cy + r * Math.sin(endA);
    const ir = 16;
    const xi1 = cx + ir * Math.cos(startA); const yi1 = cy + ir * Math.sin(startA);
    const xi2 = cx + ir * Math.cos(endA);   const yi2 = cy + ir * Math.sin(endA);
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${ir} ${ir} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z`;
    paths.push(<Path key={i} d={d} fill={seg.color} />);
  });
  return <Svg width={72} height={72}>{paths}<Circle cx={cx} cy={cy} r={14} fill={COLORS.cardBg} /></Svg>;
}

const COMPLIANCE_CARDS = [
  {
    id: 'gst',
    title: 'GST',
    icon: 'document-text-outline',
    iconColor: '#2D7D46',
    iconBg: '#F0FBF4',
    route: '/reports/gst',
    preview: 'Filing Status',
    previewValue: '9/12 Filed',
    previewColor: COLORS.positive,
    stats: [
      { label: 'Filed', value: '9' },
      { label: 'Pending', value: '3' },
      { label: 'Unmatched', value: '7' },
    ],
    donut: [
      { pct: 75, color: '#2D7D46' },
      { pct: 25, color: '#E0DED6' },
    ],
  },
  {
    id: 'ewb',
    title: 'E-Way Bill',
    icon: 'car-outline',
    iconColor: '#2563EB',
    iconBg: '#EFF6FF',
    route: '/reports/ewb-compliance',
    preview: 'Active Bills',
    previewValue: '142 Active',
    previewColor: COLORS.info,
    stats: [
      { label: 'Active', value: '142' },
      { label: 'Expiring', value: '8' },
      { label: 'Expired', value: '14' },
    ],
    donut: [
      { pct: 85, color: '#2563EB' },
      { pct: 5, color: '#D97706' },
      { pct: 10, color: '#C0392B' },
    ],
  },
  {
    id: 'einvoice',
    title: 'E-Invoicing',
    icon: 'receipt-outline',
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    route: '/reports/einvoice-compliance',
    preview: 'IRN Generated',
    previewValue: '86/100',
    previewColor: '#7C3AED',
    stats: [
      { label: 'Generated', value: '86' },
      { label: 'Pending', value: '14' },
      { label: 'Errors', value: '0' },
    ],
    donut: [
      { pct: 86, color: '#7C3AED' },
      { pct: 14, color: '#E0DED6' },
    ],
  },
  {
    id: 'taxes',
    title: 'Other Taxes',
    icon: 'calculator-outline',
    iconColor: '#D97706',
    iconBg: '#FFFBEB',
    route: '/reports/other-taxes',
    preview: 'TDS Pending',
    previewValue: '14 Pending',
    previewColor: COLORS.warning,
    stats: [
      { label: 'TDS Due', value: '14' },
      { label: 'TCS Due', value: '3' },
      { label: 'Paid', value: '91%' },
    ],
    donut: [
      { pct: 91, color: '#D97706' },
      { pct: 9, color: '#E0DED6' },
    ],
  },
];

export default function ComplianceHubScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Compliance</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary Banner */}
        <View style={s.banner}>
          <View style={s.bannerLeft}>
            <Text style={s.bannerTitle}>Overall Compliance</Text>
            <Text style={s.bannerSub}>FY 2025-26 · As of June 2025</Text>
          </View>
          <View style={s.bannerRight}>
            <Text style={s.bannerPct}>84%</Text>
            <Text style={s.bannerPctLbl}>Score</Text>
          </View>
        </View>

        {/* Compliance Cards */}
        <View style={s.cardsContainer}>
          {COMPLIANCE_CARDS.map(card => (
            <TouchableOpacity
              key={card.id}
              style={s.card}
              onPress={() => router.push(card.route as any)}
              activeOpacity={0.8}
            >
              {/* Card Header */}
              <View style={s.cardHeader}>
                <View style={[s.cardIcon, { backgroundColor: card.iconBg }]}>
                  <Ionicons name={card.icon as any} size={20} color={card.iconColor} />
                </View>
                <Text style={s.cardTitle}>{card.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </View>

              {/* Card Body: Donut + Stats */}
              <View style={s.cardBody}>
                <MiniDonut segments={card.donut} />
                <View style={s.statsCol}>
                  {card.stats.map(stat => (
                    <View key={stat.label} style={s.statRow}>
                      <Text style={s.statLabel}>{stat.label}</Text>
                      <Text style={s.statValue}>{stat.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Preview badge */}
              <View style={[s.previewBadge, { backgroundColor: card.previewColor + '18' }]}>
                <Text style={[s.previewText, { color: card.previewColor }]}>{card.previewValue}</Text>
              </View>
            </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    margin: SPACING.md, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  bannerLeft:    { gap: 4 },
  bannerTitle:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  bannerSub:     { fontSize: TYPOGRAPHY.xs, color: '#AEACA8' },
  bannerRight:   { alignItems: 'center' },
  bannerPct:     { fontSize: TYPOGRAPHY.xxl, fontWeight: '800', color: COLORS.white },
  bannerPctLbl:  { fontSize: TYPOGRAPHY.xs, color: '#AEACA8' },

  cardsContainer: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.sm },
  cardIcon:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardBody:   { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statsCol:   { flex: 1, gap: 8 },
  statRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  statValue:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  previewBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: SPACING.sm },
  previewText:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
});
