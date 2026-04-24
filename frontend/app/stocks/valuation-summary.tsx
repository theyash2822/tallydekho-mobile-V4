import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PieChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

// ── Mock Data ────────────────────────────────────────────────────────────────
const WAREHOUSES_LIST = ['WH-001 Echo Depot', 'WH-002 Sierra Storage', 'WH-003 Delta Hub', 'WH-004 Zulu Center', 'WH-005 North Terminal'];
const COSTING_OPTIONS = ['FIFO (First In, First Out)', 'Weighted Average', 'LIFO (Last In, First Out)'];

const PIE_DATA = [
  { value: 670000, color: '#A89060',  label: 'Echo Depot'     },
  { value: 320000, color: '#3A3A3A',  label: 'Sierra Storage' },
  { value: 890000, color: '#7C5C3A',  label: 'Delta Hub'      },
  { value: 410000, color: '#1A1A1A',  label: 'Zulu Center'    },
];

const WAREHOUSE_CARDS = [
  { id: 'w1', name: 'Echo Depot',     city: 'New Delhi, India',  value: '₹6.7L',  skus: 1260, ratio: 29, color: '#A89060' },
  { id: 'w2', name: 'Sierra Storage', city: 'New Delhi, India',  value: '₹3.2L',  skus: 840,  ratio: 14, color: '#3A3A3A' },
  { id: 'w3', name: 'Delta Hub',      city: 'Mumbai, India',     value: '₹8.9L',  skus: 2100, ratio: 39, color: '#7C5C3A' },
  { id: 'w4', name: 'Zulu Center',    city: 'Bangalore, India',  value: '₹4.1L',  skus: 980,  ratio: 18, color: '#1A1A1A' },
];

export default function ValuationSummaryScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // Chart interaction
  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const handleCardPress = (id: string) => {
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
    setSelectedIds(new Set(WAREHOUSE_CARDS.map(w => w.id)));
    setIsSelectionMode(true);
  };

  // Filter state
  const [showFilter,          setShowFilter]          = useState(false);
  const [showDatePick,        setShowDatePick]        = useState(false);
  const [pendingReopenFilter, setPendingReopenFilter] = useState(false);

  // Applied
  const [dateFrom,   setDateFrom]   = useState('01/04/25');
  const [dateTo,     setDateTo]     = useState('24/04/25');
  const [selWH,      setSelWH]      = useState<Set<string>>(new Set());
  const [selCosting, setSelCosting] = useState('FIFO (First In, First Out)');

  // Draft
  const [draftFrom,      setDraftFrom]      = useState('01/04/25');
  const [draftTo,        setDraftTo]        = useState('24/04/25');
  const [draftWH,        setDraftWH]        = useState<Set<string>>(new Set());
  const [draftWHSearch,  setDraftWHSearch]  = useState('');
  const [draftCosting,   setDraftCosting]   = useState('FIFO (First In, First Out)');

  const activeFilterCount = selWH.size + (selCosting !== 'FIFO (First In, First Out)' ? 1 : 0);

  const openFilter = () => {
    setDraftFrom(dateFrom); setDraftTo(dateTo);
    setDraftWH(new Set(selWH)); setDraftWHSearch('');
    setDraftCosting(selCosting);
    setShowFilter(true);
  };

  const applyFilters = () => {
    setDateFrom(draftFrom); setDateTo(draftTo);
    setSelWH(new Set(draftWH));
    setSelCosting(draftCosting);
    setShowFilter(false);
  };

  const resetFilters = () => {
    setDraftFrom('01/04/25'); setDraftTo('24/04/25');
    setDraftWH(new Set()); setDraftWHSearch('');
    setDraftCosting('FIFO (First In, First Out)');
  };

  const openDateFromFilter = () => {
    setShowFilter(false);
    setPendingReopenFilter(true);
    setTimeout(() => setShowDatePick(true), 350);
  };

  const handleDateApply = (f: string, t: string) => {
    setDraftFrom(f); setDraftTo(t);
    setShowDatePick(false);
    if (pendingReopenFilter) {
      setPendingReopenFilter(false);
      setTimeout(() => setShowFilter(true), 350);
    }
  };

  const fmtDateLabel = (s: string) => {
    const p = s.split('/');
    if (p.length < 3) return s;
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${p[0]} ${m[parseInt(p[1])-1]} ${p[2]}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Valuation Summary</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Donut Chart */}
        <View style={s.chartCard}>
          <PieChart
            donut
            data={PIE_DATA}
            radius={100}
            innerRadius={64}
            focusOnPress
            selectedIndex={selectedSlice ?? undefined}
            onPress={(_item: any, index: number) => {
              setSelectedSlice(prev => (prev === index ? null : index));
            }}
            centerLabelComponent={() => {
              const slice = selectedSlice !== null ? PIE_DATA[selectedSlice] : null;
              if (slice) {
                return (
                  <View style={s.chartCenter}>
                    <Text style={[s.chartCenterName, { color: slice.color === '#1A1A1A' ? COLORS.textSecondary : slice.color }]}
                      numberOfLines={2}>
                      {slice.label}
                    </Text>
                    <Text style={s.chartCenterVal}>₹{(slice.value / 1000).toFixed(0)}K</Text>
                  </View>
                );
              }
              return (
                <View style={s.chartCenter}>
                  <Ionicons name="business-outline" size={20} color={COLORS.textSecondary} />
                  <Text style={s.chartCenterTxt}>Warehouse</Text>
                </View>
              );
            }}
          />
          {/* Tap hint */}
          <Text style={s.chartHint}>Tap a segment to see details</Text>
          {/* Legend */}
          <View style={s.legend}>
            {PIE_DATA.map((d, idx) => (
              <TouchableOpacity
                key={d.label}
                style={[s.legendRow, selectedSlice === idx && s.legendRowActive]}
                onPress={() => setSelectedSlice(prev => (prev === idx ? null : idx))}
                activeOpacity={0.7}
              >
                <View style={[s.legendDot, { backgroundColor: d.color }, selectedSlice === idx && { width: 16, height: 16, borderRadius: 8 }]} />
                <Text style={[s.legendLabel, selectedSlice === idx && { fontWeight: '700', color: COLORS.textPrimary }]}>{d.label}</Text>
                <Text style={[s.legendVal, selectedSlice === idx && { color: d.color === '#1A1A1A' ? COLORS.textPrimary : d.color }]}>₹{(d.value / 1000).toFixed(0)}K</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Warehouse Cards */}
        <Text style={s.sectionLabel}>Warehouse Breakdown</Text>

        {/* Long press hint */}
        {!isSelectionMode && (
          <View style={s.hintRow}>
            <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
            <Text style={s.hintTxt}>Long press a card to select</Text>
          </View>
        )}

        {WAREHOUSE_CARDS.map(w => {
          const isSel = selectedIds.has(w.id);
          return (
            <TouchableOpacity
              key={w.id}
              style={[s.whCard, isSel && s.whCardSel]}
              onPress={() => handleCardPress(w.id)}
              onLongPress={() => handleLongPress(w.id)}
              delayLongPress={350}
              activeOpacity={0.8}
            >
              <View style={s.whCardTop}>
                <View style={[s.avatar, { backgroundColor: isSel ? '#A89060' : w.color }]}>
                  {isSel
                    ? <Ionicons name="checkmark" size={20} color="#fff" />
                    : <Text style={s.avatarTxt}>{w.name.charAt(0)}</Text>
                  }
                </View>
                <View style={s.whCardInfo}>
                  <Text style={s.whName}>{w.name}</Text>
                  <Text style={s.whCity}>{w.city}</Text>
                </View>
              </View>
              <View style={s.whDivider} />
              <View style={s.whStats}>
                <View style={s.statItem}>
                  <Text style={s.statLbl}>Stock Value</Text>
                  <Text style={s.statVal}>{w.value}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statLbl}>SKUs</Text>
                  <Text style={s.statVal}>{w.skus.toLocaleString()}</Text>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <Text style={s.statLbl}>Ratio</Text>
                  <Text style={s.statVal}>{w.ratio}%</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Share Bar — only visible when items are selected */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>{selectedIds.size} warehouse{selectedIds.size !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Filter Modal (inlined — no sub-component to prevent remount) ── */}
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
              {/* Date Range */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Date range</Text>
                <TouchableOpacity style={s.dateRangeRow} onPress={openDateFromFilter} activeOpacity={0.8}>
                  <View style={s.dateField}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
                    <Text style={s.dateFieldTxt}>{fmtDateLabel(draftFrom)}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.textTertiary} />
                  <View style={s.dateField}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
                    <Text style={s.dateFieldTxt}>{fmtDateLabel(draftTo)}</Text>
                  </View>
                </TouchableOpacity>
              </View>

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

              {/* Costing */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Costing</Text>
                <View style={s.optionList}>
                  {COSTING_OPTIONS.map((c, idx) => {
                    const active = draftCosting === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[s.optionRow, idx === COSTING_OPTIONS.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => setDraftCosting(c)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.optionTxt, active && s.optionTxtActive]}>{c}</Text>
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
              <TouchableOpacity style={s.cancelBtn} onPress={resetFilters} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={s.applyTxt}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={draftFrom}
        toDate={draftTo}
        onApply={handleDateApply}
        onClose={() => {
          setShowDatePick(false);
          if (pendingReopenFilter) {
            setPendingReopenFilter(false);
            setTimeout(() => setShowFilter(true), 350);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  filterBadge: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Selection banner
  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  // Hint
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  scroll: { padding: SPACING.md, gap: 12 },

  chartCard:       { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, alignItems: 'center' },
  chartCenter:     { alignItems: 'center', gap: 3, width: 110 },
  chartCenterTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  chartCenterName: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', textAlign: 'center' },
  chartCenterVal:  { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  chartHint:       { fontSize: 10, color: COLORS.textTertiary, marginTop: 6, marginBottom: 2 },
  legend:          { width: '100%', marginTop: SPACING.sm, gap: 8 },
  legendRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 4, borderRadius: RADIUS.sm },
  legendRowActive: { backgroundColor: COLORS.pageBg },
  legendDot:       { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  legendLabel:     { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  legendVal:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 4, marginTop: 4 },

  whCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  whCardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  whCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  whCardInfo:{ flex: 1 },
  whName:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  whCity:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  whDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },
  whStats:   { flexDirection: 'row', alignItems: 'center' },
  statItem:  { flex: 1, alignItems: 'center', gap: 3 },
  statLbl:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  statVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.borderDefault },

  // Share bar (conditional on selection)
  shareBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:      { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:           { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:           { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingHorizontal: SPACING.md },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 8 },
  modalTitle:   { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  filterSection:      { marginBottom: 20 },
  filterSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateField:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  dateFieldTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.textPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.sm, color: '#fff', fontWeight: '600' },
  searchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  searchTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },
  whList:       { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', marginTop: 8 },
  whRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  whRowTxt:     { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  checkbox:     { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  optionList:   { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  optionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  optionTxt:    { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, flex: 1 },
  optionTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: COLORS.brandPrimary },
  radioInner:   { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brandPrimary },
  modalFooter:  { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelBtn:    { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.pageBg, alignItems: 'center' },
  cancelTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  applyBtn:     { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.textPrimary, alignItems: 'center' },
  applyTxt:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
