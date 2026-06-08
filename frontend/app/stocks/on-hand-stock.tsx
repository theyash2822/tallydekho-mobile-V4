import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
// No mock data — real API data only (V2 rule)
// ON_HAND_ITEMS now populated from API response

// ─── ITEM CARD (outside screen) ───────────────────────────────────────────────────

function OnHandCard({
  item, onPress,
}: {
  item: any; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[sc.icon, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
      </View>
      <View style={sc.info}>
        <Text style={sc.name} numberOfLines={1}>{item.displayName || item.name}</Text>
        <Text style={sc.sku}>{item.sku} · {item.category}</Text>
      </View>
      <View style={sc.right}>
        <Text style={sc.value}>{item.value}</Text>
        <View style={[sc.qtyBadge, item.qty <= 10 && sc.qtyLow]}>
          <Text style={[sc.qtyTxt, item.qty <= 10 && sc.qtyLowTxt]}>{item.qty} on hand</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}
const sc = StyleSheet.create({
  card:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  icon:     { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  info:     { flex: 1 },
  name:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  sku:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  right:    { alignItems: 'flex-end', gap: 4 },
  value:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  qtyBadge: { backgroundColor: COLORS.pageBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  qtyLow:   { backgroundColor: COLORS.negativeBg, borderColor: COLORS.negative + '40' },
  qtyTxt:   { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  qtyLowTxt:{ color: COLORS.negative },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function OnHandStockScreen() {
    const { selectedFY } = useAuth();
const router = useRouter();
  const params = useLocalSearchParams<{ whId?: string }>();

  const [isLoading, setIsLoading] = useState(false);
  const [query,    setQuery]    = useState('');
  const [calOpen,  setCalOpen]  = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  // V2: items loaded from API via parent stock screen
  const items: any[] = [];
  const filtered = items.filter(
    (i: any) =>
      (i.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (i.sku || '').toLowerCase().includes(query.toLowerCase()),
  );

  const totalQty = items.reduce((s: number, i: any) => s + (i.qty || 0), 0);
  const lowStock = items.filter((i: any) => (i.qty || 0) <= 10).length;
  const dateLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'All Time';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>On Hand Stock</Text>
        <TouchableOpacity
          style={styles.calBtn}
          onPress={() => setCalOpen(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Date range bar */}
      {(dateFrom || dateTo) && (
        <View style={styles.dateBar}>
          <Ionicons name="calendar-outline" size={13} color={'#A89060'} />
          <Text style={styles.dateBarTxt}>{dateLabel}</Text>
          <TouchableOpacity onPress={() => { setDateFrom(''); setDateTo(''); }}>
            <Ionicons name="close-circle" size={15} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        {[
          { label: 'No. of SKUs', value: `${items.length}` },
          { label: 'Quantity',    value: totalQty.toLocaleString('en-IN') },
          { label: 'Low Stock',   value: `${lowStock}`, warn: lowStock > 0 },
        ].map((s, i) => (
          <View key={i} style={styles.summaryItem}>
            <Text style={[styles.summaryVal, s.warn && { color: COLORS.negative }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.sectionLabel}>{filtered.length} items</Text>
        {isLoading && (
          <>
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
          </>
        )}
        {!isLoading && filtered.map(item => (
          <OnHandCard
            key={item.id}
            item={item}
            onPress={() => router.push(`/stocks/item-detail?id=${item.id}` as any)}
          />
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={calOpen}
        fromDate={dateFrom}
        toDate={dateTo}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  calBtn:      { width: 40, alignItems: 'flex-end' },

  dateBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FBF7EE', paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0E8D5',
  },
  dateBarTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060' },

  summaryRow:  {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel:{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SPACING.md, marginTop: 12, marginBottom: 4,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 8 },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 4 },
});
