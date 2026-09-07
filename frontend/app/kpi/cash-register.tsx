import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getVouchers } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import SearchBar from '../../src/components/SearchBar';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import FilterBottomSheet, { FilterCheckRow, filterSheetContentStyles as fm } from '../../src/components/FilterBottomSheet';
import { FilterIconWithBadge, ActiveFilterChips } from '../../src/components/voucherHomeFilters';
import { useTranslation } from 'react-i18next';
import {
  promptShareMode,
  shareDayBookPdf,
  shareVouchersAsMultiPagePdf,
  companyFromAuth,
  dayBookRowFromListItem,
} from '../../src/utils/multiShare';
import { TX_TO_DOC_TYPE } from '../../src/utils/documentHelpers';

// ── Types ───────────────────────────────────────────────────────────────────
type TxType = 'payment' | 'receipt' | 'contra';
type FilterType = 'all' | 'inflow' | 'outflow';

interface TxItem {
  id: string; voucher: string; desc: string; date: string;
  amount: string; positive: boolean; type: TxType;
}
interface MonthGroup { id: string; label: string; items: TxItem[] }

const CASH_VOUCHER_TYPES = ['Payment', 'Receipt', 'Contra'];
const TYPE_LABELS: Record<FilterType, string> = {
  all: 'All',
  inflow: 'Inflow',
  outflow: 'Outflow',
};

function isCashVoucher(row: any): boolean {
  const vt = (row.voucher_type || '').toLowerCase();
  return CASH_VOUCHER_TYPES.some(t => vt.includes(t.toLowerCase()));
}

function matchesFlowFilter(row: any, flow: FilterType): boolean {
  const vt = (row.voucher_type || '').toLowerCase();
  if (flow === 'inflow') return vt.includes('receipt');
  if (flow === 'outflow') return vt.includes('payment') || vt.includes('contra');
  return isCashVoucher(row);
}

function CashRegisterFilterModal({
  visible,
  onClose,
  typeFilter,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  typeFilter: FilterType;
  onApply: (type: FilterType) => void;
}) {
  const [localType, setLocalType] = useState<FilterType>(typeFilter);

  useEffect(() => {
    if (visible) setLocalType(typeFilter);
  }, [visible, typeFilter]);

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter"
      activeCount={localType !== 'all' ? 1 : 0}
      onClear={() => setLocalType('all')}
      onApply={() => onApply(localType)}
      applyLabel="Apply Filters"
      heightFraction={0.42}
    >
      <View style={fm.tabs}>
        <TouchableOpacity style={[fm.tab, fm.tabActive]} activeOpacity={1}>
          <Text style={[fm.tabTxt, fm.tabTxtActive]}>Type</Text>
        </TouchableOpacity>
      </View>
      <View style={fm.panel}>
        {(['all', 'inflow', 'outflow'] as FilterType[]).map(opt => (
          <FilterCheckRow
            key={opt}
            label={TYPE_LABELS[opt]}
            selected={localType === opt}
            onPress={() => setLocalType(opt)}
          />
        ))}
      </View>
    </FilterBottomSheet>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CashRegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const { formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';

  const [liveItems, setLiveItems] = useState<TxItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [showFilter, setShowFilter] = useState(false);
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => (fyFrom ? isoToDMY(fyFrom) : ''));
  const [dateTo, setDateTo] = useState(() => (fyTo ? isoToDMY(fyTo) : ''));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (fyFrom && fyTo) {
      setDateFrom(isoToDMY(fyFrom));
      setDateTo(isoToDMY(fyTo));
    }
  }, [fyFrom, fyTo]);

  const mapCashItem = useCallback((r: any): TxItem => ({
    id: r.guid || String(r.id),
    voucher: r.voucher_number || '',
    desc: r.narration || r.party_name || '',
    date: r.date || '',
    amount: formatAmount(Math.abs(+r.amount || 0)),
    positive: (r.voucher_type || '').toLowerCase().includes('receipt'),
    type: (r.voucher_type || '').toLowerCase().includes('payment') ? 'payment' as TxType
      : (r.voucher_type || '').toLowerCase().includes('receipt') ? 'receipt' as TxType
      : 'contra' as TxType,
  }), [formatAmount]);

  const fetchParams = useCallback((pageNum: number) => {
    const from = dmyToISO(dateFrom) || fyFrom;
    const to = dmyToISO(dateTo) || fyTo;
    const apiType = typeFilter === 'inflow' ? 'receipt' : undefined;
    return {
      apiType,
      query: {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        limit: PAGE_SIZE,
        page: pageNum,
      },
    };
  }, [dateFrom, dateTo, fyFrom, fyTo, typeFilter]);

  const filterRows = useCallback((rows: any[]) => (
    rows
      .filter(isCashVoucher)
      .filter(r => matchesFlowFilter(r, typeFilter))
      .map(mapCashItem)
  ), [mapCashItem, typeFilter]);

  const loadCash = useCallback(() => {
    if (!companyGuid) return;
    setPage(1);
    setHasMore(false);
    setIsLoading(true);
    setApiError(null);
    const { apiType, query } = fetchParams(1);
    getVouchers(companyGuid, apiType, query)
      .then((res: any) => {
        const rows = filterRows(res?.data ?? []);
        setLiveItems(rows);
        setHasMore((res?.data ?? []).length === PAGE_SIZE);
      })
      .catch((err: any) => setApiError(err?.message || 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, fetchParams, filterRows]);

  useEffect(() => {
    loadCash();
  }, [loadCash]);

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    const { apiType, query } = fetchParams(nextPage);
    getVouchers(companyGuid, apiType, { ...query, page: nextPage })
      .then((res: any) => {
        const rows = filterRows(res?.data ?? []);
        setLiveItems(prev => [...prev, ...rows]);
        setHasMore((res?.data ?? []).length === PAGE_SIZE);
        setPage(nextPage);
      })
      .finally(() => setIsLoadingMore(false));
  };

  const inflowTotal = liveItems.filter(i => i.positive).reduce((a, i) => a + parseFloat(i.amount.replace(/[^0-9.]/g, '')), 0);
  const outflowTotal = liveItems.filter(i => !i.positive).reduce((a, i) => a + parseFloat(i.amount.replace(/[^0-9.]/g, '')), 0);

  const fmtAmt = (v: number) => {
    if (v >= 100000) return `\u20b9${(v / 100000).toFixed(2)}L`;
    if (v >= 1000) return `\u20b9${(v / 1000).toFixed(0)}K`;
    return `\u20b9${v}`;
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const clearSelect = () => setSelected(new Set());
  const selectAllVisible = () => {
    const ids = filteredGroups.flatMap(g => g.items.map(i => i.id));
    setSelected(new Set(ids));
  };

  const runShare = async (mode: 'individual' | 'combined') => {
    if (!companyGuid || selected.size === 0 || isSharing) return;
    const items = liveItems.filter(i => selected.has(i.id));
    if (!items.length) return;
    setIsSharing(true);
    try {
      if (mode === 'combined') {
        await shareDayBookPdf({
          company: companyFromAuth(company),
          title: 'Cash Register',
          period: `${dateFrom} – ${dateTo}`,
          rows: items.map(item => dayBookRowFromListItem({
            date: item.date,
            particulars: item.desc,
            voucherType: item.type,
            number: item.voucher,
            amount: item.amount,
            isDebit: !item.positive,
          })),
        }, { onBeforeShare: () => setIsSharing(false) });
      } else {
        const typeLabel = (t: TxType) =>
          t === 'payment' ? 'Payment' : t === 'receipt' ? 'Receipt' : 'Contra';
        const { shared, failed } = await shareVouchersAsMultiPagePdf(
          companyGuid,
          items.map(item => ({
            guid: item.id,
            documentType: TX_TO_DOC_TYPE[typeLabel(item.type)] || undefined,
            label: `${typeLabel(item.type)}-${item.voucher || item.id}.pdf`,
          })),
          {
            fileName: `Cash-Register (${items.length}).pdf`,
            onBeforeShare: () => setIsSharing(false),
          }
        );
        if (failed > 0) {
          Toast.show({ type: 'info', text1: `Shared ${shared} of ${items.length}`, text2: `${failed} could not be loaded` });
        }
      }
      clearSelect();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not share PDFs.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShare = () => {
    if (!companyGuid || selected.size === 0 || isSharing) return;
    promptShareMode({ onChoose: (mode) => { void runShare(mode); } });
  };

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const toggleMonth = (id: string) => {
    setCollapsedMonths(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const monthMap: Record<string, MonthGroup> = {};
  liveItems.forEach(item => {
    const d = item.date;
    let key = 'other';
    let label = 'Other';
    if (d && d.includes('-') && d.length === 10) {
      const [y, m] = d.split('-');
      key = `${y}-${m}`;
      label = new Date(+y, +m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    }
    if (!monthMap[key]) monthMap[key] = { id: key, label, items: [] };
    monthMap[key].items.push(item);
  });

  const filteredGroups = Object.values(monthMap)
    .sort((a, b) => b.id.localeCompare(a.id))
    .map(g => ({
      ...g,
      items: g.items.filter(item => {
        if (!search) return true;
        const q = search.toLowerCase();
        return item.desc.toLowerCase().includes(q) || item.voucher.toLowerCase().includes(q);
      }),
    }))
    .filter(g => g.items.length > 0);

  const activeFilterCount = typeFilter !== 'all' ? 1 : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {apiError && <ErrorBanner message={apiError} onRetry={loadCash} />}

      <ScreenHeader
        title={t('kpi.cashRegister')}
        onBack={() => router.back()}
        right={(
          <View style={s.headerActions}>
            <TouchableOpacity
              style={s.headerIconBtn}
              onPress={() => setShowDatePick(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <FilterIconWithBadge count={activeFilterCount} onPress={() => setShowFilter(true)} />
          </View>
        )}
      />

      {typeFilter !== 'all' && (
        <ActiveFilterChips
          variant="amber"
          chips={[{ id: 'type', label: TYPE_LABELS[typeFilter] }]}
          onRemove={() => setTypeFilter('all')}
          onClearAll={() => setTypeFilter('all')}
        />
      )}

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search transactions..."
      />

      <View style={s.summaryRow}>
        <View style={s.summaryItem}>
          <Text style={s.summaryLbl}>Inflow</Text>
          <Text style={[s.summaryVal, { color: COLORS.positive }]}>+{fmtAmt(inflowTotal)}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryLbl}>Outflow</Text>
          <Text style={[s.summaryVal, { color: COLORS.negative }]}>-{fmtAmt(outflowTotal)}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={s.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {isLoading ? (
            <View style={{ paddingHorizontal: 16 }}>
              <CardSkeleton height={120} />
              {[...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)}
            </View>
          ) : filteredGroups.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="document-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>No transactions found</Text>
            </View>
          ) : (
            filteredGroups.map(group => {
              const isCollapsed = collapsedMonths.has(group.id);
              return (
                <View key={group.id} style={s.groupWrap}>
                  <TouchableOpacity style={s.monthHeader} onPress={() => toggleMonth(group.id)} activeOpacity={0.7}>
                    <View style={s.monthDot} />
                    <Text style={s.monthHeaderLabel}>{group.label}</Text>
                    <Text style={[s.monthHeaderCount, { flex: 1 }]}>{group.items.length} entries</Text>
                    <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
                  </TouchableOpacity>

                  {!isCollapsed && group.items.map((item) => {
                    const isSel = selected.has(item.id);
                    const typeColor = item.type === 'receipt' ? COLORS.positive : item.type === 'contra' ? '#A89060' : COLORS.negative;
                    const typeLabel = item.type === 'receipt' ? 'Cr' : 'Dr';
                    const typeBg = item.type === 'receipt' ? COLORS.positiveBg : item.type === 'contra' ? '#FDF9F4' : COLORS.negativeBg;

                    return (
                      <EntityListTile
                        key={item.id}
                        name={item.desc}
                        subtitle={`${item.voucher} · ${item.date}`}
                        selected={isSel}
                        onPress={() => {
                          if (selected.size > 0) {
                            toggleSelect(item.id);
                          } else {
                            router.push(`/document/${item.id}` as any);
                          }
                        }}
                        onLongPress={() => toggleSelect(item.id)}
                        trailing={(
                          <View style={s.itemRight}>
                            <Text style={[s.itemAmt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
                              {item.positive ? '+' : '-'}{item.amount}
                            </Text>
                            <View style={[s.crDrBadge, { backgroundColor: typeBg }]}>
                              <Text style={[s.crDrTxt, { color: typeColor }]}>{typeLabel}</Text>
                            </View>
                          </View>
                        )}
                        style={{ marginBottom: 8 }}
                      />
                    );
                  })}
                </View>
              );
            })
          )}

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
          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {selected.size > 0 && (
        <View style={s.shareBtnWrap}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{selected.size} selected</Text>
            <TouchableOpacity onPress={selectAllVisible} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.shareLink}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={s.shareLink}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.shareBtn, isSharing && { opacity: 0.6 }]}
            onPress={handleShare}
            activeOpacity={0.8}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="share-social-outline" size={18} color="#fff" />
            }
            <Text style={s.shareBtnTxt}>{isSharing ? 'Preparing…' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <CashRegisterFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        typeFilter={typeFilter}
        onApply={(next) => setTypeFilter(next)}
      />

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom}
        toDate={dateTo}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryRow: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  summaryItem: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14, alignItems: 'center' },
  summaryLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 4 },
  summaryVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderDefault, marginVertical: 10 },

  list: { flex: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  groupWrap: { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  monthDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  monthHeaderLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  monthHeaderCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  itemRight: { alignItems: 'flex-end', gap: 6 },
  itemAmt: { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  crDrBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  crDrTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  shareBtnWrap: { paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 10 },
  shareLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareLink: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },
  shareBtn: { backgroundColor: '#1A1A1A', borderRadius: RADIUS.lg, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  loadMoreBtn: { margin: 16, padding: 14, borderRadius: 10, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  loadMoreTxt: { fontSize: 14, fontWeight: '600', color: COLORS.brandPrimary },
  endTxt: { textAlign: 'center', fontSize: 12, color: COLORS.textTertiary, padding: 16 },
});
