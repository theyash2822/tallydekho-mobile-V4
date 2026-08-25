import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPICashInHand } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';

const { width: SW } = Dimensions.get('window');
const LINE_CHART_W = 30 * 34;
const BAR_CHART_W = 30 * 39;

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

function yLabels(max: number) {
  const steps = 4;
  const out: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const n = (max / steps) * i;
    if (n >= 100000) out.push(`₹${(n / 100000).toFixed(1)}L`);
    else if (n >= 1000) out.push(`₹${Math.round(n / 1000)}K`);
    else out.push(`₹${Math.round(n)}`);
  }
  return out;
}

export default function CashInHandScreen() {
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const sumRef = useRef<FlatList>(null);
  const [sumIdx, setSumIdx] = useState(0);
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const from = dateFrom ? dmyToISO(dateFrom) : (selectedFY?.startDate || undefined);
      const to = dateTo ? dmyToISO(dateTo) : (selectedFY?.endDate || undefined);
      const res: any = await getKPICashInHand(companyGuid, { from, to });
      setApiData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load cash in hand');
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, dateFrom, dateTo, selectedFY?.startDate, selectedFY?.endDate, lastSyncAt]);

  useEffect(() => { load(); }, [load]);

  const summaryCards = useMemo(() => {
    const bal = Number(apiData?.current_balance) || 0;
    const inflow = Number(apiData?.today_inflow) || 0;
    const outflow = Number(apiData?.today_outflow) || 0;
    const ledgers = Array.isArray(apiData?.ledgers) ? apiData.ledgers : [];
    const bankLike = ledgers.filter((l: any) => /bank/i.test(l.name || '')).reduce((s: number, l: any) => s + (Number(l.balance) || 0), 0);
    return [
      { id: 'out', icon: 'arrow-up-circle-outline', label: 'Outflow Today', amount: formatAmountCompact(Math.round(outflow)), trend: null as string | null, positive: true },
      { id: 'in', icon: 'arrow-down-circle-outline', label: 'Inflow Today', amount: formatAmountCompact(Math.round(inflow)), trend: null as string | null, positive: true },
      { id: 'ledgers', icon: 'business-outline', label: 'Cash Ledgers', amount: String(ledgers.length || 0), trend: bankLike ? formatAmountCompact(Math.round(bankLike)) : null, positive: true },
      { id: 'bal', icon: 'cash-outline', label: 'Cash on Hand', amount: formatAmountCompact(Math.round(bal)), trend: null as string | null, positive: true },
    ];
  }, [apiData, formatAmountCompact]);

  useEffect(() => {
    if (summaryCards.length <= 1) return;
    const t = setInterval(() => {
      setSumIdx((prev) => {
        const next = (prev + 1) % summaryCards.length;
        sumRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [summaryCards.length]);

  const daily = useMemo(() => {
    return Array.isArray(apiData?.daily_balance) ? apiData.daily_balance : [];
  }, [apiData]);

  const lineData = useMemo(() => daily.map((d: any, i: number) => ({
    value: Math.max(0, Number(d.balance) || 0),
    label: (i === 0 || (i + 1) % 5 === 0) ? String(i + 1) : '',
  })), [daily]);

  const barData = useMemo(() => daily.flatMap((d: any, i: number) => [
    {
      value: Math.max(0, Number(d.inflow) || 0),
      frontColor: '#A89060',
      label: (i === 0 || (i + 1) % 5 === 0) ? String(i + 1) : '',
      spacing: 3,
      barWidth: 9,
    },
    { value: Math.max(0, Number(d.outflow) || 0), frontColor: '#3A3A3A', spacing: 18, barWidth: 9 },
  ]), [daily]);

  const chartMax = useMemo(() => {
    const vals = [
      ...daily.map((d: any) => Number(d.balance) || 0),
      ...daily.map((d: any) => Number(d.inflow) || 0),
      ...daily.map((d: any) => Number(d.outflow) || 0),
    ];
    return niceMax(Math.max(...vals, 1));
  }, [daily]);

  const labels = useMemo(() => yLabels(chartMax), [chartMax]);

  const curBal = Number(daily[daily.length - 1]?.balance ?? apiData?.current_balance) || 0;
  const balChange = Number(apiData?.balance_change) || 0;
  const balChangePct = Number(apiData?.balance_change_pct) || 0;

  const txs = useMemo(() => {
    const rows = Array.isArray(apiData?.transactions) ? apiData.transactions : [];
    return rows.map((r: any) => ({
      guid: r.guid,
      voucher_number: r.voucher_number,
      party_name: r.party_name,
      voucher_type: r.voucher_type,
      amount: Math.abs(Number(r.amount) || 0),
      date: r.date,
      direction: r.direction === 'in' ? 'in' : 'out',
    }));
  }, [apiData]);

  const fmtRange = () => {
    const fmt = (s: string) => {
      const p = s.split('/');
      if (p.length < 3) return s;
      const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${parseInt(p[0], 10)} ${m[parseInt(p[1], 10) - 1]}`;
    };
    const f = dateFrom || isoToDMY(selectedFY?.startDate || '');
    const t = dateTo || isoToDMY(selectedFY?.endDate || '');
    if (!f && !t) return 'Select Range';
    return `${fmt(f)} – ${fmt(t)}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cash in Hand</Text>
        <View style={s.headerBtn} />
      </View>

      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={load} />}

        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={100} />
            {[0, 1, 2, 3].map((i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            <View style={s.carouselWrap}>
              <FlatList
                ref={sumRef}
                horizontal
                pagingEnabled
                data={summaryCards}
                keyExtractor={(i) => i.id}
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
                      <View style={[s.trendBadge, { backgroundColor: COLORS.pageBg }]}>
                        <Ionicons name="remove-outline" size={11} color={COLORS.textTertiary} />
                        <Text style={[s.trendTxt, { color: COLORS.textTertiary }]}>{item.trend ?? '—'}</Text>
                      </View>
                    </View>
                  </View>
                )}
              />
              <View style={s.dots}>
                {summaryCards.map((_, i) => (
                  <View key={i} style={[s.dot, i === sumIdx && s.dotActive]} />
                ))}
              </View>
            </View>

            {daily.length > 0 && (
              <View style={s.chartCard}>
                <View style={s.chartHeader}>
                  <View>
                    <Text style={s.chartTitle}>Daily Cash Balance</Text>
                    <View style={s.chartMeta}>
                      <Text style={s.chartAmt}>{formatAmountCompact(Math.round(curBal))}</Text>
                      <View style={[s.changeBadge, { backgroundColor: balChange >= 0 ? COLORS.positiveBg : COLORS.negativeBg }]}>
                        <Text style={[s.changeTxt, { color: balChange >= 0 ? COLORS.positive : COLORS.negative }]}>
                          {balChange >= 0 ? '+' : ''}{formatAmountCompact(Math.round(balChange))} ({balChangePct}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={s.chartDate}>30 days</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
                  <LineChart
                    data={lineData}
                    areaChart
                    curved
                    color="#A89060"
                    thickness={2}
                    startFillColor="rgba(168,144,96,0.3)"
                    endFillColor="rgba(168,144,96,0.05)"
                    startOpacity={0.9}
                    endOpacity={0.1}
                    initialSpacing={16}
                    spacing={34}
                    maxValue={chartMax}
                    noOfSections={4}
                    yAxisLabelWidth={52}
                    yAxisLabelTexts={labels}
                    yAxisTextStyle={{ color: COLORS.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: COLORS.textTertiary, fontSize: 9 }}
                    rulesType="dashed"
                    rulesColor={COLORS.borderDefault}
                    dataPointsColor="#A89060"
                    dataPointsRadius={3}
                    isAnimated
                    height={180}
                    width={LINE_CHART_W}
                  />
                </ScrollView>
              </View>
            )}

            {daily.length > 0 && (
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
                    data={barData}
                    width={BAR_CHART_W}
                    height={160}
                    maxValue={chartMax}
                    noOfSections={4}
                    yAxisLabelWidth={52}
                    yAxisLabelTexts={labels}
                    yAxisTextStyle={{ color: COLORS.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: COLORS.textTertiary, fontSize: 9 }}
                    rulesType="dashed"
                    rulesColor={COLORS.borderDefault}
                    isAnimated
                    barBorderRadius={2}
                  />
                </ScrollView>
              </View>
            )}

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
              {txs.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyTxt}>No cash movements in this period</Text></View>
              ) : txs.map((txn: any, idx: number) => (
                <TouchableOpacity
                  key={txn.guid || `${txn.voucher_number}-${idx}`}
                  style={[s.txRow, idx < txs.length - 1 && s.txBorder]}
                  activeOpacity={0.7}
                  onPress={() => txn.guid && router.push(`/document/${txn.guid}` as any)}
                >
                  <View style={[s.txIconBox, { backgroundColor: COLORS.pageBg }]}>
                    <Ionicons
                      name={txn.direction === 'in' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={16}
                      color={txn.direction === 'in' ? COLORS.positive : COLORS.negative}
                    />
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txDesc} numberOfLines={1}>{txn.party_name || txn.voucher_type || 'Cash'}</Text>
                    <Text style={s.txMeta}>{` ${txn.voucher_number || '—'} · ${fmtDate(txn.date)}`}</Text>
                  </View>
                  <Text style={[s.txAmt, { color: txn.direction === 'in' ? COLORS.positive : COLORS.negative }]}>
                    {txn.direction === 'in' ? '+' : '−'}{formatAmount(Math.round(txn.amount))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom || isoToDMY(selectedFY?.startDate || '')}
        toDate={dateTo || isoToDMY(selectedFY?.endDate || '')}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  carouselWrap: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  cardItem: { width: SW },
  sumCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  sumIconBox: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sumTextWrap: { flex: 1, gap: 4 },
  sumLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sumAmount: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, flexShrink: 0 },
  trendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  chartCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingTop: SPACING.md },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, marginBottom: 12 },
  chartTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chartMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chartAmt: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  changeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  chartDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500', marginTop: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginRight: 4 },

  recentCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', flexShrink: 0 },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
