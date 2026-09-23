import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { safePush } from '../../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getStocks } from '../../src/services/api';
import { LoadingState, ErrorState, EmptyState } from '../../src/components/ApiStateViews';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { currentTenantKey, lowStockToPoPrefillFeature } from '../../src/utils/tenantStorage';

type Priority = 'critical' | 'high' | 'medium' | 'low';

type ReorderItem = {
  id: string;
  name: string;
  displayName?: string;
  sku: string;
  unit: string;
  rate: string;
  current: number;
  reorderAt: number;
  suggest: number;
  priority: Priority;
  warehouse: string;
};

function calcPriority(current: number, reorderAt: number): Priority {
  if (current <= 0) return 'critical';
  const ratio = current / reorderAt;
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 0.50) return 'high';
  if (ratio <= 1.00) return 'medium';
  return 'low';
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; barColor: string }> = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2', barColor: '#DC2626' },
  high:     { label: 'High',     color: '#A89060', bg: '#F8F4EE', barColor: '#1A1A1A' },
  medium:   { label: 'Medium',   color: '#2D7D46', bg: '#F0FBF4', barColor: '#2D7D46' },
  low:      { label: 'Low',      color: '#6B7280', bg: '#F3F4F6', barColor: '#AEACA8' },
};

type FilterType = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

function stockRateString(r: any): string {
  const n = parseFloat(r.closing_rate ?? r.rate ?? r.opening_rate ?? '');
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

export default function ReorderQueueScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [items, setItems] = useState<ReorderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  const loadItems = useCallback(() => {
    if (!companyGuid) return;
    setLoading(true);
    setError(null);
    // Server filters reorder (item or group reorder_level) — full list, not truncated client slice
    getStocks(companyGuid, { limit: '5000', stockHealth: 'reorder' })
      .then((res: any) => {
        const rows: any[] = res?.data?.items || res?.data || [];
        const mapped: ReorderItem[] = rows.map((r: any) => {
          const qty = parseFloat(r.closing_qty ?? 0);
          const itemReorder = parseFloat(r.reorder_level ?? 0);
          const groupReorder = parseFloat(r.group_reorder_level ?? 0);
          const reorder = itemReorder > 0 ? itemReorder : groupReorder;
          const avgDaily = parseFloat(r.avg_daily_consumption ?? 0);
          const deficit = Math.max(reorder - qty, 0);
          const suggest = avgDaily > 0
            ? Math.ceil(avgDaily * 30) + deficit
            : Math.max(reorder * 2 - qty, reorder);
          return {
            id: r.guid || String(r.id),
            name: r.name || '—',
            displayName: r.displayName || undefined,
            sku: r.sku || r.alias || '',
            unit: r.unit || 'pcs',
            rate: stockRateString(r),
            current: qty,
            reorderAt: reorder,
            suggest: Math.round(suggest),
            priority: calcPriority(qty, reorder || 1),
            warehouse: r.primary_warehouse || r.group_name || '—',
          };
        });
        setItems(mapped);
      })
      .catch(() => setError('Failed to load reorder queue'))
      .finally(() => setLoading(false));
  }, [companyGuid]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openPoWithItems = useCallback(async (selected: ReorderItem[]) => {
    if (!companyGuid || !selected.length) return;
    try {
      const payload = {
        savedAt: Date.now(),
        items: selected.map(it => ({
          product: it.name,
          qty: '0',
          unit: it.unit || 'pcs',
          rate: it.rate || '',
          warehouse: '',
          discountType: '%' as const,
          discount: '0',
          taxEntries: [],
        })),
      };
      await AsyncStorage.setItem(
        currentTenantKey(companyGuid, lowStockToPoPrefillFeature()),
        JSON.stringify(payload),
      );
      safePush(router, '/purchase/create-order' as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not open PO', text2: e?.message || '' });
    }
  }, [companyGuid, router]);

  const filtered = activeFilter === 'All'
    ? items
    : items.filter(i => i.priority === activeFilter.toLowerCase());

  const criticalCount = items.filter(i => i.priority === 'critical').length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title={t('stocks.reorder')}
        onBack={() => router.back()}
        right={criticalCount > 0 ? (
          <View style={styles.criticalBadge}>
            <Text style={styles.criticalText}>{criticalCount}</Text>
          </View>
        ) : undefined}
      />

      <View style={styles.summaryRow}>
        {[
          { label: 'Critical', count: items.filter(i => i.priority === 'critical').length, color: '#DC2626' },
          { label: 'High',     count: items.filter(i => i.priority === 'high').length,     color: '#A89060' },
          { label: 'Medium',   count: items.filter(i => i.priority === 'medium').length,   color: '#2563EB' },
          { label: 'Total',    count: items.length,                                        color: COLORS.textPrimary },
        ].map(s => (
          <View key={s.label} style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.filterRow}>
        {(['All', 'Critical', 'High', 'Medium', 'Low'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && <LoadingState message="Loading reorder queue…" />}
      {!loading && error && <ErrorState message={error} onRetry={loadItems} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState title="No items below reorder level" subtitle="All stock levels are healthy" icon="checkmark-circle-outline" />
      )}
      {!loading && !error && items.length > 0 && (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {filtered.map(item => {
            const p = PRIORITY_CONFIG[item.priority as Priority];
            const progressPct = item.reorderAt > 0 ? Math.round((item.current / item.reorderAt) * 100) : 0;
            return (
              <EntityListTile
                key={item.id}
                name={item.displayName || item.name}
                subtitle={[item.sku, item.warehouse].filter(Boolean).join(' · ')}
                borderRadius={RADIUS.lg}
                trailing={(
                  <View style={[styles.priorityBadge, { backgroundColor: p.bg }]}>
                    <Text style={[styles.priorityText, { color: p.color }]}>{p.label}</Text>
                  </View>
                )}
                footer={(
                  <>
                    <View style={styles.progressSection}>
                      <View style={styles.statsRow}>
                        <Text style={styles.statLabel}>
                          Current: <Text style={{ fontWeight: '700', color: item.current === 0 ? '#DC2626' : COLORS.textPrimary }}>{item.current}</Text>
                        </Text>
                        <Text style={styles.statLabel}>
                          Reorder at: <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{item.reorderAt}</Text>
                        </Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, {
                          width: `${Math.min(progressPct, 100)}%` as any,
                          backgroundColor: item.current === 0 ? '#DC2626' : p.barColor,
                        }]} />
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <Text style={styles.suggText}>
                        Suggest: <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>{item.suggest} units</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.reorderBtn}
                        activeOpacity={0.8}
                        onPress={() => openPoWithItems([item])}
                      >
                        <Ionicons name="cart-outline" size={13} color={COLORS.white} />
                        <Text style={styles.reorderBtnText}>Add to PO</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              />
            );
          })}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  criticalBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  criticalText: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: '#DC2626' },
  summaryRow: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 10,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: TYPOGRAPHY.xl, fontWeight: '800' },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 6,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  filterTextActive: { color: COLORS.white },
  scroll: { flex: 1 },
  content: { padding: SPACING.md, gap: 10 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  priorityText: { fontSize: 10, fontWeight: '700' },
  progressSection: { marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  progressTrack: { height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  reorderBtnText: { fontSize: TYPOGRAPHY.xs, color: COLORS.white, fontWeight: '700' },
});
