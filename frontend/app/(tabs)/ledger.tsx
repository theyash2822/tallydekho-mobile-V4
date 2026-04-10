import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, RefreshControl, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import Header from '../../src/components/Header';
import { getLedgers } from '../../src/services/api';
import { MOCK_LEDGERS } from '../../src/data/mockData';

type FilterType = 'All' | 'Debit' | 'Credit';

export default function LedgerScreen() {
  const [data, setData] = useState(MOCK_LEDGERS);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('All');
  const [showFilter, setShowFilter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getLedgers().then((d: any) => setData(d)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const d = await getLedgers() as any;
    setData(d);
    setRefreshing(false);
  };

  const filtered = data.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.group.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || item.type === filter.toLowerCase();
    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView testID="ledger-screen" style={styles.safe}>
      <Header companyName="Ledgers" />

      {/* Search + Filter Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            testID="ledger-search"
            style={styles.searchInput}
            placeholder="Search Ledgers..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          testID="ledger-filter-btn"
          style={styles.filterBtn}
          onPress={() => setShowFilter(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity testID="add-ledger-btn" style={styles.addBtn} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.addBtnText}>Add Ledger</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.chipRow}>
        {(['All', 'Debit', 'Credit'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            testID={`filter-chip-${f}`}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        <View style={styles.list}>
          {filtered.map((item) => (
            <TouchableOpacity
              key={item.id}
              testID={`ledger-item-${item.id}`}
              style={styles.itemCard}
              activeOpacity={0.7}
            >
              <View style={styles.itemLeft}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemGroup}>{item.group}</Text>
                  <Text style={styles.itemUpdated}>Last updated at {item.lastUpdated}</Text>
                </View>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemBalance}>{item.balance}</Text>
                <View style={[
                  styles.typeBadge,
                  { backgroundColor: item.type === 'credit' ? COLORS.positiveBg : COLORS.negativeBg }
                ]}>
                  <Text style={[
                    styles.typeText,
                    { color: item.type === 'credit' ? COLORS.positive : COLORS.negative }
                  ]}>
                    {item.type === 'credit' ? 'Cr' : 'Dr'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  searchRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  filterBtn: {
    width: 40, height: 40, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: 12,
  },
  addBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  chipRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md,
    paddingVertical: 10, backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  chipActive: { backgroundColor: COLORS.activeBg, borderColor: COLORS.borderStrong },
  chipText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  chipTextActive: { color: COLORS.textPrimary, fontWeight: '700' },
  scroll: { flex: 1 },
  list: { padding: SPACING.md, gap: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 12 },
  avatarBox: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.activeBg, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, maxWidth: 160 },
  itemGroup: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemUpdated: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemBalance: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  typeText: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
});
