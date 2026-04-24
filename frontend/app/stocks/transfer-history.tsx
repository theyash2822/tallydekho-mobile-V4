import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Brand amber (In Transit colour) ───────────────────────────────────────────
const AMBER    = '#A89060';
const AMBER_BG = '#A8906018';

type TxStatus = 'draft' | 'in-transit' | 'received' | 'cancelled';

interface Transfer {
  id: string; ref: string; dateLabel: string;
  from: string; to: string; itemCount: number;
  status: TxStatus; dispatchDate: string; receiveDate: string;
}

const WAREHOUSES: string[] = [
  'Jaipur Depot', 'Delhi Branch', 'Mumbai HQ',
  'Pune Godown', 'Chennai Depot', 'Hyderabad Hub',
  'Kolkata WH', 'Bhubaneswar Store',
];

const TRANSFERS: Transfer[] = [
  { id: 'tx1', ref: '#TX-2456', dateLabel: '08 Jul', from: 'Jaipur Depot',  to: 'Delhi Branch',      itemCount: 3, status: 'in-transit', dispatchDate: '1 Aug 2025',  receiveDate: ''           },
  { id: 'tx2', ref: '#TX-2457', dateLabel: '08 Jul', from: 'Mumbai HQ',     to: 'Pune Godown',       itemCount: 5, status: 'in-transit', dispatchDate: '1 Aug 2025',  receiveDate: ''           },
  { id: 'tx3', ref: '#TX-2450', dateLabel: '05 Jul', from: 'Delhi Branch',  to: 'Hyderabad Hub',     itemCount: 7, status: 'received',   dispatchDate: '28 Jul 2025', receiveDate: '30 Jul 2025'},
  { id: 'tx4', ref: '#TX-2445', dateLabel: '02 Jul', from: 'Chennai Depot', to: 'Kolkata WH',        itemCount: 2, status: 'draft',      dispatchDate: '',            receiveDate: ''           },
  { id: 'tx5', ref: '#TX-2440', dateLabel: '28 Jun', from: 'Kolkata WH',    to: 'Bhubaneswar Store', itemCount: 4, status: 'cancelled',  dispatchDate: '',            receiveDate: ''           },
  { id: 'tx6', ref: '#TX-2435', dateLabel: '25 Jun', from: 'Pune Godown',   to: 'Mumbai HQ',         itemCount: 6, status: 'received',   dispatchDate: '15 Jul 2025', receiveDate: '18 Jul 2025'},
  { id: 'tx7', ref: '#TX-2430', dateLabel: '22 Jun', from: 'Jaipur Depot',  to: 'Mumbai HQ',         itemCount: 8, status: 'in-transit', dispatchDate: '12 Jul 2025', receiveDate: ''           },
  { id: 'tx8', ref: '#TX-2425', dateLabel: '20 Jun', from: 'Delhi Branch',  to: 'Chennai Depot',     itemCount: 1, status: 'draft',      dispatchDate: '',            receiveDate: ''           },
];

const STATUS_CFG: Record<TxStatus, { color: string; bg: string; label: string; icon: any }> = {
  'draft':      { color: COLORS.warning,  bg: COLORS.warningBg,  label: 'Draft',      icon: 'document-outline'         },
  'in-transit': { color: AMBER,           bg: AMBER_BG,          label: 'In Transit', icon: 'car-outline'              },
  'received':   { color: COLORS.positive, bg: COLORS.positiveBg, label: 'Received',   icon: 'checkmark-circle-outline' },
  'cancelled':  { color: COLORS.negative, bg: COLORS.negativeBg, label: 'Cancelled',  icon: 'close-circle-outline'     },
};

const STATUS_OPTIONS: TxStatus[] = ['draft', 'in-transit', 'received', 'cancelled'];

export default function TransferHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search,       setSearch]       = useState('');
  const [showFilter,   setShowFilter]   = useState(false);

  // Applied filters
  const [selSourceWH,  setSelSourceWH]  = useState('');
  const [selDestWH,    setSelDestWH]    = useState('');
  const [selStatuses,  setSelStatuses]  = useState<Set<TxStatus>>(new Set());
  const [activePeriod, setActivePeriod] = useState<'30D' | '90D' | 'Custom'>('30D');
  const [customDay,    setCustomDay]    = useState('');

  // Draft filter state
  const [draftSourceWH,   setDraftSourceWH]   = useState('');
  const [draftDestWH,     setDraftDestWH]     = useState('');
  const [draftStatuses,   setDraftStatuses]   = useState<Set<TxStatus>>(new Set());
  const [draftPeriod,     setDraftPeriod]     = useState<'30D' | '90D' | 'Custom'>('30D');
  const [draftCustomDay,  setDraftCustomDay]  = useState('');
  const [sourceExpanded,  setSourceExpanded]  = useState(false);
  const [destExpanded,    setDestExpanded]    = useState(false);

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const activeFilterCount = (selSourceWH ? 1 : 0) + (selDestWH ? 1 : 0) + selStatuses.size + (activePeriod !== '30D' ? 1 : 0);

  const visibleItems = useMemo(() => TRANSFERS.filter(t => {
    if (search && !t.ref.toLowerCase().includes(search.toLowerCase()) &&
        !t.from.toLowerCase().includes(search.toLowerCase()) &&
        !t.to.toLowerCase().includes(search.toLowerCase())) return false;
    if (selSourceWH && t.from !== selSourceWH) return false;
    if (selDestWH   && t.to   !== selDestWH)   return false;
    if (selStatuses.size > 0 && !selStatuses.has(t.status)) return false;
    return true;
  }), [search, selSourceWH, selDestWH, selStatuses]);

  // ── Filter handlers ───────────────────────────────────────────────────────
  const openFilter = () => {
    setDraftSourceWH(selSourceWH);
    setDraftDestWH(selDestWH);
    setDraftStatuses(new Set(selStatuses));
    setDraftPeriod(activePeriod);
    setDraftCustomDay(customDay);
    setSourceExpanded(false);
    setDestExpanded(false);
    setShowFilter(true);
  };

  const applyFilters = () => {
    setSelSourceWH(draftSourceWH);
    setSelDestWH(draftDestWH);
    setSelStatuses(new Set(draftStatuses));
    setActivePeriod(draftPeriod);
    setCustomDay(draftCustomDay);
    setShowFilter(false);
  };

  const resetFilters = () => {
    setDraftSourceWH('');
    setDraftDestWH('');
    setDraftStatuses(new Set());
    setDraftPeriod('30D');
    setDraftCustomDay('');
    setSourceExpanded(false);
    setDestExpanded(false);
  };

  // ── Multi-select handlers ─────────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const handlePress = (tx: Transfer) => {
    if (!isSelectionMode) {
      router.push({ pathname: '/stocks/transfer-details', params: { id: tx.id } });
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(tx.id)) {
        next.delete(tx.id);
        if (next.size === 0) setIsSelectionMode(false);
      } else {
        next.add(tx.id);
      }
      return next;
    });
  };

  const cancelSelection = () => { setSelectedIds(new Set()); setIsSelectionMode(false); };
  const selectAll       = () => { setSelectedIds(new Set(visibleItems.map(t => t.id))); setIsSelectionMode(true); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Transfer History</Text>
        <TouchableOpacity style={s.headerBtn} onPress={openFilter} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={COLORS.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeTxt}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Selection Banner ─────────────────────────────────────────────────── */}
      {isSelectionMode && (
        <View style={s.selBanner}>
          <TouchableOpacity onPress={cancelSelection} style={s.selBannerBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            <Text style={s.selBannerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.selBannerCount}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={selectAll} style={s.selBannerBtn} activeOpacity={0.7}>
            <Text style={s.selBannerAll}>All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────────── */}
      {!isSelectionMode && (
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by ref or warehouse..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Hint ─────────────────────────────────────────────────────────────── */}
      {!isSelectionMode && visibleItems.length > 0 && (
        <View style={s.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
          <Text style={s.hintTxt}>Long press to select items</Text>
        </View>
      )}

      {/* ── Transfer List ────────────────────────────────────────────────────── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.list}>
        {visibleItems.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="swap-horizontal-outline" size={48} color={COLORS.borderDefault} />
            <Text style={s.emptyTxt}>No transfers found</Text>
          </View>
        ) : (
          visibleItems.map(tx => {
            const cfg = STATUS_CFG[tx.status];
            const isSel = selectedIds.has(tx.id);
            return (
              <View key={tx.id} style={s.txGroup}>
                {/* Status header row */}
                <View style={s.txStatusRow}>
                  <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={11} color={cfg.color} />
                    <Text style={[s.statusTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={s.txDateLbl}> · {tx.dateLabel}</Text>
                </View>

                {/* Transfer card */}
                <TouchableOpacity
                  style={[s.txCard, isSel && s.txCardSel]}
                  onPress={() => handlePress(tx)}
                  onLongPress={() => handleLongPress(tx.id)}
                  delayLongPress={350}
                  activeOpacity={0.8}
                >
                  <View style={[s.txIconCircle, isSel && s.txIconCircleSel]}>
                    {isSel
                      ? <Ionicons name="checkmark" size={18} color="#fff" />
                      : <Ionicons name="swap-horizontal-outline" size={18} color={COLORS.textPrimary} />
                    }
                  </View>
                  <View style={s.txInfo}>
                    <View style={s.txFromToRow}>
                      <Text style={s.txFromToTxt} numberOfLines={1}>{tx.from}</Text>
                      <Ionicons name="arrow-forward" size={12} color={COLORS.textTertiary} style={{ marginHorizontal: 4 }} />
                      <Text style={s.txFromToTxt} numberOfLines={1}>{tx.to}</Text>
                    </View>
                    <Text style={s.txRef}>{tx.ref}</Text>
                  </View>
                  <View style={s.txRight}>
                    <Text style={s.txItemCount}>{tx.itemCount} Items</Text>
                    {!isSelectionMode && <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Share Bar ────────────────────────────────────────────────────────── */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={s.shareBtnView} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Filter Modal ─────────────────────────────────────────────────────── */}
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

              {/* Period Selector */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Period</Text>
                <View style={s.periodSegment}>
                  {(['30D', '90D', 'Custom'] as const).map((p, idx) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        s.periodBtn,
                        draftPeriod === p && s.periodBtnActive,
                        idx === 0 && { borderTopLeftRadius: RADIUS.md, borderBottomLeftRadius: RADIUS.md },
                        idx === 2 && { borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, borderRightWidth: 0 },
                      ]}
                      onPress={() => setDraftPeriod(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.periodTxt, draftPeriod === p && s.periodTxtActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {draftPeriod === 'Custom' && (
                  <TextInput
                    style={s.customDayInput}
                    placeholder="Enter days (e.g. 45)"
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftCustomDay}
                    onChangeText={setDraftCustomDay}
                    keyboardType="numeric"
                  />
                )}
              </View>

              {/* Source WH */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Source WH</Text>
                <TouchableOpacity
                  style={s.dropdownBtn}
                  onPress={() => { setSourceExpanded(p => !p); setDestExpanded(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownTxt, !!draftSourceWH && s.dropdownTxtActive]}>
                    {draftSourceWH || 'Select Category'}
                  </Text>
                  <Ionicons name={sourceExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
                {sourceExpanded && (
                  <View style={s.dropdownList}>
                    <TouchableOpacity
                      style={s.dropdownItem}
                      onPress={() => { setDraftSourceWH(''); setSourceExpanded(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dropdownItemTxt, !draftSourceWH && s.dropdownItemActive]}>All Warehouses</Text>
                      {!draftSourceWH && <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} />}
                    </TouchableOpacity>
                    {WAREHOUSES.map((w, idx) => {
                      const active = draftSourceWH === w;
                      return (
                        <TouchableOpacity
                          key={w}
                          style={[s.dropdownItem, idx === WAREHOUSES.length - 1 && { borderBottomWidth: 0 }]}
                          onPress={() => { setDraftSourceWH(w); setSourceExpanded(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.dropdownItemTxt, active && s.dropdownItemActive]}>{w}</Text>
                          {active && <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Destination WH */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Destination WH</Text>
                <TouchableOpacity
                  style={s.dropdownBtn}
                  onPress={() => { setDestExpanded(p => !p); setSourceExpanded(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownTxt, !!draftDestWH && s.dropdownTxtActive]}>
                    {draftDestWH || 'Select Category'}
                  </Text>
                  <Ionicons name={destExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
                {destExpanded && (
                  <View style={s.dropdownList}>
                    <TouchableOpacity
                      style={s.dropdownItem}
                      onPress={() => { setDraftDestWH(''); setDestExpanded(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.dropdownItemTxt, !draftDestWH && s.dropdownItemActive]}>All Warehouses</Text>
                      {!draftDestWH && <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} />}
                    </TouchableOpacity>
                    {WAREHOUSES.map((w, idx) => {
                      const active = draftDestWH === w;
                      return (
                        <TouchableOpacity
                          key={w}
                          style={[s.dropdownItem, idx === WAREHOUSES.length - 1 && { borderBottomWidth: 0 }]}
                          onPress={() => { setDraftDestWH(w); setDestExpanded(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.dropdownItemTxt, active && s.dropdownItemActive]}>{w}</Text>
                          {active && <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Status Chips */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Status</Text>
                <View style={s.statusChips}>
                  {STATUS_OPTIONS.map(st => {
                    const cfg = STATUS_CFG[st];
                    const active = draftStatuses.has(st);
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[s.statusChip, active && s.statusChipActive]}
                        onPress={() => setDraftStatuses(prev => {
                          const n = new Set(prev);
                          active ? n.delete(st) : n.add(st);
                          return n;
                        })}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.statusChipTxt, active && s.statusChipTxtActive]}>{cfg.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.resetBtn} onPress={resetFilters} activeOpacity={0.7}>
                <Text style={s.resetTxt}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={s.applyTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.pageBg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  filterBadge:  { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt:{ fontSize: 9, fontWeight: '700', color: '#fff' },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.xs, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 6 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },

  txGroup:     { marginBottom: SPACING.md },
  txStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingHorizontal: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt:   { fontSize: 11, fontWeight: '700' },
  txDateLbl:   { fontSize: 11, color: COLORS.textSecondary },

  txCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderWidth: 1, borderColor: COLORS.borderDefault },
  txCardSel:       { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  txIconCircle:    { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  txIconCircleSel: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  txInfo:          { flex: 1 },
  txFromToRow:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  txFromToTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  txRef:           { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  txRight:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  txItemCount:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  shareBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  shareBarCount:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareBtnView:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full },
  shareTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: COLORS.cardBg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, paddingTop: SPACING.sm, maxHeight: '90%' },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: SPACING.md },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  modalTitle:   { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },

  filterSection:      { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  filterSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },

  // Period selector (matches fast-slow.tsx pattern)
  periodSegment:   { flexDirection: 'row', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  periodBtn:       { flex: 1, paddingVertical: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  periodBtnActive: { backgroundColor: COLORS.brandPrimary },
  periodTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: '#fff', fontWeight: '700' },
  customDayInput:  { marginTop: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg },

  dropdownBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault },
  dropdownTxt:        { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  dropdownTxtActive:  { color: COLORS.textPrimary },
  dropdownList:       { marginTop: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  dropdownItem:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropdownItemTxt:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dropdownItemActive: { color: COLORS.textPrimary, fontWeight: '600' },

  statusChips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip:         { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  statusChipActive:   { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  statusChipTxt:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  statusChipTxtActive:{ color: '#fff', fontWeight: '700' },

  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  resetBtn:    { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center' },
  resetTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn:    { flex: 2, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center' },
  applyTxt:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
