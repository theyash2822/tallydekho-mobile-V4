import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import BottomSheetSearch, { BSSOption } from './BottomSheetSearch';

export interface LogTaxEntry {
  id: string;
  ledgerName: string;
  taxRate: string;
  taxAmount: string; // auto-calc, editable
}

export interface LogEntry {
  id: string;
  ledgerName: string;
  amount: string;
  addTaxes: boolean;
  taxEntries: LogTaxEntry[];
}

export function calcLogisticsTotal(entries: LogEntry[]): number {
  return entries.reduce((sum, e) => {
    const base = parseFloat(e.amount) || 0;
    const taxAmt = e.addTaxes
      ? e.taxEntries.reduce((ts, t) => {
          const ta = parseFloat(t.taxAmount);
          if (!isNaN(ta)) return ts + ta;
          return ts + base * (parseFloat(t.taxRate) || 0) / 100;
        }, 0)
      : 0;
    return sum + base + taxAmt;
  }, 0);
}

interface Props {
  entries: LogEntry[];
  onEntriesChange: (e: LogEntry[]) => void;
  taxLedgers: { name: string }[];
  chargeLedgers: { ledgerName: string; guid?: string }[];
}

const newEntry = (): LogEntry => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  ledgerName: '',
  amount: '',
  addTaxes: false,
  taxEntries: [],
});

const newTaxEntry = (): LogTaxEntry => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  ledgerName: '',
  taxRate: '',
  taxAmount: '',
});

export default function LogisticsSection({ entries, onEntriesChange, taxLedgers, chargeLedgers }: Props) {
  const [expanded, setExpanded] = useState(false);
  const total = calcLogisticsTotal(entries);

  const chargeLedgerOpts: BSSOption[] = chargeLedgers.map(l => ({
    label: l.ledgerName,
    value: l.ledgerName,
  }));

  const taxLedgerOpts: BSSOption[] = taxLedgers.map(l => ({
    label: l.name,
    value: l.name,
  }));

  const addEntry = () => {
    onEntriesChange([...entries, newEntry()]);
    setExpanded(true);
  };

  const updateEntry = (id: string, field: keyof Omit<LogEntry, 'taxEntries'>, value: any) =>
    onEntriesChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  const removeEntry = (id: string) =>
    onEntriesChange(entries.filter(e => e.id !== id));

  const addTaxEntry = (entryId: string) =>
    onEntriesChange(entries.map(e =>
      e.id === entryId ? { ...e, taxEntries: [...e.taxEntries, newTaxEntry()] } : e
    ));

  const updateTaxEntry = (entryId: string, taxId: string, field: keyof LogTaxEntry, value: string) =>
    onEntriesChange(entries.map(e =>
      e.id === entryId
        ? { ...e, taxEntries: e.taxEntries.map(t => t.id === taxId ? { ...t, [field]: value } : t) }
        : e
    ));

  const removeTaxEntry = (entryId: string, taxId: string) =>
    onEntriesChange(entries.map(e =>
      e.id === entryId
        ? { ...e, taxEntries: e.taxEntries.filter(t => t.id !== taxId) }
        : e
    ));

  return (
    <View style={ls.container}>
      {/* Header */}
      <TouchableOpacity style={ls.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={ls.headerLeft}>
          <View style={[ls.headerIcon, expanded ? ls.headerIconActive : undefined]}>
            <Ionicons name="car-outline" size={16} color={expanded ? COLORS.warning : COLORS.textSecondary} />
          </View>
          <View>
            <Text style={ls.headerTitle}>Logistics & Charges</Text>
            {entries.length > 0 && (
              <Text style={ls.headerSub}>
                {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                {total > 0 ? ` · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Body */}
      {expanded && (
        <View style={ls.body}>
          {entries.map((entry) => {
            const base = parseFloat(entry.amount) || 0;
            return (
              <View key={entry.id} style={ls.entryCard}>
                {/* Row: Ledger + Amount + Remove */}
                <View style={ls.entryTopRow}>
                  <View style={{ flex: 1 }}>
                    <BottomSheetSearch
                      compact
                      options={chargeLedgerOpts}
                      value={entry.ledgerName}
                      onSelect={opt => updateEntry(entry.id, 'ledgerName', opt.value)}
                      onClear={() => updateEntry(entry.id, 'ledgerName', '')}
                      placeholder="Select charge ledger..."
                      sheetTitle="Charge Ledger"
                    />
                  </View>
                  <TextInput
                    style={ls.amountInput}
                    value={entry.amount}
                    onChangeText={v => updateEntry(entry.id, 'amount', v)}
                    keyboardType="numeric"
                    placeholder="₹ Amount"
                    placeholderTextColor={COLORS.textTertiary}
                  />
                  <TouchableOpacity onPress={() => removeEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.negative} />
                  </TouchableOpacity>
                </View>

                {/* Add Taxes checkbox */}
                <TouchableOpacity
                  style={ls.checkboxRow}
                  onPress={() => updateEntry(entry.id, 'addTaxes', !entry.addTaxes)}
                  activeOpacity={0.7}
                >
                  <View style={[ls.checkbox, entry.addTaxes && ls.checkboxActive]}>
                    {entry.addTaxes && <Ionicons name="checkmark" size={10} color={COLORS.white} />}
                  </View>
                  <Text style={ls.checkboxLabel}>Add Taxes</Text>
                </TouchableOpacity>

                {/* Tax entries when addTaxes is true */}
                {entry.addTaxes && (
                  <View style={ls.taxSection}>
                    {entry.taxEntries.map(taxEntry => (
                      <View key={taxEntry.id} style={ls.taxEntryRow}>
                        <View style={{ flex: 1 }}>
                          <BottomSheetSearch
                            compact
                            options={taxLedgerOpts}
                            value={taxEntry.ledgerName}
                            onSelect={opt => updateTaxEntry(entry.id, taxEntry.id, 'ledgerName', opt.value)}
                            onClear={() => updateTaxEntry(entry.id, taxEntry.id, 'ledgerName', '')}
                            placeholder="Tax ledger..."
                            sheetTitle="Tax Ledger"
                          />
                        </View>
                        <TextInput
                          style={ls.taxRateInput}
                          value={taxEntry.taxRate}
                          onChangeText={v => {
                            updateTaxEntry(entry.id, taxEntry.id, 'taxRate', v);
                            const auto = (base * (parseFloat(v) || 0) / 100).toFixed(2);
                            updateTaxEntry(entry.id, taxEntry.id, 'taxAmount', auto);
                          }}
                          keyboardType="numeric"
                          placeholder="0%"
                          placeholderTextColor={COLORS.textTertiary}
                        />
                        <TextInput
                          style={ls.taxAmtInput}
                          value={taxEntry.taxAmount}
                          onChangeText={v => updateTaxEntry(entry.id, taxEntry.id, 'taxAmount', v)}
                          keyboardType="numeric"
                          placeholder="₹0"
                          placeholderTextColor={COLORS.textTertiary}
                        />
                        <TouchableOpacity onPress={() => removeTaxEntry(entry.id, taxEntry.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                          <Ionicons name="close-circle" size={14} color={COLORS.negative} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={ls.addTaxBtn} onPress={() => addTaxEntry(entry.id)} activeOpacity={0.7}>
                      <Ionicons name="add-circle-outline" size={14} color={COLORS.info} />
                      <Text style={ls.addTaxTxt}>+ Add Tax Row</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* Add Logistics Row button */}
          <TouchableOpacity style={ls.addEntryBtn} onPress={addEntry} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.warning} />
            <Text style={ls.addEntryTxt}>+ Add Logistics Row</Text>
          </TouchableOpacity>

          {/* Total */}
          {total > 0 && (
            <View style={ls.totalRow}>
              <Text style={ls.totalLabel}>Total Logistics & Charges</Text>
              <Text style={ls.totalVal}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.md, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  headerIconActive: { backgroundColor: COLORS.warningBg },
  headerTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  headerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  body: {
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: SPACING.sm,
  },
  entryCard: {
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    padding: SPACING.sm, marginTop: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault, gap: 8,
  },
  entryTopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  amountInput: {
    width: 90, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right',
  },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  checkboxLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  taxSection: {
    gap: 6, paddingTop: 6,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  taxEntryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  taxRateInput: {
    width: 52, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 6,
    fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, textAlign: 'center',
  },
  taxAmtInput: {
    width: 68, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 6,
    fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, textAlign: 'right',
  },
  addTaxBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: COLORS.infoBg, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.info + '40',
    alignSelf: 'flex-start',
  },
  addTaxTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  addEntryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, marginTop: 4,
    borderWidth: 1, borderColor: COLORS.warning + '60',
    borderRadius: RADIUS.md, borderStyle: 'dashed',
    backgroundColor: COLORS.warningBg,
  },
  addEntryTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.warning },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: SPACING.sm, marginTop: 4,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  totalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  totalVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.warning },
});
