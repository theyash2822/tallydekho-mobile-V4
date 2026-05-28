import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import { useAuth } from '../../src/context/AuthContext';
import { getExpenses } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER    = '#A89060';
const AMBER_BG = '#FDF9F4';
const { width: SW } = Dimensions.get('window');
const CARD_W  = SW - SPACING.md * 2;

// ─── Data ────────────────────────────────────────────────────────────────────
const METRIC_CARDS = [
  { id: 'today',  label: 'Today',         icon: 'calendar-outline',        amount: '₹32,500',   pct: '+15%', pos: false },
  { id: 'mtd',    label: 'MTD',           icon: 'calendar-number-outline', amount: '₹2,45,500', pct: '+8%',  pos: false },
  { id: 'ytd',    label: 'YTD',           icon: 'ribbon-outline',          amount: '₹8,92,750', pct: '+12%', pos: false },
  { id: 'cash',   label: 'Cash Expenses', icon: 'cash-outline',            amount: '₹45,200',   pct: '+3%',  pos: false },
];

const RECENT_EXPENSES = [
  { id: 'EXP-001', party: 'Office Supplies Co.',  date: '01/01/26', time: '09:00 AM', amount: '₹2,500',  status: 'paid'   },
  { id: 'EXP-002', party: 'Internet Provider',    date: '31/12/25', time: '08:30 AM', amount: '₹1,200',  status: 'unpaid' },
  { id: 'EXP-003', party: 'Cleaning Services',    date: '30/12/25', time: '08:00 AM', amount: '₹3,800',  status: 'paid'   },
  { id: 'EXP-004', party: 'Marketing Agency',     date: '15/12/25', time: '07:30 PM', amount: '₹5,600',  status: 'paid'   },
  { id: 'EXP-005', party: 'Electricity Board',    date: '10/12/25', time: '06:45 PM', amount: '₹4,200',  status: 'unpaid' },
];

const TOP_CATEGORIES = [
  { id: 'rent',    name: 'Rent',            icon: 'home-outline',       amount: '₹9,00,000', color: '#1A1A1A' },
  { id: 'salary',  name: 'Salaries',        icon: 'people-outline',     amount: '₹7,60,000', color: '#A89060' },
  { id: 'util',    name: 'Utilities',       icon: 'flash-outline',      amount: '₹2,45,000', color: '#787774' },
  { id: 'office',  name: 'Office Supplies', icon: 'cube-outline',       amount: '₹1,82,500', color: '#4A4945' },
  { id: 'transp',  name: 'Transport',       icon: 'car-outline',        amount: '₹98,200',   color: '#8B7355' },
];

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function ExpenseScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;
  const [liveExpenses, setLiveExpenses] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);

  const [expensesLoaded, setExpensesLoaded] = useState(false);

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');

  // Reset date range when FY changes
  useEffect(() => {
    if (fyFrom && fyTo) { setFromDate(isoToDMY(fyFrom)); setToDate(isoToDMY(fyTo)); }
  }, [fyFrom, fyTo]);

  useEffect(() => {
    if (!companyGuid) return;
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    getExpenses(companyGuid, from && to ? { from, to } : {}).then((res: any) => {
      setLiveExpenses(res?.data ?? []);
      if (res?.summary) setExpenseSummary(res.summary);
      setExpensesLoaded(true);
    }).catch(() => { setExpensesLoaded(true); });
  }, [companyGuid, fromDate, toDate, fyFrom, fyTo, lastSyncAt]);

  const [tab,      setTab]      = useState<'recent' | 'categories'>('recent');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  const metricRef = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);

  // Auto-scroll metric cards every 3s
  useEffect(() => {
    const t = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % METRIC_CARDS.length;
        metricRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  // Use live data if loaded, else mock (only while loading)
  const displayExpenses = expensesLoaded ? liveExpenses : RECENT_EXPENSES;
  const recent = displayExpenses.filter((exp: any) => {
    if (filter === 'Paid')   return exp.status === 'paid'   || exp.voucher_type === 'Payment';
    if (filter === 'Unpaid') return exp.status === 'unpaid' || exp.voucher_type === 'Journal';
    return true;
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Expense</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Filter Row ────────────────────────────────────────────── */}
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
                  key={opt} style={s.dropItem} activeOpacity={0.7}
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {!expensesLoaded ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={80} />
            {[...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : <>

        
        {/* ── Metric Cards Carousel ────────────────────────────────── */}
        <View style={s.carouselWrap}>
          <FlatList
            ref={metricRef}
            data={expenseSummary ? [
              { id: 'ytd', label: 'Total Expenses', icon: 'ribbon-outline', amount: expenseSummary.display || '₹0', pct: '0%', pos: false },
              { id: 'count', label: 'Expense Ledgers', icon: 'list-outline', amount: String(liveExpenses.length || 0), pct: '', pos: false },
            ] : METRIC_CARDS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={c => c.id}
            getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setMetricIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
            renderItem={({ item: c }) => (
              <View style={s.metricItem}>
                <View style={s.metricCard}>
                  <View style={s.mIcon}>
                    <Ionicons name={c.icon as any} size={22} color={COLORS.textSecondary} />
                  </View>
                  <Text style={s.mLabel}>{c.label}</Text>
                  <Text style={s.mAmount}>{c.amount}</Text>
                  <View style={[s.pctBadge, { backgroundColor: COLORS.negativeBg }]}>
                    <Ionicons name="trending-up" size={11} color={COLORS.negative} />
                    <Text style={[s.pctTxt, { color: COLORS.negative }]}>{c.pct}</Text>
                  </View>
                </View>
              </View>
            )}
          />
          <View style={s.dotsRow}>
            {METRIC_CARDS.map((_, i) => (
              <View key={i} style={[s.dot, i === metricIdx && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <View style={s.tabRow}>
          {(['recent', 'categories'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.tabBtn, tab === t && s.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabTxt, tab === t && s.tabActiveTxt]}>
                {t === 'recent' ? 'Recent Expenses' : 'Top Categories'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Expenses ─────────────────────────────────────── */}
        {tab === 'recent' && (
          <View style={s.listSection}>
            {recent.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="receipt-outline" size={28} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>No {filter.toLowerCase()} expenses</Text>
              </View>
            ) : (
              recent.map(exp => (
                <TouchableOpacity
                  key={exp.id}
                  style={s.itemCard}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/document/${exp.id}?type=expense` as any)}
                >
                  <View style={s.tallyIcon}>
                    <Ionicons name="return-down-back-outline" size={18} color={AMBER} />
                  </View>
                  <View style={s.itemCenter}>
                    <View style={s.itemTopRow}>
                      <Text style={s.itemParty} numberOfLines={1}>{exp.party}</Text>
                      <Text style={s.itemBullet}> • </Text>
                      <Text style={s.itemId}>{exp.id}</Text>
                    </View>
                    <Text style={s.itemMeta}>{exp.date} | {exp.time}</Text>
                  </View>
                  <Text style={s.itemAmt}>{exp.amount}</Text>
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={s.viewAllBtn}
              onPress={() => router.push('/expenses/register' as any)}
              activeOpacity={0.7}
            >
              <Text style={s.viewAllTxt}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Top Categories ───────────────────────────────────────── */}
        {tab === 'categories' && (
          <View style={s.listSection}>
            {TOP_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={s.catCard}
                activeOpacity={0.7}
                onPress={() => router.push('/ledger' as any)}
              >
                <View style={[s.catAvatar, { backgroundColor: cat.color }]}>
                  <Ionicons name={cat.icon as any} size={22} color={COLORS.white} />
                </View>
                <Text style={s.catName}>{cat.name}</Text>
                <Text style={s.catAmt}>{cat.amount}</Text>
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

        </>
        }
      </ScrollView>

      {/* ── Date Range Picker ────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, zIndex: 20 },
  datePill:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateTxt:   { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  statusWrap: { position: 'relative', zIndex: 100 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 88 },
  statusPillOpen: { borderColor: COLORS.brandPrimary },
  statusTxt:  { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dropMenu:   { position: 'absolute', top: 46, right: 0, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 130, zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  dropItem:   { paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt:    { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay:{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  carouselWrap: { paddingTop: SPACING.md },
  metricItem: { width: SW },
  metricCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginHorizontal: SPACING.md,
  },
  mIcon:  { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  mLabel: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  mAmount:{ fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  pctBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full },
  pctTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  dotsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },

  tabRow: { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },

  // Expense item (Sales layout — no pills)
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  tallyIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemCenter: { flex: 1 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  itemParty:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemBullet: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemId:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  itemAmt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  // Category card
  catCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  catAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catName:      { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  catAmt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 4, minWidth: 150 },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
