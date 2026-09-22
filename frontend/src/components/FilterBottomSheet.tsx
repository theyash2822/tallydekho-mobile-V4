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
  /** When true, Apply is muted and does nothing (e.g. need ≥1 selection). */
  applyDisabled?: boolean;
  /** Content between the title row and the footer buttons */
  children: React.ReactNode;
  /** Height as a fraction of screen height (default 0.72) */
  heightFraction?: number;
  /** Hide Cancel/Apply footer (e.g. pickers that close on row tap). */
  hideFooter?: boolean;
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
  applyDisabled = false,
  children,
  heightFraction = 0.72,
  hideFooter = false,
}: FilterBottomSheetProps) {
  const insets = useSafeAreaInsets();
  // Dynamic max height — never more than 72% of screen, never less than 30%
  const sheetH = Math.min(SCREEN_H * heightFraction, SCREEN_H * 0.72);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.root}>
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
          {!hideFooter && (
            <View style={s.footer}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={s.cancelTxt}>{cancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.applyBtn, applyDisabled && s.applyBtnDisabled]}
                onPress={() => { if (!applyDisabled) onApply(); }}
                activeOpacity={applyDisabled ? 1 : 0.85}
                disabled={applyDisabled}
              >
                <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                <Text style={s.applyTxt}>{applyLabel}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Small helper components reusable inside the sheet ──────────────────────────

/** Radio option row — single select. Optional trailing count (e.g. "Credit Note  90"). */
export function FilterRadioRow({
  label, count, selected, onPress,
}: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const display = count != null ? `${label}  ${count}` : label;
  return (
    <TouchableOpacity style={ro.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[ro.radio, selected && ro.radioActive]}>
        {selected && <View style={ro.radioDot} />}
      </View>
      <Text style={[ro.label, selected && ro.labelActive]}>{display}</Text>
    </TouchableOpacity>
  );
}

/** Checkbox option row — multi select. Optional trailing count (e.g. "Credit Note  90"). */
export function FilterCheckRow({
  label, count, selected, onPress,
}: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const display = count != null ? `${label}  ${count}` : label;
  return (
    <TouchableOpacity style={ro.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[ro.check, selected && ro.checkActive]}>
        {selected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
      </View>
      <Text style={[ro.label, selected && ro.labelActive]}>{display}</Text>
    </TouchableOpacity>
  );
}

/**
 * Multi-check R2 model (unified):
 * - Explicit ids only. [] = nothing selected (invalid for Apply).
 * - All selected = every id in selected[] (parent may still store [] after Apply = no filter).
 * - Tap All: select all ↔ clear all in one click.
 * - Individual rows toggle freely (can reach 0).
 * - Apply disabled while any list with options has 0 selected.
 */
export function isFilterAllSelected(selected: string[], allIds: string[]): boolean {
  if (allIds.length === 0) return true;
  return selected.length === allIds.length && allIds.every((id) => selected.includes(id));
}

export function isFilterOptionChecked(
  selected: string[],
  id: string,
  _allIds?: string[],
): boolean {
  return selected.includes(id);
}

/** Toggle one id; allows empty selection. */
export function toggleFilterFromAll(
  prev: string[],
  id: string,
  _allIds?: string[],
): string[] {
  return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
}

/** Tap All: if all selected → clear; else → select all. */
export function toggleFilterAll(prev: string[], allIds: string[]): string[] {
  if (allIds.length === 0) return [];
  return isFilterAllSelected(prev, allIds) ? [] : [...allIds];
}

/** Parent stored [] (= no filter) → expand to full ids for the sheet UI. */
export function hydrateFilterSelection(stored: string[], allIds: string[]): string[] {
  if (allIds.length === 0) return [];
  if (stored.length === 0) return [...allIds];
  return stored.filter((id) => allIds.includes(id));
}

/**
 * Seed local multi-check state when a filter sheet opens.
 * - Runs once per open (visible false→true).
 * - If option ids appear later (async) and local is still empty while parent means All,
 *   fills to all ids once — does not wipe in-progress toggles.
 */
export function useMultiFilterHydration(
  visible: boolean,
  stored: string[],
  allIds: string[],
  setLocal: (next: string[]) => void,
) {
  const wasVisibleRef = React.useRef(false);
  const prevIdsLenRef = React.useRef(0);
  const idsKey = allIds.join('\u0001');
  const storedKey = stored.join('\u0001');

  React.useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      prevIdsLenRef.current = 0;
      return;
    }
    const opening = !wasVisibleRef.current;
    wasVisibleRef.current = true;
    const storedNow = storedKey.length ? storedKey.split('\u0001') : [];
    const idsNow = idsKey.length ? idsKey.split('\u0001') : [];

    if (opening) {
      setLocal(hydrateFilterSelection(storedNow, idsNow));
      prevIdsLenRef.current = idsNow.length;
      return;
    }

    // Options arrived after open (e.g. groups loaded) — seed once if still empty + parent is All
    if (prevIdsLenRef.current === 0 && idsNow.length > 0 && storedNow.length === 0) {
      setLocal(hydrateFilterSelection([], idsNow));
    }
    prevIdsLenRef.current = idsNow.length;
  }, [visible, idsKey, storedKey, setLocal]);
}

/** True when this list can be applied (≥1, or no options). */
export function isFilterSelectionValid(selected: string[], allIds: string[]): boolean {
  if (allIds.length === 0) return true;
  return selected.length > 0;
}

/** On Apply: full set or empty → [] (no narrowing). Partial → keep explicit ids. */
export function normalizeFilterAllSelection(selected: string[], allIds: string[]): string[] {
  if (selected.length === 0) return [];
  return isFilterAllSelected(selected, allIds) ? [] : [...selected];
}

/** True when selection narrows the list (not empty-All and not every option). */
export function isFilterNarrowing(selected: string[], allIds: string[]): boolean {
  if (!selected.length) return false;
  if (!allIds.length) return false;
  return !isFilterAllSelected(selected, allIds);
}

/** Match helper — value must belong to selected when narrowing. */
export function matchesFilterSelection(
  selected: string[],
  allIds: string[],
  value: string,
  equals: (selectedId: string, value: string) => boolean = (a, b) => a === b,
): boolean {
  if (!isFilterNarrowing(selected, allIds)) return true;
  const v = String(value || '');
  return selected.some((id) => equals(id, v));
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
  // Dim on flex root — absoluteFill inside transparent Modal collapses the scrim
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlay: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    width: '100%',
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
  applyBtnDisabled: { opacity: 0.4 },
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
  check: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: {
    borderColor: COLORS.brandPrimary,
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

/** Shared tab/search layout inside FilterBottomSheet — matches Ledger filter modal. */
export const filterSheetContentStyles = StyleSheet.create({
  tabs: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full, borderWidth: 1.5,
    borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  tabActive: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: COLORS.white, fontWeight: '700' },
  panel: { paddingBottom: SPACING.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.pageBg,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  hint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, paddingHorizontal: SPACING.md, paddingVertical: 8 },
});
