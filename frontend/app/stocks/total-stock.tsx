import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Platform, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_STOCKS } from '../../src/data/mockData';

type StockStatus = 'in_stock' | 'out_of_stock' | 'low_stock';

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; bg: string }> = {
  in_stock:     { label: 'In Stock',     color: COLORS.positive, bg: COLORS.positiveBg },
  out_of_stock: { label: 'Out of Stock', color: COLORS.negative, bg: COLORS.negativeBg },
  low_stock:    { label: 'Low Stock',    color: COLORS.warning,  bg: COLORS.warningBg  },
};

const FILTER_CHIPS = ['Warehouse', 'Category', 'Item Group'];

// Swipe left (drag LEFT) action — Delete
function RightActions({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.swipeDelete} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="trash-outline" size={20} color={COLORS.white} />
      <Text style={styles.swipeLabel}>Delete</Text>
    </TouchableOpacity>
  );
}

// Swipe right (drag RIGHT) action — Edit + Reorder
function LeftActions({ onEdit, onReorder }: { onEdit: () => void; onReorder: () => void }) {
  return (
    <View style={styles.swipeLeftContainer}>
      <TouchableOpacity style={styles.swipeEdit} onPress={onEdit} activeOpacity={0.8}>
        <Ionicons name="pencil-outline" size={18} color={COLORS.white} />
        <Text style={styles.swipeLabel}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.swipeReorder} onPress={onReorder} activeOpacity={0.8}>
        <Ionicons name="refresh-outline" size={18} color={COLORS.white} />
        <Text style={styles.swipeLabel}>Reorder</Text>
      </TouchableOpacity>
    </View>
  );
}

function StockItemRow({ item, onEdit, onReorder, onDelete, onPress }: {
  item: any; onEdit: () => void; onReorder: () => void; onDelete: () => void; onPress: () => void;
}) {
  const st = STATUS_CONFIG[item.status as StockStatus];
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={() => (
        <LeftActions
          onEdit={() => { swipeRef.current?.close(); onEdit(); }}
          onReorder={() => { swipeRef.current?.close(); onReorder(); }}
        />
      )}
      renderRightActions={() => (
        <RightActions onPress={() => { swipeRef.current?.close(); onDelete(); }} />
      )}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity style={styles.itemRow} onPress={onPress} activeOpacity={0.85}>
        {/* Icon */}
        <View style={styles.itemIconBox}>
          <Ionicons name="cube-outline" size={20} color={COLORS.brandPrimary} />
        </View>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemSku}>{item.sku}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemPrice}>{item.price}</Text>
            <Text style={styles.itemDot}> · </Text>
            <Text style={styles.itemQty}>{item.stock} Items</Text>
          </View>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function TotalStockScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const items = MOCK_STOCKS.items.filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit     = (item: any) => Alert.alert('Edit', `Edit ${item.name}`);
  const handleReorder  = (item: any) => Alert.alert('Reorder', `Reorder ${item.name}`);
  const handleDelete   = (item: any) => Alert.alert('Delete', `Delete ${item.name}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => {} },
  ]);
  const handleDetail = (item: any) => router.push(`/stocks/item-detail?id=${item.id}` as any);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Total Stock</Text>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setShowMenu(true)} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, SKU..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 12 }}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <View style={styles.filterWrap}>
          {FILTER_CHIPS.map(chip => (
            <TouchableOpacity
              key={chip}
              style={[styles.filterChip, activeFilter === chip && styles.filterChipActive]}
              onPress={() => setActiveFilter(activeFilter === chip ? null : chip)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, activeFilter === chip && styles.filterChipTextActive]}>
                {chip}
              </Text>
              <Ionicons
                name="chevron-down"
                size={11}
                color={activeFilter === chip ? COLORS.brandPrimary : COLORS.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Stock count */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>{items.length} items</Text>
        </View>

        {/* Stock list */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {items.map(item => (
            <StockItemRow
              key={item.id}
              item={item}
              onEdit={() => handleEdit(item)}
              onReorder={() => handleReorder(item)}
              onDelete={() => handleDelete(item)}
              onPress={() => handleDetail(item)}
            />
          ))}
          {items.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No items found</Text>
            </View>
          )}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Radial Menu Modal */}
        <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowMenu(false)} activeOpacity={1}>
            <View style={styles.menuCard}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); }} activeOpacity={0.8}>
                <View style={[styles.menuIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
                </View>
                <Text style={styles.menuItemText}>Add New Item</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); }} activeOpacity={0.8}>
                <View style={[styles.menuIcon, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="swap-vertical-outline" size={20} color="#7C3AED" />
                </View>
                <Text style={styles.menuItemText}>Bulk Transfer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  menuBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: SPACING.md, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  filterWrap:  { 
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8, 
  },
  filterRow:  { paddingHorizontal: SPACING.md, paddingBottom: 10, gap: 8, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: COLORS.cardBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  filterChipActive:     { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  filterChipText:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.brandPrimary, fontWeight: '700' },

  countRow: { paddingHorizontal: SPACING.md, paddingBottom: 6 },
  countText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },

  list: { flex: 1 },

  // Item row
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  itemIconBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  itemSku:   { fontSize: 11, color: COLORS.textTertiary, marginBottom: 4 },
  itemMeta:  { flexDirection: 'row', alignItems: 'center' },
  itemPrice: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  itemDot:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemQty:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText:  { fontSize: 10, fontWeight: '700' },

  // Swipe actions
  swipeLeftContainer: { flexDirection: 'row', alignItems: 'stretch' },
  swipeEdit: {
    backgroundColor: '#2563EB', width: 72, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  swipeReorder: {
    backgroundColor: '#059669', width: 80, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  swipeDelete: {
    backgroundColor: COLORS.negative, width: 80, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  swipeLabel: { fontSize: 10, color: COLORS.white, fontWeight: '700' },

  // Radial menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menuCard: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingBottom: 30, overflow: 'hidden',
  },
  menuItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  menuIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuItemText: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  menuDivider:  { height: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
