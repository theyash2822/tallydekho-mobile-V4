import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CARD_W = W - SPACING.md * 2;

const DAILY_DATA = [
  { day: 'Mon', cash: 42000, receipts: 18000, payments: 12000 },
  { day: 'Tue', cash: 48000, receipts: 22000, payments: 16000 },
  { day: 'Wed', cash: 53000, receipts: 19000, payments: 14000 },
  { day: 'Thu', cash: 58000, receipts: 28000, payments: 23000 },
  { day: 'Fri', cash: 67000, receipts: 31000, payments: 22000 },
  { day: 'Sat', cash: 72000, receipts: 25000, payments: 20000 },
  { day: 'Sun', cash: 78000, receipts: 15000, payments: 9000 },
];

const METRIC_CARDS = [
  { label: 'Cash on Hand', value: '₹78,000', sub: '+4.2% vs last week', color: '#2D7D46', icon: 'cash-outline' },
  { label: 'MTD Cash', value: '₹3,42,000', sub: 'Month to date', color: '#2563EB', icon: 'calendar-outline' },
  { label: 'Inflow Today', value: '₹15,000', sub: 'Total receipts', color: '#059669', icon: 'arrow-down-circle-outline' },
  { label: 'Outflow Today', value: '₹9,000', sub: 'Total payments', color: '#DC2626', icon: 'arrow-up-circle-outline' },
  { label: 'Bank Balance', value: '₹8,00,000', sub: 'Linked accounts', color: '#7C3AED', icon: 'card-outline' },
];

const TRANSACTIONS = [
  { id: 'T1', title: 'Cash Sales', ref: 'RC-0042', date: '25 May', amount: '₹15,000', type: 'Receipt', color: '#2D7D46' },
  { id: 'T2', title: 'Office Supplies', ref: 'PY-0031', date: '25 May', amount: '₹3,200', type: 'Payment', color: '#DC2626' },
  { id: 'T3', title: 'Taxi Reimburse', ref: 'PY-0030', date: '24 May', amount: '₹850', type: 'Payment', color: '#DC2626' },
  { id: 'T4', title: 'Cash Sales', ref: 'RC-0041', date: '24 May', amount: '₹22,000', type: 'Receipt', color: '#2D7D46' },
  { id: 'T5', title: 'Petty Cash', ref: 'PY-0029', date: '23 May', amount: '₹1,500', type: 'Payment', color: '#DC2626' },
  { id: 'T6', title: 'Cash Sales', ref: 'RC-0040', date: '23 May', amount: '₹18,500', type: 'Receipt', color: '#2D7D46' },
];

const maxCash = Math.max(...DAILY_DATA.map(d => d.cash));
const maxRP = Math.max(...DAILY_DATA.flatMap(d => [d.receipts, d.payments]));

function CashBalanceChart() {
  const svgW = CARD_W - SPACING.md * 2;
  const svgH = 110;
  const barW = 28;
  const gap = (svgW - barW * 7) / 8;
  return (
    <Svg width={svgW} height={svgH + 20}>
      {DAILY_DATA.map((d, i) => {
        const x = gap + i * (barW + gap);
        const h = (d.cash / maxCash) * svgH;
        return (
          <React.Fragment key={d.day}>
            <Rect x={x} y={svgH - h} width={barW} height={h} rx={4} fill={COLORS.brandPrimary} opacity={0.85} />
            <SvgText x={x + barW / 2} y={svgH + 14} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>{d.day}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function RvPChart() {
  const svgW = CARD_W - SPACING.md * 2;
  const svgH = 100;
  const bW = 14;
  const gap = 4;
  const groupW = bW * 2 + gap + 12;
  const padL = 4;
  return (
    <Svg width={svgW} height={svgH + 20}>
      {DAILY_DATA.map((d, i) => {
        const x = padL + i * groupW;
        const rH = (d.receipts / maxRP) * svgH;
        const pH = (d.payments / maxRP) * svgH;
        return (
          <React.Fragment key={d.day}>
            <Rect x={x} y={svgH - rH} width={bW} height={rH} rx={3} fill="#2D7D46" opacity={0.9} />
            <Rect x={x + bW + gap} y={svgH - pH} width={bW} height={pH} rx={3} fill="#DC2626" opacity={0.9} />
            <SvgText x={x + bW + gap / 2} y={svgH + 14} textAnchor="middle" fontSize={8.5} fill={COLORS.textTertiary}>{d.day}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function CashInHandScreen() {
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState('7D');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cash In Hand</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Period Filters */}
      <View style={s.periodRow}>
        {['7D', '1M', '3M', '6M'].map(p => (
          <TouchableOpacity key={p} style={[s.periodBtn, activePeriod === p && s.periodActive]} onPress={() => setActivePeriod(p)} activeOpacity={0.7}>
            <Text style={[s.periodTxt, activePeriod === p && s.periodActiveTxt]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Metric Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.metricsScroll} contentContainerStyle={s.metricsContent}>
          {METRIC_CARDS.map((m, i) => (
            <View key={i} style={[s.metricCard, { borderTopColor: m.color, borderTopWidth: 3 }]}>
              <View style={[s.metricIcon, { backgroundColor: m.color + '20' }]}>
                <Ionicons name={m.icon as any} size={18} color={m.color} />
              </View>
              <Text style={s.metricVal}>{m.value}</Text>
              <Text style={s.metricLabel}>{m.label}</Text>
              <Text style={[s.metricSub, { color: m.label === 'Outflow Today' ? '#DC2626' : '#2D7D46' }]}>{m.sub}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Daily Cash Balance Chart */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Daily Cash Balance</Text>
          <CashBalanceChart />
          <View style={s.chartNote}>
            <Ionicons name="trending-up-outline" size={14} color="#2D7D46" />
            <Text style={s.chartNoteTxt}>₹78,000 closing balance · +₹6,000 vs yesterday</Text>
          </View>
        </View>

        {/* Receipts vs Payments Chart */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Receipts vs Payments</Text>
            <View style={s.legend}>
              <View style={s.legendRow}><View style={[s.dot, { backgroundColor: '#2D7D46' }]} /><Text style={s.legendTxt}>Receipts</Text></View>
              <View style={s.legendRow}><View style={[s.dot, { backgroundColor: '#DC2626' }]} /><Text style={s.legendTxt}>Payments</Text></View>
            </View>
          </View>
          <RvPChart />
        </View>

        {/* Recent Transactions */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Recent Transactions</Text>
          {TRANSACTIONS.map((t, i) => (
            <View key={t.id} style={[s.txRow, i < TRANSACTIONS.length - 1 && s.txBorder]}>
              <View style={[s.txIcon, { backgroundColor: t.color + '15' }]}>
                <Ionicons name={t.type === 'Receipt' ? 'arrow-down' : 'arrow-up'} size={14} color={t.color} />
              </View>
              <View style={s.txInfo}>
                <Text style={s.txTitle}>{t.title}</Text>
                <Text style={s.txRef}>{t.ref} · {t.date}</Text>
              </View>
              <View style={s.txRight}>
                <Text style={[s.txAmount, { color: t.color }]}>{t.type === 'Payment' ? '-' : '+'}{t.amount}</Text>
                <Text style={[s.txType, { color: t.color }]}>{t.type}</Text>
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
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  periodActive: { backgroundColor: COLORS.brandPrimary },
  periodTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodActiveTxt: { color: COLORS.white },
  scroll: { flex: 1 },
  metricsScroll: { paddingVertical: SPACING.md },
  metricsContent: { paddingHorizontal: SPACING.md, gap: 10 },
  metricCard: { width: 140, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 4 },
  metricIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  metricVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  metricLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  metricSub: { fontSize: 10, color: '#2D7D46' },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  chartNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#F0FBF4', padding: 8, borderRadius: RADIUS.sm },
  chartNoteTxt: { fontSize: TYPOGRAPHY.xs, color: '#2D7D46', flex: 1 },
  legend: { flexDirection: 'row', gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txRef: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  txType: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
