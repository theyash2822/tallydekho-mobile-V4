import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, StyleSheet, TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getStocks, getWarehouses } from '../../src/services/api';
import { AddItemModal } from '../../src/components/forms/AddItemModal';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { EditStockModal } from '../../src/components/forms/EditStockModal';
import { StockTransferModal } from '../../src/components/forms/StockTransferModal';
import { StockAdjustmentModal } from '../../src/components/forms/StockAdjustmentModal';
import { BulkTransferModal } from '../../src/components/forms/BulkTransferModal';
import FilterBottomSheet, { FilterChipGroup } from '../../src/components/FilterBottomSheet';
import { StockItem } from '../../src/data/stockData';
import { useSettings } from '../../src/context/SettingsContext';

import { getStockListCache, clearStockListCache } from '../../src/utils/stockCache';
export { clearStockListCache };

// ─── SWIPEABLE STOCK CARD ─────────────────────────────────────────────────────

const sw = StyleSheet.create({
  actionWrap: { width: 88, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, overflow: 'hidden' },
  transferBg: { backgroundColor: COLORS.brandPrimary },
  adjustBg:   { backgroundColor: '#A89060' },
  editBg:     { backgroundColor: '#A89060' },
  actionInner:{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 5 },
  actionTxt:  { fontSize: 11, fontWeight: '700', color: COLORS.white },
});
const sc = StyleSheet.create({
  card:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardSelected:  { borderColor: '#1A1A1A', borderWidth: 1.5, backgroundColor: '#F0EFE9' },
  icon:          { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8E7E1' },
  checkbox:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  checkboxActive:{ backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  info:          { flex: 1 },
  name:          { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  sku:           { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  right:         { alignItems: 'flex-end', gap: 4 },
  value:         { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  qtyBadge:      { backgroundColor: COLORS.pageBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  qtyTxt:        { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
});

function SwipeableStockCard({ item, isMultiSelectMode, isSelected, onPress, onLongPress, onEditStock, onTransfer, onAdjust }: {
  item: StockItem; isMultiSelectMode: boolean; isSelected: boolean;
  onPress: () => void; onLongPress: () => void; onEditStock: () => void; onTransfer: () => void; onAdjust: () => void;
}) {
  const swipeRef = useRef<any>(null);
  const renderLeftActions = () => {
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {/* Transfer */}
        <View style={[sw.actionWrap, sw.transferBg]}>
          <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onTransfer(); }} activeOpacity={0.85}>
            <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.white} />
            <Text style={sw.actionTxt}>Transfer</Text>
          </TouchableOpacity>
        </View>
        {/* Adjust */}
        <View style={[sw.actionWrap, sw.adjustBg]}>
          <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onAdjust(); }} activeOpacity={0.85}>
            <Ionicons name="options-outline" size={22} color={COLORS.white} />
            <Text style={sw.actionTxt}>Adjust</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  const renderRightActions = () => {
    return (
      <View style={[sw.actionWrap, sw.editBg]}>
        <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onEditStock(); }} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Edit Stock</Text>
        </TouchableOpacity>
      </View>
    );
  };
  const cardInner = (
    <TouchableOpacity style={[sc.card, isSelected && sc.cardSelected]} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85} delayLongPress={380}>
      {isMultiSelectMode ? (
        <View style={[sc.checkbox, isSelected && sc.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
        </View>
      ) : null}
      <View style={sc.icon}><Ionicons name="cube-outline" size={20} color={COLORS.textPrimary} /></View>
      <View style={sc.info}>
        <Text style={sc.name} numberOfLines={1}>{item.name}</Text>
        <Text style={sc.sku}>{item.sku} · {item.category}</Text>
      </View>
      <View style={sc.right}>
        <Text style={sc.value}>{item.value}</Text>
        <View style={sc.qtyBadge}><Text style={sc.qtyTxt}>{item.qty} units</Text></View>
      </View>
      {!isMultiSelectMode && <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  );
  if (isMultiSelectMode) return cardInner;
  return (
    <ReanimatedSwipeable ref={swipeRef} renderLeftActions={renderLeftActions} renderRightActions={renderRightActions} friction={2} leftThreshold={88} rightThreshold={40} overshootLeft={false} overshootRight={false}>
      {cardInner}
    </ReanimatedSwipeable>
  );
}

// ─── FILTER MODAL (uses shared FilterBottomSheet + FilterChipGroup) ──────────

function FilterModal({ visible, onClose, onApply, initWh, initGrp, whOptions, grpOptions }: {
  visible: boolean; onClose: () => void;
  onApply: (wh: string[], grp: string[]) => void;
  initWh: string[]; initGrp: string[];
  whOptions: { id: string; label: string }[];
  grpOptions: { id: string; label: string }[];
}) {
  const [selWh,  setSelWh]  = useState<string[]>(initWh);
  const [selGrp, setSelGrp] = useState<string[]>(initGrp);
  // Sync state when modal opens
  useEffect(() => { if (visible) { setSelWh(initWh); setSelGrp(initGrp); } }, [visible]);
  const total = selWh.length + selGrp.length;

  const handleApply = () => {
    onApply(selWh, selGrp);
    onClose();
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Items"
      activeCount={total}
      onClear={() => { setSelWh([]); setSelGrp([]); }}
      onApply={handleApply}
      applyLabel={total > 0 ? `Apply (${total} active)` : 'Apply'}
    >
      {whOptions.length > 0 && (
        <FilterChipGroup
          label="Warehouse"
          options={whOptions}
          selected={selWh}
          multi
          onSelect={setSelWh}
        />
      )}
      {grpOptions.length > 0 && (
        <FilterChipGroup
          label="Item Group"
          options={grpOptions}
          selected={selGrp}
          multi
          onSelect={setSelGrp}
        />
      )}
      {whOptions.length === 0 && grpOptions.length === 0 && (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>No filter options available. Sync Tally first.</Text>
        </View>
      )}
      <View style={{ height: 16 }} />
    </FilterBottomSheet>
  );
}

// ─── (AddItemModal → src/components/forms/AddItemModal.tsx) ─────────────────

// ─── (EditStockModal, StockTransferModal, BulkTransferModal → src/components/forms/) ─

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function TotalStockScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const { company, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;

  // ─ Pre-filter params from warehouse-detail navigation (must be before any useEffect that uses them) ─
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const params = useLocalSearchParams<{ whId?: string; warehouse?: string; onhand?: string }>();
  const preWarehouse = params.warehouse ? decodeURIComponent(params.warehouse) : null;
  const preOnhand   = params.onhand === 'true';

  const [liveStocks, setLiveStocks] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─ Real filter options from API ─────────────────────────────────────
  const [whOptions, setWhOptions] = useState<{ id: string; label: string }[]>([]);
  const [catOptions, setCatOptions] = useState<{ id: string; label: string }[]>([]); // built but not shown in modal yet
  const [grpOptions, setGrpOptions] = useState<{ id: string; label: string }[]>([]);

  // Fetch real filter options once stocks are loaded
  useEffect(() => {
    if (!companyGuid || !liveStocks.length) return;
    // Warehouses from API
    // Warehouses from API — only show warehouses with actual stock (skus > 0)
    // This prevents empty results when user selects a warehouse with no stock transactions
    getWarehouses(companyGuid).then((res: any) => {
      const wh = (res?.data ?? [])
        .filter((w: any) => w.skus > 0)  // only warehouses that have stock transactions
        .map((w: any) => ({ id: w.name, label: w.name }))
        .filter((w: any) => w.id);
      setWhOptions(wh);
    }).catch(() => {});
    // Groups: trim whitespace to prevent mismatch with Tally-stored values
    const cats = [...new Set(liveStocks.map(s => s.category?.trim()).filter(Boolean))];
    const grps = [...new Set(liveStocks.map(s => s.group?.trim()).filter(Boolean))];
    setCatOptions(cats.map(c => ({ id: c, label: c })));
    setGrpOptions(grps.map(g => ({ id: g, label: g })));
  }, [companyGuid, liveStocks.length]);

  // If navigated from warehouse-detail with pre-filter, auto-apply warehouse filter on mount
  useEffect(() => {
    if (!preWarehouse || !companyGuid) return;
    setWhFilterLoading(true);
    getStocks(companyGuid, { limit: '1000', warehouse: preWarehouse }).then((res: any) => {
      const items = res?.data?.items ?? [];
      const mapped: StockItem[] = items.map((r: any) => ({
        id: r.guid || String(r.id), name: r.displayName || r.name || '', sku: r.sku || r.alias || r.hsn || '',
        category: r.category || '', group: r.group_name || '',
        qty: +(r.closing_qty || 0),
        value: r.closing_value ? formatAmount(Math.round(+r.closing_value)) : formatAmount(0),
        unit: r.unit || 'pcs', warehouse: r.primary_warehouse || r.warehouse_name || 'Default',
        warehouseId: r.primary_warehouse || r.warehouse_name || 'WH01', reorderLevel: +(r.reorder_level || 0),
        status: +r.closing_qty <= 0 ? 'out_of_stock' : +r.closing_qty <= +(r.reorder_level||0) ? 'low_stock' : 'in_stock',
      }));
      setWhFilteredStocks(mapped);
    }).catch(() => {}).finally(() => setWhFilterLoading(false));
  }, [preWarehouse, companyGuid]);

  useEffect(() => {
    if (!companyGuid) return;

    // ── Module-level cache: 5-min TTL, invalidated on every Tally sync ──
    const cacheKey = `${companyGuid}:${lastSyncAt}`;
    const _stockCache = getStockListCache();
    const cached = _stockCache[cacheKey];
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      setLiveStocks(cached.data);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    getStocks(companyGuid, { limit: '1000' }).then((res: any) => {
      const items = res?.data?.items ?? [];
      const mapped: StockItem[] = items.map((r: any) => ({
        id: r.guid || String(r.id),
        name: r.displayName || r.name || '',
        sku: r.sku || r.alias || r.hsn || '',
        category: r.category || '',
        group: r.group_name || '',
        qty: +(r.closing_qty || 0),
        value: r.closing_value ? formatAmount(Math.round(+r.closing_value)) : formatAmount(0),
        unit: r.unit || 'pcs',
        warehouse: r.primary_warehouse || r.warehouse_name || 'Default',
        warehouseId: r.primary_warehouse || r.warehouse_name || 'WH01',
        reorderLevel: +(r.reorder_level || 0),
        status: +r.closing_qty <= 0 ? 'out_of_stock' : +r.closing_qty <= +(r.reorder_level||0) ? 'low_stock' : 'in_stock',
      }));
      const _stockCache = getStockListCache();
      _stockCache[cacheKey] = { data: mapped, ts: Date.now() };
      if (mapped.length) setLiveStocks(mapped);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [companyGuid, lastSyncAt]);

  // Search & filters
  const [query,    setQuery]    = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selWh,  setSelWh]  = useState<string[]>(preWarehouse ? [preWarehouse] : []);
  const [selCat, setSelCat] = useState<string[]>([]);
  const [selGrp, setSelGrp] = useState<string[]>([]);
  // Warehouse-filtered stocks (re-fetched from backend when warehouse filter applied)
  const [whFilteredStocks, setWhFilteredStocks] = useState<StockItem[] | null>(null);
  const [whFilterLoading, setWhFilterLoading] = useState(false);
  const [onhandOnly, setOnhandOnly] = useState(preOnhand);

  // Use warehouse-filtered stocks if warehouse filter is active, else use all loaded stocks
  const sourceItems = whFilteredStocks ?? liveStocks;

  // Header "+" popover menu
  const [menuOpen, setMenuOpen] = useState(false);

  // Multi-select
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);

  // Modals
  const [addItemOpen,   setAddItemOpen]   = useState(false);
  const [editItem,      setEditItem]      = useState<StockItem | null>(null);
  const [transferItem,  setTransferItem]  = useState<StockItem | null>(null);
  const [adjustItem,    setAdjustItem]    = useState<StockItem | null>(null);
  const [bulkOpen,      setBulkOpen]      = useState(false);
  const [bulkPreItems,  setBulkPreItems]  = useState<StockItem[]>([]);

  // Sort state
  const [sortType, setSortType] = useState<'alpha' | 'amount'>('alpha');
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('asc');

  const handleSort = (type: 'alpha' | 'amount') => {
    if (sortType === type) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortType(type);
      setSortDir('asc');
    }
  };

  // Derived
  const filtered = sourceItems
    .filter(item => {
      const q = query.toLowerCase();
      const qMatch  = !query || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
      // Warehouse filter handled by API refetch (whFilteredStocks). whMatch always true.
      const whMatch    = true;
      const catMatch   = selCat.length === 0 || selCat.includes(item.category?.trim());
      const grpMatch   = selGrp.length === 0 || selGrp.includes(item.group?.trim());
      const onhandMatch = !onhandOnly || item.qty > 0;
      return qMatch && whMatch && catMatch && grpMatch && onhandMatch;
    })
    .sort((a, b) => {
      if (sortType === 'alpha') {
        return sortDir === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      // amount sort — parse numeric value from formatted string
      const aVal = +(a.value.replace(/[^0-9.]/g, '')) || 0;
      const bVal = +(b.value.replace(/[^0-9.]/g, '')) || 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  const totalQty          = sourceItems.reduce((s, i) => s + i.qty, 0);
  const totalValueRaw      = sourceItems.reduce((s, i) => s + (+(i.value?.replace(/[^0-9.]/g, '') || 0)), 0);
  const totalValueLabel    = totalValueRaw > 0 ? `₹${(totalValueRaw/100000).toFixed(1)}L` : '—';
  const activeFilterCount = selWh.length + selGrp.length; // warehouse now backed by API re-fetch
  const allSelected       = filtered.length > 0 && filtered.every(i => selectedIds.includes(i.id));

  // Handlers
  const handleLongPress = useCallback((id: string) => {
    setMultiSelectMode(true);
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleItemPress = useCallback((item: StockItem) => {
    if (multiSelectMode) {
      setSelectedIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
    } else {
      router.push(`/stocks/item-detail?id=${item.id}` as any);
    }
  }, [multiSelectMode, router]);

  const exitMultiSelect = useCallback(() => { setMultiSelectMode(false); setSelectedIds([]); }, []);

  const handleSharePDF = useCallback(() => {
    if (!selectedIds.length) { Toast.show({ type: 'error', text1: 'No Items', text2: 'Select items first.' }); return; }
    Toast.show({ type: 'success', text1: 'PDF Exported', text2: `${selectedIds.length} items exported as PDF.` });
    exitMultiSelect();
  }, [selectedIds.length, exitMultiSelect]);

  const openBulkFromMultiselect = useCallback(() => {
    if (!selectedIds.length) return;
    const items = sourceItems.filter(i => selectedIds.includes(i.id));
    setBulkPreItems(items); setBulkOpen(true);
  }, [selectedIds]);



  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Total Stock</Text>
        <View style={styles.headerRight}>
          {/* Filter / Sort icon */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.7}>
            <Ionicons name="funnel-outline" size={22} color={activeFilterCount > 0 ? '#A89060' : COLORS.textPrimary} />
            {activeFilterCount > 0 && <View style={styles.badge}><Text style={styles.badgeTxt}>{activeFilterCount}</Text></View>}
          </TouchableOpacity>
          {/* Plus icon → popover */}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(v => !v)} activeOpacity={0.7}>
            <Ionicons name="add" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Header "+" popover ── */}
      {menuOpen && (
        <TouchableOpacity style={[StyleSheet.absoluteFillObject, { zIndex: 98 }]} activeOpacity={1} onPress={() => setMenuOpen(false)} />
      )}
      {menuOpen && (
        <View style={styles.popover}>
          <TouchableOpacity style={styles.popoverItem} onPress={() => { setMenuOpen(false); setAddItemOpen(true); }} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.textPrimary} />
            <Text style={styles.popoverItemTxt}>Add New Item</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Multi-select bar ── */}
      {multiSelectMode && (
        <View style={styles.multiBar}>
          <TouchableOpacity onPress={exitMultiSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.multiCount}>{selectedIds.length} selected</Text>
          <View style={styles.multiActions}>
            <TouchableOpacity style={[styles.multiBtn, styles.multiBtnAmber]} onPress={handleSharePDF} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={15} color={COLORS.white} />
              <Text style={styles.multiBtnTxt}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.multiBtn, styles.multiBtnGray]} onPress={openBulkFromMultiselect} activeOpacity={0.8}>
              <Ionicons name="swap-horizontal-outline" size={15} color={COLORS.white} />
              <Text style={styles.multiBtnTxt}>Transfer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Active filter chips ── */}
      {activeFilterCount > 0 && !multiSelectMode && (
        <View style={styles.activeFiltersRow}>
          {selWh.map(w => (
            <TouchableOpacity key={w} style={styles.activeChip} onPress={() => { setSelWh(p => { const next = p.filter(x => x !== w); if (next.length === 0) setWhFilteredStocks(null); return next; }); }} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt} numberOfLines={1} ellipsizeMode="tail">{w}</Text>
              <Ionicons name="close-circle" size={12} color="#A89060" />
            </TouchableOpacity>
          ))}
          {selGrp.map(g => (
            <TouchableOpacity key={g} style={styles.activeChip} onPress={() => setSelGrp(p => p.filter(x => x !== g))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt} numberOfLines={1} ellipsizeMode="tail">{g}</Text>
              <Ionicons name="close-circle" size={12} color="#A89060" />
            </TouchableOpacity>
          ))}
          {activeFilterCount > 1 && (
            <TouchableOpacity
              style={[styles.activeChip, { backgroundColor: '#FFF0F0', borderColor: '#FFCCCC' }]}
              onPress={() => { setSelWh([]); setSelCat([]); setSelGrp([]); setWhFilteredStocks(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.activeChipTxt, { color: COLORS.negative }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Warehouse filter loading indicator ── */}
      {whFilterLoading && (
        <View style={{ paddingVertical: 6, alignItems: 'center', backgroundColor: COLORS.cardBg }}>
          <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary }}>Filtering by warehouse…</Text>
        </View>
      )}

      {/* ── Summary KPI strip ── */}
      <View style={styles.summaryRow}>
        {[
          { label: 'No. of SKUs', value: `${sourceItems.length}` },
          { label: 'Total Qty',   value: totalQty.toLocaleString('en-IN') },
          { label: 'Value (INR)', value: totalValueLabel },
        ].map((s, i) => (
          <View key={i} style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput style={styles.searchInput} placeholder="Search items..." placeholderTextColor={COLORS.textTertiary} value={query} onChangeText={setQuery} />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Item list ── */}
      <FlatList
        data={isLoading ? [] : filtered}
        keyExtractor={item => item.id}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
            {multiSelectMode ? (
              <TouchableOpacity onPress={() => setSelectedIds(allSelected ? [] : filtered.map(i => i.id))} activeOpacity={0.7}>
                <Text style={styles.selectAllTxt}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sortBtns}>
                <TouchableOpacity
                  style={[styles.sortBtn, sortType === 'alpha' && styles.sortBtnActive]}
                  onPress={() => handleSort('alpha')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sortBtnLabel, sortType === 'alpha' && styles.sortBtnLabelActive]}>
                    {sortType === 'alpha' && sortDir === 'desc' ? 'Z–A' : 'A–Z'}
                  </Text>
                  <Ionicons
                    name={sortType === 'alpha' && sortDir === 'desc' ? 'arrow-up' : 'arrow-down'}
                    size={11}
                    color={sortType === 'alpha' ? COLORS.brandPrimary : COLORS.textTertiary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortBtn, sortType === 'amount' && styles.sortBtnActive]}
                  onPress={() => handleSort('amount')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sortBtnLabel, sortType === 'amount' && styles.sortBtnLabelActive]}>₹</Text>
                  <Ionicons
                    name={sortType === 'amount' && sortDir === 'desc' ? 'arrow-down' : 'arrow-up'}
                    size={11}
                    color={sortType === 'amount' ? COLORS.brandPrimary : COLORS.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={isLoading ? (
          <>
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
            <LedgerRowSkeleton />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={40} color={COLORS.textTertiary} />
            <Text style={styles.emptyTxt}>No items match your filters</Text>
            <TouchableOpacity onPress={() => { setSelWh([]); setSelCat([]); setSelGrp([]); setWhFilteredStocks(null); setQuery(''); }} activeOpacity={0.7}>
              <Text style={styles.emptyAction}>Clear all filters</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={() => <View style={{ height: 60 }} />}
        renderItem={({ item }) => (
          <SwipeableStockCard
            item={item}
            isMultiSelectMode={multiSelectMode}
            isSelected={selectedIds.includes(item.id)}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleLongPress(item.id)}
            onEditStock={() => setEditItem(item)}
            onTransfer={() => setTransferItem(item)}
            onAdjust={() => setAdjustItem(item)}
          />
        )}
      />

      {/* ── Modals ── */}
      <FilterModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={(wh, grp) => {
          setSelWh(wh);
          setSelGrp(grp);
          // If warehouse selected — re-fetch stocks from backend with ?warehouse= param
          if (wh.length > 0 && companyGuid) {
            setWhFilterLoading(true);
            getStocks(companyGuid, { limit: '1000', warehouse: wh[0] }).then((res: any) => {
              const items = res?.data?.items ?? [];
              const mapped: StockItem[] = items.map((r: any) => ({
                id: r.guid || String(r.id),
                name: r.displayName || r.name || '',
                sku: r.sku || r.alias || r.hsn || '',
                category: r.category || '',
                group: r.group_name || '',
                qty: +(r.closing_qty || 0),
                value: r.closing_value ? formatAmount(Math.round(+r.closing_value)) : formatAmount(0),
                unit: r.unit || 'pcs',
                warehouse: r.primary_warehouse || r.warehouse_name || 'Default',
                warehouseId: r.primary_warehouse || r.warehouse_name || 'WH01',
                reorderLevel: +(r.reorder_level || 0),
                status: +r.closing_qty <= 0 ? 'out_of_stock' : +r.closing_qty <= +(r.reorder_level||0) ? 'low_stock' : 'in_stock',
              }));
              setWhFilteredStocks(mapped);
            }).catch(() => setWhFilteredStocks([])).finally(() => setWhFilterLoading(false));
          } else {
            // Warehouse filter cleared — revert to all stocks
            setWhFilteredStocks(null);
          }
        }}
        initWh={selWh} initGrp={selGrp}
        whOptions={whOptions} grpOptions={grpOptions}
      />
      <AddItemModal visible={addItemOpen} onClose={() => setAddItemOpen(false)} />
      <EditStockModal visible={!!editItem} item={editItem} onClose={() => setEditItem(null)} />
      <StockTransferModal visible={!!transferItem} item={transferItem} onClose={() => setTransferItem(null)} />
      <StockAdjustmentModal visible={!!adjustItem} item={adjustItem} onClose={() => setAdjustItem(null)} />
      <BulkTransferModal visible={bulkOpen} preselectedItems={bulkPreItems} onClose={() => { setBulkOpen(false); exitMultiSelect(); }} />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  headerRight: { width: 80, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  iconBtn:     { position: 'relative', padding: 8 },
  badge:       { position: 'absolute', top: 4, right: 4, width: 15, height: 15, borderRadius: 8, backgroundColor: '#A89060', alignItems: 'center', justifyContent: 'center' },
  badgeTxt:    { fontSize: 8, fontWeight: '800', color: COLORS.white },

  // Popover
  popover:        { position: 'absolute', top: 58, right: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 10, zIndex: 99, minWidth: 200, overflow: 'hidden' },
  popoverItem:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  popoverItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  popoverDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },

  // Multi-select bar
  multiBar:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: '#1A1A1A' },
  multiCount:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  multiActions: { flexDirection: 'row', gap: 8 },
  multiBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  multiBtnAmber:{ backgroundColor: '#A89060' },
  multiBtnGray: { backgroundColor: '#444444' },
  multiBtnTxt:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },

  // Active filter chips
  activeFiltersRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 6, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  activeChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FBF7EE', borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#F0E8D5', maxWidth: 110, alignSelf: 'flex-start' },

  activeChipTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060', flexShrink: 1 },

  // Summary KPI
  summaryRow:   { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingVertical: 12 },
  summaryItem:  { flex: 1, alignItems: 'center' },
  summaryVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  summaryLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: SPACING.md, marginTop: 12, marginBottom: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  // List
  scroll:       { flex: 1 },
  content:      { padding: SPACING.md, gap: 8 },
  listHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary },
  selectAllTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#A89060' },
  swipeHint:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swipeHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  sortBtns:         { flexDirection: 'row', gap: 4 },
  sortBtn:          { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 7, borderRadius: RADIUS.sm, backgroundColor: COLORS.pageBg, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  sortBtnActive:    { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary + '12' },
  sortBtnLabel:     { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary },
  sortBtnLabelActive: { color: COLORS.brandPrimary },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textTertiary },
  emptyAction:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#A89060', textDecorationLine: 'underline' },
});
