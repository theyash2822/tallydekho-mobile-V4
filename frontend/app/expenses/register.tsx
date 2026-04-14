import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const EXPENSES = [
  { id: 'E1', ref: 'EXP-0041', vendor: 'Realty Corp', title: 'Office Rent', date: '25 May', amount: '₹25,000', type: 'Indirect', status: 'Paid' },
  { id: 'E2', ref: 'EXP-0040', vendor: 'BSNL', title: 'Internet Bill', date: '25 May', amount: '₹2,800', type: 'Indirect', status: 'Paid' },
  { id: 'E3', ref: 'EXP-0039', vendor: 'ABC Suppliers', title: 'Raw Materials', date: '24 May', amount: '₹62,000', type: 'Direct', status: 'Unpaid' },
  { id: 'E4', ref: 'EXP-0038', vendor: 'Staff Expense', title: 'Taxi Reimburse', date: '24 May', amount: '₹1,200', type: 'Indirect', status: 'Paid' },
  { id: 'E5', ref: 'EXP-0037', vendor: 'Pack-Pro Ltd', title: 'Packaging', date: '23 May', amount: '₹14,500', type: 'Direct', status: 'Paid' },
  { id: 'E6', ref: 'EXP-0036', vendor: 'Power Corp', title: 'Electricity Bill', date: '22 May', amount: '₹8,400', type: 'Indirect', status: 'Unpaid' },
  { id: 'E7', ref: 'EXP-0035', vendor: 'Logistics Hub', title: 'Freight Charges', date: '21 May', amount: '₹18,000', type: 'Direct', status: 'Paid' },
];

export default function ExpenseRegisterScreen() {
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState('1M');
  const [activeType, setActiveType] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');

  const filtered = EXPENSES.filter(e => {
    if (activeType !== 'All' && e.type !== activeType) return false;
    if (activeStatus !== 'All' && e.status !== activeStatus) return false;
    return true;
  });

  const total = '₹1,32,500';
  const tax = '₹18,200';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Expense Register</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
          {['7D', '1M', '3M', '6M'].map(p => (
            <TouchableOpacity key={p} style={[s.chip, activePeriod === p && s.chipActive]} onPress={() => setActivePeriod(p)} activeOpacity={0.7}>
              <Text style={[s.chipTxt, activePeriod === p && s.chipActiveTxt]}>{p}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.sep} />
          {['All', 'Direct', 'Indirect'].map(t => (
            <TouchableOpacity key={t} style={[s.chip, activeType === t && s.chipActive]} onPress={() => setActiveType(t)} activeOpacity={0.7}>
              <Text style={[s.chipTxt, activeType === t && s.chipActiveTxt]}>{t}</Text>
            </TouchableOpacity>
          ))}
          <View style={s.sep} />
          {['All', 'Paid', 'Unpaid'].map(st => (
            <TouchableOpacity key={st} style={[s.chip, activeStatus === st && s.chipActive]} onPress={() => setActiveStatus(st)} activeOpacity={0.7}>
              <Text style={[s.chipTxt, activeStatus === st && s.chipActiveTxt]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* KPI Summary */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiVal}>{total}</Text>
          <Text style={s.kpiLbl}>Total Expenses</Text>
        </View>
        <View style={[s.kpiCard, { borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault }]}>
          <Text style={[s.kpiVal, { color: '#D97706' }]}>{tax}</Text>
          <Text style={s.kpiLbl}>Tax Amount</Text>
        </View>
      </View>

      <Text style={s.listTitle}>List of Expenses</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {filtered.map((e, i) => (
          <View key={e.id} style={[s.expCard, i === 0 && { marginTop: 0 }]}>
            <View style={s.expCardTop}>
              <View style={[s.statusDot, { backgroundColor: e.status === 'Paid' ? '#2D7D46' : '#DC2626' }]} />
              <Text style={[s.statusLbl, { color: e.status === 'Paid' ? '#2D7D46' : '#DC2626' }]}>{e.status}</Text>
              <View style={[s.typeBadge, { backgroundColor: e.type === 'Direct' ? '#EFF6FF' : '#FFFBEB' }]}>
                <Text style={[s.typeTxt, { color: e.type === 'Direct' ? '#2563EB' : '#D97706' }]}>{e.type}</Text>
              </View>
              <Text style={s.refTxt}>{e.ref}</Text>
            </View>
            <View style={s.expCardMain}>
              <Ionicons name="receipt-outline" size={16} color={COLORS.textSecondary} />
              <View style={s.expInfo}>
                <Text style={s.expTitle}>{e.title}</Text>
                <Text style={s.expVendor}>{e.vendor}</Text>
              </View>
              <View style={s.expRight}>
                <Text style={s.expDate}>{e.date}</Text>
                <Text style={s.expAmt}>{e.amount}</Text>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Share Bar */}
      <View style={s.shareBar}>
        <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
          <Ionicons name="document-text-outline" size={16} color={COLORS.white} />
          <Text style={s.shareTxt}>Share PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.shareBtn, { backgroundColor: '#2D7D46' }]} activeOpacity={0.8}>
          <Ionicons name="grid-outline" size={16} color={COLORS.white} />
          <Text style={s.shareTxt}>Export XLS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn: { width: 40, alignItems: 'flex-end' },
  filterBar: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterContent: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipActiveTxt: { color: COLORS.white },
  sep: { width: 1, height: 20, backgroundColor: COLORS.borderDefault },
  kpiRow: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  kpiCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  kpiVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
  kpiLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  listTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, paddingHorizontal: SPACING.md, paddingVertical: 10 },
  expCard: { marginHorizontal: SPACING.md, marginBottom: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderDefault },
  expCardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLbl: { fontSize: 11, fontWeight: '700' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  typeTxt: { fontSize: 10, fontWeight: '700' },
  refTxt: { flex: 1, textAlign: 'right', fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  expCardMain: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  expInfo: { flex: 1 },
  expTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  expVendor: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  expRight: { alignItems: 'flex-end' },
  expDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  expAmt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  shareBar: { flexDirection: 'row', gap: 10, padding: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.brandPrimary, paddingVertical: 12, borderRadius: RADIUS.md },
  shareTxt: { color: COLORS.white, fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
});
