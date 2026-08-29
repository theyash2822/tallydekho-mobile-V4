import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Share, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import SearchBar from '../../src/components/SearchBar';
import { useAuth } from '../../src/context/AuthContext';
import { getExpenses, getExpenseCounts } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import {
  FilterIconWithBadge,
  ActiveFilterChips,
  ExpenseRegisterFilterModal,
  type ExpenseTypeId,
} from '../../src/components/voucherHomeFilters';

type TxItem = { id: string; voucher: string; desc: string; date: string; amount: string; positive: boolean; type: 'payment' | 'receipt' | 'contra'; party?: string; time?: string; status?: string; };

const AMBER    = '#A89060';
const AMBER_BG = '#FDF9F4';
const { width: SW } = Dimensions.get('window');

const STATUS_COLOR: Record<string, string> = {
  paid:   '#2D7D46',
  unpaid: '#DC2626',
};
const STATUS_BG: Record<string, string> = {
  paid:   '#F0FBF4',
  unpaid: '#FFF0F0',
};
const STATUS_LABEL: Record<string, string> = {
  paid:   'Paid',
  unpaid: 'Unpaid',
};

// ─── Types ────────────────────────────────────────────────────────────
type ExpenseItem = {
  id: string; party: string; date: string;
  time: string; amount: string; status: string; type: 'direct' | 'indirect';
};
type MonthGroup = { id: string; label: string; items: ExpenseItem[] };

// ─── Month-grouped data ──────────────────────────────────────────────────
// Legacy MONTH_GROUPS removed — using live data

export default function ExpenseRegisterScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selectedFY, company } = useAuth();
  const companyGuid = company?.guid;
  const [liveItems, setLiveItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';

  const [search,       setSearch]       = useState('');
  const [typeFilters,  setTypeFilters]  = useState<ExpenseTypeId[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [showFilter,   setShowFilter]   = useState(false);
  const [typeCounts, setTypeCounts] = useState({ all: 0, direct: 0, indirect: 0 });
  const [categoryCounts, setCategoryCounts] = useState<{ name: string; count: number }[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');

  const mapExpenseItem = (r: any): ExpenseItem => {
    const group = String(r.expense_group || '');
    // Anchored — avoid "Indirect" matching includes('direct')
    const isDirect = /^direct\s*expenses?$/i.test(group.trim());
    return {
      id: r.guid || String(r.id),
      party: r.expense_ledger || r.party_name || r.narration || 'Expense',
      date: r.date || '',
      time: '',
      amount: formatAmount(Math.abs(parseFloat(r.expense_amount ?? r.amount) || 0)),
      status: 'paid',
      type: isDirect ? 'direct' : 'indirect',
    };
  };

  const loadPage = (pageNum: number, append = false) => {
    if (!companyGuid) return Promise.resolve();
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    const rangeParams = from && to ? { from, to } : {};
    const typeParam = typeFilters.length ? { types: typeFilters.join(',') } : {};
    const catParam = categoryFilters.length ? { categories: categoryFilters.join(',') } : {};
    return getExpenses(companyGuid, {
      ...rangeParams, ...typeParam, ...catParam, limit: PAGE_SIZE, page: pageNum,
    } as any).then((res: any) => {
      const rows = res?.data ?? [];
      const mapped = rows.map(mapExpenseItem);
      setLiveItems(prev => append ? [...prev, ...mapped] : mapped);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageNum);
    });
  };

  const loadCounts = () => {
    if (!companyGuid) return;
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    const rangeParams = from && to ? { from, to } : {};
    getExpenseCounts(companyGuid, rangeParams as any).then((res: any) => {
      const d = res?.data ?? {};
      setTypeCounts({
        all: d.all ?? 0,
        direct: d.direct ?? 0,
        indirect: d.indirect ?? 0,
      });
      setCategoryCounts(Array.isArray(d.categories) ? d.categories : []);
    }).catch(() => {});
  };

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    setPage(1);
    setHasMore(false);
    loadPage(1)
      .catch((err: any) => setApiError(err?.message || 'Failed to load'))
      .finally(() => setIsLoading(false));
    loadCounts();
  }, [companyGuid, fromDate, toDate, fyFrom, fyTo, typeFilters.join(','), categoryFilters.join(',')]);

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    loadPage(page + 1, true).finally(() => setIsLoadingMore(false));
  };

  // Collapsible months — all open by default
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleMonth = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Multi-select
  const [selected, setSelected] = useState<string[]>([]);
  const isSelecting = selected.length > 0;
  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const allItems   = liveItems;
  const selectAll  = () => setSelected(allItems.map(i => i.id));
  const clearSelect = () => setSelected([]);

  const handleShare = async () => {
    const items = allItems.filter(i => selected.includes(i.id));
    const lines = items.map(i => `${i.id}  ${i.party}  ${i.amount}  ${STATUS_LABEL[i.status] ?? i.status}`);
    try {
      await Share.share({ message: `TallyDekho — Expense Register\n${lines.join('\n')}`, title: 'Share Expenses' });
    } catch {
      Alert.alert('Share', `${selected.length} expense(s) ready to share.`);
    }
    clearSelect();
  };

  const handleExport = () => {
    Alert.alert('Export', `Exporting ${selected.length} expense(s) as Excel/PDF.`);
    clearSelect();
  };

  // Filter helper — type/category already applied server-side
  const filterItems = (items: ExpenseItem[]) =>
    items.filter(item => {
      const matchSearch = !search ||
        item.party.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || STATUS_LABEL[item.status] === statusFilter;
      return matchSearch && matchStatus;
    });

  const allFiltered = filterItems(liveItems);
  const totalAmt = allFiltered.reduce((sum, i) => {
    const n = parseFloat(i.amount.replace(/[₹,]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const taxAmt = Math.round(totalAmt * 0.18);

  const filterBadgeCount = typeFilters.length + categoryFilters.length;
  const activeChips = [
    ...typeFilters.map((t) => ({ id: `type:${t}`, label: t })),
    ...categoryFilters.map((c) => ({ id: `cat:${c}`, label: c })),
  ];

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ───────────────────────────────────────────── */}
      {isSelecting ? (
        <View style={s.header}>
          <TouchableOpacity onPress={clearSelect} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{selected.length} Selected</Text>
          <TouchableOpacity onPress={selectAll} activeOpacity={0.7}>
            <Text style={s.selectAllTxt}>Select All</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('expenses.register')}</Text>
          <FilterIconWithBadge
            testID="expense-register-filter-btn"
            count={filterBadgeCount}
            onPress={() => setShowFilter(true)}
          />
        </View>
      )}

      {/* ── Filter Row (date + status) ─────────────────────────── */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.datePill} onPress={() => { setStatusOpen(false); setShowDatePicker(true); }} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
          <Text style={s.dateTxt} numberOfLines={1}>{fromDate} – {toDate}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={s.filterWrap}>
          <TouchableOpacity
            style={[s.filterPill, statusOpen && s.filterPillOpen]}
            onPress={() => setStatusOpen(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.filterTxt}>{statusFilter === 'All' ? 'Status' : statusFilter}</Text>
            <Ionicons name={statusOpen ? 'chevron-up' : 'chevron-down'} size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {statusOpen && (
            <View style={s.dropMenu}>
              {['All', 'Paid', 'Unpaid'].map(opt => (
                <TouchableOpacity key={opt} style={s.dropItem} activeOpacity={0.7}
                  onPress={() => { setStatusFilter(opt); setStatusOpen(false); }}
                >
                  <Text style={[s.dropTxt, statusFilter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ActiveFilterChips
        chips={activeChips}
        onRemove={(id) => {
          if (id.startsWith('type:')) setTypeFilters((prev) => prev.filter((x) => x !== id.slice(5)));
          if (id.startsWith('cat:')) setCategoryFilters((prev) => prev.filter((x) => x !== id.slice(4)));
        }}
        onClearAll={() => { setTypeFilters([]); setCategoryFilters([]); }}
      />

      {statusOpen && (
        <TouchableOpacity style={s.dropOverlay} onPress={() => setStatusOpen(false)} activeOpacity={1} />
      )}

      {/* ── Search ─────────────────────────────────────────────── */}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search expenses, parties..." />

      {apiError && <ErrorBanner message={apiError} onRetry={() => {
        setIsLoading(true);
        loadPage(1).catch((err: any) => setApiError(err?.message || 'Failed to load')).finally(() => setIsLoading(false));
        loadCounts();
      }} />}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isSelecting ? 120 : 40 }}>

        {/* ── Stats Row (Total + Tax) ────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Text style={s.statLabel}>Total</Text>
            <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
              ₹{totalAmt.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statCell}>
            <Text style={s.statLabel}>Tax</Text>
            <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
              ₹{taxAmt.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {/* ── Section Heading ────────────────────────────────────────── */}
        <Text style={s.sectionHeading}>List Of Expenses</Text>

        {/* ── Collapsible Month Sections ────────────────────────────── */}
        {(() => {
          // Group live items by month
          const monthMap: Record<string, { id: string; label: string; items: any[] }> = {};
          filterItems(liveItems).forEach(item => {
            const d = item.date;
            let key = 'other', label = 'Other';
            if (d && d.includes('-') && d.length === 10) {
              const [y, m] = d.split('-');
              key = `${y}-${m}`;
              label = new Date(+y, +m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            }
            if (!monthMap[key]) monthMap[key] = { id: key, label, items: [] };
            monthMap[key].items.push(item);
          });
          const displayGroups = Object.values(monthMap).sort((a, b) => b.id.localeCompare(a.id));
          if (displayGroups.length === 0 && !isLoading) return (
            <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
              <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>No expenses found</Text>
            </View>
          );
          return displayGroups.map(group => {
          const groupItems = group.items;
          if (groupItems.length === 0) return null;
          const isOpen = expanded.has(group.id) !== false;

          return (
            <View key={group.id} style={s.monthSection}>
              <TouchableOpacity style={s.monthHeader} onPress={() => toggleMonth(group.id)} activeOpacity={0.7}>
                <View style={s.monthHeaderLeft}>
                  <View style={s.monthDot} />
                  <Text style={s.monthLabel}>{group.label}</Text>
                  <Text style={s.monthCount}>{groupItems.length} expenses</Text>
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {isOpen && (
                <View style={s.listCard}>
                  {groupItems.map((item, idx) => {
                    const isSel = selected.includes(item.id);
                    return (
                      <View key={item.id}>
                        <TouchableOpacity
                          style={[s.expRow, isSel && s.expRowSelected]}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isSelecting) toggleSelect(item.id);
                            else router.push(`/document/${item.id}?type=expense` as any);
                          }}
                          onLongPress={() => toggleSelect(item.id)}
                          delayLongPress={500}
                        >
                          {isSelecting && (
                            <View style={[s.selectCircle, isSel && s.selectCircleActive]}>
                              {isSel && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                            </View>
                          )}
                          <View style={s.expItemWrap}>
                            {/* Status row */}
                            <View style={s.expStatusRow}>
                              <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? '#9CA3AF' }]} />
                              <Text style={[s.expStatusTxt, { color: STATUS_COLOR[item.status] ?? '#9CA3AF' }]}>
                                {STATUS_LABEL[item.status] ?? item.status}
                              </Text>
                              <Text style={s.expBullet}> • </Text>
                              <Text style={s.expId}>{item.id}</Text>
                            </View>
                            {/* Content row */}
                            <View style={s.expContentRow}>
                              <View style={s.tallyIcon}>
                                <Ionicons name="return-down-back-outline" size={16} color={AMBER} />
                              </View>
                              <View style={s.expCenter}>
                                <Text style={s.expParty}>{item.party}</Text>
                                <Text style={s.expMeta}>{item.date} | {item.time}</Text>
                              </View>
                              <Text style={s.expAmt}>{item.amount}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        {idx < groupItems.length - 1 && <View style={s.divider} />}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
          });
        })()}

        {hasMore && (
          <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} activeOpacity={0.8}>
            {isLoadingMore
              ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
              : <Text style={s.loadMoreTxt}>Load More</Text>
            }
          </TouchableOpacity>
        )}
        {!hasMore && liveItems.length > 0 && (
          <Text style={s.endTxt}>All {liveItems.length} entries loaded</Text>
        )}

      </ScrollView>

      {/* ── Multi-select Bottom Bar ──────────────────────────── */}
      {isSelecting && (
        <View style={[s.actionBar, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <View style={s.actionBarLeft}>
            <Text style={s.actionCount}>{selected.length} selected</Text>
            <TouchableOpacity onPress={clearSelect}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={s.actionBtns}>
            <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={handleExport} activeOpacity={0.8}>
              <Ionicons name="download-outline" size={16} color={COLORS.textPrimary} />
              <Text style={s.actionBtnOutlineTxt}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={16} color={COLORS.white} />
              <Text style={s.actionBtnTxt}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Date Picker ────────────────────────────────────────── */}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate}
        toDate={toDate}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

      <ExpenseRegisterFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        activeTypes={typeFilters}
        activeCategories={categoryFilters}
        typeCounts={typeCounts}
        categories={categoryCounts}
        onApply={(types, categories) => {
          setTypeFilters(types);
          setCategoryFilters(categories);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  selectAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary, paddingRight: 4 },

  // 3-filter row
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, zIndex: 200 },
  datePill:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateTxt:   { flex: 1, fontSize: 11, color: COLORS.textPrimary, fontWeight: '500' },
  filterWrap:  { position: 'relative', zIndex: 100 },
  filterPill:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  filterPillOpen: { borderColor: COLORS.brandPrimary },
  filterTxt:   { fontSize: 11, color: COLORS.textPrimary, fontWeight: '600' },
  dropMenu:    { position: 'absolute', top: 46, right: 0, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 120, zIndex: 300, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 10 },
  dropItem:    { paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt:     { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  // Stats row (2-col horizontal)
  statsRow:    { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  statCell:    { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  statDivider: { width: 1, backgroundColor: COLORS.borderDefault },
  statLabel:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 4 },
  statValue:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },

  sectionHeading: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginHorizontal: SPACING.md, marginTop: SPACING.lg, marginBottom: 4 },

  // Month sections
  monthSection: { marginHorizontal: SPACING.md, marginTop: SPACING.sm },
  monthHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  monthLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  monthCount:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  listCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },

  expRow:         { paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 8, flexDirection: 'row', alignItems: 'center' },
  expRowSelected: { backgroundColor: COLORS.brandPrimary + '08' },
  expItemWrap:    { flex: 1, gap: 8 },
  expStatusRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot:      { width: 8, height: 8, borderRadius: 4 },
  expStatusTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  expBullet:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  expId:          { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  expContentRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tallyIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center' },
  expCenter:      { flex: 1 },
  expParty:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  expMeta:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  expAmt:         { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  divider:        { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },

  selectCircle:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  selectCircleActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  actionBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  actionBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  actionCount:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  cancelTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  actionBtns:    { flexDirection: 'row', gap: 10 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 13 },
  actionBtnTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  actionBtnOutline:    { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  actionBtnOutlineTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  loadMoreBtn: { margin:16,padding:14,borderRadius:10,backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center' },
  loadMoreTxt: { fontSize:14,fontWeight:'600',color:COLORS.brandPrimary },
  endTxt:      { textAlign:'center',fontSize:12,color:COLORS.textTertiary,padding:16 },
});
