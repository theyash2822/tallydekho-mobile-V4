import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const W = Dimensions.get('window').width;
const CONTENT_W = W - SPACING.md * 4;

const PERIODS: DropdownOption[] = [
  { label: 'This Month', value: 'month' },
  { label: 'Quarterly', value: 'quarter' },
  { label: 'Half Yearly', value: 'half' },
];

const IRP_PROVIDERS = ['NIC IRP Portal', 'Cleartax', 'GSTN IRP', 'Deloitte IRP', 'EY IRP', 'Tax2Win'];

const DONUT_SEGS = [
  { label: 'Generated', pct: 86, color: '#7C3AED' },
  { label: 'Pending',   pct: 8,  color: '#D97706' },
  { label: 'Errors',    pct: 4,  color: '#C0392B' },
  { label: 'Expiring',  pct: 2,  color: '#2563EB' },
];

const BAR_DATA = [3,6,9,5,11,8,14,7,10,6,13,9,8,12,7,11,6,9,14,8,10,7,12,5,9,11,6,8,10,7];
const maxBar = Math.max(...BAR_DATA);

function EInvoiceDonut() {
  const r = 60; const cx = CONTENT_W / 2; const cy = 74;
  let angle = -Math.PI / 2;
  return (
    <Svg width={CONTENT_W} height={150}>
      {DONUT_SEGS.map((seg, i) => {
        const startA = angle;
        const sweep = (seg.pct / 100) * 2 * Math.PI;
        angle += sweep;
        const endA = angle; const large = sweep > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(startA); const y1 = cy + r * Math.sin(startA);
        const x2 = cx + r * Math.cos(endA);   const y2 = cy + r * Math.sin(endA);
        const ir = 38;
        const xi1 = cx + ir * Math.cos(startA); const yi1 = cy + ir * Math.sin(startA);
        const xi2 = cx + ir * Math.cos(endA);   const yi2 = cy + ir * Math.sin(endA);
        const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${ir} ${ir} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z`;
        return <Path key={i} d={d} fill={seg.color} />;
      })}
      <Circle cx={cx} cy={cy} r={36} fill={COLORS.cardBg} />
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight="700" fill={COLORS.textPrimary}>86%</SvgText>
      <SvgText x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill={COLORS.textSecondary}>Generated</SvgText>
    </Svg>
  );
}

function EInvoiceBarChart() {
  const H = 80; const PAD_B = 16; const PAD_T = 6;
  const chartH = H - PAD_B - PAD_T; const barW = (CONTENT_W / 30) - 1.5;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={CONTENT_W} height={H}>
        {BAR_DATA.map((v, i) => {
          const bh = (v / maxBar) * chartH; const x = i * (barW + 1.5);
          return (
            <G key={i}>
              <Rect x={x} y={PAD_T + chartH - bh} width={barW} height={bh} rx={2} fill="#7C3AED" opacity={0.85} />
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

const PENDING_INV = [
  { inv: 'INV-30982', party: 'ABC Traders', amount: '₹52,000', due: 'Today' },
  { inv: 'INV-30980', party: 'XYZ Retail', amount: '₹38,500', due: 'Today' },
  { inv: 'INV-30978', party: 'Kumar & Sons', amount: '₹21,000', due: 'Yesterday' },
  { inv: 'INV-30977', party: 'PQR Exports', amount: '₹95,400', due: '2 days ago' },
];

export default function EInvoiceComplianceScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState('month');
  const [irp, setIrp] = useState('NIC IRP Portal');
  const [showIrp, setShowIrp] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>E-Invoicing</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.filterRow}>
          <FormDropdown label="Period" value={period} options={PERIODS} onSelect={o => setPeriod(o.value)} placeholder="Period" containerStyle={{ flex: 1, marginBottom: 0 }} />
          <View style={s.fyBadge}><Text style={s.fyTxt}>FY 2025-26</Text></View>
        </View>

        {/* IRP Provider */}
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="server-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>IRP Provider</Text></View>
          {IRP_PROVIDERS.map(p => (
            <TouchableOpacity key={p} style={s.irpRow} onPress={() => setIrp(p)} activeOpacity={0.7}>
              <Text style={[s.irpLbl, irp === p && s.irpActive]}>{p}</Text>
              {irp === p && <Ionicons name="checkmark-circle" size={20} color={COLORS.positive} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Status Summary */}
        <View style={s.card}>
          <Text style={s.cardTitle}>IRN Status</Text>
          <EInvoiceDonut />
          <View style={s.legend}>
            {DONUT_SEGS.map(seg => (
              <View key={seg.label} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: seg.color }]} />
                <Text style={s.legendTxt}>{seg.label} {seg.pct}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bar Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Daily IRN Generation (Last 30 Days)</Text>
          <EInvoiceBarChart />
        </View>

        {/* Pending Invoices */}
        <View style={s.card}>
          <View style={s.cardHdrRow}>
            <Text style={s.cardTitle}>Pending IRN Generation</Text>
            <View style={s.pendingBadge}><Text style={s.pendingTxt}>14 Pending</Text></View>
          </View>
          {PENDING_INV.map((inv, idx) => (
            <View key={inv.inv} style={[s.invRow, idx < PENDING_INV.length - 1 && s.invBorder]}>
              <View style={s.invLeft}>
                <Text style={s.invNum}>{inv.inv}</Text>
                <Text style={s.invParty}>{inv.party}</Text>
              </View>
              <View style={s.invRight}>
                <Text style={s.invAmt}>{inv.amount}</Text>
                <Text style={s.invDue}>{inv.due}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bulk Generate Button */}
        <TouchableOpacity style={s.bulkBtn} onPress={() => Alert.alert('Bulk Generate', 'Generating IRN for all 14 pending invoices...')} activeOpacity={0.8}>
          <Ionicons name="flash-outline" size={18} color={COLORS.white} />
          <Text style={s.bulkTxt}>Bulk Generate IRN (14)</Text>
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
  exportBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll:  { flex: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, margin: SPACING.md },
  fyBadge: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  fyTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  card:    { margin: SPACING.md, marginTop: 0, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  cardHdrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  irpRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  irpLbl:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  irpActive: { color: COLORS.positive, fontWeight: '700' },
  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: SPACING.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  pendingBadge: { backgroundColor: COLORS.warningBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  pendingTxt:   { fontSize: 11, fontWeight: '700', color: COLORS.warning },
  invRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  invBorder:{ borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  invLeft:  { flex: 1, gap: 2 },
  invNum:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  invParty: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  invRight: { alignItems: 'flex-end', gap: 2 },
  invAmt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  invDue:   { fontSize: 10, color: COLORS.warning },
  bulkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: '#7C3AED', borderRadius: RADIUS.md, paddingVertical: 14 },
  bulkTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
