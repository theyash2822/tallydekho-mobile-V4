import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getBarcodesByGuids } from '../../src/services/api';

const AMBER = '#A89060';
const LABEL_SIZES = ['50×30 mm', '38×25 mm', '100×50 mm', 'A4'];

// ── Label dimensions map (→ CSS mm values)
const LABEL_DIMS: Record<string, { w: string; h: string; fs: string }> = {
  '50×30 mm':  { w: '50mm',  h: '30mm',  fs: '8pt'  },
  '38×25 mm':  { w: '38mm',  h: '25mm',  fs: '7pt'  },
  '100×50 mm': { w: '100mm', h: '50mm',  fs: '10pt' },
  'A4':        { w: '210mm', h: '297mm', fs: '10pt' },
};

// ── Generate print-ready HTML for a set of labels
function buildLabelHTML(
  items: PrintItem[],
  opts: { labelSize: string; copies: number; showSku: boolean; showPrice: boolean; showBatch: boolean }
): string {
  const dim = LABEL_DIMS[opts.labelSize] || LABEL_DIMS['50×30 mm'];
  const isA4 = opts.labelSize === 'A4';
  const labels: string[] = [];

  for (const item of items) {
    const barcode = item.barcode || '—';
    const price   = item.closingRate > 0 ? `₹${item.closingRate.toLocaleString('en-IN')}` : '';
    for (let c = 0; c < opts.copies; c++) {
      labels.push(`
        <div class="label">
          <div class="name">${item.displayName}</div>
          <div class="barcode-bars">
            ${item.barcode ? generateBarcodeBars(item.barcode) : '<span style="color:#aaa;font-size:6pt">no barcode</span>'}
          </div>
          <div class="barcode-num">${barcode}</div>
          ${opts.showSku && item.sku ? `<div class="field">SKU: ${item.sku}</div>` : ''}
          ${opts.showPrice && price ? `<div class="field">Price: ${price}</div>` : ''}
        </div>
      `);
    }
  }

  const labelCss = isA4
    ? `display:inline-block; width:${dim.w}; page-break-inside:avoid; margin:2mm; font-size:${dim.fs};`
    : `display:block; width:${dim.w}; height:${dim.h}; page-break-after:always; font-size:${dim.fs};`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    @page { margin: 0; size: ${isA4 ? 'A4' : `${dim.w} ${dim.h}`}; }
    body  { margin: 0; padding: ${isA4 ? '5mm' : '0'}; font-family: Arial, sans-serif; }
    .label { ${labelCss} border: 0.3mm solid #ccc; box-sizing: border-box; padding: 1.5mm;
              display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .name  { font-weight: 700; font-size: ${dim.fs}; text-align: center; margin-bottom: 1mm;
              max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .barcode-bars { display: flex; align-items: flex-end; gap: 0.3mm; height: 10mm; margin-bottom: 0.5mm; }
    .bar   { background: #000; }
    .barcode-num { font-size: 5.5pt; letter-spacing: 1.5pt; color: #333; margin-bottom: 0.5mm; }
    .field { font-size: 5.5pt; color: #555; }
  </style>
  </head><body>${labels.join('')}</body></html>`;
}

// Generate simple CSS bar representation of barcode (visual only, not scannable spec)
function generateBarcodeBars(code: string): string {
  const bars: string[] = [];
  const totalBars = 40;
  for (let i = 0; i < totalBars; i++) {
    const ch = code.charCodeAt(i % code.length);
    const w  = ch % 3 === 0 ? '0.8mm' : ch % 3 === 1 ? '0.5mm' : '0.3mm';
    const h  = (ch % 2 === 0 ? '10mm' : '8mm');
    if (i % 2 === 0) bars.push(`<div class="bar" style="width:${w};height:${h}"></div>`);
    else bars.push(`<div style="width:${w}"></div>`);
  }
  return bars.join('');
}

export interface PrintItem {
  stockGuid: string;
  displayName: string;
  sku: string | null;
  barcode: string | null;
  closingRate: number;
}

export default function PrintSettingsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ ids?: string }>();
  const { company } = useAuth();
  const companyGuid = company?.guid ?? '';

  // IDs from params are stockGuids (comma-separated)
  const stockGuids = params.ids ? params.ids.split(',').filter(Boolean) : [];

  const [items,    setItems]    = useState<PrintItem[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [queueIds, setQueueIds] = useState<string[]>(stockGuids);

  // Load real item data from API
  useEffect(() => {
    if (!companyGuid || !stockGuids.length) return;
    setLoading(true);
    getBarcodesByGuids(companyGuid, stockGuids)
      .then((res: any) => {
        const d = res?.data?.items || res?.items || [];
        setItems(d);
        setQueueIds(d.map((i: PrintItem) => i.stockGuid));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [companyGuid]);

  const queuedItems = items.filter(i => queueIds.includes(i.stockGuid));

  // ── Print settings state
  const [labelSize, setLabelSize] = useState('50×30 mm');
  const [sizeOpen,  setSizeOpen]  = useState(false);
  const [copies,    setCopies]    = useState(1);
  const [showSku,   setShowSku]   = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBatch, setShowBatch] = useState(false);

  const removeItem = (id: string) => setQueueIds(prev => prev.filter(i => i !== id));

  const handlePreview = () => {
    if (queuedItems.length === 0) return;
    router.push({
      pathname: '/stocks/label-preview',
      params: {
        ids:       queueIds.join(','),
        labelSize,
        copies:    String(copies),
        showSku:   showSku   ? '1' : '0',
        showPrice: showPrice ? '1' : '0',
        showBatch: showBatch ? '1' : '0',
      },
    } as any);
  };

  const [printing, setPrinting] = useState(false);

  const handlePrintExport = async () => {
    if (!queuedItems.length) return;
    setPrinting(true);
    try {
      const html = buildLabelHTML(queuedItems, { labelSize, copies, showSku, showPrice, showBatch });
      await Print.printAsync({ html });
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) {
        Alert.alert('Print failed', err?.message || 'Could not open print dialog');
      }
    } finally { setPrinting(false); }
  };

  const handleExportPDF = async () => {
    if (!queuedItems.length) return;
    setPrinting(true);
    try {
      const html = buildLabelHTML(queuedItems, { labelSize, copies, showSku, showPrice, showBatch });
      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share barcode labels PDF' });
      } else {
        Alert.alert('PDF saved', `Saved to: ${uri}`);
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) {
        Alert.alert('Export failed', err?.message || 'Could not export PDF');
      }
    } finally { setPrinting(false); }
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
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ alignSelf: 'flex-start' }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {queuedItems.length === 0 ? (
                <Text style={s.emptyQueue}>No items in queue. Go back to select items.</Text>
              ) : (
                queuedItems.map(item => (
                  <View key={item.stockGuid} style={s.queueChip}>
                    <Text style={s.queueChipText} numberOfLines={1}>{item.displayName}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.stockGuid)} activeOpacity={0.7}>
                      <Ionicons name="close" size={14} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>

        <View style={s.divider} />

        {/* ── Label Size */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Label Size</Text>
          <TouchableOpacity style={s.dropdownTrigger} onPress={() => setSizeOpen(v => !v)} activeOpacity={0.7}>
            <Text style={s.dropdownValue}>{labelSize}</Text>
            <Ionicons name={sizeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {sizeOpen && (
            <View style={s.dropdownList}>
              {LABEL_SIZES.map(sz => (
                <TouchableOpacity key={sz} style={s.dropdownItem} onPress={() => { setLabelSize(sz); setSizeOpen(false); }} activeOpacity={0.7}>
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
            <TouchableOpacity style={s.stepBtn} onPress={() => setCopies(v => Math.max(1, v - 1))} activeOpacity={0.7}>
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
            <TouchableOpacity style={s.stepBtn} onPress={() => setCopies(v => v + 1)} activeOpacity={0.7}>
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
        {/* Row 1: Preview + Print */}
        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.previewBtn, (queuedItems.length === 0 || loading) && s.btnDisabled]}
            onPress={handlePreview}
            activeOpacity={0.85}
            disabled={queuedItems.length === 0 || loading}
          >
            <Ionicons name="eye-outline" size={18} color="#fff" />
            <Text style={s.previewBtnText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.printBtn, (queuedItems.length === 0 || loading || printing) && s.btnDisabled]}
            onPress={handlePrintExport}
            activeOpacity={0.85}
            disabled={queuedItems.length === 0 || loading || printing}
          >
            {printing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="print-outline" size={18} color="#fff" />}
            <Text style={s.previewBtnText}>
              {printing ? 'Opening…' : `Print ${queuedItems.length * copies}`}
            </Text>
          </TouchableOpacity>
        </View>
        {/* Row 2: Export PDF */}
        <TouchableOpacity
          style={[s.exportBtn, (queuedItems.length === 0 || loading || printing) && s.btnDisabled]}
          onPress={handleExportPDF}
          activeOpacity={0.8}
          disabled={queuedItems.length === 0 || loading || printing}
        >
          <Ionicons name="share-outline" size={16} color={COLORS.textPrimary} />
          <Text style={s.exportBtnText}>Export / Share as PDF</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.pageBg },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:   { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  section:       { paddingVertical: SPACING.md },
  sectionLabel:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm },
  divider:       { height: 1, backgroundColor: COLORS.borderDefault },
  emptyQueue:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontStyle: 'italic' },

  queueChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, maxWidth: 200 },
  queueChipText: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary, flexShrink: 1 },

  dropdownTrigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  dropdownValue:   { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  dropdownList:    { marginTop: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  dropdownItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropdownItemText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  dropdownItemActive: { color: COLORS.textPrimary, fontWeight: '700' },

  stepper:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  stepBtn:       { width: 56, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.hoverBg },
  stepValueWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue:     { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', padding: 0, width: '100%' },

  checkRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  checkLabel:     { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  checkDivider:   { height: 1, backgroundColor: COLORS.borderDefault },
  checkbox:       { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  bottomBar:      { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: SPACING.sm },
  btnRow:         { flexDirection: 'row', gap: SPACING.sm },
  previewBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  printBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: RADIUS.md, backgroundColor: '#2D7D46' },
  previewBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },
  exportBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  exportBtnText:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  btnDisabled:    { opacity: 0.4 },
});
