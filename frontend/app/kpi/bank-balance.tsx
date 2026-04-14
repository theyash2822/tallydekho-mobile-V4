import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const KPI_CARDS = [
  { label: 'Total Balance', value: '₹8,00,000', sub: 'Across all accounts', icon: 'wallet-outline', color: '#2563EB' },
  { label: 'Inflow Today', value: '₹24,000', sub: '3 transactions', icon: 'arrow-down-circle-outline', color: '#2D7D46' },
  { label: 'Outflow Today', value: '₹11,500', sub: '2 transactions', icon: 'arrow-up-circle-outline', color: '#DC2626' },
];

const BANK_ACCOUNTS = [
  { id: 'B1', name: 'HDFC Current A/C', number: '****4821', balance: '₹3,80,000', change: '+₹12,500', positive: true, icon: 'card-outline', color: '#1E40AF' },
  { id: 'B2', name: 'ICICI Savings A/C', number: '****7203', balance: '₹2,45,000', change: '+₹4,000', positive: true, icon: 'card-outline', color: '#0369A1' },
  { id: 'B3', name: 'SBI OD Account', number: '****1194', balance: '₹1,75,000', change: '-₹3,000', positive: false, icon: 'card-outline', color: '#0D9488' },
];

const TRANSACTIONS = [
  { id: 'T1', title: 'RTGS from Raj Enterprises', bank: 'HDFC', date: '25 May', amount: '₹15,000', type: 'Credit' },
  { id: 'T2', title: 'Vendor Payment – NEFT', bank: 'ICICI', date: '25 May', amount: '₹8,200', type: 'Debit' },
  { id: 'T3', title: 'Cash Deposit', bank: 'HDFC', date: '24 May', amount: '₹9,000', type: 'Credit' },
  { id: 'T4', title: 'Cheque Clearing – INV-029', bank: 'SBI', date: '24 May', amount: '₹22,000', type: 'Credit' },
  { id: 'T5', title: 'NEFT Payment – Supplier', bank: 'ICICI', date: '23 May', amount: '₹3,300', type: 'Debit' },
];

export default function BankBalanceScreen() {
  const router = useRouter();
  const [activePeriod, setActivePeriod] = useState('1M');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Bank Balance</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <View style={s.periodRow}>
        {['7D', '1M', '3M', '6M'].map(p => (
          <TouchableOpacity key={p} style={[s.periodBtn, activePeriod === p && s.periodActive]} onPress={() => setActivePeriod(p)} activeOpacity={0.7}>
            <Text style={[s.periodTxt, activePeriod === p && s.periodActiveTxt]}>{p}</Text>
          </TouchableOpacity>
        ))}
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

        {/* Bank Account Cards */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Bank Accounts</Text>
          {BANK_ACCOUNTS.map(b => (
            <TouchableOpacity key={b.id} style={s.bankCard} activeOpacity={0.8}>
              <View style={[s.bankIcon, { backgroundColor: b.color + '15' }]}>
                <Ionicons name={b.icon as any} size={22} color={b.color} />
              </View>
              <View style={s.bankInfo}>
                <Text style={s.bankName}>{b.name}</Text>
                <Text style={s.bankNum}>{b.number}</Text>
              </View>
              <View style={s.bankRight}>
                <Text style={s.bankBal}>{b.balance}</Text>
                <Text style={[s.bankChange, { color: b.positive ? '#2D7D46' : '#DC2626' }]}>{b.change}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Transactions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Transactions</Text>
          {TRANSACTIONS.map((t, i) => (
            <View key={t.id} style={[s.txRow, i < TRANSACTIONS.length - 1 && s.txBorder]}>
              <View style={[s.txIcon, { backgroundColor: t.type === 'Credit' ? '#F0FBF4' : '#FDECEA' }]}>
                <Ionicons name={t.type === 'Credit' ? 'arrow-down' : 'arrow-up'} size={14} color={t.type === 'Credit' ? '#2D7D46' : '#DC2626'} />
              </View>
              <View style={s.txInfo}>
                <Text style={s.txTitle}>{t.title}</Text>
                <Text style={s.txMeta}>{t.bank} · {t.date}</Text>
              </View>
              <Text style={[s.txAmt, { color: t.type === 'Credit' ? '#2D7D46' : '#DC2626' }]}>
                {t.type === 'Credit' ? '+' : '-'}{t.amount}
              </Text>
            </View>
          ))}
        </View>
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
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  periodActive: { backgroundColor: COLORS.brandPrimary },
  periodTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodActiveTxt: { color: COLORS.white },
  kpiScroll: { paddingVertical: SPACING.md },
  kpiContent: { paddingHorizontal: SPACING.md, gap: 10 },
  kpiCard: { width: 150, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 4 },
  kpiIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  kpiSub: { fontSize: 10, color: COLORS.textTertiary },
  section: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  bankCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, gap: 10 },
  bankIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bankInfo: { flex: 1 },
  bankName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  bankNum: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  bankRight: { alignItems: 'flex-end', marginRight: 6 },
  bankBal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  bankChange: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
});
