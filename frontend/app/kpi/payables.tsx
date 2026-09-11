import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  NativeSyntheticEvent, NativeScrollEvent, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPIPayables } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  KPICarouselCard, KPICarouselPage, KPICarouselDots, KPI_CAROUSEL_PAGE_WIDTH,
} from '../../src/components/KPICarouselCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from 'react-i18next';

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function openCall(phone?: string) {
  const digits = String(phone || '').replace(/[^0-9+]/g, '');
  if (!digits) { Alert.alert('No phone', 'Phone number not available'); return; }
  Linking.openURL(`tel:${digits}`).catch(() => Alert.alert('Error', 'Could not open phone app'));
}

function openWhatsApp(phone?: string) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) { Alert.alert('No phone', 'Phone number not available'); return; }
  const num = digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
  Linking.openURL(`https://wa.me/${num}`).catch(() => Alert.alert('Error', 'Could not open WhatsApp'));
}

export default function PayablesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount, formatDate } = useSettings();
  const companyGuid = company?.guid;

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';

  const agingRef = useRef<FlatList>(null);
  const [agingIdx, setAgingIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'recent' | 'overdue'>('recent');
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom, setDateFrom] = useState(fyFrom);
  const [dateTo, setDateTo] = useState(fyTo);
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set());
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const dataAsOfRef = useRef<Date | null>(null);

  useEffect(() => {
    if (fyFrom && fyTo) {
      setDateFrom(fyFrom);
      setDateTo(fyTo);
    }
  }, [fyFrom, fyTo]);

  const overdueOn = activeChips.has('overdue');
  const paymentsOn = activeChips.has('payments');

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasDataRef.current;
    if (!soft) setIsLoading(true);
    // Soft refresh: keep stale data + banner until success (no wipe, no toast)
    if (!soft) setApiError(null);
    try {
      const params: Record<string, string> = {};
      const fromIso = dateFrom || fyFrom;
      const toIso = dateTo || fyTo;
      if (fromIso) params.from = fromIso;
      if (toIso) params.to = toIso;
      if (overdueOn) params.overdue = '1';
      const res: any = await getKPIPayables(companyGuid, params);
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
        setApiError(err?.message || 'Failed to load payables');
      }
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, dateFrom, dateTo, fyFrom, fyTo, overdueOn, lastSyncAt]);

  useEffect(() => { load({ soft: hasDataRef.current }); }, [load]);

  const agingCards = useMemo(() => {
    const fmtTrend = (raw: any) => {
      const has = raw != null && Number.isFinite(Number(raw));
      return {
        trend_pct: has ? Number(raw) : null,
        trend_positive: has ? Number(raw) >= 0 : null,
      };
    };
    const total = Number(apiData?.total ?? apiData?.accountingBalance) || 0;
    const rows = Array.isArray(apiData?.aging) ? apiData.aging : [];
    const due = apiData?.due_today;
    const totalT = fmtTrend(apiData?.trend_pct);
    return [
      {
        id: 'total',
        icon: 'documents-outline',
        label: 'Total Due',
        amount: formatAmountCompact(Math.round(total)),
        ...totalT,
      },
      ...(due
        ? [{
            id: 'due_today',
            icon: 'today-outline' as const,
            label: due.label || 'Due Today',
            amount: formatAmountCompact(Math.round(Number(due.amount) || 0)),
            ...fmtTrend(due.trend ?? due.trend_pct),
          }]
        : []),
      ...rows.map((a: any) => {
        const t = fmtTrend(a.trend ?? a.trend_pct);
        return {
          id: a.bucket,
          icon: 'calendar-outline' as const,
          label: a.label || a.bucket,
          amount: formatAmountCompact(Math.round(Number(a.amount) || 0)),
          ...t,
        };
      }),
    ];
  }, [apiData, formatAmountCompact]);

  const bills = useMemo(() => {
    const rows = Array.isArray(apiData?.bills) ? apiData.bills : [];
    return rows.map((b: any, i: number) => ({
      id: `bill-${i}-${b.ref || 'x'}`,
      party: b.party,
      ref: b.ref,
      date: b.date || b.dueDate || b.billDate,
      amount: Math.abs(Number(b.amount) || 0),
      voucherGuid: b.voucherGuid || b.voucher_guid || null,
    }));
  }, [apiData]);

  const overdueParties = useMemo(() => {
    const rows = Array.isArray(apiData?.parties) ? apiData.parties : [];
    return rows
      .filter((p: any) => (Number(p.overdueOutstanding) || Number(p.days_overdue) || 0) > 0)
      .map((p: any, i: number) => ({
        id: `party-${i}-${p.name || 'x'}`,
        party: p.name,
        days: Number(p.days_overdue) || Number(p.oldestOverdueDays) || 0,
        amount: Math.abs(Number(p.overdueOutstanding) || Number(p.amount) || 0),
        phone: p.phone || '',
      }));
  }, [apiData]);

  const payments = useMemo(() => {
    const rows = Array.isArray(apiData?.payments) ? apiData.payments : [];
    return rows.map((r: any, i: number) => ({
      id: `pm-${i}-${r.guid || r.voucher_number || 'x'}`,
      guid: r.guid,
      party: r.party_name,
      ref: r.voucher_number,
      date: r.date,
      amount: Math.abs(Number(r.amount) || 0),
      type: r.voucher_type,
    }));
  }, [apiData]);

  const toggleChip = (chip: 'overdue' | 'payments') => {
    setActiveChips((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
        if (chip === 'overdue') setActiveTab('recent');
      } else {
        next.add(chip);
        if (chip === 'overdue') setActiveTab('overdue');
      }
      return next;
    });
  };

  const fmtRange = () => {
    if (!dateFrom && !dateTo) return 'All dates';
    if (dateFrom && dateTo) return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;
    return formatDate(dateFrom || dateTo);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('kpi.payables')} onBack={() => router.back()} />

      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, overdueOn && s.filterChipActive]}
          onPress={() => toggleChip('overdue')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterChipTxt, overdueOn && s.filterChipActiveTxt]}>{t('kpi.overdue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, paymentsOn && s.filterChipActive]}
          onPress={() => toggleChip('payments')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterChipTxt, paymentsOn && s.filterChipActiveTxt]}>{t('kpi.paymentsFilter')}</Text>
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
            <View style={s.agingSection}>
              <FlatList
                ref={agingRef}
                horizontal
                pagingEnabled
                nestedScrollEnabled
                decelerationRate="fast"
                disableIntervalMomentum
                data={agingCards}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: KPI_CAROUSEL_PAGE_WIDTH, offset: KPI_CAROUSEL_PAGE_WIDTH * index, index })}
                onScrollToIndexFailed={() => {}}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setAgingIdx(Math.round(e.nativeEvent.contentOffset.x / KPI_CAROUSEL_PAGE_WIDTH));
                }}
                renderItem={({ item }) => (
                  <KPICarouselPage>
                    <KPICarouselCard
                      icon={item.icon}
                      label={item.label}
                      amount={item.amount}
                      trend_pct={item.trend_pct}
                      trend_positive={item.trend_positive}
                      alwaysShowTrend
                    />
                  </KPICarouselPage>
                )}
              />
              <KPICarouselDots count={agingCards.length} activeIndex={agingIdx} />
            </View>

            <View style={s.tabCard}>
              {paymentsOn ? (
                <View style={s.listWrap}>
                  <Text style={s.sectionHint}>Live payments (party settlements)</Text>
                  {payments.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyTxt}>No payments in range</Text></View>
                  ) : payments.map((item: any, idx: number) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[s.listRow, idx < payments.length - 1 && s.listRowBorder]}
                      activeOpacity={0.7}
                      onPress={() => item.guid && safePush(router, `/document/${item.guid}` as any)}
                    >
                      <View style={s.partyIconBox}>
                        <Ionicons name="arrow-up-outline" size={18} color={COLORS.negative} />
                      </View>
                      <View style={s.listInfo}>
                        <View style={s.listTopRow}>
                          <Text style={s.listParty} numberOfLines={1}>{item.party || '—'}</Text>
                          <Text style={s.listRef}>{` · ${item.ref || '—'}`}</Text>
                        </View>
                        <Text style={s.listDate}>{fmtDate(item.date)} · {item.type || 'Payment'}</Text>
                      </View>
                      <Text style={[s.listAmount, { color: COLORS.negative }]}>
                        −{formatAmount(Math.round(item.amount))}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  <View style={s.tabRow}>
                    {(['recent', 'overdue'] as const).map((tab) => (
                      <TouchableOpacity
                        key={tab}
                        style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
                        onPress={() => setActiveTab(tab)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.tabBtnTxt, activeTab === tab && s.tabBtnTxtActive]}>
                          {tab === 'recent' ? t('kpi.recentPayables') : t('kpi.overdueParties')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {activeTab === 'recent' ? (
                    <View style={s.listWrap}>
                      {bills.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyTxt}>No outstanding bills</Text></View>
                      ) : bills.map((item: any, idx: number) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[s.listRow, idx < bills.length - 1 && s.listRowBorder]}
                          activeOpacity={item.voucherGuid ? 0.7 : 1}
                          disabled={!item.voucherGuid}
                          onPress={() => {
                            if (!item.voucherGuid) return;
                            safePush(router, `/document/${item.voucherGuid}?type=purchase_invoice` as any);
                          }}
                        >
                          <View style={s.partyIconBox}>
                            <Ionicons name="document-text-outline" size={18} color={COLORS.textSecondary} />
                          </View>
                          <View style={s.listInfo}>
                            <View style={s.listTopRow}>
                              <Text style={s.listParty} numberOfLines={1}>{item.party}</Text>
                              <Text style={s.listRef}>{` · ${item.ref || '—'}`}</Text>
                            </View>
                            <Text style={s.listDate}>{fmtDate(item.date)}</Text>
                          </View>
                          <Text style={s.listAmount}>{formatAmount(Math.round(item.amount))}</Text>
                          {!!item.voucherGuid && (
                            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={s.listWrap}>
                      {overdueParties.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyTxt}>No overdue parties</Text></View>
                      ) : overdueParties.map((item: any, idx: number) => (
                        <View
                          key={item.id}
                          style={[s.listRow, idx < overdueParties.length - 1 && s.listRowBorder]}
                        >
                          <View style={s.partyIconBox}>
                            <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
                          </View>
                          <View style={s.listInfo}>
                            <Text style={s.listParty} numberOfLines={1}>{item.party}</Text>
                            <Text style={[s.listDate, { color: COLORS.negative }]}>{item.days}d overdue</Text>
                          </View>
                          <Text style={[s.listAmount, { color: COLORS.negative, marginRight: 6 }]}>
                            {formatAmount(Math.round(item.amount))}
                          </Text>
                          {!!item.phone && (
                            <View style={s.contactRow}>
                              <TouchableOpacity style={s.contactBtn} onPress={() => openCall(item.phone)} activeOpacity={0.7}>
                                <Ionicons name="call" size={14} color="#fff" />
                              </TouchableOpacity>
                              <TouchableOpacity style={[s.contactBtn, s.waBtn]} onPress={() => openWhatsApp(item.phone)} activeOpacity={0.7}>
                                <FontAwesome5 name="whatsapp" size={14} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom || fyFrom}
        toDate={dateTo || fyTo}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
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

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterChipActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterChipActiveTxt: { color: '#FFFFFF' },

  agingSection: { marginTop: SPACING.md, marginBottom: SPACING.sm },

  tabCard: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.pageBg, margin: 4, borderRadius: RADIUS.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.cardBg },
  tabBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  sectionHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4, marginTop: 8 },

  listWrap: { paddingHorizontal: SPACING.md, paddingBottom: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  partyIconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listInfo: { flex: 1 },
  listTopRow: { flexDirection: 'row', alignItems: 'center' },
  listParty: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  listRef: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  listDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  listAmount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
  contactRow: { flexDirection: 'row', gap: 6 },
  contactBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center' },
  waBtn: { backgroundColor: '#25D366' },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
