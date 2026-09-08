import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, {
  Path, Circle, Rect, Line, G, Text as SvgText, Defs, LinearGradient, Stop,
} from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPICashInHand } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  KPICarouselCard, KPICarouselPage, KPICarouselDots, KPI_CAROUSEL_PAGE_WIDTH,
} from '../../src/components/KPICarouselCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ViewAllButton } from '../../src/components/ViewAllButton';
import { useTranslation } from 'react-i18next';

const { width: SW } = Dimensions.get('window');
const YAXIS_W = 48;
const DAY_W = 36;
const CHART_H = 190;
const PAD_T = 36;
const PAD_B = 12;
const GOLD = '#A89060';
const BAR_DARK = '#3A3A3A';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DayPoint = {
  day: string;
  balance: number;
  inflow: number;
  outflow: number;
};

function weekdayLabel(iso: string) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getDay()] || '';
}

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

function compactTick(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${Math.round(n)}`;
}

function tipDate(iso: string) {
  const p = String(iso || '').slice(0, 10).split('-');
  if (p.length < 3) return '';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(p[2], 10)} ${m[parseInt(p[1], 10) - 1] || ''}`;
}

/** Pinned Y-axis + scrollable X plot + tap tooltip for daily balance. */
function DailyBalanceChart({
  data,
  formatAmountCompact,
  activeIdx,
  onActiveChange,
}: {
  data: DayPoint[];
  formatAmountCompact: (n: number) => string;
  activeIdx: number | null;
  onActiveChange: (idx: number | null) => void;
}) {
  if (!data.length) return null;

  const plotH = CHART_H - PAD_T - PAD_B;
  const maxVal = niceMax(Math.max(...data.map((d) => d.balance), 1));
  const yTicks = [0, 1, 2, 3, 4].map((i) => (maxVal / 4) * i);
  const chartW = data.length * DAY_W + 16;
  const xAt = (i: number) => i * DAY_W + DAY_W / 2;
  const yAt = (v: number) => PAD_T + plotH - (Math.max(0, v) / maxVal) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(d.balance).toFixed(1)}`)
    .join(' ');
  const areaPath = [
    `M${xAt(0).toFixed(1)},${(PAD_T + plotH).toFixed(1)}`,
    ...data.map((d, i) => `L${xAt(i).toFixed(1)},${yAt(d.balance).toFixed(1)}`),
    `L${xAt(data.length - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)}`,
    'Z',
  ].join(' ');

  const tip = activeIdx != null ? data[activeIdx] : null;

  return (
    <View style={{ flexDirection: 'row', height: CHART_H }}>
      {/* Fixed Y-axis — does not scroll */}
      <Svg width={YAXIS_W} height={CHART_H}>
        <Line
          x1={YAXIS_W - 1}
          y1={PAD_T - 4}
          x2={YAXIS_W - 1}
          y2={PAD_T + plotH}
          stroke={COLORS.borderDefault}
          strokeWidth={1}
        />
        {yTicks.map((tick) => (
          <SvgText
            key={tick}
            x={YAXIS_W - 6}
            y={yAt(tick) + 3}
            textAnchor="end"
            fontSize={9}
            fill={COLORS.textTertiary}
          >
            {compactTick(tick)}
          </SvgText>
        ))}
      </Svg>

      {/* Scrollable X plot */}
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator
        style={{ flex: 1 }}
      >
        <Svg width={chartW} height={CHART_H}>
          <Defs>
            <LinearGradient id="cashBalGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={GOLD} stopOpacity="0.35" />
              <Stop offset="1" stopColor={GOLD} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          {yTicks.map((tick) => (
            <Line
              key={`g-${tick}`}
              x1={0}
              y1={yAt(tick)}
              x2={chartW}
              y2={yAt(tick)}
              stroke={COLORS.borderDefault}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          ))}
          <Line
            x1={0}
            y1={PAD_T + plotH}
            x2={chartW}
            y2={PAD_T + plotH}
            stroke={COLORS.borderDefault}
            strokeWidth={1}
          />

          <Path d={areaPath} fill="url(#cashBalGrad)" />
          <Path d={linePath} stroke={GOLD} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {data.map((d, i) => {
            const x = xAt(i);
            const y = yAt(d.balance);
            const active = activeIdx === i;
            return (
              <G key={d.day || i} onPress={() => onActiveChange(active ? (data.length - 1) : i)}>
                <Rect x={i * DAY_W} y={0} width={DAY_W} height={CHART_H} fill="transparent" />
                <Circle
                  cx={x}
                  cy={y}
                  r={active ? 6 : 3.5}
                  fill={GOLD}
                  stroke={COLORS.cardBg}
                  strokeWidth={2}
                />
              </G>
            );
          })}

          {tip && activeIdx != null ? (
            <G>
              <Line
                x1={xAt(activeIdx)}
                y1={PAD_T}
                x2={xAt(activeIdx)}
                y2={PAD_T + plotH}
                stroke={GOLD}
                strokeWidth={1}
                strokeDasharray="3,3"
                opacity={0.7}
              />
              <Rect
                x={Math.max(4, Math.min(chartW - 100, xAt(activeIdx) - 50))}
                y={8}
                width={100}
                height={38}
                rx={6}
                fill={COLORS.textPrimary}
              />
              <SvgText
                x={Math.max(54, Math.min(chartW - 50, xAt(activeIdx)))}
                y={24}
                textAnchor="middle"
                fontSize={10}
                fontWeight="700"
                fill="#FFFFFF"
              >
                {tipDate(tip.day)}
              </SvgText>
              <SvgText
                x={Math.max(54, Math.min(chartW - 50, xAt(activeIdx)))}
                y={38}
                textAnchor="middle"
                fontSize={11}
                fontWeight="700"
                fill="#FFFFFF"
              >
                {formatAmountCompact(Math.round(tip.balance))}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      </ScrollView>
    </View>
  );
}

/** Pinned Y-axis + scrollable grouped bars + tap tooltip. */
function ReceiptsPaymentsChart({
  data,
  formatAmountCompact,
}: {
  data: DayPoint[];
  formatAmountCompact: (n: number) => string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  if (!data.length) return null;

  const plotH = CHART_H - PAD_T - PAD_B;
  const maxVal = niceMax(Math.max(...data.flatMap((d) => [d.inflow, d.outflow]), 1));
  const yTicks = [0, 1, 2, 3, 4].map((i) => (maxVal / 4) * i);
  const groupW = 42;
  const chartW = data.length * groupW + 8;
  const yAt = (v: number) => PAD_T + plotH - (Math.max(0, v) / maxVal) * plotH;
  const tip = activeIdx != null ? data[activeIdx] : null;

  return (
    <View style={{ flexDirection: 'row', height: CHART_H }}>
      <Svg width={YAXIS_W} height={CHART_H}>
        <Line
          x1={YAXIS_W - 1}
          y1={PAD_T - 4}
          x2={YAXIS_W - 1}
          y2={PAD_T + plotH}
          stroke={COLORS.borderDefault}
          strokeWidth={1}
        />
        {yTicks.map((tick) => (
          <SvgText
            key={tick}
            x={YAXIS_W - 6}
            y={yAt(tick) + 3}
            textAnchor="end"
            fontSize={9}
            fill={COLORS.textTertiary}
          >
            {compactTick(tick)}
          </SvgText>
        ))}
      </Svg>

      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator
        style={{ flex: 1 }}
      >
        <Svg width={chartW} height={CHART_H}>
          {yTicks.map((tick) => (
            <Line
              key={`g-${tick}`}
              x1={0}
              y1={yAt(tick)}
              x2={chartW}
              y2={yAt(tick)}
              stroke={COLORS.borderDefault}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          ))}
          <Line
            x1={0}
            y1={PAD_T + plotH}
            x2={chartW}
            y2={PAD_T + plotH}
            stroke={COLORS.borderDefault}
            strokeWidth={1}
          />

          {data.map((d, i) => {
            const gx = i * groupW + 6;
            const barW = 12;
            const inH = Math.max(2, (d.inflow / maxVal) * plotH);
            const outH = Math.max(2, (d.outflow / maxVal) * plotH);
            const active = activeIdx === i;
            return (
              <G key={d.day || i} onPress={() => setActiveIdx(active ? null : i)}>
                <Rect x={i * groupW} y={0} width={groupW} height={CHART_H} fill="transparent" />
                <Rect
                  x={gx}
                  y={yAt(d.inflow)}
                  width={barW}
                  height={inH}
                  rx={2}
                  fill={GOLD}
                  opacity={active ? 1 : 0.9}
                />
                <Rect
                  x={gx + barW + 3}
                  y={yAt(d.outflow)}
                  width={barW}
                  height={outH}
                  rx={2}
                  fill={BAR_DARK}
                  opacity={active ? 1 : 0.9}
                />
              </G>
            );
          })}

          {tip && activeIdx != null ? (
            <G>
              <Rect
                x={Math.max(4, Math.min(chartW - 118, activeIdx * groupW + groupW / 2 - 59))}
                y={6}
                width={118}
                height={52}
                rx={6}
                fill={COLORS.textPrimary}
              />
              <SvgText
                x={Math.max(63, Math.min(chartW - 59, activeIdx * groupW + groupW / 2))}
                y={20}
                textAnchor="middle"
                fontSize={9}
                fontWeight="600"
                fill="#FFFFFF"
              >
                {tipDate(tip.day)}
              </SvgText>
              <SvgText
                x={Math.max(63, Math.min(chartW - 59, activeIdx * groupW + groupW / 2))}
                y={36}
                textAnchor="middle"
                fontSize={10}
                fontWeight="700"
                fill="#FFFFFF"
              >
                {`In ${formatAmountCompact(Math.round(tip.inflow))}`}
              </SvgText>
              <SvgText
                x={Math.max(63, Math.min(chartW - 59, activeIdx * groupW + groupW / 2))}
                y={50}
                textAnchor="middle"
                fontSize={10}
                fontWeight="700"
                fill="#FFFFFF"
              >
                {`Out ${formatAmountCompact(Math.round(tip.outflow))}`}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      </ScrollView>
    </View>
  );
}

export default function CashInHandScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const sumRef = useRef<FlatList>(null);
  const [sumIdx, setSumIdx] = useState(0);
  const [chartDayIdx, setChartDayIdx] = useState<number | null>(null);
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const dataAsOfRef = useRef<Date | null>(null);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasDataRef.current;
    if (!soft) setIsLoading(true);
    // Soft refresh: keep stale data + banner until success (no wipe, no toast)
    if (!soft) setApiError(null);
    try {
      const from = dateFrom ? dmyToISO(dateFrom) : (selectedFY?.startDate || undefined);
      const to = dateTo ? dmyToISO(dateTo) : (selectedFY?.endDate || undefined);
      const res: any = await getKPICashInHand(companyGuid, { from, to });
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
        setApiError(err?.message || 'Failed to load cash in hand');
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, dateFrom, dateTo, selectedFY?.startDate, selectedFY?.endDate, lastSyncAt]);

  useEffect(() => { load({ soft: hasDataRef.current }); }, [load]);

  const summaryCards = useMemo(() => {
    const cards = Array.isArray(apiData?.kpi_cards) ? apiData.kpi_cards : null;
    const icons: Record<string, string> = {
      bal: 'cash-outline',
      in: 'arrow-down-circle-outline',
      out: 'arrow-up-circle-outline',
      net: 'swap-vertical-outline',
    };
    if (cards?.length) {
      return cards.map((c: any) => {
        const trend = c.trend_pct;
        const hasTrend = trend != null && Number.isFinite(Number(trend));
        const positive = c.trend_positive != null ? !!c.trend_positive : Number(trend) >= 0;
        return {
          id: String(c.id),
          icon: icons[c.id] || 'stats-chart-outline',
          label: c.label || c.id,
          amount: formatAmountCompact(Math.round(Number(c.amount) || 0)),
          trend: hasTrend ? `${Number(trend) >= 0 ? '+' : ''}${Number(trend)}%` : null,
          positive,
        };
      });
    }
    const bal = Number(apiData?.current_balance) || 0;
    const inflow = Number(apiData?.today_inflow) || 0;
    const outflow = Number(apiData?.today_outflow) || 0;
    const net = inflow - outflow;
    return [
      { id: 'bal', icon: 'cash-outline', label: 'Cash on Hand', amount: formatAmountCompact(Math.round(bal)), trend: null, positive: true },
      { id: 'in', icon: 'arrow-down-circle-outline', label: 'Inflow Today', amount: formatAmountCompact(Math.round(inflow)), trend: null, positive: true },
      { id: 'out', icon: 'arrow-up-circle-outline', label: 'Outflow Today', amount: formatAmountCompact(Math.round(outflow)), trend: null, positive: true },
      { id: 'net', icon: 'swap-vertical-outline', label: 'Net Today', amount: formatAmountCompact(Math.round(net)), trend: null, positive: true },
    ];
  }, [apiData, formatAmountCompact]);

  const daily: DayPoint[] = useMemo(() => {
    const rows = Array.isArray(apiData?.daily_balance) ? apiData.daily_balance : [];
    return rows.map((d: any) => ({
      day: String(d.day || '').slice(0, 10),
      balance: Math.max(0, Number(d.balance) || 0),
      inflow: Math.max(0, Number(d.inflow) || 0),
      outflow: Math.max(0, Number(d.outflow) || 0),
    }));
  }, [apiData]);

  useEffect(() => {
    if (daily.length) setChartDayIdx(daily.length - 1);
    else setChartDayIdx(null);
  }, [daily]);

  const activeChartDay = chartDayIdx != null ? daily[chartDayIdx] : daily[daily.length - 1];
  const curBal = Number(activeChartDay?.balance ?? apiData?.current_balance) || 0;
  const balChange = Number(apiData?.balance_change) || 0;
  const balChangePctRaw = apiData?.balance_change_pct;
  const balChangePct = balChangePctRaw != null && Number.isFinite(Number(balChangePctRaw))
    ? Number(balChangePctRaw)
    : null;

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
      <ScreenHeader title={t('kpi.cashInHand')} onBack={() => router.back()} />

      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={() => load({ soft: hasDataRef.current })} />}

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
                nestedScrollEnabled
                decelerationRate="fast"
                disableIntervalMomentum
                data={summaryCards}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, idx) => ({ length: KPI_CAROUSEL_PAGE_WIDTH, offset: KPI_CAROUSEL_PAGE_WIDTH * idx, index: idx })}
                onScrollToIndexFailed={() => {}}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                  setSumIdx(Math.round(e.nativeEvent.contentOffset.x / KPI_CAROUSEL_PAGE_WIDTH))}
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
              <KPICarouselDots count={summaryCards.length} activeIndex={sumIdx} />
            </View>

            {daily.length > 0 && (
              <View style={s.chartCard}>
                <View style={s.chartHeader}>
                  <View>
                    <Text style={s.chartTitle}>{t('kpi.dailyCashBalance')}</Text>
                    <View style={s.chartMeta}>
                      <Text style={s.chartAmt}>{formatAmountCompact(Math.round(curBal))}</Text>
                      {balChangePct != null ? (
                        <View style={[s.changeBadge, { backgroundColor: balChange >= 0 ? COLORS.positiveBg : COLORS.negativeBg }]}>
                          <Text style={[s.changeTxt, { color: balChange >= 0 ? COLORS.positive : COLORS.negative }]}>
                            {balChange >= 0 ? '+' : ''}{formatAmountCompact(Math.round(balChange))} ({balChangePct}%)
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={s.dayTag}>
                    <Text style={s.dayTxt}>
                      {activeChartDay?.day ? weekdayLabel(activeChartDay.day) : '—'}
                    </Text>
                  </View>
                </View>
                <DailyBalanceChart
                  data={daily}
                  formatAmountCompact={formatAmountCompact}
                  activeIdx={chartDayIdx}
                  onActiveChange={setChartDayIdx}
                />
              </View>
            )}

            {daily.length > 0 && (
              <View style={s.chartCard}>
                <View style={s.chartHeader}>
                  <Text style={s.chartTitle}>{t('kpi.receiptsVsPayments')}</Text>
                  <View style={s.legend}>
                    <View style={[s.legendDot, { backgroundColor: GOLD }]} />
                    <Text style={s.legendTxt}>{t('kpi.receipts')}</Text>
                    <View style={[s.legendDot, { backgroundColor: BAR_DARK }]} />
                    <Text style={s.legendTxt}>{t('kpi.payments')}</Text>
                  </View>
                </View>
                <ReceiptsPaymentsChart data={daily} formatAmountCompact={formatAmountCompact} />
              </View>
            )}

            <View style={s.recentCard}>
              <View style={s.recentHeader}>
                <Text style={s.chartTitle}>{t('kpi.recentTransactions')}</Text>
                <ViewAllButton
                  variant="inline"
                  label="View All"
                  onPress={() => router.push('/kpi/cash-register' as any)}
                />
              </View>
              {txs.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyTxt}>{t('kpi.noCashMovements')}</Text></View>
              ) : txs.slice(0, 5).map((txn: any, idx: number, arr: any[]) => (
                <TouchableOpacity
                  key={`tx-${idx}-${txn.guid || txn.voucher_number || 'x'}`}
                  style={[s.txRow, idx < arr.length - 1 && s.txBorder]}
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

  chartCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingTop: SPACING.md, paddingBottom: 8, overflow: 'hidden' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: SPACING.md, marginBottom: 8 },
  chartTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chartMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  chartAmt: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  changeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  changeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  dayTag: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dayTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
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
