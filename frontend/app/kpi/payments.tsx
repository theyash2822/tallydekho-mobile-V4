import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, PanResponder, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from 'react-native-svg';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const { width: SW } = Dimensions.get('window');

// ─── Chart constants ─────────────────────────────────────────────────────────
const CHART_COLOR  = '#A89060';   // brand amber for payments (outflow)
const CHART_FILL   = 'rgba(168,144,96,0.15)';
const PAD_L = 46; const PAD_T = 14; const PAD_B = 24;
const CHART_W_FULL = SW - 32;
const CHART_H_SVG  = 160;
const CHART_W      = CHART_W_FULL - PAD_L - 8;
const CHART_H      = CHART_H_SVG - PAD_T - PAD_B;

// ─── Mock data ────────────────────────────────────────────────────────────────
const KPI_DATA = [
  { id: 'today', icon: 'calendar-outline',   label: 'Today',  amount: '₹87,000',  trend: '+12%',  positive: true  },
  { id: 'mtd',   icon: 'calendar-outline',   label: 'MTD',    amount: '₹25,000',  trend: '+8%',   positive: true  },
  { id: 'ytd',   icon: 'stats-chart-outline',label: 'YTD',    amount: '₹35,000',  trend: '+15%',  positive: true  },
  { id: 'cash',  icon: 'cash-outline',        label: 'Cash',   amount: '₹45,000',  trend: '-5%',   positive: false },
  { id: 'bank',  icon: 'business-outline',    label: 'Bank',   amount: '₹95,000',  trend: '+22%',  positive: true  },
];

const DAILY = [
  { day: 'Mon', value: 12000 },
  { day: 'Tue', value: 28000 },
  { day: 'Wed', value: 22000 },
  { day: 'Thu', value: 15800 },
  { day: 'Fri', value: 35000 },
  { day: 'Sat', value: 18000 },
  { day: 'Sun', value: 42000 },
];

const DONUT_DATA = [
  { value: 75000,  color: '#A89060', label: 'Cash', pct: '14.3%' },
  { value: 450000, color: '#3A3A3A', label: 'Bank', pct: '85.7%' },
];

const RECENT_PMT = [
  { id: 'p1', ref: 'PMT-3010', party: 'AGL Traders',    date: '10 Jul', mode: 'Cash', amount: '₹75,000',  paid: true  },
  { id: 'p2', ref: 'PMT-3011', party: 'Reliance Supply', date: '08 Jul', mode: 'Bank', amount: '₹1,20,000', paid: true  },
  { id: 'p3', ref: 'PMT-3012', party: 'City Hardware',   date: '07 Jul', mode: 'Cash', amount: '₹32,500',  paid: false },
  { id: 'p4', ref: 'PMT-3013', party: 'Metro Steel',     date: '06 Jul', mode: 'Bank', amount: '₹2,00,000', paid: true  },
];

const PERIOD_TABS = ['7D', '1M', '3M', '6M'];
const TYPE_TABS   = ['All', 'Cash', 'Bank'];

// ─── Fmt helpers ──────────────────────────────────────────────────────────────
const fmtK  = (v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${v}`;
const fmtAmt = (v: number) => `₹${(v / 1000).toFixed(1)}K`;

// ─── Interactive Line Chart ────────────────────────────────────────────────────
function DailyChart() {
  const [activeIdx, setActiveIdx] = useState<number | null>(3); // Thu default
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vals    = DAILY.map(d => d.value);
  const minV    = Math.min(...vals);
  const maxV    = Math.max(...vals);
  const range   = maxV - minV || 1;

  const getX = (i: number) => PAD_L + (i / (DAILY.length - 1)) * CHART_W;
  const getY = (v: number) => PAD_T + (1 - (v - minV) / range) * CHART_H;

  // Build path strings
  const linePath = DAILY.map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(d.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${getX(DAILY.length - 1).toFixed(1)},${(PAD_T + CHART_H).toFixed(1)} L${PAD_L.toFixed(1)},${(PAD_T + CHART_H).toFixed(1)} Z`;

  // Y-axis labels — evenly spaced from maxV (top) to minV (bottom)
  const yLabels = Array.from({ length: 5 }, (_, i) => maxV - (i / 4) * (maxV - minV));

  const handleTouch = useCallback((lx: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const idx = Math.round(((lx - PAD_L) / CHART_W) * (DAILY.length - 1));
    setActiveIdx(Math.max(0, Math.min(DAILY.length - 1, idx)));
  }, []);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant:   (e) => handleTouch(e.nativeEvent.locationX),
    onPanResponderMove:    (e) => handleTouch(e.nativeEvent.locationX),
    onPanResponderRelease: () => {
      hideTimer.current = setTimeout(() => setActiveIdx(null), 3000);
    },
  })).current;

  const activeDay  = activeIdx !== null ? DAILY[activeIdx] : DAILY[3];
  const prevVal    = activeIdx !== null && activeIdx > 0 ? DAILY[activeIdx - 1].value : DAILY[2].value;
  const change     = activeDay.value - prevVal;
  const changePct  = ((change / prevVal) * 100).toFixed(1);
  const changePos  = change >= 0;

  return (
    <View style={ch.card}>
      {/* Top row */}
      <View style={ch.topRow}>
        <View>
          <Text style={ch.mainVal}>{fmtAmt(activeDay.value)}</Text>
          <Text style={[ch.changeVal, { color: changePos ? COLORS.positive : COLORS.negative }]}>
            {changePos ? '+' : ''}{fmtAmt(change)} ({changePct}%)
          </Text>
        </View>
        <View style={ch.dayTag}>
          <Text style={ch.dayTxt}>{activeDay.day}</Text>
        </View>
      </View>

      {/* SVG Chart */}
      <View {...pan.panHandlers}>
        <Svg width={CHART_W_FULL} height={CHART_H_SVG}>
          <Defs>
            <SvgGrad id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={CHART_COLOR} stopOpacity="0.35" />
              <Stop offset="1" stopColor={CHART_COLOR} stopOpacity="0.02" />
            </SvgGrad>
          </Defs>

          {/* Y-axis labels */}
          {yLabels.map((v, i) => {
            const y = PAD_T + (i / (yLabels.length - 1)) * CHART_H;
            return (
              <SvgText key={i} x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize={8} fill={COLORS.textTertiary}>
                {fmtK(v)}
              </SvgText>
            );
          })}

          {/* X-axis labels */}
          {DAILY.map((d, i) => (
            <SvgText key={i} x={getX(i)} y={CHART_H_SVG - 4} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>
              {d.day}
            </SvgText>
          ))}

          {/* Grid lines */}
          {yLabels.map((_, i) => {
            const y = PAD_T + (i / (yLabels.length - 1)) * CHART_H;
            return <Line key={i} x1={PAD_L} y1={y} x2={PAD_L + CHART_W} y2={y} stroke={COLORS.borderDefault} strokeWidth={1} />;
          })}

          {/* Area fill */}
          <Path d={areaPath} fill="url(#areaGrad)" />

          {/* Line */}
          <Path d={linePath} stroke={CHART_COLOR} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Active indicator */}
          {activeIdx !== null && (
            <>
              <Line
                x1={getX(activeIdx)} y1={PAD_T}
                x2={getX(activeIdx)} y2={PAD_T + CHART_H}
                stroke={CHART_COLOR} strokeWidth={1} strokeDasharray="3,3"
              />
              <Circle cx={getX(activeIdx)} cy={getY(DAILY[activeIdx].value)} r={6} fill={CHART_COLOR} />
              <Circle cx={getX(activeIdx)} cy={getY(DAILY[activeIdx].value)} r={3} fill="#fff" />
            </>
          )}
        </Svg>
      </View>

      <Text style={ch.chartLabel}>Daily Outflow — touch to explore</Text>
    </View>
  );
}

// ─── Donut Chart Card ─────────────────────────────────────────────────────────
function DonutCard() {
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const totalFmt = '₹5.25L';

  return (
    <View style={dc.card}>
      <Text style={dc.title}>Cash vs Bank</Text>
      <View style={dc.body}>
        {/* Donut */}
        <View style={dc.donutWrap}>
          <PieChart
            data={DONUT_DATA}
            donut
            radius={85}
            innerRadius={58}
            innerCircleColor={COLORS.cardBg}
            strokeColor={COLORS.cardBg}
            strokeWidth={2}
            onPress={(_item: any, index: number) => setSelIdx(prev => prev === index ? null : index)}
            centerLabelComponent={() => (
              <View style={dc.center}>
                <Text style={dc.centerAmt}>{totalFmt}</Text>
                <Text style={dc.centerLbl}>Total</Text>
              </View>
            )}
          />
        </View>

        {/* Legend */}
        <View style={dc.legend}>
          {DONUT_DATA.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[dc.legendRow, selIdx === i && dc.legendRowActive]}
              onPress={() => setSelIdx(prev => prev === i ? null : i)}
              activeOpacity={0.75}
            >
              <View style={[dc.legendDot, { backgroundColor: item.color }]} />
              <View style={dc.legendTxtWrap}>
                <Text style={dc.legendLabel}>{item.label}</Text>
                <Text style={dc.legendPct}>{item.pct}</Text>
              </View>
              <Text style={dc.legendAmt}>
                ₹{(item.value / 1000).toFixed(0)}K
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Selected segment detail */}
      {selIdx !== null && (
        <View style={[dc.detail, { borderColor: DONUT_DATA[selIdx].color }]}>
          <View style={[dc.detailDot, { backgroundColor: DONUT_DATA[selIdx].color }]} />
          <Text style={dc.detailTxt}>
            {DONUT_DATA[selIdx].label}: ₹{(DONUT_DATA[selIdx].value / 1000).toFixed(0)}K ({DONUT_DATA[selIdx].pct})
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function PaymentsScreen() {
  const router     = useRouter();
  const kpiRef     = useRef<any>(null);
  const [kpiIdx,   setKpiIdx]   = useState(0);
  const [period,   setPeriod]   = useState('7D');
  const [typeTab,  setTypeTab]  = useState('All');

  useEffect(() => {
    const t = setInterval(() => {
      setKpiIdx(prev => {
        const next = (prev + 1) % KPI_DATA.length;
        kpiRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const filteredPmt = RECENT_PMT.filter(p => {
    if (typeTab === 'Cash') return p.mode === 'Cash';
    if (typeTab === 'Bank') return p.mode === 'Bank';
    return true;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payments</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* KPI Carousel */}
        <View style={s.kpiSection}>
          <FlatList
            ref={kpiRef}
            horizontal pagingEnabled
            data={KPI_DATA}
            keyExtractor={(i: any) => i.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_: any, index: number) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: any) => setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
            renderItem={({ item }: any) => (
              <View style={s.kpiItem}>
                <View style={s.kpiCard}>
                  <View style={s.kpiIconBox}>
                    <Ionicons name={item.icon} size={20} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.kpiTextWrap}>
                    <Text style={s.kpiLabel}>{item.label}</Text>
                    <Text style={s.kpiAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                  </View>
                  <View style={[s.kpiTrendBadge, { backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg }]}>
                    <Ionicons name={item.positive ? 'trending-up' : 'trending-down'} size={11} color={item.positive ? COLORS.positive : COLORS.negative} />
                    <Text style={[s.kpiTrendTxt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>{item.trend}</Text>
                  </View>
                </View>
              </View>
            )}
          />
          <View style={s.dots}>
            {KPI_DATA.map((_, i) => <View key={i} style={[s.dot, i === kpiIdx && s.dotActive]} />)}
          </View>
        </View>

        {/* Line Chart */}
        <DailyChart />

        {/* Donut Chart */}
        <DonutCard />

        {/* Recent Payments */}
        <View style={s.recentCard}>
          <View style={s.recentHeader}>
            <Text style={s.recentTitle}>Recent Payment</Text>
            <View style={s.periodRow}>
              {PERIOD_TABS.map(p => (
                <TouchableOpacity key={p} style={[s.periodBtn, period === p && s.periodBtnActive]} onPress={() => setPeriod(p)} activeOpacity={0.7}>
                  <Text style={[s.periodTxt, period === p && s.periodTxtActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.typeRow}>
            {TYPE_TABS.map(t => (
              <TouchableOpacity key={t} style={[s.typeBtn, typeTab === t && s.typeBtnActive]} onPress={() => setTypeTab(t)} activeOpacity={0.7}>
                <Text style={[s.typeTxt, typeTab === t && s.typeTxtActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredPmt.map((p, idx) => (
            <View key={p.id} style={[s.txRow, idx < filteredPmt.length - 1 && s.txBorder]}>
              <View style={s.txIconBox}>
                <Ionicons name="send-outline" size={17} color={COLORS.textSecondary} />
              </View>
              <View style={s.txInfo}>
                <View style={s.txTopRow}>
                  <Text style={s.txMode}>{p.mode}</Text>
                  <Text style={s.txRef}> · {p.ref}</Text>
                </View>
                <Text style={s.txSub}>{p.party} · {p.date}</Text>
              </View>
              <View style={s.txRight}>
                <Text style={s.txAmt}>{p.amount}</Text>
                {p.paid && <Ionicons name="checkmark-circle" size={16} color={COLORS.positive} style={{ marginTop: 2 }} />}
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  kpiSection:    { marginBottom: SPACING.md },
  kpiItem:       { width: SW },
  kpiCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  kpiIconBox:    { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  kpiTextWrap:   { flex: 1, gap: 2 },
  kpiLabel:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount:     { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  kpiTrendBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full, flexShrink: 0 },
  kpiTrendTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  recentCard:    { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  recentHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10 },
  recentTitle:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  periodRow:     { flexDirection: 'row', gap: 4 },
  periodBtn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  periodBtnActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  periodTxt:     { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: '#fff' },
  typeRow:       { flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.md, paddingBottom: 10 },
  typeBtn:       { paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  typeBtnActive: { backgroundColor: COLORS.textPrimary },
  typeTxt:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  typeTxtActive: { color: '#fff' },
  txRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SPACING.md, gap: 10 },
  txBorder:      { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo:        { flex: 1 },
  txTopRow:      { flexDirection: 'row', alignItems: 'center' },
  txMode:        { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txRef:         { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  txSub:         { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txRight:       { alignItems: 'flex-end', gap: 2 },
  txAmt:         { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});

const ch = StyleSheet.create({
  card:      { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingTop: 14, overflow: 'hidden' },
  topRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, marginBottom: 8 },
  mainVal:   { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  changeVal: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', marginTop: 2 },
  dayTag:    { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dayTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  chartLabel:{ fontSize: 10, color: COLORS.textTertiary, textAlign: 'center', paddingBottom: 8, marginTop: 2 },
});

const dc = StyleSheet.create({
  card:        { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  title:       { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },
  body:        { flexDirection: 'row', alignItems: 'center', gap: 12 },
  donutWrap:   { alignItems: 'center', justifyContent: 'center' },
  center:      { alignItems: 'center' },
  centerAmt:   { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  centerLbl:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  legend:      { flex: 1, gap: 8 },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg },
  legendRowActive: { borderWidth: 1.5, borderColor: COLORS.brandPrimary },
  legendDot:   { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  legendTxtWrap: { flex: 1 },
  legendLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  legendPct:   { fontSize: 10, color: COLORS.textSecondary },
  legendAmt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  detail:      { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 10, borderWidth: 1.5 },
  detailDot:   { width: 10, height: 10, borderRadius: 5 },
  detailTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
});
