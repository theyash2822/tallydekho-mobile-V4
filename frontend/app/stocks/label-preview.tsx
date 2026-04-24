import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

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

// ─── SVG Barcode Generator ──────────────────────────────────────────────────
function BarcodeSVG({ code, width = 240, height = 60 }: { code: string; width?: number; height?: number }) {
  // Generate pseudo-barcode bars from string (visual representation)
  const bars: { x: number; w: number; h: number }[] = [];
  let x = 0;
  const totalBars = 52;
  const spacing = width / (totalBars * 1.8);

  for (let i = 0; i < totalBars; i++) {
    const charCode = code.charCodeAt(i % code.length);
    const w = (charCode % 3 === 0) ? 3 : (charCode % 3 === 1) ? 2 : 1.5;
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
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const params   = useLocalSearchParams<{
    ids?: string; labelSize?: string; copies?: string;
    showSku?: string; showPrice?: string; showBatch?: string;
  }>();

  const ids       = params.ids       ? params.ids.split(',').filter(Boolean)  : ['1'];
  const labelSize = params.labelSize ?? '50×30 mm';
  const copies    = parseInt(params.copies ?? '1', 10);
  const showSku   = params.showSku   !== '0';
  const showPrice = params.showPrice !== '0';
  const showBatch = params.showBatch !== '0';

  const items = ALL_ITEMS.filter(i => ids.includes(i.id));

  const [currentIdx, setCurrentIdx] = useState(0);
  const currentItem = items[currentIdx] ?? items[0];

  if (!currentItem) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Label Preview</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={s.emptyWrap}>
          <Ionicons name="barcode-outline" size={48} color={COLORS.textTertiary} />
          <Text style={s.emptyText}>No items to preview</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Label Preview</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => Toast.show({ type: 'success', text1: 'Sent to printer' })} activeOpacity={0.7}>
          <Ionicons name="print-outline" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* ── Info strip */}
        <View style={s.infoStrip}>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Size</Text>
            <Text style={s.infoValue}>{labelSize}</Text>
          </View>
          <View style={s.infoSep} />
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Copies</Text>
            <Text style={s.infoValue}>{copies}</Text>
          </View>
          <View style={s.infoSep} />
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Items</Text>
            <Text style={s.infoValue}>{items.length}</Text>
          </View>
          <View style={s.infoSep} />
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Total</Text>
            <Text style={s.infoValue}>{items.length * copies}</Text>
          </View>
        </View>

        {/* ── Item navigator (if multiple items) */}
        {items.length > 1 && (
          <View style={s.navRow}>
            <TouchableOpacity
              style={[s.navBtn, currentIdx === 0 && s.navBtnDisabled]}
              onPress={() => setCurrentIdx(v => Math.max(0, v - 1))}
              activeOpacity={0.7}
              disabled={currentIdx === 0}
            >
              <Ionicons name="chevron-back" size={18} color={currentIdx === 0 ? COLORS.textTertiary : COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={s.navText}>{currentIdx + 1} / {items.length}</Text>
            <TouchableOpacity
              style={[s.navBtn, currentIdx === items.length - 1 && s.navBtnDisabled]}
              onPress={() => setCurrentIdx(v => Math.min(items.length - 1, v + 1))}
              activeOpacity={0.7}
              disabled={currentIdx === items.length - 1}
            >
              <Ionicons name="chevron-forward" size={18} color={currentIdx === items.length - 1 ? COLORS.textTertiary : COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════════════════════════════
            LABEL CARD
        ══════════════════════════════════════ */}
        <View style={s.labelContainer}>
          <View style={s.labelCard}>
            {/* Label size badge */}
            <View style={s.labelSizeBadge}>
              <Text style={s.labelSizeBadgeText}>{labelSize}</Text>
            </View>

            {/* Item name */}
            <Text style={s.labelItemName} numberOfLines={2}>{currentItem.name}</Text>

            {/* Barcode SVG */}
            <View style={s.barcodeWrap}>
              <BarcodeSVG code={currentItem.barcode} width={240} height={60} />
            </View>
            <Text style={s.barcodeNumber}>{currentItem.barcode}</Text>

            {/* Optional fields */}
            {(showSku || showPrice || showBatch) && (
              <View style={s.labelFields}>
                {showSku && (
                  <View style={s.labelFieldRow}>
                    <Text style={s.labelFieldKey}>SKU</Text>
                    <Text style={s.labelFieldVal}>{currentItem.sku}</Text>
                  </View>
                )}
                {showPrice && (
                  <View style={s.labelFieldRow}>
                    <Text style={s.labelFieldKey}>Price</Text>
                    <Text style={s.labelFieldVal}>{currentItem.price}</Text>
                  </View>
                )}
                {showBatch && (
                  <View style={s.labelFieldRow}>
                    <Text style={s.labelFieldKey}>Batch</Text>
                    <Text style={s.labelFieldVal}>{currentItem.batch}</Text>
                  </View>
                )}
                {showBatch && currentItem.expiry !== 'N/A' && (
                  <View style={s.labelFieldRow}>
                    <Text style={s.labelFieldKey}>Exp</Text>
                    <Text style={[s.labelFieldVal, s.expiryVal]}>{currentItem.expiry}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Shadow beneath label */}
          <View style={s.labelShadow} />
        </View>

        {/* ── All items list */}
        {items.length > 1 && (
          <View style={s.allItemsSection}>
            <Text style={s.allItemsTitle}>All items in queue</Text>
            {items.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[s.allItemRow, currentIdx === idx && s.allItemRowActive]}
                onPress={() => setCurrentIdx(idx)}
                activeOpacity={0.7}
              >
                <View style={s.allItemIconWrap}>
                  <Ionicons name="cube-outline" size={16} color={currentIdx === idx ? '#fff' : COLORS.textSecondary} />
                </View>
                <View style={s.allItemInfo}>
                  <Text style={[s.allItemName, currentIdx === idx && s.allItemNameActive]} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.allItemSku}>{item.sku}</Text>
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
          style={s.printNowBtn}
          onPress={() => Toast.show({ type: 'success', text1: `Printing ${items.length * copies} labels…` })}
          activeOpacity={0.85}
        >
          <Ionicons name="print-outline" size={18} color="#fff" />
          <Text style={s.printNowBtnText}>Print Now</Text>
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
  emptyWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // ── Info strip
  infoStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingVertical: 12, marginBottom: SPACING.md,
  },
  infoItem:  { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 3 },
  infoValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  infoSep:   { width: 1, height: 28, backgroundColor: COLORS.borderDefault },

  // ── Navigator
  navRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: SPACING.md },
  navBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.35 },
  navText:        { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, minWidth: 50, textAlign: 'center' },

  // ── Label card
  labelContainer: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  labelCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  labelShadow: {
    height: 8, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.borderDefault,
    marginHorizontal: SPACING.xl,
    marginTop: -4,
  },
  labelSizeBadge: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: COLORS.hoverBg,
    borderRadius: RADIUS.full,
  },
  labelSizeBadgeText: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600' },
  labelItemName: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: SPACING.md, paddingHorizontal: 30,
  },
  barcodeWrap:   { marginBottom: 6 },
  barcodeNumber: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, letterSpacing: 2, marginBottom: SPACING.md },
  labelFields:   { width: '100%', borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: SPACING.sm, gap: 4 },
  labelFieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  labelFieldKey: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  labelFieldVal: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  expiryVal:     { color: COLORS.negative },

  // ── All items list
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

  // ── Bottom bar
  bottomBar:      { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  editBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  editBtnText:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  printNowBtn:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  printNowBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
