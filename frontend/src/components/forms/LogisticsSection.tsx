import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

export interface LogEntry {
  id: string;
  type: string;
  amount: string;
  taxRate: string;   // per-entry tax rate
  tracking: string;
  remarks: string;
}

const LOG_TYPES = [
  { label: 'Courier',   value: 'courier',   icon: 'bicycle-outline' },
  { label: 'Transport', value: 'transport', icon: 'car-outline' },
  { label: 'Freight',   value: 'freight',   icon: 'boat-outline' },
  { label: 'Custom',    value: 'custom',    icon: 'build-outline' },
] as const;

const TAX_OPTS = [
  { label: '0%',  value: '0' },
  { label: '5%',  value: '5' },
  { label: '12%', value: '12' },
  { label: '18%', value: '18' },
  { label: '28%', value: '28' },
];

const entryTotal = (e: LogEntry): number => {
  const base = parseFloat(e.amount) || 0;
  return base + base * (parseFloat(e.taxRate) || 0) / 100;
};

export function calcLogisticsTotal(entries: LogEntry[]): number {
  return entries.reduce((sum, e) => sum + entryTotal(e), 0);
}

interface Props {
  entries: LogEntry[];
  onEntriesChange: (e: LogEntry[]) => void;
}

export default function LogisticsSection({ entries, onEntriesChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const total = calcLogisticsTotal(entries);

  const addEntry = () => {
    onEntriesChange([
      ...entries,
      { id: Date.now().toString(), type: 'courier', amount: '', taxRate: '0', tracking: '', remarks: '' },
    ]);
    setExpanded(true);
  };

  const update = (id: string, field: keyof LogEntry, value: string) =>
    onEntriesChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  const remove = (id: string) =>
    onEntriesChange(entries.filter(e => e.id !== id));

  return (
    <View style={s.container}>
      {/* Header */}
      <TouchableOpacity style={s.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={s.hl}>
          <View style={[s.headerIcon, { backgroundColor: expanded ? COLORS.infoBg : COLORS.pageBg }]}>
            <Ionicons name="car-outline" size={16} color={expanded ? COLORS.info : COLORS.textSecondary} />
          </View>
          <View>
            <Text style={s.hTxt}>Logistics / Shipping</Text>
            {entries.length > 0 && (
              <Text style={s.hSub}>{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}{total > 0 ? ` · ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''}</Text>
            )}
          </View>
        </View>
        <View style={s.hr}>
          <TouchableOpacity style={s.addBtn} onPress={addEntry} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add</Text>
          </TouchableOpacity>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
        </View>
      </TouchableOpacity>

      {/* Body */}
      {expanded && (
        <View style={s.body}>
          {entries.length === 0 && (
            <TouchableOpacity style={s.emptyBtn} onPress={addEntry} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={17} color={COLORS.positive} />
              <Text style={s.emptyTxt}>Add First Logistics Entry</Text>
            </TouchableOpacity>
          )}

          {entries.map((entry, idx) => {
            const eTotal = entryTotal(entry);
            return (
              <View key={entry.id} style={s.entryCard}>
                {/* Entry header */}
                <View style={s.entryHdr}>
                  <Text style={s.entryNum}>Entry {idx + 1}</Text>
                  {eTotal > 0 && (
                    <Text style={s.entryTotalChip}>
                      ₹{eTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  )}
                  <TouchableOpacity onPress={() => remove(entry.id)} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={18} color={COLORS.negative} />
                  </TouchableOpacity>
                </View>

                {/* Type chips */}
                <View style={s.typeRow}>
                  {LOG_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.value}
                      style={[s.typeChip, entry.type === t.value && s.typeChipActive]}
                      onPress={() => update(entry.id, 'type', t.value)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={t.icon as any} size={11} color={entry.type === t.value ? '#fff' : COLORS.textSecondary} />
                      <Text style={[s.typeTxt, entry.type === t.value && s.typeTxtActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amount + Tax row */}
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fl}>Amount (₹)</Text>
                    <TextInput
                      style={s.fi}
                      value={entry.amount}
                      onChangeText={v => update(entry.id, 'amount', v)}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fl}>Tax Rate</Text>
                    <View style={s.taxChipRow}>
                      {TAX_OPTS.map(t => (
                        <TouchableOpacity
                          key={t.value}
                          style={[s.taxChip, entry.taxRate === t.value && s.taxChipActive]}
                          onPress={() => update(entry.id, 'taxRate', t.value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.taxChipTxt, entry.taxRate === t.value && s.taxChipTxtActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Tracking + Remarks */}
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fl}>Tracking No.</Text>
                    <TextInput
                      style={s.fi}
                      value={entry.tracking}
                      onChangeText={v => update(entry.id, 'tracking', v)}
                      placeholder="Optional"
                      placeholderTextColor={COLORS.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fl}>Remarks</Text>
                    <TextInput
                      style={s.fi}
                      value={entry.remarks}
                      onChangeText={v => update(entry.id, 'remarks', v)}
                      placeholder="Optional"
                      placeholderTextColor={COLORS.textTertiary}
                    />
                  </View>
                </View>
              </View>
            );
          })}

          {/* Total row */}
          {entries.length > 0 && total > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalL}>Total Logistics</Text>
              <Text style={s.totalV}>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: SPACING.md, overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md },
  headerIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  hl: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  hTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  hSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  hr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  addTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.positive },
  body: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.positive + '40', borderRadius: RADIUS.md,
    borderStyle: 'dashed', backgroundColor: COLORS.positiveBg,
  },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.positive },
  entryCard: {
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    padding: SPACING.sm, marginTop: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault, gap: 8,
  },
  entryHdr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryNum: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  entryTotalChip: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.positive,
    backgroundColor: COLORS.positiveBg, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  typeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  typeChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  typeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  typeTxtActive: { color: '#fff' },
  row2: { flexDirection: 'row', gap: 8 },
  fl: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  fi: {
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, minHeight: 38,
  },
  taxChipRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  taxChip: {
    paddingHorizontal: 6, paddingVertical: 5, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  taxChipActive: { backgroundColor: COLORS.info, borderColor: COLORS.info },
  taxChipTxt: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  taxChipTxtActive: { color: '#fff' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: SPACING.sm, marginTop: 4,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  totalL: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  totalV: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.positive },
});
