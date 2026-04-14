import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const WAREHOUSES = [
  { id: 'WH01', name: 'Mumbai Central',  location: 'Mumbai, MH',    utilization: 82, capacity: 5000, used: 4100, skus: 124, value: '₹28,50,000', manager: 'Ramesh K.' },
  { id: 'WH02', name: 'Delhi Hub',       location: 'New Delhi, DL', utilization: 64, capacity: 8000, used: 5120, skus: 89,  value: '₹19,20,000', manager: 'Sunita P.' },
  { id: 'WH03', name: 'Bangalore South', location: 'Bengaluru, KA', utilization: 71, capacity: 3500, used: 2485, skus: 67,  value: '₹14,80,000', manager: 'Arjun S.' },
  { id: 'WH04', name: 'Chennai Port',    location: 'Chennai, TN',   utilization: 45, capacity: 6000, used: 2700, skus: 42,  value: '₹9,60,000',  manager: 'Meena R.' },
  { id: 'WH05', name: 'Kolkata East',    location: 'Kolkata, WB',   utilization: 58, capacity: 4000, used: 2320, skus: 55,  value: '₹11,40,000', manager: 'Dipesh G.' },
];

function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? '#DC2626' : pct >= 70 ? '#D97706' : '#2D7D46';
  return (
    <View style={ub.track}>
      <View style={[ub.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const ub = StyleSheet.create({
  track: { height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden', flex: 1 },
  fill:  { height: '100%', borderRadius: 4 },
});

export default function WarehousesScreen() {
  const router = useRouter();
  const totalCapacity = WAREHOUSES.reduce((s, w) => s + w.capacity, 0);
  const totalUsed = WAREHOUSES.reduce((s, w) => s + w.used, 0);
  const overallUtil = Math.round((totalUsed / totalCapacity) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Warehouses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => Alert.alert('Add Warehouse', 'Feature coming soon!')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Total WH', value: String(WAREHOUSES.length), color: COLORS.textPrimary },
          { label: 'Avg Util.', value: `${overallUtil}%`, color: overallUtil >= 85 ? '#DC2626' : '#2D7D46' },
          { label: 'Total SKUs', value: String(WAREHOUSES.reduce((s, w) => s + w.skus, 0)), color: COLORS.textPrimary },
        ].map(s => (
          <View key={s.label} style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {WAREHOUSES.map(wh => {
          const utilColor = wh.utilization >= 85 ? '#DC2626' : wh.utilization >= 70 ? '#D97706' : '#2D7D46';
          return (
            <TouchableOpacity
              key={wh.id}
              style={styles.whCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/stocks/warehouse-detail?id=${wh.id}` as any)}
            >
              <View style={styles.whTop}>
                <View style={styles.whIconBox}>
                  <Ionicons name="business-outline" size={22} color="#2563EB" />
                </View>
                <View style={styles.whInfo}>
                  <Text style={styles.whName}>{wh.name}</Text>
                  <Text style={styles.whLocation}>
                    <Ionicons name="location-outline" size={12} color={COLORS.textTertiary} /> {wh.location}
                  </Text>
                </View>
                <View style={[styles.utilBadge, { backgroundColor: utilColor + '20' }]}>
                  <Text style={[styles.utilText, { color: utilColor }]}>{wh.utilization}%</Text>
                </View>
              </View>

              <View style={styles.whBarRow}>
                <UtilBar pct={wh.utilization} />
              </View>

              <View style={styles.whStatsRow}>
                {[
                  { label: 'Capacity', value: `${wh.capacity.toLocaleString()} units` },
                  { label: 'Used',     value: `${wh.used.toLocaleString()} units` },
                  { label: 'SKUs',     value: String(wh.skus) },
                  { label: 'Value',    value: wh.value },
                ].map(s => (
                  <View key={s.label} style={styles.whStatItem}>
                    <Text style={styles.whStatVal}>{s.value}</Text>
                    <Text style={styles.whStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.whFooter}>
                <Ionicons name="person-outline" size={12} color={COLORS.textTertiary} />
                <Text style={styles.managerText}>{wh.manager}</Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
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
  addBtn:      { width: 40, alignItems: 'flex-end' },

  summaryRow:   {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 12,
  },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryVal:   { fontSize: TYPOGRAPHY.xl, fontWeight: '800' },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 12 },

  whCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  whTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  whIconBox:{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  whInfo:   { flex: 1 },
  whName:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  whLocation: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  utilBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  utilText:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  whBarRow:    { marginBottom: 10 },
  whStatsRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  whStatItem:  { alignItems: 'center' },
  whStatVal:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  whStatLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  whFooter:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  managerText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
});
