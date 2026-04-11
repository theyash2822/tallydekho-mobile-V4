import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const FAST_MOVING = [
  { id: 'FM01', name: 'USB-C Cable 3A',        sku: 'USB-3A-1M',  sales: 1240, velocity: 'Very Fast', change: +22, category: 'Accessories' },
  { id: 'FM02', name: 'Wireless Mouse M220',   sku: 'LOG-M220',   sales: 980,  velocity: 'Fast',      change: +15, category: 'Peripherals' },
  { id: 'FM03', name: 'HDMI Cable 1.5m',       sku: 'HDM-1.5',    sales: 870,  velocity: 'Fast',      change: +8,  category: 'Accessories' },
  { id: 'FM04', name: 'Laptop Stand Adj.',     sku: 'LST-ADJ01',  sales: 760,  velocity: 'Moderate',  change: -3,  category: 'Furniture' },
  { id: 'FM05', name: 'Keyboard MK235',        sku: 'LOG-MK235',  sales: 690,  velocity: 'Moderate',  change: +5,  category: 'Peripherals' },
  { id: 'FM06', name: 'Power Bank 20000mAh',   sku: 'AMZ-PB20K',  sales: 620,  velocity: 'Moderate',  change: +12, category: 'Mobiles' },
  { id: 'FM07', name: 'Screen Guard iPhone',   sku: 'SG-IP14',    sales: 580,  velocity: 'Moderate',  change: -8,  category: 'Accessories' },
  { id: 'FM08', name: 'TWS Earbuds Pro',       sku: 'TWS-PRO-01', sales: 510,  velocity: 'Normal',    change: +3,  category: 'Audio' },
  { id: 'FM09', name: 'Type-C Hub 7-in-1',     sku: 'USB-C71',    sales: 460,  velocity: 'Normal',    change: -1,  category: 'Accessories' },
  { id: 'FM10', name: 'Smart Watch Band 44mm', sku: 'SWB-44',     sales: 390,  velocity: 'Normal',    change: +9,  category: 'Wearables' },
];

const VELOCITY_CONFIG = {
  'Very Fast': { color: '#2D7D46', bg: '#F0FBF4' },
  'Fast':      { color: '#059669', bg: '#ECFDF5' },
  'Moderate':  { color: '#2563EB', bg: '#EFF6FF' },
  'Normal':    { color: '#6B7280', bg: '#F3F4F6' },
};

const CATEGORIES = ['All', 'Accessories', 'Peripherals', 'Audio', 'Mobiles', 'Wearables'];
const maxSales = Math.max(...FAST_MOVING.map(f => f.sales));

export default function MovementAnalyticsScreen() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState('All');
  const [period, setPeriod] = useState<'7D' | '1M' | '3M'>('1M');

  const filtered = activeCat === 'All'
    ? FAST_MOVING
    : FAST_MOVING.filter(i => i.category === activeCat);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Movement Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period toggle */}
      <View style={styles.periodRow}>
        {(['7D', '1M', '3M'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => setPeriod(p)}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* KPI summary */}
      <View style={styles.kpiRow}>
        {[
          { label: 'Fast-Moving SKUs', value: '130',  icon: 'flash-outline',       color: '#7C3AED' },
          { label: 'Total Units Sold', value: '7.1K', icon: 'trending-up-outline', color: '#2D7D46' },
          { label: 'Avg Velocity',     value: '54/d', icon: 'speedometer-outline', color: '#2563EB' },
        ].map(k => (
          <View key={k.label} style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: k.color + '18' }]}>
              <Ionicons name={k.icon as any} size={18} color={k.color} />
            </View>
            <Text style={styles.kpiVal}>{k.value}</Text>
            <Text style={styles.kpiLabel}>{k.label}</Text>
          </View>
        ))}
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catRow}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, activeCat === cat && styles.catChipActive]}
            onPress={() => setActiveCat(cat)}
            activeOpacity={0.7}
          >
            <Text style={[styles.catText, activeCat === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Top Fast-Moving Items</Text>
        {filtered.map((item, idx) => {
          const vc = VELOCITY_CONFIG[item.velocity as keyof typeof VELOCITY_CONFIG];
          const barPct = (item.sales / maxSales) * 100;
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemTop}>
                <Text style={styles.rank}>{idx + 1}</Text>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemSku}>{item.sku} · {item.category}</Text>
                </View>
                <View style={[styles.velocityBadge, { backgroundColor: vc.bg }]}>
                  <Text style={[styles.velocityText, { color: vc.color }]}>{item.velocity}</Text>
                </View>
              </View>

              <View style={styles.barRow}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${barPct}%` as any, backgroundColor: vc.color }]} />
                </View>
                <Text style={styles.salesVal}>{item.sales.toLocaleString()}</Text>
                <Text style={[styles.changeVal, { color: item.change >= 0 ? '#2D7D46' : '#DC2626' }]}>
                  {item.change >= 0 ? '+' : ''}{item.change}%
                </Text>
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
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  periodRow:      { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  periodBtn:      { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault },
  periodBtnActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  periodText:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodTextActive: { color: COLORS.white },

  kpiRow:  { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, padding: SPACING.sm },
  kpiCard: { flex: 1, alignItems: 'center', gap: 4 },
  kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kpiVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  kpiLabel:{ fontSize: 10, color: COLORS.textTertiary, textAlign: 'center' },

  catScroll: { maxHeight: 44, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  catRow:    { paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8, alignItems: 'center' },
  catChip:      { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault },
  catChipActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  catText:      { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  catTextActive:{ color: COLORS.white },

  scroll:      { flex: 1 },
  content:     { padding: SPACING.md },
  sectionTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },

  itemCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 8 },
  itemTop:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rank:     { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.pageBg, textAlign: 'center', lineHeight: 22, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemSku:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  velocityBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  velocityText:  { fontSize: 10, fontWeight: '700' },

  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 6, backgroundColor: COLORS.borderDefault, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 3 },
  salesVal: { width: 40, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right' },
  changeVal:{ width: 40, fontSize: TYPOGRAPHY.xs, fontWeight: '700', textAlign: 'right' },
});
