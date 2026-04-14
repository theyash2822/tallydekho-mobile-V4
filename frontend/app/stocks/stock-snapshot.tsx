import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const DATES = ['01 Jun 25', '15 Jun 25', '01 May 25', '31 Mar 25', '01 Apr 25'];

const SNAPSHOT_DATA = [
  { item: 'Laptop 15" Pro',       group: 'Electronics', qty: 47,  unit: 'Pcs', value: '₹39,68,000', rate: '₹84,000' },
  { item: 'Wireless Mouse',       group: 'Peripherals', qty: 186, unit: 'Pcs', value: '₹3,53,400',  rate: '₹1,900'  },
  { item: 'USB-C Hub',            group: 'Accessories', qty: 240, unit: 'Pcs', value: '₹5,28,000',  rate: '₹2,200'  },
  { item: 'Mechanical Keyboard',  group: 'Peripherals', qty: 68,  unit: 'Pcs', value: '₹46,92,000', rate: '₹69,000' },
  { item: 'Monitor 27"',          group: 'Electronics', qty: 22,  unit: 'Pcs', value: '₹32,34,000', rate: '₹1,47,000' },
  { item: 'Headphones BT',        group: 'Audio',       qty: 74,  unit: 'Pcs', value: '₹22,20,000', rate: '₹3,000'  },
];

export default function StockSnapshotScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(DATES[1]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const totalValue = '₹1,49,95,400';
  const totalItems = SNAPSHOT_DATA.length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Snapshot</Text>
        <TouchableOpacity style={s.exportBtn} onPress={() => Alert.alert('Export', 'Exporting snapshot...')} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Date Picker */}
        <View style={s.datePicker}>
          <View style={s.dateLeft}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.info} />
            <Text style={s.dateLabel}>As of Date</Text>
          </View>
          <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(!showDatePicker)} activeOpacity={0.7}>
            <Text style={s.dateBtnTxt}>{selectedDate}</Text>
            <Ionicons name={showDatePicker ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textTertiary} />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <View style={s.dateDropdown}>
            {DATES.map(d => (
              <TouchableOpacity key={d} style={s.dateOption} onPress={() => { setSelectedDate(d); setShowDatePicker(false); }} activeOpacity={0.7}>
                <Text style={[s.dateOptionTxt, d === selectedDate && s.dateOptionActive]}>{d}</Text>
                {d === selectedDate && <Ionicons name="checkmark" size={16} color={COLORS.positive} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Total Banner */}
        <View style={s.banner}>
          <View>
            <Text style={s.bannerSub}>Total Stock Value on {selectedDate}</Text>
            <Text style={s.bannerValue}>{totalValue}</Text>
          </View>
          <View style={s.bannerRight}>
            <Text style={s.bannerCount}>{totalItems}</Text>
            <Text style={s.bannerCountLbl}>Items</Text>
          </View>
        </View>

        {/* Snapshot Table */}
        <View style={s.card}>
          <View style={[s.tableRow, s.tableHdr]}>
            <Text style={[s.th, { flex: 2 }]}>Item</Text>
            <Text style={[s.th, { flex: 0.8, textAlign: 'center' }]}>Qty</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Rate</Text>
            <Text style={[s.th, { flex: 1.5, textAlign: 'right' }]}>Value</Text>
          </View>
          {SNAPSHOT_DATA.map((item, idx) => (
            <View key={item.item} style={[s.tableRow, idx % 2 === 0 && s.tableRowAlt]}>
              <View style={{ flex: 2, gap: 2 }}>
                <Text style={s.itemName} numberOfLines={1}>{item.item}</Text>
                <Text style={s.itemGroup}>{item.group}</Text>
              </View>
              <Text style={[s.td, { flex: 0.8, textAlign: 'center' }]}>{item.qty} {item.unit}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{item.rate}</Text>
              <Text style={[s.td, { flex: 1.5, textAlign: 'right', fontWeight: '700', color: COLORS.textPrimary }]}>{item.value}</Text>
            </View>
          ))}
          {/* Total Row */}
          <View style={[s.tableRow, s.totalRow]}>
            <Text style={[s.totalCell, { flex: 2 }]}>TOTAL</Text>
            <Text style={[s.totalCell, { flex: 0.8, textAlign: 'center' }]}>-</Text>
            <Text style={[s.totalCell, { flex: 1, textAlign: 'right' }]}>-</Text>
            <Text style={[s.totalCell, { flex: 1.5, textAlign: 'right' }]}>{totalValue}</Text>
          </View>
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
  scroll:  { flex: 1 },
  datePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  dateLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel:  { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  dateBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  dateDropdown: { marginHorizontal: SPACING.md, marginTop: -SPACING.sm, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', marginBottom: SPACING.sm },
  dateOption:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dateOptionTxt:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  dateOptionActive: { color: COLORS.positive, fontWeight: '700' },
  banner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, padding: SPACING.md },
  bannerSub:   { fontSize: TYPOGRAPHY.xs, color: '#AEACA8', marginBottom: 4 },
  bannerValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.white },
  bannerRight: { alignItems: 'center' },
  bannerCount: { fontSize: TYPOGRAPHY.xxl, fontWeight: '800', color: COLORS.white },
  bannerCountLbl: { fontSize: TYPOGRAPHY.xs, color: '#AEACA8' },
  card:    { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tableHdr: { backgroundColor: COLORS.pageBg, borderBottomWidth: 1.5, borderBottomColor: COLORS.borderStrong },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, gap: 4 },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  th: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  td: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemGroup: { fontSize: 10, color: COLORS.textTertiary },
  totalRow:  { backgroundColor: COLORS.activeBg, borderTopWidth: 1.5, borderTopColor: COLORS.borderStrong },
  totalCell: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
});
