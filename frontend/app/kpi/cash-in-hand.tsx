import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

const { width: SW } = Dimensions.get('window');

// ── Mock Data ───────────────────────────────────────────────────────────────
const SUMMARY_CARDS = [
  { id: 's1', icon: 'arrow-up-circle-outline',   label: 'Outflow Today',  amount: '₹2.8 M',    trend: '+12.5%', positive: true  },
  { id: 's2', icon: 'arrow-down-circle-outline',  label: 'Inflow Today',   amount: '₹95,000',   trend: '+5.5%',  positive: true  },
  { id: 's3', icon: 'business-outline',           label: 'Bank',           amount: '+₹12K',     trend: '+8.5%',  positive: true  },
  { id: 's4', icon: 'cash-outline',               label: 'Cash on Hand',   amount: '₹1,07,000', trend: '+58.5%', positive: true  },
];

const DAILY_K = [107,112,98,125,134,128,119,108,132,145,138,121,115,127,139,148,142,131,123,135,148,152,141,129,137,144,153,161,155,143];

const LINE_DATA = DAILY_K.map((v, i) => ({
  value: v * 1000,
  label: `${i + 1}`,
  dataPointText: `₹${v}K`,
}));

const REC_K  = [95,112,88,126,134,122,99,115,133,145,138,121,106,127,140,148,143,131,118,136,149,153,141,128,138,145,154,162,155,142];
const PMT_K  = [82,99,75,108,115,103,84,98,115,123,121,98,87,108,118,126,120,112,95,115,127,130,118,108,117,122,131,138,132,121];

const BAR_DATA = REC_K.flatMap((r, i) => [
  {
    value: r * 1000,
    frontColor: '#A89060',
    label: (i === 0 || (i + 1) % 5 === 0) ? `${i + 1}` : '',
    spacing: 3,
    barWidth: 9,
  },
  { value: PMT_K[i] * 1000, frontColor: '#3A3A3A', spacing: 18, barWidth: 9 },
]);

// Chart widths for horizontal scroll
const LINE_CHART_W = 30 * 34;   // 30 days × 34px spacing
const BAR_CHART_W  = 30 * 39;   // 30 day-pairs × 39px

const Y_LABELS = ['₹0', '₹40K', '₹80K', '₹1.2L', '₹1.6L'];

const RECENT_TXN = [
  { id: 'r1', type: 'in',  desc: 'Cash Sales',    ref: 'RC-1452',  date: '10 Jul', amount: '₹8,000'  },
  { id: 'r2', type: 'out', desc: 'Taxi Reimburse', ref: 'PMT-3491', date: '10 Jul', amount: '₹1,200'  },
  { id: 'r3', type: 'in',  desc: 'Cash Sales',    ref: 'RC-1453',  date: '11 Jul', amount: '₹8,000'  },
  { id: 'r4', type: 'out', desc: 'Taxi Reimburse', ref: 'PMT-3492', date: '11 Jul', amount: '₹1,200'  },
  { id: 'r5', type: 'in',  desc: 'Cash Sales',    ref: 'RC-1454',  date: '12 Jul', amount: '₹12,500' },
  { id: 'r6', type: 'out', desc: 'Office Expense', ref: 'PMT-3493', date: '12 Jul', amount: '₹3,500'  },
];

// ── Component ───────────────────────────────────────────────────────────────
export default function CashInHandScreen() {
  const router  = useRouter();
  const sumRef  = useRef<FlatList>(null);
  const [sumIdx,       setSumIdx]       = useState(0);
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom,     setDateFrom]     = useState('31/03/25');
  const [dateTo,       setDateTo]       = useState('23/04/25');

  // Auto-scroll summary carousel every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setSumIdx(prev => {
        const next = (prev + 1) % SUMMARY_CARDS.length;
        sumRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const fmtRange = () => {
    const fmt = (s: string) => {
      const p = s.split('/');
      if (p.length < 3) return s;
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${parseInt(p[0])} ${m[parseInt(p[1]) - 1]}`;
    };
    return `${fmt(dateFrom)} \u2013 ${fmt(dateTo)}`;
  };

  const curBal  = DAILY_K[DAILY_K.length - 1];
  const prevBal = DAILY_K[DAILY_K.length - 2];
  const chgAbs  = curBal - prevBal;
  const chgPct  = ((chgAbs / prevBal) * 100).toFixed(1);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cash in Hand</Text>
        <View style={s.headerBtn} />
      </View>

      {/* Date Range Pill */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Summary Carousel */}
        <View style={s.carouselWrap}>
          <FlatList
            ref={sumRef}
            horizontal pagingEnabled
            data={SUMMARY_CARDS}
            keyExtractor={i => i.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, idx) => ({ length: SW, offset: SW * idx, index: idx })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              setSumIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
            renderItem={({ item }) => (
              <View style={s.cardItem}>
                <View style={s.sumCard}>
                  <View style={s.sumIconBox}>
                    <Ionicons name={item.icon as any} size={22} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.sumTextWrap}>
                    <Text style={s.sumLabel}>{item.label}</Text>
                    <Text style={s.sumAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                  </View>
                  <View style={[s.trendBadge, { backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg }]}>
                    <Ionicons
                      name={item.positive ? 'trending-up' : 'trending-down'}
                      size={11}
                      color={item.positive ? COLORS.positive : COLORS.negative}
                    />
                    <Text style={[s.trendTxt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
                      {item.trend}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
          <View style={s.dots}>
            {SUMMARY_CARDS.map((_, i) => (
              <View key={i} style={[s.dot, i === sumIdx && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* Daily Cash Balance */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <View>
              <Text style={s.chartTitle}>Daily Cash Balance</Text>
              <View style={s.chartMeta}>
                <Text style={s.chartAmt}>₹{curBal}K</Text>
                <View style={[s.changeBadge, { backgroundColor: chgAbs >= 0 ? COLORS.positiveBg : COLORS.negativeBg }]}>
                  <Text style={[s.changeTxt, { color: chgAbs >= 0 ? COLORS.positive : COLORS.negative }]}>
                    {chgAbs >= 0 ? '+' : ''}{chgAbs}K ({chgPct}%)
                  </Text>
                </View>
              </View>
            </View>
            <Text style={s.chartDate}>30 days</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            <LineChart
              data={LINE_DATA}
              areaChart
              curved
              color={'#A89060'}
              thickness={2}
              startFillColor={'rgba(168,144,96,0.3)'}
              endFillColor={'rgba(168,144,96,0.05)'}
              startOpacity={0.9}
              endOpacity={0.1}
              initialSpacing={16}
              spacing={34}
              maxValue={180000}
              noOfSections={4}
              yAxisLabelWidth={52}
              yAxisLabelTexts={Y_LABELS}
              yAxisTextStyle={{ color: COLORS.textTertiary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: COLORS.textTertiary, fontSize: 9 }}
              rulesType={'dashed'}
              rulesColor={COLORS.borderDefault}
              dataPointsColor={'#A89060'}
              dataPointsRadius={3}
              isAnimated
              focusEnabled
              showTextOnFocus
              textShiftY={-10}
              textColor={COLORS.textPrimary}
              textFontSize={11}
              showStripOnFocus
              stripColor={'rgba(168,144,96,0.5)'}
              focusedDataPointColor={'#1A1A1A'}
              focusedDataPointRadius={6}
              height={180}
              width={LINE_CHART_W}
            />
          </ScrollView>
        </View>

        {/* Receipts vs Payments */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Receipts vs Payments</Text>
            <View style={s.legend}>
              <View style={[s.legendDot, { backgroundColor: '#A89060' }]} />
              <Text style={s.legendTxt}>Receipts</Text>
              <View style={[s.legendDot, { backgroundColor: '#3A3A3A' }]} />
              <Text style={s.legendTxt}>Payments</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            <BarChart
              data={BAR_DATA}
              width={BAR_CHART_W}
              height={160}
              maxValue={180000}
              noOfSections={4}
              yAxisLabelWidth={52}
              yAxisLabelTexts={Y_LABELS}
              yAxisTextStyle={{ color: COLORS.textTertiary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: COLORS.textTertiary, fontSize: 9 }}
              rulesType={'dashed'}
              rulesColor={COLORS.borderDefault}
              isAnimated
              barBorderRadius={2}
            />
          </ScrollView>
        </View>

        {/* Recent Transactions */}
        <View style={s.recentCard}>
          <View style={s.recentHeader}>
            <Text style={s.chartTitle}>Recent Transactions</Text>
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/kpi/cash-register' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          {RECENT_TXN.map((txn, idx) => (
            <TouchableOpacity
              key={txn.id}
              style={[s.txRow, idx < RECENT_TXN.length - 1 && s.txBorder]}
              activeOpacity={0.7}
              onPress={() => router.push({
                pathname: '/voucher/preview' as any,
                params: {
                  type: txn.type === 'in' ? 'receipt' : 'payment',
                  voucherNumber: txn.ref,
                  date: `${txn.date} 2025`,
                  mode: 'Cash In Hand',
                  ...(txn.type === 'in'
                    ? { receivedFrom: txn.desc }
                    : { paidTo: txn.desc }),
                  amount: txn.amount,
                  narration: '\u2014',
                },
              })}
            >
              <View style={[s.txIconBox, { backgroundColor: COLORS.pageBg }]}>
                <Ionicons
                  name={txn.type === 'in' ? 'arrow-down-outline' : 'arrow-up-outline'}
                  size={16}
                  color={txn.type === 'in' ? COLORS.positive : COLORS.negative}
                />
              </View>
              <View style={s.txInfo}>
                <Text style={s.txDesc}>{txn.desc}</Text>
                <Text style={s.txMeta}>{` ${txn.ref} \u00b7 ${txn.date}`}</Text>
              </View>
              <Text style={[s.txAmt, { color: txn.type === 'in' ? COLORS.positive : COLORS.negative }]}>
                {txn.type === 'in' ? '+' : '-'}{txn.amount}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom}
        toDate={dateTo}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.sm },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  filterRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dateChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  carouselWrap: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  cardItem:     { width: SW },
  sumCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  sumIconBox:   { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sumTextWrap:  { flex: 1, gap: 4 },
  sumLabel:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sumAmount:    { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  trendBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, flexShrink: 0 },
  trendTxt:     { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  dots:         { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 },
  dot:          { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive:    { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  chartCard:   { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingTop: SPACING.md },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, marginBottom: 12 },
  chartTitle:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chartMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chartAmt:    { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  changeTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  chartDate:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500', marginTop: 2 },
  legend:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendTxt:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginRight: 4 },

  recentCard:   { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllBtn:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },

  txRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox:{ width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo:   { flex: 1 },
  txDesc:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', flexShrink: 0 },
});
