import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { getStockItem, getStockMovements } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// STRICT PRODUCTION DATA RULE: No mock/fallback data. Real data or — only.
const fmtRs = (n: number | null | undefined, unit = '') =>
  n != null && !isNaN(+n) && +n > 0
    ? `₹${(+n).toLocaleString('en-IN')}${unit}`
    : '—';

const MOV_CONFIG = {
  Purchase:     { color: COLORS.positive },
  Sale:         { color: COLORS.negative },
  Transfer:     { color: COLORS.info     },
  'Stock Journal': { color: COLORS.info  },
};

// ─── BARCODE STRIP ───────────────────────────────────────────────────────────
const BAR_W   = [3,1,2,1,3,2,1,1,2,1,3,1,1,2,1,2,1,3,2,1,1,2,1,3,2,1,1,2,3,1,1,2,1,3,1,2,1,1,3,2];
const SCALE   = 3;
const B_H     = 50;
const B_TOTAL = BAR_W.reduce((s, w) => s + w * SCALE, 0);

function BarcodeStrip({ value }: { value: string }) {
  let cx = 0;
  const bars: { x: number; w: number; h: number }[] = [];
  BAR_W.forEach((w, i) => {
    if (i % 2 === 0) bars.push({ x: cx, w: w * SCALE, h: i % 6 === 0 ? B_H + 8 : B_H });
    cx += w * SCALE;
  });
  return (
    <View style={bc.wrap}>
      <Svg width={B_TOTAL} height={B_H + 24}>
        {bars.map((b, i) => (
          <Rect key={i} x={b.x} y={0} width={b.w} height={b.h} fill={COLORS.brandPrimary} />
        ))}
        <SvgText x={B_TOTAL / 2} y={B_H + 18} textAnchor="middle" fontSize="10" fill={COLORS.textSecondary} letterSpacing="2">
          {value}
        </SvgText>
      </Svg>
    </View>
  );
}
const bc = StyleSheet.create({ wrap: { alignItems: 'center', paddingVertical: SPACING.md } });

// ─── MATRIX CELL ─────────────────────────────────────────────────────────────
function MatrixCell({ label, value, valueColor, chevron, onPress }: {
  label: string; value: string; valueColor?: string; chevron?: boolean; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={mc.cell} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
      <Text style={mc.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={[mc.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
        {chevron && <Ionicons name="chevron-forward" size={12} color={COLORS.textTertiary} />}
      </View>
    </TouchableOpacity>
  );
}
const mc = StyleSheet.create({
  cell:  { flex: 1, padding: SPACING.sm, alignItems: 'center' },
  label: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', marginBottom: 4 },
  value: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
});

// ─── PRICING ROW ─────────────────────────────────────────────────────────────
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

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const fyParam = fyInfoToParam(selectedFY);

  const [liveItem,   setLiveItem]   = useState<any>(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [movements,  setMovements]  = useState<any[]>([]);
  const [movLoading, setMovLoading] = useState(true);
  const [rateData,   setRateData]   = useState<any>(null);
  const [calOpen,    setCalOpen]    = useState(false);
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');

  useEffect(() => {
    if (!companyGuid || !id) return;
    setItemLoading(true);
    getStockItem(companyGuid, id as string, fyParam ? { fy: fyParam } : undefined)
      .then((res: any) => { if (res?.data) setLiveItem(res.data); })
      .catch(() => {})
      .finally(() => setItemLoading(false));
  }, [companyGuid, id, selectedFY]);

  useEffect(() => {
    if (!companyGuid || !id) return;
    setMovLoading(true);
    getStockMovements(companyGuid, id as string, { limit: '20', ...(fyParam ? { fy: fyParam } : {}) })
      .then((res: any) => {
        if (res?.data) { setMovements(res.data.movements || []); setRateData(res.data); }
      })
      .catch(() => {})
      .finally(() => setMovLoading(false));
  }, [companyGuid, id, selectedFY]);

  // All data from real API — STRICT PRODUCTION DATA RULE
  const itemName     = liveItem?.name || (itemLoading ? 'Loading…' : '—');
  const itemSku      = liveItem?.hsn_code || liveItem?.sku || '—';
  const totalQty     = liveItem != null ? +(liveItem.closing_qty ?? 0) : null;
  const stockValue   = fmtRs(liveItem?.closing_value);
  const reorderLevel = liveItem?.reorder_level != null ? +(liveItem.reorder_level) : null;
  const lastPurchRate = rateData?.lastPurchaseRate
    ? fmtRs(rateData.lastPurchaseRate, '/unit')
    : liveItem?.closing_rate ? fmtRs(liveItem.closing_rate, '/unit') : '—';
  const avgPurchRate  = rateData?.avgPurchaseRate ? fmtRs(Math.round(+rateData.avgPurchaseRate), '/unit') : '—';
  const sellingPrice  = rateData?.lastSellRate && +rateData.lastSellRate > 0 ? fmtRs(rateData.lastSellRate, '/unit') : '—';
  const narration     = liveItem?.alias || '—';

  const qtyColor = totalQty == null ? COLORS.textSecondary
    : totalQty < 0 ? COLORS.negative
    : reorderLevel != null && totalQty < reorderLevel ? COLORS.warning
    : COLORS.positive;

  const dateLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'Last 20';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{itemName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {itemLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.brandPrimary} />
        </View>
      ) : !liveItem ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl }}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textTertiary} />
          <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontSize: TYPOGRAPHY.base, textAlign: 'center' }}>
            Item not found. It may have been deleted or not yet synced.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Product hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroName}>{itemName}</Text>
            <Text style={styles.heroSku}>{itemSku}</Text>
            <BarcodeStrip value={itemSku !== '—' ? itemSku : '000000000'} />
          </View>

          {/* Key Matrix */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Key Matrix</Text>
            <View style={styles.matrixGrid}>
              <View style={styles.matrixRow}>
                <MatrixCell label="Total Qty on Hand"  value={totalQty != null ? String(totalQty) : '—'} valueColor={qtyColor} />
                <MatrixCell label="Total Stock Value"  value={stockValue} />
              </View>
              <View style={[styles.matrixRow, styles.matrixRowMid]}>
                <MatrixCell label="Reorder Level"      value={reorderLevel != null ? String(reorderLevel) : '—'} />
                <MatrixCell label="Warehouse"          value={liveItem?.warehouse_name || liveItem?.warehouse || '—'} />
              </View>
              <View style={styles.matrixRow}>
                <MatrixCell label="Stock Group"        value={liveItem?.group_name || '—'} />
                <MatrixCell label="Unit"               value={liveItem?.unit || '—'} />
              </View>
            </View>
          </View>

          {/* Pricing & Cost */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pricing &amp; Cost</Text>
            <PricingRow label="Last Purchase Rate"         value={lastPurchRate} />
            <PricingRow label="Average Purchase Rate"      value={avgPurchRate} />
            <PricingRow label="Last Selling Price"         value={sellingPrice} />
          </View>

          {/* Narration / Alias */}
          {narration !== '—' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Narration</Text>
              <Text style={styles.narrationTxt}>{narration}</Text>
            </View>
          )}

          {/* Movement History */}
          <View style={styles.card}>
            <View style={styles.movHeader}>
              <Text style={styles.cardTitle}>Movement History</Text>
              <TouchableOpacity style={styles.calBtn} onPress={() => setCalOpen(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
                <Text style={styles.calBtnTxt}>{dateLabel}</Text>
              </TouchableOpacity>
            </View>

            {movLoading ? (
              <ActivityIndicator color={COLORS.brandPrimary} style={{ marginVertical: 16 }} />
            ) : movements.length === 0 ? (
              <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, textAlign: 'center', paddingVertical: 16 }}>
                No movement history found.
              </Text>
            ) : (
              movements.map((m: any, i: number) => {
                const qty      = +(m.qty || 0);
                const isInward = (m.type || '').toLowerCase().includes('purchase') || qty > 0;
                const qtyLabel = `${isInward ? '+' : '-'}${Math.abs(qty)}`;
                const isPos    = isInward;
                const cfg      = (MOV_CONFIG as any)[m.type || m.voucher_type] || MOV_CONFIG.Transfer;
                return (
                  <View key={`mv-${i}-${m.voucher_number || i}`} style={styles.mvRow}>
                    <View style={[styles.mvDot, { backgroundColor: isPos ? COLORS.positive : COLORS.negative }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mvType}>{m.type || m.voucher_type || '—'}</Text>
                      <Text style={styles.mvRef}>
                        {m.voucher_number || '—'} · {m.date ? new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </Text>
                    </View>
                    <Text style={[styles.mvQty, { color: isPos ? COLORS.positive : COLORS.negative }]}>{qtyLabel}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      <DateRangePickerModal
        visible={calOpen}
        fromDate={dateFrom}
        toDate={dateTo}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
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
  scroll:     { flex: 1 },

  heroCard: { backgroundColor: COLORS.cardBg, margin: SPACING.md, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  heroName: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  heroSku:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, marginTop: 4, letterSpacing: 0.5 },

  card:      { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginBottom: 10, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },

  matrixGrid:   { borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, overflow: 'hidden' },
  matrixRow:    { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  matrixRowMid: { backgroundColor: COLORS.pageBg },

  narrationTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },

  movHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  calBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault },
  calBtnTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600' },

  mvRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  mvDot:  { width: 8, height: 8, borderRadius: 4 },
  mvType: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  mvRef:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  mvQty:  { fontSize: TYPOGRAPHY.base, fontWeight: '800', minWidth: 46, textAlign: 'right' as const },
});
