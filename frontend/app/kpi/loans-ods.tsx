import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Dimensions, Modal,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPILoansODs } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  KPICarouselCard, KPICarouselPage, KPICarouselDots, KPI_CAROUSEL_PAGE_WIDTH,
} from '../../src/components/KPICarouselCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from 'react-i18next';

const { width: SW } = Dimensions.get('window');

const CARD_GRADIENTS: readonly [string, string][] = [
  ['#1B5E40', '#0D3B2E'],
  ['#7A5C2E', '#4A3318'],
  ['#1B2E5E', '#0D1A40'],
  ['#3D1A5E', '#200D40'],
  ['#5E3A1B', '#3B240D'],
];

type SrcField = {
  value: any;
  source?: string;
  confidence?: number;
  label?: string;
  method?: string;
};

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function srcLabel(f?: SrcField | null) {
  if (!f?.value && f?.value !== 0) return null;
  const s = f.source;
  if (s === 'PREDICTED' || s === 'DERIVED') return f.label || (s === 'PREDICTED' ? 'Expected' : 'Estimated');
  return null;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

type CalEvent = { dueDate: string; amount: number; tag: string; loan: string };

/** App-style month grid calendar (same pattern as DateRangePickerModal / pre-cleanup Loans UI). */
function LoanCalendarModal({
  visible,
  onClose,
  mode,
  events,
  formatAmount,
}: {
  visible: boolean;
  onClose: () => void;
  mode: 'emi' | 'od';
  events: CalEvent[];
  formatAmount: (n: number) => string;
}) {
  const today = new Date();
  const firstEvent = events[0]?.dueDate ? new Date(`${events[0].dueDate.slice(0, 10)}T12:00:00`) : today;
  const [viewYear, setViewYear] = useState(firstEvent.getFullYear());
  const [viewMonth, setViewMonth] = useState(firstEvent.getMonth());
  const [selDate, setSelDate] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const ref = events[0]?.dueDate
      ? new Date(`${events[0].dueDate.slice(0, 10)}T12:00:00`)
      : new Date();
    if (!Number.isNaN(ref.getTime())) {
      setViewYear(ref.getFullYear());
      setViewMonth(ref.getMonth());
    }
    setSelDate(null);
  }, [visible, events]);

  const calDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [viewYear, viewMonth]);

  const eventsForDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => String(e.dueDate).slice(0, 10) === iso);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
    setSelDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
    setSelDate(null);
  };

  const selectedEvents = selDate != null ? eventsForDay(selDate) : [];
  const title = mode === 'emi' ? 'Expected EMI Calendar' : 'Expected OD Interest';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={cs.sheet}>
          <View style={cs.handle} />
          <View style={cs.sheetHeader}>
            <Text style={cs.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={cs.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={cs.hint}>
            Marked dates are expected from Tally history — not contractual bank due dates.
          </Text>

          <View style={cs.navRow}>
            <TouchableOpacity style={cs.navBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={cs.monthYear}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity style={cs.navBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={cs.dayRow}>
            {DAY_LABELS.map((d) => <Text key={d} style={cs.dayLabel}>{d}</Text>)}
          </View>

          <View style={cs.grid}>
            {calDays.map((day, idx) => {
              if (!day) return <View key={idx} style={cs.cell} />;
              const marked = eventsForDay(day).length > 0;
              const isSelected = selDate === day;
              return (
                <TouchableOpacity
                  key={idx}
                  style={cs.cell}
                  onPress={() => setSelDate(isSelected ? null : day)}
                  activeOpacity={0.7}
                >
                  <View style={[cs.dayCircle, marked && cs.dayEmi, isSelected && cs.daySelected]}>
                    <Text style={[cs.dayTxt, marked && cs.dayEmiTxt, isSelected && cs.daySelectedTxt]}>
                      {day}
                    </Text>
                  </View>
                  {marked && !isSelected && <View style={cs.emiDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={cs.legend}>
            <View style={cs.legendItem}>
              <View style={[cs.legendDot, { backgroundColor: COLORS.brandPrimary }]} />
              <Text style={cs.legendTxt}>
                {mode === 'emi' ? 'Expected EMI' : 'Expected OD interest'}
              </Text>
            </View>
          </View>

          {selDate !== null && (
            <View style={cs.emiList}>
              <Text style={cs.emiListTitle}>
                {selDate} {MONTHS[viewMonth]} — {mode === 'emi' ? 'Expected EMIs' : 'Expected interest'}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={cs.noEmi}>No expected payment on this date</Text>
              ) : (
                selectedEvents.map((e, i) => (
                  <View key={`${e.dueDate}-${i}`} style={[cs.emiRow, i < selectedEvents.length - 1 && cs.emiRowBorder]}>
                    <View style={cs.emiIcon}>
                      <Ionicons name="business-outline" size={16} color={COLORS.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={cs.emiLoan}>{e.loan}</Text>
                      <Text style={cs.emiTag}>{e.tag}</Text>
                    </View>
                    <Text style={cs.emiAmt}>{formatAmount(Math.round(e.amount))}</Text>
                  </View>
                ))
              )}
            </View>
          )}
          <View style={{ height: 20 }} />
        </View>
      </View>
    </Modal>
  );
}

function BarProgress({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${p}%` }]} />
    </View>
  );
}

export default function LoansODsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const dataAsOfRef = useRef<Date | null>(null);
  const [kpiIdx, setKpiIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'history' | 'od'>('history');
  const [showCalendar, setShowCalendar] = useState(false);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasDataRef.current;
    if (!soft) setIsLoading(true);
    // Soft refresh: keep stale data + banner until success (no wipe, no toast)
    if (!soft) setApiError(null);
    try {
      const res: any = await getKPILoansODs(companyGuid);
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
        setApiError(err?.message || 'Failed to load loans & ODs');
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, lastSyncAt]);

  useEffect(() => { load({ soft: hasDataRef.current }); }, [load]);

  const cards = useMemo(() => {
    const loans = Array.isArray(apiData?.loans) ? apiData.loans : [];
    const ods = Array.isArray(apiData?.overdrafts) ? apiData.overdrafts : [];
    return [...loans, ...ods].map((f: any, i: number) => ({
      ...f,
      _key: f.ledgerGuid || `${f.name}-${i}`,
      gradient: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
    }));
  }, [apiData]);

  useEffect(() => {
    if (cardIdx >= cards.length) setCardIdx(0);
  }, [cards.length, cardIdx]);

  const active = cards[cardIdx] || null;
  const isOd = active?.facilityType === 'OD';

  useEffect(() => {
    setActiveTab(isOd ? 'od' : 'history');
  }, [active?._key, isOd]);

  const kpiCards = useMemo(() => {
    const apiKpiCards = Array.isArray(apiData?.kpi_cards) ? apiData.kpi_cards : null;
    const icons: Record<string, string> = {
      total: 'cash-outline',
      term: 'business-outline',
      od: 'swap-horizontal-outline',
      count: 'list-outline',
    };
    if (apiKpiCards?.length) {
      return apiKpiCards.map((c: any) => {
        const trend = c.trend_pct;
        const hasTrend = trend != null && Number.isFinite(Number(trend));
        const positive = c.trend_positive != null ? !!c.trend_positive : Number(trend) >= 0;
        const amount = c.id === 'count'
          ? String(Math.round(Number(c.amount) || 0))
          : formatAmountCompact(Math.round(Number(c.amount) || 0));
        return {
          id: String(c.id),
          icon: icons[c.id] || 'stats-chart-outline',
          label: c.label || c.id,
          amount,
          trend: hasTrend ? `${Number(trend) >= 0 ? '+' : ''}${Number(trend)}%` : null,
          positive,
        };
      });
    }
    const total = Number(apiData?.total) || 0;
    const loanTotal = Number(apiData?.loan_total) || 0;
    const odTotal = Number(apiData?.od_total) || 0;
    return [
      { id: 'total', icon: 'cash-outline', label: 'Total Outstanding', amount: formatAmountCompact(Math.round(total)), trend: null, positive: true },
      { id: 'term', icon: 'business-outline', label: t('kpi.loans'), amount: formatAmountCompact(Math.round(loanTotal)), trend: null, positive: true },
      { id: 'od', icon: 'swap-horizontal-outline', label: 'ODs / Overdraft', amount: formatAmountCompact(Math.round(odTotal)), trend: null, positive: true },
      { id: 'count', icon: 'list-outline', label: 'Accounts', amount: String(cards.length), trend: null, positive: true },
    ];
  }, [apiData, cards.length, formatAmountCompact, t]);

  const outstandingRows = useMemo(() => {
    const hist = Array.isArray(active?.outstandingHistory) ? active.outstandingHistory : [];
    const original = Number(active?.originalPrincipal?.value) || 0;
    return hist.map((h: any) => {
      const amt = Number(h.outstanding) || 0;
      const pct = original > 0 ? Math.round((amt / original) * 100) : null;
      return { month: h.month, amount: amt, pct };
    }).reverse();
  }, [active]);

  const odSeries = useMemo(() => {
    const series = Array.isArray(active?.series) ? active.series : [];
    return [...series].reverse().slice(0, 8);
  }, [active]);

  const upcoming = Array.isArray(active?.upcomingInstallments) ? active.upcomingInstallments : [];
  const recentEmis = Array.isArray(active?.recentEvents) ? active.recentEvents : [];
  const txns = Array.isArray(active?.transactions) ? active.transactions : [];
  const rich = active?.mode === 'RICH';

  const calendarEvents = useMemo<CalEvent[]>(() => {
    if (!active) return [];
    if (isOd) {
      const d = active.nextInterestDate?.value;
      if (!d) return [];
      return [{
        dueDate: String(d).slice(0, 10),
        amount: 0,
        tag: srcLabel(active.nextInterestDate) || 'Expected Interest',
        loan: active.name,
      }];
    }
    return upcoming.map((e: any) => ({
      dueDate: String(e.dueDate || '').slice(0, 10),
      amount: Number(e.scheduledAmount) || 0,
      tag: e.label || 'Expected EMI',
      loan: active.name,
    })).filter((e: CalEvent) => !!e.dueDate);
  }, [active, isOd, upcoming]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('kpi.loansOds')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={() => load({ soft: hasDataRef.current })} />}

        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={100} />
            <CardSkeleton height={160} />
            {[0, 1, 2].map(i => <LedgerRowSkeleton key={i} />)}
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
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / KPI_CAROUSEL_PAGE_WIDTH));
                }}
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

            {cards.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyTxt}>No loan or OD ledgers found</Text>
              </View>
            ) : (
              <View style={s.loanSection}>
                <FlatList
                  horizontal
                  pagingEnabled
                  data={cards}
                  keyExtractor={(c) => c._key}
                  showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
                  onScrollToIndexFailed={() => {}}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    setCardIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                  }}
                  renderItem={({ item: card }) => (
                    <View style={s.loanItem}>
                      <LinearGradient
                        colors={card.gradient as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.loanCard}
                      >
                        <View style={s.loanTopRow}>
                          <Text style={s.loanName} numberOfLines={1}>{card.name}</Text>
                          <Text style={s.loanMaturity}>
                            {card.facilityType === 'OD'
                              ? 'Overdraft'
                              : (card.maturity?.value
                                ? `${srcLabel(card.maturity) || 'Payoff'} ${fmtDate(card.maturity.value)}`
                                : (card.securityType === 'UNSECURED' ? 'Unsecured' : 'Secured'))}
                          </Text>
                        </View>
                        <View style={s.loanStatsRow}>
                          {(
                            card.facilityType === 'OD'
                              ? [
                                  { label: 'Limit', value: card.creditLimit?.value != null ? formatAmountCompact(Math.round(card.creditLimit.value)) : '—', hint: srcLabel(card.creditLimit) },
                                  { label: 'Utilised', value: formatAmountCompact(Math.round(card.outstanding?.value ?? 0)), hint: null },
                                  { label: 'Available', value: card.available?.value != null ? formatAmountCompact(Math.round(card.available.value)) : '—', hint: srcLabel(card.available) },
                                ]
                              : card.mode === 'RICH'
                                ? [
                                    { label: 'Outstanding', value: formatAmountCompact(Math.round(card.outstanding?.value ?? 0)), hint: null },
                                    { label: srcLabel(card.interestRate) || 'Rate', value: card.interestRate?.value != null ? `${card.interestRate.value}%` : '—', hint: null },
                                    {
                                      label: srcLabel(card.emi?.amount) || 'EMI',
                                      value: card.emi?.amount?.value != null ? formatAmountCompact(Math.round(card.emi.amount.value)) : '—',
                                      hint: card.emi?.nextDate?.value ? fmtDate(card.emi.nextDate.value) : null,
                                    },
                                  ]
                                : [
                                    { label: 'Outstanding', value: formatAmountCompact(Math.round(card.outstanding?.value ?? 0)), hint: null },
                                    { label: 'Type', value: card.securityType === 'UNSECURED' ? 'Unsecured' : 'Secured', hint: null },
                                  ]
                          ).map((st: any, i: number) => (
                            <View key={i} style={s.loanStat}>
                              <Text style={s.loanStatLabel}>{st.label}</Text>
                              <Text style={s.loanStatValue} numberOfLines={1}>{st.value}</Text>
                              {!!st.hint && <Text style={s.loanStatHint} numberOfLines={1}>{st.hint}</Text>}
                            </View>
                          ))}
                        </View>
                      </LinearGradient>
                    </View>
                  )}
                />
                <KPICarouselDots count={cards.length} activeIndex={cardIdx} />
              </View>
            )}

            {active && (
              <View style={s.tabCard}>
                <View style={s.tabRow}>
                  {(isOd
                    ? ([{ id: 'od', label: 'OD utilisation (30D)' }, { id: 'history', label: 'Recent activity' }] as const)
                    : ([{ id: 'history', label: rich ? 'Outstanding (6m)' : 'Recent activity' }, { id: 'od', label: 'Transactions' }] as const)
                  ).map(tab => (
                    <TouchableOpacity
                      key={tab.id}
                      style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
                      onPress={() => setActiveTab(tab.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.tabBtnTxt, activeTab === tab.id && s.tabBtnTxtActive]}>{tab.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.tabContent}>
                  {isOd && activeTab === 'od' ? (
                    odSeries.length === 0 ? (
                      <View style={s.empty}><Text style={s.emptyTxt}>No utilisation series yet</Text></View>
                    ) : odSeries.map((row: any, idx: number) => (
                      <View key={row.date} style={[s.dataRow, idx < odSeries.length - 1 && s.dataRowBorder]}>
                        <View style={s.dataIcon}>
                          <Ionicons name="analytics-outline" size={18} color={COLORS.textSecondary} />
                        </View>
                        <View style={s.dataInfo}>
                          <Text style={s.dataMain}>{fmtDate(row.date)}</Text>
                          <Text style={s.dataSub}>{formatAmountCompact(Math.round(row.utilised))} utilised</Text>
                        </View>
                        {row.utilisationPct != null && (
                          <>
                            <BarProgress pct={row.utilisationPct} />
                            <Text style={s.dataPct}>{row.utilisationPct}%</Text>
                          </>
                        )}
                      </View>
                    ))
                  ) : !isOd && activeTab === 'history' && rich ? (
                    outstandingRows.length === 0 ? (
                      <View style={s.empty}><Text style={s.emptyTxt}>No history yet</Text></View>
                    ) : outstandingRows.map((row: { month: string; amount: number; pct: number | null }, idx: number) => (
                      <View key={row.month} style={[s.dataRow, idx < outstandingRows.length - 1 && s.dataRowBorder]}>
                        <View style={s.dataIcon}>
                          <Ionicons name="cash-outline" size={18} color={COLORS.textSecondary} />
                        </View>
                        <View style={s.dataInfo}>
                          <Text style={s.dataMain}>{row.month}</Text>
                          <Text style={s.dataSub}>{formatAmount(Math.round(row.amount))} outstanding</Text>
                        </View>
                        {row.pct != null && (
                          <>
                            <BarProgress pct={row.pct} />
                            <Text style={s.dataPct}>{row.pct}%</Text>
                          </>
                        )}
                      </View>
                    ))
                  ) : (
                    txns.length === 0 ? (
                      <View style={s.empty}><Text style={s.emptyTxt}>No transactions found</Text></View>
                    ) : txns.map((t: any, idx: number) => (
                      <TouchableOpacity
                        key={t.guid || idx}
                        style={[s.dataRow, idx < txns.length - 1 && s.dataRowBorder]}
                        activeOpacity={0.7}
                        onPress={() => t.guid && router.push(`/document/${t.guid}` as any)}
                      >
                        <View style={s.dataIcon}>
                          <Ionicons name="document-text-outline" size={18} color={COLORS.textSecondary} />
                        </View>
                        <View style={s.dataInfo}>
                          <Text style={s.dataMain} numberOfLines={1}>
                            {t.eventType || t.voucher_type || 'Voucher'} · {t.voucher_number || '—'}
                          </Text>
                          <Text style={s.dataSub}>{[t.party_name, fmtDate(t.date)].filter(Boolean).join(' · ')}</Text>
                        </View>
                        <Text style={s.dataAmt}>{formatAmount(Math.round(t.amount || 0))}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </View>
            )}

            {active && !isOd && rich && (
              <View style={s.emiSection}>
                <TouchableOpacity style={s.emiHeadingRow} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
                  <Text style={s.emiHeading}>Expected EMI</Text>
                  <View style={s.emiCalBtn}>
                    <Ionicons name="calendar-outline" size={15} color={COLORS.brandPrimary} />
                    <Text style={s.emiCalBtnTxt}>View Calendar</Text>
                  </View>
                </TouchableOpacity>

                {(upcoming.length ? upcoming : recentEmis).slice(0, 6).map((e: any, idx: number, list: any[]) => (
                  <View key={e.dueDate || e.voucherGuid || idx} style={[s.emiRow, idx < list.length - 1 && s.emiRowBorder]}>
                    <View style={s.emiIconBox}>
                      <Ionicons name="business-outline" size={18} color={COLORS.brandPrimary} />
                    </View>
                    <View style={s.emiInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={s.emiLoan}>{active.name}</Text>
                        <View style={s.emiTagBadge}>
                          <Text style={s.emiTagTxt}>
                            {e.label || e.eventType || 'EMI'}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.emiDate}>{fmtDate(e.dueDate || e.date)}</Text>
                    </View>
                    <Text style={s.emiAmt}>
                      {formatAmount(Math.round(e.scheduledAmount || e.emiPaidAmount || 0))}
                    </Text>
                  </View>
                ))}

                {!upcoming.length && !recentEmis.length && (
                  <View style={s.empty}><Text style={s.emptyTxt}>No EMI schedule yet</Text></View>
                )}
              </View>
            )}

            {active && isOd && (
              <View style={s.emiSection}>
                <View style={s.emiHeadingRow}>
                  <Text style={s.emiHeading}>OD interest</Text>
                </View>
                <View style={s.emiRow}>
                  <View style={s.emiInfo}>
                    <Text style={s.emiLoan}>
                      {srcLabel(active.nextInterestDate) || 'Next interest'}
                    </Text>
                    <Text style={s.emiDate}>
                      {active.nextInterestDate?.value ? fmtDate(active.nextInterestDate.value) : 'Not enough history to estimate'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>

      <LoanCalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        mode={isOd ? 'od' : 'emi'}
        events={calendarEvents}
        formatAmount={formatAmount}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.md },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  kpiSection: { marginBottom: SPACING.md },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  loanSection: { marginBottom: SPACING.md },
  loanItem: { width: SW },
  loanCard: {
    marginHorizontal: SPACING.md, borderRadius: RADIUS.xl,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, gap: 20, minHeight: 150,
  },
  loanTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  loanName: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  loanMaturity: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.75)', maxWidth: 120, textAlign: 'right' },
  loanStatsRow: { flexDirection: 'row', gap: 10 },
  loanStat: { flex: 1 },
  loanStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  loanStatValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: '#fff' },
  loanStatHint: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 },

  emptyCard: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.md, padding: 24,
    borderRadius: RADIUS.lg, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center',
  },

  tabCard: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  tabBtnActive: { backgroundColor: COLORS.textPrimary },
  tabBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTxtActive: { color: '#fff' },
  tabContent: { paddingHorizontal: SPACING.md, paddingBottom: 8 },

  dataRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  dataRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dataIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  dataInfo: { flex: 1 },
  dataMain: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  dataSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  dataPct: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, width: 40, textAlign: 'right' },
  dataAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  barTrack: { width: 48, height: 6, borderRadius: 3, backgroundColor: COLORS.pageBg, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.brandPrimary },

  emiSection: {
    marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 4, marginBottom: SPACING.md,
  },
  emiHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  emiHeading: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  emiCalBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, backgroundColor: COLORS.activeBg, borderRadius: RADIUS.full,
  },
  emiCalBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.brandPrimary },
  emiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  emiRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  emiIconBox: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  emiInfo: { flex: 1 },
  emiLoan: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  emiTagBadge: {
    paddingHorizontal: 7, paddingVertical: 2, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  emiTagTxt: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  emiDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  emiAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});

const cs = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' },
  sheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingTop: 12, maxHeight: '90%',
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 18 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  monthYear: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  dayRow: { flexDirection: 'row', marginBottom: 6 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.textTertiary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  cell: { width: `${100 / 7}%` as any, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayEmi: { backgroundColor: COLORS.activeBg, borderWidth: 1.5, borderColor: COLORS.brandPrimary },
  daySelected: { backgroundColor: COLORS.brandPrimary },
  dayTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  dayEmiTxt: { color: COLORS.brandPrimary, fontWeight: '700' },
  daySelectedTxt: { color: COLORS.white, fontWeight: '700' },
  emiDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary, marginTop: 1 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  emiList: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 6 },
  emiListTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  emiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  emiRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  emiIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.activeBg,
    alignItems: 'center', justifyContent: 'center',
  },
  emiLoan: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  emiTag: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  emiAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
  noEmi: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 12 },
});
