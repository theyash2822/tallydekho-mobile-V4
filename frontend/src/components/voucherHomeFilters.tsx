/**
 * Shared filter chrome for Sales / Purchase / Expense **Register** screens
 * (Ledger-style funnel + removable chips). Homes no longer use multi doc-type filters.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import FilterBottomSheet, { FilterRadioRow } from './FilterBottomSheet';

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

// ── Doc-type filter modal (Sales / Purchase Register) ─────────────────────────

type DocOption = { id: string; label: string };

export function DocTypeFilterModal({
  visible,
  onClose,
  title,
  options,
  selectedId,
  counts,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: readonly DocOption[];
  selectedId: string;
  counts: Record<string, number>;
  onApply: (id: string) => void;
}) {
  const [localId, setLocalId] = useState(selectedId);

  useEffect(() => {
    if (visible) setLocalId(selectedId);
  }, [visible, selectedId]);

  const activeCount = localId !== 'all' ? 1 : 0;
  const allCount = counts.all ?? options.reduce((s, o) => s + (counts[o.id] || 0), 0);

  const handleApply = () => {
    onApply(localId);
    onClose();
    const label = localId === 'all'
      ? ''
      : (options.find((o) => o.id === localId)?.label || localId);
    notifyFiltersApplied(label ? [label] : []);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      activeCount={activeCount}
      onClear={() => setLocalId('all')}
      onApply={handleApply}
      applyLabel="Apply Filters"
      heightFraction={0.62}
    >
      <View style={fm.tabs}>
        <View style={[fm.tab, fm.tabActive]}>
          <Text style={[fm.tabTxt, fm.tabTxtActive]}>Type</Text>
        </View>
      </View>
      <FilterRadioRow
        label="All"
        count={allCount}
        selected={localId === 'all'}
        onPress={() => setLocalId('all')}
      />
      {options.map((opt) => (
        <FilterRadioRow
          key={opt.id}
          label={opt.label}
          count={counts[opt.id] ?? 0}
          selected={localId === opt.id}
          onPress={() => setLocalId(localId === opt.id ? 'all' : opt.id)}
        />
      ))}
    </FilterBottomSheet>
  );
}

// ── Expense register filter (Type + Category tabs) ────────────────────────────

export type ExpenseTypeFilter = 'All' | 'Direct' | 'Indirect';

export function ExpenseRegisterFilterModal({
  visible,
  onClose,
  activeType,
  activeCategory,
  typeCounts,
  categories,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  activeType: ExpenseTypeFilter;
  activeCategory: string;
  typeCounts: { all: number; direct: number; indirect: number };
  categories: { name: string; count: number }[];
  onApply: (type: ExpenseTypeFilter, category: string) => void;
}) {
  const [tab, setTab] = useState<'Type' | 'Category'>('Type');
  const [localType, setLocalType] = useState<ExpenseTypeFilter>(activeType);
  const [localCat, setLocalCat] = useState(activeCategory);
  const [catSearch, setCatSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setLocalType(activeType);
      setLocalCat(activeCategory);
      setCatSearch('');
      setTab('Type');
    }
  }, [visible, activeType, activeCategory]);

  const activeCount = (localType !== 'All' ? 1 : 0) + (localCat ? 1 : 0);

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const handleApply = () => {
    onApply(localType, localCat);
    onClose();
    const parts: string[] = [];
    if (localType !== 'All') parts.push(localType);
    if (localCat) parts.push(localCat);
    notifyFiltersApplied(parts);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Expenses"
      activeCount={activeCount}
      onClear={() => { setLocalType('All'); setLocalCat(''); }}
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
          {([
            { id: 'All' as const, count: typeCounts.all },
            { id: 'Direct' as const, count: typeCounts.direct },
            { id: 'Indirect' as const, count: typeCounts.indirect },
          ]).map((opt) => (
            <FilterRadioRow
              key={opt.id}
              label={opt.id}
              count={opt.count}
              selected={localType === opt.id}
              onPress={() => setLocalType(localType === opt.id && opt.id !== 'All' ? 'All' : opt.id)}
            />
          ))}
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
          <FilterRadioRow
            label="All categories"
            selected={!localCat}
            onPress={() => setLocalCat('')}
          />
          {filteredCats.length === 0 ? (
            <Text style={fm.groupHint}>No categories in this date range</Text>
          ) : (
            filteredCats.map((c) => (
              <FilterRadioRow
                key={c.name}
                label={c.name}
                count={c.count}
                selected={localCat === c.name}
                onPress={() => setLocalCat(localCat === c.name ? '' : c.name)}
              />
            ))
          )}
        </View>
      )}
    </FilterBottomSheet>
  );
}

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
