import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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

const TOP_PARTIES = [
  { id: 'TP1', name: 'Raj Enterprises',      gstin: '27AABCE1234F1Z5', total: '₹4,82,000', invoices: 12, badge: '🥇', color: '#D97706' },
  { id: 'TP2', name: 'Kumar & Sons',          gstin: '07AADCK9876G2Z1', total: '₹3,61,500', invoices: 9,  badge: '🥈', color: '#6B7280' },
  { id: 'TP3', name: 'Sharma Traders',        gstin: '24AABCS3456K4Z2', total: '₹2,88,000', invoices: 8,  badge: '🥉', color: '#92400E' },
  { id: 'TP4', name: 'Delhi Distributors',    gstin: '07AABCD5678H1Z3', total: '₹2,14,000', invoices: 6,  badge: '',    color: '#2563EB' },
  { id: 'TP5', name: 'Mumbai Wholesale',      gstin: '27AABCM2345J3Z9', total: '₹1,92,500', invoices: 5,  badge: '',    color: '#2563EB' },
  { id: 'TP6', name: 'Sun Tech Solutions',    gstin: '29AABCS9012L5Z7', total: '₹1,54,000', invoices: 4,  badge: '',    color: '#2563EB' },
];

export default function SalesHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<'recent' | 'parties'>('recent');
  const recent = MOCK_SALES_REGISTER.invoices.slice(0, 6);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sales</Text>
        <TouchableOpacity style={s.headerAddBtn} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
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

        {/* ---- TABS ---- */}
        <View style={s.tabRow}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'recent' && s.tabActive]} onPress={() => setActiveTab('recent')} activeOpacity={0.7}>
            <Text style={[s.tabTxt, activeTab === 'recent' && s.tabActiveTxt]}>Recent Sales</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'parties' && s.tabActive]} onPress={() => setActiveTab('parties')} activeOpacity={0.7}>
            <Text style={[s.tabTxt, activeTab === 'parties' && s.tabActiveTxt]}>Top Parties</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Sales Tab */}
        {activeTab === 'recent' && (
          <>
            <View style={s.secRow}>
              <Text style={s.secTitle}></Text>
              <TouchableOpacity onPress={() => router.push('/sales/register' as any)}>
                <Text style={s.viewAll}>View All →</Text>
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

        {/* Top Parties Tab */}
        {activeTab === 'parties' && (
          <View style={s.listCard}>
            {TOP_PARTIES.map((party, idx) => (
              <View key={party.id}>
                <TouchableOpacity style={s.partyRow} activeOpacity={0.7}>
                  <View style={s.rankCol}>
                    {party.badge ? (
                      <Text style={s.rankBadge}>{party.badge}</Text>
                    ) : (
                      <Text style={s.rankNum}>#{idx + 1}</Text>
                    )}
                  </View>
                  <View style={[s.partyAvatar, { backgroundColor: party.color + '20' }]}>
                    <Text style={[s.partyAvatarTxt, { color: party.color }]}>{party.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.partyName}>{party.name}</Text>
                    <Text style={s.partyGstin}>{party.gstin}</Text>
                  </View>
                  <View style={s.partyRight}>
                    <Text style={s.partyTotal}>{party.total}</Text>
                    <Text style={s.partyInvoices}>{party.invoices} invoices</Text>
                  </View>
                </TouchableOpacity>
                {idx < TOP_PARTIES.length - 1 && <View style={s.div} />}
              </View>
            ))}
          </View>
        )}

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
          <TouchableOpacity style={s.createOpt} onPress={() => { setShowCreate(false); router.push('/sales/create-invoice' as any); }} activeOpacity={0.7}>
            <View style={[s.createIcon, { backgroundColor: '#F0FBF4' }]}><Ionicons name="document-text-outline" size={22} color="#2D7D46" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.createLabel}>Sales Invoice</Text>
              <Text style={s.createSub}>Create a new sales invoice with items & GST</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.createOpt} onPress={() => { setShowCreate(false); router.push('/sales/create-quotation' as any); }} activeOpacity={0.7}>
            <View style={[s.createIcon, { backgroundColor: '#FFFBEB' }]}><Ionicons name="chatbubble-outline" size={22} color="#D97706" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.createLabel}>Quotation</Text>
              <Text style={s.createSub}>Send a price quote to your customer</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <View style={{ height: 24 }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sales</Text>
        <TouchableOpacity style={s.headerAddBtn} onPress={() => setShowCreate(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
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
          <TouchableOpacity style={s.createOpt} onPress={() => { setShowCreate(false); router.push('/sales/create-invoice' as any); }} activeOpacity={0.7}>
            <View style={[s.createIcon, { backgroundColor: '#F0FBF4' }]}>
              <Ionicons name="document-text-outline" size={22} color="#2D7D46" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.createLabel}>Sales Invoice</Text>
              <Text style={s.createSub}>Create a new sales invoice with items & GST</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.createOpt} onPress={() => { setShowCreate(false); router.push('/sales/create-quotation' as any); }} activeOpacity={0.7}>
            <View style={[s.createIcon, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="chatbubble-outline" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.createLabel}>Quotation</Text>
              <Text style={s.createSub}>Send a price quote to your customer</Text>
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
  headerAddBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
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
  listCard: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  listParty: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  listMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  listAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  listRight: { alignItems: 'flex-end' as const, gap: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusTxt: { fontSize: 10, fontWeight: '700' as const },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },
  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' as const, borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600' as const, color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.white },
  // Top Parties
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
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.positiveBg, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  bannerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
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
