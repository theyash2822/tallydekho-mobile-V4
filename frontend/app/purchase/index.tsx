import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getPurchaseInvoices, getDebitNotes, getPurchaseHomeMetrics } from '../../src/services/api';
import { useTranslation } from 'react-i18next';
import { classifyVoucherDocType, docTypeToRouteType } from '../../src/components/voucherHomeFilters';
import { VoucherListTile } from '../../src/components/VoucherListTile';
import { openLedgerDetail } from '../../src/utils/openLedger';
import { buildHomeMetricCards, HomeMetricCard } from '../../src/utils/homeMetricCards';
import { KPICarouselCard, KPICarouselPage, KPICarouselDots } from '../../src/components/KPICarouselCard';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ListTileShell } from '../../src/components/ListTileShell';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ViewAllButton } from '../../src/components/ViewAllButton';
import { AlertBannerCarousel } from '../../src/components/AlertBannerCarousel';
import { useRequireCapability } from '../../src/components/RequireCapability';

const { width: SW } = Dimensions.get('window');

type PurchaseRow = {
  id: string;
  guid?: string;
  voucher?: string;
  vendor: string;
  date: string;
  time: string;
  amount: string;
  status: string;
  docType?: string;
  voucherType?: string;
  isOptional?: boolean;
};

type MetricCard = HomeMetricCard;

function purchaseMetricCardsFromApi(data: any, formatAmountCompact: (n: number) => string, t: (k: string) => string): MetricCard[] {
  return buildHomeMetricCards(data, [
    { id: 'today', label: t('purchase.today'), icon: 'calendar-outline' },
    { id: 'mtd', label: t('purchase.mtd'), icon: 'calendar-number-outline' },
    { id: 'ytd', label: t('purchase.ytd'), icon: 'ribbon-outline' },
    { id: 'outstanding', label: t('kpi.payables'), icon: 'wallet-outline' },
    { id: 'debit', label: t('purchase.debitNote'), icon: 'receipt-outline', valueKey: 'debit_notes', trendKey: 'debit_notes' },
    { id: 'avg', label: t('purchase.avgTicket'), icon: 'ticket-outline', valueKey: 'avg_ticket', trendKey: 'avg_ticket' },
  ], formatAmountCompact);
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function PurchaseScreen() {
  const allowed = useRequireCapability('purchase.view');
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmount, formatAmountCompact } = useSettings();
  const companyGuid = company?.guid;
  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';

  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const hasPurchaseDataRef = useRef(false);
  const [liveRecent, setLiveRecent] = useState<PurchaseRow[]>([]);
  const [liveTopVendors, setLiveTopVendors] = useState<any[]>([]);
  const [liveBanners, setLiveBanners] = useState<any[]>([]);
  const [metricCards, setMetricCards] = useState<MetricCard[]>([]);

  const [tab, setTab] = useState<'recent' | 'vendors'>('recent');

  const loadData = useCallback((opts?: { soft?: boolean }) => {
    if (!companyGuid) {
      setLiveRecent([]);
      setLiveTopVendors([]);
      setLiveBanners([]);
      setMetricCards([]);
      setIsLoading(false);
      return;
    }

    const rangeParams = fyFrom && fyTo ? { from: fyFrom, to: fyTo } : {};
    const soft = opts?.soft ?? hasPurchaseDataRef.current;
    if (!soft) setIsLoading(true);
    if (!soft) setApiError(null);

    Promise.allSettled([
      getPurchaseInvoices(companyGuid, { ...rangeParams, limit: '100', page: '1' } as any),
      getDebitNotes(companyGuid, { ...rangeParams, limit: '50', page: '1' } as any),
      getPurchaseHomeMetrics(companyGuid, rangeParams),
    ])
      .then(([invSettled, dnSettled, metricsSettled]) => {
        let anyOk = false;
        const rows = invSettled.status === 'fulfilled'
          ? ((invSettled.value as any)?.data ?? [])
          : null;
        const debitNotes = dnSettled.status === 'fulfilled'
          ? ((dnSettled.value as any)?.data ?? [])
          : [];

        if (metricsSettled.status === 'fulfilled') {
          const metricsRes: any = metricsSettled.value;
          setMetricCards(purchaseMetricCardsFromApi(metricsRes?.data ?? metricsRes ?? {}, formatAmountCompact, t));
          anyOk = true;
        }

        if (rows) {
          anyOk = true;

          setLiveRecent(rows.slice(0, 20).map((r: any, i: number): PurchaseRow => ({
            id: r.guid || `pur-${r.voucher_number || 'x'}-${r.id ?? i}`,
            guid: r.guid,
            voucher: r.voucher_number || '',
            vendor: r.party_name || '',
            date: r.date || '',
            time: '',
            amount: formatAmount(Math.abs(parseFloat(r.amount) || 0)),
            status: r.is_cancelled ? 'unpaid' : 'paid',
            docType: r.doc_type || classifyVoucherDocType('purchase', r),
            voucherType: r.voucher_type,
            isOptional: !!r.is_optional,
          })));

          const vendorMap: Record<string, { total: number; count: number }> = {};
          rows.forEach((r: any) => {
            const name = String(r.party_name || '').trim();
            if (!name) return;
            const amt = Math.abs(parseFloat(r.amount) || 0);
            if (!vendorMap[name]) vendorMap[name] = { total: 0, count: 0 };
            vendorMap[name].total += amt;
            vendorMap[name].count += 1;
          });
          const top = Object.entries(vendorMap)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5)
            .map(([name, info]) => ({
              id: `vendor-${name}`,
              name,
              transactions: info.count,
              amount: formatAmount(Math.round(info.total)),
            }));
          setLiveTopVendors(top);

          const banners: any[] = [];
          const unpaid = rows.filter((r: any) => r.is_cancelled).length;
          if (unpaid > 0) {
            banners.push({ id: 'b1', bold: t('purchase.invoicesCount', { count: unpaid }), sub: t('purchase.cancelledOrPending'), action: t('purchase.viewAll') });
          }
          if (debitNotes.length > 0) {
            banners.push({ id: 'b2', bold: t('purchase.debitNotesCount', { count: debitNotes.length }), sub: t('purchase.inSelectedPeriod'), action: t('purchase.viewAll') });
          }
          setLiveBanners(banners);
        } else if (dnSettled.status === 'fulfilled') {
          anyOk = true;
        }

        if (anyOk) {
          hasPurchaseDataRef.current = true;
          if (invSettled.status === 'rejected' || dnSettled.status === 'rejected' || metricsSettled.status === 'rejected') {
            setApiError(t('home.partialUpdate', "Some data couldn't be updated"));
          } else {
            setApiError(null);
          }
        } else {
          const err = invSettled.status === 'rejected' ? invSettled.reason
            : dnSettled.status === 'rejected' ? dnSettled.reason
            : metricsSettled.status === 'rejected' ? metricsSettled.reason : null;
          if (hasPurchaseDataRef.current) {
            setApiError(t('errors.refreshFailedShort', "Couldn't refresh. Showing previous data. Retry"));
          } else {
            setApiError((err as any)?.message || t('purchase.loadFailed'));
            setLiveRecent([]);
            setLiveTopVendors([]);
            setLiveBanners([]);
            setMetricCards([]);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid, fyFrom, fyTo, formatAmount, formatAmountCompact, t]);

  useEffect(() => {
    loadData({ soft: hasPurchaseDataRef.current });
  }, [loadData, lastSyncAt]);

  const metricRef = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);

  const displayMetrics = metricCards.length > 0 ? metricCards : purchaseMetricCardsFromApi({}, formatAmountCompact, t);

  // Auto-scroll metric cards every 3s
  useEffect(() => {
    if (displayMetrics.length <= 1) return;
    const t = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % displayMetrics.length;
        metricRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [displayMetrics.length]);

  const recent = liveRecent.slice(0, 5);

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={() => loadData({ soft: hasPurchaseDataRef.current })} />}

      <ScreenHeader title={t('purchase.title')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Metric Cards Carousel ─────────────────────────────────── */}
        <View style={s.carouselWrap}>
          <FlatList
            ref={metricRef}
            data={displayMetrics}
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
          <KPICarouselDots count={displayMetrics.length} activeIndex={metricIdx} />
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['recent', 'vendors'] as const).map(tabKey => (
            <TouchableOpacity
              key={tabKey}
              style={[s.tabBtn, tab === tabKey && s.tabActive]}
              onPress={() => setTab(tabKey)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === tabKey && s.tabActiveTxt]}>
                {tabKey === 'recent' ? t('purchase.recent') : t('purchase.vendors')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Purchases ──────────────────────────────────────── */}
        {tab === 'recent' && (
          <View style={s.listSection}>
            {isLoading ? (
              [...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)
            ) : recent.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="cart-outline" size={28} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>No purchase invoices in this period</Text>
              </View>
            ) : (
              recent.map((inv, index) => (
                <ListTileShell
                  key={inv.guid || `purchase-${index}`}
                  onPress={() => {
                    const routeType = docTypeToRouteType(inv.docType || 'invoice', 'purchase');
                    safePush(router, `/document/${inv.guid || inv.id}?type=${routeType}` as any);
                  }}
                >
                  <VoucherListTile
                    party={inv.vendor}
                    voucherNo={inv.voucher || inv.id}
                    date={inv.date}
                    amount={inv.amount}
                    status={inv.status}
                    module="purchase"
                    docType={inv.docType}
                    voucherType={inv.voucherType}
                    isOptional={inv.isOptional}
                  />
                </ListTileShell>
              ))
            )}
            <ViewAllButton
              label={t('purchase.viewAll')}
              onPress={() => safePush(router, '/purchase/register' as any)}
            />
          </View>
        )}

        {/* ── Top Vendors ──────────────────────────────────────────── */}
        {tab === 'vendors' && (
          <View style={s.listSection}>
            {isLoading ? (
              [...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)
            ) : liveTopVendors.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="people-outline" size={28} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>No vendor data in this period</Text>
              </View>
            ) : (
              liveTopVendors.map((vendor, idx) => (
                <EntityListTile
                  key={vendor.id || `vendor-${idx}`}
                  name={vendor.name}
                  amount={vendor.amount}
                  subtitle={`${vendor.transactions} transactions`}
                  onPress={() => openLedgerDetail(router, companyGuid, { name: vendor.name })}
                />
              ))
            )}
            <ViewAllButton
              label={t('purchase.viewAll')}
              onPress={() => safePush(router, '/ledger' as any)}
            />
          </View>
        )}

      </ScrollView>

      {/* ── Sticky Banner Carousel (only when real alerts exist) ───── */}
      {liveBanners.length > 0 && (
        <AlertBannerCarousel
          banners={liveBanners.map(b => ({
            ...b,
            onAction: () => safePush(router, '/purchase/register' as any),
          }))}
          bottomInset={insets.bottom > 0 ? insets.bottom : 8}
        />
      )}

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
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

  // List Section
  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },

  // View All
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'center', marginTop: 4, minWidth: 150,
  },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
