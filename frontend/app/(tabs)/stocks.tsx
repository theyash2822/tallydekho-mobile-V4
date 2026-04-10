import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, RefreshControl, Modal, KeyboardAvoidingView,
  Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getStocks } from '../../src/services/api';
import { MOCK_STOCKS } from '../../src/data/mockData';

type StockStatus = 'in_stock' | 'out_of_stock' | 'low_stock';

interface StockItem {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
  status: StockStatus;
  warehouse: string;
}

interface StocksData {
  totalValue: string;
  totalSKUs: number;
  totalWarehouses: number;
  lowStockCount: number;
  items: StockItem[];
}

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; bg: string; dot: string }> = {
  in_stock:    { label: 'In Stock',    color: COLORS.positive,  bg: COLORS.positiveBg,  dot: COLORS.positive  },
  out_of_stock:{ label: 'Out of Stock',color: COLORS.negative,  bg: COLORS.negativeBg,  dot: COLORS.negative  },
  low_stock:   { label: 'Low Stock',   color: COLORS.warning,   bg: COLORS.warningBg,   dot: COLORS.warning   },
};

// --- Add New Item Form ---
const UNITS = ['Pcs', 'Kg', 'Ltr', 'Box', 'Pair', 'Set'];
const GROUPS = ['Electronics', 'Furniture', 'Stationery', 'Apparel', 'Food & Beverage'];

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (item: any) => void;
}

function AddItemModal({ visible, onClose, onSave }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [group, setGroup] = useState('');
  const [unit, setUnit] = useState('Pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [qty, setQty] = useState('');
  const [barcode, setBarcode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 900));
    setSaving(false);
    setSaved(true);
    await new Promise(r => setTimeout(r, 700));
    setSaved(false);
    onSave({ name, sku, group, unit, purchasePrice, salePrice, qty });
    setName(''); setSku(''); setGroup(''); setPurchasePrice(''); setSalePrice(''); setQty('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity style={ms.backdrop} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={ms.sheetWrap}
        >
          <View style={ms.sheet}>
            <View style={ms.handle} />
            {/* Header */}
            <View style={ms.sheetHeader}>
              <Text style={ms.sheetTitle}>Add New Item</Text>
              <TouchableOpacity onPress={onClose} style={ms.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={ms.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Group */}
              <Text style={ms.label}>Group</Text>
              <View style={ms.selectBox}>
                <Text style={[ms.selectText, !group && { color: COLORS.textTertiary }]}>
                  {group || '— Select Group —'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </View>

              {/* Product Name */}
              <Text style={ms.label}>Product name <Text style={ms.req}>*</Text></Text>
              <TextInput
                style={ms.input}
                placeholder="Enter product name"
                placeholderTextColor={COLORS.textTertiary}
                value={name}
                onChangeText={setName}
              />

              {/* Unit + Tax Rate row */}
              <View style={ms.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Unit of measure <Text style={ms.req}>*</Text></Text>
                  <View style={ms.selectBox}>
                    <Text style={ms.selectText}>{unit}</Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Tax rate</Text>
                  <View style={ms.selectBox}>
                    <Text style={[ms.selectText, { color: COLORS.textTertiary }]}>—</Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                  </View>
                </View>
              </View>

              {/* Purchase Price */}
              <Text style={ms.label}>Purchase Price</Text>
              <View style={ms.inputRow}>
                <TextInput
                  style={[ms.input, { flex: 1 }]}
                  placeholder="₹5,000"
                  placeholderTextColor={COLORS.textTertiary}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  keyboardType="numeric"
                />
                <View style={ms.currencyTag}>
                  <Text style={ms.currencyText}>INR</Text>
                </View>
              </View>

              {/* Quantity + Sale Price */}
              <View style={ms.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Quantity</Text>
                  <View style={ms.qtyRow}>
                    <TouchableOpacity
                      style={ms.qtyBtn}
                      onPress={() => setQty(String(Math.max(0, parseInt(qty || '0') - 1)))}
                    >
                      <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <TextInput
                      style={ms.qtyInput}
                      value={qty}
                      onChangeText={setQty}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={COLORS.textTertiary}
                    />
                    <TouchableOpacity
                      style={ms.qtyBtn}
                      onPress={() => setQty(String(parseInt(qty || '0') + 1))}
                    >
                      <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.label}>Default Sale Price</Text>
                  <View style={ms.inputRow}>
                    <TextInput
                      style={[ms.input, { flex: 1 }]}
                      placeholder="₹ —"
                      placeholderTextColor={COLORS.textTertiary}
                      value={salePrice}
                      onChangeText={setSalePrice}
                      keyboardType="numeric"
                    />
                    <View style={ms.currencyTag}>
                      <Text style={ms.currencyText}>INR</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Generate Barcode */}
              <View style={ms.toggleRow}>
                <Text style={ms.label}>Generate Barcode</Text>
                <Switch
                  value={barcode}
                  onValueChange={setBarcode}
                  trackColor={{ false: COLORS.borderDefault, true: COLORS.brandPrimary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={ms.footer}>
              <TouchableOpacity
                style={[ms.saveBtn, (saving || saved) && ms.saveBtnActive]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                {saving ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="sync" size={18} color={COLORS.white} />
                    <Text style={ms.saveBtnText}>Saving...</Text>
                  </View>
                ) : saved ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                    <Text style={ms.saveBtnText}>Saved!</Text>
                  </View>
                ) : (
                  <Text style={ms.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// --- Main Stocks Screen ---
export default function StocksScreen() {
  const [data, setData] = useState<StocksData>(MOCK_STOCKS);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StockStatus | 'all'>('all');

  useEffect(() => {
    getStocks().then((d: any) => setData(d));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getStocks() as any;
    setData(d);
    setRefreshing(false);
  };

  const filtered = data.items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.sku.toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === 'all' || i.status === activeFilter;
    return matchSearch && matchFilter;
  });

  // Group by status
  const statusOrder: StockStatus[] = ['in_stock', 'low_stock', 'out_of_stock'];
  const grouped = statusOrder
    .map(status => ({
      status,
      items: filtered.filter(i => i.status === status),
    }))
    .filter(g => g.items.length > 0);

  return (
    <SafeAreaView testID="stocks-screen" style={styles.safe}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Total Stock</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            testID="add-item-btn"
            style={styles.headerIconBtn}
            onPress={() => setShowAdd(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
            <Ionicons name="swap-vertical" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.totalValue}</Text>
          <Text style={styles.statLabel}>Total Value</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.totalSKUs}</Text>
          <Text style={styles.statLabel}>SKUs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data.totalWarehouses}</Text>
          <Text style={styles.statLabel}>Warehouses</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{data.lowStockCount}</Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            testID="stock-search"
            style={styles.searchInput}
            placeholder="Search"
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
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {([
          { key: 'all', label: 'All Items' },
          { key: 'in_stock', label: 'In Stock' },
          { key: 'low_stock', label: 'Low Stock' },
          { key: 'out_of_stock', label: 'Out of Stock' },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
            activeOpacity={0.7}
          >
            {f.key !== 'all' && (
              <View style={[styles.chipDot, { backgroundColor: STATUS_CONFIG[f.key as StockStatus].dot }]} />
            )}
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stock List */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />
        }
      >
        {grouped.map(group => {
          const cfg = STATUS_CONFIG[group.status];
          return (
            <View key={group.status}>
              {/* Section Header */}
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: cfg.dot }]} />
                <Text style={[styles.sectionLabel, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={styles.sectionCount}>{group.items.length} items</Text>
              </View>

              {/* Items */}
              {group.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  testID={`stock-item-${item.id}`}
                  style={[
                    styles.itemCard,
                    idx === group.items.length - 1 && styles.itemCardLast,
                  ]}
                  activeOpacity={0.7}
                >
                  {/* Left: Avatar */}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                  </View>

                  {/* Center: Info */}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemSku}>{item.sku}</Text>
                  </View>

                  {/* Right: Price + Status */}
                  <View style={styles.itemRight}>
                    <Text style={styles.itemPrice}>{item.price}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Ionicons
                        name={item.status === 'in_stock' ? 'checkmark-circle' : item.status === 'out_of_stock' ? 'close-circle' : 'alert-circle'}
                        size={11}
                        color={cfg.color}
                      />
                      <Text style={[styles.statusText, { color: cfg.color }]}>{item.stock} Stock</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Add New Item Modal */}
      <AddItemModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={(item) => console.log('New item:', item)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.borderDefault, marginVertical: 4 },

  // Search
  searchWrap: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  // Filter Chips
  filterScroll: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    maxHeight: 48,
  },
  filterContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  filterChipActive: {
    backgroundColor: COLORS.activeBg,
    borderColor: COLORS.borderStrong,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  filterChipText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // List
  scroll: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    paddingTop: 14,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionLabel: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
    marginHorizontal: SPACING.md,
  },
  itemCardLast: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginBottom: 4,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end', gap: 5 },
  itemPrice: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  statusText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  emptySubText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});

// Add Item Modal Styles
const ms = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '100%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  form: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12,
  },
  req: { color: COLORS.negative },
  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.pageBg,
  },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  selectText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  row: { flexDirection: 'row', gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currencyTag: {
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: COLORS.activeBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  currencyText: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 38, height: 42, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.activeBg,
  },
  qtyInput: {
    flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary, backgroundColor: COLORS.pageBg,
    paddingVertical: 10,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingVertical: 4,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
  },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnActive: { opacity: 0.85 },
  saveBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
