import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER    = '#A89060';
const AMBER_BG = '#FDF9F4';
const { width: SW } = Dimensions.get('window');

const CATEGORY_COLORS = ['#1A1A1A', '#A89060', '#787774', '#4A4945', '#8B7355', '#2563EB', '#059669', '#7C3AED'];
const CATEGORY_ICONS = ['receipt-outline', 'flash-outline', 'car-outline', 'home-outline', 'people-outline', 'cube-outline', 'wallet-outline', 'construct-outline'];

type ExpenseRow = {
  id: string;
  guid?: string;
  party: string;
  date: string;
  time: string;
  amount: string;
  status: string;
  expenseGroup?: string;
};

function mapExpenseRow(r: any, formatAmount: (n: number) => string): ExpenseRow {
  const amt = Math.abs(parseFloat(r.expense_amount ?? r.amount) || 0);
  return {
    id: r.voucher_number || String(r.id),
    guid: r.guid,
    party: r.expense_ledger || r.party_name || r.narration || 'Expense',
    date: r.date || '',
    time: '',
    amount: formatAmount(amt),
    status: 'paid',
    expenseGroup: r.expense_group || '',
  };
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function ExpenseScreen() {
  const { formatAmount, formatAmountCompact } = useSettings();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;

  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [liveExpenses, setLiveExpenses] = useState<ExpenseRow[]>([]);
  const [liveCategories, setLiveCategories] = useState<any[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<any>(null);

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');

  const [tab,      setTab]      = useState<'recent' | 'categories'>('recent');
  const [filter,   setFilter]   = useState('All');
  const [dropdown, setDropdown] = useState(false);

  const metricRef = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);

  const loadData = useCallback(() => {
    if (!companyGuid) {
      setLiveExpenses([]);
      setLiveCategories([]);
      setExpenseSummary(null);
      setIsLoading(false);
      return;
    }

    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    const rangeParams = from && to ? { from, to } : {};

    setIsLoading(true);
    setApiError(null);

    getExpenses(companyGuid, { ...rangeParams, limit: '100', page: '1' } as any)
      .then((res: any) => {
        const rows = res?.data ?? [];
        setLiveExpenses(rows.map((r: any) => mapExpenseRow(r, formatAmount)));
        setExpenseSummary(res?.summary ?? null);
        setLiveCategories((res?.categories ?? []).map((c: any, i: number) => ({
          id: c.id || `cat${i}`,
          name: c.name || 'Expense',
          amount: formatAmount(Math.round(c.amount_raw || 0)),
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          icon: CATEGORY_ICONS[i % CATEGORY_ICONS.length],
        })));
      })
      .catch((err: any) => {
        setApiError(err?.message || 'Failed to load expenses');
        setLiveExpenses([]);
        setLiveCategories([]);
        setExpenseSummary(null);
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid, fromDate, toDate, fyFrom, fyTo, formatAmount]);

  useEffect(() => {
    if (fyFrom && fyTo) { setFromDate(isoToDMY(fyFrom)); setToDate(isoToDMY(fyTo)); }
  }, [fyFrom, fyTo]);

  useEffect(() => {
    loadData();
  }, [loadData, lastSyncAt]);

  const metricCards = useMemo(() => {
    const total = expenseSummary?.display || formatAmountCompact(0);
    const count = expenseSummary?.count ?? liveExpenses.length;
    return [
      { id: 'total', label: 'Total Expenses', icon: 'ribbon-outline', amount: total, pct: '' },
      { id: 'count', label: 'Transactions', icon: 'list-outline', amount: String(count), pct: '' },
    ];
  }, [expenseSummary, liveExpenses.length, formatAmountCompact]);

  useEffect(() => {
    if (metricCards.length <= 1) return;
    const t = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % metricCards.length;
        metricRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [metricCards.length]);

  const recent = useMemo(() => liveExpenses.filter((exp) => {
    if (filter === 'Direct') return (exp.expenseGroup || '').toLowerCase().includes('direct');
    if (filter === 'Indirect') return (exp.expenseGroup || '').toLowerCase().includes('indirect');
    return true;
  }).slice(0, 10), [liveExpenses, filter]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={loadData} />}

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
              {['All', 'Direct', 'Indirect'].map(opt => (
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
        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={80} />
            {[...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            <View style={s.carouselWrap}>
              <FlatList
                ref={metricRef}
                data={metricCards}
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
                    </View>
                  </View>
                )}
              />
              <View style={s.dotsRow}>
                {metricCards.map((_, i) => (
                  <View key={i} style={[s.dot, i === metricIdx && s.dotActive]} />
                ))}
              </View>
            </View>

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

            {tab === 'recent' && (
              <View style={s.listSection}>
                {recent.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="receipt-outline" size={28} color={COLORS.textTertiary} />
                    <Text style={s.emptyTxt}>No expenses in this period</Text>
                  </View>
                ) : (
                  recent.map((exp, index) => (
                    <TouchableOpacity
                      key={exp.guid || `expense-${index}`}
                      style={s.itemCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/document/${exp.guid || exp.id}?type=expense` as any)}
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
                        <Text style={s.itemMeta}>{exp.date}{exp.expenseGroup ? ` | ${exp.expenseGroup}` : ''}</Text>
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

            {tab === 'categories' && (
              <View style={s.listSection}>
                {liveCategories.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="pie-chart-outline" size={28} color={COLORS.textTertiary} />
                    <Text style={s.emptyTxt}>No expense categories in this period</Text>
                  </View>
                ) : (
                  liveCategories.map((cat, index) => (
                    <TouchableOpacity
                      key={`${cat.id}-${index}`}
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
                  ))
                )}
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
        )}
      </ScrollView>

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

  dotsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 4 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },

  tabRow: { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },

  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  tallyIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemCenter: { flex: 1 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  itemParty:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemBullet: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemId:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  itemAmt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  catCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  catAvatar:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catName:      { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  catAmt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },

  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 4, minWidth: 150 },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
