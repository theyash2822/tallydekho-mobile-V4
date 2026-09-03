import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getSalesInvoices, getSalesHomeMetrics } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';
import { KPICardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useTranslation } from 'react-i18next';
import { classifyVoucherDocType, docTypeToRouteType } from '../../src/components/voucherHomeFilters';
import { VoucherListTile } from '../../src/components/VoucherListTile';
import { openLedgerDetail } from '../../src/utils/openLedger';
import { buildHomeMetricCards } from '../../src/utils/homeMetricCards';
import { KPICarouselCard, KPICarouselPage, KPICarouselDots } from '../../src/components/KPICarouselCard';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ListTileShell } from '../../src/components/ListTileShell';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ViewAllButton } from '../../src/components/ViewAllButton';
import { AlertBannerCarousel } from '../../src/components/AlertBannerCarousel';

const { width: SW } = Dimensions.get('window');

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SalesScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { company, lastSyncAt, selectedFY} = useAuth();
  const companyGuid = company?.guid;
  const [liveRecent, setLiveRecent] = useState<any[]>([]);
  const [liveTopParties, setLiveTopParties] = useState<any[]>([]);
  const [liveBanners, setLiveBanners] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [apiError, setApiError]       = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasSalesDataRef = useRef(false);

  const load = useCallback((opts?: { soft?: boolean }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasSalesDataRef.current;
    if (!soft) setIsLoading(true);
    if (!soft) setApiError(null);
    const fyParams = selectedFY?.startDate && selectedFY?.endDate
      ? { from: selectedFY.startDate, to: selectedFY.endDate }
      : {};
    Promise.allSettled([
      getSalesInvoices(companyGuid, { limit: '50', ...fyParams } as any),
      getSalesHomeMetrics(companyGuid, fyParams),
    ]).then(([invSettled, metricsSettled]) => {
      let anyOk = false;
      if (invSettled.status === 'fulfilled') {
        const invRes: any = invSettled.value;
        const rows = invRes?.data ?? [];
        if (rows.length) {
          setLiveRecent(rows.slice(0, 5).map((r: any, i: number) => ({
            id: r.guid || `sale-${r.voucher_number || 'x'}-${r.id ?? i}`,
            voucher: r.voucher_number || '',
            party: r.party_name || '',
            date: r.date || '',
            amount: formatAmount(Math.abs(+r.amount || 0)),
            status: r.is_cancelled ? 'unpaid' : 'paid',
            docType: r.doc_type || classifyVoucherDocType('sales', r),
            voucherType: r.voucher_type,
            isOptional: !!r.is_optional,
          })));
          const partyMap: Record<string, number> = {};
          rows.forEach((r: any) => {
            const name = String(r.party_name || '').trim();
            if (!name) return;
            partyMap[name] = (partyMap[name] || 0) + (+r.amount || 0);
          });
          const top = Object.entries(partyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
          setLiveTopParties(top.map(([name, total]) => ({
            // Key by party name — vouchers.party_guid is often wrong/shared across parties
            id: `party-${name}`,
            name,
            amount: formatAmount(Math.round(+total)),
          })));
          const pendingIRN = rows.filter((r: any) => !r.irn).length;
          setLiveBanners(pendingIRN > 0
            ? [{ id: 'b1', bold: t('sales.invoicesCount', { count: pendingIRN }), sub: t('sales.pendingIrn'), action: t('sales.generateNow') }]
            : []);
        } else {
          setLiveRecent([]);
          setLiveTopParties([]);
          setLiveBanners([]);
        }
        anyOk = true;
      }
      if (metricsSettled.status === 'fulfilled') {
        const metricsRes: any = metricsSettled.value;
        setMetrics(metricsRes?.data ?? metricsRes ?? null);
        anyOk = true;
      }
      if (anyOk) {
        hasSalesDataRef.current = true;
        setApiError(null);
        if (invSettled.status === 'rejected' || metricsSettled.status === 'rejected') {
          setApiError(t('home.partialUpdate', "Some data couldn't be updated"));
        }
      } else {
        const err = invSettled.status === 'rejected' ? invSettled.reason
          : metricsSettled.status === 'rejected' ? metricsSettled.reason : null;
        if (hasSalesDataRef.current) {
          setApiError(t('errors.refreshFailedShort', "Couldn't refresh. Showing previous data. Retry"));
        } else {
          setApiError(err?.message || t('sales.loadFailed'));
        }
      }
    }).finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY?.startDate, selectedFY?.endDate, formatAmount, t]);

  useEffect(() => { load({ soft: hasSalesDataRef.current }); }, [load]);

  // lastSyncAt → soft refresh when data already showing
  useEffect(() => {
    if (!lastSyncAt || !companyGuid || !hasSalesDataRef.current) return;
    const timer = setTimeout(() => load({ soft: true }), 400);
    return () => clearTimeout(timer);
  }, [lastSyncAt, companyGuid, load]);

  const metricCards = useMemo(() => {
    const m = metrics || {};
    return buildHomeMetricCards(m, [
      { id: 'mtd', label: t('sales.mtd'), icon: 'calendar-number-outline' },
      { id: 'ytd', label: t('sales.ytd'), icon: 'ribbon-outline' },
      { id: 'today', label: t('sales.today'), icon: 'calendar-outline' },
      { id: 'outstanding', label: t('sales.outstanding'), icon: 'wallet-outline' },
      { id: 'credit', label: t('sales.creditNotes'), icon: 'receipt-outline', valueKey: 'credit_notes', trendKey: 'credit_notes' },
      { id: 'avg', label: t('sales.avgTicket'), icon: 'ticket-outline', valueKey: 'avg_ticket', trendKey: 'avg_ticket' },
    ], formatAmountCompact);
  }, [metrics, formatAmountCompact, t]);

  // ─ Tab state
  const [tab, setTab] = useState<'recent' | 'parties'>('recent');

  // ─ Carousel state
  const metricRef  = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);

  useEffect(() => {
    if (metricCards.length === 0) return;
    const t = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % metricCards.length;
        metricRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [metricCards.length]);

  const recent = liveRecent.slice(0, 5);
  const displayTopParties = liveTopParties;
  const displayBanners = liveBanners;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      <ScreenHeader
        title={t('sales.title')}
        onBack={() => router.back()}
        right={(
          <TouchableOpacity
            style={s.ewbBtn}
            onPress={() => router.push('/reports/ewb-list' as any)}
            activeOpacity={0.7}
          >
            <Text style={s.ewbTxt}>{t('sales.ewayBill')}</Text>
            <Ionicons name="document-text-outline" size={15} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Metric Cards Carousel ─────────────────────────────────── */}
        <View style={s.carouselWrap}>
          <FlatList
            ref={metricRef}
            data={metricCards}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={c => c.id}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
              setMetricIdx(idx);
            }}
            renderItem={({ item: c }) => (
              <KPICarouselPage>
                <KPICarouselCard
                  icon={c.icon}
                  label={c.label}
                  amount={c.amount}
                  trend_pct={c.trend_pct}
                  trend_positive={c.trend_positive}
                />
              </KPICarouselPage>
            )}
          />
          <KPICarouselDots count={metricCards.length} activeIndex={metricIdx} />
        </View>

        {isLoading && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <KPICardSkeleton /><KPICardSkeleton />
            </View>
            {[...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)}
          </View>
        )}

                {/* ── Tabs ─────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['recent', 'parties'] as const).map(tabKey => (
            <TouchableOpacity
              key={tabKey}
              style={[s.tabBtn, tab === tabKey && s.tabActive]}
              onPress={() => setTab(tabKey)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === tabKey && s.tabActiveTxt]}>
                {tabKey === 'recent' ? t('sales.recent') : t('sales.parties')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Sales ──────────────────────────────────────────── */}
        {tab === 'recent' && (
          <View style={s.listSection}>
            {recent.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="receipt-outline" size={28} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>{t('sales.noInvoices')}</Text>
              </View>
            ) : (
              recent.map(inv => (
                <ListTileShell
                  key={inv.id}
                  onPress={() => {
                    const routeType = docTypeToRouteType(inv.docType || 'invoice', 'sales');
                    router.push(`/document/${inv.id}?type=${routeType}` as any);
                  }}
                >
                  <VoucherListTile
                    party={inv.party}
                    voucherNo={inv.voucher || inv.id}
                    date={inv.date}
                    amount={inv.amount}
                    status={inv.status}
                    module="sales"
                    docType={inv.docType}
                    voucherType={inv.voucherType}
                    isOptional={inv.isOptional}
                  />
                </ListTileShell>
              ))
            )}
            <ViewAllButton
              label={t('sales.viewAll')}
              onPress={() => router.push('/sales/register' as any)}
            />
          </View>
        )}

        {/* ── Top Parties ──────────────────────────────────────────── */}
        {tab === 'parties' && (
          <View style={s.listSection}>
            {displayTopParties.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="people-outline" size={28} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>No party sales yet</Text>
              </View>
            ) : displayTopParties.map((p, idx) => (
              <EntityListTile
                key={p.id || `party-${idx}`}
                name={p.name}
                amount={p.amount}
                onPress={() => openLedgerDetail(router, companyGuid, { name: p.name })}
              />
            ))}
            <ViewAllButton
              label={t('sales.viewAll')}
              onPress={() => router.push('/ledger' as any)}
            />
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Banner Carousel ─────────────────────────────────── */}
      {displayBanners.length > 0 && (
        <AlertBannerCarousel
          banners={displayBanners}
          bottomInset={insets.bottom > 0 ? insets.bottom : 8}
        />
      )}

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  ewbBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  ewbTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },

  // Metric Carousel
  carouselWrap: { paddingTop: SPACING.md },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, padding: 3,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  // List
  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
