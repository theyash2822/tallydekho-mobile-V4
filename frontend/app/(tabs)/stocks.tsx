import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import Header from '../../src/components/Header';
import QuickActionsModal from '../../src/components/QuickActionsModal';
import { getStocks } from '../../src/services/api';
import { MOCK_STOCKS } from '../../src/data/mockData';

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  in_stock: { label: 'In Stock', color: COLORS.positive, bg: COLORS.positiveBg },
  out_of_stock: { label: 'Out of Stock', color: COLORS.negative, bg: COLORS.negativeBg },
  low_stock: { label: 'Low stock', color: COLORS.warning, bg: COLORS.warningBg },
};

export default function StocksScreen() {
  const [data, setData] = useState(MOCK_STOCKS);
  const [search, setSearch] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getStocks().then((d: any) => setData(d)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getStocks() as any;
    setData(d);
    setRefreshing(false);
  };

  const filtered = data.items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView testID="stocks-screen" style={styles.safe}>
      <Header companyName="Stocks" onMenuPress={() => setShowActions(true)} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { flex: 2 }]}>
            <Text style={styles.statValue}>{data.totalValue}</Text>
            <Text style={styles.statLabel}>Total Stock Value</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.totalSKUs}</Text>
            <Text style={styles.statLabel}>SKUs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.totalWarehouses}</Text>
            <Text style={styles.statLabel}>Warehouses</Text>
          </View>
        </View>

        {/* Low Stock Alert */}
        {data.lowStockCount > 0 && (
          <View testID="low-stock-alert" style={styles.alertRow}>
            <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
            <Text style={styles.alertText}>{data.lowStockCount} items below reorder level</Text>
            <TouchableOpacity testID="view-low-stock-btn" activeOpacity={0.7}>
              <Text style={styles.alertAction}>View</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.textTertiary} />
            <TextInput
              testID="stock-search"
              style={styles.searchInput}
              placeholder="Search items, SKU..."
              placeholderTextColor={COLORS.textTertiary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity testID="stock-filter-btn" style={styles.filterBtn} activeOpacity={0.7}>
            <Ionicons name="options-outline" size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity testID="add-item-btn" style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add Item</Text>
          </TouchableOpacity>
        </View>

        {/* Items List */}
        <View style={styles.list}>
          {filtered.map((item, idx) => {
            const statusInfo = STATUS_STYLES[item.status] || STATUS_STYLES.in_stock;
            return (
              <TouchableOpacity
                key={item.id}
                testID={`stock-item-${item.id}`}
                style={[styles.itemCard, idx === filtered.length - 1 && styles.itemCardLast]}
                activeOpacity={0.7}
              >
                <View style={styles.itemIconBox}>
                  <Ionicons name="cube-outline" size={20} color={COLORS.textSecondary} />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemSku}>{item.sku}</Text>
                  <Text style={styles.itemWarehouse}>{item.warehouse}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemPrice}>{item.price}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                  <Text style={styles.itemStock}>{item.stock} items</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <QuickActionsModal visible={showActions} onClose={() => setShowActions(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: 8, padding: SPACING.md },
  statCard: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center',
  },
  statValue: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  alertText: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.warning },
  alertAction: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  filterBtn: {
    width: 42, height: 42, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: 14,
  },
  addBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  list: { marginHorizontal: SPACING.md },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, padding: 14,
    borderTopLeftRadius: 0, borderTopRightRadius: 0,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderBottomWidth: 0, borderRadius: 0,
  },
  itemCardLast: { borderBottomWidth: 1, borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md },
  itemIconBox: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  itemWarehouse: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  itemRight: { alignItems: 'flex-end', gap: 4 },
  itemPrice: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
  itemStock: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
});
