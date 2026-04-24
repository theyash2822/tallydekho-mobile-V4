import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

const AMBER    = '#A89060';
const AMBER_BG = '#A8906018';

type ValuationType = 'Average' | 'Opening' | 'Closing' | 'Peak';

interface SnapshotRow {
  id: string; rank: number; warehouse: string; value: string; pct: string;
}

interface SnapshotData {
  rows: SnapshotRow[];
  grandValue: string;
  grandPct: string;
}

const SNAPSHOT_DATA: Record<ValuationType, SnapshotData> = {
  Average: {
    rows: [
      { id: 'r1', rank: 1, warehouse: 'Jaipur - Main Depot', value: '32.10 L', pct: '48%' },
      { id: 'r2', rank: 2, warehouse: 'Delhi Depot',         value: '22.30 L', pct: '33%' },
      { id: 'r3', rank: 3, warehouse: 'Mumbai Satellite',    value: '11.60 L', pct: '19%' },
    ],
    grandValue: '66.00 L', grandPct: '100%',
  },
  Opening: {
    rows: [
      { id: 'r1', rank: 1, warehouse: 'Mumbai Satellite',    value: '35.20 L', pct: '42%' },
      { id: 'r2', rank: 2, warehouse: 'Delhi Depot',         value: '28.50 L', pct: '34%' },
      { id: 'r3', rank: 3, warehouse: 'Jaipur - Main Depot', value: '20.10 L', pct: '24%' },
    ],
    grandValue: '83.80 L', grandPct: '100%',
  },
  Closing: {
    rows: [
      { id: 'r1', rank: 1, warehouse: 'Delhi Depot',         value: '29.80 L', pct: '45%' },
      { id: 'r2', rank: 2, warehouse: 'Jaipur - Main Depot', value: '21.50 L', pct: '33%' },
      { id: 'r3', rank: 3, warehouse: 'Mumbai Satellite',    value: '14.20 L', pct: '22%' },
    ],
    grandValue: '65.50 L', grandPct: '100%',
  },
  Peak: {
    rows: [
      { id: 'r1', rank: 1, warehouse: 'Jaipur - Main Depot', value: '42.60 L', pct: '46%' },
      { id: 'r2', rank: 2, warehouse: 'Mumbai Satellite',    value: '28.90 L', pct: '31%' },
      { id: 'r3', rank: 3, warehouse: 'Delhi Depot',         value: '21.30 L', pct: '23%' },
    ],
    grandValue: '92.80 L', grandPct: '100%',
  },
};

const VALUATION_TYPES: ValuationType[] = ['Average', 'Opening', 'Closing', 'Peak'];

export default function StockSnapshotScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [valuation,    setValuation]    = useState<ValuationType>('Average');
  const [showValDrop,  setShowValDrop]  = useState(false);
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [showDatePick, setShowDatePick] = useState(false);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isSelMode,    setIsSelMode]    = useState(false);

  const data      = SNAPSHOT_DATA[valuation];
  const dateLabel = dateFrom && dateTo ? `${dateFrom} — ${dateTo}` : 'Today';

  // ── Multi-select ───────────────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    setShowValDrop(false);
    setIsSelMode(true);
    setSelectedIds(new Set([id]));
  };

  const handlePress = (id: string) => {
    if (!isSelMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setIsSelMode(false);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cancelSelection = () => { setSelectedIds(new Set()); setIsSelMode(false); };
  const selectAll       = () => { setSelectedIds(new Set(data.rows.map(r => r.id))); setIsSelMode(true); };

  // ── Date picker ────────────────────────────────────────────────────────
  const handleDateApply = (f: string, t: string) => {
    setDateFrom(f);
    setDateTo(t);
    setShowDatePick(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* ── Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Snapshot</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Selection Banner */}
      {isSelMode && (
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* ── Controls Row */}
        {!isSelMode && (
          <View style={s.controlsRow}>
            {/* Date Pill */}
            <TouchableOpacity
              style={s.controlPill}
              onPress={() => { setShowValDrop(false); setShowDatePick(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
              <Text style={s.controlPillTxt} numberOfLines={1}>{dateLabel}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Valuation Pill */}
            <TouchableOpacity
              style={s.controlPill}
              onPress={() => setShowValDrop(p => !p)}
              activeOpacity={0.8}
            >
              <Ionicons name="layers-outline" size={14} color={COLORS.textPrimary} />
              <Text style={s.controlPillTxt}>{valuation}</Text>
              <Ionicons
                name={showValDrop ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Valuation Dropdown */}
        {showValDrop && (
          <View style={s.valDropdown}>
            {VALUATION_TYPES.map((v, idx) => (
              <TouchableOpacity
                key={v}
                style={[s.valDropItem, idx === VALUATION_TYPES.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { setValuation(v); setShowValDrop(false); }}
                activeOpacity={0.7}
              >
                <Text style={[s.valDropTxt, valuation === v && s.valDropTxtActive]}>{v}</Text>
                {valuation === v && <Ionicons name="checkmark" size={16} color={COLORS.textPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Hint */}
        {!isSelMode && (
          <View style={s.hintRow}>
            <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
            <Text style={s.hintTxt}>Long press to select rows</Text>
          </View>
        )}

        {/* ── Table */}
        <View style={s.tableCard}>
          {/* Header row */}
          <View style={[s.tableRow, s.tableHeader]}>
            <Text style={[s.colIdx, s.hdrTxt]}>#</Text>
            <Text style={[s.colWarehouse, s.hdrTxt]}>Warehouse</Text>
            <Text style={[s.colValue, s.hdrTxt]}>Value (₹)</Text>
            <Text style={[s.colPct, s.hdrTxt]}>% Portfolio</Text>
          </View>

          {/* Data rows */}
          {data.rows.map((row, idx) => {
            const isSel = selectedIds.has(row.id);
            return (
              <TouchableOpacity
                key={row.id}
                style={[
                  s.tableRow,
                  idx % 2 === 1 && s.tableRowAlt,
                  isSel && s.tableRowSel,
                ]}
                onPress={() => handlePress(row.id)}
                onLongPress={() => handleLongPress(row.id)}
                delayLongPress={350}
                activeOpacity={0.85}
              >
                <View style={[s.colIdx, { alignItems: 'center', justifyContent: 'center' }]}>
                  {isSel ? (
                    <View style={s.checkCircle}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  ) : (
                    <Text style={s.rankTxt}>{row.rank}</Text>
                  )}
                </View>
                <Text style={[s.colWarehouse, s.dataTxt]}>{row.warehouse}</Text>
                <Text style={[s.colValue, s.dataTxt]}>{row.value}</Text>
                <Text style={[s.colPct, s.dataTxt]}>{row.pct}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Grand Total */}
          <View style={[s.tableRow, s.grandRow]}>
            <Text style={[s.colIdx, s.grandTxt]}>-</Text>
            <Text style={[s.colWarehouse, s.grandTxt]}>Grand Total</Text>
            <Text style={[s.colValue, s.grandTxt]}>{data.grandValue}</Text>
            <Text style={[s.colPct, s.grandTxt]}>{data.grandPct}</Text>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Conditional Share Bar */}
      {isSelMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>
            {selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity style={s.shareBtnView} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Date Range Picker */}
      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom}
        toDate={dateTo}
        onApply={handleDateApply}
        onClose={() => setShowDatePick(false)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  // Controls
  controlsRow:    { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  controlPill:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  controlPillTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // Valuation dropdown
  valDropdown:    { marginHorizontal: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  valDropItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  valDropTxt:     { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  valDropTxtActive:{ color: COLORS.textPrimary, fontWeight: '700' },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingTop: 2, paddingBottom: 8 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  // Table
  tableCard:    { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tableRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tableHeader:  { backgroundColor: COLORS.activeBg },
  tableRowAlt:  { backgroundColor: COLORS.pageBg },
  tableRowSel:  { backgroundColor: AMBER_BG },

  colIdx:      { width: 30 },
  colWarehouse:{ flex: 1, paddingRight: 4 },
  colValue:    { width: 76, textAlign: 'right' },
  colPct:      { width: 72, textAlign: 'right' },

  hdrTxt:     { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.3 },
  rankTxt:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dataTxt:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  checkCircle:{ width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },

  grandRow:  { backgroundColor: COLORS.activeBg, borderBottomWidth: 0 },
  grandTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // Share bar
  shareBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  shareBarCount:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareBtnView:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, paddingHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADIUS.full },
  shareTxt:           { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
