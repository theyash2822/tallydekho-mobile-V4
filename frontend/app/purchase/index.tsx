import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

const AMBER      = '#A89060';
const AMBER_BG   = '#FDF9F4';
const BANNER_RED = '#E53935';
const { width: SW } = Dimensions.get('window');
const CARD_W   = SW - SPACING.md * 2;
const BANNER_W = SW - SPACING.md * 2;

// ─── Data ────────────────────────────────────────────────────────────────────
const METRIC_CARDS = [
  { id: 'today',       label: 'Today',        icon: 'calendar-outline',        amount: '₹92,000',     pct: '+12%', pos: true  },
  { id: 'mtd',         label: 'MTD',          icon: 'calendar-number-outline', amount: '₹2,45,500',   pct: '+8%',  pos: true  },
  { id: 'ytd',         label: 'YTD',          icon: 'ribbon-outline',          amount: '₹8,92,750',   pct: '+15%', pos: true  },
  { id: 'outstanding', label: 'Outstanding',  icon: 'wallet-outline',          amount: '₹12,01,950',  pct: '+11%', pos: true  },
  { id: 'debit',       label: 'Debit Notes',  icon: 'return-up-forward-outline', amount: '₹18,500',   pct: '+5%',  pos: true  },
  { id: 'avg',         label: 'Avg Ticket',   icon: 'ticket-outline',          amount: '₹45,200',     pct: '-3%',  pos: false },
];

const RECENT_INVOICES = [
  { id: 'CN-00712',  vendor: 'ABC Traders',    date: '01/01/26', time: '09:00 AM', amount: '₹3,200',  status: 'unpaid' },
  { id: 'INV-30974', vendor: 'PQR Exports',    date: '31/12/25', time: '08:30 AM', amount: '₹42,500', status: 'paid'   },
  { id: 'INV-30973', vendor: 'Kumar & Sons',   date: '28/12/25', time: '02:00 PM', amount: '₹28,000', status: 'paid'   },
  { id: 'INV-30972', vendor: 'XYZ Retail',     date: '25/12/25', time: '11:00 AM', amount: '₹15,500', status: 'unpaid' },
  { id: 'INV-30971', vendor: 'Machinery Corp.',date: '20/12/25', time: '09:30 AM', amount: '₹67,000', status: 'paid'   },
];

const TOP_VENDORS = [
  { id: 'TV1', name: 'ABC Traders',     transactions: 15, amount: '₹1,25,000', color: '#2563EB' },
  { id: 'TV2', name: 'PQR Exports',     transactions: 8,  amount: '₹89,500',   color: '#D97706' },
  { id: 'TV3', name: 'XYZ Retail',      transactions: 12, amount: '₹67,200',   color: '#059669' },
  { id: 'TV4', name: 'Kumar & Sons',    transactions: 6,  amount: '₹55,400',   color: '#7C3AED' },
  { id: 'TV5', name: 'Delhi Suppliers', transactions: 9,  amount: '₹48,200',   color: '#0891B2' },
];

const BANNERS = [
  { id: 'b1', bold: '8 invoices', sub: 'pending payment to vendors', action: 'Pay Now' },
  { id: 'b2', bold: '3 debit notes', sub: 'awaiting settlement', action: 'Settle Now' },
  { id: 'b3', bold: 'GST ITC pending', sub: 'purchase reconciliation due', action: 'Reconcile' },
];

const STATUS_COLOR: Record<string, string> = {
  paid:   '#2D7D46',
  unpaid: '#DC2626',
  irm:    '#787774',
};
const STATUS_LABEL: Record<string, string> = {
  paid:   'Paid',
  unpaid: 'Unpaid',
  irm:    'IRM',
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function PurchaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab,      setTab]      = useState<'recent' | 'vendors'>('recent');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate,       setFromDate]       = useState('01/01/25');
  const [toDate,         setToDate]         = useState('22/04/25');

  const metricRef = useRef<FlatList>(null);
  const bannerRef = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);
  const [bannerIdx, setBannerIdx] = useState(0);

  // Auto-scroll metric cards every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % METRIC_CARDS.length;
        metricRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll banners every 3.5s
  useEffect(() => {
    const t = setInterval(() => {
      setBannerIdx(prev => {
        const next = (prev + 1) % BANNERS.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // Filtered recent list
  const recent = RECENT_INVOICES.filter(inv => {
    if (filter === 'Paid')   return inv.status === 'paid';
    if (filter === 'Unpaid') return inv.status === 'unpaid';
    return true;
  }).slice(0, 5);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Purchase</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Filter Row ──────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.datePill} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateTxt}>{fromDate} – {toDate}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={s.statusWrap}>
          <TouchableOpacity
            style={[s.statusPill, dropdown && s.statusPillOpen]}
            onPress={() => setDropdown(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.statusTxt}>{filter}</Text>
            <Ionicons name={dropdown ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textSecondary} />
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

      {dropdown && (
        <TouchableOpacity style={s.dropOverlay} onPress={() => setDropdown(false)} activeOpacity={1} />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Metric Cards Carousel ─────────────────────────────────── */}
        <View style={s.carouselWrap}>
          <FlatList
            ref={metricRef}
            data={METRIC_CARDS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={c => c.id}
            getItemLayout={(_, index) => ({ length: CARD_W, offset: CARD_W * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
              setMetricIdx(idx);
            }}
            renderItem={({ item: c }) => (
              <View style={s.metricCard}>
                <View style={s.mIcon}>
                  <Ionicons name={c.icon as any} size={22} color={COLORS.textSecondary} />
                </View>
                <Text style={s.mLabel}>{c.label}</Text>
                <Text style={s.mAmount}>{c.amount}</Text>
                <View style={[s.pctBadge, { backgroundColor: c.pos ? COLORS.positiveBg : COLORS.negativeBg }]}>
                  <Ionicons name={c.pos ? 'trending-up' : 'trending-down'} size={11} color={c.pos ? COLORS.positive : COLORS.negative} />
                  <Text style={[s.pctTxt, { color: c.pos ? COLORS.positive : COLORS.negative }]}>{c.pct}</Text>
                </View>
              </View>
            )}
          />
          {/* Carousel Dots */}
          <View style={s.dotsRow}>
            {METRIC_CARDS.map((_, i) => (
              <View key={i} style={[s.dot, i === metricIdx && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['recent', 'vendors'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === t && s.tabActiveTxt]}>
                {t === 'recent' ? 'Recent Purchases' : 'Top Vendors'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Purchases ──────────────────────────────────────── */}
        {tab === 'recent' && (
          <View style={s.listSection}>
            {recent.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="cart-outline" size={28} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>No {filter.toLowerCase()} invoices</Text>
              </View>
            ) : (
              recent.map(inv => (
                <TouchableOpacity
                  key={inv.id}
                  style={s.itemCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/document/${inv.id}?type=purchase_invoice` as any)}
                >
                  {/* Status Row */}
                  <View style={s.itemStatusRow}>
                    <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[inv.status] ?? '#9CA3AF' }]} />
                    <Text style={[s.itemStatusTxt, { color: STATUS_COLOR[inv.status] ?? '#9CA3AF' }]}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </Text>
                    <Text style={s.itemBullet}> • </Text>
                    <Text style={s.itemInvId}>{inv.id}</Text>
                  </View>
                  {/* Content Row */}
                  <View style={s.itemContentRow}>
                    <View style={s.tallyIcon}>
                      <Ionicons name="return-down-back-outline" size={16} color={AMBER} />
                    </View>
                    <View style={s.itemCenter}>
                      <Text style={s.itemVendor} numberOfLines={1}>{inv.vendor}</Text>
                      <Text style={s.itemMeta}>{inv.date} | {inv.time}</Text>
                    </View>
                    <Text style={s.itemAmt}>{inv.amount}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/purchase/register' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Top Vendors ──────────────────────────────────────────── */}
        {tab === 'vendors' && (
          <View style={s.listSection}>
            {TOP_VENDORS.map(vendor => (
              <TouchableOpacity
                key={vendor.id}
                style={s.vendorCard}
                activeOpacity={0.7}
                onPress={() => router.push('/purchase/register' as any)}
              >
                <View style={[s.vendorAvatar, { backgroundColor: vendor.color + '22' }]}>
                  <Text style={[s.vendorAvatarTxt, { color: vendor.color }]}>{vendor.name.charAt(0)}</Text>
                </View>
                <View style={s.vendorInfo}>
                  <Text style={s.vendorName}>{vendor.name}</Text>
                  <Text style={s.vendorTxn}>{vendor.transactions} transactions</Text>
                </View>
                <Text style={s.itemAmt}>{vendor.amount}</Text>
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

      {/* ── Sticky Banner Carousel ─────────────────────────────────── */}
      <View style={[s.bannerWrap, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
        <FlatList
          ref={bannerRef}
          data={BANNERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={b => b.id}
          scrollEnabled={false}
          snapToInterval={BANNER_W + 10}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: BANNER_W + 10, offset: (BANNER_W + 10) * index, index })}
          onScrollToIndexFailed={() => {}}
          contentContainerStyle={{ paddingHorizontal: SPACING.md, gap: 10 }}
          renderItem={({ item: b }) => (
            <View style={s.bannerCard}>
              <View style={s.bannerLeft}>
                <View style={s.bannerIconWrap}>
                  <Ionicons name="warning-outline" size={15} color={COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.bannerBold} numberOfLines={1}>{b.bold}</Text>
                  <Text style={s.bannerSub} numberOfLines={1}>{b.sub}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.bannerBtn} activeOpacity={0.85}>
                <Text style={s.bannerBtnTxt}>{b.action}</Text>
                <Ionicons name="chevron-forward" size={11} color={BANNER_RED} />
              </TouchableOpacity>
            </View>
          )}
        />
        {/* Banner Dots */}
        <View style={s.bannerDots}>
          {BANNERS.map((_, i) => (
            <View key={i} style={[s.bannerDot, i === bannerIdx && s.bannerDotActive]} />
          ))}
        </View>
      </View>

      {/* ── Date Range Picker ──────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },

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
  dropItem: { paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  // Metric Carousel
  carouselWrap: { paddingTop: SPACING.md },
  metricCard: {
    width: CARD_W,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginLeft: SPACING.md,
  },
  mIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  mLabel: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  mAmount: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  pctBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full },
  pctTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // Carousel Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full, padding: 3,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  // List Section
  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },

  // Invoice Item Card (Recent Purchases)
  itemCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    gap: 8,
  },
  itemStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },
  itemStatusTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  itemBullet:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemInvId:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, flex: 1 },
  itemContentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tallyIcon:       { width: 38, height: 38, borderRadius: 10, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center' },
  itemCenter:      { flex: 1 },
  itemVendor:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemMeta:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  itemAmt:         { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  // Vendor Card (Top Vendors)
  vendorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  vendorAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  vendorAvatarTxt: { fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
  vendorInfo:      { flex: 1 },
  vendorName:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  vendorTxn:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },

  // View All
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'center', marginTop: 4, minWidth: 150,
  },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // Banner Carousel
  bannerWrap:      { backgroundColor: COLORS.pageBg, paddingTop: SPACING.sm },
  bannerCard:      { width: BANNER_W, backgroundColor: BANNER_RED, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bannerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bannerIconWrap:  { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bannerBold:      { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  bannerSub:       { fontSize: 10, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  bannerBtn:       { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 0 },
  bannerBtnTxt:    { fontSize: 10, fontWeight: '700', color: BANNER_RED },
  bannerDots:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingTop: 6, paddingBottom: 4 },
  bannerDot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  bannerDotActive: { width: 14, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },
});
