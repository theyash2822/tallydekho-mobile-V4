import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// Mock warehouse data indexed by id
const WAREHOUSE_DETAILS: Record<string, {
  name: string; location: string; type: string;
  totalItems: number; totalQty: number; totalValue: string;
  utilization: number; manager: string; phone: string;
  items: { item: string; group: string; qty: number; unit: string; value: string; available: number }[];
}> = {
  default: {
    name: 'Mumbai Main',
    location: '123, Andheri East, Mumbai, MH 400069',
    type: 'Primary Warehouse',
    totalItems: 18, totalQty: 420, totalValue: '₹1,24,80,000',
    utilization: 78, manager: 'Ramesh Sharma', phone: '+91 98765 43210',
    items: [
      { item: 'Laptop 15" Pro',       group: 'Electronics', qty: 20, unit: 'Pcs', value: '₹16,80,000', available: 18 },
      { item: 'Wireless Mouse',        group: 'Peripherals', qty: 85, unit: 'Pcs', value: '₹1,53,000',  available: 82 },
      { item: 'USB-C Hub',             group: 'Accessories', qty: 120, unit: 'Pcs', value: '₹2,64,000', available: 115 },
      { item: 'Mechanical Keyboard',   group: 'Peripherals', qty: 30, unit: 'Pcs', value: '₹20,70,000', available: 28 },
      { item: 'Monitor 27"',           group: 'Electronics', qty: 10, unit: 'Pcs', value: '₹14,70,000', available: 10 },
      { item: 'Headphones BT',         group: 'Audio',       qty: 40, unit: 'Pcs', value: '₹12,00,000', available: 38 },
      { item: 'Mouse Pad XL',          group: 'Accessories', qty: 60, unit: 'Pcs', value: '₹12,000',   available: 55 },
      { item: 'HDMI Cable 2m',         group: 'Accessories', qty: 55, unit: 'Pcs', value: '₹5,500',    available: 50 },
    ],
  },
  mum: {
    name: 'Mumbai Main', location: '123, Andheri East, Mumbai, MH 400069',
    type: 'Primary Warehouse', totalItems: 18, totalQty: 420, totalValue: '₹1,24,80,000',
    utilization: 78, manager: 'Ramesh Sharma', phone: '+91 98765 43210',
    items: [
      { item: 'Laptop 15" Pro',   group: 'Electronics', qty: 20, unit: 'Pcs', value: '₹16,80,000', available: 18 },
      { item: 'Wireless Mouse',   group: 'Peripherals', qty: 85, unit: 'Pcs', value: '₹1,53,000', available: 82 },
    ],
  },
};

export default function WarehouseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const warehouseId = (params.id as string) || 'default';
  const wh = WAREHOUSE_DETAILS[warehouseId] || WAREHOUSE_DETAILS['default'];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{wh.name}</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={s.infoCard}>
          <View style={s.infoTop}>
            <View style={s.warehouseIcon}>
              <Ionicons name="business-outline" size={28} color={COLORS.info} />
            </View>
            <View style={s.infoRight}>
              <Text style={s.whName}>{wh.name}</Text>
              <Text style={s.whType}>{wh.type}</Text>
              <View style={s.locationRow}>
                <Ionicons name="location-outline" size={12} color={COLORS.textTertiary} />
                <Text style={s.locationTxt} numberOfLines={2}>{wh.location}</Text>
              </View>
            </View>
          </View>
          <View style={s.managerRow}>
            <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
            <Text style={s.managerTxt}>{wh.manager}</Text>
            <Text style={s.managerPhone}>· {wh.phone}</Text>
          </View>
        </View>

        {/* Stats Strip */}
        <View style={s.statsStrip}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{wh.totalItems}</Text>
            <Text style={s.statLbl}>SKUs</Text>
          </View>
          <View style={s.statSep} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{wh.totalQty}</Text>
            <Text style={s.statLbl}>Total Qty</Text>
          </View>
          <View style={s.statSep} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{wh.totalValue}</Text>
            <Text style={s.statLbl}>Total Value</Text>
          </View>
        </View>

        {/* Utilization */}
        <View style={s.utilCard}>
          <View style={s.utilTop}>
            <Text style={s.utilLabel}>Capacity Utilization</Text>
            <Text style={[s.utilPct, { color: wh.utilization > 85 ? COLORS.negative : wh.utilization > 65 ? COLORS.warning : COLORS.positive }]}>
              {wh.utilization}%
            </Text>
          </View>
          <View style={s.utilTrack}>
            <View style={[s.utilFill, {
              width: `${wh.utilization}%` as any,
              backgroundColor: wh.utilization > 85 ? COLORS.negative : wh.utilization > 65 ? COLORS.warning : COLORS.positive,
            }]} />
          </View>
        </View>

        {/* Stock Items */}
        <View style={s.card}>
          <Text style={s.cardTitle}>On-Hand Stock</Text>
          <View style={[s.tableRow, s.tableHdr]}>
            <Text style={[s.th, { flex: 2.5 }]}>Item</Text>
            <Text style={[s.th, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
            <Text style={[s.th, { flex: 0.8, textAlign: 'center' }]}>Avail</Text>
            <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
          </View>
          {wh.items.map((item, idx) => (
            <View key={item.item} style={[s.tableRow, idx % 2 === 0 && s.tableRowAlt]}>
              <View style={{ flex: 2.5, gap: 2 }}>
                <Text style={s.itemName} numberOfLines={1}>{item.item}</Text>
                <Text style={s.itemGroup}>{item.group}</Text>
              </View>
              <Text style={[s.td, { flex: 0.8, textAlign: 'center' }]}>{item.qty}</Text>
              <Text style={[s.td, { flex: 0.8, textAlign: 'center', color: item.available < item.qty * 0.2 ? COLORS.negative : COLORS.positive, fontWeight: '600' }]}>
                {item.available}
              </Text>
              <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700', color: COLORS.textPrimary }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/stocks/create-transfer' as any)} activeOpacity={0.7}>
            <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.info} />
            <Text style={[s.actionTxt, { color: COLORS.info }]}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/stocks/create-adjustment' as any)} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={16} color={COLORS.warning} />
            <Text style={[s.actionTxt, { color: COLORS.warning }]}>Adjust</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: COLORS.brandPrimary }]} onPress={() => {}} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={[s.actionTxt, { color: COLORS.white }]}>Export</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  infoCard:    { margin: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, gap: SPACING.sm },
  infoTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  warehouseIcon: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.infoBg, alignItems: 'center', justifyContent: 'center' },
  infoRight:   { flex: 1, gap: 4 },
  whName:      { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  whType:      { fontSize: TYPOGRAPHY.xs, color: COLORS.info, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 },
  locationTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 16 },
  managerRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: SPACING.sm },
  managerTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  managerPhone:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  statsStrip:  { flexDirection: 'row', marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.sm },
  statItem:    { flex: 1, alignItems: 'center', gap: 2 },
  statSep:     { width: 1, height: 32, backgroundColor: COLORS.borderDefault },
  statVal:     { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  statLbl:     { fontSize: 10, color: COLORS.textSecondary },
  utilCard:    { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  utilTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  utilLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  utilPct:     { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  utilTrack:   { height: 10, backgroundColor: COLORS.borderDefault, borderRadius: 5, overflow: 'hidden' },
  utilFill:    { height: '100%', borderRadius: 5 },
  card:        { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', padding: SPACING.sm },
  cardTitle:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm, paddingHorizontal: SPACING.sm },
  tableHdr:    { backgroundColor: COLORS.pageBg, borderBottomWidth: 1.5, borderBottomColor: COLORS.borderStrong },
  tableRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, gap: 4 },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  th:          { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  td:          { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemName:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  itemGroup:   { fontSize: 9, color: COLORS.textTertiary },
  actionRow:   { flexDirection: 'row', gap: 10, marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  actionTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
});
