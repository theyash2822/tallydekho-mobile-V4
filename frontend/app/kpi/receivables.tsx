import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  NativeSyntheticEvent, NativeScrollEvent, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { openVoucherPreview } from '../../src/utils/openVoucherPreview';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPIReceivables } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  KPICarouselCard, KPICarouselPage, KPICarouselDots, KPI_CAROUSEL_PAGE_WIDTH,
} from '../../src/components/KPICarouselCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ListTileShell } from '../../src/components/ListTileShell';
import { VoucherListTile } from '../../src/components/VoucherListTile';
import { OverduePartyTile } from '../../src/components/OverduePartyTile';
import { safePush } from '../../src/utils/safeNavigation';
import { FilterIconWithBadge, ActiveFilterChips } from '../../src/components/voucherHomeFilters';
import ArApFilterSheet, { ArApView, arApActiveFilterCount } from '../../src/components/ArApFilterSheet';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function openCall(phone?: string) {
  const digits = String(phone || '').replace(/[^0-9+]/g, '');
  if (!digits) { Alert.alert(i18n.t('screens.kpiReceivables.noPhone'), i18n.t('screens.kpiReceivables.noPhoneMsg')); return; }
  Linking.openURL(`tel:${digits}`).catch(() => Alert.alert(i18n.t('common.error'), i18n.t('screens.kpiReceivables.phoneAppFailed')));
}

function openWhatsApp(phone?: string) {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) { Alert.alert(i18n.t('screens.kpiReceivables.noPhone'), i18n.t('screens.kpiReceivables.noPhoneMsg')); return; }
  const num = digits.startsWith('91') && digits.length > 10 ? digits : `91${digits}`;
  Linking.openURL(`https://wa.me/${num}`).catch(() => Alert.alert(i18n.t('common.error'), i18n.t('screens.kpiReceivables.whatsappFailed')));
}

export default function ReceivablesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';

  const agingRef = useRef<FlatList>(null);
  const [agingIdx, setAgingIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<'recent' | 'overdue'>('recent');
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom, setDateFrom] = useState(fyFrom);
  const [dateTo, setDateTo] = useState(fyTo);
  const [view, setView] = useState<ArApView>('bills');
  const [overdueOn, setOverdueOn] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const dataAsOfRef = useRef<Date | null>(null);

  const [prevFyRange, setPrevFyRange] = useState({ from: fyFrom, to: fyTo });
  if (prevFyRange.from !== fyFrom || prevFyRange.to !== fyTo) {
    setPrevFyRange({ from: fyFrom, to: fyTo });
    if (fyFrom && fyTo) {
      setDateFrom(fyFrom);
      setDateTo(fyTo);
    }
  }

  const receiptsOn = view === 'settlements';

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
      const res: any = await getKPIReceivables(companyGuid, params);
      setApiData(res?.data ?? res);
      hasDataRef.current = true;
      dataAsOfRef.current = new Date();
      setApiError(null);
    } catch (err: any) {
      if (hasDataRef.current) {
        const ts = dataAsOfRef.current
          ? dataAsOfRef.current.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
          : i18n.t('home.earlier');
        setApiError(i18n.t('home.refreshFailed', { time: ts }));
      } else {
        setApiError(err?.message || i18n.t('screens.kpiReceivables.loadFailed'));
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
    const cards = [
      {
        id: 'total',
        icon: 'documents-outline',
        label: t('screens.kpiReceivables.totalDue'),
        amount: formatAmountCompact(Math.round(total)),
        ...totalT,
      },
      ...(due
        ? [{
            id: 'due_today',
            icon: 'today-outline' as const,
            label: due.label || t('screens.kpiReceivables.dueToday'),
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
    return cards;
  }, [apiData, formatAmountCompact, t]);

  const bills = useMemo(() => {
    const rows = Array.isArray(apiData?.bills) ? apiData.bills : [];
    return rows.map((b: any, i: number) => ({
      id: `bill-${i}-${b.ref || 'x'}`,
      party: b.party,
      ref: b.ref,
      date: b.date || b.dueDate || b.billDate,
      amount: Math.abs(Number(b.amount) || 0),
      status: b.status,
      voucherGuid: b.voucherGuid || b.voucher_guid || null,
      tdkRef: b.tdkRef || null,
      olderYear: b.olderYear === true,
    }));
  }, [apiData]);

  const olderYearCount = Number(apiData?.olderYearBillCount) || 0;

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
        ledgerGuid: p.ledgerGuid || null,
      }));
  }, [apiData]);

  const receipts = useMemo(() => {
    const rows = Array.isArray(apiData?.receipts) ? apiData.receipts : [];
    return rows.map((r: any, i: number) => ({
      id: `rc-${i}-${r.guid || r.voucher_number || 'x'}`,
      guid: r.guid,
      party: r.party_name,
      ref: r.voucher_number,
      date: r.date,
      amount: Math.abs(Number(r.amount) || 0),
      type: r.voucher_type,
    }));
  }, [apiData]);

  const applyFilters = (nextView: ArApView, nextOverdue: boolean) => {
    const overdue = nextView === 'bills' && nextOverdue;
    if (overdue !== overdueOn) setActiveTab(overdue ? 'overdue' : 'recent');
    setView(nextView);
    setOverdueOn(overdue);
    setShowFilter(false);
  };

  const filterChips = [
    ...(receiptsOn ? [{ id: 'view', label: t('kpi.receiptsFilter') }] : []),
    ...(overdueOn ? [{ id: 'overdue', label: t('kpi.overdue') }] : []),
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader
        title={t('kpi.receivables')}
        onBack={() => router.back()}
        right={(
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerIconBtn} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <FilterIconWithBadge count={arApActiveFilterCount(view, overdueOn)} onPress={() => setShowFilter(true)} />
          </View>
        )}
      />

      {filterChips.length > 0 && (
        <ActiveFilterChips
          variant="amber"
          chips={filterChips}
          onRemove={(id: string) => applyFilters(id === 'view' ? 'bills' : view, id === 'overdue' ? false : overdueOn)}
          onClearAll={() => applyFilters('bills', false)}
        />
      )}

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
              {receiptsOn ? (
                <View style={s.listWrap}>
                  <Text style={s.sectionHint}>{t('screens.kpiReceivables.liveReceipts')}</Text>
                  {receipts.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyTxt}>{t('screens.kpiReceivables.noReceipts')}</Text></View>
                  ) : (
                    <View style={s.cardList}>
                      {receipts.map((item: any) => (
                        <ListTileShell
                          key={item.id}
                          onPress={() => openVoucherPreview(router, { guid: item.guid })}
                        >
                          <VoucherListTile
                            party={item.party}
                            voucherNo={item.ref}
                            date={`${fmtDate(item.date)} · ${item.type || t('voucher.receipt')}`}
                            amount={`+${formatAmount(Math.round(item.amount))}`}
                          />
                        </ListTileShell>
                      ))}
                    </View>
                  )}
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
                          {tab === 'recent' ? t('screens.kpiReceivables.recentOutstandings') : t('kpi.overdueParties')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {activeTab === 'recent' ? (
                    <View style={s.listWrap}>
                      {bills.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyTxt}>{t('screens.kpiReceivables.noBills')}</Text></View>
                      ) : (
                        <View style={s.cardList}>
                          {bills.map((item: any) => (
                            <ListTileShell
                              key={item.id}
                              onPress={() => openVoucherPreview(router, { guid: item.voucherGuid, tdkRef: item.tdkRef, olderYear: item.olderYear })}
                            >
                              <VoucherListTile
                                party={item.party}
                                voucherNo={item.ref}
                                date={fmtDate(item.date)}
                                amount={formatAmount(Math.round(item.amount))}
                              />
                            </ListTileShell>
                          ))}
                        </View>
                      )}
                      {olderYearCount > 0 && (
                        <Text style={s.olderNote}>
                          {olderYearCount === 1
                            ? t('screens.kpiReceivables.olderBillsOne', { n: olderYearCount })
                            : t('screens.kpiReceivables.olderBillsOther', { n: olderYearCount })}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={s.listWrap}>
                      {overdueParties.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyTxt}>{t('screens.kpiReceivables.noOverdue')}</Text></View>
                      ) : (
                        <View style={s.cardList}>
                          {overdueParties.map((item: any) => (
                            <OverduePartyTile
                              key={item.id}
                              party={item.party}
                              overdueLabel={t('screens.kpiReceivables.daysOverdue', { days: item.days })}
                              amount={formatAmount(Math.round(item.amount))}
                              phone={item.phone}
                              onPress={item.ledgerGuid ? () => safePush(router, `/ledger/${encodeURIComponent(item.ledgerGuid)}` as any) : undefined}
                              onCall={openCall}
                              onWhatsApp={openWhatsApp}
                            />
                          ))}
                        </View>
                      )}
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

      <ArApFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        view={view}
        overdueOnly={overdueOn}
        settlementsLabel={t('kpi.receiptsFilter')}
        onApply={applyFilters}
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

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },

  agingSection: { marginTop: SPACING.md, marginBottom: SPACING.sm },

  tabCard: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', backgroundColor: COLORS.pageBg, margin: 4, borderRadius: RADIUS.md, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.cardBg },
  tabBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  sectionHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 4, marginTop: 8 },

  listWrap: { paddingHorizontal: SPACING.md, paddingBottom: 8 },
  cardList: { paddingTop: 4, gap: 8 },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  olderNote: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, textAlign: 'center', marginTop: 10 },
});
