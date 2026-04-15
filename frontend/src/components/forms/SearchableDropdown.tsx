import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

export interface SDOption {
  label: string;
  value: string;
}

interface Props {
  label: string;
  required?: boolean;
  placeholder?: string;
  options: SDOption[];
  value: string;
  onSelect: (opt: SDOption) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  containerStyle?: object;
  icon?: string;  // Ionicon name, default 'search'
}

export default function SearchableDropdown({
  label, required, placeholder, options, value,
  onSelect, onAddNew, addNewLabel, containerStyle, icon = 'search',
}: Props) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [focused, setFocused] = useState(false);

  const selectedLabel = options.find(o => o.value === value)?.label;
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const webFix = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

  return (
    <View style={[sd.wrap, containerStyle]}>
      <Text style={sd.label}>
        {label}{required ? <Text style={sd.star}> *</Text> : null}
      </Text>
      <View style={[sd.inputBox, (focused || open) && sd.inputBoxFocused]}>
        <Ionicons name={icon as any} size={14} color={COLORS.textTertiary} style={{ marginRight: 4 }} />
        <TextInput
          style={[sd.input, webFix]}
          placeholder={selectedLabel || placeholder || 'Search...'}
          placeholderTextColor={selectedLabel ? COLORS.textPrimary : COLORS.textTertiary}
          value={open ? query : ''}
          onChangeText={t => { setQuery(t); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); setQuery(''); }}
          onBlur={() => setFocused(false)}
        />
        {value ? (
          <TouchableOpacity
            onPress={() => { onSelect({ label: '', value: '' }); setQuery(''); }}
            hitSlop={{ top:8, bottom:8, left:8, right:8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setOpen(o => !o)} style={{ paddingLeft: 4 }}>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
      {open && (
        <View style={sd.dropList}>
          <ScrollView
            style={{ maxHeight: 200 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {filtered.map((o, idx) => (
              <TouchableOpacity
                key={o.value}
                style={[sd.dropItem, idx === filtered.length - 1 && !onAddNew && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(o); setQuery(''); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[sd.dropText, value === o.value && sd.dropTextActive]}>{o.label}</Text>
                {value === o.value && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <View style={sd.dropItem}>
                <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm }}>No results found</Text>
              </View>
            )}
          </ScrollView>
          {onAddNew && (
            <TouchableOpacity
              style={sd.addNewRow}
              onPress={() => { onAddNew(); setOpen(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color={COLORS.brandPrimary} />
              <Text style={sd.addNewText}>{addNewLabel || 'Add New'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export const sd = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12, minHeight: 48,
  },
  inputBoxFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 10 },
  dropList: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' } as any }),
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
  addNewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  addNewText: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.brandPrimary },
});
