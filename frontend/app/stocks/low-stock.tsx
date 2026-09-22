/**
 * Low Stock — settings-driven list (default_low_stock_level).
 * Low: 0 < qty ≤ T | Out: qty === 0 | multi-select → PO with qty 0.
 * Does not use Tally reorder_level (that stays on Reorder Queue).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useAuth } from '../../src/context/AuthContext';
import { getInventorySettings, getStocks } from '../../src/services/api';
import { safePush } from '../../src/utils/safeNavigation';
import { currentTenantKey, lowStockToPoPrefillFeature } from '../../src/utils/tenantStorage';
import { useTranslation } from 'react-i18next';

type Bucket = 'all' | 'low' | 'out';

type LowStockRow = {
  id: string;
  name: string;
  displayName: string;
  sku: string;
  category: string;
  qty: number;
  unit: string;
  rate: string;
  kind: 'low' | 'out';
};

const TABS: { key: Bucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Out of stock' },
];

function stockRateString(r: any): string {
  const n = parseFloat(r.closing_rate ?? r.rate ?? r.opening_rate ?? '');
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

function ItemCard({
  item,
  threshold,
  multiSelectMode,
  selected,
  onPress,
  onLongPress,
  onAddToPo,
}: {
  item: LowStockRow;
  threshold: number;
  multiSelectMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onAddToPo: () => void;
}) {
  const isOut = item.kind === 'out';
  const barPct = !isOut && threshold > 0
    ? Math.min(Math.round((item.qty / threshold) * 100), 100)
    : 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={[s.card, selected && s.cardSelected]}
    >
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          {multiSelectMode && (
            <View style={[s.check, selected && s.checkOn]}>
              {selected ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.itemName} numberOfLines={2}>{item.displayName || item.name}</Text>
            <Text style={s.itemMeta}>
              {item.sku ? `${item.sku} · ` : ''}{item.category || '—'}
            </Text>
          </View>
        </View>
        <View style={[s.tag, isOut ? s.tagOut : s.tagLow]}>
          <Text style={[s.tagTxt, isOut ? s.tagOutTxt : s.tagLowTxt]}>
            {isOut ? 'Out' : 'Low'}
          </Text>
        </View>
      </View>

      {isOut ? (
        <Text style={s.bodyLine}>Qty 0{item.unit ? ` ${item.unit}` : ''}</Text>
      ) : (
        <>
          <View style={s.statsRow}>
            <Text style={s.bodyLine}>
              Qty: <Text style={s.bodyStrong}>{item.qty}</Text>
              {item.unit ? ` ${item.unit}` : ''}
            </Text>
            <Text style={s.bodyLine}>
              Low at ≤ <Text style={s.bodyStrong}>{threshold}</Text>
            </Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${barPct}%` as any }]} />
          </View>
        </>
      )}

      {!multiSelectMode && (
        <View style={s.cardActions}>
          <Text style={s.rateHint}>
            {item.rate ? `Rate ₹${item.rate}` : 'Rate —'}
          </Text>
          <TouchableOpacity style={s.poBtn} onPress={onAddToPo} activeOpacity={0.85}>
            <Ionicons name="cart-outline" size={13} color={COLORS.white} />
            <Text style={s.poBtnTxt}>Add to PO</Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}

export default function LowStockScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [threshold, setThreshold] = useState(20);
  const [rows, setRows] = useState<LowStockRow[]>([]);
  const [bucket, setBucket] = useState<Bucket>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = useCallback(() => {
    if (!companyGuid) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setApiError(null);
    Promise.all([
      getInventorySettings(companyGuid).catch(() => null),
      getStocks(companyGuid, { limit: '1000' }),
    ])
      .then(([settingsRes, stocksRes]: any[]) => {
        const settings =
          settingsRes?.data?.settings
          ?? settingsRes?.settings
          ?? settingsRes?.data
          ?? {};
        const T = Math.max(
          0,
          parseInt(String(settings.default_low_stock_level ?? 20), 10) || 20,
        );
        setThreshold(T);

        const raw: any[] = stocksRes?.data?.items ?? stocksRes?.data ?? [];
        const mapped: LowStockRow[] = [];
        for (const r of raw) {
          const qty = parseFloat(r.closing_qty ?? 0);
          if (!Number.isFinite(qty)) continue;
          const id = String(r.guid || r.id || r.name);
          const base = {
            id,
            name: r.name || '—',
            displayName: r.displayName || r.name || '—',
            sku: r.sku || r.alias || '',
            category: r.category || r.group_name || 'Other',
            qty,
            unit: r.unit || '',
            rate: stockRateString(r),
          };
          if (qty === 0) {
            mapped.push({ ...base, kind: 'out' });
          } else if (qty > 0 && qty <= T) {
            mapped.push({ ...base, kind: 'low' });
          }
        }
        mapped.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'out' ? -1 : 1;
          return a.qty - b.qty || a.displayName.localeCompare(b.displayName);
        });
        setRows(mapped);
      })
      .catch((e: any) => setApiError(e?.message || 'Failed to load low stock'))
      .finally(() => setIsLoading(false));
  }, [companyGuid]);

  useEffect(() => { load(); }, [load]);

  const lowCount = useMemo(() => rows.filter(r => r.kind === 'low').length, [rows]);
  const outCount = useMemo(() => rows.filter(r => r.kind === 'out').length, [rows]);

  const filtered = useMemo(() => {
    if (bucket === 'low') return rows.filter(r => r.kind === 'low');
    if (bucket === 'out') return rows.filter(r => r.kind === 'out');
    return rows;
  }, [rows, bucket]);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedIds([]);
  }, []);

  const handleLongPress = useCallback((id: string) => {
    setMultiSelectMode(true);
    setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const handlePress = useCallback((item: LowStockRow) => {
    if (multiSelectMode) {
      setSelectedIds(prev =>
        prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id],
      );
      return;
    }
    safePush(router, `/stocks/item-detail?id=${encodeURIComponent(item.id)}` as any);
  }, [multiSelectMode, router]);

  const openPoWithItems = useCallback(async (items: LowStockRow[]) => {
    if (!companyGuid || !items.length) return;
    try {
      const payload = {
        savedAt: Date.now(),
        items: items.map(it => ({
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
      exitMultiSelect();
      safePush(router, '/purchase/create-order' as any);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not open PO', text2: e?.message || '' });
    }
  }, [companyGuid, exitMultiSelect, router]);

  const handleBulkAddToPo = useCallback(() => {
    const selected = rows.filter(r => selectedIds.includes(r.id));
    if (!selected.length) {
      Toast.show({ type: 'error', text1: 'No items selected' });
      return;
    }
    openPoWithItems(selected);
  }, [rows, selectedIds, openPoWithItems]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every(r => selectedIds.includes(r.id));

  const emptyTitle =
    bucket === 'low'
      ? `No items at or below ${threshold} units`
      : bucket === 'out'
        ? 'No zero-qty items'
        : 'No low or out-of-stock items';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('stocks.lowStock', { defaultValue: 'Low Stock' })}</Text>
        <View style={{ width: 44 }} />
      </View>

      {multiSelectMode ? (
        <View style={s.multiBar}>
          <TouchableOpacity onPress={exitMultiSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={s.multiCount}>{selectedIds.length} selected</Text>
          <View style={s.multiActions}>
            <TouchableOpacity
              style={s.multiBtnGhost}
              onPress={() => {
                if (allVisibleSelected) {
                  setSelectedIds(prev => prev.filter(id => !filtered.some(r => r.id === id)));
                } else {
                  setSelectedIds(prev => {
                    const next = new Set(prev);
                    filtered.forEach(r => next.add(r.id));
                    return [...next];
                  });
                }
              }}
              activeOpacity={0.8}
            >
              <Text style={s.multiBtnGhostTxt}>{allVisibleSelected ? 'Clear' : 'Select all'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.multiBtn, selectedIds.length === 0 && { opacity: 0.5 }]}
              onPress={handleBulkAddToPo}
              activeOpacity={0.85}
              disabled={selectedIds.length === 0}
            >
              <Ionicons name="cart-outline" size={15} color={COLORS.white} />
              <Text style={s.multiBtnTxt}>Add to PO</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={s.summaryRow}>
            <View style={s.summaryCard}>
              <Text style={[s.summaryVal, { color: '#D97706' }]}>{lowCount}</Text>
              <Text style={s.summaryLbl}>Low ≤ {threshold}</Text>
            </View>
            <View style={s.summaryDiv} />
            <View style={s.summaryCard}>
              <Text style={[s.summaryVal, { color: '#DC2626' }]}>{outCount}</Text>
              <Text style={s.summaryLbl}>Out of stock</Text>
            </View>
            <View style={s.summaryDiv} />
            <View style={s.summaryCard}>
              <Text style={s.summaryVal}>{rows.length}</Text>
              <Text style={s.summaryLbl}>Total</Text>
            </View>
          </View>

          <View style={s.thresholdRow}>
            <Text style={s.thresholdTxt}>Using default level: {threshold} units</Text>
            <TouchableOpacity onPress={() => safePush(router, '/stocks/settings' as any)} activeOpacity={0.7}>
              <Text style={s.thresholdLink}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={s.tabRow}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, bucket === tab.key && s.tabActive]}
                onPress={() => setBucket(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabTxt, bucket === tab.key && s.tabTxtActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {isLoading ? (
        <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm }}>
          {[...Array(5)].map((_, i) => <LedgerRowSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ItemCard
              item={item}
              threshold={threshold}
              multiSelectMode={multiSelectMode}
              selected={selectedIds.includes(item.id)}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item.id)}
              onAddToPo={() => openPoWithItems([item])}
            />
          )}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="cube-outline" size={48} color={COLORS.textTertiary} />
              </View>
              <Text style={s.emptyTitle}>{emptyTitle}</Text>
              <Text style={s.emptyDesc}>
                Long-press a row to multi-select and add items to a purchase order.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 12,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary,
  },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingVertical: SPACING.md,
  },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryDiv: { width: 1, height: 32, backgroundColor: COLORS.borderDefault },
  summaryVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  thresholdRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  thresholdTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  thresholdLink: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, paddingBottom: 0,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingBottom: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: COLORS.brandPrimary },

  multiBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  multiCount: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  multiActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  multiBtnGhost: { paddingHorizontal: 10, paddingVertical: 7 },
  multiBtnGhostTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  multiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md,
  },
  multiBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },

  list: { padding: SPACING.md, gap: 10 },

  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 10,
  },
  cardSelected: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary + '08' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginRight: 8 },
  check: {
    width: 22, height: 22, borderRadius: 11, marginTop: 2,
    borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  tagLow: { backgroundColor: '#FFFBEB' },
  tagOut: { backgroundColor: '#FEF2F2' },
  tagTxt: { fontSize: 10, fontWeight: '700' },
  tagLowTxt: { color: '#D97706' },
  tagOutTxt: { color: '#DC2626' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  bodyLine: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  bodyStrong: { fontWeight: '700', color: COLORS.textPrimary },
  progressBg: {
    height: 6, backgroundColor: COLORS.borderDefault, borderRadius: 3, overflow: 'hidden', marginBottom: 10,
  },
  progressFill: { height: '100%', backgroundColor: '#D97706', borderRadius: 3 },

  cardActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4,
  },
  rateHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  poBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md,
  },
  poBtnTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.white, fontWeight: '700' },

  empty: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
});
