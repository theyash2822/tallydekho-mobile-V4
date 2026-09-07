import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getExpirySchedule } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import FilterBottomSheet, {
  FilterCheckRow,
  filterSheetContentStyles as fm,
  isFilterAllSelected,
  isFilterOptionChecked,
  toggleFilterFromAll,
  toggleFilterAll,
  useMultiFilterHydration,
  isFilterSelectionValid,
  normalizeFilterAllSelection,
} from '../../src/components/FilterBottomSheet';
import { FilterIconWithBadge, ActiveFilterChips } from '../../src/components/voucherHomeFilters';
import { useTranslation } from 'react-i18next';
import { shareStockRegisterPdf, companyFromAuth } from '../../src/utils/multiShare';

// ── Types ────────────────────────────────────────────────────────────────────
type DayTab = '0-30' | '31-60' | '>60' | 'expired';

interface ExpiryItem {
  id: string; item: string; code: string; batch: string;
  expiryDate: string; qty: number; value: string;
  daysLeft: number | null; warehouse: string; groupName: string; tab: DayTab;
}

const DAY_TABS: { key: DayTab; label: string }[] = [
  { key: '0-30',    label: '0-30 Day'  },
  { key: '31-60',   label: '31-60 Day' },
  { key: '>60',     label: '>60 Day'   },
  { key: 'expired', label: 'Expired'   },
];

// ── Filter modal (Warehouse | Item Group — Ledger-style R2 multi-select) ─────

function ExpiryFilterModal({ visible, onClose, onApply, initWh, initGrp, whOptions, grpOptions }: {
  visible: boolean; onClose: () => void;
  onApply: (wh: string[], grp: string[]) => void;
  initWh: string[]; initGrp: string[];
  whOptions: { id: string; label: string }[];
  grpOptions: { id: string; label: string }[];
}) {
  const [tab, setTab] = useState<'Warehouse' | 'Group'>('Warehouse');
  const [selWh, setSelWh] = useState<string[]>([]);
  const [selGrp, setSelGrp] = useState<string[]>([]);
  const [whSearch, setWhSearch] = useState('');
  const [grpSearch, setGrpSearch] = useState('');

  const whIds = useMemo(() => whOptions.map(w => w.id), [whOptions]);
  const grpIds = useMemo(() => grpOptions.map(g => g.id), [grpOptions]);

  useMultiFilterHydration(visible, initWh, whIds, setSelWh);
  useMultiFilterHydration(visible, initGrp, grpIds, setSelGrp);

  useEffect(() => {
    if (visible) {
      setWhSearch('');
      setGrpSearch('');
      setTab('Warehouse');
    }
  }, [visible]);

  const isAllWh = isFilterAllSelected(selWh, whIds);
  const isAllGrp = isFilterAllSelected(selGrp, grpIds);
  const activeCount = (isAllWh ? 0 : selWh.length) + (isAllGrp ? 0 : selGrp.length);
  const canApply = isFilterSelectionValid(selWh, whIds) && isFilterSelectionValid(selGrp, grpIds);

  const filteredWh = useMemo(() => {
    const q = whSearch.trim().toLowerCase();
    const list = whOptions.filter(Boolean);
    if (!q) return list;
    return list.filter(w => w.label.toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
  }, [whOptions, whSearch]);

  const filteredGrp = useMemo(() => {
    const q = grpSearch.trim().toLowerCase();
    const list = grpOptions.filter(Boolean);
    if (!q) return list;
    return list.filter(g => g.label.toLowerCase().includes(q) || g.id.toLowerCase().includes(q));
  }, [grpOptions, grpSearch]);

  const handleApply = () => {
    if (!canApply) return;
    onApply(normalizeFilterAllSelection(selWh, whIds), normalizeFilterAllSelection(selGrp, grpIds));
    onClose();
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Expiry"
      activeCount={activeCount}
      onClear={() => { setSelWh([...whIds]); setSelGrp([...grpIds]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
      applyDisabled={!canApply}
      heightFraction={0.68}
    >
      <View style={fm.tabs}>
        {(['Warehouse', 'Group'] as const).map(cat => (
          <TouchableOpacity key={cat} style={[fm.tab, tab === cat && fm.tabActive]} onPress={() => setTab(cat)} activeOpacity={0.7}>
            <Text style={[fm.tabTxt, tab === cat && fm.tabTxtActive]}>{cat === 'Group' ? 'Item Group' : cat}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'Warehouse' ? (
        <View style={fm.panel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput style={fm.searchInput} placeholder="Search warehouse..." placeholderTextColor={COLORS.textTertiary} value={whSearch} onChangeText={setWhSearch} />
          </View>
          <FilterCheckRow label="All warehouses" selected={isAllWh} onPress={() => setSelWh(prev => toggleFilterAll(prev, whIds))} />
          {filteredWh.length === 0 ? (
            <Text style={fm.hint}>No warehouses match your search</Text>
          ) : filteredWh.map(w => (
            <FilterCheckRow key={w.id} label={w.label} selected={isFilterOptionChecked(selWh, w.id)} onPress={() => setSelWh(prev => toggleFilterFromAll(prev, w.id, whIds))} />
          ))}
        </View>
      ) : (
        <View style={fm.panel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput style={fm.searchInput} placeholder="Search group..." placeholderTextColor={COLORS.textTertiary} value={grpSearch} onChangeText={setGrpSearch} />
          </View>
          <FilterCheckRow label="All groups" selected={isAllGrp} onPress={() => setSelGrp(prev => toggleFilterAll(prev, grpIds))} />
          {filteredGrp.length === 0 ? (
            <Text style={fm.hint}>No groups match your search</Text>
          ) : filteredGrp.map(g => (
            <FilterCheckRow key={g.id} label={g.label} selected={isFilterOptionChecked(selGrp, g.id)} onPress={() => setSelGrp(prev => toggleFilterFromAll(prev, g.id, grpIds))} />
          ))}
        </View>
      )}
    </FilterBottomSheet>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExpiryScheduleScreen() {
  const { t } = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const fyParam     = fyInfoToParam(selectedFY);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [items,      setItems]      = useState<ExpiryItem[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [groups,     setGroups]     = useState<string[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);

  const load = useCallback(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getExpirySchedule(companyGuid, fyParam ? { fy: fyParam } : {})
      .then((res: any) => {
        setItems(res?.data?.items ?? []);
        setWarehouses(res?.data?.warehouses ?? []);
        setGroups(res?.data?.groups ?? []);
      })
      .catch((e: any) => setApiError(e?.message ?? 'Failed to load expiry data'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY]);

  useEffect(() => { load(); }, [load]);

  // ── Tab & filter ──────────────────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState<DayTab>('0-30');
  const [selWh,        setSelWh]        = useState<string[]>([]);
  const [selGrp,       setSelGrp]       = useState<string[]>([]);
  const [showFilter,   setShowFilter]   = useState(false);

  const whOptions = useMemo(() => warehouses.map(w => ({ id: w, label: w })), [warehouses]);
  const grpOptions = useMemo(() => groups.map(g => ({ id: g, label: g })), [groups]);

  // ── Multi-select ──────────────────────────────────────────────────────────
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSharing,       setIsSharing]       = useState(false);

  const activeFilterCount = (selWh.length > 0 ? selWh.length : 0) + (selGrp.length > 0 ? selGrp.length : 0);

  // ── Filter items for current tab ──────────────────────────────────────────
  const visibleItems = useMemo(() =>
    items.filter(item => {
      if (item.tab !== activeTab) return false;
      if (selWh.length > 0 && !selWh.includes(item.warehouse)) return false;
      if (selGrp.length > 0 && !selGrp.includes(item.groupName)) return false;
      return true;
    }),
  [items, activeTab, selWh, selGrp]);
  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const handleItemPress = (id: string) => {
    if (!isSelectionMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cancelSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleShareSelected = async () => {
    const selected = items.filter(i => selectedIds.has(i.id));
    if (!selected.length || isSharing) return;
    setIsSharing(true);
    try {
      await shareStockRegisterPdf({
        company: companyFromAuth(company),
        title: 'Expiry Schedule',
        rows: selected.map(item => ({
          date: item.expiryDate,
          particulars: item.item,
          vchType: item.warehouse,
          vchNo: item.batch || item.code,
          inwardsQty: String(item.qty),
          outwardsQty: item.value,
        })),
      }, { onBeforeShare: () => setIsSharing(false) });
      cancelSelection();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not share PDF.');
    } finally {
      setIsSharing(false);
    }
  };

  const selectAll = () => {
    const allIds = new Set(visibleItems.map(i => i.id));
    setSelectedIds(allIds);
    setIsSelectionMode(true);
  };

  // ── Selection handlers ────────────────────────────────────────────────────

  const daysLeftColor = (item: ExpiryItem) => {
    if (item.tab === 'expired') return COLORS.negative;
    if (item.daysLeft === null) return COLORS.textSecondary;
    if (item.daysLeft <= 30)   return COLORS.negative;
    return COLORS.textPrimary;
  };

  const daysLeftText = (item: ExpiryItem) => {
    if (item.tab === 'expired') return 'Expired';
    if (item.daysLeft === null) return 'No Expiry';
    return `${item.daysLeft} Day`;
  };

  // ── Tab counts ────────────────────────────────────────────────────────────
  // Tab counts respect warehouse/group filters
  const filteredForCounts = useMemo(() =>
    items.filter(item => {
      if (selWh.length > 0 && !selWh.includes(item.warehouse)) return false;
      if (selGrp.length > 0 && !selGrp.includes(item.groupName)) return false;
      return true;
    }),
  [items, selWh, selGrp]);

  const tabCounts = useMemo(() => {
    const counts: Record<DayTab, number> = { '0-30': 0, '31-60': 0, '>60': 0, 'expired': 0 };
    for (const item of filteredForCounts) counts[item.tab] = (counts[item.tab] || 0) + 1;
    return counts;
  }, [filteredForCounts]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        title={t('stocks.expirySchedule')}
        onBack={() => router.back()}
        right={<FilterIconWithBadge count={activeFilterCount} onPress={() => setShowFilter(true)} />}
      />

      {/* Error */}
      {apiError && <ErrorBanner message={apiError} />}

      <ActiveFilterChips
        variant="amber"
        chips={[
          ...selWh.map(w => ({ id: `wh:${w}`, label: w })),
          ...selGrp.map(g => ({ id: `grp:${g}`, label: g })),
        ]}
        onRemove={(chipId) => {
          if (chipId.startsWith('wh:')) setSelWh(p => p.filter(x => x !== chipId.slice(3)));
          if (chipId.startsWith('grp:')) setSelGrp(p => p.filter(x => x !== chipId.slice(4)));
        }}
        onClearAll={() => { setSelWh([]); setSelGrp([]); }}
      />

      {/* Selection Mode Banner */}
      {isSelectionMode && (
        <View style={s.selBanner}>
          <TouchableOpacity onPress={cancelSelection} activeOpacity={0.7} style={s.selBannerBtn}>
            <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            <Text style={s.selBannerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.selBannerCount}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={selectAll} activeOpacity={0.7} style={s.selBannerBtn}>
            <Text style={s.selBannerAll}>All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Day Range Tabs */}
      <View style={s.tabRow}>
        {DAY_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => { setActiveTab(tab.key); cancelSelection(); }}
            activeOpacity={0.7}
          >
            <Text style={[s.tabTxt, activeTab === tab.key && s.tabTxtActive]}>{tab.label}</Text>
            {tabCounts[tab.key] > 0 && (
              <View style={[s.tabBadge, activeTab === tab.key && s.tabBadgeActive]}>
                <Text style={[s.tabBadgeTxt, activeTab === tab.key && s.tabBadgeTxtActive]}>
                  {tabCounts[tab.key]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Hint: Long press to select */}
      {!isSelectionMode && visibleItems.length > 0 && (
        <View style={s.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
          <Text style={s.hintTxt}>Long press to select items</Text>
        </View>
      )}

      {/* Items List */}
      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 12 }}>
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
          {visibleItems.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>
                {items.length === 0 ? 'No batch data available' : 'No items in this range'}
              </Text>
            </View>
          ) : (
            visibleItems.map(item => {
              const isSel = selectedIds.has(item.id);
              return (
                <View key={item.id}>
                  {/* Warehouse Label */}
                  <View style={s.warehouseHeader}>
                    <Ionicons name="home-outline" size={14} color={COLORS.textTertiary} />
                    <Text style={s.warehouseLabel}>{item.warehouse}</Text>
                  </View>

                  <EntityListTile
                    name={item.item}
                    subtitle={item.code || undefined}
                    selected={isSel}
                    borderRadius={RADIUS.lg}
                    onPress={() => handleItemPress(item.id)}
                    onLongPress={() => handleLongPress(item.id)}
                    delayLongPress={350}
                    style={{ marginBottom: 4 }}
                    trailing={(
                      <View style={[s.daysBadge, { backgroundColor: daysLeftColor(item) + '18' }]}>
                        <Text style={[s.daysBadgeTxt, { color: daysLeftColor(item) }]}>
                          {daysLeftText(item)}
                        </Text>
                      </View>
                    )}
                    footer={(
                      <>
                        <View style={s.divider} />
                        <View style={s.gridRow}>
                          <View style={s.gridItem}>
                            <Text style={s.gridLbl}>Batch/Lot</Text>
                            <Text style={s.gridVal}>{item.batch}</Text>
                          </View>
                          <View style={s.gridItem}>
                            <Text style={s.gridLbl}>Expiry Date</Text>
                            <Text style={s.gridVal}>{item.expiryDate}</Text>
                          </View>
                          <View style={s.gridItem}>
                            <Text style={s.gridLbl}>QTY</Text>
                            <Text style={s.gridVal}>{item.qty}</Text>
                          </View>
                          <View style={s.gridItem}>
                            <Text style={s.gridLbl}>Value</Text>
                            <Text style={s.gridVal}>{item.value}</Text>
                          </View>
                        </View>
                      </>
                    )}
                  />
                </View>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Share Bar */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}</Text>
          <TouchableOpacity
            style={[s.shareBtn, isSharing && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleShareSelected}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="share-social-outline" size={18} color="#fff" />
            }
            <Text style={s.shareTxt}>{isSharing ? 'Preparing…' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <ExpiryFilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        onApply={(wh, grp) => { setSelWh(wh); setSelGrp(grp); }}
        initWh={selWh}
        initGrp={selGrp}
        whOptions={whOptions}
        grpOptions={grpOptions}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 44, justifyContent: 'flex-end' },
  filterBadge:    { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingVertical: 7, backgroundColor: COLORS.pageBg },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  whFilterRow:  { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  whChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.textPrimary },
  whChipTxt:    { fontSize: TYPOGRAPHY.xs, color: '#fff', fontWeight: '600' },

  tabRow:        { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 6 },
  tab:           { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg, gap: 3 },
  tabActive:     { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  tabTxt:        { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive:  { color: '#fff' },
  tabBadge:      { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: COLORS.borderDefault },
  tabBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeTxt:   { fontSize: 9, fontWeight: '700', color: COLORS.textSecondary },
  tabBadgeTxtActive: { color: '#fff' },

  list: { padding: SPACING.md, gap: 4 },

  warehouseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 5 },
  warehouseLabel:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },

  itemCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: 4 },
  itemCardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },

  itemTop:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSel: { backgroundColor: '#A89060' },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  itemMeta:  { flex: 1 },
  itemName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  itemCode:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  daysBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  daysBadgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  divider:  { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  gridRow:  { flexDirection: 'row' },
  gridItem: { flex: 1, gap: 3, paddingHorizontal: 2 },
  gridLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  gridVal:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  shareBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:      { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:           { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:           { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  modalOverlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:         { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingHorizontal: SPACING.md },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 8 },
  modalTitle:         { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  filterSection:      { marginBottom: 20 },
  filterSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  chip:               { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.textPrimary },
  chipTxt:            { fontSize: TYPOGRAPHY.sm, color: '#fff', fontWeight: '600' },
  searchRow:          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  searchTxt:          { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },
  whList:             { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', marginTop: 8 },
  whRow:              { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  whRowTxt:           { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  checkbox:           { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  checkboxActive:     { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  optionList:         { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  optionRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  optionTxt:          { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, flex: 1 },
  optionTxtActive:    { color: COLORS.textPrimary, fontWeight: '700' },
  radio:              { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  radioActive:        { borderColor: COLORS.brandPrimary },
  radioInner:         { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brandPrimary },
  modalFooter:        { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelBtn:          { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.pageBg, alignItems: 'center' },
  cancelTxt:          { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  applyBtn:           { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.textPrimary, alignItems: 'center' },
  applyTxt:           { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
