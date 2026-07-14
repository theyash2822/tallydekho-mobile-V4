/**
 * Cash Count bottom sheet — denomination cards for Contra.
 * Hard gate: Apply only when counted === target (or Clear Count).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import {
  autoSplitAmount,
  emptyDenomCounts,
  getCashDenomMaster,
  loadLastCashPattern,
  saveLastCashPattern,
  sumDenomCounts,
  DenomCounts,
} from '../../constants/cashDenominations';

export type CashCountResult = {
  used: boolean;
  matched: boolean;
  denominations: DenomCounts;
  counted: number;
  target: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  targetAmount: number;
  currency?: string;
  /** Seed when reopening an existing count */
  initialCounts?: DenomCounts | null;
  onApply: (result: CashCountResult) => void;
  onClear: () => void;
};

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < 0.005;

export default function CashCountSheet({
  visible,
  onClose,
  targetAmount,
  currency = 'INR',
  initialCounts,
  onApply,
  onClear,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const master = useMemo(() => getCashDenomMaster(currency), [currency]);
  const snapPoints = useMemo(() => ['92%'], []);

  const [counts, setCounts] = useState<DenomCounts>(() => emptyDenomCounts(master.notes));

  useEffect(() => {
    if (!visible) return;
    if (initialCounts && Object.keys(initialCounts).length) {
      setCounts({ ...emptyDenomCounts(master.notes), ...initialCounts });
    } else {
      setCounts(emptyDenomCounts(master.notes));
    }
    sheetRef.current?.present();
  }, [visible, initialCounts, master.notes]);

  const counted = useMemo(() => sumDenomCounts(counts), [counts]);
  const diff = Math.round((counted - (targetAmount || 0)) * 100) / 100;
  const matched = nearlyEqual(counted, targetAmount || 0) && (targetAmount || 0) > 0;

  const setQty = (face: number, qty: number) => {
    const q = Math.max(0, Math.min(9999, Math.floor(qty) || 0));
    setCounts((prev) => ({ ...prev, [String(face)]: q }));
  };

  const bump = (face: number, delta: number) => {
    const cur = parseInt(String(counts[String(face)] || 0), 10) || 0;
    setQty(face, cur + delta);
  };

  const handleAutoSplit = () => {
    setCounts(autoSplitAmount(targetAmount || 0, master.notes));
  };

  const handleClear = () => {
    setCounts(emptyDenomCounts(master.notes));
  };

  const handleUseLast = async () => {
    const last = await loadLastCashPattern((k) => AsyncStorage.getItem(k));
    if (!last) return;
    setCounts({ ...emptyDenomCounts(master.notes), ...last });
  };

  const handleApply = async () => {
    if (!matched) return;
    await saveLastCashPattern((k, v) => AsyncStorage.setItem(k, v), counts);
    onApply({
      used: true,
      matched: true,
      denominations: counts,
      counted,
      target: targetAmount || 0,
    });
    sheetRef.current?.dismiss();
    onClose();
  };

  const handleClearCount = () => {
    onClear();
    sheetRef.current?.dismiss();
    onClose();
  };

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.45} />
    ),
    [],
  );

  const fmt = (n: number) => `${master.symbol}${Math.round(n).toLocaleString('en-IN')}`;
  const diffColor = matched
    ? COLORS.positive
    : diff > 0
      ? COLORS.brandPrimary
      : COLORS.negative;

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: COLORS.borderDefault }}
      backgroundStyle={{ backgroundColor: COLORS.cardBg }}
    >
      <View style={[s.sticky, { paddingTop: 4 }]}>
        <View style={s.titleRow}>
          <Text style={s.title}>Cash Count</Text>
          <TouchableOpacity onPress={() => { sheetRef.current?.dismiss(); onClose(); }} hitSlop={8}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={s.metrics}>
          <View style={s.metric}>
            <Text style={s.metricL}>Target</Text>
            <Text style={s.metricV}>{fmt(targetAmount || 0)}</Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricL}>Counted</Text>
            <Text style={[s.metricV, matched && { color: COLORS.positive }]}>{fmt(counted)}</Text>
          </View>
          <View style={s.metric}>
            <Text style={s.metricL}>Difference</Text>
            <Text style={[s.metricV, { color: diffColor }]}>
              {diff > 0 ? '+' : ''}{fmt(diff)}
            </Text>
          </View>
        </View>
        {!matched && (targetAmount || 0) > 0 && (
          <Text style={s.gateHint}>
            Counted must match target to apply. Fix with − / + or Auto Split.
          </Text>
        )}
        <View style={s.actions}>
          <TouchableOpacity style={s.chip} onPress={handleAutoSplit} activeOpacity={0.8}>
            <Ionicons name="flash-outline" size={14} color={COLORS.brandPrimary} />
            <Text style={s.chipTxt}>Auto Split</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.chip} onPress={handleClear} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={14} color={COLORS.textSecondary} />
            <Text style={[s.chipTxt, { color: COLORS.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.chip} onPress={handleUseLast} activeOpacity={0.8}>
            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
            <Text style={[s.chipTxt, { color: COLORS.textSecondary }]}>Use Last</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {master.notes.map((face) => {
          const qty = parseInt(String(counts[String(face)] || 0), 10) || 0;
          const line = face * qty;
          return (
            <View key={face} style={s.noteCard}>
              <View style={s.noteLeft}>
                <Text style={s.noteFace}>{master.symbol}{face.toLocaleString('en-IN')}</Text>
                <Text style={s.noteLine}>{qty > 0 ? `= ${fmt(line)}` : '—'}</Text>
              </View>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={() => bump(face, -1)} activeOpacity={0.7}>
                  <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <TextInput
                  style={s.qtyInput}
                  value={String(qty)}
                  onChangeText={(t) => setQty(face, parseInt(t.replace(/\D/g, ''), 10) || 0)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
                <TouchableOpacity style={s.stepBtn} onPress={() => bump(face, 1)} activeOpacity={0.7}>
                  <Ionicons name="add" size={18} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </BottomSheetScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={s.clearBtn} onPress={handleClearCount} activeOpacity={0.8}>
          <Text style={s.clearBtnTxt}>Clear Count</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.applyBtn, !matched && s.applyDisabled]}
          onPress={handleApply}
          disabled={!matched}
          activeOpacity={0.85}
        >
          <Text style={s.applyTxt}>{matched ? 'Apply Count' : 'Match Required'}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}

const s = StyleSheet.create({
  sticky: {
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    gap: 10,
    paddingBottom: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingVertical: 10,
    paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center',
  },
  metricL: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 4 },
  metricV: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  gateHint: { fontSize: 12, color: COLORS.negative, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  chipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.brandPrimary },
  scroll: { paddingHorizontal: SPACING.md, paddingTop: 12, gap: 10 },
  noteCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, paddingHorizontal: 14, paddingVertical: 12,
  },
  noteLeft: { gap: 2 },
  noteFace: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  noteLine: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '500' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center',
  },
  qtyInput: {
    width: 48, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.textPrimary, paddingVertical: 6, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  footer: {
    flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.md, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  clearBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  clearBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    flex: 1.4, alignItems: 'center', justifyContent: 'center', paddingVertical: 14,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
  },
  applyDisabled: { opacity: 0.45 },
  applyTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
});
