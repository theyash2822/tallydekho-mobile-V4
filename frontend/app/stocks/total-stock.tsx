import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getStocks } from '../../src/services/api';
import { AddItemModal } from '../../src/components/forms/AddItemModal';
import { EditStockModal } from '../../src/components/forms/EditStockModal';
import { StockTransferModal } from '../../src/components/forms/StockTransferModal';
import { BulkTransferModal } from '../../src/components/forms/BulkTransferModal';
import FilterBottomSheet, { FilterChipGroup } from '../../src/components/FilterBottomSheet';
import { StockItem, ALL_WAREHOUSES, ALL_CATEGORIES, ALL_GROUPS } from '../../src/data/stockData';
import { useSettings } from '../../src/context/SettingsContext';

// ─── (Types, mock data, and constants are now in src/data/stockData.ts) ────────

// ─── SWIPEABLE STOCK CARD ─────────────────────────────────────────────────────

const sw = StyleSheet.create({
  actionWrap: { width: 88, justifyContent: 'center', alignItems: 'center', borderRadius: RADIUS.md, overflow: 'hidden' },
  transferBg: { backgroundColor: COLORS.brandPrimary },
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

function SwipeableStockCard({ item, isMultiSelectMode, isSelected, onPress, onLongPress, onEditStock, onTransfer }: {
  item: StockItem; isMultiSelectMode: boolean; isSelected: boolean;
  onPress: () => void; onLongPress: () => void; onEditStock: () => void; onTransfer: () => void;
}) {
  const swipeRef = useRef<any>(null);
  const renderLeftActions = (_: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.85, 1], extrapolate: 'clamp' });
    return (
      <Animated.View style={[sw.actionWrap, sw.transferBg, { transform: [{ scale }] }]}>
        <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onTransfer(); }} activeOpacity={0.85}>
          <Ionicons name="swap-horizontal-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Transfer</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  const renderRightActions = (_: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.85], extrapolate: 'clamp' });
    return (
      <Animated.View style={[sw.actionWrap, sw.editBg, { transform: [{ scale }] }]}>
        <TouchableOpacity style={sw.actionInner} onPress={() => { swipeRef.current?.close(); onEditStock(); }} activeOpacity={0.85}>
          <Ionicons name="create-outline" size={22} color={COLORS.white} />
          <Text style={sw.actionTxt}>Edit Stock</Text>
        </TouchableOpacity>
      </Animated.View>
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
    <Swipeable ref={swipeRef} renderLeftActions={renderLeftActions} renderRightActions={renderRightActions} friction={2} leftThreshold={40} rightThreshold={40} overshootLeft={false} overshootRight={false}>
      {cardInner}
    </Swipeable>
  );
}

// ─── FILTER MODAL (uses shared FilterBottomSheet + FilterChipGroup) ──────────

function FilterModal({ visible, onClose, onApply, initWh, initCat, initGrp }: {
  visible: boolean; onClose: () => void;
  onApply: (wh: string[], cat: string[], grp: string[]) => void;
  initWh: string[]; initCat: string[]; initGrp: string[];
}) {
  const [selWh, setSelWh]   = useState<string[]>(initWh);
  const [selCat, setSelCat] = useState<string[]>(initCat);
  const [selGrp, setSelGrp] = useState<string[]>(initGrp);
  useEffect(() => { if (visible) { setSelWh(initWh); setSelCat(initCat); setSelGrp(initGrp); } }, [visible]);
  const total = selWh.length + selCat.length + selGrp.length;

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Items"
      activeCount={total}
      onClear={() => { setSelWh([]); setSelCat([]); setSelGrp([]); }}
      onApply={() => onApply(selWh, selCat, selGrp)}
      applyLabel="Apply Filters"
    >
      <FilterChipGroup
        label="Warehouse"
        options={ALL_WAREHOUSES}
        selected={selWh}
        multi
        onSelect={setSelWh}
      />
      <FilterChipGroup
        label="Category"
        options={ALL_CATEGORIES.map(c => ({ id: c, label: c }))}
        selected={selCat}
        multi
        onSelect={setSelCat}
      />
      <FilterChipGroup
        label="Item Group"
        options={ALL_GROUPS.map(g => ({ id: g, label: g }))}
        selected={selGrp}
        multi
        onSelect={setSelGrp}
      />
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
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [liveStocks, setLiveStocks] = useState<StockItem[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    getStocks(companyGuid, { limit: '1000' }).then((res: any) => {
      const items = res?.data?.items ?? [];
      if (items.length) setLiveStocks(items.map((r: any) => ({
        id: r.guid || String(r.id),
        name: r.name || '',
        sku: r.hsn || '',
        category: r.category || '',
        group: r.group_name || '',
        qty: +(r.closing_qty || 0),
        value: r.closing_value ? formatAmount(Math.round(+r.closing_value)) : formatAmount(0),
        unit: r.unit || 'pcs',
        warehouse: r.warehouse_name || 'Default',
        warehouseId: r.warehouse_name || 'WH01',
        reorderLevel: +(r.reorder_level || 0),
        status: +r.closing_qty <= 0 ? 'out_of_stock' : +r.closing_qty <= +(r.reorder_level||0) ? 'low_stock' : 'in_stock',
      })));
    }).catch(() => {});
  }, [companyGuid]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const params = useLocalSearchParams<{ whId?: string }>();

  // Search & filters
  const [query,    setQuery]    = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selWh,  setSelWh]  = useState<string[]>([]);
  const [selCat, setSelCat] = useState<string[]>([]);
  const [selGrp, setSelGrp] = useState<string[]>([]);

  const sourceItems = liveStocks;

  // Header "+" popover menu
  const [menuOpen, setMenuOpen] = useState(false);

  // Multi-select
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds,     setSelectedIds]     = useState<string[]>([]);

  // Modals
  const [addItemOpen,   setAddItemOpen]   = useState(false);
  const [editItem,      setEditItem]      = useState<StockItem | null>(null);
  const [transferItem,  setTransferItem]  = useState<StockItem | null>(null);
  const [bulkOpen,      setBulkOpen]      = useState(false);
  const [bulkPreItems,  setBulkPreItems]  = useState<StockItem[]>([]);

  // Derived
  const filtered = sourceItems.filter(item => {
    const q = query.toLowerCase();
    const qMatch  = !query || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    const whMatch  = selWh.length  === 0 || selWh.includes(item.warehouse);
    const catMatch = selCat.length === 0 || selCat.includes(item.category);
    const grpMatch = selGrp.length === 0 || selGrp.includes(item.group);
    return qMatch && whMatch && catMatch && grpMatch;
  });

  const totalQty          = sourceItems.reduce((s, i) => s + i.qty, 0);
  const activeFilterCount = selWh.length + selCat.length + selGrp.length;
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

  const openBulkFromMenu = useCallback(() => {
    setMenuOpen(false); setBulkPreItems([]); setBulkOpen(true);
  }, []);

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
          <View style={styles.popoverDivider} />
          <TouchableOpacity style={styles.popoverItem} onPress={openBulkFromMenu} activeOpacity={0.8}>
            <Ionicons name="swap-vertical-outline" size={18} color={COLORS.textPrimary} />
            <Text style={styles.popoverItemTxt}>Bulk Transfer</Text>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersRow}>
          {selWh.map(w => { const f = ALL_WAREHOUSES.find(x => x.id === w); return (
            <TouchableOpacity key={w} style={styles.activeChip} onPress={() => setSelWh(p => p.filter(x => x !== w))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{f?.label.split(' – ')[0] ?? w}</Text>
              <Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ); })}
          {selCat.map(c => (
            <TouchableOpacity key={c} style={styles.activeChip} onPress={() => setSelCat(p => p.filter(x => x !== c))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{c}</Text><Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ))}
          {selGrp.map(g => (
            <TouchableOpacity key={g} style={styles.activeChip} onPress={() => setSelGrp(p => p.filter(x => x !== g))} activeOpacity={0.7}>
              <Text style={styles.activeChipTxt}>{g}</Text><Ionicons name="close" size={11} color="#A89060" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Summary KPI strip ── */}
      <View style={styles.summaryRow}>
        {[
          { label: 'No. of SKUs', value: `${sourceItems.length}` },
          { label: 'Total Qty',   value: totalQty.toLocaleString('en-IN') },
          { label: 'Value (INR)', value: '₹83,150' },
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
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionLabel}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</Text>
          {multiSelectMode ? (
            <TouchableOpacity onPress={() => setSelectedIds(allSelected ? [] : filtered.map(i => i.id))} activeOpacity={0.7}>
              <Text style={styles.selectAllTxt}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.swipeHint}>
              <Ionicons name="swap-horizontal-outline" size={12} color={COLORS.textTertiary} />
              <Text style={styles.swipeHintTxt}>Swipe for actions</Text>
            </View>
          )}
        </View>

        {filtered.map(item => (
          <SwipeableStockCard
            key={item.id} item={item}
            isMultiSelectMode={multiSelectMode}
            isSelected={selectedIds.includes(item.id)}
            onPress={() => handleItemPress(item)}
            onLongPress={() => handleLongPress(item.id)}
            onEditStock={() => setEditItem(item)}
            onTransfer={() => setTransferItem(item)}
          />
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={40} color={COLORS.textTertiary} />
            <Text style={styles.emptyTxt}>No items match your filters</Text>
            <TouchableOpacity onPress={() => { setSelWh([]); setSelCat([]); setSelGrp([]); setQuery(''); }} activeOpacity={0.7}>
              <Text style={styles.emptyAction}>Clear all filters</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Modals ── */}
      <FilterModal visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={(wh, cat, grp) => { setSelWh(wh); setSelCat(cat); setSelGrp(grp); }} initWh={selWh} initCat={selCat} initGrp={selGrp} />
      <AddItemModal visible={addItemOpen} onClose={() => setAddItemOpen(false)} />
      <EditStockModal visible={!!editItem} item={editItem} onClose={() => setEditItem(null)} />
      <StockTransferModal visible={!!transferItem} item={transferItem} onClose={() => setTransferItem(null)} />
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
  activeFiltersRow: { paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  activeChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FBF7EE', borderRadius: RADIUS.full, borderWidth: 1, borderColor: '#F0E8D5' },
  activeChipTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060' },

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

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textTertiary },
  emptyAction:{ fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#A89060', textDecorationLine: 'underline' },
});
