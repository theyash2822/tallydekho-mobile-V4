import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getTransferHistory } from '../../src/services/api';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import SearchBar from '../../src/components/SearchBar';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────
interface TransferItem {
  item: string;
  qty: number;
  value: number;
  from_warehouse: string;
  to_warehouse: string;
}

interface TransferEntry {
  voucher_guid: string;
  date: string;
  voucher_number: string;
  voucher_type: string;
  items: TransferItem[];
  item_count: number;
  total_value: number;
}

const PAGE_LIMIT = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Transfer Card ─────────────────────────────────────────────────────────────
function TransferCard({
  entry,
  formatAmount,
}: {
  entry: TransferEntry;
  formatAmount: (v: number) => string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  // Aggregate unique from→to pairs for the header
  const routes = Array.from(
    new Map(
      entry.items.map(i => [`${i.from_warehouse}→${i.to_warehouse}`, { from: i.from_warehouse, to: i.to_warehouse }])
    ).values()
  );

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => setExpanded(x => !x)}
      activeOpacity={0.8}
    >
      {/* Card Header */}
      <View style={s.cardTop}>
        {/* Date + Voucher */}
        <View style={s.cardLeft}>
          <Text style={s.cardDate}>{fmtDate(entry.date)}</Text>
          {entry.voucher_number ? (
            <Text style={s.cardVoucherNo}>{entry.voucher_type} #{entry.voucher_number}</Text>
          ) : (
            <Text style={s.cardVoucherNo}>{entry.voucher_type}</Text>
          )}
        </View>
        {/* Summary + chevron */}
        <View style={s.cardRight}>
          <Text style={s.cardItemCount}>{t(entry.item_count !== 1 ? 'screens.stocksTransferHistory.itemCountOther' : 'screens.stocksTransferHistory.itemCountOne', { count: entry.item_count })}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.textTertiary}
          />
        </View>
      </View>

      {/* Route pills */}
      <View style={s.routeRow}>
        {routes.map((r, i) => (
          <View key={i} style={s.routePill}>
            <Text style={s.routeText} numberOfLines={1}>{r.from}</Text>
            <Ionicons name="arrow-forward" size={12} color={COLORS.brandPrimary} style={{ marginHorizontal: 4 }} />
            <Text style={s.routeText} numberOfLines={1}>{r.to}</Text>
          </View>
        ))}
      </View>

      {/* Expanded item rows */}
      {expanded && (
        <View style={s.itemList}>
          <View style={s.divider} />
          {entry.items.map((item, idx) => (
            <View key={idx} style={s.itemRow}>
              <View style={s.itemLeft}>
                <View style={s.itemDot} />
                <Text style={s.itemName} numberOfLines={2}>{item.item}</Text>
              </View>
              <View style={s.itemRight}>
                <Text style={s.itemQty}>{t('screens.stocksTransferHistory.qtyUnits', { qty: item.qty })}</Text>
                {item.value > 0 && (
                  <Text style={s.itemValue}>{formatAmount(item.value)}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function TransferHistoryScreen() {
  const { t } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const { formatAmount, formatDate } = useSettings();
  const companyGuid = company?.guid;
  const fyParam     = fyInfoToParam(selectedFY);
  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';

  const [entries,     setEntries]     = useState<TransferEntry[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isMore,      setIsMore]      = useState(false);
  const [apiError,    setApiError]    = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  // Home FY change clears custom range (year switcher is Home only)
  const [prevFyRange, setPrevFyRange] = useState({ start: selectedFY?.startDate, end: selectedFY?.endDate });
  if (prevFyRange.start !== selectedFY?.startDate || prevFyRange.end !== selectedFY?.endDate) {
    setPrevFyRange({ start: selectedFY?.startDate, end: selectedFY?.endDate });
    setDateFrom('');
    setDateTo('');
  }
  const [showDatePick,setShowDatePick]= useState(false);

  const dateLabel = dateFrom && dateTo ? `${formatDate(dateFrom)} — ${formatDate(dateTo)}` : t('screens.stocksTransferHistory.allDates');
  const hasCustomDate = !!(dateFrom && dateTo);

  const fetchPage = useCallback((pg: number, reset: boolean) => {
    if (!companyGuid) return;
    const params: Record<string, string> = { page: String(pg), limit: String(PAGE_LIMIT) };
    if (hasCustomDate) {
      // explicit date range overrides FY
      params.from = dateFrom;
      params.to   = dateTo;
    } else if (fyParam) {
      params.fy = fyParam;
    }
    getTransferHistory(companyGuid, params)
      .then((res: any) => {
        const rows: TransferEntry[] = res?.data ?? [];
        setEntries(prev => (reset || pg === 1) ? rows : [...prev, ...rows]);
        setTotal(res?.total ?? 0);
        setPage(pg);
      })
      .catch((e: any) => {
        setApiError(e?.message || t('screens.stocksTransferHistory.loadFailed'));
      })
      .finally(() => {
        setIsLoading(false);
        setIsMore(false);
      });
  }, [companyGuid, fyParam, hasCustomDate, dateFrom, dateTo, t]);

  const load = (pg = 1, reset = false) => {
    if (!companyGuid) return;
    if (pg === 1) setIsLoading(true);
    else setIsMore(true);
    setApiError(null);
    fetchPage(pg, reset);
  };

  const loadKey = `${companyGuid}|${fyParam}|${hasCustomDate}|${dateFrom}|${dateTo}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (loadedKey !== loadKey) {
    setLoadedKey(loadKey);
    if (companyGuid) {
      setIsLoading(true);
      setApiError(null);
    }
  }

  useEffect(() => { fetchPage(1, true); }, [fetchPage]);

  const loadMore = () => {
    if (isMore || isLoading) return;
    const totalLoaded = entries.length;
    if (totalLoaded >= total) return;
    load(page + 1);
  };

  // Client-side search filter
  const filtered = search.trim()
    ? entries.filter(e =>
        e.items.some(i => i.item.toLowerCase().includes(search.toLowerCase())) ||
        (e.voucher_number && e.voucher_number.toLowerCase().includes(search.toLowerCase()))
      )
    : entries;

  const renderFooter = () => {
    if (!isMore) return null;
    return (
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={COLORS.brandPrimary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={s.emptyContainer}>
        <View style={s.iconWrap}>
          <Ionicons name="swap-horizontal-outline" size={48} color={COLORS.textTertiary} />
        </View>
        <Text style={s.emptyTitle}>{t('screens.stocksTransferHistory.emptyTitle')}</Text>
        <Text style={s.emptyDesc}>
          {search.trim()
            ? t('screens.stocksTransferHistory.emptySearch')
            : t('screens.stocksTransferHistory.emptyDesc')}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('stocks.transferHistory')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Date filter pill */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.filterPill, hasCustomDate && s.filterPillActive]}
          onPress={() => setShowDatePick(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={14} color={hasCustomDate ? COLORS.brandPrimary : COLORS.textSecondary} />
          <Text style={[s.filterPillTxt, hasCustomDate && s.filterPillTxtActive]} numberOfLines={1}>{dateLabel}</Text>
          {hasCustomDate
            ? <TouchableOpacity onPress={() => { setDateFrom(''); setDateTo(''); }} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
              </TouchableOpacity>
            : <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
          }
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder={t('screens.stocksTransferHistory.searchPlaceholder')}
        inputProps={{ returnKeyType: 'search' }}
      />

      {/* Summary strip */}
      {!isLoading && total > 0 && (
        <View style={s.summaryStrip}>
          <Text style={s.summaryText}>{t(total !== 1 ? 'screens.stocksTransferHistory.foundOther' : 'screens.stocksTransferHistory.foundOne', { count: total })}</Text>
          {selectedFY && (
            <Text style={s.summaryFY}>{selectedFY.label ?? ''}</Text>
          )}
        </View>
      )}

      {/* Error */}
      {apiError && (
        <ErrorBanner message={apiError} onRetry={() => load(1, true)} />
      )}

      {/* Loading skeletons */}
      {isLoading ? (
        <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm }}>
          {[...Array(6)].map((_, i) => <LedgerRowSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.voucher_guid}
          renderItem={({ item }) => (
            <TransferCard entry={item} formatAmount={formatAmount} />
          )}
          contentContainerStyle={[
            s.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
          ListEmptyComponent={renderEmpty}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Date Range Picker */}
      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom || fyFrom}
        toDate={dateTo || fyTo}
        onApply={(f, to) => { setDateFrom(f); setDateTo(to); setShowDatePick(false); }}
        onClose={() => setShowDatePick(false)}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary,
  },

  summaryStrip: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs,
  },
  summaryText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  summaryFY:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },

  // ── Card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardDate: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  cardVoucherNo: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  cardItemCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  routeRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACING.sm, gap: 6 },
  routePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    maxWidth: '90%',
  },
  routeText: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, maxWidth: 130 },

  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  itemList: {},
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  itemDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.brandPrimary,
    marginTop: 5, marginRight: 8, flexShrink: 0,
  },
  itemName: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, flex: 1 },
  itemRight: { alignItems: 'flex-end' },
  itemQty:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemValue: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // ── Empty ─────────────────────────────────────────────────────────
  // ── Date filter ──────────────────────────────────────────────────────
  filterRow: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
  },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  filterPillActive:    { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  filterPillTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterPillTxtActive: { color: COLORS.brandPrimary },

    emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: 80,
  },
  iconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: SPACING.sm,
  },
  emptyDesc: {
    fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
});
