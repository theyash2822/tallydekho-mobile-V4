import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';

const AMBER = '#A89060';

const ALL_ITEMS = [
  { id: '1', name: 'Black JBL Speaker',     sku: 'PRD-1002-ABC', barcode: '8901234567890', price: '₹2,499',  batch: 'B2024-01', expiry: '12/2025' },
  { id: '2', name: 'Sony WH-1000XM5',       sku: 'SNY-001',      barcode: '4902780764600', price: '₹28,990', batch: 'B2024-03', expiry: '06/2026' },
  { id: '3', name: 'JBL Wired Speaker',     sku: 'JWS-456',      barcode: '6925281932892', price: '₹1,299',  batch: 'B2023-12', expiry: '03/2025' },
  { id: '4', name: 'Logitech MX Keys',      sku: 'LGT-MX01',     barcode: '5099206080454', price: '₹8,995',  batch: 'B2024-02', expiry: '01/2027' },
  { id: '5', name: 'Apple USB-C Cable 2m',  sku: 'APL-C01',      barcode: '0194253396160', price: '₹1,999',  batch: 'B2024-05', expiry: 'N/A'     },
  { id: '6', name: 'Samsung Galaxy Buds',   sku: 'SAM-GB01',     barcode: '8806090887666', price: '₹6,499',  batch: 'B2024-04', expiry: '07/2026' },
  { id: '7', name: 'Boat Rockerz 450',      sku: 'BOAT-R450',    barcode: '8906071579834', price: '₹1,499',  batch: 'B2023-11', expiry: '11/2025' },
  { id: '8', name: 'HDMI Cable 3m',         sku: 'HDMI-3M',      barcode: '6971169580018', price: '₹599',    batch: 'B2024-01', expiry: 'N/A'     },
  { id: '9', name: 'Wireless Mouse',        sku: 'LGT-MS01',     barcode: '5099206084742', price: '₹2,295',  batch: 'B2024-03', expiry: 'N/A'     },
];

const LABEL_SIZES = ['50×30 mm', '38×25 mm', '100×50 mm', 'A4'];

export default function PrintSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ids?: string }>(); // comma-separated IDs

  // Resolve queued items from params
  const initialIds = params.ids ? params.ids.split(',').filter(Boolean) : ALL_ITEMS.slice(0, 3).map(i => i.id);
  const [queueIds, setQueueIds] = useState<string[]>(initialIds);
  const queuedItems = ALL_ITEMS.filter(i => queueIds.includes(i.id));

  // ── Print settings state
  const [labelSize, setLabelSize]     = useState('50×30 mm');
  const [sizeOpen, setSizeOpen]       = useState(false);
  const [copies, setCopies]           = useState(1);
  const [showSku, setShowSku]         = useState(true);
  const [showPrice, setShowPrice]     = useState(true);
  const [showBatch, setShowBatch]     = useState(true);

  const removeItem = (id: string) => setQueueIds(prev => prev.filter(i => i !== id));

  const handlePreview = () => {
    if (queuedItems.length === 0) return;
    router.push({
      pathname: '/stocks/label-preview',
      params: {
        ids: queueIds.join(','),
        labelSize,
        copies: String(copies),
        showSku: showSku ? '1' : '0',
        showPrice: showPrice ? '1' : '0',
        showBatch: showBatch ? '1' : '0',
      },
    } as any);
  };

  const handlePrintExport = () => {
    Toast.show({ type: 'success', text1: `Sending ${queuedItems.length * copies} labels to printer…` });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Print</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">

        {/* ── Queued items chips */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Print Queue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {queuedItems.length === 0 ? (
              <Text style={s.emptyQueue}>No items in queue. Go back to select items.</Text>
            ) : (
              queuedItems.map(item => (
                <View key={item.id} style={s.queueChip}>
                  <Text style={s.queueChipText} numberOfLines={1}>{item.name}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.7}>
                    <Ionicons name="close" size={14} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <View style={s.divider} />

        {/* ── Label Size */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Label Size</Text>
          <TouchableOpacity
            style={s.dropdownTrigger}
            onPress={() => setSizeOpen(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.dropdownValue}>{labelSize}</Text>
            <Ionicons name={sizeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {sizeOpen && (
            <View style={s.dropdownList}>
              {LABEL_SIZES.map(sz => (
                <TouchableOpacity
                  key={sz}
                  style={s.dropdownItem}
                  onPress={() => { setLabelSize(sz); setSizeOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropdownItemText, labelSize === sz && s.dropdownItemActive]}>{sz}</Text>
                  {labelSize === sz && <Ionicons name="checkmark" size={16} color={AMBER} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={s.divider} />

        {/* ── Copies per barcode */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Copies per barcode</Text>
          <View style={s.stepper}>
            <TouchableOpacity
              style={s.stepBtn}
              onPress={() => setCopies(v => Math.max(1, v - 1))}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={s.stepValueWrap}>
              <TextInput
                style={s.stepValue}
                value={String(copies)}
                onChangeText={v => { const n = parseInt(v, 10); if (!isNaN(n) && n > 0) setCopies(n); }}
                keyboardType="numeric"
                textAlign="center"
              />
            </View>
            <TouchableOpacity
              style={s.stepBtn}
              onPress={() => setCopies(v => v + 1)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Layout per label */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Layout per label</Text>

          <TouchableOpacity style={s.checkRow} onPress={() => setShowSku(v => !v)} activeOpacity={0.7}>
            <Text style={s.checkLabel}>Show SKU</Text>
            <View style={[s.checkbox, showSku && s.checkboxActive]}>
              {showSku && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>

          <View style={s.checkDivider} />

          <TouchableOpacity style={s.checkRow} onPress={() => setShowPrice(v => !v)} activeOpacity={0.7}>
            <Text style={s.checkLabel}>Show Price</Text>
            <View style={[s.checkbox, showPrice && s.checkboxActive]}>
              {showPrice && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>

          <View style={s.checkDivider} />

          <TouchableOpacity style={s.checkRow} onPress={() => setShowBatch(v => !v)} activeOpacity={0.7}>
            <Text style={s.checkLabel}>Show Batch/Expiry</Text>
            <View style={[s.checkbox, showBatch && s.checkboxActive]}>
              {showBatch && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom action bar */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[s.previewBtn, queuedItems.length === 0 && s.btnDisabled]}
          onPress={handlePreview}
          activeOpacity={0.85}
          disabled={queuedItems.length === 0}
        >
          <Ionicons name="eye-outline" size={18} color="#fff" />
          <Text style={s.previewBtnText}>Preview Label</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.exportBtn, queuedItems.length === 0 && s.btnDisabled]}
          onPress={handlePrintExport}
          activeOpacity={0.8}
          disabled={queuedItems.length === 0}
        >
          <Text style={s.exportBtnText}>Print / Export</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  section:     { paddingVertical: SPACING.md },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  divider:     { height: 1, backgroundColor: COLORS.borderDefault },
  emptyQueue:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontStyle: 'italic' },

  // ── Queue chips
  queueChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, maxWidth: 200 },
  queueChipText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, flexShrink: 1 },

  // ── Label Size dropdown
  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  dropdownValue:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  dropdownList:    { marginTop: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  dropdownItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropdownItemText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dropdownItemActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // ── Copies stepper
  stepper:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  stepBtn:       { width: 56, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.hoverBg },
  stepValueWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue:     { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', padding: 0, width: '100%' },

  // ── Layout checkboxes
  checkRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  checkLabel:    { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  checkDivider:  { height: 1, backgroundColor: COLORS.borderDefault },
  checkbox:      { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  // ── Bottom bar
  bottomBar:    { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: SPACING.sm },
  previewBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  previewBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  exportBtn:    { height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  exportBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  btnDisabled:   { opacity: 0.4 },
});
