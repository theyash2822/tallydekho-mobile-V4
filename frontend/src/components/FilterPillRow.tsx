import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

/** Standard filter strip below register headers. */
export function FilterPillRow({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export type FilterDatePillProps = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
};

export function FilterDatePill({ label, onPress, style }: FilterDatePillProps) {
  return (
    <TouchableOpacity style={[s.datePill, style]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
      <Text style={s.dateTxt} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

export type FilterDropdownPillProps = {
  label: string;
  open: boolean;
  onToggle: () => void;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  style?: ViewStyle;
};

export function FilterDropdownPill({
  label,
  open,
  onToggle,
  options,
  selected,
  onSelect,
  placeholder = 'Status',
  style,
}: FilterDropdownPillProps) {
  const display = selected === 'All' ? placeholder : (label || selected);
  return (
    <View style={[s.dropdownWrap, style]}>
      <TouchableOpacity
        style={[s.statusPill, open && s.statusPillOpen]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={s.statusTxt}>{display}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropMenu}>
          {options.map((opt, idx) => (
            <TouchableOpacity
              key={opt}
              style={[s.dropItem, idx === options.length - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              onPress={() => onSelect(opt)}
            >
              <Text style={[s.dropTxt, selected === opt && s.dropTxtActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
    zIndex: 200,
  },
  datePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  dateTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  dropdownWrap: { flex: 1, position: 'relative' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  statusPillOpen: { borderColor: COLORS.brandPrimary },
  statusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  dropMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    zIndex: 300,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  dropItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  dropTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dropTxtActive: { color: COLORS.brandPrimary, fontWeight: '700' },
});
