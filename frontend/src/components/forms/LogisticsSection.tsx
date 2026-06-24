import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

export function calcLogisticsTotal(entries: LogEntry[], roundOffAmount = 0): number {
  const chargesTotal = entries.reduce((sum, e) => {
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
  return chargesTotal + (roundOffAmount || 0);
}

interface Props {
  entries: LogEntry[];
  onEntriesChange: (e: LogEntry[]) => void;
  taxLedgers: { name: string }[];
  chargeLedgers: { ledgerName: string; guid?: string }[];
  // Round-off (separate line item — never mixed with logistics rows)
  roundOffLedgers: { ledgerName: string; guid?: string }[];
  roundOffLedger: string;
  roundOffAmount: string;
  onRoundOffLedgerChange: (v: string) => void;
  onRoundOffAmountChange: (v: string) => void;
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

export default function LogisticsSection({
  entries, onEntriesChange, taxLedgers, chargeLedgers,
  roundOffLedgers, roundOffLedger, roundOffAmount,
  onRoundOffLedgerChange, onRoundOffAmountChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const chargesTotal = entries.reduce((sum, e) => {
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
  const roundOff = parseFloat(roundOffAmount) || 0;
  const total = chargesTotal + roundOff;

  const chargeLedgerOpts: BSSOption[] = chargeLedgers.map(l => ({
    label: l.ledgerName,
    value: l.ledgerName,
  }));

  const taxLedgerOpts: BSSOption[] = taxLedgers.map(l => ({
    label: l.name,
    value: l.name,
  }));

  const roundOffOpts: BSSOption[] = roundOffLedgers.map(l => ({
    label: l.ledgerName,
    value: l.ledgerName,
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
      {entries.length > 0 ? (
        <TouchableOpacity style={ls.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <View style={ls.headerLeft}>
            <View style={[ls.headerIcon, expanded ? ls.headerIconActive : undefined]}>
              <MaterialCommunityIcons name="truck-outline" size={16} color={expanded ? COLORS.warning : COLORS.textSecondary} />
            </View>
            <View>
              <Text style={ls.headerTitle}>Logistics & Shipping</Text>
              <Text style={ls.headerSub}>
                {`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · ₹${chargesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
              </Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={ls.header}>
          <View style={ls.headerLeft}>
            <View style={ls.headerIcon}>
              <MaterialCommunityIcons name="truck-outline" size={16} color={COLORS.textSecondary} />
            </View>
            <View>
              <Text style={ls.headerTitle}>Logistics & Shipping</Text>
              <Text style={ls.headerSub}>Freight, packing, other charges</Text>
            </View>
          </View>
        </View>
      )}

      {/* Empty state: green dashed add button */}
      {entries.length === 0 && (
        <View style={{ paddingHorizontal: SPACING.md, paddingBottom: SPACING.md }}>
          <TouchableOpacity
            style={{ borderWidth: 1.5, borderColor: '#22C55E', borderStyle: 'dashed', borderRadius: 8, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}
            onPress={addEntry}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={16} color="#22C55E" />
            <Text style={{ color: '#22C55E', fontWeight: '600', fontSize: 14 }}>Add Logistics / Shipping Charge</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Body */}
      {entries.length > 0 && expanded && (
        <View style={ls.body}>
          {/* ── Logistics / Charge entries ── */}
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
                  <Text style={ls.checkboxLabel}>Add Taxes to this charge</Text>
                </TouchableOpacity>

                {/* Tax sub-rows */}
                {entry.addTaxes && (
                  <View style={ls.taxSection}>
                    {entry.taxEntries.map(taxEntry => (
                      <View key={taxEntry.id} style={ls.taxEntryCard}>
                        {/* Row 1: Ledger + Remove */}
                        <View style={ls.taxEntryTopRow}>
                          <View style={{ flex: 1 }}>
                            <BottomSheetSearch
                              compact
                              options={taxLedgerOpts}
                              value={taxEntry.ledgerName}
                              onSelect={opt => updateTaxEntry(entry.id, taxEntry.id, 'ledgerName', opt.value)}
                              onClear={() => updateTaxEntry(entry.id, taxEntry.id, 'ledgerName', '')}
                              placeholder="Select tax ledger..."
                              sheetTitle="Tax Ledger"
                            />
                          </View>
                          <TouchableOpacity onPress={() => removeTaxEntry(entry.id, taxEntry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={14} color={COLORS.negative} />
                          </TouchableOpacity>
                        </View>
                        {/* Row 2: Rate % → ₹ Amount */}
                        <View style={ls.taxEntryBottomRow}>
                          <View style={ls.taxFieldGroup}>
                            <Text style={ls.taxMiniLbl}>Rate</Text>
                            <View style={ls.taxFieldInputRow}>
                              <TextInput
                                style={ls.taxRateInput}
                                value={taxEntry.taxRate}
                                onChangeText={v => {
                                  updateTaxEntry(entry.id, taxEntry.id, 'taxRate', v);
                                  const auto = (base * (parseFloat(v) || 0) / 100).toFixed(2);
                                  updateTaxEntry(entry.id, taxEntry.id, 'taxAmount', auto);
                                }}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor={COLORS.textTertiary}
                              />
                              <Text style={ls.taxRateSign}>%</Text>
                            </View>
                          </View>
                          <Ionicons name="arrow-forward-outline" size={12} color={COLORS.textTertiary} style={{ marginTop: 14 }} />
                          <View style={[ls.taxFieldGroup, { flex: 1 }]}>
                            <Text style={ls.taxMiniLbl}>Amount</Text>
                            <View style={ls.taxFieldInputRow}>
                              <Text style={ls.taxRateSign}>₹</Text>
                              <TextInput
                                style={[ls.taxAmtInput, { flex: 1, width: undefined }]}
                                value={taxEntry.taxAmount}
                                onChangeText={v => updateTaxEntry(entry.id, taxEntry.id, 'taxAmount', v)}
                                keyboardType="numeric"
                                placeholder="0.00"
                                placeholderTextColor={COLORS.textTertiary}
                              />
                            </View>
                          </View>
                        </View>
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
            <Text style={ls.addEntryTxt}>+ Add Logistics Charge</Text>
          </TouchableOpacity>

          {/* ── Round Off (separate line item) ── */}
          <View style={ls.roundOffSection}>
            <View style={ls.roundOffHdr}>
              <Ionicons name="refresh-outline" size={13} color={COLORS.textSecondary} />
              <Text style={ls.roundOffTitle}>Round Off</Text>
              <Text style={ls.roundOffHint}>Separate ledger entry — not bundled with charges</Text>
            </View>
            <View style={ls.roundOffRow}>
              <View style={{ flex: 1 }}>
                <BottomSheetSearch
                  compact
                  options={roundOffOpts}
                  value={roundOffLedger}
                  onSelect={opt => onRoundOffLedgerChange(opt.value)}
                  onClear={() => { onRoundOffLedgerChange(''); onRoundOffAmountChange(''); }}
                  placeholder="Select round-off ledger..."
                  sheetTitle="Round Off Ledger"
                />
              </View>
              <TextInput
                style={ls.amountInput}
                value={roundOffAmount}
                onChangeText={onRoundOffAmountChange}
                keyboardType="numeric"
                placeholder="±₹ Amount"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          </View>

          {/* Total */}
          {total !== 0 && (
            <View style={ls.totalRow}>
              <Text style={ls.totalLabel}>Total Charges + Round Off</Text>
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
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountInput: {
    width: 90, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  checkboxLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  taxSection: { gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  // Tax Entry Card (2-row layout)
  taxEntryCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 4, overflow: 'hidden' },
  taxEntryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  taxEntryBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingTop: 6 },
  taxFieldGroup: { gap: 2 },
  taxMiniLbl: { fontSize: 10, fontWeight: '600' as const, color: COLORS.textTertiary },
  taxFieldInputRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  taxRateSign: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' as const },
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
  // Round-off section
  roundOffSection: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    gap: 8,
  },
  roundOffHdr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roundOffTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  roundOffHint: { flex: 1, fontSize: 10, color: COLORS.textTertiary, fontStyle: 'italic' },
  roundOffRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: SPACING.sm, marginTop: 4,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  totalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  totalVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.warning },
});
