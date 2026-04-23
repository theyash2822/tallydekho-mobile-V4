import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_SALES_REGISTER } from '../../src/data/mockData';

const AMBER      = '#A89060';
const AMBER_BG   = '#FDF9F4';
const BANNER_RED = '#E53935';
const { width: SW } = Dimensions.get('window');

// ─── Mock Data ────────────────────────────────────────────────────────────────
const METRIC_CARDS = [
  { id: 'today',       label: 'Today',        icon: 'calendar-outline',        amount: '₹1,25,000',  pct: '+18%', pos: true  },
  { id: 'mtd',         label: 'MTD',          icon: 'calendar-number-outline', amount: '₹3,45,500',  pct: '+12%', pos: true  },
  { id: 'ytd',         label: 'YTD',          icon: 'ribbon-outline',          amount: '₹11,92,750', pct: '+22%', pos: true  },
  { id: 'outstanding', label: 'Outstanding',  icon: 'wallet-outline',          amount: '₹17,56,950', pct: '+16%', pos: true  },
  { id: 'credit',      label: 'Credit Notes', icon: 'receipt-outline',         amount: '₹28,500',    pct: '+8%',  pos: true  },
  { id: 'avg',         label: 'Avg Ticket',   icon: 'ticket-outline',          amount: '₹1,38,200',  pct: '-2%',  pos: false },
];

const TOP_PARTIES = [
  { id: 'TP1', name: 'Raj Enterprises',    amount: '₹4,82,000', color: '#2563EB' },
  { id: 'TP2', name: 'Kumar & Sons',        amount: '₹3,61,500', color: '#D97706' },
  { id: 'TP3', name: 'Sharma Traders',      amount: '₹2,88,000', color: '#7C3AED' },
  { id: 'TP4', name: 'Delhi Distributors',  amount: '₹2,14,000', color: '#0891B2' },
  { id: 'TP5', name: 'Mumbai Wholesale',    amount: '₹1,92,500', color: '#059669' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SalesScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [tab,      setTab]      = useState<'recent' | 'parties'>('recent');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  const recent = MOCK_SALES_REGISTER.invoices.slice(0, 5);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sales</Text>
        <TouchableOpacity
          style={s.ewbBtn}
          onPress={() => router.push('/sales/ewaybill' as any)}
          activeOpacity={0.7}
        >
          <Text style={s.ewbTxt}>E-way Bill</Text>
          <Ionicons name="document-text-outline" size={15} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Filter Row ──────────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        {/* Date Range Pill */}
        <TouchableOpacity style={s.datePill} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateTxt}>31 Dec–22 Apr</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* Status Dropdown */}
        <View style={s.statusWrap}>
          <TouchableOpacity
            style={[s.statusPill, dropdown && s.statusPillOpen]}
            onPress={() => setDropdown(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.statusTxt}>{filter}</Text>
            <Ionicons
              name={dropdown ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {dropdown && (
            <View style={s.dropMenu}>
              {['All', 'Paid', 'Unpaid'].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={s.dropItem}
                  activeOpacity={0.7}
                  onPress={() => { setFilter(opt); setDropdown(false); }}
                >
                  <Text style={[s.dropTxt, filter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Full-screen overlay to close dropdown */}
      {dropdown && (
        <TouchableOpacity
          style={s.dropOverlay}
          onPress={() => setDropdown(false)}
          activeOpacity={1}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Metric Cards – Horizontal Scroll ────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.metricsRow}
          decelerationRate="fast"
          snapToInterval={SW - SPACING.md * 2 + SPACING.sm}
          snapToAlignment="start"
        >
          {METRIC_CARDS.map(c => (
            <View key={c.id} style={s.metricCard}>
              <View style={s.mIcon}>
                <Ionicons name={c.icon as any} size={22} color={COLORS.textSecondary} />
              </View>
              <Text style={s.mLabel}>{c.label}</Text>
              <Text style={s.mAmount}>{c.amount}</Text>
              <View style={[s.pctBadge, { backgroundColor: c.pos ? COLORS.positiveBg : COLORS.negativeBg }]}>
                <Ionicons
                  name={c.pos ? 'trending-up' : 'trending-down'}
                  size={11}
                  color={c.pos ? COLORS.positive : COLORS.negative}
                />
                <Text style={[s.pctTxt, { color: c.pos ? COLORS.positive : COLORS.negative }]}>
                  {c.pct}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['recent', 'parties'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === t && s.tabActiveTxt]}>
                {t === 'recent' ? 'Recent Sales' : 'Top Parties'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Sales ────────────────────────────────────────────── */}
        {tab === 'recent' && (
          <View style={s.listSection}>
            {recent.map(inv => (
              <TouchableOpacity
                key={inv.id}
                style={s.itemCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/document/${inv.id}?type=sales_invoice` as any)}
              >
                <View style={s.tallyIcon}>
                  <Ionicons name="return-down-back-outline" size={18} color={AMBER} />
                </View>
                <View style={s.itemCenter}>
                  <Text style={s.itemParty} numberOfLines={1}>
                    {inv.party}{' '}
                    <Text style={s.itemInvId}>• {inv.id}</Text>
                  </Text>
                  <Text style={s.itemMeta}>{inv.date} | {inv.time}</Text>
                </View>
                <Text style={s.itemAmt}>{inv.amount}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/sales/register' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Top Parties ─────────────────────────────────────────────── */}
        {tab === 'parties' && (
          <View style={s.listSection}>
            {TOP_PARTIES.map(p => (
              <TouchableOpacity key={p.id} style={s.itemCard} activeOpacity={0.7}>
                <View style={[s.avatar, { backgroundColor: p.color + '22' }]}>
                  <Text style={[s.avatarTxt, { color: p.color }]}>{p.name.charAt(0)}</Text>
                </View>
                <Text style={s.partyName}>{p.name}</Text>
                <Text style={s.itemAmt}>{p.amount}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/ledger' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── Sticky Red Banner ───────────────────────────────────────── */}
      <View style={[s.banner, { paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }]}>
        <View style={s.bannerLeft}>
          <View style={s.bannerIconWrap}>
            <Ionicons name="warning-outline" size={17} color={COLORS.white} />
          </View>
          <View>
            <Text style={s.bannerBold}>10 invoices</Text>
            <Text style={s.bannerSub}>due for E-Invoice generation</Text>
          </View>
        </View>
        <TouchableOpacity style={s.bannerBtn} activeOpacity={0.85}>
          <Text style={s.bannerBtnTxt}>Generate Now</Text>
          <Ionicons name="chevron-forward" size={12} color={BANNER_RED} />
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
  },
  ewbBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  ewbTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },

  // Filter Row
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    zIndex: 20,
  },
  datePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  dateTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  statusWrap: { position: 'relative', zIndex: 100 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 88,
  },
  statusPillOpen: { borderColor: COLORS.brandPrimary },
  statusTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dropMenu: {
    position: 'absolute', top: 46, right: 0,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
    minWidth: 130, zIndex: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
  },
  dropItem: {
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  // Metric Cards
  metricsRow: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    paddingBottom: SPACING.sm, gap: 10,
  },
  metricCard: {
    width: SW - SPACING.md * 2,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  mIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  mLabel: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  mAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  pctBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full,
  },
  pctTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, padding: 3,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: {
    backgroundColor: COLORS.cardBg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  // List
  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },
  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tallyIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: AMBER_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  itemCenter: { flex: 1 },
  itemParty: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemInvId: { fontSize: TYPOGRAPHY.xs, fontWeight: '400', color: COLORS.textSecondary },
  itemMeta:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  itemAmt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  // Top Parties
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  partyName: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // View All Button
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'center', marginTop: 4, minWidth: 150,
  },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // Bottom Red Banner
  banner: {
    backgroundColor: BANNER_RED,
    paddingHorizontal: SPACING.md, paddingTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bannerLeft:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  bannerBold: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  bannerSub:  { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  bannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10,
  },
  bannerBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: BANNER_RED },
});
