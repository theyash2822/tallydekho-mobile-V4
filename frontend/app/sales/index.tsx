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
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useSettings } from '../../src/context/SettingsContext';
import { KPICardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';

const AMBER      = '#A89060';
const AMBER_BG   = '#FDF9F4';
const BANNER_RED = '#E53935';
const { width: SW } = Dimensions.get('window');
const CARD_W  = SW - SPACING.md * 2;
const BANNER_W = SW - SPACING.md * 2;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SalesScreen() {
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

  const load = useCallback(() => {
    if (!companyGuid) return;
    setApiError(null);
    setIsLoading(true);
    const fyParams = selectedFY?.startDate && selectedFY?.endDate
      ? { from: selectedFY.startDate, to: selectedFY.endDate }
      : {};
    Promise.all([
      getSalesInvoices(companyGuid, { limit: '50', ...fyParams } as any),
      getSalesHomeMetrics(companyGuid, fyParams),
    ]).then(([invRes, metricsRes]: any[]) => {
      const rows = invRes?.data ?? [];
      if (rows.length) {
        setLiveRecent(rows.slice(0, 5).map((r: any, i: number) => ({
          id: r.guid || `sale-${r.voucher_number || 'x'}-${r.id ?? i}`,
          voucher: r.voucher_number || '',
          party: r.party_name || '',
          date: r.date || '',
          amount: formatAmount(Math.abs(+r.amount || 0)),
          status: r.irn ? 'generated' : 'pending_irn',
        })));
        const partyMap: Record<string, number> = {};
        rows.forEach((r: any) => {
          if (r.party_name) partyMap[r.party_name] = (partyMap[r.party_name] || 0) + (+r.amount || 0);
        });
        const top = Object.entries(partyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        setLiveTopParties(top.map(([name, amt], i) => ({
          id: `tp${i}`,
          name,
          amount: formatAmount(Math.round(+amt)),
          color: ['#2563EB', '#D97706', '#7C3AED', '#0891B2', '#059669'][i],
        })));
        const pendingIRN = rows.filter((r: any) => !r.irn).length;
        setLiveBanners(pendingIRN > 0
          ? [{ id: 'b1', bold: `${pendingIRN} invoices`, sub: 'pending E-Invoice (IRN) generation', action: 'Generate Now' }]
          : []);
      } else {
        setLiveRecent([]);
        setLiveTopParties([]);
        setLiveBanners([]);
      }
      setMetrics(metricsRes?.data ?? metricsRes ?? null);
    }).catch((err: any) => {
      setApiError(err?.message || 'Failed to load sales data');
      console.error('[Sales]', err?.message);
    }).finally(() => setIsLoading(false));
  }, [companyGuid, lastSyncAt, selectedFY?.startDate, selectedFY?.endDate, formatAmount]);

  useEffect(() => { load(); }, [load]);

  const metricCards = useMemo(() => {
    const m = metrics || {};
    return [
      { id: 'today', label: 'Today', icon: 'calendar-outline', amount: formatAmountCompact(Math.round(Number(m.today) || 0)) },
      { id: 'mtd', label: 'MTD', icon: 'calendar-number-outline', amount: formatAmountCompact(Math.round(Number(m.mtd) || 0)) },
      { id: 'ytd', label: 'YTD', icon: 'ribbon-outline', amount: formatAmountCompact(Math.round(Number(m.ytd) || 0)) },
      { id: 'outstanding', label: 'Outstanding', icon: 'wallet-outline', amount: formatAmountCompact(Math.round(Number(m.outstanding) || 0)) },
      { id: 'credit', label: 'Credit Notes', icon: 'receipt-outline', amount: formatAmountCompact(Math.round(Number(m.credit_notes) || 0)) },
      { id: 'avg', label: 'Avg Ticket', icon: 'ticket-outline', amount: formatAmountCompact(Math.round(Number(m.avg_ticket) || 0)) },
    ];
  }, [metrics, formatAmountCompact]);

  // ─ Tab & filter state
  const [tab,      setTab]      = useState<'recent' | 'parties'>('recent');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  // ─ Date range state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate,       setFromDate]       = useState('01/01/25');
  const [toDate,         setToDate]         = useState('22/04/25');
  const dateLabel = `${fromDate} – ${toDate}`;

  // ─ Carousel state
  const metricRef  = useRef<FlatList>(null);
  const bannerRef  = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);

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

  useEffect(() => {
    if (liveBanners.length === 0) return;
    const t = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % liveBanners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [liveBanners.length]);

  const sourceRecent = liveRecent;
  const recent = sourceRecent.filter((inv: any) => {
    if (filter === 'Paid')   return inv.status === 'paid';
    if (filter === 'Unpaid') return inv.status === 'unpaid';
    return true;
  }).slice(0, 5);
  const displayTopParties = liveTopParties;
  const displayBanners = liveBanners;

  const handleDateApply = (from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setShowDatePicker(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sales</Text>
        <TouchableOpacity
          style={s.ewbBtn}
          onPress={() => router.push('/reports/ewb-list' as any)}
          activeOpacity={0.7}
        >
          <Text style={s.ewbTxt}>E-way Bill</Text>
          <Ionicons name="document-text-outline" size={15} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Filter Row ──────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.datePill} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateTxt}>{dateLabel}</Text>
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
              <View style={s.metricItem}>
                <View style={s.metricCard}>
                  <View style={s.mIcon}>
                    <Ionicons name={c.icon as any} size={22} color={COLORS.textSecondary} />
                  </View>
                  <Text style={s.mLabel}>{c.label}</Text>
                  <Text style={s.mAmount}>{c.amount}</Text>
                </View>
              </View>
            )}
          />
          <View style={s.dotsRow}>
            {metricCards.map((_, i) => (
              <View key={i} style={[s.dot, i === metricIdx && s.dotActive]} />
            ))}
          </View>
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
          {(['recent', 'parties'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === t && s.tabActiveTxt]}>
                {t === 'recent' ? 'Recent Sales' : 'Top Parties'}
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
                <Text style={s.emptyTxt}>No {filter.toLowerCase()} invoices</Text>
              </View>
            ) : (
              recent.map(inv => (
                <TouchableOpacity
                  key={inv.id}
                  style={s.itemCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/document/${inv.id}?type=sales_invoice` as any)}
                >
                  <View style={s.tallyIcon}>
                    <Ionicons name="return-down-back-outline" size={18} color={AMBER} />
                  </View>
                  <View style={s.itemCenter}>
                    <Text style={s.itemParty} numberOfLines={1}>
                      {inv.party}{' '}
                      <Text style={s.itemInvId}>• {inv.id}</Text>
                    </Text>
                    <Text style={s.itemMeta}>{inv.date} | {inv.time}</Text>
                  </View>
                  <Text style={s.itemAmt}>{inv.amount}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/sales/register' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
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
            ) : displayTopParties.map(p => (
              <TouchableOpacity key={p.id} style={s.itemCard} activeOpacity={0.7}>
                <View style={[s.avatar, { backgroundColor: p.color + '22' }]}>
                  <Text style={[s.avatarTxt, { color: p.color }]}>{p.name.charAt(0)}</Text>
                </View>
                <Text style={s.partyName}>{p.name}</Text>
                <Text style={s.itemAmt}>{p.amount}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/ledger' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky Banner Carousel ─────────────────────────────────── */}
      {displayBanners.length > 0 && (
      <View style={[s.bannerWrap, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        <FlatList
          ref={bannerRef}
          data={displayBanners}
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
              <TouchableOpacity style={s.bannerBtn} activeOpacity={0.85}>
                <Text style={s.bannerBtnTxt}>{b.action}</Text>
                <Ionicons name="chevron-forward" size={11} color={BANNER_RED} />
              </TouchableOpacity>
            </View>
          )}
        />
        <View style={s.bannerDots}>
          {displayBanners.map((_, i) => (
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
        onApply={handleDateApply}
        onClose={() => setShowDatePicker(false)}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />

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

  // Dots
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

  // List
  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tallyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center' },
  itemCenter: { flex: 1 },
  itemParty:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemInvId:  { fontSize: TYPOGRAPHY.xs, fontWeight: '400', color: COLORS.textSecondary },
  itemMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  itemAmt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  avatar:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  partyName:  { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // View All
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'center', marginTop: 4, minWidth: 150,
  },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // Banner Carousel
  bannerWrap:     { backgroundColor: COLORS.pageBg, paddingTop: SPACING.sm },
  bannerCard:     { width: BANNER_W, backgroundColor: BANNER_RED, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bannerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bannerIconWrap: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerBold:     { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  bannerSub:      { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  bannerBtn:      { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 0 },
  bannerBtnTxt:   { fontSize: 10, fontWeight: '700', color: BANNER_RED },
  bannerDots:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingTop: 6, paddingBottom: 4 },
  bannerDot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  bannerDotActive:{ width: 14, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },
});
