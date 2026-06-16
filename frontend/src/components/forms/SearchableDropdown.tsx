import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  ScrollView, Platform, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// ─── Styles (declared before component so they're available) ─────────────────
const s = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  trigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12, minHeight: 48, paddingVertical: 10,
  },
  triggerSelected: { borderColor: COLORS.borderDefault },
  triggerTxt: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  triggerPlh: { color: COLORS.textTertiary, fontWeight: '400' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  sheetTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.md, marginVertical: 12, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44, borderWidth: 1, borderColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  optTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  optTxtActive: { fontWeight: '700', color: COLORS.brandPrimary },
  emptyRow: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  addNewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 16, borderTopWidth: 1.5, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  addNewTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 48 },
  inputBoxFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  inputBoxOpen: { borderColor: COLORS.brandPrimary },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 10 },
  dropList: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
  addNewText: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.brandPrimary },
});

export const sd = s;

export default function SearchableDropdown({
  label, required, placeholder, options, value,
  onSelect, onAddNew, addNewLabel, containerStyle, icon = 'search',
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery]         = useState('');

  const selectedLabel = options.find(o => o.value === value)?.label;
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const webFix = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

  const handleSelect = (opt: SDOption) => {
    onSelect(opt);
    setQuery('');
    setModalOpen(false);
  };

  return (
    <View style={[s.wrap, containerStyle]}>
      <Text style={s.label}>
        {label}{required ? <Text style={s.star}> *</Text> : null}
      </Text>

      {/* Trigger Button */}
      <TouchableOpacity
        style={[s.trigger, value ? s.triggerSelected : null]}
        onPress={() => setModalOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={icon as any}
          size={15}
          color={value ? COLORS.textSecondary : COLORS.textTertiary}
          style={{ marginRight: 6 }}
        />
        <Text
          style={[s.triggerTxt, !value && s.triggerPlh]}
          numberOfLines={1}
        >
          {selectedLabel || placeholder || 'Select...'}
        </Text>
        {value ? (
          <TouchableOpacity
            onPress={() => onSelect({ label: '', value: '' })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 4 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : null}
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Modal Picker */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={s.backdrop}>
          <TouchableOpacity
            style={{flex:1}}
            activeOpacity={1}
            onPress={() => { setQuery(''); setModalOpen(false); }}
          />
          <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{label}</Text>
            <TouchableOpacity
              onPress={() => { setQuery(''); setModalOpen(false); }}
              style={s.closeBtn}
            >
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={s.searchRow}>
            <Ionicons name="search" size={16} color={COLORS.textTertiary} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.searchInput, webFix]}
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${label.toLowerCase()}...`}
              placeholderTextColor={COLORS.textTertiary}
              autoFocus
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {filtered.map((opt, idx) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  s.optRow,
                  idx === filtered.length - 1 && !onAddNew && { borderBottomWidth: 0 },
                ]}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.7}
              >
                <Text style={[s.optTxt, value === opt.value && s.optTxtActive]}>
                  {opt.label}
                </Text>
                {value === opt.value && (
                  <Ionicons name="checkmark" size={18} color={COLORS.brandPrimary} />
                )}
              </TouchableOpacity>
            ))}
            {filtered.length === 0 && (
              <View style={s.emptyRow}>
                <Ionicons name="search-outline" size={24} color={COLORS.textTertiary} />
                <Text style={s.emptyTxt}>No results for "{query}"</Text>
              </View>
            )}
          </ScrollView>

          {/* Add New */}
          {onAddNew && (
            <TouchableOpacity
              style={s.addNewRow}
              onPress={() => { onAddNew(); setModalOpen(false); }}
              activeOpacity={0.7}
            >
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