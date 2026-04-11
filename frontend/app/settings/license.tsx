import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const PLANS = [
  {
    id: 'free', name: 'Free',     price: '₹0', period: '/month',
    current: true, color: '#6B7280', bg: '#F3F4F6',
    features: ['Up to 2 users', '100 invoices/month', 'Basic reports', 'Mobile app', '5GB storage'],
    missing: ['E-invoicing (IRN)', 'GST auto-filing', 'AI Insights', 'Priority support', 'Unlimited invoices'],
  },
  {
    id: 'pro', name: 'Pro',       price: '₹999', period: '/month',
    current: false, color: '#2563EB', bg: '#EFF6FF',
    features: ['Up to 10 users', 'Unlimited invoices', 'Advanced reports', 'E-invoicing (IRN)', 'AI Insights (basic)', '50GB storage', 'Email support'],
    missing: ['Unlimited users', 'Dedicated manager', 'Custom integrations'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: '₹4,999', period: '/month',
    current: false, color: '#7C3AED', bg: '#F5F3FF',
    features: ['Unlimited users', 'Unlimited everything', 'AI Insights (full)', 'Custom integrations', 'Dedicated support', 'SSO / LDAP', 'SLA guarantee', 'On-premise option'],
    missing: [],
  },
];

const USAGE_STATS = [
  { label: 'Invoices',  used: 47,  total: 100, unit: '' },
  { label: 'Users',     used: 2,   total: 2,   unit: '' },
  { label: 'Storage',   used: 1.2, total: 5,   unit: 'GB' },
  { label: 'API Calls', used: 380, total: 500, unit: '' },
];

export default function LicenseScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>License & Credits</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Current plan banner */}
        <View style={styles.currentBanner}>
          <View style={styles.bannerLeft}>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>FREE</Text>
            </View>
            <View>
              <Text style={styles.planTitle}>Current Plan</Text>
              <Text style={styles.planSub}>Renews: Never (Free tier)</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => Alert.alert('Upgrade', 'Choose a plan to upgrade.')}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeBtnText}>Upgrade</Text>
            <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Usage stats */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Usage This Month</Text>
          {USAGE_STATS.map(u => {
            const pct = (u.used / u.total) * 100;
            const color = pct >= 90 ? '#DC2626' : pct >= 70 ? '#D97706' : '#2D7D46';
            return (
              <View key={u.label} style={styles.usageRow}>
                <Text style={styles.usageLabel}>{u.label}</Text>
                <View style={styles.usageBar}>
                  <View style={[styles.usageFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
                <Text style={styles.usageCount}>{u.used}{u.unit} / {u.total}{u.unit}</Text>
              </View>
            );
          })}
        </View>

        {/* Plans */}
        <Text style={styles.plansHeader}>Available Plans</Text>
        {PLANS.map(plan => (
          <View key={plan.id} style={[styles.planCard, plan.current && styles.planCardCurrent]}>
            <View style={styles.planTop}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                  {plan.current && <View style={styles.currentPill}><Text style={styles.currentPillText}>Current</Text></View>}
                </View>
                <Text style={styles.planPrice}>{plan.price}<Text style={styles.planPeriod}>{plan.period}</Text></Text>
              </View>
              {!plan.current && (
                <TouchableOpacity
                  style={[styles.selectBtn, { backgroundColor: plan.color }]}
                  onPress={() => Alert.alert('Select Plan', `Upgrade to ${plan.name} for ${plan.price}/month?`)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectBtnText}>Select</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.featuresList}>
              {plan.features.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={14} color={plan.color} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
              {plan.missing.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Ionicons name="close-circle-outline" size={14} color={COLORS.textTertiary} />
                  <Text style={[styles.featureText, { color: COLORS.textTertiary }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll:   { flex: 1 },
  content:  { padding: SPACING.md, gap: SPACING.md },

  currentBanner: {
    backgroundColor: '#F3F0FF', borderRadius: RADIUS.lg, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#C4B5FD',
  },
  bannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBadge:   { backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  planBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  planTitle:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  planSub:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  upgradeBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md },
  upgradeBtnText: { color: COLORS.white, fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  card:      { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  usageRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  usageLabel:{ width: 60, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  usageBar:  { flex: 1, height: 8, backgroundColor: COLORS.borderDefault, borderRadius: 4, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 4 },
  usageCount:{ width: 70, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, textAlign: 'right' },

  plansHeader: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  planCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  planCardCurrent: { borderColor: '#7C3AED', borderWidth: 2 },
  planTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  planName:    { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  planPrice:   { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  planPeriod:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '400' },
  currentPill: { backgroundColor: '#F5F3FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  currentPillText: { fontSize: 10, fontWeight: '700', color: '#7C3AED' },
  selectBtn:   { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md },
  selectBtnText: { color: COLORS.white, fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  featuresList:{ gap: 6 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
});
