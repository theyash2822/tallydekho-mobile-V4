import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const WAREHOUSES_OPT: DropdownOption[] = [
  { label: 'All Warehouses', value: 'all' },
  { label: 'Mumbai Main', value: 'mumbai' },
  { label: 'Delhi Branch', value: 'delhi' },
  { label: 'Pune Godown', value: 'pune' },
];

const TRANSFERS = [
  { id: 'st1', ref: 'ST-00091', date: '15 Jun 25', time: '11:42 AM', item: 'Laptop 15" Pro',       qty: 5,  unit: 'Pcs',  from: 'Delhi Branch',   to: 'Mumbai Main',  by: 'Ashish K.',  status: 'completed', value: '₹4,25,000' },
  { id: 'st2', ref: 'ST-00090', date: '14 Jun 25', time: '09:15 AM', item: 'USB-C Hub',            qty: 20, unit: 'Pcs',  from: 'Mumbai Main',    to: 'Pune Godown',  by: 'Ramesh S.',  status: 'completed', value: '₹18,000' },
  { id: 'st3', ref: 'ST-00089', date: '13 Jun 25', time: '03:30 PM', item: 'Wireless Mouse',       qty: 15, unit: 'Pcs',  from: 'Pune Godown',    to: 'Delhi Branch', by: 'Priya M.',   status: 'pending', value: '₹12,750' },
  { id: 'st4', ref: 'ST-00088', date: '12 Jun 25', time: '10:00 AM', item: 'Mechanical Keyboard',  qty: 8,  unit: 'Pcs',  from: 'Delhi Branch',   to: 'Mumbai Main',  by: 'Ashish K.',  status: 'completed', value: '₹56,000' },
  { id: 'st5', ref: 'ST-00087', date: '10 Jun 25', time: '02:20 PM', item: 'Monitor 27"',          qty: 3,  unit: 'Pcs',  from: 'Mumbai Main',    to: 'Delhi Branch', by: 'Ramesh S.',  status: 'completed', value: '₹45,000' },
  { id: 'st6', ref: 'ST-00086', date: '08 Jun 25', time: '11:00 AM', item: 'Headphones BT',        qty: 12, unit: 'Pcs',  from: 'Pune Godown',    to: 'Mumbai Main',  by: 'Priya M.',   status: 'cancelled', value: '₹36,000' },
];

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  completed: { color: COLORS.positive, bg: COLORS.positiveBg,  label: 'Completed' },
  pending:   { color: COLORS.warning,  bg: COLORS.warningBg,   label: 'Pending'   },
  cancelled: { color: COLORS.negative, bg: COLORS.negativeBg,  label: 'Cancelled' },
};

export default function TransferHistoryScreen() {
  const router = useRouter();
  const [warehouse, setWarehouse] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = TRANSFERS.filter(t => {
    const whMatch = warehouse === 'all' ||
      t.from.toLowerCase().includes(warehouse) ||
      t.to.toLowerCase().includes(warehouse);
    const srchMatch = !search ||
      t.ref.toLowerCase().includes(search.toLowerCase()) ||
      t.item.toLowerCase().includes(search.toLowerCase());
    return whMatch && srchMatch;
  });

  const totalTransferred = filtered.reduce((a, t) => a + t.qty, 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transfer History</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Filters */}
        <View style={s.filterRow}>
          <FormDropdown label="Warehouse" value={warehouse} options={WAREHOUSES_OPT} onSelect={o => setWarehouse(o.value)} placeholder="All Warehouses" containerStyle={{ flex: 1, marginBottom: 0 }} />
        </View>

        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search reference or item..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{filtered.length}</Text>
            <Text style={s.summaryLbl}>Transfers</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{totalTransferred}</Text>
            <Text style={s.summaryLbl}>Units Moved</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{filtered.filter(t => t.status === 'completed').length}</Text>
            <Text style={s.summaryLbl}>Completed</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryVal, { color: COLORS.warning }]}>{filtered.filter(t => t.status === 'pending').length}</Text>
            <Text style={s.summaryLbl}>Pending</Text>
          </View>
        </View>

        {/* Transfer List */}
        <View style={s.card}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="swap-horizontal-outline" size={40} color={COLORS.borderStrong} />
              <Text style={s.emptyTxt}>No transfers found</Text>
            </View>
          ) : (
            filtered.map((tx, idx) => {
              const cfg = STATUS_CFG[tx.status];
              return (
                <View key={tx.id} style={[s.txRow, idx < filtered.length - 1 && s.txBorder]}>
                  <View style={[s.txIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name="swap-horizontal-outline" size={20} color={cfg.color} />
                  </View>
                  <View style={s.txInfo}>
                    <View style={s.txTop}>
                      <Text style={s.txRef}>{tx.ref}</Text>
                      <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text style={s.txItem} numberOfLines={1}>{tx.item}</Text>
                    <View style={s.txRoute}>
                      <Text style={s.txWh}>{tx.from}</Text>
                      <Ionicons name="arrow-forward" size={12} color={COLORS.textTertiary} />
                      <Text style={s.txWh}>{tx.to}</Text>
                    </View>
                    <View style={s.txMeta}>
                      <Text style={s.txDate}>{tx.date} · {tx.time}</Text>
                      <Text style={s.txBy}>By: {tx.by}</Text>
                    </View>
                  </View>
                  <View style={s.txRight}>
                    <Text style={s.txQty}>+{tx.qty} {tx.unit}</Text>
                    <Text style={s.txValue}>{tx.value}</Text>
                  </View>
                </View>
              );
            })
          )}
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
  filterRow: { flexDirection: 'row', gap: 10, margin: SPACING.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchIn:  { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  summaryRow: { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', gap: 2 },
  summaryVal:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl:  { fontSize: 9, color: COLORS.textSecondary, textAlign: 'center' },
  card:    { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  empty:   { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTxt:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  txRow:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  txBorder:   { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIcon:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  txInfo:     { flex: 1, gap: 3 },
  txTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txRef:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusTxt:  { fontSize: 10, fontWeight: '700' },
  txItem:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  txRoute:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  txWh:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  txMeta:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  txDate:     { fontSize: 10, color: COLORS.textTertiary },
  txBy:       { fontSize: 10, color: COLORS.textTertiary },
  txRight:    { alignItems: 'flex-end', gap: 3 },
  txQty:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.positive },
  txValue:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
});
