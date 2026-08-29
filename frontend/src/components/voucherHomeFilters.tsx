/**
 * Shared filter chrome for Sales / Purchase / Expense **Register** screens
 * (Ledger-style funnel + removable chips). Homes no longer use multi doc-type filters.
 *
 * Sales/Purchase: Type multi-select + Party Group tab (ledgers.parent of party).
 * Expenses: Type multi among Direct/Indirect (empty = All) + Category multi (ledger parents).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import FilterBottomSheet, { FilterCheckRow } from './FilterBottomSheet';

// ── Doc-type catalogs (Register filter sheet) ─────────────────────────────────

export const SALES_DOC_TYPES = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'order', label: 'Order' },
  { id: 'credit_note', label: 'Credit Note' },
  { id: 'delivery_note', label: 'Delivery Note' },
  { id: 'proforma', label: 'Proforma' },
  { id: 'quotation', label: 'Quotation' },
] as const;

export const PURCHASE_DOC_TYPES = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'order', label: 'Order' },
  { id: 'debit_note', label: 'Debit Note' },
] as const;

export type SalesDocTypeId = (typeof SALES_DOC_TYPES)[number]['id'];
export type PurchaseDocTypeId = (typeof PURCHASE_DOC_TYPES)[number]['id'];
export type DocTypeFilterId = 'all' | SalesDocTypeId | PurchaseDocTypeId;

export const ALL_SALES_DOC_TYPE_IDS: SalesDocTypeId[] = SALES_DOC_TYPES.map((d) => d.id);
export const ALL_PURCHASE_DOC_TYPE_IDS: PurchaseDocTypeId[] = PURCHASE_DOC_TYPES.map((d) => d.id);

export const DOC_TYPE_LABEL: Record<string, string> = {
  all: 'All',
  invoice: 'Invoice',
  order: 'Order',
  credit_note: 'Credit Note',
  delivery_note: 'Delivery Note',
  proforma: 'Proforma',
  quotation: 'Quotation',
  debit_note: 'Debit Note',
};

/** Map API doc_type → document preview `type` query param. */
export function docTypeToRouteType(docType: string, module: 'sales' | 'purchase'): string {
  switch (docType) {
    case 'order':
      return module === 'purchase' ? 'purchase_order' : 'sales_order';
    case 'credit_note':
      return 'credit_note';
    case 'debit_note':
      return 'debit_note';
    case 'delivery_note':
      return 'delivery_note';
    case 'proforma':
      return 'proforma_invoice';
    case 'quotation':
      return 'quotation';
    case 'invoice':
    default:
      return module === 'purchase' ? 'purchase_invoice' : 'sales_invoice';
  }
}

export function notifyFiltersApplied(parts: string[]) {
  Toast.show({
    type: 'success',
    text1: parts.length ? 'Filters applied' : 'Filters cleared',
    text2: parts.length ? parts.join(' · ') : 'Showing all',
    visibilityTime: 2000,
  });
}

/** Funnel icon with optional numeric badge (Ledger-style). */
export function FilterIconWithBadge({
  count,
  onPress,
  testID,
}: {
  count: number;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={fi.btn}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="filter" size={20} color={COLORS.textPrimary} />
      {count > 0 && (
        <View style={fi.badge}>
          <Text style={fi.badgeTxt}>{count > 9 ? '9+' : String(count)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Removable chips for active (narrowed) filters. */
export function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: { id: string; label: string }[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
}) {
  if (!chips.length) return null;
  return (
    <View style={fi.chipRowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fi.chipRow}
      >
        {chips.map((c) => (
          <View key={c.id} style={fi.chip}>
            <Text style={fi.chipTxt} numberOfLines={1}>{c.label}</Text>
            <TouchableOpacity
              onPress={() => onRemove(c.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={14} color={COLORS.brandPrimary} />
            </TouchableOpacity>
          </View>
        ))}
        {onClearAll && chips.length > 1 && (
          <TouchableOpacity style={fi.clearChip} onPress={onClearAll} activeOpacity={0.7}>
            <Text style={fi.clearChipTxt}>Clear</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ── Doc-type + Party Group filter modal (Sales / Purchase Register) ───────────

type DocOption = { id: string; label: string };

export function DocTypeFilterModal({
  visible,
  onClose,
  title,
  options,
  selectedIds,
  selectedGroups,
  counts,
  partyGroups,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: readonly DocOption[];
  /** Empty or all option ids → no type narrowing (show all). */
  selectedIds: string[];
  selectedGroups: string[];
  counts: Record<string, number>;
  partyGroups: { name: string; count: number }[];
  onApply: (ids: string[], groups: string[]) => void;
}) {
  const [tab, setTab] = useState<'Type' | 'Group'>('Type');
  const [localIds, setLocalIds] = useState<string[]>(selectedIds);
  const [localGroups, setLocalGroups] = useState<string[]>(selectedGroups);
  const [groupSearch, setGroupSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setLocalIds(selectedIds);
      setLocalGroups(selectedGroups);
      setGroupSearch('');
      setTab('Type');
    }
  }, [visible, selectedIds, selectedGroups]);

  const allOptionIds = options.map((o) => o.id);
  const isAllTypes = localIds.length === 0
    || (localIds.length === allOptionIds.length && allOptionIds.every((id) => localIds.includes(id)));

  const activeCount = (isAllTypes ? 0 : localIds.length) + localGroups.length;
  const allCount = counts.all ?? options.reduce((s, o) => s + (counts[o.id] || 0), 0);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return partyGroups;
    return partyGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [partyGroups, groupSearch]);

  const toggleType = (id: string) => {
    setLocalIds((prev) => {
      // Treat "all selected" / empty as empty baseline so toggling one starts from none
      const base = (prev.length === 0
        || (prev.length === allOptionIds.length && allOptionIds.every((x) => prev.includes(x))))
        ? []
        : prev;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const toggleGroup = (name: string) => {
    setLocalGroups((prev) => (
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    ));
  };

  const handleApply = () => {
    const nextIds = isAllTypes ? [] : localIds;
    onApply(nextIds, localGroups);
    onClose();
    const parts: string[] = [];
    if (nextIds.length) {
      parts.push(
        nextIds.map((id) => options.find((o) => o.id === id)?.label || DOC_TYPE_LABEL[id] || id).join(', ')
      );
    }
    if (localGroups.length) parts.push(...localGroups);
    notifyFiltersApplied(parts);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      activeCount={activeCount}
      onClear={() => { setLocalIds([]); setLocalGroups([]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
      heightFraction={0.68}
    >
      <View style={fm.tabs}>
        {(['Type', 'Group'] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[fm.tab, tab === cat && fm.tabActive]}
            onPress={() => setTab(cat)}
            activeOpacity={0.7}
          >
            <Text style={[fm.tabTxt, tab === cat && fm.tabTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Type' ? (
        <View>
          <FilterCheckRow
            label="All"
            count={allCount}
            selected={isAllTypes}
            onPress={() => setLocalIds([])}
          />
          {options.map((opt) => (
            <FilterCheckRow
              key={opt.id}
              label={opt.label}
              count={counts[opt.id] ?? 0}
              selected={!isAllTypes && localIds.includes(opt.id)}
              onPress={() => toggleType(opt.id)}
            />
          ))}
        </View>
      ) : (
        <View style={fm.groupPanel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              placeholder="Search party group..."
              placeholderTextColor={COLORS.textTertiary}
              value={groupSearch}
              onChangeText={setGroupSearch}
            />
          </View>
          <FilterCheckRow
            label="All groups"
            selected={localGroups.length === 0}
            onPress={() => setLocalGroups([])}
          />
          {filteredGroups.length === 0 ? (
            <Text style={fm.groupHint}>No party groups in this date range</Text>
          ) : (
            filteredGroups.map((g) => (
              <FilterCheckRow
                key={g.name}
                label={g.name}
                count={g.count}
                selected={localGroups.includes(g.name)}
                onPress={() => toggleGroup(g.name)}
              />
            ))
          )}
        </View>
      )}
    </FilterBottomSheet>
  );
}

// ── Expense register filter (Type + Category tabs, both multi) ────────────────

export type ExpenseTypeId = 'Direct' | 'Indirect';

export function ExpenseRegisterFilterModal({
  visible,
  onClose,
  activeTypes,
  activeCategories,
  typeCounts,
  categories,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  /** Empty = All (Direct + Indirect). */
  activeTypes: ExpenseTypeId[];
  activeCategories: string[];
  typeCounts: { all: number; direct: number; indirect: number };
  categories: { name: string; count: number }[];
  onApply: (types: ExpenseTypeId[], categories: string[]) => void;
}) {
  const [tab, setTab] = useState<'Type' | 'Category'>('Type');
  const [localTypes, setLocalTypes] = useState<ExpenseTypeId[]>(activeTypes);
  const [localCats, setLocalCats] = useState<string[]>(activeCategories);
  const [catSearch, setCatSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setLocalTypes(activeTypes);
      setLocalCats(activeCategories);
      setCatSearch('');
      setTab('Type');
    }
  }, [visible, activeTypes, activeCategories]);

  const isAllTypes = localTypes.length === 0
    || (localTypes.includes('Direct') && localTypes.includes('Indirect'));
  const activeCount = (isAllTypes ? 0 : localTypes.length) + localCats.length;

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const toggleType = (id: ExpenseTypeId) => {
    setLocalTypes((prev) => {
      const base = (prev.length === 0
        || (prev.includes('Direct') && prev.includes('Indirect')))
        ? []
        : prev;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  };

  const toggleCat = (name: string) => {
    setLocalCats((prev) => (
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    ));
  };

  const handleApply = () => {
    const nextTypes: ExpenseTypeId[] = isAllTypes ? [] : localTypes;
    onApply(nextTypes, localCats);
    onClose();
    const parts: string[] = [];
    if (nextTypes.length) parts.push(nextTypes.join(', '));
    if (localCats.length) parts.push(...localCats);
    notifyFiltersApplied(parts);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Expenses"
      activeCount={activeCount}
      onClear={() => { setLocalTypes([]); setLocalCats([]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
    >
      <View style={fm.tabs}>
        {(['Type', 'Category'] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[fm.tab, tab === cat && fm.tabActive]}
            onPress={() => setTab(cat)}
            activeOpacity={0.7}
          >
            <Text style={[fm.tabTxt, tab === cat && fm.tabTxtActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'Type' ? (
        <View>
          <FilterCheckRow
            label="All"
            count={typeCounts.all}
            selected={isAllTypes}
            onPress={() => setLocalTypes([])}
          />
          <FilterCheckRow
            label="Direct"
            count={typeCounts.direct}
            selected={!isAllTypes && localTypes.includes('Direct')}
            onPress={() => toggleType('Direct')}
          />
          <FilterCheckRow
            label="Indirect"
            count={typeCounts.indirect}
            selected={!isAllTypes && localTypes.includes('Indirect')}
            onPress={() => toggleType('Indirect')}
          />
        </View>
      ) : (
        <View style={fm.groupPanel}>
          <View style={fm.searchBox}>
            <Ionicons name="search" size={14} color={COLORS.textTertiary} />
            <TextInput
              style={fm.searchInput}
              placeholder="Search category..."
              placeholderTextColor={COLORS.textTertiary}
              value={catSearch}
              onChangeText={setCatSearch}
            />
          </View>
          <FilterCheckRow
            label="All categories"
            selected={localCats.length === 0}
            onPress={() => setLocalCats([])}
          />
          {filteredCats.length === 0 ? (
            <Text style={fm.groupHint}>No categories in this date range</Text>
          ) : (
            filteredCats.map((c) => (
              <FilterCheckRow
                key={c.name}
                label={c.name}
                count={c.count}
                selected={localCats.includes(c.name)}
                onPress={() => toggleCat(c.name)}
              />
            ))
          )}
        </View>
      )}
    </FilterBottomSheet>
  );
}

/** @deprecated Prefer ExpenseTypeId[]; kept for any stray imports. */
export type ExpenseTypeFilter = 'All' | 'Direct' | 'Indirect';

const fi = StyleSheet.create({
  btn: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: COLORS.white },
  chipRowWrap: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingVertical: 6,
  },
  chipRow: {
    paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.brandPrimary + '14',
    borderWidth: 1, borderColor: COLORS.brandPrimary + '40',
    maxWidth: 180,
  },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.brandPrimary, flexShrink: 1 },
  clearChip: {
    paddingHorizontal: 10, paddingVertical: 5,
  },
  clearChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
});

const fm = StyleSheet.create({
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
  groupPanel: { paddingBottom: SPACING.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginVertical: SPACING.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0,
  },
  groupHint: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary,
  },
});
