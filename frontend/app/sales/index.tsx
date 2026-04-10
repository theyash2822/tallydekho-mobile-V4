import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_SALES_REGISTER, MOCK_EWAYBILLS } from '../../src/data/mockData';

const QUICK_LINKS = [
  { label: 'Register',     icon: 'document-text-outline',   route: '/sales/register',      color: '#2D7D46', bg: '#F0FBF4' },
  { label: 'Orders',       icon: 'clipboard-outline',        route: '/sales/order',         color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Quotations',   icon: 'chatbubble-outline',       route: '/sales/quotation',     color: '#D97706', bg: '#FFFBEB' },
  { label: 'Credit Notes', icon: 'return-down-back-outline', route: '/sales/credit-note',   color: '#7C3AED', bg: '#F5F3FF' },
  { label: 'Delivery',     icon: 'cube-outline',             route: '/sales/delivery-note', color: '#0891B2', bg: '#ECFEFF' },
  { label: 'E-Way Bills',  icon: 'receipt-outline',          route: '/sales/ewaybill',      color: '#059669', bg: '#ECFDF5' },
] as const;

export default function SalesHubScreen() {
  const router = useRouter();
  const recent = MOCK_SALES_REGISTER.invoices.slice(0, 4);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sales</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Summary */}
        <View style={s.summaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.sumLabel}>Today's Sales</Text>
            <Text style={s.sumAmount}>₹92,000</Text>
          </View>
          <View style={s.sumRight}>
            <View style={s.sumRow}><Text style={s.sumSubLabel}>MTD</Text><Text style={s.sumSubVal}>₹12,74,560</Text></View>
            <View style={s.sumRow}><Text style={s.sumSubLabel}>YTD</Text><Text style={s.sumSubVal}>₹74,00,000</Text></View>
          </View>
          <View style={s.chip}>
            <Ionicons name="trending-up" size={12} color="#6EE7A0" />
            <Text style={s.chipTxt}>+5.1%</Text>
          </View>
        </View>

        {/* Quick Access */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Quick Access</Text>
        </View>
        <View style={s.grid}>
          {QUICK_LINKS.map(link => (
            <TouchableOpacity key={link.label} style={s.gridCard} onPress={() => router.push(link.route as any)} activeOpacity={0.75}>
              <View style={[s.gridIcon, { backgroundColor: link.bg }]}>
                <Ionicons name={link.icon as any} size={22} color={link.color} />
              </View>
              <Text style={s.gridLabel}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent */}
        <View style={s.secRow}>
          <Text style={s.secTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => router.push('/sales/register' as any)}>
            <Text style={s.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={s.listCard}>
          {recent.map((inv, idx) => (
            <View key={inv.id}>
              <TouchableOpacity style={s.listRow} activeOpacity={0.7}>
                <View style={[s.dot, { backgroundColor: inv.status === 'paid' ? COLORS.positive : inv.status === 'unpaid' ? COLORS.negative : '#9CA3AF' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listParty}>{inv.party}</Text>
                  <Text style={s.listMeta}>{inv.id} · {inv.date}</Text>
                </View>
                <Text style={s.listAmt}>{inv.amount}</Text>
              </TouchableOpacity>
              {idx < recent.length - 1 && <View style={s.div} />}
            </View>
          ))}
        </View>

        {/* EWB banner */}
        <TouchableOpacity style={s.banner} onPress={() => router.push('/sales/ewaybill' as any)} activeOpacity={0.8}>
          <View style={s.bannerLeft}>
            <View style={s.bannerIcon}><Ionicons name="receipt-outline" size={18} color={COLORS.positive} /></View>
            <View>
              <Text style={s.bannerTitle}>E-Way Bills</Text>
              <Text style={s.bannerSub}>{MOCK_EWAYBILLS.generated} generated · {MOCK_EWAYBILLS.pending} pending</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandPrimary, margin: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 10 },
  sumLabel: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  sumAmount: { fontSize: TYPOGRAPHY.xl, fontWeight: '700', color: COLORS.white },
  sumRight: { gap: 3 },
  sumRow: { flexDirection: 'row', gap: 6 },
  sumSubLabel: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.55)', width: 28 },
  sumSubVal: { fontSize: TYPOGRAPHY.xs, color: COLORS.white, fontWeight: '600' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(45,125,70,0.35)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#6EE7A0' },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 10 },
  secTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  viewAll: { fontSize: TYPOGRAPHY.sm, color: COLORS.positive, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: 10 },
  gridCard: { width: '30.5%', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  gridIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  gridLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center' },
  listCard: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  listParty: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  listMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  listAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.positiveBg, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  bannerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
});
