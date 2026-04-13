import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import FormDropdown, { DropdownOption } from './FormDropdown';

export interface LogEntry {
  id: string;
  type: string;
  amount: string;
  tracking: string;
  remarks: string;
}

const LOG_TYPES: DropdownOption[] = [
  { label: 'Courier', value: 'courier' },
  { label: 'Transport', value: 'transport' },
  { label: 'Freight', value: 'freight' },
  { label: 'Custom', value: 'custom' },
];
const TAX_OPTS: DropdownOption[] = [
  { label: '0% (Exempt)', value: '0' },
  { label: '5% GST', value: '5' },
  { label: '12% GST', value: '12' },
  { label: '18% GST', value: '18' },
  { label: '28% GST', value: '28' },
];

export function calcLogisticsTotal(entries: LogEntry[], taxRate: string): number {
  const base = entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  return base + base * (parseFloat(taxRate) || 0) / 100;
}

interface Props {
  entries: LogEntry[];
  taxRate: string;
  onEntriesChange: (e: LogEntry[]) => void;
  onTaxRateChange: (r: string) => void;
}

export default function LogisticsSection({ entries, taxRate, onEntriesChange, onTaxRateChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const total = calcLogisticsTotal(entries, taxRate);

  const addEntry = () => {
    onEntriesChange([...entries, { id: Date.now().toString(), type: 'courier', amount: '', tracking: '', remarks: '' }]);
    setExpanded(true);
  };
  const updateEntry = (id: string, field: keyof LogEntry, value: string) =>
    onEntriesChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));
  const removeEntry = (id: string) =>
    onEntriesChange(entries.filter(e => e.id !== id));

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={s.hl}>
          <Ionicons name="car-outline" size={18} color={COLORS.textSecondary} />
          <Text style={s.hTxt}>Logistics / Shipping</Text>
          {entries.length > 0 && (
            <View style={s.cnt}><Text style={s.cntTxt}>{entries.length}</Text></View>
          )}
          {total > 0 && (
            <Text style={s.totalChip}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          )}
        </View>
        <View style={s.hr}>
          <TouchableOpacity style={s.addBtn} onPress={addEntry} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={20} color={COLORS.positive} />
            <Text style={s.addTxt}>Add</Text>
          </TouchableOpacity>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.body}>
          {entries.length === 0 && (
            <TouchableOpacity style={s.emptyBtn} onPress={addEntry} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
              <Text style={s.emptyTxt}>Add Logistics Entry</Text>
            </TouchableOpacity>
          )}
          {entries.map((entry, idx) => (
            <View key={entry.id} style={s.entryCard}>
              <View style={s.entryHdr}>
                <Text style={s.entryNum}>Entry {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeEntry(entry.id)} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={18} color={COLORS.negative} />
                </TouchableOpacity>
              </View>
              <View style={s.typeRow}>
                {LOG_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.typeChip, entry.type === t.value && s.typeChipActive]}
                    onPress={() => updateEntry(entry.id, 'type', t.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.typeTxt, entry.type === t.value && s.typeTxtActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fl}>Amount (₹)</Text>
                  <TextInput style={s.fi} value={entry.amount} onChangeText={v => updateEntry(entry.id, 'amount', v)}
                    keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fl}>Tracking No.</Text>
                  <TextInput style={s.fi} value={entry.tracking} onChangeText={v => updateEntry(entry.id, 'tracking', v)}
                    placeholder="Optional" placeholderTextColor={COLORS.textTertiary} />
                </View>
              </View>
              <Text style={s.fl}>Remarks</Text>
              <TextInput style={[s.fi, { minHeight: 36 }]} value={entry.remarks}
                onChangeText={v => updateEntry(entry.id, 'remarks', v)}
                placeholder="Optional" placeholderTextColor={COLORS.textTertiary} multiline />
            </View>
          ))}
          {entries.length > 0 && (
            <>
              <FormDropdown label="Tax on All Logistics" value={taxRate} options={TAX_OPTS}
                onSelect={o => onTaxRateChange(o.value)} placeholder="Select tax rate..." />
              {total > 0 && (
                <View style={s.totalRow}>
                  <Text style={s.totalL}>Total Logistics Charges</Text>
                  <Text style={s.totalV}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: SPACING.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  hl: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  hTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  cnt: { backgroundColor: COLORS.brandPrimary, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cntTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  totalChip: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.positive, backgroundColor: COLORS.positiveBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  hr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.positive },
  body: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.positive + '40', borderRadius: RADIUS.md, borderStyle: 'dashed', marginTop: SPACING.md, backgroundColor: COLORS.positiveBg },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.positive },
  entryCard: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  entryHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  entryNum: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: SPACING.sm },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  typeChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  typeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  typeTxtActive: { color: '#fff' },
  row2: { flexDirection: 'row', gap: 8, marginBottom: SPACING.sm },
  fl: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  fi: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, minHeight: 38 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginTop: SPACING.sm },
  totalL: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  totalV: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.positive },
});
