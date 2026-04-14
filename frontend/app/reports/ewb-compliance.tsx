import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Text as SvgText, Rect } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const W = Dimensions.get('window').width;
const CONTENT_W = W - SPACING.md * 4;

const PERIODS: DropdownOption[] = [
  { label: 'This Month', value: 'month' },
  { label: 'Quarterly', value: 'quarter' },
  { label: 'Half Yearly', value: 'half' },
];

// ── Donut Chart ──────────────────────────────────────────────────────────
const DONUT_SEGS = [
  { label: 'Generated', pct: 68, color: '#2D7D46' },
  { label: 'Pending',   pct: 12, color: '#D97706' },
  { label: 'Errors',    pct: 5,  color: '#C0392B' },
  { label: 'Expiring',  pct: 15, color: '#2563EB' },
];

function DonutChart() {
  const r = 60; const cx = CONTENT_W / 2; const cy = 74;
  let angle = -Math.PI / 2;
  return (
    <Svg width={CONTENT_W} height={150}>
      {DONUT_SEGS.map((seg, i) => {
        const startA = angle;
        const sweep = (seg.pct / 100) * 2 * Math.PI;
        angle += sweep;
        const endA = angle;
        const large = sweep > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(startA); const y1 = cy + r * Math.sin(startA);
        const x2 = cx + r * Math.cos(endA);   const y2 = cy + r * Math.sin(endA);
        const ir = 38;
        const xi1 = cx + ir * Math.cos(startA); const yi1 = cy + ir * Math.sin(startA);
        const xi2 = cx + ir * Math.cos(endA);   const yi2 = cy + ir * Math.sin(endA);
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${ir} ${ir} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z`;
        return <Path key={i} d={d} fill={seg.color} />;
      })}
      <Circle cx={cx} cy={cy} r={36} fill={COLORS.cardBg} />
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight="700" fill={COLORS.textPrimary}>142</SvgText>
      <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>Total Bills</SvgText>
    </Svg>
  );
}

// ── Bar Chart (30 days) ──────────────────────────────────────────────────
const BAR_DATA = [
  4,7,3,8,12,6,9,5,11,8,14,7,10,6,13,9,8,12,7,11,6,9,14,8,10,7,12,5,9,11,
];
const maxBar = Math.max(...BAR_DATA);

function EWBBarChart() {
  const H = 80; const PAD_B = 16; const PAD_T = 6;
  const chartH = H - PAD_B - PAD_T;
  const barW = (CONTENT_W / 30) - 1.5;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={CONTENT_W} height={H}>
        {BAR_DATA.map((v, i) => {
          const bh = (v / maxBar) * chartH;
          const x = i * (barW + 1.5);
          return (
            <G key={i}>
              <Rect x={x} y={PAD_T + chartH - bh} width={barW} height={bh} rx={2} fill="#2563EB" opacity={0.8} />
              {(i === 0 || (i + 1) % 5 === 0) && (
                <SvgText x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize={7} fill={COLORS.textTertiary}>{i + 1}</SvgText>
              )}
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

const KPI_CARDS = [
  { label: 'Pending Gen', value: '18',  color: '#D97706', icon: 'time-outline' },
  { label: 'Errors',      value: '7',   color: '#C0392B', icon: 'warning-outline' },
  { label: 'Expiring <24h',value: '8',  color: '#2563EB', icon: 'timer-outline' },
  { label: 'Generated',   value: '142', color: '#2D7D46', icon: 'checkmark-circle-outline' },
];

const TRANSPORT_MODES = [
  { mode: 'Road',  count: 98, icon: 'car-outline',       color: '#2D7D46' },
  { mode: 'Rail',  count: 12, icon: 'train-outline',     color: '#2563EB' },
  { mode: 'Air',   count: 8,  icon: 'airplane-outline',  color: '#7C3AED' },
  { mode: 'Sea',   count: 24, icon: 'boat-outline',      color: '#0891B2' },
];

const RECENT = [
  { ewb: 'EWB-220081', party: 'ABC Traders → Mumbai', date: '15 Jun', status: 'Active', statusColor: '#2D7D46' },
  { ewb: 'EWB-220080', party: 'XYZ Retail → Delhi', date: '14 Jun', status: 'Expiring', statusColor: '#D97706' },
  { ewb: 'EWB-220079', party: 'Kumar & Sons → Chennai', date: '13 Jun', status: 'Active', statusColor: '#2D7D46' },
  { ewb: 'EWB-220078', party: 'PQR Exports → Kolkata', date: '12 Jun', status: 'Expired', statusColor: '#C0392B' },
];

export default function EWBComplianceScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('month');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>E-Way Bill</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.filterRow}>
          <FormDropdown label="Period" value={period} options={PERIODS} onSelect={o => setPeriod(o.value)} placeholder="Period" containerStyle={{ flex: 1, marginBottom: 0 }} />
        </View>

        {/* KPI Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiScroll}>
          {KPI_CARDS.map(kpi => (
            <View key={kpi.label} style={[s.kpiCard, { borderTopColor: kpi.color }]}>
              <View style={[s.kpiIcon, { backgroundColor: kpi.color + '18' }]}>
                <Ionicons name={kpi.icon as any} size={18} color={kpi.color} />
              </View>
              <Text style={s.kpiVal}>{kpi.value}</Text>
              <Text style={s.kpiLbl}>{kpi.label}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Donut Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>EWB Status Distribution</Text>
          <DonutChart />
          <View style={s.donutLegend}>
            {DONUT_SEGS.map(seg => (
              <View key={seg.label} style={s.donutLegendItem}>
                <View style={[s.legendDot, { backgroundColor: seg.color }]} />
                <Text style={s.legendTxt}>{seg.label} ({seg.pct}%)</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bar Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Daily Generation (Last 30 Days)</Text>
          <EWBBarChart />
        </View>

        {/* Transport Modes */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Transport Mode Breakdown</Text>
          <View style={s.modesGrid}>
            {TRANSPORT_MODES.map(tm => (
              <View key={tm.mode} style={s.modeCard}>
                <View style={[s.modeIcon, { backgroundColor: tm.color + '18' }]}>
                  <Ionicons name={tm.icon as any} size={18} color={tm.color} />
                </View>
                <Text style={s.modeCount}>{tm.count}</Text>
                <Text style={s.modeName}>{tm.mode}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Recent Activity</Text>
          {RECENT.map((item, idx) => (
            <View key={item.ewb} style={[s.recentRow, idx < RECENT.length - 1 && s.recentBorder]}>
              <View style={s.recentLeft}>
                <Text style={s.recentEwb}>{item.ewb}</Text>
                <Text style={s.recentParty} numberOfLines={1}>{item.party}</Text>
                <Text style={s.recentDate}>{item.date}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: item.statusColor + '18' }]}>
                <Text style={[s.statusTxt, { color: item.statusColor }]}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Generate Button */}
        <TouchableOpacity style={s.genBtn} onPress={() => Alert.alert('Generate', 'Generating E-Way Bills...')} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
          <Text style={s.genTxt}>Generate E-Way Bill</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: 12, margin: SPACING.md },
  kpiScroll: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: 10 },
  kpiCard: { width: 110, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, borderTopWidth: 3, gap: 4, alignItems: 'center' },
  kpiIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  kpiVal:  { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  kpiLbl:  { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  card:    { margin: SPACING.md, marginTop: 0, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  donutLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: SPACING.sm, justifyContent: 'center' },
  donutLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  modesGrid: { flexDirection: 'row', gap: 10 },
  modeCard:  { flex: 1, alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, gap: 4 },
  modeIcon:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modeCount: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  modeName:  { fontSize: 11, color: COLORS.textSecondary },
  recentRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  recentBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  recentLeft:   { flex: 1, gap: 2 },
  recentEwb:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  recentParty:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  recentDate:   { fontSize: 10, color: COLORS.textTertiary },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt:    { fontSize: 11, fontWeight: '700' },
  genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.positive, borderRadius: RADIUS.md, paddingVertical: 14 },
  genTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
