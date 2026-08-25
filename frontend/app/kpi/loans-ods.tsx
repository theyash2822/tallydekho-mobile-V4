import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

function BarProgress({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <View style={s.barTrack}>
      <View style={[s.barFill, { width: `${p}%` }]} />
    </View>
  );
}

export default function LoansODsScreen() {
  const router = useRouter();
  const { company, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [kpiIdx, setKpiIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'history' | 'od'>('history');
  const [showCalendar, setShowCalendar] = useState(false);

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const res: any = await getKPILoansODs(companyGuid);
      setApiData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load loans & ODs');
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, lastSyncAt]);

  useEffect(() => { load(); }, [load]);

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
    const total = Number(apiData?.total) || 0;
    const loanTotal = Number(apiData?.loan_total) || 0;
    const odTotal = Number(apiData?.od_total) || 0;
    return [
      { id: 'total', icon: 'cash-outline', label: 'Total Outstanding', amount: formatAmountCompact(Math.round(total)) },
      { id: 'term', icon: 'business-outline', label: 'Loans', amount: formatAmountCompact(Math.round(loanTotal)) },
      { id: 'od', icon: 'swap-horizontal-outline', label: 'ODs / Overdraft', amount: formatAmountCompact(Math.round(odTotal)) },
      { id: 'count', icon: 'list-outline', label: 'Accounts', amount: String(cards.length) },
    ];
  }, [apiData, cards.length, formatAmountCompact]);

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

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Loans & ODs</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={load} />}

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
                getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                }}
                renderItem={({ item }) => (
                  <View style={s.kpiItem}>
                    <View style={s.kpiCard}>
                      <View style={s.kpiIconBox}>
                        <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
                      </View>
                      <View style={s.kpiTextWrap}>
                        <Text style={s.kpiLabel}>{item.label}</Text>
                        <Text style={s.kpiAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                      </View>
                    </View>
                  </View>
                )}
              />
              <View style={s.dots}>
                {kpiCards.map((_, i) => <View key={i} style={[s.dot, i === kpiIdx && s.dotActive]} />)}
              </View>
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
                <View style={s.dots}>
                  {cards.map((_, i) => <View key={i} style={[s.dot, i === cardIdx && s.dotActive]} />)}
                </View>
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

      <Modal visible={showCalendar} animationType="slide" transparent onRequestClose={() => setShowCalendar(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Expected EMI calendar</Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalHint}>Dates estimated from Tally payment history — not contractual due dates.</Text>
            <ScrollView>
              {upcoming.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyTxt}>No predicted schedule</Text></View>
              ) : upcoming.map((e: any, idx: number) => (
                <View key={e.dueDate || idx} style={[s.emiRow, idx < upcoming.length - 1 && s.emiRowBorder]}>
                  <View style={s.emiInfo}>
                    <Text style={s.emiLoan}>#{e.installmentNo} · {fmtDate(e.dueDate)}</Text>
                    <Text style={s.emiDate}>{e.label || e.source}</Text>
                  </View>
                  <Text style={s.emiAmt}>{formatAmount(Math.round(e.scheduledAmount || 0))}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  kpiItem: { width: SW },
  kpiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  kpiIconBox: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiTextWrap: { flex: 1, gap: 2 },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },

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

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '70%', backgroundColor: COLORS.cardBg, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: SPACING.md, paddingTop: 16, paddingBottom: 28,
  },
  modalHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modalTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  modalHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 12, lineHeight: 18 },
});
