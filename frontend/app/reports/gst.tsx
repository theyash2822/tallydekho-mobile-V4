import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CONTENT_W = W - SPACING.md * 2 - 32;

// ── GST Gauge (same as in reports tab) ────────────────────────────────────
const GST_MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const GAUGE_GAP = 0.04;

function GSTGauge({ filedCount, needleIndex }: { filedCount: number; needleIndex: number }) {
  const svgW = CONTENT_W;
  const svgH = 200;
  const cx = svgW / 2;
  const cy = 176;
  const outerR = 100;
  const innerR = 62;
  const labelR = outerR + 18;
  const needleAngle = Math.PI - (needleIndex + 0.5) * (Math.PI / 12);
  const needleLen = innerR - 8;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  return (
    <Svg width={svgW} height={svgH}>
      {GST_MONTHS.map((month, i) => {
        const angleDeg = 180 - (i + 0.5) * 15;
        const angleRad = (angleDeg * Math.PI) / 180;
        const aR = Math.PI - (i + 1) * (Math.PI / 12) + GAUGE_GAP;
        const aL = Math.PI - i       * (Math.PI / 12) - GAUGE_GAP;
        const pt = (a: number, r: number) => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) });
        const o1 = pt(aR, outerR); const o2 = pt(aL, outerR);
        const i1 = pt(aR, innerR); const i2 = pt(aL, innerR);
        const d = [
          `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
          `A ${outerR} ${outerR} 0 0 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
          `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
          `A ${innerR} ${innerR} 0 0 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
          'Z',
        ].join(' ');
        const isFiled = i < filedCount;
        const lx = cx + labelR * Math.cos(angleRad);
        let extraY = 4;
        if (i === 0 || i === 11) extraY = 14;
        else if (i === 1 || i === 10) extraY = 8;
        const ly = cy - labelR * Math.sin(angleRad) + extraY;
        let anchor: 'end' | 'start' | 'middle' = 'middle';
        if (angleDeg > 108) anchor = 'end';
        else if (angleDeg < 72) anchor = 'start';
        return (
          <G key={month}>
            <Path d={d} fill={isFiled ? '#2D7D46' : '#E0DED6'} />
            <SvgText x={lx.toFixed(2)} y={ly.toFixed(2)} textAnchor={anchor} fontSize={7.5}
              fill={isFiled ? '#1A4D2E' : COLORS.textTertiary} fontWeight={isFiled ? '700' : '400'}>
              {month}
            </SvgText>
          </G>
        );
      })}
      <SvgText x={cx.toFixed(2)} y={(cy - 28).toFixed(2)} textAnchor="middle" fontSize={20} fontWeight="700" fill={COLORS.textPrimary}>
        {`${filedCount}/12`}
      </SvgText>
      <SvgText x={cx.toFixed(2)} y={(cy - 12).toFixed(2)} textAnchor="middle" fontSize={8.5} fill={COLORS.textSecondary}>
        months filed
      </SvgText>
      <Path d={`M ${cx} ${cy} L ${nx.toFixed(2)} ${ny.toFixed(2)}`} stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={cx.toFixed(2)} cy={cy.toFixed(2)} r={7} fill="#1A1A1A" />
      <Circle cx={cx.toFixed(2)} cy={cy.toFixed(2)} r={3} fill={COLORS.cardBg} />
    </Svg>
  );
}

// ── Filing Status Row ──────────────────────────────────────────────────────
function FilingRow({ label, status, dueDate, period }: { label: string; status: 'filed' | 'pending' | 'due'; dueDate: string; period: string }) {
  const cfg = {
    filed:   { color: '#2D7D46', bg: '#F0FBF4', text: 'Filed', icon: 'checkmark-circle' },
    pending: { color: '#D97706', bg: '#FFFBEB', text: 'Pending', icon: 'time-outline' },
    due:     { color: '#C0392B', bg: '#FDECEA', text: 'Due', icon: 'warning-outline' },
  }[status];
  return (
    <View style={gr.filingRow}>
      <View style={gr.filingLeft}>
        <Text style={gr.filingLabel}>{label}</Text>
        <Text style={gr.filingPeriod}>{period}</Text>
      </View>
      <View style={gr.filingMid}>
        <Text style={gr.dueLbl}>Due: {dueDate}</Text>
      </View>
      <View style={[gr.filingBadge, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
        <Text style={[gr.filingBadgeTxt, { color: cfg.color }]}>{cfg.text}</Text>
      </View>
    </View>
  );
}

// ── Tax Card ──────────────────────────────────────────────────────────────
function TaxCard({ label, amount, color }: { label: string; amount: string; color: string }) {
  return (
    <View style={[gr.taxCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={gr.taxAmount}>{amount}</Text>
      <Text style={gr.taxLabel}>{label}</Text>
    </View>
  );
}

const gr = StyleSheet.create({
  filingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filingLeft: { flex: 1, gap: 2 },
  filingLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  filingPeriod: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  filingMid: { flex: 1, alignItems: 'center' },
  dueLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  filingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  filingBadgeTxt: { fontSize: 11, fontWeight: '700' },
  taxCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', gap: 4 },
  taxAmount: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  taxLabel: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GSTReportScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview'|'returns'|'itc'>('overview');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>GST Compliance</Text>
        <TouchableOpacity style={s.exportBtn} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['overview', 'returns', 'itc'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabTxt, activeTab === tab && s.tabTxtActive]}>
              {tab === 'overview' ? 'Overview' : tab === 'returns' ? 'Returns' : 'ITC'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {activeTab === 'overview' && (
          <>
            {/* GST Gauge */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Filing Progress FY 2025-26</Text>
              <GSTGauge filedCount={9} needleIndex={8} />
              <View style={s.gaugeNote}>
                <Ionicons name="information-circle-outline" size={14} color={COLORS.info} />
                <Text style={s.gaugeNoteTxt}>9 of 12 months filed. Next due: GSTR-1 for Jan 2025 by 11-Feb-2025</Text>
              </View>
            </View>

            {/* Tax Collection */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Tax Collected (YTD)</Text>
              <View style={s.taxRow}>
                <TaxCard label="CGST" amount="₹90,000" color="#2563EB" />
                <TaxCard label="SGST" amount="₹90,000" color="#7C3AED" />
                <TaxCard label="IGST" amount="₹1,82,000" color="#0891B2" />
              </View>
              <View style={[s.taxCard, { marginTop: 10, borderTopColor: '#2D7D46', borderTopWidth: 3 }]}>
                <Text style={s.totalTaxLbl}>Total Tax Collected</Text>
                <Text style={s.totalTaxVal}>₹3,62,000</Text>
              </View>
            </View>

            {/* ITC Summary */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Input Tax Credit (ITC)</Text>
              <View style={s.itcRow}>
                <View style={s.itcItem}>
                  <Text style={s.itcVal}>₹1,24,000</Text>
                  <Text style={s.itcLbl}>Available</Text>
                </View>
                <View style={s.itcSep} />
                <View style={s.itcItem}>
                  <Text style={s.itcVal}>₹98,000</Text>
                  <Text style={s.itcLbl}>Utilized</Text>
                </View>
                <View style={s.itcSep} />
                <View style={s.itcItem}>
                  <Text style={[s.itcVal, { color: '#2D7D46' }]}>₹26,000</Text>
                  <Text style={s.itcLbl}>Balance</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {activeTab === 'returns' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Return Filing Status</Text>
            <FilingRow label="GSTR-1" status="filed" dueDate="11-Jan" period="Dec 2024" />
            <FilingRow label="GSTR-3B" status="filed" dueDate="20-Jan" period="Dec 2024" />
            <FilingRow label="GSTR-1" status="pending" dueDate="11-Feb" period="Jan 2025" />
            <FilingRow label="GSTR-3B" status="pending" dueDate="20-Feb" period="Jan 2025" />
            <FilingRow label="GSTR-9" status="due" dueDate="31-Dec-25" period="FY 2024-25" />
            <TouchableOpacity style={s.fileNowBtn} onPress={() => {}} activeOpacity={0.7}>
              <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
              <Text style={s.fileNowTxt}>File Pending Returns on GSTIN Portal</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'itc' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ITC Register</Text>
            {[
              { period: 'Dec 2024', invoices: 34, itc: '₹14,200', status: 'matched' },
              { period: 'Nov 2024', invoices: 28, itc: '₹12,800', status: 'matched' },
              { period: 'Oct 2024', invoices: 31, itc: '₹13,500', status: 'pending' },
              { period: 'Sep 2024', invoices: 26, itc: '₹11,200', status: 'matched' },
              { period: 'Aug 2024', invoices: 29, itc: '₹10,900', status: 'matched' },
              { period: 'Jul 2024', invoices: 22, itc: '₹9,800',  status: 'matched' },
            ].map((row, i) => (
              <View key={i} style={s.itcTableRow}>
                <Text style={s.itcPeriod}>{row.period}</Text>
                <Text style={s.itcInv}>{row.invoices} inv.</Text>
                <Text style={s.itcAmt}>{row.itc}</Text>
                <View style={[s.itcStatus, { backgroundColor: row.status === 'matched' ? '#F0FBF4' : '#FFFBEB' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: row.status === 'matched' ? '#2D7D46' : '#D97706' }}>
                    {row.status === 'matched' ? '✓ Matched' : '⏳ Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  tabTxtActive: { fontWeight: '700', color: COLORS.textPrimary },

  scroll: { flex: 1 },
  card: {
    margin: SPACING.md, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },

  gaugeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, padding: 10, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.md },
  gaugeNoteTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.info, lineHeight: 17 },

  taxRow: { flexDirection: 'row', gap: 8 },
  taxCard: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 0 },
  totalTaxLbl: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  totalTaxVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: '#2D7D46' },

  itcRow: { flexDirection: 'row', alignItems: 'center' },
  itcItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  itcSep: { width: 1, height: 40, backgroundColor: COLORS.borderDefault },
  itcVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  itcLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  fileNowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 12, marginTop: 16 },
  fileNowTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },

  itcTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, gap: 8 },
  itcPeriod: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  itcInv: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, width: 48 },
  itcAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, width: 70, textAlign: 'right' },
  itcStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
});
