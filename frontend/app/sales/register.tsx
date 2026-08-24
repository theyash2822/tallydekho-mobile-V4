import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Dimensions, Share, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getSalesInvoices } from '../../src/services/api';
import DateRangePickerModal, { isoToDMY, dmyToISO } from '../../src/components/DateRangePickerModal';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER    = '#A89060';
const AMBER_BG = '#FDF9F4';
const { width: SW } = Dimensions.get('window');

const STATUS_COLOR: Record<string, string> = {
  paid:        '#2D7D46',
  unpaid:      '#DC2626',
  irm:         '#787774',
  credit_note: '#A89060',
};
const STATUS_BG: Record<string, string> = {
  paid:        '#F0FBF4',
  unpaid:      '#FFF0F0',
  irm:         '#F5F5F5',
  credit_note: '#FDF9F4',
};
const STATUS_LABEL: Record<string, string> = {
  paid:        'Paid',
  unpaid:      'Unpaid',
  irm:         'IRM',
  credit_note: 'Credit Note',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Invoice = {
  id: string; party: string; date: string;
  time: string; amount: string; status: string;
};
type MonthGroup = { id: string; label: string; invoices: Invoice[] };

export default function SalesRegisterScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;

  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [dropdown,       setDropdown]       = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Init date range from selected FY; update when FY changes
  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';
  const [fromDate, setFromDate] = useState(() => fyFrom ? isoToDMY(fyFrom) : '01/04/24');
  const [toDate,   setToDate]   = useState(() => fyTo   ? isoToDMY(fyTo)   : '31/03/25');
  const [liveInvoices, setLiveInvoices]     = useState<Invoice[]>([]);
  const [loadingData, setLoadingData]       = useState(false);
  const [apiError, setApiError]              = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // When FY changes, reset date range to full FY
  useEffect(() => {
    if (fyFrom && fyTo) {
      setFromDate(isoToDMY(fyFrom));
      setToDate(isoToDMY(fyTo));
    }
  }, [fyFrom, fyTo]);

  const mapSalesInv = (r: any): Invoice => ({
    id: r.voucher_number || String(r.id),
    party: r.party_name || '',
    date: r.date || '',
    time: '',
    amount: formatAmount(Math.abs(+r.amount||0)),
    status: r.is_cancelled ? 'unpaid' : 'paid',
  });

  useEffect(() => {
    if (!companyGuid) return;
    setLoadingData(true);
    setPage(1);
    setHasMore(false);
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    setApiError(null);
    getSalesInvoices(companyGuid, { search, ...(from && to ? { from, to } : {}), limit: PAGE_SIZE, page: 1 }).then((res: any) => {
      const rows = res?.data ?? [];
      setLiveInvoices(rows.map(mapSalesInv));
      setHasMore(rows.length === PAGE_SIZE);
    }).catch((err: any) => {
      setApiError(err?.message || 'Failed to load sales data');
    }).finally(() => setLoadingData(false));
  }, [companyGuid, search, fromDate, toDate, fyFrom, fyTo]);

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    const from = dmyToISO(fromDate) || fyFrom;
    const to   = dmyToISO(toDate)   || fyTo;
    getSalesInvoices(companyGuid, { search, ...(from && to ? { from, to } : {}), limit: PAGE_SIZE, page: nextPage }).then((res: any) => {
      const rows = res?.data ?? [];
      setLiveInvoices(prev => [...prev, ...rows.map(mapSalesInv)]);
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
  // allInvoices computed after displayGroups (declared below)
  const selectAll   = () => setSelected(displayGroups.flatMap(g => g.invoices).map(inv => inv.id));
  const clearSelect = () => setSelected([]);

  const handleShare = async () => {
    const allInvoices = displayGroups.flatMap(g => g.invoices);
    const items = allInvoices.filter(inv => selected.includes(inv.id));
    const lines = items.map(inv => `${inv.id}  ${inv.party}  ${inv.amount}  ${STATUS_LABEL[inv.status] ?? inv.status}`);
    try {
      await Share.share({ message: `TallyDekho — Sales Register\n${lines.join('\n')}`, title: 'Share Invoices' });
    } catch {
      Alert.alert('Share', `${selected.length} invoice(s) ready to share.`);
    }
    clearSelect();
  };

  const handleExport = () => {
    Alert.alert('Export', `Exporting ${selected.length} invoice(s) as Excel/PDF.`);
    clearSelect();
  };

  // Filter helper
  const filterInvoices = (invoices: Invoice[]) =>
    invoices.filter(inv => {
      const matchSearch = !search ||
        inv.party.toLowerCase().includes(search.toLowerCase()) ||
        inv.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || STATUS_LABEL[inv.status] === statusFilter;
      return matchSearch && matchStatus;
    });

  // Group live invoices by month; empty list shows empty-state (no mock fallback)
  const displayGroups: MonthGroup[] = (() => {
    const map: Record<string, MonthGroup> = {};
    liveInvoices.forEach(inv => {
      let monthKey = 'Other';
      let monthLabel = 'Other';
      const d = inv.date;
      if (d && d.includes('-') && d.length === 10) {
        const parts = d.split('-');
        const mo = new Date(+parts[0], +parts[1]-1, 1);
        monthKey  = `${parts[0]}-${parts[1]}`;
        monthLabel = mo.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      } else if (d && d.includes('/')) {
        const parts = d.split('/');
        monthKey  = `${parts[2]}-${parts[1]}`;
        monthLabel = `${new Date(2000 + +parts[2], +parts[1]-1, 1).toLocaleString('en-IN', { month: 'short' })} ${parts[2]}`;
      }
      if (!map[monthKey]) map[monthKey] = { id: monthKey, label: monthLabel, invoices: [] };
      map[monthKey].invoices.push(inv);
    });
    return Object.values(map).sort((a, b) => b.id.localeCompare(a.id));
  })();

  // Summary stats across all months
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
          <Text style={s.headerTitle}>Sales Register</Text>
          <View style={{ width: 36 }} />
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
              {['All', 'Paid', 'Unpaid'].map(opt => (
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

      {dropdown && (
        <TouchableOpacity style={s.dropOverlay} onPress={() => setDropdown(false)} activeOpacity={1} />
      )}

      {/* ── Search ─────────────────────────────────────────────── */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search invoices, parties..."
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {apiError && <ErrorBanner message={apiError} onRetry={() => { /* trigger reload */ }} />}
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

        {/* Empty state when live data is loaded but empty */}
        {!loadingData && liveInvoices.length === 0 && allFiltered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Ionicons name="document-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>No sales invoices</Text>
            <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' }}>Sync your Tally data or create a new invoice</Text>
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

              {/* Invoice Card */}
              {isOpen && (
                <View style={s.listCard}>
                  {groupInvoices.map((inv, idx) => {
                    const isSelected = selected.includes(inv.id);
                    return (
                      <View key={inv.id}>
                        <TouchableOpacity
                          style={[s.invRow, isSelected && s.invRowSelected]}
                          activeOpacity={0.7}
                          onPress={() => {
                            if (isSelecting) { toggleSelect(inv.id); }
                            else { router.push(`/document/${inv.id}?type=sales_invoice` as any); }
                          }}
                          onLongPress={() => toggleSelect(inv.id)}
                          delayLongPress={500}
                        >
                          {isSelecting && (
                            <View style={[s.selectCircle, isSelected && s.selectCircleActive]}>
                              {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                            </View>
                          )}
                          <View style={s.invLeft}>
                            <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[inv.status] ?? COLORS.textTertiary }]} />
                            <View style={s.invInfo}>
                              <View style={s.invTopRow}>
                                <View style={[s.statusPillBadge, { backgroundColor: STATUS_BG[inv.status] ?? '#F5F5F5', borderColor: STATUS_COLOR[inv.status] ?? COLORS.textTertiary }]}>
                                  <Text style={[s.statusPillTxt, { color: STATUS_COLOR[inv.status] ?? COLORS.textTertiary }]}>
                                    {STATUS_LABEL[inv.status] ?? inv.status}
                                  </Text>
                                </View>
                                <Text style={s.invId}>• {inv.id}</Text>
                              </View>
                              <Text style={s.invParty}>{inv.party}</Text>
                              <Text style={s.invMeta}>{inv.date} | {inv.time}</Text>
                            </View>
                          </View>
                          <View style={s.invRight}>
                            <Text style={s.invAmt}>{inv.amount}</Text>
                            <View style={s.tallyIcon}>
                              <Ionicons name="return-down-back-outline" size={13} color={AMBER} />
                            </View>
                          </View>
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

  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginTop: SPACING.md, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: SPACING.md, marginTop: SPACING.md, gap: 10 },
  statCell:  { width: (SW - SPACING.md * 2 - 10) / 2, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  statValue: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 4 },

  // Month sections
  monthSection: { marginHorizontal: SPACING.md, marginTop: SPACING.md },
  monthHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  monthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  monthLabel:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  monthCount:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  listCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  invRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 10 },
  invRowSelected: { backgroundColor: COLORS.brandPrimary + '08' },
  invLeft:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  statusDot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  invInfo:    { flex: 1, gap: 3 },
  invTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statusPillBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full, borderWidth: 1,
  },
  statusPillTxt: { fontSize: 10, fontWeight: '700' },
  invId:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  invParty:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  invMeta:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  invRight:   { alignItems: 'flex-end', gap: 8 },
  invAmt:     { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  tallyIcon:  { width: 28, height: 28, borderRadius: 14, backgroundColor: AMBER_BG, alignItems: 'center', justifyContent: 'center' },
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
