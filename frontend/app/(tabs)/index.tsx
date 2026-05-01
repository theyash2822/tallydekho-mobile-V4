import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, FlatList, AppState, TextInput,
  Modal, Animated, KeyboardAvoidingView, Platform, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import ShimmerPlaceholder, { KPICardSkeleton, MetricCardSkeleton, ActivityRowSkeleton, CardSkeleton } from '../../src/components/ShimmerPlaceholder';

const { width: SW } = Dimensions.get('window');
import Header from '../../src/components/Header';
import CashflowCard from '../../src/components/CashflowCard';
import RecentActivity from '../../src/components/RecentActivity';
import PairingBanner from '../../src/components/PairingBanner';
import OfflineBadge from '../../src/components/OfflineBadge';
import {
  getKPIStrip, getMetrics, getCashflow, getRecentActivity, getTallySyncStatus, getNotifications,
} from '../../src/services/api';
import Toast from 'react-native-toast-message';
// No mock data imports — real data only (V2 rule)

const TIME_FILTERS = ['7D', '1M', '3M', '6M'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

const MODULE_CARDS = [
  { id: 'sales',    label: 'Sales',    icon: 'trending-up',   route: '/sales',    color: '#2D7D46', bg: '#F0FBF4' },
  { id: 'purchase', label: 'Purchase', icon: 'cart',          route: '/purchase', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'voucher',  label: 'Vouchers', icon: 'card',          route: '/voucher',  color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'expenses', label: 'Expenses', icon: 'receipt-outline', route: '/expenses', color: '#DC2626', bg: '#FDECEA' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings', color: '#D97706', bg: '#FFFBEB' },
] as const;

const MOCK_VOICE_SEARCHES = ['Sales Invoice', 'Mehta Enterprises', 'Payment Received', 'Kumar Trading'];

export default function HomeScreen() {
  const router = useRouter();
  const { isPaired, isDesktopOnline, company, user, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const [activeFY, setActiveFY] = useState('');
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('7D');
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);
  const wasPaired = useRef(false); // track previous isPaired to detect change
  // isPaired comes from AuthContext — no local state needed
  const isTallyPaired = isPaired;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showMicModal, setShowMicModal] = useState(false);
  const micScale = useRef(new Animated.Value(1)).current;
  const micOpacity = useRef(new Animated.Value(0.7)).current;
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // KPI Carousel
  const kpiRef  = useRef<FlatList>(null);
  const [kpiIdx, setKpiIdx] = useState(0);
  const [autoScrollCarousel, setAutoScrollCarousel] = useState(true);

  useEffect(() => {
    if (!autoScrollCarousel) return;
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

  // ── Auto-scroll preference ──────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('autoScrollCarousel').then(val => {
      setAutoScrollCarousel(val === null ? true : val !== 'false');
    });
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);

  // Parse 'FY YYYY-YY' label into ISO date range for API calls
  const parseFYDates = useCallback((fyLabel: string) => {
    const match = fyLabel?.match(/FY (\d{4})-(\d{2})/);
    if (!match) return null;
    const startYear = parseInt(match[1]);
    const endYear = startYear + 1;
    return { from: `${startYear}-04-01`, to: `${endYear}-03-31` };
  }, []);

  const handleFYChange = useCallback((fy: string) => {
    setActiveFY(fy);
    // FY change triggers loadData via useEffect (activeFY dep), no manual mock needed
  }, []);

  const loadData = useCallback(async () => {
    // ── DATA GATE ──────────────────────────────────────────────
    // Unpaired: show demo data immediately, no API calls.
    // Paired: fetch real data and show skeletons while loading.
    // ─────────────────────────────────────────────────
    if (!isPaired) {
      // Not paired: show empty state, no mock data
      setKpiData([]);
      setMetrics([]);
      setCashflow(null);
      setActivity([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Prefer context selectedFY (has real startDate/endDate from API),
      // fall back to parseFYDates for label-based parsing
      const from = selectedFY?.startDate ?? parseFYDates(activeFY)?.from;
      const to   = selectedFY?.endDate   ?? parseFYDates(activeFY)?.to;

      const [kpi, met, cf, act] = await Promise.all([
        getKPIStrip(companyGuid, activeFilter, from, to),
        getMetrics(companyGuid, activeFilter, from, to),
        getCashflow(companyGuid, activeFilter, from, to),
        getRecentActivity(companyGuid),
      ]);

      const kpiArr = Array.isArray(kpi) ? kpi : (kpi as any)?.data ?? [];
      const metArr = Array.isArray(met) ? met : (met as any)?.data ?? [];
      if (kpiArr.length > 0) setKpiData(kpiArr as any);
      if (metArr.length > 0) setMetrics(metArr as any);

      // Cashflow: extract inner data object
      if (cf) {
        const cfData = (cf as any)?.data ?? cf;
        if (cfData && typeof cfData === 'object' && !('success' in cfData)) setCashflow(cfData as any);
        else if ((cf as any)?.data) setCashflow((cf as any).data as any);
      }

      const actArr = Array.isArray(act) ? act : (act as any)?.data ?? [];
      if (actArr.length > 0) setActivity(actArr as any);
    } finally {
      setIsLoading(false);
    }
  }, [isPaired, activeFilter, activeFY, companyGuid, parseFYDates, selectedFY]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Detect pairing state change ─────────────────────────────
  // When device is paired: show toast + fetch last sync time + refresh notifications
  useEffect(() => {
    if (isPaired && !wasPaired.current) {
      Toast.show({
        type: 'success',
        text1: 'Tally Connected ✅',
        text2: 'Your desktop is now paired. Loading real data...',
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
    if (!isPaired && wasPaired.current) {
      Toast.show({ type: 'info', text1: 'Tally Disconnected', text2: 'Device was unpaired.', visibilityTime: 3000 });
      setLastSyncTime(null);
    }
    wasPaired.current = isPaired;
  }, [isPaired]);

  // ── Fetch real notification count ─────────────────────────────
  useEffect(() => {
    if (!isPaired || !companyGuid) return;
    getNotifications(companyGuid).then((res: any) => {
      const notifs = res?.data ?? res ?? [];
      setNotifCount(Array.isArray(notifs) ? notifs.length : 0);
    }).catch(() => {});
  }, [isPaired, companyGuid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(); // isPaired comes from AuthContext, no separate checkPaired needed
    setRefreshing(false);
  };

  // ── Mic / Voice search ───────────────────────────────────────────────────
  const startMicAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(micScale, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(micOpacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(micScale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(micOpacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start();
  };

  const handleMicPress = () => {
    // Haptic / vibration feedback so user knows the button was tapped
    Vibration.vibrate(80);
    // Dismiss keyboard before showing mic modal
    setSearchFocused(false);
    // Short delay so keyboard dismissal doesn't fight the modal
    setTimeout(() => {
      setShowMicModal(true);
      startMicAnimation();
      if (micTimerRef.current) clearTimeout(micTimerRef.current);
      micTimerRef.current = setTimeout(() => {
        setShowMicModal(false);
        micScale.stopAnimation(); micScale.setValue(1);
        micOpacity.stopAnimation(); micOpacity.setValue(0.7);
        const pick = MOCK_VOICE_SEARCHES[Math.floor(Math.random() * MOCK_VOICE_SEARCHES.length)];
        setSearchQuery(pick);
        setSearchFocused(true);
      }, 2500);
    }, 100);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchFocused(false);
    if (micTimerRef.current) clearTimeout(micTimerRef.current);
  };

  // ── KPI row render ────────────────────────────────────────────────────────
  const renderKPI = ({ item }: any) => (
    <View style={styles.kpiItem}>
      <TouchableOpacity
        testID={`kpi-card-${item.id}`}
        style={styles.kpiCard}
        activeOpacity={0.7}
        onPress={() => item.route && router.push(item.route as any)}
      >
        {/* Left: Icon circle */}
        <View style={styles.kpiIconBox}>
          <Ionicons name={item.icon} size={22} color={COLORS.textSecondary} />
        </View>

        {/* Middle: Label + Amount stacked — flex:1 so never clips */}
        <View style={styles.kpiTextWrap}>
          <Text style={styles.kpiLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.kpiAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
        </View>

        {/* Right: Trend badge */}
        {item.trend && (
          <View style={[styles.kpiTrendBadge, { backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg }]}>
            <Ionicons
              name={item.positive ? 'trending-up' : 'trending-down'}
              size={11}
              color={item.positive ? COLORS.positive : COLORS.negative}
            />
            <Text style={[styles.kpiTrendTxt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
              {item.trend}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const isSearching = searchQuery.trim().length > 0;

  return (
    <SafeAreaView testID="home-screen" style={styles.safe}>
      {/* Header */}
      <Header
        companyName={company?.name ?? 'My Company'}
        fyYear={activeFY}
        notificationCount={notifCount}
        userName={user?.name || 'User'}
        lastSyncTime={lastSyncTime ?? undefined}
        onFYChange={handleFYChange}
        onSettingsPress={() => router.push('/settings' as any)}
      />

      {/* ── Real Search Bar ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
            <Ionicons name="search" size={16} color={searchFocused ? COLORS.brandPrimary : COLORS.textTertiary} />
            <TextInput
              testID="search-bar"
              style={styles.searchInput}
              placeholder="Search transactions, parties..."
              placeholderTextColor={COLORS.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { if (!searchQuery) setSearchFocused(false); }}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleMicPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="mic-outline" size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tally Sync Banner */}
        {/* Status banners — one or the other, never both */}
        {!isPaired && <PairingBanner />}
        {isPaired && !isDesktopOnline && <OfflineBadge />}

        {/* KPI Carousel */}
        <View style={styles.kpiSection}>
          {isLoading ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: SPACING.md, gap: 12 }}>
              {[0, 1, 2].map(i => <KPICardSkeleton key={i} />)}
            </View>
          ) : (
            <FlatList
              ref={kpiRef}
              horizontal
              pagingEnabled
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
          {!isLoading && Array.isArray(kpiData) && (
            <View style={styles.kpiDots}>
              {kpiData.map((_, i) => (
                <View key={i} style={[styles.kpiDot, i === kpiIdx && styles.kpiDotActive]} />
              ))}
            </View>
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
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                  {f === '7D' ? '7 Days' : f === '1M' ? '1 Month' : f === '3M' ? '3 Months' : '6 Months'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Metrics Card */}
        <View style={styles.metricsCard}>
          {isLoading ? (
            <>
              {[0, 1, 2, 3].map(i => (
                <View key={i}>
                  <View style={[styles.metricRow, { gap: 12 }]}>
                    <ShimmerPlaceholder width={32} height={32} borderRadius={8} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <ShimmerPlaceholder width="55%" height={11} borderRadius={5} />
                      <ShimmerPlaceholder width="75%" height={14} borderRadius={6} />
                    </View>
                    <ShimmerPlaceholder width={64} height={20} borderRadius={8} />
                  </View>
                  {i < 3 && <View style={styles.metricSep} />}
                </View>
              ))}
            </>
          ) : (
            (Array.isArray(metrics) ? metrics : []).map((item: any, idx: number) => (
              <View key={item.id}>
                <TouchableOpacity
                  testID={`metric-row-${item.id}`}
                  style={styles.metricRow}
                  activeOpacity={0.7}
                  onPress={() => (item as any).route && router.push((item as any).route)}
                >
                  <View style={styles.metricLeft}>
                    <View style={styles.metricIconBox}>
                      <Ionicons name={item.icon as any} size={18} color={COLORS.textSecondary} />
                    </View>
                    <Text style={styles.metricLabel}>{item.label}</Text>
                  </View>
                  <View style={styles.metricRight}>
                    <Text style={styles.metricAmount}>{item.amount}</Text>
                    <View style={[
                      styles.changeBadge,
                      { backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg }
                    ]}>
                      <Ionicons
                        name={item.positive ? 'trending-up' : 'trending-down'}
                        size={11}
                        color={item.positive ? COLORS.positive : COLORS.negative}
                      />
                      <Text style={[
                        styles.changeText,
                        { color: item.positive ? COLORS.positive : COLORS.negative }
                      ]}>
                        {item.change}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {idx < metrics.length - 1 && <View style={styles.metricSep} />}
              </View>
            ))
          )}
        </View>

        {/* Cashflow Card */}
        {isLoading
          ? <CardSkeleton height={200} />
          : <CashflowCard {...cashflow} />
        }

        {/* Recent Activity — filtered when searching */}
        {isLoading ? (
          <View style={styles.metricsCard}>
            {[0, 1, 2, 3, 4].map(i => <ActivityRowSkeleton key={i} />)}
          </View>
        ) : (
          <RecentActivity activities={isSearching ? filteredActivity : activity} />
        )}

        {isSearching && filteredActivity.length === 0 && (
          <View style={styles.emptySearch}>
            <Ionicons name="search" size={32} color={COLORS.textTertiary} />
            <Text style={styles.emptySearchText}>No results for "{searchQuery}"</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Mic "Speak Now" Modal ── */}
      <Modal visible={showMicModal} transparent animationType="fade" onRequestClose={() => { setShowMicModal(false); clearSearch(); }}>
        <TouchableOpacity style={styles.micBackdrop} activeOpacity={1} onPress={() => { setShowMicModal(false); clearSearch(); }}>
          <View style={styles.micCard}>
            {/* Pulsing ring */}
            <View style={styles.micRingOuter}>
              <Animated.View style={[styles.micRingPulse, { transform: [{ scale: micScale }], opacity: micOpacity }]} />
              <View style={styles.micCircle}>
                <Ionicons name="mic" size={32} color={COLORS.white} />
              </View>
            </View>
            <Text style={styles.micListeningText}>Listening...</Text>
            <Text style={styles.micHint}>Speak now to search</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  searchWrap: { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
  },
  searchBarFocused: { borderColor: COLORS.brandPrimary },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary,
    paddingVertical: 0,
  },
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
  kpiSection: { marginTop: SPACING.md },
  kpiList: { paddingHorizontal: 0 },
  kpiItem: {
    width: SW,                          // exact page width — fixes carousel snap
  },
  kpiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: SPACING.md,       // visual indent inside the page
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  kpiIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  kpiTextWrap: { flex: 1, gap: 2 },      // flex:1 ensures label+amount never clip
  kpiLabel:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount:  { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  kpiTrendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  kpiTrendTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  kpiDots:        { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 2 },
  kpiDot:         { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  kpiDotActive:   { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },
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

  // ── Mic Modal ─────────────────────────────────────────────────────────────
  micBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center' as const, justifyContent: 'flex-end' as const, paddingBottom: 80,
  },
  micCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl, padding: 36,
    alignItems: 'center' as const, gap: 12, width: 220,
  },
  micRingOuter: {
    alignItems: 'center' as const, justifyContent: 'center' as const, width: 100, height: 100,
  },
  micRingPulse: {
    position: 'absolute' as const,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.brandPrimary,
  },
  micCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  micListeningText: { fontSize: TYPOGRAPHY.md, fontWeight: '700' as const, color: COLORS.textPrimary },
  micHint: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
