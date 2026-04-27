/**
 * FilterBottomSheet — Reusable generic filter bottom sheet shell.
 *
 * Provides the visual wrapper (overlay, handle, title row, footer buttons)
 * while the caller passes filter-specific content as children.
 *
 * Usage:
 *   <FilterBottomSheet
 *     visible={showFilter}
 *     onClose={() => setShowFilter(false)}
 *     title="Filter"
 *     activeCount={2}          // badge on header (optional)
 *     onClear={() => clearAll()}
 *     onApply={() => applyAndClose()}
 *     applyLabel="Apply filters"
 *   >
 *     <MyFilterOptions ... />
 *   </FilterBottomSheet>
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

const SCREEN_H = Dimensions.get('window').height;

interface FilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Number of currently active filters — shows badge on "Clear All" */
  activeCount?: number;
  onClear?: () => void;
  onApply: () => void;
  applyLabel?: string;
  cancelLabel?: string;
  /** Content between the title row and the footer buttons */
  children: React.ReactNode;
  /** Height as a fraction of screen height (default 0.72) */
  heightFraction?: number;
}

export default function FilterBottomSheet({
  visible,
  onClose,
  title = 'Filter',
  activeCount = 0,
  onClear,
  onApply,
  applyLabel = 'Apply Filters',
  cancelLabel = 'Cancel',
  children,
  heightFraction = 0.72,
}: FilterBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetH = SCREEN_H * heightFraction;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to close */}
      <TouchableOpacity
        style={s.overlay}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={[s.sheet, { height: sheetH, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Title row */}
        <View style={s.titleRow}>
          <Text style={s.title}>{title}</Text>
          {onClear && (
            <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
              <Text style={s.clearTxt}>
                {activeCount > 0 ? `Clear All (${activeCount})` : 'Clear All'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={s.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.cancelTxt}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.applyBtn}
            onPress={() => { onApply(); onClose(); }}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
            <Text style={s.applyTxt}>{applyLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Small helper components reusable inside the sheet ──────────────────────────

/** Radio option row — single select */
export function FilterRadioRow({
  label, selected, onPress,
}: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={ro.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[ro.radio, selected && ro.radioActive]}>
        {selected && <View style={ro.radioDot} />}
      </View>
      <Text style={[ro.label, selected && ro.labelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Chip group — single or multi select */
export function FilterChipGroup({
  label,
  options,
  selected,
  multi = false,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  multi?: boolean;
  onSelect: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (multi) {
      onSelect(
        selected.includes(id)
          ? selected.filter(s => s !== id)
          : [...selected, id]
      );
    } else {
      onSelect(selected.includes(id) ? [] : [id]);
    }
  };

  return (
    <View style={cg.section}>
      <Text style={cg.label}>{label}</Text>
      <View style={cg.chips}>
        {options.map(opt => {
          const active = selected.includes(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              style={[cg.chip, active && cg.chipActive]}
              onPress={() => toggle(opt.id)}
              activeOpacity={0.7}
            >
              <Text style={[cg.chipTxt, active && cg.chipTxtActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  title: {
    fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary,
  },
  clearTxt: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary,
  },
  body: { flex: 1 },
  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.borderDefault,
    alignItems: 'center',
  },
  cancelTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  applyBtn: {
    flex: 2, flexDirection: 'row', gap: 6, paddingVertical: 14,
    borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  applyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const ro = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    gap: 12,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.brandPrimary },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.brandPrimary,
  },
  label: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  labelActive: { color: COLORS.brandPrimary, fontWeight: '700' },
});

const cg = StyleSheet.create({
  section: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, gap: 10 },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: SPACING.sm },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white, fontWeight: '700' },
});
