import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const LOANS = [
  { id: 'L1', name: 'HDFC Term Loan', type: 'Term Loan', outstanding: '₹12,50,000', emi: '₹42,000', nextDue: '01 Jun 25', status: 'active', color: '#2563EB' },
  { id: 'L2', name: 'SBI Business Loan', type: 'Business Loan', outstanding: '₹8,75,000', emi: '₹28,500', nextDue: '05 Jun 25', status: 'active', color: '#0891B2' },
  { id: 'L3', name: 'ICICI OD Account', type: 'Overdraft', outstanding: '₹3,20,000', emi: 'Interest Only', nextDue: '30 Jun 25', status: 'od', color: '#7C3AED' },
];

const UPCOMING_EMIS = [
  { id: 'E1', loan: 'HDFC Term Loan', amount: '₹42,000', date: '01 Jun', daysLeft: 7 },
  { id: 'E2', loan: 'SBI Business Loan', amount: '₹28,500', date: '05 Jun', daysLeft: 11 },
  { id: 'E3', loan: 'HDFC Term Loan', amount: '₹42,000', date: '01 Jul', daysLeft: 37 },
  { id: 'E4', loan: 'SBI Business Loan', amount: '₹28,500', date: '05 Jul', daysLeft: 41 },
];

export default function LoansODsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Loans & ODs</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="download-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Strip */}
        <View style={s.summaryStrip}>
          <View style={s.summaryItem}>
            <Text style={s.summaryVal}>₹24,45,000</Text>
            <Text style={s.summaryLbl}>Total Outstanding</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryVal, { color: '#DC2626' }]}>₹70,500</Text>
            <Text style={s.summaryLbl}>Monthly EMI</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={[s.summaryVal, { color: '#D97706' }]}>₹3,20,000</Text>
            <Text style={s.summaryLbl}>OD Utilised</Text>
          </View>
        </View>

        {/* Loan Cards */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Active Loans & ODs</Text>
        </View>
        {LOANS.map(l => (
          <View key={l.id} style={[s.loanCard, { borderLeftColor: l.color, borderLeftWidth: 4 }]}>
            <View style={s.loanTop}>
              <View style={[s.loanIcon, { backgroundColor: l.color + '15' }]}>
                <Ionicons name={l.status === 'od' ? 'git-merge-outline' : 'cash-outline'} size={20} color={l.color} />
              </View>
              <View style={s.loanInfo}>
                <Text style={s.loanName}>{l.name}</Text>
                <Text style={s.loanType}>{l.type}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: l.status === 'od' ? '#F5F3FF' : '#EFF6FF' }]}>
                <Text style={[s.statusTxt, { color: l.status === 'od' ? '#7C3AED' : l.color }]}>
                  {l.status === 'od' ? 'Overdraft' : 'Active'}
                </Text>
              </View>
            </View>
            <View style={s.loanAmounts}>
              <View style={s.loanAmt}>
                <Text style={s.loanAmtVal}>{l.outstanding}</Text>
                <Text style={s.loanAmtLbl}>Outstanding</Text>
              </View>
              <View style={s.loanAmtDivider} />
              <View style={s.loanAmt}>
                <Text style={[s.loanAmtVal, { color: '#DC2626' }]}>{l.emi}</Text>
                <Text style={s.loanAmtLbl}>EMI / Month</Text>
              </View>
              <View style={s.loanAmtDivider} />
              <View style={s.loanAmt}>
                <Text style={s.loanAmtVal}>{l.nextDue}</Text>
                <Text style={s.loanAmtLbl}>Next Due</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Upcoming EMIs */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Upcoming EMIs</Text>
        </View>
        <View style={s.emiCard}>
          {UPCOMING_EMIS.map((e, i) => (
            <View key={e.id} style={[s.emiRow, i < UPCOMING_EMIS.length - 1 && s.emiBorder]}>
              <View style={[s.emiDot, { backgroundColor: e.daysLeft <= 14 ? '#DC2626' : '#D97706' }]} />
              <View style={s.emiInfo}>
                <Text style={s.emiLoan}>{e.loan}</Text>
                <Text style={s.emiDate}>{e.date} · {e.daysLeft} days left</Text>
              </View>
              <Text style={[s.emiAmt, { color: e.daysLeft <= 14 ? '#DC2626' : COLORS.textPrimary }]}>{e.amount}</Text>
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
  summaryStrip: { flexDirection: 'row', backgroundColor: COLORS.brandPrimary, paddingVertical: SPACING.md },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.white },
  summaryLbl: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionHeader: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  loanCard: { marginHorizontal: SPACING.md, marginBottom: 10, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  loanTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING.sm },
  loanIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  loanInfo: { flex: 1 },
  loanName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  loanType: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  loanAmounts: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  loanAmt: { flex: 1, alignItems: 'center' },
  loanAmtVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  loanAmtLbl: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
  loanAmtDivider: { width: 1, height: 32, backgroundColor: COLORS.borderDefault },
  emiCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  emiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  emiBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  emiDot: { width: 10, height: 10, borderRadius: 5 },
  emiInfo: { flex: 1 },
  emiLoan: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emiDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  emiAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
});
