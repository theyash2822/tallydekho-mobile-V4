import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const REORDER_ITEMS = [
  { id: 'RQ001', name: 'JBL Portable Speaker',      sku: 'PRD-1002-ABC', current: 3,  reorderAt: 10, suggest: 50,  priority: 'critical', warehouse: 'Miami' },
  { id: 'RQ002', name: 'Samsung Galaxy J1',          sku: 'PRD-1003-DEF', current: 0,  reorderAt: 5,  suggest: 25,  priority: 'critical', warehouse: 'Los Angeles' },
  { id: 'RQ003', name: 'Sony WH-1000XM5',            sku: 'SNY-001',      current: 5,  reorderAt: 8,  suggest: 20,  priority: 'high',     warehouse: 'Delhi' },
  { id: 'RQ004', name: 'Lycan Wireless Headphone',   sku: 'LWH-789',      current: 7,  reorderAt: 15, suggest: 30,  priority: 'high',     warehouse: 'Mumbai' },
  { id: 'RQ005', name: 'Logitech MX Keys',           sku: 'LGT-MX2',      current: 12, reorderAt: 20, suggest: 40,  priority: 'medium',   warehouse: 'Miami' },
  { id: 'RQ006', name: 'HDMI 4K Cable (1.5m)',       sku: 'HDM-4K-001',   current: 8,  reorderAt: 25, suggest: 100, priority: 'medium',   warehouse: 'Delhi' },
  { id: 'RQ007', name: 'USB-C Hub 7-in-1',           sku: 'USB-C71',      current: 11, reorderAt: 20, suggest: 50,  priority: 'low',      warehouse: 'Mumbai' },
  { id: 'RQ008', name: 'Apple Magic Mouse',          sku: 'APL-MM3',      current: 4,  reorderAt: 10, suggest: 25,  priority: 'low',      warehouse: 'Miami' },
];

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  high:     { label: 'High',     color: '#D97706', bg: '#FFFBEB' },
  medium:   { label: 'Medium',   color: '#2563EB', bg: '#EFF6FF' },
  low:      { label: 'Low',      color: '#6B7280', bg: '#F3F4F6' },
};

type Priority = keyof typeof PRIORITY_CONFIG;
type FilterType = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

export default function ReorderQueueScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  const filtered = activeFilter === 'All'
    ? REORDER_ITEMS
    : REORDER_ITEMS.filter(i => i.priority === activeFilter.toLowerCase());

  const criticalCount = REORDER_ITEMS.filter(i => i.priority === 'critical').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reorder Queue</Text>
        {criticalCount > 0 && (
          <View style={styles.criticalBadge}>
            <Text style={styles.criticalText}>{criticalCount}</Text>
          </View>
        )}
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Critical', count: REORDER_ITEMS.filter(i => i.priority === 'critical').length, color: '#DC2626' },
          { label: 'High',     count: REORDER_ITEMS.filter(i => i.priority === 'high').length,     color: '#D97706' },
          { label: 'Medium',   count: REORDER_ITEMS.filter(i => i.priority === 'medium').length,   color: '#2563EB' },
          { label: 'Total',    count: REORDER_ITEMS.length,                                        color: COLORS.textPrimary },
        ].map(s => (
          <View key={s.label} style={styles.summaryItem}>
            <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Priority filter */}
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

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {filtered.map(item => {
          const p = PRIORITY_CONFIG[item.priority as Priority];
          const progressPct = Math.round((item.current / item.reorderAt) * 100);
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemSku}>{item.sku} · {item.warehouse}</Text>
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: p.bg }]}>
                  <Text style={[styles.priorityText, { color: p.color }]}>{p.label}</Text>
                </View>
              </View>

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
                    backgroundColor: item.current === 0 ? '#DC2626' : '#D97706',
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
                  onPress={() => router.push('/purchase/create-order')}
                >
                  <Ionicons name="cart-outline" size={13} color={COLORS.white} />
                  <Text style={styles.reorderBtnText}>Add to PO</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.pageBg },
  header:   {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:      { width: 40, alignItems: 'flex-start' },
  headerTitle:  { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  criticalBadge:{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  criticalText: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: '#DC2626' },

  summaryRow: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingVertical: 10,
  },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryCount: { fontSize: TYPOGRAPHY.xl, fontWeight: '800' },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 6,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  filterChip:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  filterText:      { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  filterTextActive:{ color: COLORS.white },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 10 },

  itemCard:  { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  cardLeft:  { flex: 1, marginRight: 8 },
  itemName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemSku:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  priorityText:  { fontSize: 10, fontWeight: '700' },

  progressSection: { marginBottom: 10 },
  statsRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statLabel:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  progressTrack:   { height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  progressFill:    { height: '100%', borderRadius: 4 },

  cardActions:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggText:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  reorderBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  reorderBtnText: { fontSize: TYPOGRAPHY.xs, color: COLORS.white, fontWeight: '700' },
});
