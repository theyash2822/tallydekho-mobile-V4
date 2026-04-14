import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const KPI_CARDS = [
  { label: 'Today', value: '₹8,200', sub: '4 expenses', icon: 'today-outline', color: '#1A1A1A' },
  { label: 'MTD', value: '₹1,42,000', sub: 'This month', icon: 'calendar-outline', color: '#2563EB' },
  { label: 'YTD', value: '₹8,90,000', sub: 'This year', icon: 'bar-chart-outline', color: '#7C3AED' },
  { label: 'Cash Exp', value: '₹38,000', sub: 'Cash payments', icon: 'cash-outline', color: '#D97706' },
];

const RECENT_EXPENSES = [
  { id: 'E1', title: 'Office Rent', vendor: 'Realty Corp', ref: 'EXP-0041', date: '25 May', amount: '₹25,000', cat: 'Indirect', status: 'Paid' },
  { id: 'E2', title: 'Internet Bill', vendor: 'BSNL', ref: 'EXP-0040', date: '25 May', amount: '₹2,800', cat: 'Indirect', status: 'Paid' },
  { id: 'E3', title: 'Raw Materials', vendor: 'ABC Suppliers', ref: 'EXP-0039', date: '24 May', amount: '₹62,000', cat: 'Direct', status: 'Unpaid' },
  { id: 'E4', title: 'Taxi Reimbursement', vendor: 'Staff Expense', ref: 'EXP-0038', date: '24 May', amount: '₹1,200', cat: 'Indirect', status: 'Paid' },
  { id: 'E5', title: 'Packaging Material', vendor: 'Pack-Pro Ltd', ref: 'EXP-0037', date: '23 May', amount: '₹14,500', cat: 'Direct', status: 'Paid' },
];

const TOP_CATEGORIES = [
  { name: 'Raw Materials', amount: '₹3,20,000', pct: 36, color: '#2563EB' },
  { name: 'Labour Charges', amount: '₹1,80,000', pct: 20, color: '#7C3AED' },
  { name: 'Rent & Utilities', amount: '₹1,40,000', pct: 16, color: '#D97706' },
  { name: 'Logistics', amount: '₹1,10,000', pct: 12, color: '#0891B2' },
  { name: 'Admin & Office', amount: '₹72,000', pct: 8, color: '#2D7D46' },
  { name: 'Others', amount: '₹68,000', pct: 8, color: '#9CA3AF' },
];

export default function ExpensesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'recent' | 'categories'>('recent');
  const [activePeriod, setActivePeriod] = useState<string>('1M');
  const [activeStatus, setActiveStatus] = useState<string>('All');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Expenses</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="funnel-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterContent}>
          {['7D', '1M', '3M', '6M'].map(p => (
            <TouchableOpacity key={p} style={[s.chip, activePeriod === p && s.chipActive]} onPress={() => setActivePeriod(p)} activeOpacity={0.7}>
              <Text style={[s.chipTxt, activePeriod === p && s.chipActiveTxt]}>{p}</Text>
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* KPI Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiScroll} contentContainerStyle={s.kpiContent}>
          {KPI_CARDS.map((k, i) => (
            <View key={i} style={[s.kpiCard, { borderTopColor: k.color, borderTopWidth: 3 }]}>
              <View style={[s.kpiIcon, { backgroundColor: k.color + '15' }]}>
                <Ionicons name={k.icon as any} size={18} color={k.color} />
              </View>
              <Text style={s.kpiVal}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={s.kpiSub}>{k.sub}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Tabs */}
        <View style={s.tabs}>
          {(['recent', 'categories'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)} activeOpacity={0.7}>
              <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>{t === 'recent' ? 'Recent Expenses' : 'Top Categories'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'recent' && (
          <View style={s.card}>
            {RECENT_EXPENSES.map((e, i) => (
              <View key={e.id} style={[s.expRow, i < RECENT_EXPENSES.length - 1 && s.rowBorder]}>
                <View style={s.expLeft}>
                  <View style={[s.typeBadge, { backgroundColor: e.cat === 'Direct' ? '#EFF6FF' : '#FFFBEB' }]}>
                    <Text style={[s.typeTxt, { color: e.cat === 'Direct' ? '#2563EB' : '#D97706' }]}>{e.cat}</Text>
                  </View>
                  <Text style={s.expRef}>{e.ref}</Text>
                </View>
                <View style={s.expInfo}>
                  <Text style={s.expTitle}>{e.title}</Text>
                  <Text style={s.expVendor}>{e.vendor} · {e.date}</Text>
                </View>
                <View style={s.expRight}>
                  <Text style={s.expAmt}>{e.amount}</Text>
                  <View style={[s.statusBadge, { backgroundColor: e.status === 'Paid' ? '#F0FBF4' : '#FDECEA' }]}>
                    <Text style={[s.statusTxt, { color: e.status === 'Paid' ? '#2D7D46' : '#DC2626' }]}>{e.status}</Text>
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/expenses/register' as any)} activeOpacity={0.7}>
              <Text style={s.viewAllTxt}>View All Expenses</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.brandPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'categories' && (
          <View style={s.card}>
            {TOP_CATEGORIES.map(cat => (
              <View key={cat.name} style={s.catRow}>
                <View style={[s.catDot, { backgroundColor: cat.color }]} />
                <Text style={s.catName}>{cat.name}</Text>
                <View style={s.catBar}>
                  <View style={[s.catBarFill, { width: `${cat.pct}%` as any, backgroundColor: cat.color }]} />
                </View>
                <Text style={s.catPct}>{cat.pct}%</Text>
                <Text style={s.catAmt}>{cat.amount}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => router.push('/expenses/register' as any)} activeOpacity={0.85}>
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>
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
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipActiveTxt: { color: COLORS.white },
  sep: { width: 1, height: 20, backgroundColor: COLORS.borderDefault },
  kpiScroll: { paddingVertical: SPACING.md },
  kpiContent: { paddingHorizontal: SPACING.md, gap: 10 },
  kpiCard: { width: 140, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 4 },
  kpiIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  kpiSub: { fontSize: 10, color: COLORS.textTertiary },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: SPACING.md },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  tabTxtActive: { fontWeight: '700', color: COLORS.textPrimary },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  expRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  expLeft: { alignItems: 'center', gap: 4, width: 56 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  typeTxt: { fontSize: 9, fontWeight: '700' },
  expRef: { fontSize: 9, color: COLORS.textTertiary },
  expInfo: { flex: 1 },
  expTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  expVendor: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  expRight: { alignItems: 'flex-end', gap: 3 },
  expAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  statusTxt: { fontSize: 10, fontWeight: '700' },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { width: 100, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  catBar: { flex: 1, height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 4 },
  catPct: { width: 30, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  catAmt: { width: 58, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'right' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', elevation: 8, boxShadow: '0 4px 8px rgba(0,0,0,0.25)' } as any,
});
