import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
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
  icon?: string;
}

export default function SearchableDropdown({
  label, required, placeholder, options, value,
  onSelect, onAddNew, addNewLabel, containerStyle,
}: Props) {
  const [query, setQuery]     = useState('');
  const [open, setOpen]       = useState(false);
  const selectionPending      = useRef(false);
  const webFix = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  // While open → show whatever the user typed; when closed → show selected label
  const inputDisplay = open ? query : selectedLabel;

  // Filter: if query has text, match anywhere (case-insensitive); else show all
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  /* ── Handlers ── */
  const handleFocus = () => {
    setQuery('');   // fresh search on every open
    setOpen(true);
  };

  const handleBlur = () => {
    // Slight delay so onPressIn on a suggestion fires before we close
    setTimeout(() => {
      if (!selectionPending.current) setOpen(false);
      selectionPending.current = false;
    }, 150);
  };

  const handleSelect = (opt: SDOption) => {
    selectionPending.current = false;
    onSelect(opt);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect({ label: '', value: '' });
    setQuery('');
    setOpen(false);
  };

  const handleAddNew = () => {
    selectionPending.current = false;
    setOpen(false);
    onAddNew?.();
  };

  return (
    <View style={[s.wrap, containerStyle]}>
      {/* Label */}
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.star}> *</Text> : null}
      </Text>

      {/* Search Input */}
      <View style={[s.inputBox, open && s.inputBoxOpen]}>
        <Ionicons
          name="search"
          size={15}
          color={open ? COLORS.brandPrimary : COLORS.textTertiary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={[s.input, webFix]}
          value={inputDisplay}
          onChangeText={setQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || `Search ${label.toLowerCase()}...`}
          placeholderTextColor={COLORS.textTertiary}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {value ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={17} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={COLORS.textSecondary}
          />
        )}
      </View>

      {/* Inline Predictive Suggestions */}
      {open && (
        <View style={s.suggestions}>
          <ScrollView
            style={{ maxHeight: 210 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {filtered.length === 0 ? (
              <View style={s.emptyRow}>
                <Ionicons name="search-outline" size={20} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>
                  {query ? `No results for "${query}"` : 'No options available'}
                </Text>
              </View>
            ) : (
              filtered.map((opt, idx) => (
                <TouchableOpacity
                  key={opt.value || String(idx)}
                  style={[
                    s.optRow,
                    idx === filtered.length - 1 && !onAddNew && { borderBottomWidth: 0 },
                    value === opt.value && s.optRowActive,
                  ]}
                  onPressIn={() => { selectionPending.current = true; }}
                  onPress={() => handleSelect(opt)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[s.optTxt, value === opt.value && s.optTxtActive]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {value === opt.value && (
                    <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Add New button at the bottom of suggestions */}
          {onAddNew && (
            <TouchableOpacity
              style={s.addNewRow}
              onPressIn={() => { selectionPending.current = true; }}
              onPress={handleAddNew}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color={COLORS.brandPrimary} />
              <Text style={s.addNewTxt}>{addNewLabel || 'Add New'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },

  label: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  star: { color: COLORS.negative },

  /* Input field */
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputBoxOpen: {
    borderColor: COLORS.brandPrimary,
    borderWidth: 1.5,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    paddingVertical: 10,
  },

  /* Suggestions panel */
  suggestions: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1.5,
    borderColor: COLORS.brandPrimary,
    borderTopWidth: 0,
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
    // Android elevation so it appears above sibling views
    elevation: 8,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 999,
  },

  /* Option rows */
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  optRowActive: {
    backgroundColor: COLORS.pageBg,
  },
  optTxt: {
    flex: 1,
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  optTxtActive: {
    fontWeight: '700',
    color: COLORS.brandPrimary,
  },

  /* Empty state */
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 20,
  },
  emptyTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textTertiary,
  },

  /* Add New */
  addNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  addNewTxt: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '700',
    color: COLORS.brandPrimary,
  },
});

// Keep named export for backward compat
export const sd = s;
