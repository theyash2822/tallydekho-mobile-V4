import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Share, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getPurchaseVouchers, getPurchaseVoucherCounts } from '../../src/services/api';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import SearchBar from '../../src/components/SearchBar';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import {
  PURCHASE_DOC_TYPES,
  ALL_PURCHASE_DOC_TYPE_IDS,
  DOC_TYPE_LABEL,
  FilterIconWithBadge,
  ActiveFilterChips,
  DocTypeFilterModal,
  docTypeToRouteType,
} from '../../src/components/voucherHomeFilters';
import { VoucherListTile } from '../../src/components/VoucherListTile';

const { width: SW } = Dimensions.get('window');

const STATUS_LABEL: Record<string, string> = {
  paid:       'Paid',
  unpaid:     'Unpaid',
  irm:        'IRM',
  debit_note: 'Debit Note',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type PurchaseInvoice = {
  id: string;
  guid?: string;
  number: string;
  vendor: string; date: string;
  time: string; amount: string; status: string;
  docType?: string;
  voucherType?: string;
  isOptional?: boolean;
};
type MonthGroup = { id: string; label: string; invoices: PurchaseInvoice[] };

export default function PurchaseRegisterScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const [liveInvoices, setLiveInvoices] = useState<PurchaseInvoice[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [partyGroups, setPartyGroups] = useState<string[]>([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [partyGroupOptions, setPartyGroupOptions] = useState<{ name: string; count: number }[]>([]);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [dropdown,       setDropdown]       = useState(false);

  useEffect(() => {
    if (fyFrom && fyTo) { setFromDate(isoToDMY(fyFrom)); setToDate(isoToDMY(fyTo)); }
  }, [fyFrom, fyTo]);

  const mapPurchaseInv = (r: any, i: number): PurchaseInvoice => ({
    id: r.guid || `pur-${r.voucher_number || 'x'}-${r.id ?? i}`,
    guid: r.guid,
    number: r.voucher_number || String(r.id || ''),
    vendor: r.party_name || '',
    date: r.date || '',
    time: '',
    amount: formatAmount(Math.abs(+r.amount||0)),
    status: r.is_cancelled ? 'unpaid' : 'paid',
    docType: r.doc_type || 'invoice',
    voucherType: r.voucher_type,
    isOptional: !!r.is_optional,
  });

  const docTypesParam = docTypes.length
    ? docTypes.join(',')
    : ALL_PURCHASE_DOC_TYPE_IDS.join(',');
  const partyGroupsParam = partyGroups.length ? partyGroups.join(',') : undefined;

  const loadRegister = useCallback(() => {
    if (!companyGuid) return;
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    const fyParams = from && to ? { from, to } : {};
    setIsLoading(true);
    setApiError(null);
    setPage(1);
    setHasMore(false);
    Promise.all([
      getPurchaseVouchers(companyGuid, {
        ...fyParams, limit: PAGE_SIZE, page: 1, docTypes: docTypesParam, search,
        ...(partyGroupsParam ? { partyGroups: partyGroupsParam } : {}),
      }),
      getPurchaseVoucherCounts(companyGuid, fyParams),
    ]).then(([listRes, cntRes]: any[]) => {
      const rows = listRes?.data ?? [];
      setLiveInvoices(rows.map(mapPurchaseInv));
      setHasMore(rows.length === PAGE_SIZE);
      const cntData = cntRes?.data ?? {};
      setTypeCounts(cntData);
      setPartyGroupOptions(Array.isArray(cntData.partyGroups) ? cntData.partyGroups : []);
    }).catch((err: any) => { console.error('[API Error]', err?.message); setApiError(err?.message || 'Failed to load data'); }).finally(() => setIsLoading(false));
  }, [companyGuid, fromDate, toDate, fyFrom, fyTo, formatAmount, docTypesParam, partyGroupsParam, search]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    const fyParams = from && to ? { from, to } : {};
    getPurchaseVouchers(companyGuid, {
      ...fyParams, limit: PAGE_SIZE, page: nextPage, docTypes: docTypesParam, search,
      ...(partyGroupsParam ? { partyGroups: partyGroupsParam } : {}),
    }).then((res: any) => {
      const rows = res?.data ?? [];
      setLiveInvoices(prev => [...prev, ...rows.map(mapPurchaseInv)]);
      setHasMore(rows.length === PAGE_SIZE);
      setPage(nextPage);
    }).finally(() => setIsLoadingMore(false));
  };

  // Collapsible months — all open by default
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    setExpanded(prev => {
      const next = new Set(prev);
      displayGroups.forEach(g => next.add(g.id));
      return next;
    });
  }, [liveInvoices.length]);
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
  const selectAll   = () => setSelected(displayGroups.flatMap(g => g.invoices).map(inv => inv.id));
  const clearSelect = () => setSelected([]);

  const handleShare = async () => {
    const allInvoices = displayGroups.flatMap(g => g.invoices);
    const items = allInvoices.filter(inv => selected.includes(inv.id));
    const lines = items.map(inv => `${inv.number || inv.id}  ${inv.vendor}  ${inv.amount}  ${STATUS_LABEL[inv.status] ?? inv.status}`);
    try {
      await Share.share({ message: `TallyDekho — Purchase Register\n${lines.join('\n')}`, title: 'Share Invoices' });
    } catch (err: any) { console.error('[API Error]', err?.message);
      Alert.alert('Share', `${selected.length} invoice(s) ready to share.`);
    }
    clearSelect();
  };

  const handleExport = () => {
    Alert.alert('Export', `Exporting ${selected.length} invoice(s) as Excel/PDF.`);
    clearSelect();
  };

  // Filter helper
  const filterInvoices = (invoices: PurchaseInvoice[]) =>
    invoices.filter(inv => {
      const matchSearch = !search ||
        inv.vendor.toLowerCase().includes(search.toLowerCase()) ||
        (inv.number || '').toLowerCase().includes(search.toLowerCase()) ||
        inv.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || STATUS_LABEL[inv.status] === statusFilter;
      return matchSearch && matchStatus;
    });

  // Group live invoices by month; empty list shows empty-state (no mock fallback)
  const displayGroups: MonthGroup[] = (() => {
    const map: Record<string, MonthGroup> = {};
    liveInvoices.forEach(inv => {
      let monthKey = 'Other'; let monthLabel = 'Other';
      const d = inv.date;
      if (d && d.includes('-') && d.length === 10) {
        const p = d.split('-');
        monthKey = `${p[0]}-${p[1]}`;
        monthLabel = new Date(+p[0], +p[1]-1, 1).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      } else if (d && d.includes('/')) {
        const p = d.split('/');
        monthKey = `${p[2]}-${p[1]}`;
        monthLabel = `${new Date(2000 + +p[2], +p[1]-1, 1).toLocaleString('en-IN', { month: 'short' })} ${p[2]}`;
      }
      if (!map[monthKey]) map[monthKey] = { id: monthKey, label: monthLabel, invoices: [] };
      map[monthKey].invoices.push(inv);
    });
    return Object.values(map).sort((a, b) => b.id.localeCompare(a.id));
  })();

  const allFiltered = displayGroups.flatMap(g => filterInvoices(g.invoices));

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ────────────────────────────────────────────── */}
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
          <Text style={s.headerTitle}>{t('purchase.register')}</Text>
          <FilterIconWithBadge
            testID="purchase-register-filter-btn"
            count={docTypes.length + partyGroups.length}
            onPress={() => setShowTypeFilter(true)}
          />
        </View>
      )}

      {/* ── Filter Row ──────────────────────────────────────────── */}
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
            <Text style={s.statusTxt}>{statusFilter}</Text>
            <Ionicons name={dropdown ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {dropdown && (
            <View style={s.dropMenu}>
              {['All', 'Paid', 'Unpaid', 'IRM'].map(opt => (
                <TouchableOpacity
                  key={opt} style={s.dropItem} activeOpacity={0.7}
                  onPress={() => { setStatusFilter(opt); setDropdown(false); }}
                >
                  <Text style={[s.dropTxt, statusFilter === opt && s.dropTxtActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <ActiveFilterChips
        chips={[
          ...docTypes.map((id) => ({ id: `type:${id}`, label: DOC_TYPE_LABEL[id] || id })),
          ...partyGroups.map((g) => ({ id: `group:${g}`, label: g })),
        ]}
        onRemove={(chipId) => {
          if (chipId.startsWith('type:')) setDocTypes((prev) => prev.filter((x) => x !== chipId.slice(5)));
          if (chipId.startsWith('group:')) setPartyGroups((prev) => prev.filter((x) => x !== chipId.slice(6)));
        }}
        onClearAll={() => { setDocTypes([]); setPartyGroups([]); }}
      />

      {dropdown && (
        <TouchableOpacity style={s.dropOverlay} onPress={() => setDropdown(false)} activeOpacity={1} />
      )}

      {/* ── Search ─────────────────────────────────────────────── */}
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search vouchers, vendors..." />

      {apiError && <ErrorBanner message={apiError} onRetry={loadRegister} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: isSelecting ? 120 : 40 }}>

        {/* ── Stats 2×2 Grid ──────────────────────────────────────── */}
        <View style={s.statsGrid}>
          {(() => {
            const parseAmount = (amtStr: string) => { const n = parseFloat((amtStr || '0').replace(/[₹,]/g, '')); return isNaN(n) ? 0 : n; };
            const totalAmt = allFiltered.reduce((sum, inv) => sum + parseAmount(inv.amount), 0);
            const avgAmt = allFiltered.length > 0 ? totalAmt / allFiltered.length : 0;
            const fmtAmt = (n: number) => formatAmount(Math.round(n));
            return [
              { label: 'Total', value: fmtAmt(totalAmt) },
              { label: 'Tax',   value: '—' },
              { label: 'AVG',   value: fmtAmt(avgAmt) },
              { label: 'Docs',  value: String(allFiltered.length) },
            ];
          })().map(stat => (
            <View key={stat.label} style={s.statCell}>
              <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Empty state */}
        {liveInvoices.length === 0 && allFiltered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Ionicons name="cart-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>No purchase vouchers</Text>
            <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' }}>Sync your Tally data or create a new purchase entry</Text>
          </View>
        )}
        {/* ── Collapsible Month Sections ────────────────────────────── */}
        {displayGroups.map(group => {
          const groupInvoices = filterInvoices(group.invoices);
          if (groupInvoices.length === 0) return null;
          const isOpen = expanded.has(group.id);

          return (
            <View key={group.id} style={s.monthSection}>
              {/* Month Header */}
              <TouchableOpacity
                style={s.monthHeader}
                onPress={() => toggleMonth(group.id)}
                activeOpacity={0.7}
              >
                <View style={s.monthHeaderLeft}>
                  <View style={s.monthDot} />
                  <Text style={s.monthLabel}>{group.label}</Text>
                  <Text style={s.monthCount}>{groupInvoices.length} invoices</Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>

              {/* Invoice Cards */}
              {isOpen && (
                <View style={s.listCard}>
                  {groupInvoices.map((inv, idx) => {
                    const isSelected = selected.includes(inv.id);
                    return (
                      <View key={inv.guid || `${group.id}-${idx}`}>
                        <TouchableOpacity
                          style={[s.invRow, isSelected && s.invRowSelected]}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isSelecting) { toggleSelect(inv.id); }
                            else {
                              const routeType = docTypeToRouteType(inv.docType || 'invoice', 'purchase');
                              router.push(`/document/${inv.guid || inv.id}?type=${routeType}` as any);
                            }
                          }}
                          onLongPress={() => toggleSelect(inv.id)}
                          delayLongPress={500}
                        >
                          {isSelecting && (
                            <View style={[s.selectCircle, isSelected && s.selectCircleActive]}>
                              {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                            </View>
                          )}
                          <VoucherListTile
                            party={inv.vendor}
                            voucherNo={inv.number || inv.id}
                            date={inv.date}
                            amount={inv.amount}
                            status={inv.status}
                            module="purchase"
                            docType={inv.docType}
                            voucherType={inv.voucherType}
                            isOptional={inv.isOptional}
                          />
                        </TouchableOpacity>
                        {idx < groupInvoices.length - 1 && <View style={s.divider} />}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {hasMore && (
          <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} activeOpacity={0.8}>
            {isLoadingMore
              ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
              : <Text style={s.loadMoreTxt}>Load More</Text>
            }
          </TouchableOpacity>
        )}
        {!hasMore && liveInvoices.length > 0 && (
          <Text style={s.endTxt}>All {liveInvoices.length} invoices loaded</Text>
        )}

      </ScrollView>

      {/* ── Multi-select Bottom Bar ───────────────────────────── */}
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

      <DocTypeFilterModal
        visible={showTypeFilter}
        onClose={() => setShowTypeFilter(false)}
        title="Filter Purchase"
        options={PURCHASE_DOC_TYPES}
        selectedIds={docTypes}
        selectedGroups={partyGroups}
        counts={typeCounts}
        partyGroups={partyGroupOptions}
        onApply={(ids, groups) => { setDocTypes(ids); setPartyGroups(groups); }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  selectAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary, paddingRight: 4 },

  filterRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, zIndex: 200 },
  datePill:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateTxt:       { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  statusWrap:    { position: 'relative', zIndex: 100 },
  statusPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 88 },
  statusPillOpen:{ borderColor: COLORS.brandPrimary },
  statusTxt:     { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  dropMenu:      { position: 'absolute', top: 46, right: 0, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, minWidth: 130, zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  dropItem:      { paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt:       { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  dropOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: SPACING.md, marginTop: SPACING.md, gap: 10 },
  statCell:  { width: (SW - SPACING.md * 2 - 10) / 2, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  statValue: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 4 },

  // Month Sections
  monthSection: { marginHorizontal: SPACING.md, marginTop: SPACING.md },
  monthHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  monthLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  monthCount:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  listCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  invRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 10 },
  invRowSelected: { backgroundColor: COLORS.brandPrimary + '08' },
  divider:    { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },

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
