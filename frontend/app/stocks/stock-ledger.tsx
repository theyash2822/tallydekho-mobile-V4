import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const ITEMS = [
  'All Items', 'Laptop 15" Pro', 'Wireless Mouse', 'USB-C Hub', 'Mechanical Keyboard', 'Monitor 27"', 'Headphones BT',
];

const TRANSACTIONS = [
  { id: 't1', date: '15 Jun 25', ref: 'INV-30979', type: 'Sales',    qty: '-5',  balance: 42, rate: '₹85,000', value: '₹43.3L' },
  { id: 't2', date: '14 Jun 25', ref: 'PO-00124',  type: 'Purchase', qty: '+20', balance: 47, rate: '₹78,000', value: '₹39.8L' },
  { id: 't3', date: '13 Jun 25', ref: 'ST-00082',  type: 'Transfer', qty: '-3',  balance: 27, rate: '₹82,000', value: '₹22.1L' },
  { id: 't4', date: '12 Jun 25', ref: 'INV-30978', type: 'Sales',    qty: '-8',  balance: 30, rate: '₹85,000', value: '₹25.5L' },
  { id: 't5', date: '10 Jun 25', ref: 'PO-00123',  type: 'Purchase', qty: '+15', balance: 38, rate: '₹77,500', value: '₹29.4L' },
  { id: 't6', date: '05 Jun 25', ref: 'INV-30975', type: 'Sales',    qty: '-4',  balance: 23, rate: '₹85,000', value: '₹19.5L' },
  { id: 't7', date: '01 Jun 25', ref: 'OB-00001',  type: 'Opening',  qty: '+12', balance: 27, rate: '₹80,000', value: '₹21.6L' },
];

const TYPE_COLOR: Record<string, string> = {
  Sales: COLORS.positive, Purchase: COLORS.info, Transfer: '#7C3AED', Opening: '#D97706',
};

export default function StockLedgerScreen() {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState('Laptop 15" Pro');
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const filteredTx = useMemo(() =>
    TRANSACTIONS.filter(t =>
      !search || t.ref.toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase())
    ),
    [search]
  );

  const totalIn  = filteredTx.filter(t => t.qty.startsWith('+')).reduce((a, t) => a + parseInt(t.qty), 0);
  const totalOut = filteredTx.filter(t => t.qty.startsWith('-')).reduce((a, t) => a + Math.abs(parseInt(t.qty)), 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Ledger</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Item Selector */}
        <View style={s.itemSelector}>
          <TouchableOpacity style={s.itemPickerBtn} onPress={() => setShowPicker(!showPicker)} activeOpacity={0.7}>
            <View style={s.itemPickerLeft}>
              <View style={s.itemDot} />
              <Text style={s.itemPickerTxt}>{selectedItem}</Text>
            </View>
            <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
          {showPicker && (
            <View style={s.pickerDropdown}>
              {ITEMS.map(item => (
                <TouchableOpacity key={item} style={s.pickerItem} onPress={() => { setSelectedItem(item); setShowPicker(false); }} activeOpacity={0.7}>
                  <Text style={[s.pickerItemTxt, selectedItem === item && s.pickerItemActive]}>{item}</Text>
                  {selectedItem === item && <Ionicons name="checkmark" size={16} color={COLORS.positive} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Summary Strip */}
        <View style={s.summaryStrip}>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>42</Text>
            <Text style={s.summaryLbl}>Closing Qty</Text>
          </View>
          <View style={s.summarySep} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryVal, { color: COLORS.positive }]}>+{totalIn}</Text>
            <Text style={s.summaryLbl}>Total In</Text>
          </View>
          <View style={s.summarySep} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryVal, { color: COLORS.negative }]}>-{totalOut}</Text>
            <Text style={s.summaryLbl}>Total Out</Text>
          </View>
          <View style={s.summarySep} />
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>₹35.7L</Text>
            <Text style={s.summaryLbl}>Value</Text>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search reference or type..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>

        {/* Transaction List */}
        <View style={s.card}>
          {/* Table Header */}
          <View style={[s.tableRow, s.tableHeader]}>
            <Text style={[s.th, { flex: 1.2 }]}>Date</Text>
            <Text style={[s.th, { flex: 1.5 }]}>Reference</Text>
            <Text style={[s.th, { flex: 0.8, textAlign: 'right' }]}>Qty</Text>
            <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Balance</Text>
            <Text style={[s.th, { flex: 1.2, textAlign: 'right' }]}>Value</Text>
          </View>

          {filteredTx.map((tx, idx) => {
            const tc = TYPE_COLOR[tx.type] || COLORS.textSecondary;
            return (
              <View key={tx.id} style={[s.tableRow, idx % 2 === 0 && s.tableRowAlt]}>
                <View style={{ flex: 1.2 }}>
                  <Text style={s.txDate}>{tx.date}</Text>
                  <View style={[s.typeBadge, { backgroundColor: tc + '18' }]}>
                    <Text style={[s.typeTxt, { color: tc }]}>{tx.type}</Text>
                  </View>
                </View>
                <Text style={[s.td, { flex: 1.5 }]}>{tx.ref}</Text>
                <Text style={[s.td, { flex: 0.8, textAlign: 'right', color: tx.qty.startsWith('+') ? COLORS.positive : COLORS.negative, fontWeight: '700' }]}>{tx.qty}</Text>
                <Text style={[s.td, { flex: 1, textAlign: 'right' }]}>{tx.balance}</Text>
                <Text style={[s.td, { flex: 1.2, textAlign: 'right', fontWeight: '600' }]}>{tx.value}</Text>
              </View>
            );
          })}
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

  itemSelector: { margin: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  itemPickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  itemPickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.info },
  itemPickerTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  pickerDropdown: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  pickerItemTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  pickerItemActive: { color: COLORS.positive, fontWeight: '700' },

  summaryStrip: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.sm },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summarySep:  { width: 1, height: 32, backgroundColor: COLORS.borderDefault },
  summaryVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl:  { fontSize: 10, color: COLORS.textSecondary },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchIn:  { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  card: { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tableHeader: { backgroundColor: COLORS.pageBg, borderBottomWidth: 1.5, borderBottomColor: COLORS.borderStrong },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, gap: 4 },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  th:  { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  td:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary },
  txDate: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
  typeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  typeTxt: { fontSize: 9, fontWeight: '700' },
});
