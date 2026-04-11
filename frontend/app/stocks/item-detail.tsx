import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_STOCKS } from '../../src/data/mockData';

const MOVEMENT_HISTORY = [
  { id: 'M1', date: '25 May 25', type: 'Purchase', qty: '+50', party: 'ABC Suppliers', balance: 58 },
  { id: 'M2', date: '23 May 25', type: 'Sale', qty: '-10', party: 'Raj Enterprises', balance: 48 },
  { id: 'M3', date: '20 May 25', type: 'Transfer', qty: '-5', party: 'Mumbai WH', balance: 43 },
  { id: 'M4', date: '17 May 25', type: 'Purchase', qty: '+20', party: 'Delhi Supplier', balance: 63 },
  { id: 'M5', date: '12 May 25', type: 'Sale', qty: '-8', party: 'Kumar & Sons', balance: 55 },
];

const STATUS_CONFIG = {
  in_stock:     { label: 'In Stock',     color: '#2D7D46', bg: '#F0FBF4' },
  low_stock:    { label: 'Low Stock',    color: '#D97706', bg: '#FFFBEB' },
  out_of_stock: { label: 'Out of Stock', color: '#DC2626', bg: '#FEF2F2' },
};

const MOV_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  Purchase: { icon: 'arrow-down',      color: '#2D7D46', bg: '#F0FBF4' },
  Sale:     { icon: 'arrow-up',        color: '#DC2626', bg: '#FEF2F2' },
  Transfer: { icon: 'swap-horizontal', color: '#2563EB', bg: '#EFF6FF' },
};

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = MOCK_STOCKS.items.find(i => i.id === id) || MOCK_STOCKS.items[0];
  const st = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{item.name}</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => Alert.alert('Edit', `Edit ${item.name}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero: status + qty */}
        <View style={[styles.heroRow, { backgroundColor: st.bg + '44' }]}>
          <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: st.color }]} />
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
          <View style={styles.heroQtyBlock}>
            <Text style={styles.heroQty}>{item.stock}</Text>
            <Text style={styles.heroQtyLabel}>units</Text>
          </View>
        </View>

        {/* Product Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Product Info</Text>
          <View style={styles.infoGrid}>
            {[
              { label: 'SKU',         value: item.sku },
              { label: 'Warehouse',   value: item.warehouse },
              { label: 'Unit Price',  value: item.price },
              { label: 'Category',    value: 'Electronics' },
              { label: 'Reorder Pt', value: '10 units' },
              { label: 'Min. Stock',  value: '5 units' },
            ].map(r => (
              <View key={r.label} style={styles.infoItem}>
                <Text style={styles.infoLabel}>{r.label}</Text>
                <Text style={styles.infoValue}>{r.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Warehouse Distribution */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Warehouse Distribution</Text>
          {[
            { name: 'Miami WH',  qty: item.stock,                       pct: 60 },
            { name: 'Delhi WH',  qty: Math.max(Math.floor(item.stock * 0.3), 1), pct: 30 },
            { name: 'Mumbai WH', qty: Math.max(Math.floor(item.stock * 0.1), 1), pct: 10 },
          ].map(w => (
            <View key={w.name} style={styles.whRow}>
              <Text style={styles.whName}>{w.name}</Text>
              <View style={styles.whBarBg}>
                <View style={[styles.whBarFill, { width: `${w.pct}%` as any }]} />
              </View>
              <Text style={styles.whQty}>{w.qty} units</Text>
            </View>
          ))}
        </View>

        {/* Movement History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Movements</Text>
          {MOVEMENT_HISTORY.map((m, idx) => {
            const mi = MOV_ICON[m.type] || MOV_ICON.Purchase;
            return (
              <View key={m.id} style={[styles.movRow, idx < MOVEMENT_HISTORY.length - 1 && styles.movBorder]}>
                <View style={[styles.movIcon, { backgroundColor: mi.bg }]}>
                  <Ionicons name={mi.icon as any} size={14} color={mi.color} />
                </View>
                <View style={styles.movInfo}>
                  <Text style={styles.movType}>{m.type}</Text>
                  <Text style={styles.movParty}>{m.party} · {m.date}</Text>
                </View>
                <View style={styles.movRight}>
                  <Text style={[styles.movQty, { color: m.qty.startsWith('+') ? '#2D7D46' : '#DC2626' }]}>{m.qty}</Text>
                  <Text style={styles.movBal}>Bal: {m.balance}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          {[
            { label: 'Edit',     icon: 'pencil-outline',         color: '#2563EB', bg: '#EFF6FF' },
            { label: 'Reorder', icon: 'refresh-outline',         color: '#059669', bg: '#ECFDF5' },
            { label: 'Transfer', icon: 'swap-horizontal-outline', color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Delete',  icon: 'trash-outline',           color: '#DC2626', bg: '#FEF2F2' },
          ].map(a => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionBtn, { backgroundColor: a.bg }]}
              onPress={() => a.label === 'Delete'
                ? Alert.alert('Delete', `Delete ${item.name}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => router.back() },
                  ])
                : Alert.alert(a.label, `${a.label} ${item.name}`)
              }
              activeOpacity={0.7}
            >
              <Ionicons name={a.icon as any} size={20} color={a.color} />
              <Text style={[styles.actionLabel, { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  editBtn:     { width: 40, alignItems: 'flex-end' },
  scroll: { flex: 1 },

  heroRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },
  statusText:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  heroQtyBlock:  { alignItems: 'flex-end' },
  heroQty:       { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary },
  heroQtyLabel:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  infoGrid:  { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 0 },
  infoItem:  { width: '50%' },
  infoLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 2 },
  infoValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  whRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  whName:   { width: 80, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  whBarBg:  { flex: 1, height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  whBarFill:{ height: '100%', backgroundColor: COLORS.brandPrimary, borderRadius: 4 },
  whQty:    { width: 60, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, textAlign: 'right' },

  movRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  movBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  movIcon:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  movInfo:   { flex: 1 },
  movType:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  movParty:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  movRight:  { alignItems: 'flex-end' },
  movQty:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  movBal:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  actionsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 8,
  },
  actionBtn:   { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.md },
  actionLabel: { fontSize: 11, fontWeight: '700' },
});
