import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

const GOLD = '#A89060';
const webFix = { outlineWidth: 0, outlineStyle: 'none' } as any;

// ── Types ──────────────────────────────────────────────────────────────────────
export interface TaxLine {
  id: string;
  type: string;
  rate: string;
  amount: string;
}

export interface LogEntry {
  id: string;
  ledger: string;
  amount: string;
  addTaxes: boolean;
  taxes: TaxLine[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
export function calcLogisticsTotal(entries: LogEntry[]): number {
  let total = 0;
  entries.forEach(e => {
    const base = parseFloat(e.amount) || 0;
    total += base;
    if (e.addTaxes) {
      e.taxes.forEach(tax => {
        const manAmt = parseFloat(tax.amount);
        if (!isNaN(manAmt) && tax.amount.trim() !== '') {
          total += manAmt;
        } else {
          total += base * (parseFloat(tax.rate) || 0) / 100;
        }
      });
    }
  });
  return total;
}

const newTaxLine = (): TaxLine => ({
  id: Date.now().toString() + Math.random(),
  type: 'CGST', rate: '0', amount: '',
});

const TAX_TYPES = [
  { label: 'CGST', value: 'CGST' },
  { label: 'SGST', value: 'SGST' },
  { label: 'IGST', value: 'IGST' },
  { label: 'CESS', value: 'CESS' },
  { label: 'Add. Cess', value: 'ADD_CESS' },
  { label: 'Other', value: 'OTHER' },
];

const LOGISTICS_LEDGERS = [
  { label: 'Freight Charges', value: 'freight' },
  { label: 'Packing & Forwarding', value: 'packing' },
  { label: 'Transport Charges', value: 'transport' },
  { label: 'Courier Charges', value: 'courier' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Loading / Unloading', value: 'loading' },
  { label: 'Handling Charges', value: 'handling' },
  { label: 'Other Charges', value: 'other' },
];

// ── Ledger Search Picker ───────────────────────────────────────────────────────
function LedgerPicker({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string;
  onSelect: (val: string) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = LOGISTICS_LEDGERS.filter(l =>
    l.label.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ls.overlay} activeOpacity={1} onPress={() => { onClose(); setQuery(''); }} />
      <View style={ls.sheet}>
        <View style={ls.handle} />
        <Text style={ls.sheetTitle}>Select Ledger</Text>
        <View style={ls.searchBox}>
          <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
          <TextInput
            style={[ls.searchInput, webFix]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search ledger..."
            placeholderTextColor={COLORS.textTertiary}
            autoFocus
          />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[ls.sheetRow, opt.value === value && ls.sheetRowActive]}
              onPress={() => { onSelect(opt.value); onClose(); setQuery(''); }}
              activeOpacity={0.7}
            >
              <Text style={[ls.sheetRowTxt, opt.value === value && ls.sheetRowTxtActive]}>
                {opt.label}
              </Text>
              {opt.value === value && <Ionicons name="checkmark" size={15} color={GOLD} />}
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && (
            <View style={{ padding: SPACING.md, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm }}>No ledgers found</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Tax Type Picker ────────────────────────────────────────────────────────────
function TaxTypePicker({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string;
  onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ls.overlay} activeOpacity={1} onPress={onClose} />
      <View style={ls.sheet}>
        <View style={ls.handle} />
        <Text style={ls.sheetTitle}>Tax Type</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {TAX_TYPES.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[ls.sheetRow, opt.value === value && ls.sheetRowActive]}
              onPress={() => { onSelect(opt.value); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[ls.sheetRowTxt, opt.value === value && ls.sheetRowTxtActive]}>
                {opt.label}
              </Text>
              {opt.value === value && <Ionicons name="checkmark" size={15} color={GOLD} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Single Tax Row ─────────────────────────────────────────────────────────────
function LogTaxRow({ tax, base, onChangeType, onChangeRate, onChangeAmount, onRemove }: {
  tax: TaxLine; base: number;
  onChangeType: (v: string) => void;
  onChangeRate: (v: string) => void;
  onChangeAmount: (v: string) => void;
  onRemove: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const autoAmt = (base * (parseFloat(tax.rate) || 0) / 100).toFixed(2);
  const typeLabel = TAX_TYPES.find(t => t.value === tax.type)?.label || tax.type;

  return (
    <View style={ls.taxRow}>
      <TouchableOpacity style={ls.taxTypeBtn} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
        <Text style={ls.taxTypeTxt}>{typeLabel}</Text>
        <Ionicons name="chevron-down" size={9} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <View style={ls.taxRateWrap}>
        <TextInput
          style={[ls.taxRateInput, webFix]}
          value={tax.rate}
          onChangeText={onChangeRate}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.textTertiary}
        />
        <Text style={ls.taxPct}>%</Text>
      </View>
      <View style={ls.taxAmtWrap}>
        <Text style={ls.taxRupee}>₹</Text>
        <TextInput
          style={[ls.taxAmtInput, webFix]}
          value={tax.amount}
          onChangeText={onChangeAmount}
          keyboardType="decimal-pad"
          placeholder={autoAmt}
          placeholderTextColor={COLORS.textTertiary}
        />
      </View>
      <TouchableOpacity onPress={onRemove} activeOpacity={0.7} style={ls.taxRemove}>
        <Ionicons name="close-circle" size={17} color={COLORS.negative} />
      </TouchableOpacity>
      <TaxTypePicker visible={showPicker} value={tax.type}
        onSelect={onChangeType} onClose={() => setShowPicker(false)} />
    </View>
  );
}

// ── Single Logistics Entry Row ─────────────────────────────────────────────────
function LogEntryRow({ entry, onChange, onRemove }: {
  entry: LogEntry;
  onChange: (id: string, patch: Partial<LogEntry>) => void;
  onRemove: (id: string) => void;
}) {
  const [showLedger, setShowLedger] = useState(false);
  const base = parseFloat(entry.amount) || 0;
  const ledgerLabel = LOGISTICS_LEDGERS.find(l => l.value === entry.ledger)?.label;

  const updateTax = (taxId: string, patch: Partial<TaxLine>) => {
    onChange(entry.id, { taxes: entry.taxes.map(t => t.id === taxId ? { ...t, ...patch } : t) });
  };
  const removeTax = (taxId: string) => {
    onChange(entry.id, { taxes: entry.taxes.filter(t => t.id !== taxId) });
  };
  const addTax = () => {
    onChange(entry.id, { taxes: [...entry.taxes, newTaxLine()] });
  };
  const toggleTaxes = () => {
    const newVal = !entry.addTaxes;
    onChange(entry.id, {
      addTaxes: newVal,
      taxes: newVal && entry.taxes.length === 0 ? [newTaxLine()] : entry.taxes,
    });
  };

  return (
    <View style={ls.entryWrap}>
      {/* Main row: Ledger | Amount | ✕ */}
      <View style={ls.entryMainRow}>
        <TouchableOpacity
          style={[ls.ledgerBtn, entry.ledger && ls.ledgerBtnFilled]}
          onPress={() => setShowLedger(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="book-outline" size={13} color={entry.ledger ? COLORS.info : COLORS.textTertiary} />
          <Text style={[ls.ledgerTxt, !ledgerLabel && ls.ledgerPlaceholder]} numberOfLines={1}>
            {ledgerLabel || 'Select ledger...'}
          </Text>
          <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={ls.amtWrap}>
          <Text style={ls.amtPfx}>₹</Text>
          <TextInput
            style={[ls.amtInput, webFix]}
            value={entry.amount}
            onChangeText={v => onChange(entry.id, { amount: v })}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>

        <TouchableOpacity onPress={() => onRemove(entry.id)} activeOpacity={0.7} style={ls.removeBtn}>
          <Ionicons name="close-circle" size={19} color={COLORS.negative} />
        </TouchableOpacity>
      </View>

      {/* Add Taxes checkbox */}
      <TouchableOpacity style={ls.addTaxToggleRow} onPress={toggleTaxes} activeOpacity={0.7}>
        <View style={[ls.checkbox, entry.addTaxes && ls.checkboxOn]}>
          {entry.addTaxes && <Ionicons name="checkmark" size={11} color="#fff" />}
        </View>
        <Text style={ls.addTaxLbl}>Add Taxes</Text>
      </TouchableOpacity>

      {/* Tax rows */}
      {entry.addTaxes && (
        <View style={ls.taxSection}>
          <Text style={ls.taxHint}>Type · Rate % · Amount ₹ (editable)</Text>
          {entry.taxes.map(tax => (
            <LogTaxRow
              key={tax.id}
              tax={tax}
              base={base}
              onChangeType={v => updateTax(tax.id, { type: v })}
              onChangeRate={v => updateTax(tax.id, { rate: v })}
              onChangeAmount={v => updateTax(tax.id, { amount: v })}
              onRemove={() => removeTax(tax.id)}
            />
          ))}
          <TouchableOpacity style={ls.addTaxBtn} onPress={addTax} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={13} color={GOLD} />
            <Text style={ls.addTaxBtnTxt}>Add Tax Row</Text>
          </TouchableOpacity>
        </View>
      )}

      <LedgerPicker
        visible={showLedger}
        value={entry.ledger}
        onSelect={val => onChange(entry.id, { ledger: val })}
        onClose={() => setShowLedger(false)}
      />
    </View>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  entries: LogEntry[];
  onEntriesChange: (e: LogEntry[]) => void;
}

export default function LogisticsSection({ entries, onEntriesChange }: Props) {
  const total = calcLogisticsTotal(entries);

  const addEntry = () => {
    onEntriesChange([...entries, {
      id: Date.now().toString() + Math.random(),
      ledger: '', amount: '', addTaxes: false, taxes: [],
    }]);
  };

  const updateEntry = (id: string, patch: Partial<LogEntry>) => {
    onEntriesChange(entries.map(e => e.id === id ? { ...e, ...patch } : e));
  };

  const removeEntry = (id: string) => {
    onEntriesChange(entries.filter(e => e.id !== id));
  };

  return (
    <View style={ls.container}>
      {entries.length === 0 && (
        <TouchableOpacity style={ls.emptyBtn} onPress={addEntry} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={16} color={COLORS.positive} />
          <Text style={ls.emptyTxt}>Add Logistics / Shipping Charge</Text>
        </TouchableOpacity>
      )}

      {entries.map(entry => (
        <LogEntryRow
          key={entry.id}
          entry={entry}
          onChange={updateEntry}
          onRemove={removeEntry}
        />
      ))}

      {entries.length > 0 && total > 0 && (
        <View style={ls.totalRow}>
          <Text style={ls.totalLbl}>Total Logistics & Shipping</Text>
          <Text style={ls.totalVal}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
      )}

      {entries.length > 0 && (
        <TouchableOpacity style={ls.addRowBtn} onPress={addEntry} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={14} color={GOLD} />
          <Text style={ls.addRowTxt}>Add Logistics Row</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  container: { padding: SPACING.md },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderWidth: 1, borderColor: COLORS.positive + '50',
    borderRadius: RADIUS.md, borderStyle: 'dashed', backgroundColor: COLORS.positiveBg,
    marginBottom: SPACING.sm,
  },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.positive },
  // Entry card
  entryWrap: {
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  entryMainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm, paddingHorizontal: 10,
    paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 44,
  },
  ledgerBtnFilled: { backgroundColor: COLORS.infoBg, borderColor: COLORS.info + '40' },
  ledgerTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  ledgerPlaceholder: { color: COLORS.textTertiary, fontWeight: '400' },
  amtWrap: {
    flexDirection: 'row', alignItems: 'center', width: 96, minHeight: 44,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.borderDefault, paddingHorizontal: 8,
  },
  amtPfx: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginRight: 2 },
  amtInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right' },
  removeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  // Taxes checkbox
  addTaxToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 2 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: GOLD, borderColor: GOLD },
  addTaxLbl: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  // Tax section
  taxSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  taxHint: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '500', marginBottom: 6 },
  taxRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  taxTypeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.infoBg,
    borderRadius: RADIUS.sm, paddingHorizontal: 7, paddingVertical: 7,
    borderWidth: 1, borderColor: COLORS.info + '30', minWidth: 62,
  },
  taxTypeTxt: { fontSize: 10, fontWeight: '700', color: COLORS.info, flex: 1 },
  taxRateWrap: {
    flexDirection: 'row', alignItems: 'center', width: 56,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm, borderWidth: 1,
    borderColor: COLORS.borderDefault, paddingHorizontal: 5, paddingVertical: 4,
  },
  taxRateInput: { flex: 1, fontSize: 11, color: COLORS.textPrimary, textAlign: 'center' },
  taxPct: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600' },
  taxAmtWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 5, paddingVertical: 4,
  },
  taxRupee: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', marginRight: 2 },
  taxAmtInput: { flex: 1, fontSize: 11, color: COLORS.textPrimary, textAlign: 'right' },
  taxRemove: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  addTaxBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5 },
  addTaxBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: GOLD },
  // Total row
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    marginBottom: SPACING.sm,
  },
  totalLbl: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  totalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.positive },
  // Add row button
  addRowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderWidth: 1, borderColor: GOLD + '50',
    borderRadius: RADIUS.md, borderStyle: 'dashed', backgroundColor: COLORS.pageBg,
  },
  addRowTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: GOLD },
  // Picker sheet
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingTop: 8,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2,
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 4,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, margin: SPACING.sm,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 12,
    paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  sheetRowActive: { backgroundColor: COLORS.pageBg },
  sheetRowTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  sheetRowTxtActive: { fontWeight: '700', color: GOLD },
});
