import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, RefreshControl, FlatList, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import Header from '../../src/components/Header';
import QuickActionsModal from '../../src/components/QuickActionsModal';
import CashflowCard from '../../src/components/CashflowCard';
import RecentActivity from '../../src/components/RecentActivity';
import {
  getKPIStrip, getMetrics, getCashflow, getRecentActivity
} from '../../src/services/api';
import {
  MOCK_KPI_STRIP, MOCK_METRICS, MOCK_CASHFLOW, MOCK_RECENT_ACTIVITY, MOCK_USER
} from '../../src/data/mockData';

const TIME_FILTERS = ['7D', '1M', '3M', '6M'] as const;
type TimeFilter = typeof TIME_FILTERS[number];

export default function HomeScreen() {
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('7D');
  const [kpiData, setKpiData] = useState(MOCK_KPI_STRIP);
  const [metrics, setMetrics] = useState(MOCK_METRICS);
  const [cashflow, setCashflow] = useState(MOCK_CASHFLOW);
  const [activity, setActivity] = useState(MOCK_RECENT_ACTIVITY);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [kpi, met, cf, act] = await Promise.all([
      getKPIStrip(),
      getMetrics(activeFilter),
      getCashflow(),
      getRecentActivity(),
    ]);
    setKpiData(kpi as any);
    setMetrics(met as any);
    setCashflow(cf as any);
    setActivity(act as any);
    setLoading(false);
  }, [activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderKPI = ({ item }: any) => (
    <TouchableOpacity testID={`kpi-card-${item.id}`} style={styles.kpiCard} activeOpacity={0.7}>
      <View style={styles.kpiIconBox}>
        <Ionicons name={item.icon} size={20} color={COLORS.textSecondary} />
      </View>
      <Text style={styles.kpiLabel} numberOfLines={1}>{item.label}</Text>
      <Text style={styles.kpiAmount} numberOfLines={1}>{item.amount}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView testID="home-screen" style={styles.safe}>
      {/* Header */}
      <Header
        companyName={MOCK_USER.company}
        fyYear={MOCK_USER.fyYear}
        notificationCount={1}
        onMenuPress={() => setShowQuickActions(true)}
      />

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <TouchableOpacity testID="search-bar" style={styles.searchBar} activeOpacity={0.7}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <Text style={styles.searchPlaceholder}>Search for recent transactions...</Text>
          <Ionicons name="mic-outline" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {/* Tally Sync Banner */}
        <TouchableOpacity testID="sync-banner" style={styles.syncBanner} activeOpacity={0.8}>
          <View style={styles.syncBannerLeft}>
            <View style={styles.syncIconBox}>
              <Ionicons name="sync" size={18} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.syncTitle}>Sync your account with Tally!</Text>
              <Text style={styles.syncSubtitle}>Sync for seamless management!</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* KPI Horizontal Strip */}
        <View style={styles.kpiSection}>
          <FlatList
            horizontal
            data={kpiData}
            keyExtractor={i => i.id}
            renderItem={renderKPI}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiList}
          />
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
                <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Metrics Card */}
        <View style={styles.metricsCard}>
          {metrics.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                testID={`metric-row-${item.id}`}
                style={styles.metricRow}
                activeOpacity={0.7}
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
          ))}
        </View>

        {/* Cashflow Card */}
        <CashflowCard {...cashflow} />

        {/* Recent Activity */}
        <RecentActivity activities={activity} />

        {/* IRN Alert Banner */}
        <View testID="irn-alert" style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
          <Text style={styles.alertText}>14 invoices due for IRN generation</Text>
          <TouchableOpacity testID="irn-generate-btn" activeOpacity={0.7}>
            <Text style={styles.alertAction}>Generate now</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB Quick Actions Button */}
      <TouchableOpacity
        testID="fab-quick-actions"
        style={styles.fab}
        onPress={() => setShowQuickActions(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      <QuickActionsModal
        visible={showQuickActions}
        onClose={() => setShowQuickActions(false)}
      />
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
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchPlaceholder: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  scroll: { flex: 1 },

  // Sync Banner
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

  // KPI Strip
  kpiSection: { marginTop: SPACING.md },
  kpiList: { paddingHorizontal: SPACING.md, gap: 10 },
  kpiCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 14, width: 140, gap: 6,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    elevation: 1, shadowColor: COLORS.black, shadowOpacity: 0.04, shadowRadius: 4,
  },
  kpiIconBox: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  kpiAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  // Time Filter
  filterWrap: { paddingHorizontal: SPACING.md, marginTop: SPACING.md },
  filterRow: {
    flexDirection: 'row', backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'flex-start', gap: 2,
  },
  filterTab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full },
  filterTabActive: { backgroundColor: COLORS.cardBg, elevation: 2, shadowColor: COLORS.black, shadowOpacity: 0.08, shadowRadius: 4 },
  filterText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // Metrics
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

  // Alert
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.warningBg,
    marginHorizontal: SPACING.md, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#FDE68A',
    marginBottom: SPACING.md,
  },
  alertText: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.warning, fontWeight: '500' },
  alertAction: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '700' },

  // FAB
  fab: {
    position: 'absolute', bottom: 80, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: COLORS.black, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
