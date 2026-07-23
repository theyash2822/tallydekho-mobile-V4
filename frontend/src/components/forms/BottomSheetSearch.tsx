import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

export interface BSSOption {
  label: string;
  value: string;
  subtitle?: string;
  /** Optional sub-type tag — e.g. 'Cash' | 'Bank' for payment ledger filtering */
  sub?: string;
  /** Arbitrary extra data attached to the option (e.g. gstin, guid) */
  data?: Record<string, any>;
}

interface Props {
  label?: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  options: BSSOption[];
  onSelect: (opt: BSSOption) => void;
  onClear?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  sheetTitle?: string;
  searchPlaceholder?: string;
  icon?: string;
  containerStyle?: ViewStyle;
  triggerStyle?: ViewStyle;
  disabled?: boolean;
  compact?: boolean;
  /** When true, sheet stays open for multi-check; confirm via footer CTA */
  multiSelect?: boolean;
  confirmLabel?: (count: number) => string;
  onMultiConfirm?: (opts: BSSOption[]) => void;
}

export default function BottomSheetSearch({
  label, required, placeholder, value, options, onSelect, onClear,
  onAddNew, addNewLabel, sheetTitle, searchPlaceholder,
  icon, containerStyle, triggerStyle, disabled, compact,
  multiSelect, confirmLabel, onMultiConfirm,
}: Props) {
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  // Always open at 90% — v5 requires enableDynamicSizing={false} to honour snapPoints
  const snapPoints = useMemo(() => ['90%'], []);

  const selected = options.find(o => o.value === value);
  const displayText = selected?.label || '';

  const filtered = query.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.subtitle || '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setQuery('');
    if (multiSelect) setPending(new Set());
    sheetRef.current?.present();
  }, [disabled, multiSelect]);

  const handleClose = useCallback(() => {
    setQuery('');
    if (multiSelect) setPending(new Set());
    sheetRef.current?.dismiss();
  }, [multiSelect]);

  const handleSelect = useCallback((opt: BSSOption) => {
    if (multiSelect) {
      setPending(prev => {
        const next = new Set(prev);
        if (next.has(opt.value)) next.delete(opt.value);
        else next.add(opt.value);
        return next;
      });
      return;
    }
    onSelect(opt);
    handleClose();
  }, [multiSelect, onSelect, handleClose]);

  const handleMultiConfirm = useCallback(() => {
    if (!onMultiConfirm || pending.size === 0) return;
    const picked = options.filter(o => pending.has(o.value));
    onMultiConfirm(picked);
    handleClose();
  }, [onMultiConfirm, pending, options, handleClose]);

  const handleClear = useCallback(() => {
    if (onClear) onClear();
    else onSelect({ label: '', value: '' });
  }, [onClear, onSelect]);

  // Backdrop: tap outside to close
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <View style={[!compact && s.wrap, containerStyle]}>
      {/* Label */}
      {!compact && !!label && (
        <Text style={s.label}>
          {label}{required ? <Text style={s.star}> *</Text> : null}
        </Text>
      )}

      {/* Trigger button */}
      <TouchableOpacity
        style={[compact ? s.compactTrigger : s.trigger, disabled && s.disabled, triggerStyle]}
        onPress={handleOpen}
        activeOpacity={disabled ? 1 : 0.75}
      >
        {icon ? (
          <Ionicons
            name={icon as any}
            size={compact ? 13 : 16}
            color={value ? COLORS.brandPrimary : COLORS.textTertiary}
            style={{ marginRight: 6 }}
          />
        ) : null}
        <Text
          style={[compact ? s.compactTxt : s.triggerTxt, !value && s.ph]}
          numberOfLines={1}
        >
          {displayText || placeholder || (label ? `Select ${label.toLowerCase()}...` : 'Select...')}
        </Text>
        {value ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={compact ? 14 : 17} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={compact ? 13 : 15} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={s.handle}
        topInset={insets.top + 16}
      >
        {/* Header */}
        <View style={s.sheetHdr}>
          <Text style={s.sheetTitle}>{sheetTitle || label || 'Select'}</Text>
          <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search bar — full width */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} style={{ marginRight: 8 }} />
          <BottomSheetTextInput
            style={s.searchInput as any}
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder || `Search ${(sheetTitle || label || '').toLowerCase()}...`}
            placeholderTextColor={COLORS.textTertiary}
            autoFocus={false}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Add New button — always visible, below search bar */}
        {onAddNew && (
          <TouchableOpacity
            style={s.addNewBelowSearch}
            onPress={() => { handleClose(); onAddNew!(); }}
            activeOpacity={0.75}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
            <Text style={s.addNewBelowSearchTxt}>{addNewLabel || 'Add New'}</Text>
          </TouchableOpacity>
        )}

        {/* Options list — BottomSheetFlatList handles scroll inside sheet */}
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(item, idx) => item.value || String(idx)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: multiSelect ? insets.bottom + 80 : insets.bottom + 16,
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={20} color={COLORS.textTertiary} />
              <Text style={s.emptyTxt}>
                {query ? `No results for "${query}"` : 'No options available'}
              </Text>
            </View>
          }
          ListFooterComponent={null}
          renderItem={({ item, index }) => {
            const isActive = multiSelect ? pending.has(item.value) : item.value === value;
            return (
            <TouchableOpacity
              style={[
                s.optRow,
                index === filtered.length - 1 && !onAddNew && !multiSelect && { borderBottomWidth: 0 },
                isActive && s.optRowActive,
              ]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              {multiSelect ? (
                <View style={[s.checkbox, isActive && s.checkboxOn]}>
                  {isActive ? <Ionicons name="checkmark" size={14} color={COLORS.white} /> : null}
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.optLabel, isActive && s.optLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.subtitle ? (
                  <Text style={s.optSub} numberOfLines={1}>{item.subtitle}</Text>
                ) : null}
              </View>
              {!multiSelect && isActive && (
                <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />
              )}
            </TouchableOpacity>
          );}}
        />

        {multiSelect ? (
          <View style={[s.multiFooter, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[s.multiConfirmBtn, pending.size === 0 && s.multiConfirmDisabled]}
              onPress={handleMultiConfirm}
              disabled={pending.size === 0}
              activeOpacity={0.85}
            >
              <Text style={s.multiConfirmTxt}>
                {confirmLabel ? confirmLabel(pending.size) : `Add Selected (${pending.size})`}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },

  trigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  compactTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, minHeight: 36,
  },
  disabled: { opacity: 0.55 },
  triggerTxt: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, marginRight: 6 },
  compactTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, paddingVertical: 6, marginRight: 4 },
  ph: { color: COLORS.textTertiary },

  // Sheet
  sheetBg: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { backgroundColor: COLORS.borderStrong, width: 40, height: 4 },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Search bar
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 0,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 8,
  },
  // Add New — fixed row below search, always visible
  addNewBelowSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginTop: 8,
    backgroundColor: COLORS.brandPrimary + '12',
    borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: COLORS.brandPrimary + '40',
  },
  addNewBelowSearchTxt: {
    fontSize: TYPOGRAPHY.base, fontWeight: '600' as const, color: COLORS.brandPrimary,
  },

  // Options
  optRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  optRowActive: { backgroundColor: COLORS.pageBg },
  optLabel: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  optLabelActive: { fontWeight: '700', color: COLORS.brandPrimary },
  optSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  empty: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: SPACING.md, paddingVertical: 32, justifyContent: 'center',
  },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  checkbox: {
    width: 22, height: 22, borderRadius: 6, marginRight: 12,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  multiFooter: {
    paddingHorizontal: SPACING.md, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  multiConfirmBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center',
  },
  multiConfirmDisabled: { opacity: 0.45 },
  multiConfirmTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },

});
