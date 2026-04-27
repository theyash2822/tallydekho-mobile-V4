import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { STOCK_ITEMS } from '../../src/data/stockData';
import { useAuth } from '../../src/context/AuthContext';
import { getStockItem } from '../../src/services/api';

// ─── DETAILED ITEM DATA ───────────────────────────────────────────────────────────

const ITEM_DETAILS: Record<string, {
  totalQty: number; stockValue: string; availableQty: number;
  reorderLevel: number; leadTime: number; committedQty: number;
  lastPurchaseRate: string; avgPurchaseRate: string; sellingPrice: string; marginPct: number;
  narration: string;
  movement: { id: string; type: string; ref: string; date: string; qty: string }[];
}> = {
  SI01: { totalQty: 85, stockValue: '₹3,57,000', availableQty: 70, reorderLevel: 20, leadTime: 14, committedQty: 15, lastPurchaseRate: '₹3,800/unit', avgPurchaseRate: '₹3,950/unit', sellingPrice: '₹4,200/unit', marginPct: 6, narration: 'Premium portable Bluetooth speaker. Handle with care.', movement: [ { id: 'M1', type: 'Purchase', ref: 'PO-789', date: '23 Jun', qty: '+100' }, { id: 'M2', type: 'Sale', ref: 'INV-172', date: '19 Jun', qty: '-20' }, { id: 'M3', type: 'Transfer', ref: 'WH-B', date: '14 Jun', qty: '-30' }, { id: 'M4', type: 'Transfer', ref: 'WH-B', date: '14 Jun', qty: '-30' } ] },
  SI02: { totalQty: 320, stockValue: '₹1,44,000', availableQty: 300, reorderLevel: 50, leadTime: 7,  committedQty: 20, lastPurchaseRate: '₹380/unit',   avgPurchaseRate: '₹400/unit',   sellingPrice: '₹450/unit',   marginPct: 12, narration: 'Fast-charging USB-C cable, bulk stock.', movement: [ { id: 'M1', type: 'Purchase', ref: 'PO-812', date: '22 Jun', qty: '+200' }, { id: 'M2', type: 'Sale', ref: 'INV-195', date: '20 Jun', qty: '-50' }, { id: 'M3', type: 'Sale', ref: 'INV-181', date: '16 Jun', qty: '-30' } ] },
  default: { totalQty: 562, stockValue: '₹53,000', availableQty: 85, reorderLevel: 10, leadTime: 35, committedQty: 15, lastPurchaseRate: '₹11.87/unit', avgPurchaseRate: '₹12.50/unit', sellingPrice: '₹18.00/unit', marginPct: 44, narration: '-', movement: [ { id: 'M1', type: 'Purchase', ref: 'PO-789', date: '23 Jun', qty: '+100' }, { id: 'M2', type: 'Sale', ref: 'INV-172', date: '19 Jun', qty: '-20' }, { id: 'M3', type: 'Transfer', ref: 'WH-B', date: '14 Jun', qty: '-30' }, { id: 'M4', type: 'Transfer', ref: 'WH-B', date: '14 Jun', qty: '-30' } ] },
};

const MOV_CONFIG = {
  Purchase: { icon: 'arrow-down-outline',      color: COLORS.positive, bg: COLORS.positiveBg },
  Sale:     { icon: 'arrow-up-outline',         color: COLORS.negative, bg: COLORS.negativeBg },
  Transfer: { icon: 'swap-horizontal-outline',  color: COLORS.info,     bg: COLORS.infoBg     },
};

// ─── BARCODE STRIP (outside screen) ───────────────────────────────────────────────

// Fixed bar-width pattern for a realistic barcode look
const BAR_W   = [3,1,2,1,3,2,1,1,2,1,3,1,1,2,1,2,1,3,2,1,1,2,1,3,2,1,1,2,3,1,1,2,1,3,1,2,1,1,3,2];
const SCALE   = 3;
const B_H     = 50;
const B_TOTAL = BAR_W.reduce((s, w) => s + w * SCALE, 0);

function BarcodeStrip({ value }: { value: string }) {
  let cx = 0;
  const bars: { x: number; w: number; h: number }[] = [];
  BAR_W.forEach((w, i) => {
    if (i % 2 === 0) {
      bars.push({ x: cx, w: w * SCALE, h: i % 6 === 0 ? B_H + 8 : B_H });
    }
    cx += w * SCALE;
  });

  return (
    <View style={bc.wrap}>
      <Svg width={B_TOTAL} height={B_H + 24}>
        {bars.map((b, i) => (
          <Rect key={i} x={b.x} y={0} width={b.w} height={b.h} fill={COLORS.brandPrimary} />
        ))}
        <SvgText
          x={B_TOTAL / 2} y={B_H + 18}
          textAnchor="middle" fontSize="10"
          fill={COLORS.textSecondary}
          letterSpacing="2"
        >
          {value}
        </SvgText>
      </Svg>
    </View>
  );
}
const bc = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: SPACING.md },
});

// ─── KEY MATRIX CELL (outside screen) ──────────────────────────────────────────────

function MatrixCell({
  label, value, valueColor, chevron, onPress,
}: {
  label: string; value: string; valueColor?: string; chevron?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={mc.cell}
      activeOpacity={chevron ? 0.7 : 1}
      onPress={onPress}
      disabled={!chevron}
    >
      <Text style={mc.label}>{label}</Text>
      <View style={mc.valRow}>
        <Text style={[mc.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
        {chevron && <Ionicons name="chevron-forward" size={13} color={COLORS.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
}
const mc = StyleSheet.create({
  cell:   { flex: 1, padding: SPACING.sm, gap: 4, borderRightWidth: 1, borderRightColor: COLORS.borderDefault },
  label:  { fontSize: 10, color: COLORS.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  valRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
});

// ─── PRICING ROW (outside screen) ───────────────────────────────────────────────────

function PricingRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={pr.row}>
      <Text style={pr.label}>{label}</Text>
      <Text style={[pr.value, highlight && { color: '#A89060', fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}
const pr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  value: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id }  = useLocalSearchParams<{ id?: string }>();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [liveItem, setLiveItem] = useState<any>(null);

  useEffect(() => {
    if (!companyGuid || !id) return;
    getStockItem(companyGuid, id as string).then((res: any) => {
      if (res?.data) setLiveItem(res.data);
    }).catch(() => {});
  }, [companyGuid, id]);

  const stockItem = liveItem || STOCK_ITEMS.find(i => i.id === id) || STOCK_ITEMS[0];
  const detail    = ITEM_DETAILS[id || ''] || ITEM_DETAILS.default;

  const [calOpen,  setCalOpen]  = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const dateLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'Last 10d';

  const qtyColor = detail.totalQty < 0 ? COLORS.negative
    : detail.totalQty < detail.reorderLevel ? COLORS.warning
    : COLORS.positive;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{stockItem.name}</Text>
        <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
          <Ionicons name="pencil-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Product hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroName}>{stockItem.name}</Text>
          <Text style={styles.heroSku}>{stockItem.sku}</Text>
          {/* Barcode */}
          <BarcodeStrip value={stockItem.sku} />
        </View>

        {/* Key Matrix */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Key Matrix</Text>
          <View style={styles.matrixGrid}>
            <View style={styles.matrixRow}>
              <MatrixCell label="Total Qty on Hand" value={`${detail.totalQty}`}   valueColor={qtyColor} />
              <MatrixCell label="Total Stock Value" value={detail.stockValue} />
            </View>
            <View style={[styles.matrixRow, styles.matrixRowMid]}>
              <MatrixCell label="Available Qty"    value={`${detail.availableQty}`} valueColor={COLORS.positive} />
              <MatrixCell label="Reorder Level"    value={`${detail.reorderLevel}`} />
            </View>
            <View style={styles.matrixRow}>
              <MatrixCell label="Lead-time Days"   value={`${detail.leadTime}d`} />
              <MatrixCell label="Committed Qty"    value={`${detail.committedQty}`} chevron onPress={() => {}} />
            </View>
          </View>
        </View>

        {/* Pricing & Cost */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing &amp; Cost</Text>
          <PricingRow label="Last Purchase Rate"        value={detail.lastPurchaseRate} />
          <PricingRow label="Average Purchase Rate"     value={detail.avgPurchaseRate} />
          <PricingRow label="Standard Selling Price(s)" value={detail.sellingPrice} />
          <View style={[pr.row, { borderBottomWidth: 0 }]}>
            <Text style={pr.label}>Margin %</Text>
            <View style={styles.marginBadge}>
              <Text style={styles.marginTxt}>{detail.marginPct}%</Text>
            </View>
          </View>
        </View>

        {/* Narration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Narration</Text>
          <Text style={styles.narrationTxt}>{detail.narration}</Text>
        </View>

        {/* Movement History */}
        <View style={styles.card}>
          <View style={styles.movHeader}>
            <Text style={styles.cardTitle}>Movement History</Text>
            <TouchableOpacity
              style={styles.calBtn}
              onPress={() => setCalOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
              <Text style={styles.calBtnTxt}>{dateLabel}</Text>
            </TouchableOpacity>
          </View>
          {detail.movement.map(m => {
            const cfg = MOV_CONFIG[m.type as keyof typeof MOV_CONFIG] || MOV_CONFIG.Transfer;
            const isPos = m.qty.startsWith('+');
            return (
              <View key={m.id} style={styles.movRow}>
                <View style={[styles.movIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={15} color={cfg.color} />
                </View>
                <View style={styles.movInfo}>
                  <Text style={styles.movType}>{m.type}</Text>
                  <Text style={styles.movRef}>{m.ref}</Text>
                </View>
                <Text style={[styles.movQty, { color: isPos ? COLORS.positive : COLORS.negative }]}>
                  {m.qty}
                </Text>
                <Text style={styles.movDate}>{m.date}</Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={calOpen}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 40, alignItems: 'flex-start' },
  headerTitle:{ flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  editBtn:    { width: 40, alignItems: 'flex-end' },
  scroll:     { flex: 1 },

  // Hero
  heroCard: { backgroundColor: COLORS.cardBg, margin: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  heroIcon: { width: 72, height: 72, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  heroName: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  heroSku:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, marginTop: 4, letterSpacing: 0.5 },

  // Shared card
  card:      { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginBottom: 10, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },

  // Key Matrix
  matrixGrid:   { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, overflow: 'hidden' },
  matrixRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  matrixRowMid: { backgroundColor: COLORS.pageBg },

  // Pricing
  marginBadge: { backgroundColor: COLORS.positiveBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  marginTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.positive },

  // Narration
  narrationTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },

  // Movement history
  movHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  calBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault },
  calBtnTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600' },
  movRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  movIcon:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  movInfo:   { flex: 1 },
  movType:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  movRef:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  movQty:    { fontSize: TYPOGRAPHY.base, fontWeight: '800', minWidth: 46, textAlign: 'right' },
  movDate:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, minWidth: 42, textAlign: 'right' },
});
