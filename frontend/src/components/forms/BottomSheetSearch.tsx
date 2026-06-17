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
}

export default function BottomSheetSearch({
  label, required, placeholder, value, options, onSelect, onClear,
  onAddNew, addNewLabel, sheetTitle, searchPlaceholder,
  icon, containerStyle, triggerStyle, disabled, compact,
}: Props) {
  const [query, setQuery] = useState('');
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  // 60% default, 90% when keyboard is open
  const snapPoints = useMemo(() => ['60%', '90%'], []);

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
    sheetRef.current?.present();
  }, [disabled]);

  const handleClose = useCallback(() => {
    setQuery('');
    sheetRef.current?.dismiss();
  }, []);

  const handleSelect = useCallback((opt: BSSOption) => {
    onSelect(opt);
    handleClose();
  }, [onSelect, handleClose]);

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

        {/* Search input — BottomSheetTextInput handles keyboard automatically */}
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

        {/* Options list — BottomSheetFlatList handles scroll inside sheet */}
        <BottomSheetFlatList
          data={filtered}
          keyExtractor={(item, idx) => item.value || String(idx)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="search-outline" size={20} color={COLORS.textTertiary} />
              <Text style={s.emptyTxt}>
                {query ? `No results for "${query}"` : 'No options available'}
              </Text>
            </View>
          }
          ListFooterComponent={
            onAddNew ? (
              <TouchableOpacity
                style={s.addNewRow}
                onPress={() => { handleClose(); onAddNew!(); }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={s.addNewTxt}>{addNewLabel || 'Add New'}</Text>
              </TouchableOpacity>
            ) : null
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                s.optRow,
                index === filtered.length - 1 && !onAddNew && { borderBottomWidth: 0 },
                item.value === value && s.optRowActive,
              ]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.optLabel, item.value === value && s.optLabelActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.subtitle ? (
                  <Text style={s.optSub} numberOfLines={1}>{item.subtitle}</Text>
                ) : null}
              </View>
              {item.value === value && (
                <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />
              )}
            </TouchableOpacity>
          )}
        />
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

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: SPACING.md, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 8,
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

  // Add New footer
  addNewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderTopWidth: 1.5, borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  addNewTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
});
