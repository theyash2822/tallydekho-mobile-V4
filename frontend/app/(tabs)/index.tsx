import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, FlatList,
  KeyboardAvoidingView, Platform, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useSettings } from '../../src/context/SettingsContext';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import ShimmerPlaceholder, { KPICardSkeleton, MetricCardSkeleton, ActivityRowSkeleton, CardSkeleton } from '../../src/components/ShimmerPlaceholder';

const { width: SW } = Dimensions.get('window');
import Header from '../../src/components/Header';
import SearchBar from '../../src/components/SearchBar';
import CashflowCard from '../../src/components/CashflowCard';
import ModuleTiles from '../../src/components/ModuleTiles';
import RecentActivity from '../../src/components/RecentActivity';
import { KPICarouselCard, KPICarouselPage, KPICarouselDots } from '../../src/components/KPICarouselCard';
import PairingBanner from '../../src/components/PairingBanner';
import OfflineBadge from '../../src/components/OfflineBadge';
import {
  getKPIStrip, getMetrics, getCashflow, getRecentActivity, getTallySyncStatus, getNotifications,
  searchDashboard, errorMessage,
} from '../../src/services/api';
import Toast from 'react-native-toast-message';
import { ErrorBanner, ErrorState, SectionError } from '../../src/components/ApiStateViews';
import { useDeviceOnline } from '../../src/hooks/useDeviceOnline';
import { useTranslation } from 'react-i18next';
import {
  CASHFLOW_PERIOD_KEY,
  isSyncPeriod,
  resolvePeriodDates,
  type DashboardPeriod,
} from '../../src/utils/periodDates';
import { tKpiLabel } from '../../src/i18n/labelMap';
import { formatSensitive } from '../../src/utils/sensitiveDisplay';
// No mock data imports — real data only (V2 rule)

const TIME_FILTERS = ['7D', '1M', '3M', '6M'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

/** Home KPI strip id → sensitive policy key */
const KPI_SENSITIVE: Record<string, string> = {
  cash: 'cash_balance',
  bank: 'bank_balance',
};

const MODULE_CARDS = [
  { id: 'sales',    labelKey: 'home.moduleSales',    icon: 'trending-up',   route: '/sales',    color: '#2D7D46', bg: '#F0FBF4' },
  { id: 'purchase', labelKey: 'home.modulePurchase', icon: 'cart',          route: '/purchase', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'voucher',  labelKey: 'home.moduleVouchers', icon: 'card',          route: '/voucher',  color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'expenses', labelKey: 'home.moduleExpenses', icon: 'receipt-outline', route: '/expenses', color: '#DC2626', bg: '#FDECEA' },
  { id: 'settings', labelKey: 'home.moduleSettings', icon: 'settings-outline', route: '/settings', color: '#D97706', bg: '#FFFBEB' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isDesktopOnline, company, user, selectedFY, lastSyncAt } = useAuth();
  const { workspaceId, pairingStatus, invitations, demoMode, tallyConnected, sensitivePolicies } = useWorkspace();
  // Product 1A: CONNECTED with no company → empty CTA (dataReady false until company exists)
  const dataReady =
    !!company?.guid &&
    (tallyConnected || demoMode || pairingStatus === 'UNPAIRED' || pairingStatus === 'RECONNECTING');
  const deviceOnline = useDeviceOnline();
  const companyGuid = company?.guid;
  const [activeFY, setActiveFY] = useState('');
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('1M');
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  /** Page-level banner: partial primary fail OR soft-refresh fail (stale data) */
  const [pageBanner, setPageBanner] = useState<string | null>(null);
  const [cashflowError, setCashflowError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState(false);
  /** First load: all primary sections failed → full-page ErrorState */
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [dataAsOf, setDataAsOf] = useState<Date | null>(null);
  const dataAsOfRef = useRef<Date | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  // Previous live state, remembered per workspace so switching tenants is not
  // reported as this workspace connecting or disconnecting.
  const wasPaired = useRef(false);
  const toastedWsRef = useRef<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // KPI Carousel — driven by SettingsContext (no AsyncStorage race condition)
  const { settings, formatAmount, formatAmountCompact } = useSettings();
  const autoScrollCarousel = settings.kpi_autoscroll;
  const kpiRef  = useRef<FlatList>(null);
  const [kpiIdx, setKpiIdx] = useState(0);

  useEffect(() => {
    if (!autoScrollCarousel || kpiData.length === 0) return;
    const t = setInterval(() => {
      setKpiIdx(prev => {
        const next = (prev + 1) % kpiData.length;
        kpiRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [kpiData.length, autoScrollCarousel]);

  // Filtered activity for search results
  const filteredActivity = useMemo(() => {
    const safeActivity = Array.isArray(activity) ? activity : [];
    if (!searchQuery.trim()) return safeActivity;
    const q = searchQuery.toLowerCase();
    return safeActivity.filter((item: any) =>
      (item.label || '').toLowerCase().includes(q) ||
      (item.party || '').toLowerCase().includes(q) ||
      (item.amount || '').toLowerCase().includes(q)
    );
  }, [searchQuery, activity]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || !dataReady || !companyGuid) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      searchDashboard(q, companyGuid)
        .then((res) => setSearchResults(Array.isArray(res?.data) ? res.data : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, dataReady, companyGuid]);

  const searchActivities = useMemo(() => {
    if (searchResults.length === 0) return filteredActivity;
    return searchResults.map((r: any) => ({
      id: r.id,
      type: r.kind === 'voucher' ? (r.is_credit ? 'credit' : 'debit') : 'other',
      guid: r.kind === 'voucher' ? r.guid : r.kind === 'ledger' ? r.guid : null,
      route: r.route,
      label: r.label,
      party: r.party,
      date: r.subtitle,
      amount_raw: r.amount_raw,
      is_credit: r.is_credit,
    }));
  }, [searchResults, filteredActivity]);

  // ── Data loading ─────────────────────────────────────────────────────────
  // Soft-refresh policy: full shimmer only on first load / company switch.
  // Period chip, PTR, lastSyncAt keep previous KPI/tiles/cashflow/activity.
  const [isLoading, setIsLoading] = useState(true);
  const hasDashboardDataRef = useRef(false);
  const requestGenRef = useRef(0);
  const prevGuidRef = useRef<string | undefined>(companyGuid);
  const prevFilterRef = useRef<TimeFilter>(activeFilter);
  const prevFyRef = useRef<string | undefined>(selectedFY?.startDate);

  // Keep header FY label in sync with AuthContext (Header owns the picker)
  useEffect(() => {
    if (selectedFY?.label) setActiveFY(selectedFY.label);
  }, [selectedFY?.label]);

  const handleFYChange = useCallback((fy: string) => {
    setActiveFY(fy);
    // selectedFY in AuthContext is updated by Header; loadData deps pick it up
  }, []);

  // Company switch → hard reset so first paint for new company can shimmer
  useEffect(() => {
    if (prevGuidRef.current === companyGuid) return;
    prevGuidRef.current = companyGuid;
    hasDashboardDataRef.current = false;
    setKpiData([]);
    setMetrics([]);
    setCashflow(null);
    setActivity([]);
    setPageBanner(null);
    setCashflowError(null);
    setActivityError(false);
    setFatalError(null);
    setDataAsOf(null);
    setIsLoading(true);
  }, [companyGuid]);

  type LoadOpts = { soft?: boolean; skipActivity?: boolean };

  const formatAsOf = useCallback((d: Date | null) => {
    if (!d) return t('home.earlier', 'earlier');
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }, [t]);

  const loadData = useCallback(async (opts?: LoadOpts) => {
    // ── DATA GATE ──────────────────────────────────────────────
    if (!dataReady) {
      hasDashboardDataRef.current = false;
      setKpiData([]);
      setMetrics([]);
      setCashflow(null);
      setActivity([]);
      setFatalError(null);
      setPageBanner(null);
      setCashflowError(null);
      setActivityError(false);
      setIsLoading(false);
      return;
    }
    if (!companyGuid) {
      if (!hasDashboardDataRef.current) setIsLoading(true);
      return;
    }

    const soft = opts?.soft ?? hasDashboardDataRef.current;
    const hadData = hasDashboardDataRef.current;
    // Full-page shimmer ONLY when no dashboard data yet (first load / company switch)
    if (!soft) setIsLoading(true);
    // Soft refresh: keep existing banner until success; first load clears fatal
    if (!soft && !hadData) {
      setFatalError(null);
      setPageBanner(null);
    }
    const gen = ++requestGenRef.current;

    try {
      const { from, to } = resolvePeriodDates(activeFilter as DashboardPeriod, {
        from: selectedFY?.startDate,
        to: selectedFY?.endDate,
      });

      const skipActivity = !!opts?.skipActivity;
      const settled = await Promise.allSettled([
        getKPIStrip(companyGuid, activeFilter, from, to),
        getMetrics(companyGuid, activeFilter, from, to),
        getCashflow(companyGuid, activeFilter, from, to),
        skipActivity
          ? Promise.resolve({ __skipped: true } as any)
          : getRecentActivity(companyGuid),
      ]);
      if (gen !== requestGenRef.current) return;

      const [kpiR, metR, cfR, actR] = settled;

      let kpiOk = false;
      let metOk = false;
      let cfOk = false;

      if (kpiR.status === 'fulfilled') {
        const kpi = kpiR.value;
        const kpiArr = Array.isArray(kpi) ? kpi : (kpi as any)?.data ?? [];
        if (Array.isArray(kpiArr) && kpiArr.length > 0) {
          setKpiData(kpiArr as any);
          kpiOk = true;
        } else if (!soft) {
          // Empty/304-parsed response — don't treat as success; keep showing retry
          setKpiData([]);
        }
      }

      if (metR.status === 'fulfilled') {
        const met = metR.value;
        const metArr = Array.isArray(met) ? met : (met as any)?.data ?? [];
        setMetrics(metArr as any);
        metOk = true;
      }

      if (cfR.status === 'fulfilled') {
        const cf = cfR.value;
        const raw = cf ? ((cf as any)?.data ?? cf) : null;
        if (raw && typeof raw === 'object' && !('success' in raw)) {
          // API is snake_case; CashflowCard expects camelCase
          const cfData = {
            netCash: raw.netCash ?? raw.net_cash ?? 0,
            grossCash: raw.grossCash ?? raw.gross_cash ?? 0,
            netRealisableBalance: raw.netRealisableBalance ?? raw.net_realisable_balance ?? 0,
            grossProfit: raw.grossProfit ?? raw.gross_profit ?? 0,
            netProfit: raw.netProfit ?? raw.net_profit ?? 0,
            incomePercentage: raw.incomePercentage ?? raw.income_percentage ?? raw.gross_profit_vs_sales_pct ?? 0,
            updatedAt: raw.updatedAt ?? raw.updated_at ?? 'just now',
            totalIncome: raw.totalIncome ?? raw.total_income ?? 0,
            totalExpense: raw.totalExpense ?? raw.total_expense ?? 0,
            series: raw.series,
            interval: raw.interval,
          };
          setCashflow(cfData as any);
        } else {
          setCashflow(null);
        }
        setCashflowError(null);
        cfOk = true;
      } else {
        setCashflowError(
          errorMessage(cfR.reason, t('home.cashflowUnavailable', 'Cashflow unavailable')),
        );
      }

      if (!skipActivity) {
        if (actR.status === 'fulfilled' && !(actR.value as any)?.__skipped) {
          const act = actR.value;
          const actArr = Array.isArray(act) ? act : (act as any)?.data ?? [];
          setActivity(actArr as any);
          setActivityError(false);
        } else if (actR.status === 'rejected') {
          setActivityError(true);
        }
      }

      const primaryOkCount = [kpiOk, metOk, cfOk].filter(Boolean).length;
      const anyPrimaryOk = primaryOkCount > 0;

      if (anyPrimaryOk) {
        hasDashboardDataRef.current = true;
        const now = new Date();
        dataAsOfRef.current = now;
        setDataAsOf(now);
        setFatalError(null);

        if (primaryOkCount < 3) {
          setPageBanner(
            t('home.partialUpdate', "Some data couldn't be updated"),
          );
        } else {
          setPageBanner(null);
        }
      } else {
        if (hadData || soft) {
          setPageBanner(
            t('home.refreshFailed', {
              time: formatAsOf(dataAsOfRef.current),
              defaultValue: `Couldn't refresh. Showing data from ${formatAsOf(dataAsOfRef.current)}. Retry`,
            }),
          );
        } else {
          const firstReason =
            (kpiR.status === 'rejected' && errorMessage(kpiR.reason)) ||
            (metR.status === 'rejected' && errorMessage(metR.reason)) ||
            (cfR.status === 'rejected' && errorMessage(cfR.reason)) ||
            t('home.loadFailed');
          setFatalError(firstReason);
          setPageBanner(null);
        }
      }
    } catch (err: any) {
      if (gen !== requestGenRef.current) return;
      if (hadData || soft) {
        setPageBanner(
          t('home.refreshFailed', {
            time: formatAsOf(dataAsOfRef.current),
            defaultValue: `Couldn't refresh. Showing data from ${formatAsOf(dataAsOfRef.current)}. Retry`,
          }),
        );
      } else {
        setFatalError(errorMessage(err, t('home.loadFailed')));
      }
    } finally {
      if (gen === requestGenRef.current) setIsLoading(false);
    }
  }, [
    dataReady, activeFilter, companyGuid, selectedFY?.startDate, selectedFY?.endDate,
    t, formatAsOf,
  ]);

  // Period / FY / company / pairing → load. Period-only: soft + skip activity.
  useEffect(() => {
    const periodOnly =
      hasDashboardDataRef.current &&
      prevGuidRef.current === companyGuid &&
      prevFyRef.current === selectedFY?.startDate &&
      prevFilterRef.current !== activeFilter;

    prevFilterRef.current = activeFilter;
    prevFyRef.current = selectedFY?.startDate;

    loadData({
      soft: hasDashboardDataRef.current,
      skipActivity: periodOnly,
    });
  }, [loadData, companyGuid, activeFilter, selectedFY?.startDate]);

  // lastSyncAt → soft background refresh (debounce); never hard-wipe if data showing
  useEffect(() => {
    if (!dataReady || !companyGuid || !lastSyncAt) return;
    if (!hasDashboardDataRef.current) return;
    const timer = setTimeout(() => {
      loadData({ soft: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [lastSyncAt, dataReady, companyGuid, loadData]);

  const readStoredPeriod = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(CASHFLOW_PERIOD_KEY);
      // Migrate sticky 7D → 1M: short windows often show ₹0 when last invoice is >7 days ago.
      if (saved === '7D') {
        setActiveFilter('1M');
        AsyncStorage.setItem(CASHFLOW_PERIOD_KEY, '1M').catch(() => {});
        return;
      }
      if (isSyncPeriod(saved)) setActiveFilter(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { readStoredPeriod(); }, [readStoredPeriod]);

  useFocusEffect(useCallback(() => {
    readStoredPeriod();
  }, [readStoredPeriod]));

  const handleFilterChange = useCallback((f: TimeFilter) => {
    setActiveFilter(f);
    AsyncStorage.setItem(CASHFLOW_PERIOD_KEY, f).catch(() => {});
  }, []);

  // ── Detect live pairing state change (not demo/unpaired) ────
  // Only CONNECTED is live: RECONNECTING still serves Demo books, so announcing
  // "Tally connected" for it told the user the opposite of what they were seeing.
  useEffect(() => {
    if (toastedWsRef.current !== workspaceId) {
      // Fresh workspace — adopt its state silently instead of toasting.
      toastedWsRef.current = workspaceId;
      wasPaired.current = tallyConnected;
      setLastSyncTime(null);
      return;
    }
    if (tallyConnected && !wasPaired.current) {
      Toast.show({
        type: 'success',
        text1: t('home.tallyConnected'),
        text2: t('home.tallyConnectedSub'),
        visibilityTime: 3000,
      });
      // Fetch last sync time from status API
      getTallySyncStatus().then((res: any) => {
        const d = res?.data ?? res;
        if (d?.device?.last_seen) {
          const ts = Number(d.device.last_seen) * 1000;
          setLastSyncTime(new Date(ts).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          }));
        }
      }).catch(() => {});
    }
    if (!tallyConnected && wasPaired.current) {
      Toast.show({ type: 'info', text1: t('home.tallyDisconnected'), text2: t('home.tallyDisconnectedSub'), visibilityTime: 3000 });
      setLastSyncTime(null);
    }
    wasPaired.current = tallyConnected;
  }, [tallyConnected, workspaceId, t]);

  // ── Update last sync timestamp whenever a sync fires ───────────
  useEffect(() => {
    if (!dataReady || !lastSyncAt) return;
    getTallySyncStatus().then((res: any) => {
      const d = res?.data ?? res;
      if (d?.device?.last_seen) {
        const ts = Number(d.device.last_seen) * 1000;
        setLastSyncTime(new Date(ts).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        }));
      }
    }).catch(() => {});
  }, [dataReady, lastSyncAt]);

  // ── Fetch real notification count ─────────────────────────────
  useEffect(() => {
    if (!dataReady || !companyGuid) return;
    getNotifications(companyGuid).then((res: any) => {
      const notifs = res?.data ?? res ?? [];
      setNotifCount(Array.isArray(notifs) ? notifs.length : 0);
    }).catch(() => {});
  }, [dataReady, companyGuid]);

  const onRefresh = async () => {
    // PTR: native RefreshControl spinner only — soft load, no full-page shimmer
    setRefreshing(true);
    await loadData({ soft: true });
    setRefreshing(false);
  };

  // ── KPI row render ────────────────────────────────────────────────────────
  const renderKPI = ({ item }: any) => {
    const policyKey = KPI_SENSITIVE[item.id];
    const rawVisible = item.amount_raw != null
      ? formatAmountCompact(item.amount_raw)
      : item.amount;
    const amount = policyKey
      ? (formatSensitive(
          sensitivePolicies,
          policyKey,
          item.amount_raw ?? item.amount,
          () => rawVisible,
        ) ?? '—')
      : rawVisible;
    return (
      <KPICarouselPage>
        <KPICarouselCard
          testID={`kpi-card-${item.id}`}
          icon={item.icon}
          label={tKpiLabel(t, item.id, item.label)}
          amount={amount}
          trend_pct={item.trend_pct}
          trend_positive={item.trend_positive != null ? item.trend_positive : item.positive}
          onPress={() => item.route && safePush(router, item.route as any)}
        />
      </KPICarouselPage>
    );
  };

  const isSearching = searchQuery.trim().length > 0;

  // First load: all primary failed → full-page ErrorState (not empty zeros + banner)
  if (fatalError && !hasDashboardDataRef.current && !isLoading) {
    return (
      <SafeAreaView testID="home-screen" style={styles.safe}>
        <Header
          companyName={company?.name ?? t('home.myCompany')}
          fyYear={activeFY}
          notificationCount={notifCount}
          userName={user?.name || t('home.user')}
          lastSyncTime={lastSyncTime ?? undefined}
          onFYChange={handleFYChange}
          onSettingsPress={() => safePush(router, '/settings' as any)}
        />
        <ErrorState
          message={fatalError}
          onRetry={() => loadData({ soft: false })}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="home-screen" style={styles.safe}>
      {/* Header */}
      <Header
        companyName={company?.name ?? t('home.myCompany')}
        fyYear={activeFY}
        notificationCount={notifCount}
        userName={user?.name || t('home.user')}
        lastSyncTime={lastSyncTime ?? undefined}
        onFYChange={handleFYChange}
        onSettingsPress={() => safePush(router, '/settings' as any)}
      />

      {/* ── Real Search Bar ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SearchBar
          testID="search-bar"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('dashboard.searchPlaceholder')}
          style={{ marginTop: 8, marginBottom: 8 }}
        />
      </KeyboardAvoidingView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status banners */}
        {invitations?.length > 0 && (
          <TouchableOpacity
            onPress={() => safePush(router, '/settings/invitations')}
            style={{
              marginHorizontal: SPACING.md, marginTop: 8, marginBottom: 4,
              padding: 12, borderRadius: 10, backgroundColor: '#EFF6FF',
              borderWidth: 1, borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Ionicons name="mail-unread-outline" size={18} color="#2563EB" />
            <Text style={{ flex: 1, color: '#1E40AF', fontWeight: '600', fontSize: 13 }}>
              {invitations.length} workspace invitation{invitations.length > 1 ? 's' : ''} — tap to accept
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#2563EB" />
          </TouchableOpacity>
        )}
        {demoMode && <PairingBanner />}
        {!deviceOnline && (
          <OfflineBadge
            variant="device"
            onRetry={() => loadData({ soft: hasDashboardDataRef.current })}
          />
        )}
        {deviceOnline && tallyConnected && !isDesktopOnline && <OfflineBadge variant="desktop" />}
        {pageBanner && (
          <ErrorBanner
            message={pageBanner}
            onRetry={() => loadData({ soft: hasDashboardDataRef.current })}
          />
        )}

        {/* KPI Carousel — explicit height: nested horizontal FlatList collapses to 0 inside ScrollView on web/some RN */}
        <View style={styles.kpiSection}>
          {isLoading ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.md, gap: 12, height: 72 }}>
              {[0, 1, 2].map(i => <KPICardSkeleton key={i} />)}
            </View>
          ) : !companyGuid || !dataReady ? (
            <View style={styles.kpiEmpty}>
              <Text style={styles.kpiEmptyText}>
                {tallyConnected
                  ? t(
                      'home.noCompanySynced',
                      'No active Tally companies found. Check the company/FY selection in TallyDekho Desktop and sync again.'
                    )
                  : demoMode
                    ? t('home.loadingDemo', 'Loading demo books…')
                    : t('home.noCompanyKpi', 'No company synced yet')}
              </Text>
            </View>
          ) : kpiData.length === 0 ? (
            <View style={styles.kpiEmpty}>
              <Text style={styles.kpiEmptyText}>{t('home.kpiUnavailable', 'KPI unavailable')}</Text>
              <TouchableOpacity onPress={() => loadData({ soft: true })} hitSlop={8}>
                <Text style={styles.kpiEmptyRetry}>{t('common.retry', 'Retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={kpiRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              style={styles.kpiListHost}
              data={kpiData}
              keyExtractor={i => i.id}
              renderItem={renderKPI}
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
              onScrollToIndexFailed={() => {}}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
                setKpiIdx(idx);
              }}
              contentContainerStyle={styles.kpiList}
            />
          )}
          {/* Dot Indicators */}
          {!isLoading && Array.isArray(kpiData) && kpiData.length > 0 && (
            <KPICarouselDots count={kpiData.length} activeIndex={kpiIdx} />
          )}
        </View>

        {/* Time Filters */}
        <View style={styles.filterWrap}>
          <View style={styles.filterRow}>
            {TIME_FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                testID={`filter-${f}`}
                style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
                onPress={() => handleFilterChange(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                  {f === '7D' ? t('dashboard.filter7D') : f === '1M' ? t('dashboard.filter1M') : f === '3M' ? t('dashboard.filter3M') : t('dashboard.filter6M')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <ModuleTiles metrics={Array.isArray(metrics) ? metrics : []} isLoading={isLoading} />

        {/* Cashflow Card — section error + Retry on fail */}
        {isLoading ? (
          <CardSkeleton height={200} />
        ) : cashflowError && !cashflow ? (
          <SectionError
            message={cashflowError}
            onRetry={() => loadData({ soft: true })}
          />
        ) : (
          <>
            {cashflowError ? (
              <SectionError
                message={cashflowError}
                onRetry={() => loadData({ soft: true })}
              />
            ) : null}
            <CashflowCard {...(cashflow || {})} />
          </>
        )}

        {/* Recent Activity — local unavailable only (not page banner alone) */}
        {isLoading ? (
          <View style={styles.metricsCard}>
            {[0, 1, 2, 3, 4].map(i => <ActivityRowSkeleton key={i} />)}
          </View>
        ) : isSearching ? (
          searchLoading ? (
            <View style={styles.metricsCard}>
              {[0, 1, 2].map(i => <ActivityRowSkeleton key={i} />)}
            </View>
          ) : (
            <RecentActivity activities={searchActivities} title={t('dashboard.searchResults')} />
          )
        ) : (
          <RecentActivity
            activities={activity}
            unavailable={activityError}
            onRetry={() => loadData({ soft: true })}
          />
        )}

        {isSearching && !searchLoading && searchActivities.length === 0 && (
          <View style={styles.emptySearch}>
            <Ionicons name="search" size={32} color={COLORS.textTertiary} />
            <Text style={styles.emptySearchText}>{t('dashboard.noResults', { query: searchQuery })}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { flex: 1 },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.brandPrimary,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    borderRadius: RADIUS.lg, padding: 14,
  },
  syncBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  syncIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  syncTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  syncSubtitle: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  kpiSection: { marginTop: SPACING.md, minHeight: 72 },
  kpiListHost: { height: 72, flexGrow: 0 },
  kpiList: { paddingHorizontal: 0, alignItems: 'center' },
  kpiEmpty: {
    height: 72,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  kpiEmptyText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  kpiEmptyRetry: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  filterWrap: { paddingHorizontal: SPACING.md, marginTop: SPACING.md },
  filterRow: {
    flexDirection: 'row', backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'flex-start', gap: 2,
  },
  filterTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full },
  filterTabActive: { backgroundColor: COLORS.cardBg, elevation: 2, boxShadow: '0 0 4px rgba(0, 0, 0, 0.08)' },
  filterText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: COLORS.textPrimary, fontWeight: '700' },
  metricsCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  metricRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  metricLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricIconBox: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  metricLabel: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  metricRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  changeText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
  metricSep: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 58 },
  alertBanner: { display: 'none' as any },
  alertText: { display: 'none' as any },
  alertAction: { display: 'none' as any },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 10 },
  secTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  modulesGrid: { paddingHorizontal: SPACING.md, gap: 8 },
  moduleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  moduleIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  moduleLabel: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },

  // ── Empty search state ────────────────────────────────────────────────────
  emptySearch: { alignItems: 'center' as const, paddingVertical: 40, gap: 10 },
  emptySearchText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
