import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const GROUPS: DropdownOption[] = [
  { label: 'All Groups', value: 'all' },
  { label: 'Electronics', value: 'electronics' },
  { label: 'Peripherals', value: 'peripherals' },
  { label: 'Accessories', value: 'accessories' },
];

const VALUATION_DATA = [
  { group: 'Electronics',  items: 8,  qty: 142,  avgRate: '₹84,200', totalValue: '₹1,19,56,400', pct: 48.2 },
  { group: 'Peripherals',  items: 12, qty: 316,  avgRate: '₹1,840',  totalValue: '₹58,14,400',  pct: 23.4 },
  { group: 'Accessories',  items: 24, qty: 890,  avgRate: '₹480',    totalValue: '₹42,72,000',  pct: 17.2 },
  { group: 'Audio',        items: 6,  qty: 74,   avgRate: '₹3,200',  totalValue: '₹23,68,000',  pct: 9.5 },
  { group: 'Others',       items: 4,  qty: 38,   avgRate: '₹420',    totalValue: '₹15,96,000',  pct: 1.7 },
];

const VALUATION_METHODS: DropdownOption[] = [
  { label: 'FIFO (First In, First Out)', value: 'fifo' },
  { label: 'Weighted Average', value: 'avg' },
  { label: 'LIFO (Last In, First Out)', value: 'lifo' },
];

export default function ValuationSummaryScreen() {
  const router = useRouter();
  const [group, setGroup] = useState('all');
  const [method, setMethod] = useState('fifo');

  const filtered = group === 'all' ? VALUATION_DATA : VALUATION_DATA.filter(v => v.group.toLowerCase() === group);
  const totalValue = '₹2,60,06,800';
  const totalItems = filtered.reduce((a, v) => a + v.items, 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Valuation Summary</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Filters */}
        <View style={s.filterRow}>
          <FormDropdown label="Group" value={group} options={GROUPS} onSelect={o => setGroup(o.value)} placeholder="Select group" containerStyle={{ flex: 1, marginBottom: 0 }} />
          <FormDropdown label="Method" value={method} options={VALUATION_METHODS} onSelect={o => setMethod(o.value)} placeholder="Valuation method" containerStyle={{ flex: 1.3, marginBottom: 0 }} />
        </View>

        {/* Total Banner */}
        <View style={s.totalBanner}>
          <View>
            <Text style={s.totalLabel}>Total Stock Value</Text>
            <Text style={s.totalValue}>{totalValue}</Text>
          </View>
          <View style={s.totalRight}>
            <Text style={s.totalItemsVal}>{totalItems}</Text>
            <Text style={s.totalItemsLbl}>SKUs</Text>
          </View>
        </View>

        {/* Valuation Table */}
        <View style={s.card}>
          {/* Table Header */}
          <View style={[s.tableRow, s.tableHdr]}>
            <Text style={[s.th, { flex: 2 }]}>Group</Text>
            <Text style={[s.th, { flex: 0.8, textAlign: 'center' }]}>Items</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Qty</Text>
            <Text style={[s.th, { flex: 1.8, textAlign: 'right' }]}>Total Value</Text>
            <Text style={[s.th, { flex: 0.8, textAlign: 'right' }]}>%</Text>
          </View>

          {filtered.map((row, idx) => (
            <View key={row.group} style={[s.tableRow, idx % 2 === 0 && s.tableRowAlt]}>
              <View style={{ flex: 2, gap: 3 }}>
                <Text style={s.groupName}>{row.group}</Text>
                <Text style={s.avgRate}>Avg: {row.avgRate}</Text>
              </View>
              <Text style={[s.td, { flex: 0.8, textAlign: 'center' }]}>{row.items}</Text>
              <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{row.qty}</Text>
              <Text style={[s.td, { flex: 1.8, textAlign: 'right', fontWeight: '700', color: COLORS.textPrimary }]}>{row.totalValue}</Text>
              <View style={{ flex: 0.8, alignItems: 'flex-end' }}>
                <View style={s.pctBar}>
                  <View style={[s.pctFill, { width: `${row.pct}%` as any }]} />
                </View>
                <Text style={s.pctTxt}>{row.pct}%</Text>
              </View>
            </View>
          ))}

          {/* Total Row */}
          <View style={[s.tableRow, s.totalRow]}>
            <Text style={[s.totalCell, { flex: 2 }]}>TOTAL</Text>
            <Text style={[s.totalCell, { flex: 0.8, textAlign: 'center' }]}>{totalItems}</Text>
            <Text style={[s.totalCell, { flex: 1, textAlign: 'right' }]}>1,460</Text>
            <Text style={[s.totalCell, { flex: 1.8, textAlign: 'right' }]}>{totalValue}</Text>
            <Text style={[s.totalCell, { flex: 0.8, textAlign: 'right' }]}>100%</Text>
          </View>
        </View>

        {/* Valuation Method Note */}
        <View style={s.noteCard}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
          <Text style={s.noteTxt}>
            Valuation using <Text style={{ fontWeight: '700' }}>FIFO</Text> method.
            Stock value reflects purchase cost, excluding overheads and duties.
          </Text>
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
  filterRow: { flexDirection: 'row', gap: 10, margin: SPACING.md },
  totalBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  totalLabel: { fontSize: TYPOGRAPHY.xs, color: '#AEACA8', marginBottom: 4 },
  totalValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.white },
  totalRight: { alignItems: 'center' },
  totalItemsVal: { fontSize: TYPOGRAPHY.xxl, fontWeight: '800', color: COLORS.white },
  totalItemsLbl: { fontSize: TYPOGRAPHY.xs, color: '#AEACA8' },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tableHdr: { backgroundColor: COLORS.pageBg, borderBottomWidth: 1.5, borderBottomColor: COLORS.borderStrong },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, gap: 4 },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  th: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase' },
  td: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  groupName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  avgRate:   { fontSize: 10, color: COLORS.textTertiary },
  pctBar:    { width: 36, height: 4, backgroundColor: COLORS.borderDefault, borderRadius: 2, overflow: 'hidden' },
  pctFill:   { height: '100%', backgroundColor: COLORS.positive, borderRadius: 2 },
  pctTxt:    { fontSize: 9, color: COLORS.textTertiary, marginTop: 1 },
  totalRow:  { backgroundColor: COLORS.activeBg, borderTopWidth: 1.5, borderTopColor: COLORS.borderStrong },
  totalCell: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  noteCard:  { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.md, padding: SPACING.md },
  noteTxt:   { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.info, lineHeight: 18 },
});
