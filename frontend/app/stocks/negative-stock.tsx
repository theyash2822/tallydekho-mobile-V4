import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const AMBER = '#A89060';

interface NegStockItem {
  id: string;
  name: string;
  sku: string;
  warehouse: string;
  batch: string;
  balanceQty: number;
  lastMovement: string;
}

const ITEMS: NegStockItem[] = [
  { id: 'ns1', name: 'Black JBL',          sku: 'PRD-1002-ABC', warehouse: 'Sierra Storage',  batch: '#B023', balanceQty: -245, lastMovement: '10/10/24' },
  { id: 'ns2', name: 'Red Headset',         sku: 'PRD-1003-DEF', warehouse: 'Delhi Branch',    batch: '#B024', balanceQty: -112, lastMovement: '15/10/24' },
  { id: 'ns3', name: 'Blue Speakers',       sku: 'PRD-1004-GHI', warehouse: 'Pune Godown',     batch: '#B025', balanceQty: -78,  lastMovement: '18/10/24' },
  { id: 'ns4', name: 'Wireless Mouse',      sku: 'PRD-2001-JKL', warehouse: 'Mumbai HQ',       batch: '#B026', balanceQty: -45,  lastMovement: '20/10/24' },
  { id: 'ns5', name: 'Laptop Charger',      sku: 'PRD-2002-MNO', warehouse: 'Chennai Depot',   batch: '#B027', balanceQty: -32,  lastMovement: '22/10/24' },
  { id: 'ns6', name: 'USB-C Cable',         sku: 'PRD-2003-PQR', warehouse: 'Jaipur Depot',    batch: '#B028', balanceQty: -189, lastMovement: '25/10/24' },
  { id: 'ns7', name: 'Power Bank 20K',      sku: 'PRD-3001-STU', warehouse: 'Hyderabad Hub',   batch: '#B029', balanceQty: -67,  lastMovement: '28/10/24' },
  { id: 'ns8', name: 'Smart Watch Strap',   sku: 'PRD-3002-VWX', warehouse: 'Kolkata WH',      batch: '#B030', balanceQty: -23,  lastMovement: '01/11/24' },
];

export default function NegativeStockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search,       setSearch]       = useState('');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isSelMode,    setIsSelMode]    = useState(false);

  const visibleItems = useMemo(() =>
    ITEMS.filter(it => {
      if (!search) return true;
      const q = search.toLowerCase();
      return it.name.toLowerCase().includes(q) ||
             it.sku.toLowerCase().includes(q)  ||
             it.warehouse.toLowerCase().includes(q);
    }),
    [search]
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
            placeholder="Search products, warehouse..."
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

      {/* ── Hint */}
      {!isSelMode && visibleItems.length > 0 && (
        <View style={s.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
          <Text style={s.hintTxt}>Long press to select items</Text>
        </View>
      )}

      {/* ── Item List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        {visibleItems.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.borderDefault} />
            <Text style={s.emptyTxt}>No negative stock found</Text>
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
                  {/* Name + SKU */}
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemSku}>{item.sku}</Text>

                  <View style={s.divider} />

                  {/* Row 1: Warehouse + Batch */}
                  <View style={s.infoRow}>
                    <View style={s.infoGroup}>
                      <Text style={s.infoLabel}>Warehouse</Text>
                      <Text style={s.infoValue}>{item.warehouse}</Text>
                    </View>
                    <View style={s.infoGroup}>
                      <Text style={s.infoLabel}>Batch</Text>
                      <Text style={s.infoValue}>{item.batch}</Text>
                    </View>
                  </View>

                  {/* Row 2: Balance Qty (red) + Last Movement */}
                  <View style={s.infoRow}>
                    <View style={s.infoGroup}>
                      <Text style={s.infoLabel}>Balance Qty</Text>
                      <Text style={[s.infoValue, s.negQty]}>{item.balanceQty}</Text>
                    </View>
                    <View style={s.infoGroup}>
                      <Text style={s.infoLabel}>Last Movement</Text>
                      <Text style={s.infoValue}>{item.lastMovement}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

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
  itemSku:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  divider:     { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  infoRow:   { flexDirection: 'row', marginBottom: 4 },
  infoGroup: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textTertiary },
  infoValue: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  negQty:    { color: COLORS.negative },

  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  // Share bar
  shareBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  shareBarCount:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareBtnView:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full },
  shareTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
