/**
 * Shared filter chrome for Sales / Purchase / Expense **Register** screens
 * (Ledger-style funnel + removable chips). Homes no longer use multi doc-type filters.
 *
 * Sales/Purchase: Type multi-select + Party Group tab (ledgers.parent of party).
 * Expenses: Type is radio All / Direct / Indirect (empty = All) + Category multi (ledger parents).
 *   Multi-check on Type was a UX trap: tapping Indirect after Direct selected BOTH → treated as All.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import FilterBottomSheet, { FilterCheckRow, FilterRadioRow } from './FilterBottomSheet';

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

/** Classify API row → doc_type id (mirrors backend classifySales/PurchaseDocType). */
export function classifyVoucherDocType(
  module: 'sales' | 'purchase',
  row: { doc_type?: string; voucher_type?: string; is_optional?: boolean },
): string {
  if (row.doc_type) return String(row.doc_type);
  const vt = String(row.voucher_type || '');
  if (module === 'purchase') {
    if (/debit\s*note/i.test(vt)) return 'debit_note';
    if (/purchase\s*order/i.test(vt)) return 'order';
    return 'invoice';
  }
  if (/quotation/i.test(vt)) return 'quotation';
  if (/credit\s*note/i.test(vt)) return 'credit_note';
  if (/delivery\s*note/i.test(vt)) return 'delivery_note';
  if (/sales\s*order/i.test(vt)) return 'order';
  if (row.is_optional) return 'proforma';
  return 'invoice';
}

/** List-row badge colors — aligned with DocumentPreview / DOC_TYPE_CONFIG. */
const VOUCHER_TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  sales_invoice:    { label: 'Sales Invoice',    color: '#2D7D46', bg: '#E8F5E9' },
  purchase_invoice: { label: 'Purchase Invoice', color: '#4527A0', bg: '#EDE7F6' },
  sales_order:      { label: 'Sales Order',      color: '#1565C0', bg: '#E3F2FD' },
  purchase_order:   { label: 'Purchase Order',   color: '#1B5E20', bg: '#E8F5E9' },
  credit_note:      { label: 'Credit Note',      color: '#EF6C00', bg: '#FFF3E0' },
  debit_note:       { label: 'Debit Note',       color: '#C62828', bg: '#FFEBEE' },
  delivery_note:    { label: 'Delivery Note',    color: '#00838F', bg: '#E0F7FA' },
  proforma_invoice: { label: 'Proforma',         color: '#1A1A1A', bg: '#F5F4EF' },
  quotation:        { label: 'Quotation',        color: '#1565C0', bg: '#E3F2FD' },
};

export type VoucherTypeBadgeInfo = { label: string; color: string; bg: string; docType: string };

/** Resolve short voucher-kind badge from doc_type / voucher_type / is_optional. */
export function resolveVoucherTypeBadge(
  module: 'sales' | 'purchase',
  row: { docType?: string; doc_type?: string; voucher_type?: string; is_optional?: boolean },
): VoucherTypeBadgeInfo {
  const docType = row.docType || classifyVoucherDocType(module, row);
  const routeKey = docTypeToRouteType(docType, module);
  const cfg = VOUCHER_TYPE_BADGE[routeKey] || {
    label: DOC_TYPE_LABEL[docType] || 'Voucher',
    color: COLORS.textSecondary,
    bg: COLORS.pageBg,
  };
  return { ...cfg, docType };
}

/** Compact list badge — My Entries / audit-trail pill language (small uppercase tag). */
export function VoucherTypeBadge({
  module,
  docType,
  voucher_type,
  is_optional,
  label: labelOverride,
}: {
  module: 'sales' | 'purchase';
  docType?: string;
  voucher_type?: string;
  is_optional?: boolean;
  label?: string;
}) {
  const info = resolveVoucherTypeBadge(module, { docType, voucher_type, is_optional });
  const label = labelOverride || info.label;
  return (
    <View style={[vtBadge.badge, { backgroundColor: info.bg, borderColor: info.color + '66' }]}>
      <Text style={[vtBadge.txt, { color: info.color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const vtBadge = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: 120,
  },
  txt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});

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

/** Normalize legacy multi-select → radio (empty / single). Both selected ⇒ All. */
function normalizeExpenseTypeRadio(types: ExpenseTypeId[]): ExpenseTypeId | 'All' {
  const uniq = [...new Set(types.filter((t) => t === 'Direct' || t === 'Indirect'))];
  if (uniq.length === 1) return uniq[0];
  return 'All';
}

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
  /** Empty = All. At most one of Direct | Indirect (radio). */
  activeTypes: ExpenseTypeId[];
  activeCategories: string[];
  typeCounts: { all: number; direct: number; indirect: number };
  categories: { name: string; count: number }[];
  onApply: (types: ExpenseTypeId[], categories: string[]) => void;
}) {
  const [tab, setTab] = useState<'Type' | 'Category'>('Type');
  const [localType, setLocalType] = useState<'All' | ExpenseTypeId>(() => normalizeExpenseTypeRadio(activeTypes));
  const [localCats, setLocalCats] = useState<string[]>(activeCategories);
  const [catSearch, setCatSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setLocalType(normalizeExpenseTypeRadio(activeTypes));
      setLocalCats(activeCategories);
      setCatSearch('');
      setTab('Type');
    }
  }, [visible, activeTypes, activeCategories]);

  const activeCount = (localType === 'All' ? 0 : 1) + localCats.length;

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const toggleCat = (name: string) => {
    setLocalCats((prev) => (
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    ));
  };

  const handleApply = () => {
    const nextTypes: ExpenseTypeId[] = localType === 'All' ? [] : [localType];
    onApply(nextTypes, localCats);
    onClose();
    const parts: string[] = [];
    if (nextTypes.length) parts.push(nextTypes[0]);
    if (localCats.length) parts.push(...localCats);
    notifyFiltersApplied(parts);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Expenses"
      activeCount={activeCount}
      onClear={() => { setLocalType('All'); setLocalCats([]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
      heightFraction={0.68}
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
          <FilterRadioRow
            label="All"
            count={typeCounts.all}
            selected={localType === 'All'}
            onPress={() => setLocalType('All')}
          />
          <FilterRadioRow
            label="Direct"
            count={typeCounts.direct}
            selected={localType === 'Direct'}
            onPress={() => setLocalType('Direct')}
          />
          <FilterRadioRow
            label="Indirect"
            count={typeCounts.indirect}
            selected={localType === 'Indirect'}
            onPress={() => setLocalType('Indirect')}
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
