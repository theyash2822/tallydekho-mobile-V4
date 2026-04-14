import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

type AlertPeriod = '7' | '15' | '30' | '60' | '90';

const ALERT_OPTIONS: DropdownOption[] = [
  { label: 'Expiring in 7 days',  value: '7'  },
  { label: 'Expiring in 15 days', value: '15' },
  { label: 'Expiring in 30 days', value: '30' },
  { label: 'Expiring in 60 days', value: '60' },
  { label: 'Expiring in 90 days', value: '90' },
];

const WAREHOUSES_OPT: DropdownOption[] = [
  { label: 'All Warehouses', value: 'all' },
  { label: 'Mumbai Main',    value: 'mum' },
  { label: 'Delhi Branch',   value: 'del' },
  { label: 'Pune Godown',    value: 'pun' },
];

const EXPIRY_ITEMS = [
  { id: 'ex1', item: 'Antibiotics 500mg',   batch: 'B-2024-112', qty: 48,  unit: 'Box',   expiry: '18 Jun 25', days: 3,  warehouse: 'Mumbai Main',  value: '₹14,400' },
  { id: 'ex2', item: 'Vitamin C 1000mg',    batch: 'B-2024-089', qty: 120, unit: 'Strip', expiry: '22 Jun 25', days: 7,  warehouse: 'Delhi Branch', value: '₹6,000' },
  { id: 'ex3', item: 'Hand Sanitizer 500ml',batch: 'B-2024-201', qty: 36,  unit: 'Pcs',  expiry: '25 Jun 25', days: 10, warehouse: 'Mumbai Main',  value: '₹2,880' },
  { id: 'ex4', item: 'Face Masks (50 pcs)', batch: 'B-2024-156', qty: 200, unit: 'Box',   expiry: '30 Jun 25', days: 15, warehouse: 'Pune Godown',  value: '₹20,000' },
  { id: 'ex5', item: 'Paracetamol 650mg',   batch: 'B-2024-078', qty: 80,  unit: 'Strip', expiry: '05 Jul 25', days: 20, warehouse: 'Delhi Branch', value: '₹3,200' },
  { id: 'ex6', item: 'Cough Syrup 200ml',   batch: 'B-2024-193', qty: 24,  unit: 'Btl',  expiry: '12 Jul 25', days: 27, warehouse: 'Mumbai Main',  value: '₹5,760' },
  { id: 'ex7', item: 'Eye Drops 10ml',      batch: 'B-2024-167', qty: 60,  unit: 'Pcs',  expiry: '14 Jul 25', days: 29, warehouse: 'Pune Godown',  value: '₹8,400' },
];

function getUrgencyColor(days: number): string {
  if (days <= 7) return '#C0392B';
  if (days <= 15) return '#D97706';
  return '#2563EB';
}

function getUrgencyBg(days: number): string {
  if (days <= 7) return '#FDECEA';
  if (days <= 15) return '#FFFBEB';
  return '#EFF6FF';
}

export default function ExpiryScheduleScreen() {
  const router = useRouter();
  const [alertPeriod, setAlertPeriod] = useState<string>('30');
  const [warehouse, setWarehouse] = useState('all');

  const filtered = EXPIRY_ITEMS.filter(item => {
    const daysMatch = item.days <= parseInt(alertPeriod);
    const whMatch = warehouse === 'all' || item.warehouse.toLowerCase().includes(warehouse);
    return daysMatch && whMatch;
  });

  const critical  = filtered.filter(i => i.days <= 7).length;
  const warning   = filtered.filter(i => i.days > 7 && i.days <= 15).length;
  const upcoming  = filtered.filter(i => i.days > 15).length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Expiry Schedule</Text>
        <TouchableOpacity style={s.exportBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Filters */}
        <View style={s.filterRow}>
          <FormDropdown label="Alert Period" value={alertPeriod} options={ALERT_OPTIONS} onSelect={o => setAlertPeriod(o.value)} placeholder="Alert period" containerStyle={{ flex: 1, marginBottom: 0 }} />
          <FormDropdown label="Warehouse" value={warehouse} options={WAREHOUSES_OPT} onSelect={o => setWarehouse(o.value)} placeholder="Warehouse" containerStyle={{ flex: 1, marginBottom: 0 }} />
        </View>

        {/* Summary Strip */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderLeftColor: '#C0392B' }]}>
            <Text style={[s.summaryVal, { color: '#C0392B' }]}>{critical}</Text>
            <Text style={s.summaryLbl}>Critical
              (≤7 days)</Text>
          </View>
          <View style={[s.summaryCard, { borderLeftColor: '#D97706' }]}>
            <Text style={[s.summaryVal, { color: '#D97706' }]}>{warning}</Text>
            <Text style={s.summaryLbl}>Warning
              (≤15 days)</Text>
          </View>
          <View style={[s.summaryCard, { borderLeftColor: '#2563EB' }]}>
            <Text style={[s.summaryVal, { color: '#2563EB' }]}>{upcoming}</Text>
            <Text style={s.summaryLbl}>Upcoming
              (≤30 days)</Text>
          </View>
        </View>

        {/* Item List */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Items Expiring Soon ({filtered.length})</Text>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.positive} />
              <Text style={s.emptyTxt}>No items expiring in this period</Text>
            </View>
          ) : (
            filtered.map((item, idx) => {
              const urgColor = getUrgencyColor(item.days);
              const urgBg    = getUrgencyBg(item.days);
              return (
                <View key={item.id} style={[s.itemRow, idx < filtered.length - 1 && s.itemBorder]}>
                  <View style={[s.urgDot, { backgroundColor: urgColor }]} />
                  <View style={s.itemInfo}>
                    <View style={s.itemTop}>
                      <Text style={s.itemName}>{item.item}</Text>
                      <View style={[s.urgBadge, { backgroundColor: urgBg }]}>
                        <Text style={[s.urgTxt, { color: urgColor }]}>{item.days}d left</Text>
                      </View>
                    </View>
                    <View style={s.itemMeta}>
                      <Text style={s.metaTxt}>Batch: {item.batch}</Text>
                      <Text style={s.metaSep}>·</Text>
                      <Text style={s.metaTxt}>{item.qty} {item.unit}</Text>
                      <Text style={s.metaSep}>·</Text>
                      <Text style={s.metaTxt}>{item.warehouse}</Text>
                    </View>
                    <View style={s.itemBottom}>
                      <Text style={s.expiryDate}>Expires: {item.expiry}</Text>
                      <Text style={s.itemValue}>{item.value}</Text>
                    </View>
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
  exportBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: 10, margin: SPACING.md },
  summaryRow: { flexDirection: 'row', gap: 10, marginHorizontal: SPACING.md, marginBottom: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, borderLeftWidth: 3, gap: 2, alignItems: 'center' },
  summaryVal:  { fontSize: TYPOGRAPHY.xl, fontWeight: '800' },
  summaryLbl:  { fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  card:    { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  empty:   { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyTxt:{ fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  itemRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 10 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  urgDot:     { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  itemInfo:   { flex: 1, gap: 4 },
  itemTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemName:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  urgBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  urgTxt:     { fontSize: 10, fontWeight: '700' },
  itemMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  metaSep:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expiryDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemValue:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
