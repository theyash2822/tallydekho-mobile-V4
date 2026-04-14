import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const KPI_CARDS = [
  { label: 'Total Outstanding', value: '₹3,50,000', sub: '12 parties', icon: 'people-outline', color: '#2563EB' },
  { label: 'Overdue', value: '₹1,20,000', sub: '4 parties', icon: 'warning-outline', color: '#DC2626' },
  { label: 'Due This Week', value: '₹85,000', sub: '3 parties', icon: 'calendar-outline', color: '#D97706' },
  { label: 'Collected MTD', value: '₹62,000', sub: 'This month', icon: 'checkmark-circle-outline', color: '#2D7D46' },
];

const OUTSTANDING = [
  { id: 'P1', name: 'Raj Enterprises', invoices: 3, amount: '₹85,000', daysOverdue: 0, due: '28 May' },
  { id: 'P2', name: 'Kumar & Sons', invoices: 2, amount: '₹62,000', daysOverdue: 12, due: '13 May' },
  { id: 'P3', name: 'Sharma Traders', invoices: 1, amount: '₹45,000', daysOverdue: 0, due: '01 Jun' },
  { id: 'P4', name: 'Delhi Distributors', invoices: 4, amount: '₹1,20,000', daysOverdue: 28, due: '27 Apr' },
  { id: 'P5', name: 'Mumbai Wholesale', invoices: 2, amount: '₹38,000', daysOverdue: 5, due: '20 May' },
];

const AGEING = [
  { range: '0–30 days', amount: '₹1,70,000', count: 6, pct: 49, color: '#2D7D46' },
  { range: '31–60 days', amount: '₹85,000', count: 3, pct: 24, color: '#D97706' },
  { range: '61–90 days', amount: '₹58,000', count: 2, pct: 17, color: '#EA580C' },
  { range: '90+ days', amount: '₹37,000', count: 1, pct: 10, color: '#DC2626' },
];

export default function ReceivablesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'outstanding' | 'ageing'>('outstanding');
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Receivables</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
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
          {(['outstanding', 'ageing'] as const).map(t => (
            <TouchableOpacity key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)} activeOpacity={0.7}>
              <Text style={[s.tabTxt, activeTab === t && s.tabTxtActive]}>
                {t === 'outstanding' ? 'Outstanding' : 'Ageing Analysis'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'outstanding' && (
          <View style={s.card}>
            {/* Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              {['All', 'Overdue', 'Due This Week', 'Receipts'].map(f => (
                <TouchableOpacity key={f} style={[s.chip, activeFilter === f && s.chipActive]} onPress={() => setActiveFilter(f)} activeOpacity={0.7}>
                  <Text style={[s.chipTxt, activeFilter === f && s.chipActiveTxt]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {OUTSTANDING.map((p, i) => (
              <View key={p.id} style={[s.partyRow, i < OUTSTANDING.length - 1 && s.rowBorder]}>
                <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{p.name.charAt(0)}</Text>
                </View>
                <View style={s.partyInfo}>
                  <Text style={s.partyName}>{p.name}</Text>
                  <Text style={s.partyMeta}>{p.invoices} invoice(s) · Due: {p.due}</Text>
                </View>
                <View style={s.partyRight}>
                  <Text style={s.partyAmt}>{p.amount}</Text>
                  {p.daysOverdue > 0 && (
                    <View style={s.overdueBadge}>
                      <Text style={s.overdueTxt}>{p.daysOverdue}d overdue</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'ageing' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Ageing Breakdown</Text>
            {AGEING.map(a => (
              <View key={a.range} style={s.ageRow}>
                <View style={s.ageLeft}>
                  <Text style={s.ageRange}>{a.range}</Text>
                  <Text style={s.ageCount}>{a.count} parties</Text>
                </View>
                <View style={s.ageBar}>
                  <View style={[s.ageBarFill, { width: `${a.pct}%` as any, backgroundColor: a.color }]} />
                </View>
                <View style={s.ageRight}>
                  <Text style={s.ageAmt}>{a.amount}</Text>
                  <Text style={[s.agePct, { color: a.color }]}>{a.pct}%</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn: { width: 40, alignItems: 'flex-end' },
  kpiScroll: { paddingVertical: SPACING.md },
  kpiContent: { paddingHorizontal: SPACING.md, gap: 10 },
  kpiCard: { width: 145, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 4 },
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
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipActiveTxt: { color: COLORS.white },
  partyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: COLORS.white, fontWeight: '700', fontSize: TYPOGRAPHY.base },
  partyInfo: { flex: 1 },
  partyName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  partyMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  partyRight: { alignItems: 'flex-end' },
  partyAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  overdueBadge: { backgroundColor: '#FDECEA', paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, marginTop: 3 },
  overdueTxt: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  ageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  ageLeft: { width: 90 },
  ageRange: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  ageCount: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
  ageBar: { flex: 1, height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  ageBarFill: { height: '100%', borderRadius: 4 },
  ageRight: { width: 72, alignItems: 'flex-end' },
  ageAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  agePct: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
