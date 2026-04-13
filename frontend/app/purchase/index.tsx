import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_PURCHASE_REGISTER } from '../../src/data/mockData';

const QUICK_LINKS = [
  { label: 'Register',     icon: 'document-text-outline', route: '/purchase/register',    color: '#2D7D46', bg: '#F0FBF4' },
  { label: 'Orders',       icon: 'clipboard-outline',     route: '/purchase/order',       color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Debit Notes',  icon: 'return-up-forward-outline', route: '/purchase/debit-note', color: '#C0392B', bg: '#FDECEA' },
] as const;

export default function PurchaseHubScreen() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const recent = MOCK_PURCHASE_REGISTER.invoices.slice(0, 4);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Purchase</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Summary */}
        <View style={s.summaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.sumLabel}>Today's Purchases</Text>
            <Text style={s.sumAmount}>₹74,500</Text>
          </View>
          <View style={s.sumRight}>
            <View style={s.sumRow}><Text style={s.sumSubLabel}>MTD</Text><Text style={s.sumSubVal}>₹12,74,560</Text></View>
            <View style={s.sumRow}><Text style={s.sumSubLabel}>YTD</Text><Text style={s.sumSubVal}>₹58,00,000</Text></View>
          </View>
          <View style={s.chip}>
            <Ionicons name="trending-up" size={12} color="#6EE7A0" />
            <Text style={s.chipTxt}>+8.7%</Text>
          </View>
        </View>

        {/* Quick Access */}
        <View style={s.secRow}><Text style={s.secTitle}>Quick Access</Text></View>
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
          <Text style={s.secTitle}>Recent Purchases</Text>
          <TouchableOpacity onPress={() => router.push('/purchase/register' as any)}>
            <Text style={s.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={s.listCard}>
          {recent.map((inv, idx) => (
            <View key={inv.id}>
              <TouchableOpacity style={s.listRow} activeOpacity={0.7}>
                <View style={[s.dot, { backgroundColor: inv.status === 'paid' ? COLORS.positive : inv.status === 'unpaid' ? COLORS.negative : '#9CA3AF' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listParty}>{inv.vendor}</Text>
                  <Text style={s.listMeta}>{inv.id} · {inv.date}</Text>
                </View>
                <Text style={s.listAmt}>{inv.amount}</Text>
              </TouchableOpacity>
              {idx < recent.length - 1 && <View style={s.div} />}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowCreate(false)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Create New</Text>
          <TouchableOpacity style={s.createOpt} onPress={() => { setShowCreate(false); router.push('/purchase/create-invoice' as any); }} activeOpacity={0.7}>
            <View style={[s.createIcon, { backgroundColor: '#F0FBF4' }]}>
              <Ionicons name="scan-outline" size={22} color="#2D7D46" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.createLabel}>Purchase Invoice</Text>
              <Text style={s.createSub}>Scan bill with OCR or enter details manually</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </View>
      </Modal>
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
  sumRight: { gap: 3 }, sumRow: { flexDirection: 'row', gap: 6 },
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
  fab: { position: 'absolute', right: 20, bottom: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  createOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SPACING.md, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  createIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  createSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
});
