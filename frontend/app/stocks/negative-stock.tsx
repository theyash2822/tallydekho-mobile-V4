import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const NEGATIVE_ITEMS = [
  { id: 'n1', item: 'Laptop 15" Pro',       group: 'Electronics', qty: -3,   unit: 'Pcs',  value: '₹-2,52,000', reason: 'Over-committed in Sales Order', warehouse: 'Delhi Branch',  lastTx: '15 Jun 25' },
  { id: 'n2', item: 'USB-C Hub 7-Port',    group: 'Accessories', qty: -12,  unit: 'Pcs',  value: '₹-26,400',   reason: 'Delivery before receipt posted', warehouse: 'Mumbai Main',  lastTx: '14 Jun 25' },
  { id: 'n3', item: 'Wireless Earbuds',    group: 'Audio',       qty: -5,   unit: 'Pcs',  value: '₹-15,000',   reason: 'Stock adjustment not reconciled', warehouse: 'Pune Godown',  lastTx: '12 Jun 25' },
  { id: 'n4', item: 'Mouse Pad XL',        group: 'Accessories', qty: -20,  unit: 'Pcs',  value: '₹-4,000',    reason: 'Transfer not received',          warehouse: 'Delhi Branch',  lastTx: '10 Jun 25' },
  { id: 'n5', item: 'HDMI Cable 2m',       group: 'Accessories', qty: -35,  unit: 'Pcs',  value: '₹-3,500',    reason: 'Sales without stock entry',     warehouse: 'Mumbai Main',  lastTx: '08 Jun 25' },
];

export default function NegativeStockScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = NEGATIVE_ITEMS.filter(item =>
    !search ||
    item.item.toLowerCase().includes(search.toLowerCase()) ||
    item.warehouse.toLowerCase().includes(search.toLowerCase())
  );

  const totalNegValue = '₹-3,00,900';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Negative Stock</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Alert Banner */}
        <View style={s.alertBanner}>
          <Ionicons name="warning" size={20} color={COLORS.negative} />
          <View style={s.alertInfo}>
            <Text style={s.alertTitle}>{NEGATIVE_ITEMS.length} Items with Negative Stock</Text>
            <Text style={s.alertSub}>Total negative value: {totalNegValue}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search item or warehouse..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>

        {/* Items List */}
        <View style={s.card}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.positive} />
              <Text style={s.emptyTxt}>No negative stock found</Text>
            </View>
          ) : (
            filtered.map((item, idx) => (
              <View key={item.id} style={[s.itemRow, idx < filtered.length - 1 && s.itemBorder]}>
                <View style={s.itemIcon}>
                  <Ionicons name="warning-outline" size={20} color={COLORS.negative} />
                </View>
                <View style={s.itemInfo}>
                  <View style={s.itemTop}>
                    <Text style={s.itemName}>{item.item}</Text>
                    <Text style={[s.itemQty]}>{item.qty} {item.unit}</Text>
                  </View>
                  <Text style={s.itemGroup}>{item.group} · {item.warehouse}</Text>
                  <Text style={s.itemReason}>{item.reason}</Text>
                  <View style={s.itemBottom}>
                    <Text style={s.itemDate}>Last Tx: {item.lastTx}</Text>
                    <Text style={s.itemValue}>{item.value}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* How to Fix */}
        <View style={s.howToCard}>
          <View style={s.howToHdr}>
            <Ionicons name="bulb-outline" size={18} color={COLORS.warning} />
            <Text style={s.howToTitle}>How to Fix</Text>
          </View>
          {[
            'Post pending purchase receipts for missing items',
            'Reconcile stock adjustments with physical count',
            'Review and correct sales orders vs available stock',
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={s.tipNum}>{i + 1}.</Text>
              <Text style={s.tipTxt}>{tip}</Text>
            </View>
          ))}
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
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  exportBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  alertBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, margin: SPACING.md, backgroundColor: COLORS.negativeBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: '#FCA5A5' },
  alertInfo:  { flex: 1 },
  alertTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.negative },
  alertSub:   { fontSize: TYPOGRAPHY.xs, color: '#9B1C1C', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchIn:  { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  itemRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  itemIcon:   { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.negativeBg, alignItems: 'center', justifyContent: 'center' },
  itemInfo:   { flex: 1, gap: 3 },
  itemTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemQty:    { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.negative },
  itemGroup:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemReason: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, fontStyle: 'italic' },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemDate:   { fontSize: 10, color: COLORS.textTertiary },
  itemValue:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative },
  howToCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#FDE68A', padding: SPACING.md },
  howToHdr:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  howToTitle:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.warning },
  tipRow:    { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  tipNum:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.warning },
  tipTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: '#92400E', lineHeight: 20 },
});
