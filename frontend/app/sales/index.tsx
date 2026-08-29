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
import { getSalesVouchers, getSalesHomeMetrics } from '../../src/services/api';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useSettings } from '../../src/context/SettingsContext';
import { KPICardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useTranslation } from 'react-i18next';
import FilterBottomSheet, { FilterChipGroup } from '../../src/components/FilterBottomSheet';
import {
  SALES_DOC_TYPES,
  ALL_SALES_DOC_TYPE_IDS,
  DOC_TYPE_LABEL,
  FilterIconWithBadge,
  ActiveFilterChips,
  notifyFiltersApplied,
  docTypeToRouteType,
  type SalesDocTypeId,
} from '../../src/components/voucherHomeFilters';

const AMBER      = '#A89060';
const BANNER_RED = '#E53935';
const { width: SW } = Dimensions.get('window');
const BANNER_W = SW - SPACING.md * 2;

// Default: all doc types selected → first paint shows full combined Recent feed.
const DEFAULT_SALES_TYPES: SalesDocTypeId[] = [...ALL_SALES_DOC_TYPE_IDS];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SalesScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact } = useSettings();
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

  // Doc-type multi-filter (Ledger-style sheet). Default = all types.
  const [docTypes, setDocTypes] = useState<SalesDocTypeId[]>(DEFAULT_SALES_TYPES);
  const [draftDocTypes, setDraftDocTypes] = useState<SalesDocTypeId[]>(DEFAULT_SALES_TYPES);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const allTypesSelected = docTypes.length === ALL_SALES_DOC_TYPE_IDS.length;
  const filterBadgeCount = allTypesSelected ? 0 : docTypes.length;

  const load = useCallback((opts?: { soft?: boolean; types?: SalesDocTypeId[] }) => {
    if (!companyGuid) return;
    const soft = opts?.soft ?? hasSalesDataRef.current;
    const types = opts?.types ?? docTypes;
    if (!soft) setIsLoading(true);
    if (!soft) setApiError(null);
    const fyParams = selectedFY?.startDate && selectedFY?.endDate
      ? { from: selectedFY.startDate, to: selectedFY.endDate }
      : {};
    Promise.allSettled([
      getSalesVouchers(companyGuid, {
        limit: '50',
        docTypes: types.join(','),
        ...fyParams,
      } as any),
      getSalesHomeMetrics(companyGuid, fyParams),
    ]).then(([invSettled, metricsSettled]) => {
      let anyOk = false;
      if (invSettled.status === 'fulfilled') {
        const invRes: any = invSettled.value;
        const rows = invRes?.data ?? [];
        if (rows.length) {
          setLiveRecent(rows.slice(0, 20).map((r: any, i: number) => {
            const docType = r.doc_type || 'invoice';
            return {
              id: r.guid || `sale-${r.voucher_number || 'x'}-${r.id ?? i}`,
              guid: r.guid,
              voucher: r.voucher_number || '',
              party: r.party_name || '',
              date: r.date || '',
              time: '',
              amount: formatAmount(Math.abs(+r.amount || 0)),
              status: r.irn ? 'generated' : 'pending_irn',
              docType,
              voucherType: r.voucher_type || '',
              isOptional: !!r.is_optional,
              typeLabel: DOC_TYPE_LABEL[docType] || docType,
            };
          }));
          const partyMap: Record<string, number> = {};
          rows.filter((r: any) => (r.doc_type || 'invoice') === 'invoice').forEach((r: any) => {
            if (r.party_name) partyMap[r.party_name] = (partyMap[r.party_name] || 0) + (+r.amount || 0);
          });
          const top = Object.entries(partyMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
          setLiveTopParties(top.map(([name, amt], i) => ({
            id: `tp${i}`,
            name,
            amount: formatAmount(Math.round(+amt)),
            color: ['#2563EB', '#D97706', '#7C3AED', '#0891B2', '#059669'][i],
          })));
          const pendingIRN = rows.filter((r: any) => !r.irn && (r.doc_type === 'invoice' || !r.doc_type)).length;
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
  }, [companyGuid, selectedFY?.startDate, selectedFY?.endDate, formatAmount, t, docTypes]);

  useEffect(() => { load({ soft: hasSalesDataRef.current }); }, [load]);

  // lastSyncAt → soft refresh when data already showing
  useEffect(() => {
    if (!lastSyncAt || !companyGuid || !hasSalesDataRef.current) return;
    const timer = setTimeout(() => load({ soft: true }), 400);
    return () => clearTimeout(timer);
  }, [lastSyncAt, companyGuid, load]);

  const metricCards = useMemo(() => {
    const m = metrics || {};
    return [
      { id: 'today', label: t('sales.today'), icon: 'calendar-outline', amount: formatAmountCompact(Math.round(Number(m.today) || 0)) },
      { id: 'mtd', label: t('sales.mtd'), icon: 'calendar-number-outline', amount: formatAmountCompact(Math.round(Number(m.mtd) || 0)) },
      { id: 'ytd', label: t('sales.ytd'), icon: 'ribbon-outline', amount: formatAmountCompact(Math.round(Number(m.ytd) || 0)) },
      { id: 'outstanding', label: t('sales.outstanding'), icon: 'wallet-outline', amount: formatAmountCompact(Math.round(Number(m.outstanding) || 0)) },
      { id: 'credit', label: t('sales.creditNotes'), icon: 'receipt-outline', amount: formatAmountCompact(Math.round(Number(m.credit_notes) || 0)) },
      { id: 'avg', label: t('sales.avgTicket'), icon: 'ticket-outline', amount: formatAmountCompact(Math.round(Number(m.avg_ticket) || 0)) },
    ];
  }, [metrics, formatAmountCompact, t]);

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
    const timer = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % metricCards.length;
        metricRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [metricCards.length]);

  useEffect(() => {
    if (liveBanners.length === 0) return;
    const timer = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % liveBanners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
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

  const openTypeFilter = () => {
    setDraftDocTypes(docTypes);
    setShowTypeFilter(true);
  };

  const applyTypeFilter = () => {
    const next = draftDocTypes.length ? draftDocTypes : DEFAULT_SALES_TYPES;
    setDocTypes(next);
    setShowTypeFilter(false);
    const narrowed = next.length < ALL_SALES_DOC_TYPE_IDS.length;
    notifyFiltersApplied(
      narrowed
        ? next.map((id) => SALES_DOC_TYPES.find((d) => d.id === id)?.label || id)
        : []
    );
    load({ soft: true, types: next });
  };

  const activeTypeChips = allTypesSelected
    ? []
    : docTypes.map((id) => ({
        id,
        label: SALES_DOC_TYPES.find((d) => d.id === id)?.label || id,
      }));

  const removeTypeChip = (id: string) => {
    const next = docTypes.filter((x) => x !== id);
    const applied = next.length ? next : DEFAULT_SALES_TYPES;
    setDocTypes(applied);
    load({ soft: true, types: applied });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={() => load({ soft: hasSalesDataRef.current })} />}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('sales.title')}</Text>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.ewbBtn}
            onPress={() => router.push('/reports/ewb-list' as any)}
            activeOpacity={0.7}
          >
            <Text style={s.ewbTxt}>{t('sales.ewayBill')}</Text>
            <Ionicons name="document-text-outline" size={15} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <FilterIconWithBadge
            testID="sales-filter-btn"
            count={filterBadgeCount}
            onPress={openTypeFilter}
          />
        </View>
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
            <Text style={s.statusTxt}>{
              filter === 'Paid' ? t('sales.paid') : filter === 'Unpaid' ? t('sales.unpaid') : t('sales.all')
            }</Text>
            <Ionicons name={dropdown ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {dropdown && (
            <View style={s.dropMenu}>
              {([{id:'All',key:'sales.all'},{id:'Paid',key:'sales.paid'},{id:'Unpaid',key:'sales.unpaid'}]).map(({id:opt,key}) => (
                <TouchableOpacity
                  key={opt}
                  style={s.dropItem}
                  activeOpacity={0.7}
                  onPress={() => { setFilter(opt); setDropdown(false); }}
                >
                  <Text style={[s.dropTxt, filter === opt && s.dropTxtActive]}>{t(key)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ActiveFilterChips
        chips={activeTypeChips}
        onRemove={removeTypeChip}
        onClearAll={() => {
          setDocTypes(DEFAULT_SALES_TYPES);
          load({ soft: true, types: DEFAULT_SALES_TYPES });
        }}
      />

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
                <TouchableOpacity
                  key={inv.id}
                  style={s.itemCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(
                    `/document/${inv.guid || inv.id}?type=${docTypeToRouteType(inv.docType, 'sales')}` as any
                  )}
                >
                  <View style={s.tallyIcon}>
                    <Ionicons name="return-down-back-outline" size={18} color={AMBER} />
                  </View>
                  <View style={s.itemCenter}>
                    <Text style={s.itemParty} numberOfLines={1}>
                      {inv.party}{' '}
                      <Text style={s.itemInvId}>• {inv.voucher || inv.id}</Text>
                    </Text>
                    <Text style={s.itemMeta}>
                      {inv.typeLabel}{inv.date ? ` | ${inv.date}` : ''}{inv.time ? ` | ${inv.time}` : ''}
                    </Text>
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
              <Text style={s.viewAllTxt}>{t('sales.viewAll')}</Text>
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
              <Text style={s.viewAllTxt}>{t('sales.viewAll')}</Text>
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

      <FilterBottomSheet
        visible={showTypeFilter}
        onClose={() => setShowTypeFilter(false)}
        title="Filter documents"
        activeCount={draftDocTypes.length === ALL_SALES_DOC_TYPE_IDS.length ? 0 : draftDocTypes.length}
        onClear={() => setDraftDocTypes([...DEFAULT_SALES_TYPES])}
        onApply={applyTypeFilter}
        applyLabel="Apply Filters"
        heightFraction={0.55}
      >
        <FilterChipGroup
          label="Document types"
          multi
          options={SALES_DOC_TYPES.map((d) => ({ id: d.id, label: d.label }))}
          selected={draftDocTypes}
          onSelect={(ids) => setDraftDocTypes(ids as SalesDocTypeId[])}
        />
      </FilterBottomSheet>

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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

  // Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 3,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.cardBg },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary, fontWeight: '700' },

  // List
  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tallyIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FDF9F4',
    alignItems: 'center', justifyContent: 'center',
  },
  itemCenter: { flex: 1 },
  itemParty: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemInvId: { fontWeight: '400', color: COLORS.textSecondary },
  itemMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  itemAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  partyName: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 14,
  },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // Banner
  bannerWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    paddingTop: 8,
  },
  bannerCard: {
    width: BANNER_W, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: RADIUS.md, padding: 10, gap: 8,
  },
  bannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerIconWrap: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: BANNER_RED,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerBold: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  bannerSub: { fontSize: 10, color: COLORS.textSecondary },
  bannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: COLORS.white, borderRadius: RADIUS.sm,
  },
  bannerBtnTxt: { fontSize: 10, fontWeight: '700', color: BANNER_RED },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  bannerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDefault },
  bannerDotActive: { width: 12, backgroundColor: BANNER_RED },
});
