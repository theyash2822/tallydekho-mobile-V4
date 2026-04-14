import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CARD_W = W - SPACING.md * 2;

const KPI_CARDS = [
  { label: 'Today', value: '₹36,000', sub: '5 receipts', icon: 'today-outline', color: '#1A1A1A' },
  { label: 'MTD', value: '₹5,62,000', sub: 'This month', icon: 'calendar-outline', color: '#2563EB' },
  { label: 'YTD', value: '₹28,40,000', sub: 'This year', icon: 'bar-chart-outline', color: '#7C3AED' },
  { label: 'Cash', value: '₹1,24,000', sub: 'Cash receipts', icon: 'cash-outline', color: '#2D7D46' },
  { label: 'Bank', value: '₹27,16,000', sub: 'Bank receipts', icon: 'card-outline', color: '#0891B2' },
];

const DAILY_DATA = [
  { day: 'Mon', cash: 12000, bank: 38000 },
  { day: 'Tue', cash: 18000, bank: 52000 },
  { day: 'Wed', cash: 9000, bank: 44000 },
  { day: 'Thu', cash: 22000, bank: 68000 },
  { day: 'Fri', cash: 15000, bank: 72000 },
  { day: 'Sat', cash: 8000, bank: 28000 },
  { day: 'Sun', cash: 4000, bank: 12000 },
];

const RECEIPTS = [
  { id: 'R1', title: 'Raj Enterprises – INV-042', ref: 'RC-0088', date: '25 May', amount: '₹18,000', method: 'NEFT' },
  { id: 'R2', title: 'Cash Sales', ref: 'RC-0087', date: '25 May', amount: '₹15,000', method: 'Cash' },
  { id: 'R3', title: 'Kumar & Sons – INV-038', ref: 'RC-0086', date: '24 May', amount: '₹35,000', method: 'RTGS' },
  { id: 'R4', title: 'Online Store Sales', ref: 'RC-0085', date: '24 May', amount: '₹12,400', method: 'UPI' },
  { id: 'R5', title: 'Delhi Distributors', ref: 'RC-0084', date: '23 May', amount: '₹48,000', method: 'Cheque' },
];

const maxVal = Math.max(...DAILY_DATA.flatMap(d => [d.cash, d.bank]));
const METHOD_COLORS: Record<string, string> = {
  NEFT: '#2563EB', RTGS: '#7C3AED', Cash: '#2D7D46', Bank: '#0891B2', UPI: '#D97706', Cheque: '#DC2626',
};

function InflowChart() {
  const svgW = CARD_W - SPACING.md * 2;
  const svgH = 100;
  const bW = 13;
  const gap = 4;
  const groupW = bW * 2 + gap + 12;
  return (
    <Svg width={svgW} height={svgH + 20}>
      {DAILY_DATA.map((d, i) => {
        const x = 4 + i * groupW;
        const cH = (d.cash / maxVal) * svgH;
        const bH = (d.bank / maxVal) * svgH;
        return (
          <React.Fragment key={d.day}>
            <Rect x={x} y={svgH - cH} width={bW} height={cH} rx={3} fill="#2D7D46" opacity={0.9} />
            <Rect x={x + bW + gap} y={svgH - bH} width={bW} height={bH} rx={3} fill="#2563EB" opacity={0.9} />
            <SvgText x={x + bW + gap / 2} y={svgH + 14} textAnchor="middle" fontSize={8.5} fill={COLORS.textTertiary}>{d.day}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState('7D');
  const [activeCategory, setActiveCategory] = useState('All');

  const cashTotal = 124000;
  const bankTotal = 2716000;
  const total = cashTotal + bankTotal;
  const cashPct = Math.round((cashTotal / total) * 100);
  const bankPct = 100 - cashPct;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Receipts</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <View style={s.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
          {['7D', '1M', '3M', '6M'].map(p => (
            <TouchableOpacity key={p} style={[s.filterChip, activePeriod === p && s.filterActive]} onPress={() => setActivePeriod(p)} activeOpacity={0.7}>
              <Text style={[s.filterTxt, activePeriod === p && s.filterActiveTxt]}>{p}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.filterDiv} />
          {['All', 'Cash', 'Bank'].map(c => (
            <TouchableOpacity key={c} style={[s.filterChip, activeCategory === c && s.filterActive]} onPress={() => setActiveCategory(c)} activeOpacity={0.7}>
              <Text style={[s.filterTxt, activeCategory === c && s.filterActiveTxt]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiScroll} contentContainerStyle={s.kpiContent}>
          {KPI_CARDS.map((k, i) => (
            <View key={i} style={[s.kpiCard, { borderTopColor: k.color, borderTopWidth: 3 }]}>
              <View style={[s.kpiIcon, { backgroundColor: k.color + '15' }]}>
                <Ionicons name={k.icon as any} size={18} color={k.color} />
              </View>
              <Text style={s.kpiVal}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={s.kpiSub}>{k.sub}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={s.card}>
          <Text style={s.cardTitle}>Cash vs Bank Ratio</Text>
          <View style={s.ratioBar}><View style={[s.ratioFill, { flex: cashPct, backgroundColor: '#2D7D46' }]} /><View style={[s.ratioFill, { flex: bankPct, backgroundColor: '#2563EB' }]} /></View>
          <View style={s.ratioLegend}>
            <View style={s.ratioItem}><View style={[s.ratioDot, { backgroundColor: '#2D7D46' }]} /><Text style={s.ratioLbl}>Cash {cashPct}%</Text><Text style={s.ratioAmt}>₹1,24,000</Text></View>
            <View style={s.ratioItem}><View style={[s.ratioDot, { backgroundColor: '#2563EB' }]} /><Text style={s.ratioLbl}>Bank {bankPct}%</Text><Text style={s.ratioAmt}>₹27,16,000</Text></View>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Daily Inflow</Text>
            <View style={s.legend}>
              <View style={s.legendRow}><View style={[s.dot, { backgroundColor: '#2D7D46' }]} /><Text style={s.legendTxt}>Cash</Text></View>
              <View style={s.legendRow}><View style={[s.dot, { backgroundColor: '#2563EB' }]} /><Text style={s.legendTxt}>Bank</Text></View>
            </View>
          </View>
          <InflowChart />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Recent Receipts</Text>
          {RECEIPTS.map((r, i) => (
            <View key={r.id} style={[s.txRow, i < RECEIPTS.length - 1 && s.txBorder]}>
              <View style={[s.txIcon, { backgroundColor: '#F0FBF4' }]}>
                <Ionicons name="arrow-down" size={14} color="#2D7D46" />
              </View>
              <View style={s.txInfo}>
                <Text style={s.txTitle}>{r.title}</Text>
                <Text style={s.txMeta}>{r.ref} · {r.date}</Text>
              </View>
              <View style={s.txRight}>
                <Text style={[s.txAmt, { color: '#2D7D46' }]}>+{r.amount}</Text>
                <View style={[s.methodBadge, { backgroundColor: (METHOD_COLORS[r.method] || '#666') + '15' }]}>
                  <Text style={[s.methodTxt, { color: METHOD_COLORS[r.method] || '#666' }]}>{r.method}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn: { width: 40, alignItems: 'flex-end' },
  filterRow: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterContent: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  filterActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  filterActiveTxt: { color: COLORS.white },
  filterDiv: { width: 1, height: 20, backgroundColor: COLORS.borderDefault },
  kpiScroll: { paddingVertical: SPACING.md },
  kpiContent: { paddingHorizontal: SPACING.md, gap: 10 },
  kpiCard: { width: 130, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 4 },
  kpiIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  kpiSub: { fontSize: 10, color: COLORS.textTertiary },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  ratioBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 },
  ratioFill: { height: '100%' },
  ratioLegend: { flexDirection: 'row', gap: SPACING.lg },
  ratioItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratioDot: { width: 10, height: 10, borderRadius: 5 },
  ratioLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  ratioAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  legend: { flexDirection: 'row', gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 3 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  methodBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  methodTxt: { fontSize: 10, fontWeight: '700' },
});
