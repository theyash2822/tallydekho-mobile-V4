import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getBarcodesByGuids } from '../../src/services/api';

const AMBER = '#A89060';

type PreviewItem = {
  stockGuid:   string;
  displayName: string;
  sku:         string | null;
  barcode:     string | null;
  closingRate: number;
};

// ─── SVG Barcode Generator ───────────────────────────────────────────────────
// Visual representation only — not a real scannable barcode renderer
function BarcodeSVG({ code, width = 240, height = 60 }: { code: string; width?: number; height?: number }) {
  const bars: { x: number; w: number; h: number }[] = [];
  let x = 0;
  const totalBars = 52;
  const spacing = width / (totalBars * 1.8);
  for (let i = 0; i < totalBars; i++) {
    const charCode = code.charCodeAt(i % code.length);
    const w = charCode % 3 === 0 ? 3 : charCode % 3 === 1 ? 2 : 1.5;
    const h = height - (charCode % 2 === 0 ? 0 : 8);
    bars.push({ x, w, h });
    x += w + spacing;
  }
  return (
    <Svg width={width} height={height}>
      {bars.map((bar, i) => (
        <Rect key={i} x={bar.x} y={height - bar.h} width={bar.w} height={bar.h} fill="#1A1A1A" rx={0.5} />
      ))}
    </Svg>
  );
}

export default function LabelPreviewScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{
    ids?: string; labelSize?: string; copies?: string;
    showSku?: string; showPrice?: string; showBatch?: string;
  }>();
  const { company } = useAuth();
  const companyGuid = company?.guid ?? '';

  const stockGuids = params.ids ? params.ids.split(',').filter(Boolean) : [];
  const labelSize  = params.labelSize ?? '50×30 mm';
  const copies     = parseInt(params.copies ?? '1', 10);
  const showSku    = params.showSku   !== '0';
  const showPrice  = params.showPrice !== '0';
  const showBatch  = params.showBatch !== '0';

  const [items,      setItems]      = useState<PreviewItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [printing,   setPrinting]   = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!companyGuid || !stockGuids.length) return;
    setLoading(true);
    getBarcodesByGuids(companyGuid, stockGuids)
      .then((res: any) => {
        setItems(res?.data?.items || res?.items || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [companyGuid]);

  const currentItem = items[currentIdx] ?? null;

  // ── Header (always shown)
  const Header = () => (
    <View style={s.header}>
      <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>Label Preview</Text>
      <TouchableOpacity style={s.headerBtn} onPress={handlePrintNow} activeOpacity={0.7} disabled={printing}>
        {printing
          ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
          : <Ionicons name="print-outline" size={22} color={COLORS.textPrimary} />}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={s.centeredWrap}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!currentItem) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <Header />
        <View style={s.centeredWrap}>
          <Ionicons name="barcode-outline" size={48} color={COLORS.textTertiary} />
          <Text style={s.emptyText}>No items to preview</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fmtPrice = (rate: number) =>
    rate > 0 ? `₹${rate.toLocaleString('en-IN')}` : '—';

  // ── Build print HTML (same logic as print-settings) ───────────────────────
  const buildHTML = () => {
    const labelSize = params.labelSize ?? '50×30 mm';
    const dimMap: Record<string, { w: string; h: string; fs: string }> = {
      '50×30 mm':  { w: '50mm',  h: '30mm',  fs: '8pt'  },
      '38×25 mm':  { w: '38mm',  h: '25mm',  fs: '7pt'  },
      '100×50 mm': { w: '100mm', h: '50mm',  fs: '10pt' },
      'A4':        { w: '210mm', h: '297mm', fs: '10pt' },
    };
    const dim = dimMap[labelSize] || dimMap['50×30 mm'];
    const isA4 = labelSize === 'A4';
    const labelCss = isA4
      ? `display:inline-block;width:${dim.w};page-break-inside:avoid;margin:2mm;font-size:${dim.fs};`
      : `display:block;width:${dim.w};height:${dim.h};page-break-after:always;font-size:${dim.fs};`;
    const labelHtml = items.flatMap(item => {
      const bars = (item.barcode || item.displayName).split('').slice(0, 40).map((ch, i) => {
        const code = ch.charCodeAt(0);
        const w = code % 3 === 0 ? '0.8mm' : code % 3 === 1 ? '0.5mm' : '0.3mm';
        const h = code % 2 === 0 ? '10mm' : '8mm';
        return i % 2 === 0
          ? `<div style="background:#000;width:${w};height:${h}"></div>`
          : `<div style="width:${w}"></div>`;
      }).join('');
      return Array.from({ length: copies }).map(() => `
        <div style="${labelCss}border:0.3mm solid #ccc;box-sizing:border-box;padding:1.5mm;
          display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:1mm">${item.displayName}</div>
          <div style="display:flex;align-items:flex-end;gap:0.3mm;height:10mm;margin-bottom:0.5mm">${bars}</div>
          <div style="font-size:5.5pt;letter-spacing:1.5pt;color:#333;margin-bottom:0.5mm">${item.barcode || '—'}</div>
          ${showSku && item.sku ? `<div style="font-size:5.5pt;color:#555">SKU: ${item.sku}</div>` : ''}
          ${showPrice ? `<div style="font-size:5.5pt;color:#555">${fmtPrice(item.closingRate)}</div>` : ''}
        </div>`);
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>@page{margin:0;size:${isA4 ? 'A4' : `${dim.w} ${dim.h}`}}body{margin:0;padding:${isA4 ? '5mm' : '0'};font-family:Arial,sans-serif}</style>
      </head><body>${labelHtml}</body></html>`;
  };

  const handlePrintNow = async () => {
    if (!items.length) return;
    setPrinting(true);
    try {
      await Print.printAsync({ html: buildHTML() });
    } catch (err: any) {
      if (!err?.message?.includes('cancel'))
        Alert.alert('Print failed', err?.message || 'Could not open print dialog');
    } finally { setPrinting(false); }
  };

  const handleSharePDF = async () => {
    if (!items.length) return;
    setPrinting(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHTML() });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share barcode labels' });
      else Alert.alert('PDF saved', uri);
    } catch (err: any) {
      if (!err?.message?.includes('cancel'))
        Alert.alert('Export failed', err?.message || 'Could not export PDF');
    } finally { setPrinting(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Header />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── Info strip */}
        <View style={s.infoStrip}>
          <View style={s.infoItem}><Text style={s.infoLabel}>Size</Text><Text style={s.infoValue}>{labelSize}</Text></View>
          <View style={s.infoSep} />
          <View style={s.infoItem}><Text style={s.infoLabel}>Copies</Text><Text style={s.infoValue}>{copies}</Text></View>
          <View style={s.infoSep} />
          <View style={s.infoItem}><Text style={s.infoLabel}>Items</Text><Text style={s.infoValue}>{items.length}</Text></View>
          <View style={s.infoSep} />
          <View style={s.infoItem}><Text style={s.infoLabel}>Total</Text><Text style={s.infoValue}>{items.length * copies}</Text></View>
        </View>

        {/* ── Item navigator */}
        {items.length > 1 && (
          <View style={s.navRow}>
            <TouchableOpacity style={[s.navBtn, currentIdx === 0 && s.navBtnDisabled]} onPress={() => setCurrentIdx(v => Math.max(0, v - 1))} activeOpacity={0.7} disabled={currentIdx === 0}>
              <Ionicons name="chevron-back" size={18} color={currentIdx === 0 ? COLORS.textTertiary : COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={s.navText}>{currentIdx + 1} / {items.length}</Text>
            <TouchableOpacity style={[s.navBtn, currentIdx === items.length - 1 && s.navBtnDisabled]} onPress={() => setCurrentIdx(v => Math.min(items.length - 1, v + 1))} activeOpacity={0.7} disabled={currentIdx === items.length - 1}>
              <Ionicons name="chevron-forward" size={18} color={currentIdx === items.length - 1 ? COLORS.textTertiary : COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ════════════════════════════════════════
            LABEL CARD
        ════════════════════════════════════════ */}
        <View style={s.labelContainer}>
          <View style={s.labelCard}>
            <View style={s.labelSizeBadge}><Text style={s.labelSizeBadgeText}>{labelSize}</Text></View>

            <Text style={s.labelItemName} numberOfLines={2}>{currentItem.displayName}</Text>

            {/* Barcode visual */}
            <View style={s.barcodeWrap}>
              <BarcodeSVG code={currentItem.barcode || currentItem.displayName} width={240} height={60} />
            </View>
            <Text style={s.barcodeNumber}>
              {currentItem.barcode || 'No barcode linked'}
            </Text>

            {/* Optional fields */}
            {(showSku || showPrice) && (
              <View style={s.labelFields}>
                {showSku && currentItem.sku && (
                  <View style={s.labelFieldRow}>
                    <Text style={s.labelFieldKey}>SKU</Text>
                    <Text style={s.labelFieldVal}>{currentItem.sku}</Text>
                  </View>
                )}
                {showPrice && (
                  <View style={s.labelFieldRow}>
                    <Text style={s.labelFieldKey}>Price</Text>
                    <Text style={s.labelFieldVal}>{fmtPrice(currentItem.closingRate)}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={s.labelShadow} />
        </View>

        {/* ── All items list */}
        {items.length > 1 && (
          <View style={s.allItemsSection}>
            <Text style={s.allItemsTitle}>All items in queue</Text>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={item.stockGuid}
                style={[s.allItemRow, currentIdx === idx && s.allItemRowActive]}
                onPress={() => setCurrentIdx(idx)}
                activeOpacity={0.7}
              >
                <View style={s.allItemIconWrap}>
                  <Ionicons name="cube-outline" size={16} color={currentIdx === idx ? '#fff' : COLORS.textSecondary} />
                </View>
                <View style={s.allItemInfo}>
                  <Text style={[s.allItemName, currentIdx === idx && s.allItemNameActive]} numberOfLines={1}>{item.displayName}</Text>
                  <Text style={s.allItemSku}>{item.barcode || item.sku || '—'}</Text>
                </View>
                <View style={s.allItemBarcodePreview}>
                  {[12, 8, 14, 6, 10, 12, 8, 10, 6, 14].map((h, j) => (
                    <View key={j} style={[s.miniBar, { height: h }]} />
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={s.editBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={16} color={COLORS.textPrimary} />
          <Text style={s.editBtnText}>Edit Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.printNowBtn, printing && { opacity: 0.6 }]}
          onPress={handlePrintNow}
          activeOpacity={0.85}
          disabled={printing}
        >
          {printing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="print-outline" size={18} color="#fff" />}
          <Text style={s.printNowBtnText}>{printing ? 'Opening…' : 'Print Now'}</Text>
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
  scrollContent: { paddingTop: SPACING.md },
  centeredWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  infoStrip:  { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingVertical: 12, marginBottom: SPACING.md },
  infoItem:   { flex: 1, alignItems: 'center' },
  infoLabel:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 3 },
  infoValue:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  infoSep:    { width: 1, height: 28, backgroundColor: COLORS.borderDefault },

  navRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: SPACING.md },
  navBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.35 },
  navText:        { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, minWidth: 50, textAlign: 'center' },

  labelContainer: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  labelCard:      { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, position: 'relative' },
  labelShadow:    { height: 8, borderRadius: RADIUS.lg, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.xl, marginTop: -4 },
  labelSizeBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.hoverBg, borderRadius: RADIUS.full },
  labelSizeBadgeText: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600' },
  labelItemName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.md, paddingHorizontal: 30 },
  barcodeWrap:    { marginBottom: 6 },
  barcodeNumber:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, letterSpacing: 2, marginBottom: SPACING.md },
  labelFields:    { width: '100%', borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: SPACING.sm, gap: 4 },
  labelFieldRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  labelFieldKey:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  labelFieldVal:  { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },

  allItemsSection: { marginHorizontal: SPACING.md, marginTop: SPACING.sm },
  allItemsTitle:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  allItemRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, marginBottom: 6, borderWidth: 1, borderColor: COLORS.borderDefault },
  allItemRowActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  allItemIconWrap: { width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  allItemInfo:     { flex: 1 },
  allItemName:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  allItemNameActive: { color: '#fff' },
  allItemSku:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  allItemBarcodePreview: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5 },
  miniBar:         { width: 2.5, backgroundColor: COLORS.borderStrong, borderRadius: 1 },

  bottomBar:       { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  editBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  editBtnText:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  printNowBtn:     { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  printNowBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
