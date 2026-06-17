import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  FlatList, StyleSheet, ViewStyle,
} from 'react-native';
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const selected = options.find(o => o.value === value);
  const displayText = selected?.label || '';

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleOpen = () => { if (disabled) return; setQuery(''); setOpen(true); };
  const handleClose = () => { setQuery(''); setOpen(false); };
  const handleSelect = (opt: BSSOption) => { onSelect(opt); handleClose(); };
  const handleClear = () => {
    onClear ? onClear() : onSelect({ label: '', value: '' });
  };

  return (
    <View style={[!compact && s.wrap, containerStyle]}>
      {!compact && !!label && (
        <Text style={s.label}>
          {label}{required ? <Text style={s.star}> *</Text> : null}
        </Text>
      )}

      <TouchableOpacity
        style={[compact ? s.compactTrigger : s.trigger, disabled && s.disabled, triggerStyle]}
        onPress={handleOpen}
        activeOpacity={disabled ? 1 : 0.75}
      >
        {icon ? (
          <Ionicons
            name={icon as any} size={compact ? 13 : 16}
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
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={compact ? 14 : 17} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={compact ? 13 : 15} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
        <View style={s.overlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
            <View style={s.handle} />
            <View style={s.sheetHdr}>
              <Text style={s.sheetTitle}>{sheetTitle || label || 'Select'}</Text>
              <TouchableOpacity onPress={handleClose} style={s.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={s.searchWrap}>
              <Ionicons name="search" size={16} color={COLORS.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder || `Search ${(sheetTitle || label || '').toLowerCase()}...`}
                placeholderTextColor={COLORS.textTertiary}
                autoFocus
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item, idx) => item.value || String(idx)}
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="search-outline" size={20} color={COLORS.textTertiary} />
                  <Text style={s.emptyTxt}>
                    {query ? `No results for "${query}"` : 'No options available'}
                  </Text>
                </View>
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
                    <Text style={[s.optLabel, item.value === value && s.optLabelActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.subtitle ? <Text style={s.optSub} numberOfLines={1}>{item.subtitle}</Text> : null}
                  </View>
                  {item.value === value && <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />}
                </TouchableOpacity>
              )}
            />

            {onAddNew && (
              <TouchableOpacity style={s.addNewRow} onPress={() => { handleClose(); onAddNew(); }} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={s.addNewTxt}>{addNewLabel || 'Add New'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '82%',
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 0 },
  sheetHdr: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sheetTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    margin: SPACING.md, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 8 },
  optRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  optRowActive: { backgroundColor: COLORS.pageBg },
  optLabel: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  optLabelActive: { fontWeight: '700', color: COLORS.brandPrimary },
  optSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.md, paddingVertical: 28, justifyContent: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  addNewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderTopWidth: 1.5, borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  addNewTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
});
