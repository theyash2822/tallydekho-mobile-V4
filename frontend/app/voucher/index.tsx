import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';


const VOUCHER_TYPES = [
  { label: 'Payment',  icon: 'arrow-up-circle-outline',   route: '/voucher/payment',  color: '#C0392B', bg: '#FDECEA' },
  { label: 'Receipt',  icon: 'arrow-down-circle-outline', route: '/voucher/receipt',  color: '#2D7D46', bg: '#F0FBF4' },
  { label: 'Journal',  icon: 'book-outline',              route: '/voucher/journal',  color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Contra',   icon: 'swap-horizontal-outline',   route: '/voucher/contra',   color: '#7C3AED', bg: '#F5F3FF' },
] as const;

const CREATE_OPTIONS = [
  { label: 'Payment Voucher', icon: 'arrow-up-circle-outline', color: '#C0392B', bg: '#FDECEA', type: 'payment' },
  { label: 'Receipt Voucher', icon: 'arrow-down-circle-outline', color: '#2D7D46', bg: '#F0FBF4', type: 'receipt' },
  { label: 'Journal Entry', icon: 'book-outline', color: '#2563EB', bg: '#EFF6FF', type: 'journal' },
  { label: 'Contra Voucher', icon: 'swap-horizontal-outline', color: '#7C3AED', bg: '#F5F3FF', type: 'contra' },
];

export default function VouchersHubScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Vouchers</Text>
        <TouchableOpacity style={s.headerAddBtn} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Summary Banner */}
        <View style={s.summaryBanner}>
          <View style={{ flex: 1 }}>
            <Text style={s.sumLabel}>Total Vouchers This Month</Text>
            <Text style={s.sumCount}>60 documents</Text>
          </View>
          <View style={s.sumAmounts}>
            <Text style={s.sumSmall}>Payments ₹3,45,000</Text>
            <Text style={s.sumSmall}>Receipts ₹5,20,000</Text>
          </View>
        </View>

        {/* Voucher Type Cards */}
        <View style={s.secRow}><Text style={s.secTitle}>Voucher Types</Text></View>
        <View style={s.grid}>
          {VOUCHER_TYPES.map(vt => (
            <TouchableOpacity key={vt.label} style={s.vCard} onPress={() => router.push(vt.route as any)} activeOpacity={0.75}>
              <View style={[s.vIconBox, { backgroundColor: vt.bg }]}>
                <Ionicons name={vt.icon as any} size={26} color={vt.color} />
              </View>
              <Text style={s.vLabel}>{vt.label}</Text>
              <Text style={s.vTotal}>{'—'}</Text>
              <Text style={s.vDocs}>{'—'} docs</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent */}
        <View style={s.secRow}><Text style={s.secTitle}>Recent Activity</Text></View>
        <View style={s.listCard}>
          {[{ id: null, party: '', date: '', amount: '₹0', type: 'Payment', method: '' }, { id: null, party: '', date: '', amount: '₹0', type: 'Receipt', method: '' }].map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                style={s.listRow}
                activeOpacity={0.7}
                onPress={() => router.push(
                  `/document/${item.id}?type=${item.type === 'Payment' ? 'payment_voucher' : 'receipt_voucher'}` as any
                )}
              >
                <View style={[s.dot, { backgroundColor: item.type === 'Payment' ? COLORS.negative : COLORS.positive }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.listTitle}>{item.type} · {item.party}</Text>
                  <Text style={s.listMeta}>{item.id} · {item.date} · {item.method}</Text>
                </View>
                <Text style={s.listAmt}>{item.amount}</Text>
              </TouchableOpacity>
              {idx < 1 && <View style={s.div} />}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* Create Voucher Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowCreate(false)} />
        <View style={s.createSheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Create Voucher</Text>
          {CREATE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.type}
              style={s.createOpt}
              onPress={() => { setShowCreate(false); router.push(`/voucher/create?type=${opt.type}` as any); }}
              activeOpacity={0.7}
            >
              <View style={[s.createOptIcon, { backgroundColor: opt.bg }]}>
                <Ionicons name={opt.icon as any} size={22} color={opt.color} />
              </View>
              <Text style={s.createOptTxt}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
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
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  summaryBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.brandPrimary, margin: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 12 },
  sumLabel: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.65)', marginBottom: 4 },
  sumCount: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.white },
  sumAmounts: { gap: 4 },
  sumSmall: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 10 },
  secTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: 10 },
  vCard: { width: '47%', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 6 },
  vIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  vLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  vTotal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  vDocs: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  listCard: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  listTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  listMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  listAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25)', elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  createSheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  createOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  createOptIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  createOptTxt: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
});
