import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Types ────────────────────────────────────────────────────────────────────
type DayTab = '0-30' | '31-60' | '>60' | 'expired';

interface ExpiryItem {
  id: string; item: string; code: string; batch: string;
  expiryDate: string; qty: number; value: string;
  daysLeft: number | null; warehouse: string; tab: DayTab;
}

// ── Mock Data (all 4 tabs) ────────────────────────────────────────────────────
const WAREHOUSES_LIST = ['WH-001 Echo Depot', 'WH-002 Sierra Storage', 'WH-003 Delta Hub', 'WH-004 Zulu Center', 'WH-005 North Terminal'];
const ITEM_GROUPS     = ['Electronics', 'Peripherals', 'Accessories', 'Audio & Video', 'Food & Beverage'];

const EXPIRY_ITEMS: ExpiryItem[] = [
  // ── 0-30 Day ───────────────────────────────────────────────────────────────
  { id: 'e01', item: 'Black JBL',        code: 'PRD-1002-ABC', batch: 'KL98-A12', expiryDate: '11/12/25', qty: 87,  value: '₹1,12,800', daysLeft: 3,   warehouse: 'Sierra Storage', tab: '0-30' },
  { id: 'e02', item: 'Red Headset',      code: 'PRD-1003-DEF', batch: 'KL98-A13', expiryDate: '13/12/25', qty: 45,  value: '₹67,500',   daysLeft: 7,   warehouse: 'Echo Depot',     tab: '0-30' },
  { id: 'e03', item: 'Blue Speaker',     code: 'PRD-1004-GHI', batch: 'KL98-A14', expiryDate: '18/12/25', qty: 110, value: '₹88,000',   daysLeft: 12,  warehouse: 'Sierra Storage', tab: '0-30' },
  { id: 'e04', item: 'Silver Earphones', code: 'PRD-1005-JKL', batch: 'KL98-A15', expiryDate: '20/12/25', qty: 200, value: '₹60,000',   daysLeft: 14,  warehouse: 'Delta Hub',      tab: '0-30' },
  { id: 'e05', item: 'Gold Mic Stand',   code: 'PRD-1006-MNO', batch: 'KL98-A16', expiryDate: '25/12/25', qty: 34,  value: '₹51,000',   daysLeft: 20,  warehouse: 'Echo Depot',     tab: '0-30' },
  { id: 'e06', item: 'White Earbuds',    code: 'PRD-1007-PQR', batch: 'KL98-A17', expiryDate: '30/12/25', qty: 75,  value: '₹1,12,500', daysLeft: 28,  warehouse: 'Sierra Storage', tab: '0-30' },

  // ── 31-60 Day ──────────────────────────────────────────────────────────────
  { id: 'e07', item: 'Purple AirPods',   code: 'PRD-1008-STU', batch: 'KL98-A18', expiryDate: '12/10/25', qty: 89,  value: '₹1,33,500', daysLeft: 31,  warehouse: 'Sierra Storage', tab: '31-60' },
  { id: 'e08', item: 'Orange Watch',     code: 'PRD-1009-VWX', batch: 'KL98-A19', expiryDate: '12/15/25', qty: 56,  value: '₹84,000',   daysLeft: 36,  warehouse: 'Echo Depot',     tab: '31-60' },
  { id: 'e09', item: 'Pink Camera',      code: 'PRD-1010-YZA', batch: 'KL98-A20', expiryDate: '12/20/25', qty: 78,  value: '₹1,17,000', daysLeft: 41,  warehouse: 'Sierra Storage', tab: '31-60' },
  { id: 'e10', item: 'Brown Keyboard',   code: 'PRD-1011-BCD', batch: 'KL98-A21', expiryDate: '12/25/25', qty: 42,  value: '₹63,000',   daysLeft: 46,  warehouse: 'Echo Depot',     tab: '31-60' },
  { id: 'e11', item: 'Cyan Tablet',      code: 'PRD-1012-EFG', batch: 'KL98-A22', expiryDate: '12/28/25', qty: 15,  value: '₹1,87,500', daysLeft: 52,  warehouse: 'Delta Hub',      tab: '31-60' },
  { id: 'e12', item: 'Black Router',     code: 'PRD-1013-HIJ', batch: 'KL98-A23', expiryDate: '01/05/26', qty: 60,  value: '₹90,000',   daysLeft: 57,  warehouse: 'Zulu Center',    tab: '31-60' },

  // ── >60 Day ────────────────────────────────────────────────────────────────
  { id: 'e13', item: 'Magenta Speaker',  code: 'PRD-1014-KLM', batch: 'KL98-A24', expiryDate: '01/10/26', qty: 63,  value: '₹94,500',   daysLeft: 62,  warehouse: 'Sierra Storage', tab: '>60' },
  { id: 'e14', item: 'Teal Headphones',  code: 'PRD-1015-NOP', batch: 'KL98-A25', expiryDate: '01/15/26', qty: 28,  value: '₹42,000',   daysLeft: 67,  warehouse: 'Echo Depot',     tab: '>60' },
  { id: 'e15', item: 'Lime Microphone',  code: 'PRD-1016-QRS', batch: 'KL98-A26', expiryDate: '01/20/26', qty: 37,  value: '₹55,500',   daysLeft: 72,  warehouse: 'Sierra Storage', tab: '>60' },
  { id: 'e16', item: 'Indigo Webcam',    code: 'PRD-1017-TUV', batch: 'KL98-A27', expiryDate: '02/01/26', qty: 50,  value: '₹75,000',   daysLeft: 84,  warehouse: 'Echo Depot',     tab: '>60' },
  { id: 'e17', item: 'Violet Drone',     code: 'PRD-1018-WXY', batch: 'KL98-A28', expiryDate: '02/15/26', qty: 8,   value: '₹2,40,000', daysLeft: 97,  warehouse: 'Delta Hub',      tab: '>60' },
  { id: 'e18', item: 'Amber Projector',  code: 'PRD-1019-ZAB', batch: 'KL98-A29', expiryDate: '03/01/26', qty: 12,  value: '₹1,80,000', daysLeft: 110, warehouse: 'Zulu Center',    tab: '>60' },

  // ── Expired ────────────────────────────────────────────────────────────────
  { id: 'e19', item: 'Expired Laptop',   code: 'PRD-1020-CDE', batch: 'KL98-A30', expiryDate: '10/15/25', qty: 12,  value: '₹18,000',   daysLeft: null, warehouse: 'Sierra Storage', tab: 'expired' },
  { id: 'e20', item: 'Expired Phone',    code: 'PRD-1021-FGH', batch: 'KL98-A31', expiryDate: '10/20/25', qty: 8,   value: '₹12,000',   daysLeft: null, warehouse: 'Echo Depot',     tab: 'expired' },
  { id: 'e21', item: 'Expired Diamond',  code: 'PRD-1037-BCD', batch: 'KL98-A47', expiryDate: '10/25/25', qty: 3,   value: '₹45,000',   daysLeft: null, warehouse: 'Central Hub',    tab: 'expired' },
  { id: 'e22', item: 'Expired Arctic',   code: 'PRD-1022-IJK', batch: 'KL98-A32', expiryDate: '10/30/25', qty: 25,  value: '₹37,500',   daysLeft: null, warehouse: 'North Terminal', tab: 'expired' },
  { id: 'e23', item: 'Expired Tablet',   code: 'PRD-1023-LMN', batch: 'KL98-A33', expiryDate: '11/05/25', qty: 6,   value: '₹54,000',   daysLeft: null, warehouse: 'Sierra Storage', tab: 'expired' },
  { id: 'e24', item: 'Expired Router',   code: 'PRD-1024-OPQ', batch: 'KL98-A34', expiryDate: '11/10/25', qty: 18,  value: '₹27,000',   daysLeft: null, warehouse: 'Echo Depot',     tab: 'expired' },
];

const DAY_TABS: { key: DayTab; label: string }[] = [
  { key: '0-30',    label: '0-30 Day'  },
  { key: '31-60',   label: '31-60 Day' },
  { key: '>60',     label: '>60 Day'   },
  { key: 'expired', label: 'Expired'   },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExpiryScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Tab & filter
  const [activeTab,      setActiveTab]      = useState<DayTab>('0-30');
  const [activeWHChips,  setActiveWHChips]  = useState<Set<string>>(new Set());
  const [showFilter,     setShowFilter]     = useState(false);
  const [draftWH,        setDraftWH]        = useState<Set<string>>(new Set());
  const [draftWHSearch,  setDraftWHSearch]  = useState('');
  const [draftItemGroup, setDraftItemGroup] = useState('');
  const [selItemGroup,   setSelItemGroup]   = useState('');

  // ── Multi-select ──────────────────────────────────────────────────────────
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const activeFilterCount = activeWHChips.size + (selItemGroup ? 1 : 0);

  // ── Filter handlers ───────────────────────────────────────────────────────
  const openFilter = () => {
    setDraftWH(new Set(activeWHChips));
    setDraftWHSearch('');
    setDraftItemGroup(selItemGroup);
    setShowFilter(true);
  };

  const applyFilters = () => {
    setActiveWHChips(new Set(draftWH));
    setSelItemGroup(draftItemGroup);
    setShowFilter(false);
  };

  // ── Selection handlers ────────────────────────────────────────────────────
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

  const selectAll = () => {
    const allIds = new Set(visibleItems.map(i => i.id));
    setSelectedIds(allIds);
    setIsSelectionMode(true);
  };

  // ── Filter items for current tab ──────────────────────────────────────────
  const visibleItems = useMemo(() =>
    EXPIRY_ITEMS.filter(item => {
      if (item.tab !== activeTab) return false;
      if (activeWHChips.size > 0 && ![...activeWHChips].some(w => item.warehouse.includes(w.replace(/^WH-\d+ /, '')))) return false;
      return true;
    }),
  [activeTab, activeWHChips]);

  const daysLeftColor = (item: ExpiryItem) => {
    if (item.tab === 'expired') return COLORS.negative;
    if (item.daysLeft === null) return COLORS.negative;
    if (item.daysLeft <= 30)   return COLORS.negative;
    return COLORS.textPrimary;
  };

  const daysLeftText = (item: ExpiryItem) => {
    if (item.tab === 'expired' || item.daysLeft === null) return 'Expired';
    return `${item.daysLeft} Day`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Expiry Schedule</Text>
        <TouchableOpacity style={s.headerBtn} onPress={openFilter} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={COLORS.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeTxt}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

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

      {/* Warehouse Filter chips row */}
      {!isSelectionMode && activeWHChips.size > 0 && (
        <View style={s.whFilterRow}>
          <View style={s.chipWrap}>
            {[...activeWHChips].map(w => (
              <TouchableOpacity
                key={w}
                style={s.whChip}
                onPress={() => setActiveWHChips(prev => { const n = new Set(prev); n.delete(w); return n; })}
                activeOpacity={0.7}
              >
                <Ionicons name="business-outline" size={12} color="#fff" />
                <Text style={s.whChipTxt}>{w.replace(/^WH-\d+ /, '')}</Text>
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            ))}
          </View>
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        {visibleItems.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.borderDefault} />
            <Text style={s.emptyTxt}>No items in this range</Text>
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

                {/* Item Card */}
                <TouchableOpacity
                  style={[s.itemCard, isSel && s.itemCardSel]}
                  onPress={() => handleItemPress(item.id)}
                  onLongPress={() => handleLongPress(item.id)}
                  delayLongPress={350}
                  activeOpacity={0.8}
                >
                  {/* Avatar — letter style matching ledger */}
                  <View style={s.itemTop}>
                    <View style={[s.avatar, isSel && s.avatarSel]}>
                      {isSel
                        ? <Ionicons name="checkmark" size={20} color="#fff" />
                        : <Text style={s.avatarTxt}>{item.item.charAt(0).toUpperCase()}</Text>
                      }
                    </View>
                    <View style={s.itemMeta}>
                      <Text style={s.itemName}>{item.item}</Text>
                      <Text style={s.itemCode}>{item.code}</Text>
                    </View>
                    {/* Days-left badge (top right) */}
                    <View style={[s.daysBadge, { backgroundColor: daysLeftColor(item) + '18' }]}>
                      <Text style={[s.daysBadgeTxt, { color: daysLeftColor(item) }]}>
                        {daysLeftText(item)}
                      </Text>
                    </View>
                  </View>

                  {/* Data Grid */}
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
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Share Bar (only visible when items are selected) ── */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Filter Modal (inlined — no sub-component) ── */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowFilter(false)} activeOpacity={1} />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Warehouse */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Warehouse</Text>
                {draftWH.size > 0 && (
                  <View style={s.chipWrap}>
                    {[...draftWH].map(w => (
                      <TouchableOpacity
                        key={w} style={s.chip}
                        onPress={() => setDraftWH(prev => { const n = new Set(prev); n.delete(w); return n; })}
                        activeOpacity={0.7}
                      >
                        <Text style={s.chipTxt}>{w}</Text>
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={[s.searchRow, { marginTop: draftWH.size > 0 ? 8 : 0 }]}>
                  <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                  <TextInput
                    style={s.searchTxt}
                    placeholder="Search warehouse..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftWHSearch}
                    onChangeText={setDraftWHSearch}
                  />
                  {draftWHSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setDraftWHSearch('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
                {draftWHSearch.length > 0 && (
                  <View style={s.whList}>
                    {WAREHOUSES_LIST
                      .filter(w => w.toLowerCase().includes(draftWHSearch.toLowerCase()))
                      .map((w, idx, arr) => {
                        const checked = draftWH.has(w);
                        return (
                          <TouchableOpacity
                            key={w}
                            style={[s.whRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => {
                              setDraftWH(prev => { const n = new Set(prev); checked ? n.delete(w) : n.add(w); return n; });
                              if (!checked) setDraftWHSearch('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="business-outline" size={15} color={COLORS.textSecondary} />
                            <Text style={s.whRowTxt}>{w}</Text>
                            <View style={[s.checkbox, checked && s.checkboxActive]}>
                              {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                )}
              </View>

              {/* Item Group */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Item Group</Text>
                <View style={s.optionList}>
                  <TouchableOpacity
                    style={[s.optionRow]}
                    onPress={() => setDraftItemGroup('')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.optionTxt, !draftItemGroup && s.optionTxtActive]}>All Groups</Text>
                    <View style={[s.radio, !draftItemGroup && s.radioActive]}>
                      {!draftItemGroup && <View style={s.radioInner} />}
                    </View>
                  </TouchableOpacity>
                  {ITEM_GROUPS.map((g, idx) => {
                    const active = draftItemGroup === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[s.optionRow, idx === ITEM_GROUPS.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => setDraftItemGroup(g)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.optionTxt, active && s.optionTxtActive]}>{g}</Text>
                        <View style={[s.radio, active && s.radioActive]}>
                          {active && <View style={s.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowFilter(false)} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={s.applyTxt}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  filterBadge:    { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Selection banner
  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  // Hint
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingVertical: 7, backgroundColor: COLORS.pageBg },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  whFilterRow:  { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  whChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.textPrimary },
  whChipTxt:    { fontSize: TYPOGRAPHY.xs, color: '#fff', fontWeight: '600' },

  tabRow:     { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 6 },
  tab:        { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  tabActive:  { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  tabTxt:     { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: '#fff' },

  list: { padding: SPACING.md, gap: 4 },

  warehouseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 5 },
  warehouseLabel:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },

  // Item card
  itemCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: 4 },
  itemCardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },

  // Avatar — letter-style matching stock-ledger
  itemTop:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 },
  avatar:    { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSel: { backgroundColor: '#A89060' },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  itemMeta:  { flex: 1 },
  itemName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  itemCode:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  // Days-left badge
  daysBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  daysBadgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  divider:  { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  gridRow:  { flexDirection: 'row' },
  gridItem: { flex: 1, gap: 3, paddingHorizontal: 2 },
  gridLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  gridVal:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // Share bar (conditional on selection)
  shareBar:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:         { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:         { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  // Modal
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
