import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const PRINT_QUEUE = [
  { id: 'P1', name: 'JBL Speaker – BT50', sku: 'JBL-BT50', qty: 10, selected: true },
  { id: 'P2', name: 'Sony WH-1000XM5', sku: 'SNY-001', qty: 5, selected: true },
  { id: 'P3', name: 'USB Type-C Cable 2m', sku: 'USB-C-2M', qty: 25, selected: true },
  { id: 'P4', name: 'HDMI Cable 3m', sku: 'HDMI-3M', qty: 8, selected: false },
  { id: 'P5', name: 'Wireless Mouse Logitech', sku: 'LGT-MS01', qty: 12, selected: true },
];

export default function PrintBarcodesScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState(PRINT_QUEUE);
  const [activeLabelSize, setActiveLabelSize] = useState('38x25');
  const [activePrinter, setActivePrinter] = useState('Zebra ZD220');

  const selectedCount = queue.filter(q => q.selected).length;
  const totalLabels = queue.filter(q => q.selected).reduce((a, q) => a + q.qty, 0);

  const toggle = (id: string) => setQueue(prev => prev.map(q => q.id === id ? { ...q, selected: !q.selected } : q));
  const updateQty = (id: string, delta: number) => setQueue(prev => prev.map(q => q.id === id ? { ...q, qty: Math.max(1, q.qty + delta) } : q));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Print Barcodes</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Print Settings */}
      <View style={s.settingsBar}>
        <View style={s.settingGroup}>
          <Text style={s.settingLbl}>Label Size</Text>
          <View style={s.settingChips}>
            {['38x25', '50x25', '100x50'].map(sz => (
              <TouchableOpacity key={sz} style={[s.settingChip, activeLabelSize === sz && s.settingChipActive]} onPress={() => setActiveLabelSize(sz)} activeOpacity={0.7}>
                <Text style={[s.settingChipTxt, activeLabelSize === sz && s.settingChipActiveTxt]}>{sz}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={s.settingDivider} />
        <View style={s.settingGroup}>
          <Text style={s.settingLbl}>Printer</Text>
          <TouchableOpacity style={s.printerBtn} activeOpacity={0.7}>
            <Ionicons name="print-outline" size={14} color={COLORS.brandPrimary} />
            <Text style={s.printerTxt}>{activePrinter}</Text>
            <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Row */}
      <View style={s.summaryRow}>
        <Text style={s.summaryTxt}>{selectedCount} items selected · {totalLabels} labels to print</Text>
        <TouchableOpacity onPress={() => setQueue(q => q.map(i => ({ ...i, selected: true })))} activeOpacity={0.7}>
          <Text style={s.selectAllTxt}>Select All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {queue.map((item, i) => (
          <View key={item.id} style={[s.queueRow, !item.selected && s.queueRowDimmed, i < queue.length - 1 && s.rowBorder]}>
            <TouchableOpacity onPress={() => toggle(item.id)} activeOpacity={0.7} style={s.checkbox}>
              <View style={[s.checkBox, item.selected && s.checkBoxActive]}>
                {item.selected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
            </TouchableOpacity>

            {/* Barcode Preview */}
            <View style={s.barcodePreview}>
              {[12, 8, 14, 6, 10, 12, 8, 10].map((h, j) => (
                <View key={j} style={[s.barLine, { height: h }]} />
              ))}
            </View>

            <View style={s.itemInfo}>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.itemSku}>{item.sku}</Text>
            </View>

            {/* Qty Stepper */}
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => updateQty(item.id, -1)} activeOpacity={0.7}>
                <Ionicons name="remove" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={s.stepQty}>{item.qty}</Text>
              <TouchableOpacity style={s.stepBtn} onPress={() => updateQty(item.id, 1)} activeOpacity={0.7}>
                <Ionicons name="add" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Print Button */}
      <View style={s.printBar}>
        <View style={s.printInfo}>
          <Text style={s.printInfoTxt}>{totalLabels} labels · {activeLabelSize}mm · {activePrinter}</Text>
        </View>
        <TouchableOpacity style={[s.printBtn, selectedCount === 0 && { opacity: 0.5 }]} disabled={selectedCount === 0} activeOpacity={0.85}>
          <Ionicons name="print-outline" size={20} color={COLORS.white} />
          <Text style={s.printBtnTxt}>Print {totalLabels} Labels</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  settingsBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  settingGroup: { flex: 1, gap: 6 },
  settingLbl: { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase' },
  settingChips: { flexDirection: 'row', gap: 6 },
  settingChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  settingChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  settingChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  settingChipActiveTxt: { color: COLORS.white },
  settingDivider: { width: 1, height: 40, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.sm },
  printerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  printerTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  summaryTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  selectAllTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  queueRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, gap: 10 },
  queueRowDimmed: { opacity: 0.45 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  checkbox: { padding: 4 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkBoxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  barcodePreview: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 6, paddingVertical: 3, backgroundColor: '#F8F8F8', borderRadius: 4, borderWidth: 1, borderColor: COLORS.borderDefault },
  barLine: { width: 3, backgroundColor: '#1A1A1A', borderRadius: 1 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 0, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  stepQty: { width: 28, textAlign: 'center', fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  printBar: { padding: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 8 },
  printInfo: { alignItems: 'center' },
  printInfoTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.brandPrimary, paddingVertical: 14, borderRadius: RADIUS.md },
  printBtnTxt: { color: COLORS.white, fontSize: TYPOGRAPHY.base, fontWeight: '700' },
});
