import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { encodeCode128B } from '../../src/utils/barcode';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { getStockItem, getStockMovements, getStockGodowns, getBarcodesByGuids, generateBarcode } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// STRICT PRODUCTION DATA RULE: No mock/fallback data. Real data or — only.
const fmtRs = (n: number | null | undefined, unit = '') =>
  n != null && !isNaN(+n) && +n > 0
    ? `₹${(+n).toLocaleString('en-IN')}${unit}`
    : '—';

// ─── REAL CODE128B BARCODE ──────────────────────────────────────────────────
// Uses encodeCode128B from barcode.ts — same encoder as label-preview.tsx.
// Integer virtual coords + viewBox scaling → bar ratios exact, no drift.
function BarcodeSVG({ code, height = 56 }: { code: string; height?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const barcodeW = screenWidth - 80;

  const { bars, totalModules } = encodeCode128B(code);
  if (!bars.length || !totalModules) return null;

  const QUIET          = 10;                         // quiet modules each side
  const totalWithQuiet = totalModules + QUIET * 2;
  const VMOD           = 3;                          // integer virtual units per module
  const vw             = totalWithQuiet * VMOD;      // virtual canvas width

  const rects: React.ReactElement[] = [];
  let mp = QUIET;
  bars.forEach((modules, i) => {
    if (i % 2 === 0) {
      rects.push(<Rect key={i} x={mp * VMOD} y={0} width={modules * VMOD} height={height} fill="#000" />);
    }
    mp += modules;
  });

  return (
    <View style={{ alignItems: 'center', paddingVertical: SPACING.md }}>
      <Svg width={barcodeW} height={height} viewBox={`0 0 ${vw} ${height}`} preserveAspectRatio="none">
        {rects}
      </Svg>
      <Text style={{ fontSize: 10, color: COLORS.textSecondary, letterSpacing: 2, marginTop: 4, fontFamily: 'monospace' }}>
        {code}
      </Text>
    </View>
  );
}
const bgs = StyleSheet.create({
  genBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 20, marginVertical: SPACING.md,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.brandPrimary,
    backgroundColor: COLORS.pageBg, alignSelf: 'center',
  },
  genBtnText: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },
});

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
  const { formatDate } = useSettings();
  const companyGuid = company?.guid;
  const fyParam = fyInfoToParam(selectedFY);
  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo = selectedFY?.endDate ?? '';

  const [liveItem,   setLiveItem]   = useState<any>(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [movements,  setMovements]  = useState<any[]>([]);
  const [movLoading, setMovLoading] = useState(true);
  const [rateData,   setRateData]   = useState<any>(null);
  const [godowns,    setGodowns]    = useState<{ name: string; qty: number; pct?: number }[]>([]);
  const [godownMeta, setGodownMeta] = useState<{ reconciled?: boolean; unassignedQty?: number; unit?: string }>({});
  const [calOpen,    setCalOpen]    = useState(false);
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  useEffect(() => {
    setDateFrom('');
    setDateTo('');
  }, [selectedFY?.startDate, selectedFY?.endDate]);
  const [itemBarcode,       setItemBarcode]       = useState<string | null>(null);
  const [barcodeGenerating, setBarcodeGenerating] = useState(false);

  useEffect(() => {
    if (!companyGuid || !id) return;
    setItemLoading(true);
    getStockItem(companyGuid, id as string, fyParam ? { fy: fyParam } : undefined)
      .then((res: any) => { if (res?.data) setLiveItem(res.data); })
      .catch(() => {})
      .finally(() => setItemLoading(false));
    // Fetch warehouse breakdown
    getStockGodowns(companyGuid, id as string)
      .then((res: any) => {
        const d = res?.data;
        if (d?.warehouses) {
          setGodowns(d.warehouses);
          setGodownMeta({
            reconciled: d.reconciled,
            unassignedQty: d.unassignedQty,
            unit: d.unit,
          });
        }
      })
      .catch(() => {});
    // Fetch primary barcode from stock_barcodes
    getBarcodesByGuids(companyGuid, [id as string])
      .then((res: any) => {
        const bc = (res?.data?.items || res?.items || [])[0]?.barcode || null;
        setItemBarcode(bc);
      })
      .catch(() => {});
  }, [companyGuid, id, selectedFY]);

  useEffect(() => {
    if (!companyGuid || !id) return;
    setMovLoading(true);
    const params: Record<string, string> = { limit: '20' };
    if (dateFrom && dateTo) {
      params.from = dateFrom;
      params.to = dateTo;
      params.limit = '200';
    } else if (fyParam) {
      params.fy = fyParam;
    }
    getStockMovements(companyGuid, id as string, params)
      .then((res: any) => {
        if (res?.data) { setMovements(res.data.movements || []); setRateData(res.data); }
      })
      .catch(() => {})
      .finally(() => setMovLoading(false));
  }, [companyGuid, id, selectedFY, dateFrom, dateTo, fyParam]);

  // All data from real API — STRICT PRODUCTION DATA RULE
  const itemName     = liveItem?.name || (itemLoading ? 'Loading…' : '—');
  const itemSku      = liveItem?.sku || liveItem?.alias || liveItem?.hsn || '—';
  const totalQty     = liveItem != null ? +(liveItem.closing_qty ?? 0) : null;
  const stockValue   = fmtRs(liveItem?.closing_value);
  const reorderLevel = liveItem?.reorder_level != null ? +(liveItem.reorder_level) : null;
  const lastPurchRate = rateData?.lastPurchaseRate
    ? fmtRs(rateData.lastPurchaseRate, '/unit')
    : liveItem?.closing_rate ? fmtRs(liveItem.closing_rate, '/unit') : '—';
  const avgPurchRate  = rateData?.avgPurchaseRate ? fmtRs(Math.round(+rateData.avgPurchaseRate), '/unit') : '—';
  const sellingPrice  = rateData?.lastSellRate && +rateData.lastSellRate > 0 ? fmtRs(rateData.lastSellRate, '/unit') : '—';
  const narration     = liveItem?.alias || '—';
  const itemUnit      = liveItem?.unit || godownMeta.unit || 'pcs';
  const godownSum     = godowns.reduce((s, g) => s + (g.name === 'Unassigned' ? 0 : g.qty), 0);

  const qtyColor = totalQty == null ? COLORS.textSecondary
    : totalQty < 0 ? COLORS.negative
    : reorderLevel != null && totalQty < reorderLevel ? COLORS.warning
    : COLORS.positive;

  const dateLabel = dateFrom && dateTo ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}` : 'Last 20';

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
            {itemBarcode ? (
              <BarcodeSVG code={itemBarcode} />
            ) : (
              <TouchableOpacity
                style={bgs.genBtn}
                activeOpacity={0.8}
                disabled={barcodeGenerating}
                onPress={async () => {
                  if (!companyGuid || !id) return;
                  setBarcodeGenerating(true);
                  try {
                    const res = await generateBarcode(companyGuid, id as string);
                    const bc = res?.data?.barcode || res?.barcode;
                    if (bc) { setItemBarcode(bc); }
                  } catch {}
                  finally { setBarcodeGenerating(false); }
                }}
              >
                {barcodeGenerating
                  ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  : <Ionicons name="barcode-outline" size={18} color={COLORS.brandPrimary} />}
                <Text style={bgs.genBtnText}>
                  {barcodeGenerating ? 'Generating…' : 'Generate Barcode'}
                </Text>
              </TouchableOpacity>
            )}
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
                <MatrixCell label="Warehouses"          value={godowns.length > 0 ? String(godowns.length) : '—'} />
              </View>
              <View style={styles.matrixRow}>
                <MatrixCell label="Stock Group"        value={liveItem?.group_name || '—'} />
                <MatrixCell label="Unit"               value={liveItem?.unit || '—'} />
              </View>
            </View>
          </View>

          {/* Warehouse Breakdown */}
          {godowns.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Warehouse Breakdown</Text>
              {!godownMeta.reconciled && (godownMeta.unassignedQty ?? 0) > 0 && (
                <View style={styles.reconcileBanner}>
                  <Ionicons name="information-circle-outline" size={14} color="#B45309" />
                  <Text style={styles.reconcileTxt}>
                    Godown totals ({godownSum.toLocaleString('en-IN')}) differ from book qty ({totalQty?.toLocaleString('en-IN')}). Unassigned qty shown below.
                  </Text>
                </View>
              )}
              {godowns.map((g, i) => (
                <View key={`wh-${i}`} style={[pr.row, g.name === 'Unassigned' && { backgroundColor: '#FFFBEB' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={pr.label}>{g.name}</Text>
                    {g.pct != null && g.pct > 0 && g.name !== 'Unassigned' && (
                      <Text style={styles.whPct}>{g.pct}% of total</Text>
                    )}
                  </View>
                  <Text style={[pr.value, g.name === 'Unassigned' && { color: '#B45309' }]}>
                    {g.qty.toLocaleString('en-IN')} {itemUnit}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Item Details */}
          {(liveItem?.sku || liveItem?.alias || liveItem?.hsn || liveItem?.description) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Item Details</Text>
              {(liveItem?.sku || liveItem?.alias) && (
                <PricingRow label="Part Number" value={liveItem?.sku || liveItem?.alias} />
              )}
              {liveItem?.hsn && (
                <PricingRow label="HSN Code" value={liveItem.hsn} />
              )}
              {liveItem?.tax_rate != null && +liveItem.tax_rate > 0 && (
                <PricingRow label="Tax Rate" value={`${liveItem.tax_rate}%`} />
              )}
              {liveItem?.description && (
                <PricingRow label="Description" value={liveItem.description} />
              )}
            </View>
          )}

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
                const isTransfer = !!m.is_transfer;
                const qty      = +(m.qty || 0);
                const isInward = !isTransfer && ((m.type || '').toLowerCase().includes('purchase') || qty > 0);
                const qtyLabel = isTransfer
                  ? `${qty} ${itemUnit}`
                  : `${isInward ? '+' : '-'}${Math.abs(qty)}`;
                const isPos    = isTransfer || isInward;
                const typeLabel = isTransfer ? 'Transfer' : (m.type || m.voucher_type || '—');
                const refExtra = isTransfer && m.from_warehouse && m.to_warehouse
                  ? `${m.from_warehouse} → ${m.to_warehouse}`
                  : (m.reference || '');
                return (
                  <View key={`mv-${i}-${m.voucher_number || i}`} style={styles.mvRow}>
                    <View style={[styles.mvDot, { backgroundColor: isTransfer ? COLORS.info : (isPos ? COLORS.positive : COLORS.negative) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mvType}>{typeLabel}</Text>
                      <Text style={styles.mvRef}>
                        {m.voucher_number || '—'}
                        {refExtra ? ` · ${refExtra}` : ''}
                        {' · '}
                        {m.date ? new Date(m.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </Text>
                    </View>
                    <Text style={[styles.mvQty, { color: isTransfer ? COLORS.info : (isPos ? COLORS.positive : COLORS.negative) }]}>
                      {isTransfer ? '↔' : ''}{qtyLabel}
                    </Text>
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
        fromDate={dateFrom || fyFrom}
        toDate={dateTo || fyTo}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
        minDate={fyFrom || undefined}
        maxDate={fyTo || undefined}
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
  reconcileBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: RADIUS.sm, padding: 10, marginBottom: 8,
  },
  reconcileTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: '#B45309', lineHeight: 16 },
  whPct: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
});
