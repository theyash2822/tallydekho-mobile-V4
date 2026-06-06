import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getNegativeStock } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';

const AMBER = '#A89060';

interface WarehouseQty {
  warehouse: string;
  qty: number;
}

interface NegStockItem {
  id: string;
  name: string;
  displayName?: string;
  sku: string;
  group: string;
  unit: string;
  rate: number;
  total_qty: number;
  warehouses: WarehouseQty[];
}

export default function NegativeStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const fyParam = fyInfoToParam(selectedFY);

  const [search,      setSearch]      = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelMode,   setIsSelMode]   = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [items,       setItems]       = useState<NegStockItem[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getNegativeStock(companyGuid, { pageSize: 500, ...(fyParam ? { fy: fyParam } : {}) })
      .then((res: any) => {
        const rows: NegStockItem[] = (res?.data?.items ?? []).map((r: any) => ({
          id:         String(r.stockGuid ?? r.id),
          name:       r.displayName || r.itemName || r.name || 'Unknown',
          sku:        r.sku || r.alias || '',
          group:      r.groupName ?? r.group ?? '—',
          unit:       r.unit ?? '',
          rate:       Number(r.rate ?? 0),
          total_qty:  Number(r.closingQty ?? r.total_qty ?? 0),
          warehouses: (r.warehouses ?? []).map((w: any) => ({
            warehouse: w.warehouse ?? 'Main Location',
            qty:       Number(w.qty ?? 0),
          })),
        }));
        setItems(rows);
      })
      .catch((err: any) => setApiError(err?.message ?? 'Failed to load negative stock data'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY]);

  const visibleItems = useMemo(() =>
    items.filter(it => {
      if (!search) return true;
      const q = search.toLowerCase();
      return it.name.toLowerCase().includes(q) || it.group.toLowerCase().includes(q);
    }),
    [search, items]
  );

  // ── Multi-select ───────────────────────────────────────────────────────
  const handleLongPress = (id: string) => { setIsSelMode(true); setSelectedIds(new Set([id])); };
  const handlePress = (id: string) => {
    if (!isSelMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (next.size === 0) setIsSelMode(false); }
      else next.add(id);
      return next;
    });
  };
  const cancelSelection = () => { setSelectedIds(new Set()); setIsSelMode(false); };
  const selectAll       = () => { setSelectedIds(new Set(visibleItems.map(i => i.id))); setIsSelMode(true); };

  const fmtQty  = (q: number) => `${q}`;
  const fmtVal  = (qty: number, rate: number) => {
    const v = Math.abs(qty * rate);
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* ── Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Negative Stock</Text>
        <View style={{ width: 44 }} />
      </View>

      {apiError && <ErrorBanner message={apiError} />}

      {/* ── Selection Banner */}
      {isSelMode && (
        <View style={s.selBanner}>
          <TouchableOpacity onPress={cancelSelection} style={s.selBannerBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            <Text style={s.selBannerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.selBannerCount}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={selectAll} style={s.selBannerBtn} activeOpacity={0.7}>
            <Text style={s.selBannerAll}>All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search */}
      {!isSelMode && (
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search products, group..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Loading */}
      {isLoading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {[...Array(5)].map((_, i) => <LedgerRowSkeleton key={i} />)}
        </ScrollView>
      )}

      {/* ── Hint */}
      {!isSelMode && !isLoading && visibleItems.length > 0 && (
        <View style={s.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
          <Text style={s.hintTxt}>Long press to select items</Text>
        </View>
      )}

      {/* ── Item List */}
      {!isLoading && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {visibleItems.length === 0 && !apiError ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>No negative stock items</Text>
              <Text style={s.emptySubTxt}>All stock levels are positive</Text>
            </View>
          ) : (
            visibleItems.map(item => {
              const isSel = selectedIds.has(item.id);
              const hasMultiWH = item.warehouses.length > 1;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.card, isSel && s.cardSel]}
                  onPress={() => handlePress(item.id)}
                  onLongPress={() => handleLongPress(item.id)}
                  delayLongPress={350}
                  activeOpacity={0.85}
                >
                  {/* Avatar */}
                  <View style={[s.avatar, isSel && s.avatarSel]}>
                    {isSel
                      ? <Ionicons name="checkmark" size={18} color="#fff" />
                      : <Ionicons name="cube-outline" size={20} color="#fff" />
                    }
                  </View>

                  <View style={s.cardContent}>
                    {/* Name + sku + group */}
                    <Text style={s.itemName}>{item.displayName || item.name}</Text>
                    {item.sku ? <Text style={s.itemGroup}>{item.sku}</Text> : null}
                    <Text style={s.itemGroup}>{item.group}</Text>

                    <View style={s.divider} />

                    {/* Warehouse breakdown */}
                    <View style={s.whHeader}>
                      <Ionicons name="business-outline" size={12} color={COLORS.textTertiary} />
                      <Text style={s.whHeaderTxt}>
                        {hasMultiWH ? 'Warehouse Breakdown' : 'Warehouse'}
                      </Text>
                    </View>

                    {item.warehouses.length > 0 ? (
                      <View style={s.whList}>
                        {item.warehouses.map((wh, idx) => (
                          <View key={idx} style={s.whRow}>
                            <View style={s.whDot} />
                            <Text style={s.whName} numberOfLines={1}>{wh.warehouse}</Text>
                            <Text style={s.whQty}>
                              {fmtQty(wh.qty)}{item.unit ? ` ${item.unit}` : ''}
                            </Text>
                            {item.rate > 0 && (
                              <Text style={s.whVal}>{fmtVal(wh.qty, item.rate)}</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={s.whRow}>
                        <View style={s.whDot} />
                        <Text style={s.whName}>All Warehouses</Text>
                        <Text style={s.whQty}>
                          {fmtQty(item.total_qty)}{item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Share Bar */}
      {isSelMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity style={s.shareBtnView} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.xs, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 6 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },

  // Cards
  card:        { flexDirection: 'row', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: SPACING.md },
  cardSel:     { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  avatarSel:   { backgroundColor: COLORS.brandPrimary },
  cardContent: { flex: 1 },
  itemName:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemGroup:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  divider:     { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  infoRow:   { flexDirection: 'row', marginBottom: 4 },
  infoGroup: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textTertiary },
  infoValue: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  negQty:    { color: COLORS.negative },

  // Warehouse breakdown
  whDivider:    { height: 1, backgroundColor: COLORS.borderDefault, marginTop: SPACING.sm, marginBottom: 6 },
  whHeader:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  whHeaderTxt:  { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600' },
  whList:       { gap: 4 },
  whRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  whDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.negative, flexShrink: 0 },
  whName:       { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  whQty:        { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.negative, minWidth: 60, textAlign: 'right' },
  whVal:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginLeft: 6 },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  emptySubTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Share bar
  shareBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  shareBarCount:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareBtnView:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full },
  shareTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
