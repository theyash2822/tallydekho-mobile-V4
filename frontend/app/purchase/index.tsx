import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getPurchaseInvoices, getDebitNotes } from '../../src/services/api';
import { useTranslation } from 'react-i18next';
import { VoucherTypeBadge, classifyVoucherDocType, docTypeToRouteType } from '../../src/components/voucherHomeFilters';

const AMBER      = '#A89060';
const AMBER_BG   = '#FDF9F4';
const BANNER_RED = '#E53935';
const { width: SW } = Dimensions.get('window');
const CARD_W   = SW - SPACING.md * 2;
const BANNER_W = SW - SPACING.md * 2;

const VENDOR_COLORS = ['#2563EB', '#D97706', '#059669', '#7C3AED', '#0891B2'];

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

type MetricCard = {
  id: string;
  label: string;
  icon: string;
  amount: string;
  pct: string;
  pos: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  paid:   '#2D7D46',
  unpaid: '#DC2626',
  irm:    '#787774',
};
const STATUS_LABEL: Record<string, string> = {
  paid:   'Paid',
  unpaid: 'Unpaid',
  irm:    'IRM',
};

function buildMetrics(rows: any[], formatAmountCompact: (n: number) => string): MetricCard[] {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  let todaySum = 0;
  let mtdSum = 0;
  let ytdSum = 0;
  rows.forEach((r) => {
    const amt = Math.abs(parseFloat(r.amount) || 0);
    const d = String(r.date || '').slice(0, 10);
    ytdSum += amt;
    if (d >= monthStart) mtdSum += amt;
    if (d === today) todaySum += amt;
  });
  const avg = rows.length ? ytdSum / rows.length : 0;
  const fmt = (n: number) => formatAmountCompact(Math.round(n));

  return [
    { id: 'today',       label: 'Today' /* i18n in screen */,       icon: 'calendar-outline',        amount: fmt(todaySum), pct: '', pos: true  },
    { id: 'mtd',         label: 'MTD',         icon: 'calendar-number-outline', amount: fmt(mtdSum),   pct: '', pos: true  },
    { id: 'ytd',         label: 'YTD',         icon: 'ribbon-outline',          amount: fmt(ytdSum),   pct: '', pos: true  },
    { id: 'avg',         label: 'Avg Ticket',  icon: 'ticket-outline',          amount: fmt(avg),      pct: '', pos: true  },
  ];
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function PurchaseScreen() {
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

  const [tab,      setTab]      = useState<'recent' | 'vendors'>('recent');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');

  const loadData = useCallback((opts?: { soft?: boolean }) => {
    if (!companyGuid) {
      setLiveRecent([]);
      setLiveTopVendors([]);
      setLiveBanners([]);
      setMetricCards([]);
      setIsLoading(false);
      return;
    }

    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    const rangeParams = from && to ? { from, to } : {};
    const soft = opts?.soft ?? hasPurchaseDataRef.current;
    if (!soft) setIsLoading(true);
    if (!soft) setApiError(null);

    Promise.allSettled([
      getPurchaseInvoices(companyGuid, { ...rangeParams, limit: '100', page: '1' } as any),
      getDebitNotes(companyGuid, { ...rangeParams, limit: '50', page: '1' } as any),
    ])
      .then(([invSettled, dnSettled]) => {
        let anyOk = false;
        const rows = invSettled.status === 'fulfilled'
          ? ((invSettled.value as any)?.data ?? [])
          : null;
        const debitNotes = dnSettled.status === 'fulfilled'
          ? ((dnSettled.value as any)?.data ?? [])
          : [];

        if (rows) {
          anyOk = true;
          setMetricCards(buildMetrics(rows, formatAmountCompact).map(c => ({
            ...c,
            label: c.id === 'today' ? t('purchase.today')
              : c.id === 'mtd' ? t('purchase.mtd')
              : c.id === 'ytd' ? t('purchase.ytd')
              : c.id === 'avg' ? t('purchase.avgTicket')
              : c.label,
          })));

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
            const name = r.party_name;
            if (!name) return;
            const amt = Math.abs(parseFloat(r.amount) || 0);
            if (!vendorMap[name]) vendorMap[name] = { total: 0, count: 0 };
            vendorMap[name].total += amt;
            vendorMap[name].count += 1;
          });
          const top = Object.entries(vendorMap)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5)
            .map(([name, info], i) => ({
              id: `tv${i}`,
              name,
              transactions: info.count,
              amount: formatAmount(Math.round(info.total)),
              color: VENDOR_COLORS[i % VENDOR_COLORS.length],
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
          if (invSettled.status === 'rejected' || dnSettled.status === 'rejected') {
            setApiError(t('home.partialUpdate', "Some data couldn't be updated"));
          } else {
            setApiError(null);
          }
        } else {
          const err = invSettled.status === 'rejected' ? invSettled.reason : dnSettled.status === 'rejected' ? dnSettled.reason : null;
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
  }, [companyGuid, fromDate, toDate, fyFrom, fyTo, formatAmount, formatAmountCompact, t]);

  useEffect(() => {
    if (fyFrom && fyTo) {
      setFromDate(isoToDMY(fyFrom));
      setToDate(isoToDMY(fyTo));
    }
  }, [fyFrom, fyTo]);

  useEffect(() => {
    loadData({ soft: hasPurchaseDataRef.current });
  }, [loadData, lastSyncAt]);

  const metricRef = useRef<FlatList>(null);
  const bannerRef = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);

  const displayMetrics = metricCards.length > 0 ? metricCards : buildMetrics([], formatAmountCompact);

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

  // Auto-scroll banners every 3.5s
  useEffect(() => {
    if (liveBanners.length <= 1) return;
    const t = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % liveBanners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [liveBanners.length]);

  // Filtered recent list
  const recent = useMemo(() => liveRecent.filter(inv => {
    if (filter === 'Paid')   return inv.status === 'paid';
    if (filter === 'Unpaid') return inv.status === 'unpaid';
    return true;
  }).slice(0, 5), [liveRecent, filter]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={() => loadData({ soft: hasPurchaseDataRef.current })} />}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('purchase.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Filter Row ──────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.datePill} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateTxt}>{fromDate} – {toDate}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={s.statusWrap}>
          <TouchableOpacity
            style={[s.statusPill, dropdown && s.statusPillOpen]}
            onPress={() => setDropdown(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.statusTxt}>{filter}</Text>
            <Ionicons name={dropdown ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {dropdown && (
            <View style={s.dropMenu}>
              {['All', 'Paid', 'Unpaid'].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={s.dropItem}
                  activeOpacity={0.7}
                  onPress={() => { setFilter(opt); setDropdown(false); }}
                >
                  <Text style={[s.dropTxt, filter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {dropdown && (
        <TouchableOpacity style={s.dropOverlay} onPress={() => setDropdown(false)} activeOpacity={1} />
      )}

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
              <View style={s.metricItem}>
                <View style={s.metricCard}>
                  <View style={s.mIcon}>
                    <Ionicons name={c.icon as any} size={22} color={COLORS.textSecondary} />
                  </View>
                  <Text style={s.mLabel}>{c.label}</Text>
                  <Text style={s.mAmount}>{c.amount}</Text>
                  <View style={[s.pctBadge, { backgroundColor: c.pos ? COLORS.positiveBg : COLORS.negativeBg }]}>
                    {c.pct ? (
                      <>
                        <Ionicons name={c.pos ? 'trending-up' : 'trending-down'} size={11} color={c.pos ? COLORS.positive : COLORS.negative} />
                        <Text style={[s.pctTxt, { color: c.pos ? COLORS.positive : COLORS.negative }]}>{c.pct}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
            )}
          />
          {/* Carousel Dots */}
          <View style={s.dotsRow}>
            {displayMetrics.map((_, i) => (
              <View key={i} style={[s.dot, i === metricIdx && s.dotActive]} />
            ))}
          </View>
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
                <TouchableOpacity
                  key={inv.guid || `purchase-${index}`}
                  style={s.itemCard}
                  activeOpacity={0.7}
                  onPress={() => {
                    const routeType = docTypeToRouteType(inv.docType || 'invoice', 'purchase');
                    router.push(`/document/${inv.guid || inv.id}?type=${routeType}` as any);
                  }}
                >
                  {/* Status Row */}
                  <View style={s.itemStatusRow}>
                    <VoucherTypeBadge
                      module="purchase"
                      docType={inv.docType}
                      voucher_type={inv.voucherType}
                      is_optional={inv.isOptional}
                    />
                    <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[inv.status] ?? '#9CA3AF' }]} />
                    <Text style={[s.itemStatusTxt, { color: STATUS_COLOR[inv.status] ?? '#9CA3AF' }]}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </Text>
                    <Text style={s.itemBullet}> • </Text>
                    <Text style={s.itemInvId}>{inv.voucher || inv.id}</Text>
                  </View>
                  {/* Content Row */}
                  <View style={s.itemContentRow}>
                    <View style={s.tallyIcon}>
                      <Ionicons name="return-down-back-outline" size={16} color={AMBER} />
                    </View>
                    <View style={s.itemCenter}>
                      <Text style={s.itemVendor} numberOfLines={1}>{inv.vendor}</Text>
                      <Text style={s.itemMeta}>{inv.date} | {inv.time}</Text>
                    </View>
                    <Text style={s.itemAmt}>{inv.amount}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/purchase/register' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>{t('purchase.viewAll')}</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
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
              liveTopVendors.map(vendor => (
              <TouchableOpacity
                key={vendor.id}
                style={s.vendorCard}
                activeOpacity={0.7}
                onPress={() => router.push('/purchase/register' as any)}
              >
                <View style={[s.vendorAvatar, { backgroundColor: vendor.color + '22' }]}>
                  <Text style={[s.vendorAvatarTxt, { color: vendor.color }]}>{vendor.name.charAt(0)}</Text>
                </View>
                <View style={s.vendorInfo}>
                  <Text style={s.vendorName}>{vendor.name}</Text>
                  <Text style={s.vendorTxn}>{vendor.transactions} transactions</Text>
                </View>
                <Text style={s.itemAmt}>{vendor.amount}</Text>
              </TouchableOpacity>
            ))
            )}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/ledger' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>{t('purchase.viewAll')}</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── Sticky Banner Carousel (only when real alerts exist) ───── */}
      {liveBanners.length > 0 && (
      <View style={[s.bannerWrap, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        <FlatList
          ref={bannerRef}
          data={liveBanners}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={b => b.id}
          scrollEnabled={false}
          snapToInterval={BANNER_W + 10}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: BANNER_W + 10, offset: (BANNER_W + 10) * index, index })}
          onScrollToIndexFailed={() => {}}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 10 }}
          renderItem={({ item: b }) => (
            <View style={s.bannerCard}>
              <View style={s.bannerLeft}>
                <View style={s.bannerIconWrap}>
                  <Ionicons name="warning-outline" size={15} color={COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.bannerBold} numberOfLines={1}>{b.bold}</Text>
                  <Text style={s.bannerSub} numberOfLines={1}>{b.sub}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={s.bannerBtn}
                activeOpacity={0.85}
                onPress={() => router.push('/purchase/register' as any)}
              >
                <Text style={s.bannerBtnTxt}>{b.action}</Text>
                <Ionicons name="chevron-forward" size={11} color={BANNER_RED} />
              </TouchableOpacity>
            </View>
          )}
        />
        {/* Banner Dots */}
        <View style={s.bannerDots}>
          {liveBanners.map((_, i) => (
            <View key={i} style={[s.bannerDot, i === bannerIdx && s.bannerDotActive]} />
          ))}
        </View>
      </View>
      )}

      {/* ── Date Range Picker ──────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

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

  // Filter Row
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    zIndex: 20,
  },
  datePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  dateTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  statusWrap: { position: 'relative', zIndex: 100 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 88,
  },
  statusPillOpen: { borderColor: COLORS.brandPrimary },
  statusTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dropMenu: {
    position: 'absolute', top: 46, right: 0,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
    minWidth: 130, zIndex: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
  },
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  // Metric Carousel
  carouselWrap: { paddingTop: SPACING.md },
  metricItem: { width: SW },
  metricCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginHorizontal: SPACING.md,
  },
  mIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  mLabel: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  mAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  pctBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full },
  pctTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // Carousel Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },

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

  // Invoice Item Card (Recent Purchases)
  itemCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    gap: 8,
  },
  itemStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },
  itemStatusTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  itemBullet:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemInvId:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, flex: 1 },
  itemContentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tallyIcon:       { width: 38, height: 38, borderRadius: 10, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center' },
  itemCenter:      { flex: 1 },
  itemVendor:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemMeta:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  itemAmt:         { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  // Vendor Card (Top Vendors)
  vendorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  vendorAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  vendorAvatarTxt: { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  vendorInfo:      { flex: 1 },
  vendorName:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  vendorTxn:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },

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

  // Banner Carousel
  bannerWrap:      { backgroundColor: COLORS.pageBg, paddingTop: SPACING.sm },
  bannerCard:      { width: BANNER_W, backgroundColor: BANNER_RED, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bannerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bannerIconWrap:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerBold:      { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  bannerSub:       { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  bannerBtn:       { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 0 },
  bannerBtnTxt:    { fontSize: 10, fontWeight: '700', color: BANNER_RED },
  bannerDots:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingTop: 6, paddingBottom: 4 },
  bannerDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  bannerDotActive: { width: 14, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },
});
