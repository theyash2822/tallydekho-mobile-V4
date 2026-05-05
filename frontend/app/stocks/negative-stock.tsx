import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getStocks } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER = '#A89060';

interface NegStockItem {
  id: string;
  name: string;
  group: string;
  qty: number;
  value: number;
}

export default function NegativeStockScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [search,       setSearch]       = useState('');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isSelMode,    setIsSelMode]    = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [items,     setItems]     = useState<NegStockItem[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getStocks(companyGuid, { limit: '500' })
      .then((res: any) => {
        const rows: any[] = res?.data ?? [];
        const negItems: NegStockItem[] = rows
          .filter((r: any) => Number(r.closing_qty) < 0)
          .map((r: any, idx: number) => ({
            id:    String(r.id ?? idx),
            name:  r.name ?? 'Unknown',
            group: r.group_name ?? '—',
            qty:   Number(r.closing_qty),
            value: Number(r.closing_qty) * Number(r.rate ?? 0),
          }));
        setItems(negItems);
      })
      .catch((err: any) => {
        setApiError(err?.message ?? 'Failed to load stock data');
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid]);

  const visibleItems = useMemo(() =>
    items.filter(it => {
      if (!search) return true;
      const q = search.toLowerCase();
      return it.name.toLowerCase().includes(q) || it.group.toLowerCase().includes(q);
    }),
    [search, items]
  );

  // ── Multi-select ───────────────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    setIsSelMode(true);
    setSelectedIds(new Set([id]));
  };

  const handlePress = (id: string) => {
    if (!isSelMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cancelSelection = () => { setSelectedIds(new Set()); setIsSelMode(false); };
  const selectAll       = () => { setSelectedIds(new Set(visibleItems.map(i => i.id))); setIsSelMode(true); };

  const fmtValue = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000)   return `₹${(abs / 1000).toFixed(1)}K`;
    return `₹${abs.toFixed(0)}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* ── Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Negative Stock Exceptions</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Error Banner */}
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
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>Loading stock data…</Text>
        </View>
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
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.card, isSel && s.cardSel]}
                  onPress={() => handlePress(item.id)}
                  onLongPress={() => handleLongPress(item.id)}
                  delayLongPress={350}
                  activeOpacity={0.85}
                >
                  {/* Avatar circle */}
                  <View style={[s.avatar, isSel && s.avatarSel]}>
                    {isSel
                      ? <Ionicons name="checkmark" size={18} color="#fff" />
                      : <Ionicons name="cube-outline" size={20} color="#fff" />
                    }
                  </View>

                  {/* Card content */}
                  <View style={s.cardContent}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemGroup}>{item.group}</Text>

                    <View style={s.divider} />

                    <View style={s.infoRow}>
                      <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Balance Qty</Text>
                        <Text style={[s.infoValue, s.negQty]}>{item.qty}</Text>
                      </View>
                      <View style={s.infoGroup}>
                        <Text style={s.infoLabel}>Est. Value</Text>
                        <Text style={[s.infoValue, s.negQty]}>{fmtValue(item.value)}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Conditional Share Bar */}
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

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 6 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },

  // Cards
  card:    { flexDirection: 'row', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: SPACING.md },
  cardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },

  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  avatarSel: { backgroundColor: COLORS.brandPrimary },

  cardContent: { flex: 1 },
  itemName:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemGroup:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  divider:     { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  infoRow:   { flexDirection: 'row', marginBottom: 4 },
  infoGroup: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textTertiary },
  infoValue: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  negQty:    { color: COLORS.negative },

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
