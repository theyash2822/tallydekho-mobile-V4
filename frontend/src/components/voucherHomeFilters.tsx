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
import FilterBottomSheet, {
  FilterCheckRow,
  FilterRadioRow,
  isFilterAllSelected,
  isFilterOptionChecked,
  toggleFilterFromAll,
  toggleFilterAll,
  useMultiFilterHydration,
  isFilterSelectionValid,
  normalizeFilterAllSelection,
} from './FilterBottomSheet';

// ── Doc-type catalogs (Register filter sheet) ─────────────────────────────────

export const SALES_DOC_TYPES = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'order', label: 'Order' },
  { id: 'credit_note', label: 'Credit Note' },
  { id: 'delivery_note', label: 'Delivery Note' },
  { id: 'proforma', label: 'Proforma' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'receipt', label: 'Receipt' },
  { id: 'journal', label: 'Journal' },
] as const;

export const PURCHASE_DOC_TYPES = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'order', label: 'Order' },
  { id: 'debit_note', label: 'Debit Note' },
  { id: 'payment', label: 'Payment' },
  { id: 'contra', label: 'Contra' },
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
  receipt: 'Receipt',
  journal: 'Journal',
  payment: 'Payment',
  contra: 'Contra',
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
    case 'receipt':
      return 'receipt_voucher';
    case 'journal':
      return 'journal_voucher';
    case 'payment':
      return 'payment_voucher';
    case 'contra':
      return 'contra_voucher';
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
    if (/payment/i.test(vt)) return 'payment';
    if (/contra/i.test(vt)) return 'contra';
    return 'invoice';
  }
  if (/quotation/i.test(vt)) return 'quotation';
  if (/credit\s*note/i.test(vt)) return 'credit_note';
  if (/delivery\s*note/i.test(vt)) return 'delivery_note';
  if (/sales\s*order/i.test(vt)) return 'order';
  if (/receipt\s*note/i.test(vt)) return 'invoice';
  if (/receipt/i.test(vt)) return 'receipt';
  if (/journal/i.test(vt)) return 'journal';
  if (row.is_optional) return 'proforma';
  return 'invoice';
}

/**
 * Expense register rows are Payment / Journal / Contra (etc.) that debit an
 * expense ledger. Open the matching accounting preview when possible.
 */
export function expenseRowToRouteType(voucherType?: string | null): string {
  const vt = String(voucherType || '');
  if (/journal/i.test(vt)) return 'journal_voucher';
  if (/contra/i.test(vt)) return 'contra_voucher';
  if (/payment/i.test(vt)) return 'payment_voucher';
  if (/receipt/i.test(vt) && !/receipt\s*note/i.test(vt)) return 'receipt_voucher';
  return 'expense_voucher';
}

/** List-row badge colors — theme-aligned; no red / green / black-white; blues ≠ purples. */
const VOUCHER_TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  // Theme info blue — primary sales doc
  sales_invoice:    { label: 'Sales Invoice',    color: '#2563EB', bg: '#EFF6FF' },
  // Warm brand amber (app accent) — not purple
  purchase_invoice: { label: 'Purchase Invoice', color: '#A89060', bg: '#FDF9F4' },
  // Cyan — clearly not blue/purple
  sales_order:      { label: 'Sales Order',      color: '#0891B2', bg: '#ECFEFF' },
  // Warm taupe — theme secondary family
  purchase_order:   { label: 'Purchase Order',   color: '#8B7355', bg: '#F7F3EE' },
  // Theme warning amber
  credit_note:      { label: 'Credit Note',      color: '#D97706', bg: '#FFFBEB' },
  // Soft rose (not traffic red)
  debit_note:       { label: 'Debit Note',       color: '#DB2777', bg: '#FDF2F8' },
  // Teal
  delivery_note:    { label: 'Delivery Note',    color: '#0E7490', bg: '#F0FDFA' },
  // Soft lilac (lighter than before — not dark purple)
  proforma_invoice: { label: 'Proforma',         color: '#A78BFA', bg: '#F5F3FF' },
  // Soft peach — distinct from blue/purple/amber warning
  quotation:        { label: 'Quotation',        color: '#C97B4A', bg: '#FBF0E8' },
  // Money vouchers in Sales / Purchase registers
  receipt_voucher:  { label: 'Receipt',          color: '#2D7D46', bg: '#E8F5E9' },
  journal_voucher:  { label: 'Journal',          color: '#6D4C41', bg: '#EFEBE9' },
  payment_voucher:  { label: 'Payment',          color: '#E65100', bg: '#FFF3E0' },
  contra_voucher:   { label: 'Contra',           color: '#546E7A', bg: '#ECEFF1' },
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: 110,
  },
  txt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
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
  variant = 'default',
}: {
  chips: { id: string; label: string }[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  /** 'amber' matches Total Stock chip styling */
  variant?: 'default' | 'amber';
}) {
  if (!chips.length) return null;
  const chipStyle = variant === 'amber' ? fi.chipAmber : fi.chip;
  const chipTxtStyle = variant === 'amber' ? fi.chipTxtAmber : fi.chipTxt;
  const closeColor = variant === 'amber' ? '#A89060' : COLORS.brandPrimary;
  return (
    <View style={fi.chipRowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={fi.chipRow}
      >
        {chips.map((c) => (
          <View key={c.id} style={chipStyle}>
            <Text style={chipTxtStyle} numberOfLines={1}>{c.label}</Text>
            <TouchableOpacity
              onPress={() => onRemove(c.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={variant === 'amber' ? 12 : 14} color={closeColor} />
            </TouchableOpacity>
          </View>
        ))}
        {onClearAll && chips.length > 1 && (
          <TouchableOpacity
            style={variant === 'amber' ? fi.clearChipAmber : fi.clearChip}
            onPress={onClearAll}
            activeOpacity={0.7}
          >
            <Text style={variant === 'amber' ? fi.clearChipTxtAmber : fi.clearChipTxt}>Clear all</Text>
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
  const [localIds, setLocalIds] = useState<string[]>([]);
  const [localGroups, setLocalGroups] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState('');

  const allOptionIds = useMemo(() => options.map((o) => o.id), [options]);
  const allGroupNames = useMemo(() => partyGroups.map((g) => g.name), [partyGroups]);

  useMultiFilterHydration(visible, selectedIds, allOptionIds, setLocalIds);
  useMultiFilterHydration(visible, selectedGroups, allGroupNames, setLocalGroups);

  useEffect(() => {
    if (visible) {
      setGroupSearch('');
      setTab('Type');
    }
  }, [visible]);

  const isAllTypes = isFilterAllSelected(localIds, allOptionIds);
  const isAllGroups = isFilterAllSelected(localGroups, allGroupNames);

  const activeCount = (isAllTypes ? 0 : localIds.length) + (isAllGroups ? 0 : localGroups.length);
  const allCount = counts.all ?? options.reduce((s, o) => s + (counts[o.id] || 0), 0);
  const canApply =
    isFilterSelectionValid(localIds, allOptionIds)
    && isFilterSelectionValid(localGroups, allGroupNames);

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return partyGroups;
    return partyGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [partyGroups, groupSearch]);

  const toggleType = (id: string) => {
    setLocalIds((prev) => toggleFilterFromAll(prev, id));
  };

  const toggleGroup = (name: string) => {
    setLocalGroups((prev) => toggleFilterFromAll(prev, name));
  };

  const handleApply = () => {
    if (!canApply) return;
    const nextIds = normalizeFilterAllSelection(localIds, allOptionIds);
    const nextGroups = normalizeFilterAllSelection(localGroups, allGroupNames);
    onApply(nextIds, nextGroups);
    onClose();
    const parts: string[] = [];
    if (nextIds.length) {
      parts.push(
        nextIds.map((id) => options.find((o) => o.id === id)?.label || DOC_TYPE_LABEL[id] || id).join(', ')
      );
    }
    if (nextGroups.length) parts.push(...nextGroups);
    notifyFiltersApplied(parts);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      activeCount={activeCount}
      onClear={() => { setLocalIds([...allOptionIds]); setLocalGroups([...allGroupNames]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
      applyDisabled={!canApply}
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
            onPress={() => setLocalIds((prev) => toggleFilterAll(prev, allOptionIds))}
          />
          {options.map((opt) => (
            <FilterCheckRow
              key={opt.id}
              label={opt.label}
              count={counts[opt.id] ?? 0}
              selected={isFilterOptionChecked(localIds, opt.id)}
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
            selected={isAllGroups}
            onPress={() => setLocalGroups((prev) => toggleFilterAll(prev, allGroupNames))}
          />
          {filteredGroups.length === 0 ? (
            <Text style={fm.groupHint}>No party groups in this date range</Text>
          ) : (
            filteredGroups.map((g) => (
              <FilterCheckRow
                key={g.name}
                label={g.name}
                count={g.count}
                selected={isFilterOptionChecked(localGroups, g.name)}
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
  const [localCats, setLocalCats] = useState<string[]>([]);
  const [catSearch, setCatSearch] = useState('');

  const allCatNames = useMemo(() => categories.map((c) => c.name), [categories]);

  useMultiFilterHydration(visible, activeCategories, allCatNames, setLocalCats);

  useEffect(() => {
    if (visible) {
      setLocalType(normalizeExpenseTypeRadio(activeTypes));
      setCatSearch('');
      setTab('Type');
    }
  }, [visible, activeTypes]);

  const isAllCats = isFilterAllSelected(localCats, allCatNames);
  const activeCount = (localType === 'All' ? 0 : 1) + (isAllCats ? 0 : localCats.length);
  const canApply = isFilterSelectionValid(localCats, allCatNames);

  const filteredCats = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const toggleCat = (name: string) => {
    setLocalCats((prev) => toggleFilterFromAll(prev, name));
  };

  const handleApply = () => {
    if (!canApply) return;
    const nextTypes: ExpenseTypeId[] = localType === 'All' ? [] : [localType];
    const nextCats = normalizeFilterAllSelection(localCats, allCatNames);
    onApply(nextTypes, nextCats);
    onClose();
    const parts: string[] = [];
    if (nextTypes.length) parts.push(nextTypes[0]);
    if (nextCats.length) parts.push(...nextCats);
    notifyFiltersApplied(parts);
  };

  return (
    <FilterBottomSheet
      visible={visible}
      onClose={onClose}
      title="Filter Expenses"
      activeCount={activeCount}
      onClear={() => { setLocalType('All'); setLocalCats([...allCatNames]); }}
      onApply={handleApply}
      applyLabel="Apply Filters"
      applyDisabled={!canApply}
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
            selected={isAllCats}
            onPress={() => setLocalCats((prev) => toggleFilterAll(prev, allCatNames))}
          />
          {filteredCats.length === 0 ? (
            <Text style={fm.groupHint}>No categories in this date range</Text>
          ) : (
            filteredCats.map((c) => (
              <FilterCheckRow
                key={c.name}
                label={c.name}
                count={c.count}
                selected={isFilterOptionChecked(localCats, c.name)}
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
    position: 'relative',
    overflow: 'visible',
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
  chipAmber: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#FBF7EE',
    borderWidth: 1, borderColor: '#F0E8D5',
    maxWidth: 140,
  },
  chipTxtAmber: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: '#A89060', flexShrink: 1 },
  clearChip: {
    paddingHorizontal: 10, paddingVertical: 5,
  },
  clearChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  clearChipAmber: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFF0F0',
    borderWidth: 1, borderColor: '#FFCCCC',
  },
  clearChipTxtAmber: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.negative },
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
