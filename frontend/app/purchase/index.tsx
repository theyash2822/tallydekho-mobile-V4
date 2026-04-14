import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_PURCHASE_REGISTER } from '../../src/data/mockData';

const QUICK_LINKS = [
  { label: 'Register',     icon: 'document-text-outline', route: '/purchase/register',    color: '#2D7D46', bg: '#F0FBF4' },
  { label: 'Orders',       icon: 'clipboard-outline',     route: '/purchase/order',       color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Debit Notes',  icon: 'return-up-forward-outline', route: '/purchase/debit-note', color: '#C0392B', bg: '#FDECEA' },
] as const;

const TOP_VENDORS = [
  { id: 'TV1', name: 'Global Supplies Co.',  gstin: '27AABCG1234F1Z5', total: '₹3,82,000', orders: 10, badge: '🥇', color: '#D97706' },
  { id: 'TV2', name: 'Prime Distributors',   gstin: '07AADCP9876G2Z1', total: '₹2,61,500', orders: 8,  badge: '🥈', color: '#6B7280' },
  { id: 'TV3', name: 'ShreeStar Traders',    gstin: '24AABCS3456K4Z2', total: '₹1,88,000', orders: 7,  badge: '🥉', color: '#92400E' },
  { id: 'TV4', name: 'National Wholesalers', gstin: '07AABCN5678H1Z3', total: '₹1,54,000', orders: 5,  badge: '',    color: '#2563EB' },
  { id: 'TV5', name: 'Metro Raw Materials',  gstin: '27AABCM2345J3Z9', total: '₹1,12,500', orders: 4,  badge: '',    color: '#2563EB' },
];

export default function PurchaseHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'vendors'>('recent');
  const recent = MOCK_PURCHASE_REGISTER.invoices.slice(0, 4);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Purchase</Text>
        <TouchableOpacity style={s.headerAddBtn} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
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

        {/* ---- TABS ---- */}
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'recent' && s.tabActive]} onPress={() => setActiveTab('recent')} activeOpacity={0.7}>
            <Text style={[s.tabTxt, activeTab === 'recent' && s.tabActiveTxt]}>Recent Purchases</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'vendors' && s.tabActive]} onPress={() => setActiveTab('vendors')} activeOpacity={0.7}>
            <Text style={[s.tabTxt, activeTab === 'vendors' && s.tabActiveTxt]}>Top Vendors</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Purchases Tab */}
        {activeTab === 'recent' && (
          <>
            <View style={s.secRow}>
              <Text style={s.secTitle}></Text>
              <TouchableOpacity onPress={() => router.push('/purchase/register' as any)}>
                <Text style={s.viewAll}>View All →</Text>
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
                    <View style={s.listRight}>
                      <Text style={s.listAmt}>{inv.amount}</Text>
                      <View style={[s.statusBadge, { backgroundColor: inv.status === 'paid' ? '#F0FBF4' : '#FDECEA' }]}>
                        <Text style={[s.statusTxt, { color: inv.status === 'paid' ? '#2D7D46' : '#DC2626' }]}>{inv.status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {idx < recent.length - 1 && <View style={s.div} />}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top Vendors Tab */}
        {activeTab === 'vendors' && (
          <View style={s.listCard}>
            {TOP_VENDORS.map((vendor, idx) => (
              <View key={vendor.id}>
                <TouchableOpacity style={s.partyRow} activeOpacity={0.7}>
                  <View style={s.rankCol}>
                    {vendor.badge ? (
                      <Text style={s.rankBadge}>{vendor.badge}</Text>
                    ) : (
                      <Text style={s.rankNum}>#{idx + 1}</Text>
                    )}
                  </View>
                  <View style={[s.partyAvatar, { backgroundColor: vendor.color + '20' }]}>
                    <Text style={[s.partyAvatarTxt, { color: vendor.color }]}>{vendor.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partyName}>{vendor.name}</Text>
                    <Text style={s.partyGstin}>{vendor.gstin}</Text>
                  </View>
                  <View style={s.partyRight}>
                    <Text style={s.partyTotal}>{vendor.total}</Text>
                    <Text style={s.partyInvoices}>{vendor.orders} orders</Text>
                  </View>
                </TouchableOpacity>
                {idx < TOP_VENDORS.length - 1 && <View style={s.div} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowCreate(true)}
        activeOpacity={0.85}
      >
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
  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' as const, borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600' as const, color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.white },
  listRight: { alignItems: 'flex-end' as const, gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusTxt: { fontSize: 10, fontWeight: '700' as const },
  // Top Vendors
  partyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 10 },
  rankCol: { width: 32, alignItems: 'center' as const },
  rankBadge: { fontSize: 18 },
  rankNum: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' as const, color: COLORS.textTertiary },
  partyAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center' as const, justifyContent: 'center' as const },
  partyAvatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '800' as const },
  partyName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' as const, color: COLORS.textPrimary },
  partyGstin: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
  partyRight: { alignItems: 'flex-end' as const },
  partyTotal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' as const, color: COLORS.textPrimary },
  partyInvoices: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.25)', elevation: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  createOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: SPACING.md, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  createIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  createSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
});
