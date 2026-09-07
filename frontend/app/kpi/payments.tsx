import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line, Circle, Defs, LinearGradient as SvgGrad, Stop, Text as SvgText } from 'react-native-svg';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPIPayments } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  KPICarouselCard, KPICarouselPage, KPICarouselDots, KPI_CAROUSEL_PAGE_WIDTH,
} from '../../src/components/KPICarouselCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TxnListRow } from '../../src/components/TxnListRow';
import { useTranslation } from 'react-i18next';
import {
  resolvePeriodDates,
  type DashboardPeriod,
} from '../../src/utils/periodDates';

const { width: SW } = Dimensions.get('window');
const PERIOD_TABS = ['7D', '1M', '3M', '6M'] as const;
const TYPE_TABS = ['All', 'Cash', 'Bank'] as const;

const CHART_COLOR = '#A89060';
const PAD_L = 46;
const PAD_T = 14;
const PAD_B = 24;
const CHART_W_FULL = SW - 32;
const CHART_H_SVG = 160;
const CHART_W = CHART_W_FULL - PAD_L - 8;
const CHART_H = CHART_H_SVG - PAD_T - PAD_B;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Tx = {
  guid?: string;
  voucher_number?: string;
  party_name?: string;
  amount: number;
  date?: string;
  mode?: string;
};

type DayPoint = { day: string; amount: number; label: string };

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function weekdayLabel(iso: string) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()] || '';
}

function fmtK(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${Math.round(v)}`;
}

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

function DailyOutflowChart({
  data,
  formatAmountCompact,
}: {
  data: DayPoint[];
  formatAmountCompact: (n: number) => string;
}) {
  const defaultIdx = Math.max(0, data.length - 1);
  const [activeIdx, setActiveIdx] = useState<number | null>(defaultIdx);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    setActiveIdx(Math.max(0, data.length - 1));
  }, [data]);

  const vals = data.map((d) => d.amount);
  const maxV = niceMax(Math.max(...vals, 1));
  const minV = 0;
  const range = maxV - minV || 1;
  const n = Math.max(data.length, 2);

  const getX = (i: number) => PAD_L + (i / (n - 1)) * CHART_W;
  const getY = (v: number) => PAD_T + (1 - (Math.max(0, v) - minV) / range) * CHART_H;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${getX(i).toFixed(1)},${getY(d.amount).toFixed(1)}`)
    .join(' ');
  const areaPath = data.length
    ? `${linePath} L${getX(data.length - 1).toFixed(1)},${(PAD_T + CHART_H).toFixed(1)} L${PAD_L.toFixed(1)},${(PAD_T + CHART_H).toFixed(1)} Z`
    : '';
  const yLabels = Array.from({ length: 5 }, (_, i) => maxV - (i / 4) * (maxV - minV));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const rows = dataRef.current;
          if (!rows.length) return;
          if (hideTimer.current) clearTimeout(hideTimer.current);
          const lx = e.nativeEvent.locationX;
          const idx = Math.round(((lx - PAD_L) / CHART_W) * (rows.length - 1));
          setActiveIdx(Math.max(0, Math.min(rows.length - 1, idx)));
        },
        onPanResponderMove: (e) => {
          const rows = dataRef.current;
          if (!rows.length) return;
          if (hideTimer.current) clearTimeout(hideTimer.current);
          const lx = e.nativeEvent.locationX;
          const idx = Math.round(((lx - PAD_L) / CHART_W) * (rows.length - 1));
          setActiveIdx(Math.max(0, Math.min(rows.length - 1, idx)));
        },
        onPanResponderRelease: () => {
          hideTimer.current = setTimeout(() => {
            setActiveIdx(Math.max(0, dataRef.current.length - 1));
          }, 3000);
        },
      }),
    []
  );

  if (!data.length) return null;

  const idx = activeIdx != null ? activeIdx : defaultIdx;
  const activeDay = data[idx] || data[defaultIdx];
  const prevVal = idx > 0 ? data[idx - 1].amount : activeDay.amount;
  const change = activeDay.amount - prevVal;
  const changePct = prevVal ? ((change / prevVal) * 100).toFixed(1) : null;
  const changePos = change >= 0;

  return (
    <View style={ch.card}>
      <View style={ch.topRow}>
        <View>
          <Text style={ch.mainVal}>{formatAmountCompact(Math.round(activeDay.amount))}</Text>
          {changePct != null && idx > 0 ? (
            <Text style={[ch.changeVal, { color: changePos ? COLORS.positive : COLORS.negative }]}>
              {changePos ? '+' : ''}{formatAmountCompact(Math.round(change))} ({changePct}%)
            </Text>
          ) : (
            <Text style={[ch.changeVal, { color: COLORS.textTertiary }]}>vs prior day</Text>
          )}
        </View>
        <View style={ch.dayTag}>
          <Text style={ch.dayTxt}>{activeDay.label || weekdayLabel(activeDay.day)}</Text>
        </View>
      </View>

      <View {...pan.panHandlers}>
        <Svg width={CHART_W_FULL} height={CHART_H_SVG}>
          <Defs>
            <SvgGrad id="pmtAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={CHART_COLOR} stopOpacity="0.35" />
              <Stop offset="1" stopColor={CHART_COLOR} stopOpacity="0.02" />
            </SvgGrad>
          </Defs>

          {yLabels.map((v, i) => {
            const y = PAD_T + (i / (yLabels.length - 1)) * CHART_H;
            return (
              <SvgText key={i} x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize={8} fill={COLORS.textTertiary}>
                {fmtK(v)}
              </SvgText>
            );
          })}

          {data.map((d, i) => (
            <SvgText key={d.day} x={getX(i)} y={CHART_H_SVG - 4} textAnchor="middle" fontSize={9} fill={COLORS.textTertiary}>
              {d.label || weekdayLabel(d.day)}
            </SvgText>
          ))}

          {yLabels.map((_, i) => {
            const y = PAD_T + (i / (yLabels.length - 1)) * CHART_H;
            return <Line key={i} x1={PAD_L} y1={y} x2={PAD_L + CHART_W} y2={y} stroke={COLORS.borderDefault} strokeWidth={1} />;
          })}

          {areaPath ? <Path d={areaPath} fill="url(#pmtAreaGrad)" /> : null}
          {linePath ? (
            <Path d={linePath} stroke={CHART_COLOR} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}

          {activeIdx !== null && data[activeIdx] ? (
            <>
              <Line
                x1={getX(activeIdx)} y1={PAD_T}
                x2={getX(activeIdx)} y2={PAD_T + CHART_H}
                stroke={CHART_COLOR} strokeWidth={1} strokeDasharray="3,3"
              />
              <Circle cx={getX(activeIdx)} cy={getY(data[activeIdx].amount)} r={6} fill={CHART_COLOR} />
              <Circle cx={getX(activeIdx)} cy={getY(data[activeIdx].amount)} r={3} fill="#fff" />
            </>
          ) : null}
        </Svg>
      </View>

      <Text style={ch.chartLabel}>Daily Outflow — touch to explore</Text>
    </View>
  );
}

function CashBankDonut({
  cash,
  bank,
  formatAmountCompact,
}: {
  cash: number;
  bank: number;
  formatAmountCompact: (n: number) => string;
}) {
  const { t } = useTranslation();
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const total = cash + bank;
  const segments = [
    { value: Math.max(cash, 0.0001), color: '#A89060', label: t('kpi.cashInHand'), raw: cash },
    { value: Math.max(bank, 0.0001), color: '#3A3A3A', label: t('kpi.bankBalance'), raw: bank },
  ];
  const pct = (v: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '—');

  return (
    <View style={dc.card}>
      <Text style={dc.title}>{t('kpi.cashVsBank')}</Text>
      <View style={dc.body}>
        <View style={dc.donutWrap}>
          <PieChart
            data={segments.map((s) => ({ value: s.value, color: s.color }))}
            donut
            radius={72}
            innerRadius={48}
            innerCircleColor={COLORS.cardBg}
            strokeColor={COLORS.cardBg}
            strokeWidth={2}
            onPress={(_item: any, index: number) => setSelIdx((prev) => (prev === index ? null : index))}
            centerLabelComponent={() => (
              <View style={dc.center}>
                <Text style={dc.centerAmt} numberOfLines={1}>
                  {formatAmountCompact(Math.round(total))}
                </Text>
                <Text style={dc.centerLbl}>Total</Text>
              </View>
            )}
          />
        </View>

        <View style={dc.legend}>
          {segments.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[dc.legendRow, selIdx === i && dc.legendRowActive]}
              onPress={() => setSelIdx((prev) => (prev === i ? null : i))}
              activeOpacity={0.75}
            >
              <View style={[dc.legendDot, { backgroundColor: item.color }]} />
              <View style={dc.legendTxtWrap}>
                <Text style={dc.legendLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={dc.legendPct} numberOfLines={1}>{pct(item.raw)}</Text>
              </View>
              <Text style={dc.legendAmt} numberOfLines={1}>
                {formatAmountCompact(Math.round(item.raw))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selIdx !== null && (
        <View style={[dc.detail, { borderColor: segments[selIdx].color }]}>
          <View style={[dc.detailDot, { backgroundColor: segments[selIdx].color }]} />
          <Text style={dc.detailTxt} numberOfLines={2}>
            {segments[selIdx].label}: {formatAmountCompact(Math.round(segments[selIdx].raw))} ({pct(segments[selIdx].raw)})
          </Text>
        </View>
      )}
    </View>
  );
}

export default function PaymentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const [period, setPeriod] = useState<(typeof PERIOD_TABS)[number]>('7D');
  const [typeTab, setTypeTab] = useState<(typeof TYPE_TABS)[number]>('All');
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const dataAsOfRef = useRef<Date | null>(null);
  const [kpiIdx, setKpiIdx] = useState(0);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasDataRef.current;
    if (!soft) setIsLoading(true);
    // Soft refresh: keep stale data + banner until success (no wipe, no toast)
    if (!soft) setApiError(null);
    try {
      const { from, to } = resolvePeriodDates(period as DashboardPeriod, {
        from: selectedFY?.startDate,
        to: selectedFY?.endDate,
      });
      const res: any = await getKPIPayments(companyGuid, { from, to, period });
      setApiData(res?.data ?? res);
      hasDataRef.current = true;
      dataAsOfRef.current = new Date();
      setApiError(null);
    } catch (err: any) {
      if (hasDataRef.current) {
        const ts = dataAsOfRef.current
          ? dataAsOfRef.current.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : 'earlier';
        setApiError(`Couldn't refresh. Showing data from ${ts}. Retry`);
      } else {
        setApiError(err?.message || 'Failed to load payments');
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, period, selectedFY?.startDate, selectedFY?.endDate, lastSyncAt]);

  useEffect(() => { load({ soft: hasDataRef.current }); }, [load]);

  const txs: Tx[] = useMemo(() => {
    const rows = Array.isArray(apiData?.transactions) ? apiData.transactions : [];
    return rows.map((r: any) => ({
      guid: r.guid,
      voucher_number: r.voucher_number,
      party_name: r.party_name,
      amount: Math.abs(Number(r.amount) || 0),
      date: r.date,
      mode: r.mode || 'Other',
    }));
  }, [apiData]);

  const filtered = useMemo(() => {
    if (typeTab === 'All') return txs;
    return txs.filter((t) => t.mode === typeTab);
  }, [txs, typeTab]);

  const kpiCards = useMemo(() => {
    const cards = Array.isArray(apiData?.kpi_cards) ? apiData.kpi_cards : null;
    const icons: Record<string, string> = {
      period: 'send-outline',
      today: 'calendar-outline',
      cash: 'cash-outline',
      bank: 'business-outline',
    };
    if (cards?.length) {
      return cards.map((c: any) => {
        const trend = c.trend_pct;
        const hasTrend = trend != null && Number.isFinite(Number(trend));
        const positive = c.trend_positive != null ? !!c.trend_positive : Number(trend) >= 0;
        const label = c.id === 'period' ? t('kpi.periodPayments', { period }) : (c.label || c.id);
        return {
          id: String(c.id),
          icon: icons[c.id] || 'stats-chart-outline',
          label,
          amount: formatAmountCompact(Math.round(Number(c.amount) || 0)),
          trend: hasTrend ? `${Number(trend) >= 0 ? '+' : ''}${Number(trend)}%` : null,
          positive,
        };
      });
    }
    const total = Number(apiData?.total) || 0;
    const today = Number(apiData?.today_total) || 0;
    const cash = Number(apiData?.cash_total) || 0;
    const bank = Number(apiData?.bank_total) || 0;
    return [
      { id: 'period', icon: 'send-outline', label: t('kpi.periodPayments', { period }), amount: formatAmountCompact(Math.round(total)), trend: null, positive: true },
      { id: 'today', icon: 'calendar-outline', label: 'Today', amount: formatAmountCompact(Math.round(today)), trend: null, positive: true },
      { id: 'cash', icon: 'cash-outline', label: 'Cash', amount: formatAmountCompact(Math.round(cash)), trend: null, positive: true },
      { id: 'bank', icon: 'business-outline', label: 'Bank', amount: formatAmountCompact(Math.round(bank)), trend: null, positive: true },
    ];
  }, [apiData, period, formatAmountCompact]);

  const daily: DayPoint[] = useMemo(() => {
    const rows = Array.isArray(apiData?.daily_series) ? apiData.daily_series : [];
    return rows.map((d: any) => {
      const day = String(d.day || '').slice(0, 10);
      return { day, amount: Math.max(0, Number(d.amount) || 0), label: weekdayLabel(day) };
    });
  }, [apiData]);

  const cashTotal = Number(apiData?.cash_total) || 0;
  const bankTotal = Number(apiData?.bank_total) || 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('kpi.payments')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={() => load({ soft: hasDataRef.current })} />}

        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={100} />
            {[0, 1, 2, 3].map((i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            <View style={s.kpiSection}>
              <FlatList
                horizontal
                pagingEnabled
                data={kpiCards}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: KPI_CAROUSEL_PAGE_WIDTH, offset: KPI_CAROUSEL_PAGE_WIDTH * index, index })}
                onMomentumScrollEnd={(e) => setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / KPI_CAROUSEL_PAGE_WIDTH))}
                renderItem={({ item }) => (
                  <KPICarouselPage>
                    <KPICarouselCard
                      icon={item.icon}
                      label={item.label}
                      amount={item.amount}
                      trend={item.trend}
                      positive={item.positive}
                    />
                  </KPICarouselPage>
                )}
              />
              <KPICarouselDots count={kpiCards.length} activeIndex={kpiIdx} />
            </View>

            {daily.length > 0 && (
              <DailyOutflowChart data={daily} formatAmountCompact={formatAmountCompact} />
            )}

            <CashBankDonut cash={cashTotal} bank={bankTotal} formatAmountCompact={formatAmountCompact} />

            <View style={s.recentCard}>
              <View style={s.recentHeader}>
                <Text style={s.recentTitle}>{t('kpi.recentPayments')}</Text>
                <View style={s.periodRow}>
                  {PERIOD_TABS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[s.periodBtn, period === p && s.periodBtnActive]}
                      onPress={() => setPeriod(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.periodTxt, period === p && s.periodTxtActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.typeRow}>
                {TYPE_TABS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, typeTab === t && s.typeBtnActive]}
                    onPress={() => setTypeTab(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.typeTxt, typeTab === t && s.typeTxtActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {filtered.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTxt}>No payments in this period</Text>
                </View>
              ) : filtered.map((p, idx) => (
                <TxnListRow
                  key={p.guid || `${p.voucher_number}-${idx}`}
                  icon={p.mode === 'Cash' ? 'cash-outline' : 'card-outline'}
                  title={p.mode || 'Payment'}
                  refLabel={p.voucher_number || '—'}
                  subtitle={`${p.party_name || '—'} · ${fmtDate(p.date)}`}
                  amount={formatAmount(Math.round(p.amount))}
                  showBorder={idx < filtered.length - 1}
                  onPress={() => p.guid && router.push(`/document/${p.guid}?type=payment_voucher` as any)}
                />
              ))}
            </View>
          </>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  kpiSection: { marginBottom: SPACING.md },

  recentCard: { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10 },
  recentTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  periodRow: { flexDirection: 'row', gap: 4 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  periodBtnActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  periodTxt: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: '#fff' },
  typeRow: { flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.md, paddingBottom: 10 },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  typeBtnActive: { backgroundColor: COLORS.textPrimary },
  typeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  typeTxtActive: { color: '#fff' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SPACING.md, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txTopRow: { flexDirection: 'row', alignItems: 'center' },
  txMode: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txRef: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  txSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});

const ch = StyleSheet.create({
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingTop: 14, overflow: 'hidden' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, marginBottom: 8 },
  mainVal: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  changeVal: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', marginTop: 2 },
  dayTag: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dayTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  chartLabel: { fontSize: 10, color: COLORS.textTertiary, textAlign: 'center', paddingBottom: 8, marginTop: 2 },
});

const dc = StyleSheet.create({
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 14 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  donutWrap: { width: 148, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  center: { alignItems: 'center', justifyContent: 'center', maxWidth: 90 },
  centerAmt: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  centerLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  legend: { flex: 1, gap: 8, minWidth: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg },
  legendRowActive: { borderWidth: 1.5, borderColor: COLORS.brandPrimary || CHART_COLOR },
  legendDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  legendTxtWrap: { flex: 1, minWidth: 0, justifyContent: 'flex-start' },
  legendLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  legendPct: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  legendAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
  detail: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 10, borderWidth: 1.5 },
  detailDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  detailTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
});
