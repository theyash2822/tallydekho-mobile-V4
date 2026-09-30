import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import Svg, { Rect } from 'react-native-svg';
import { encodeCode128B } from '../../src/utils/barcode';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import {
  getStockItem, getStockMovements, getStockGodowns, getBarcodesByGuids,
  generateBarcode, alterStockItem, checkHsnCode, getBarcodeSettings,
} from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';
import { ErrorBanner, ErrorState } from '../../src/components/ApiStateViews';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// STRICT PRODUCTION DATA RULE: No mock/fallback data. Real data or — only.
const fmtRs = (n: number | null | undefined, unit = '') =>
  n != null && !isNaN(+n) && +n > 0
    ? `₹${(+n).toLocaleString('en-IN')}${unit}`
    : '—';

// ─── REAL CODE128B BARCODE ──────────────────────────────────────────────────
function BarcodeSVG({ code, height = 56 }: { code: string; height?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const barcodeW = screenWidth - 80;

  const { bars, totalModules } = encodeCode128B(code);
  if (!bars.length || !totalModules) return null;

  const QUIET          = 10;
  const totalWithQuiet = totalModules + QUIET * 2;
  const VMOD           = 3;
  const vw             = totalWithQuiet * VMOD;

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
  const { t } = useTranslation();
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
  const [hsnDraft,   setHsnDraft]   = useState('');
  const [hsnHint,    setHsnHint]    = useState<string | null>(null);
  const [hsnSaving,  setHsnSaving]  = useState(false);
  const [hsnEditing, setHsnEditing] = useState(false);
  const [itemBarcode,       setItemBarcode]       = useState<string | null>(null);
  const [itemError,  setItemError]  = useState<string | null>(null);
  const [movError,   setMovError]   = useState<string | null>(null);
  const [itemReload, setItemReload] = useState(0);
  const [movReload,  setMovReload]  = useState(0);
  const [barcodeGenerating, setBarcodeGenerating] = useState(false);
  const [prevFy, setPrevFy] = useState({ start: selectedFY?.startDate, end: selectedFY?.endDate });
  if (prevFy.start !== selectedFY?.startDate || prevFy.end !== selectedFY?.endDate) {
    setPrevFy({ start: selectedFY?.startDate, end: selectedFY?.endDate });
    setDateFrom('');
    setDateTo('');
  }

  const itemDeps = [companyGuid, id, selectedFY, itemReload];
  const [prevItemDeps, setPrevItemDeps] = useState(itemDeps);
  if (itemDeps.some((d, i) => d !== prevItemDeps[i])) {
    setPrevItemDeps(itemDeps);
    if (companyGuid && id) {
      setItemLoading(true);
      setItemError(null);
    }
  }

  const movDeps = [companyGuid, id, selectedFY, dateFrom, dateTo, fyParam, movReload];
  const [prevMovDeps, setPrevMovDeps] = useState(movDeps);
  if (movDeps.some((d, i) => d !== prevMovDeps[i])) {
    setPrevMovDeps(movDeps);
    if (companyGuid && id) {
      setMovLoading(true);
      setMovError(null);
    }
  }

  useEffect(() => {
    if (!companyGuid || !id) return;
    getStockItem(companyGuid, id as string, fyParam ? { fy: fyParam } : undefined)
      .then((res: any) => {
        if (res?.data) {
          setLiveItem(res.data);
          setHsnDraft(res.data.hsn || '');
        }
      })
      .catch((err: any) => setItemError(err?.message || t('screens.stocksItemDetail.loadFailed')))
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
    // Primary barcode from stock_barcodes
    getBarcodesByGuids(companyGuid, [id as string])
      .then((res: any) => {
        const bc = (res?.data?.items || res?.items || [])[0]?.barcode || null;
        setItemBarcode(bc);
      })
      .catch(() => {});
  }, [companyGuid, id, selectedFY, itemReload]);

  useEffect(() => {
    if (!companyGuid || !id) return;
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
      .catch((err: any) => setMovError(err?.message || t('screens.stocksItemDetail.loadFailed')))
      .finally(() => setMovLoading(false));
  }, [companyGuid, id, selectedFY, dateFrom, dateTo, fyParam, movReload]);

  // All data from real API — STRICT PRODUCTION DATA RULE
  const itemName     = liveItem?.name || (itemLoading ? t('screens.stocksItemDetail.loading') : '—');
  const itemSku      = liveItem?.sku || liveItem?.alias || liveItem?.hsn || '—';
  const totalQty     = liveItem != null ? +(liveItem.closing_qty ?? 0) : null;
  const stockValue   = fmtRs(liveItem?.closing_value);
  const reorderLevel = liveItem?.reorder_level != null ? +(liveItem.reorder_level) : null;
  const lastPurchRate = rateData?.lastPurchaseRate
    ? fmtRs(rateData.lastPurchaseRate, t('screens.stocksItemDetail.perUnit'))
    : liveItem?.closing_rate ? fmtRs(liveItem.closing_rate, t('screens.stocksItemDetail.perUnit')) : '—';
  const avgPurchRate  = rateData?.avgPurchaseRate ? fmtRs(Math.round(+rateData.avgPurchaseRate), t('screens.stocksItemDetail.perUnit')) : '—';
  const sellingPrice  = rateData?.lastSellRate && +rateData.lastSellRate > 0 ? fmtRs(rateData.lastSellRate, t('screens.stocksItemDetail.perUnit')) : '—';
  const narration     = liveItem?.alias || '—';
  const itemUnit      = liveItem?.unit || godownMeta.unit || 'pcs';
  const godownSum     = godowns.reduce((s, g) => s + (g.name === 'Unassigned' ? 0 : g.qty), 0);

  const qtyColor = totalQty == null ? COLORS.textSecondary
    : totalQty < 0 ? COLORS.negative
    : reorderLevel != null && totalQty < reorderLevel ? COLORS.warning
    : COLORS.positive;

  const dateLabel = dateFrom && dateTo ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}` : t('screens.stocksItemDetail.last20');

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
      ) : !liveItem && itemError ? (
        <ErrorState title={t('screens.stocksItemDetail.couldntLoadItem')} message={itemError} onRetry={() => setItemReload(k => k + 1)} />
      ) : !liveItem ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl }}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textTertiary} />
          <Text style={{ marginTop: 12, color: COLORS.textSecondary, fontSize: TYPOGRAPHY.base, textAlign: 'center' }}>
            {t('screens.stocksItemDetail.notFound')}
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
                    let barcodeType = 'CODE128';
                    let syncTarget = 'app_only';
                    try {
                      const st: any = await getBarcodeSettings(companyGuid);
                      const d = st?.data || st;
                      if (d?.defaultBarcodeType) barcodeType = d.defaultBarcodeType;
                      if (d?.barcodeStorageMode) syncTarget = d.barcodeStorageMode;
                    } catch { /* use defaults */ }
                    const res: any = await generateBarcode(companyGuid, id as string, barcodeType, syncTarget);
                    const bc = res?.data?.barcode || res?.barcode;
                    if (bc) {
                      setItemBarcode(bc);
                      Toast.show({
                        type: 'success',
                        text1: t('screens.stocksItemDetail.barcodeGenerated'),
                        text2: syncTarget !== 'app_only' ? t('screens.stocksItemDetail.syncingToTally', { barcode: bc }) : bc,
                      });
                    } else {
                      Toast.show({ type: 'error', text1: t('screens.stocksItemDetail.generateFailed'), text2: t('screens.stocksItemDetail.noBarcodeReturned') });
                    }
                  } catch (e: any) {
                    Toast.show({ type: 'error', text1: t('screens.stocksItemDetail.generateFailed'), text2: e?.message || t('screens.stocksItemDetail.tryAgain') });
                  } finally {
                    setBarcodeGenerating(false);
                  }
                }}
              >
                {barcodeGenerating
                  ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  : <Ionicons name="barcode-outline" size={18} color={COLORS.brandPrimary} />}
                <Text style={bgs.genBtnText}>
                  {barcodeGenerating ? t('pdf.generating') : t('screens.stocksItemDetail.generateBarcode')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Key Matrix */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('screens.stocksItemDetail.keyMatrix')}</Text>
            <View style={styles.matrixGrid}>
              <View style={styles.matrixRow}>
                <MatrixCell label={t('screens.stocksItemDetail.totalQtyOnHand')}  value={totalQty != null ? String(totalQty) : '—'} valueColor={qtyColor} />
                <MatrixCell label={t('stocks.totalStockValue')}  value={stockValue} />
              </View>
              <View style={[styles.matrixRow, styles.matrixRowMid]}>
                <MatrixCell label={t('screens.stocksItemDetail.reorderLevel')}      value={reorderLevel != null ? String(reorderLevel) : '—'} />
                <MatrixCell label={t('stocks.warehouses')}          value={godowns.length > 0 ? String(godowns.length) : '—'} />
              </View>
              <View style={styles.matrixRow}>
                <MatrixCell label={t('screens.stocksItemDetail.stockGroup')}        value={liveItem?.group_name || '—'} />
                <MatrixCell label={t('screens.stocksItemDetail.unit')}               value={liveItem?.unit || '—'} />
              </View>
            </View>
          </View>

          {/* Warehouse Breakdown */}
          {godowns.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('screens.stocksItemDetail.warehouseBreakdown')}</Text>
              {!godownMeta.reconciled && (godownMeta.unassignedQty ?? 0) > 0 && (
                <View style={styles.reconcileBanner}>
                  <Ionicons name="information-circle-outline" size={14} color="#B45309" />
                  <Text style={styles.reconcileTxt}>
                    {t('screens.stocksItemDetail.godownMismatch', { godownSum: godownSum.toLocaleString('en-IN'), bookQty: totalQty?.toLocaleString('en-IN') })}
                  </Text>
                </View>
              )}
              {godowns.map((g, i) => (
                <View key={`wh-${i}`} style={[pr.row, g.name === 'Unassigned' && { backgroundColor: '#FFFBEB' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={pr.label}>{g.name}</Text>
                    {g.pct != null && g.pct > 0 && g.name !== 'Unassigned' && (
                      <Text style={styles.whPct}>{t('screens.stocksItemDetail.pctOfTotal', { pct: g.pct })}</Text>
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
          {(liveItem?.sku || liveItem?.alias || liveItem?.description) && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('screens.stocksItemDetail.itemDetails')}</Text>
              {(liveItem?.sku || liveItem?.alias) && (
                <PricingRow label={t('screens.stocksItemDetail.partNumber')} value={liveItem?.sku || liveItem?.alias} />
              )}
              {liveItem?.tax_rate != null && +liveItem.tax_rate > 0 && (
                <PricingRow label={t('screens.stocksItemDetail.taxRate')} value={`${liveItem.tax_rate}%`} />
              )}
              {liveItem?.description && (
                <PricingRow label={t('pdf.description')} value={liveItem.description} />
              )}
            </View>
          )}

          {/* Pricing & Cost */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('screens.stocksItemDetail.pricingCost')}</Text>
            <PricingRow label={t('screens.stocksItemDetail.lastPurchaseRate')}         value={lastPurchRate} />
            <PricingRow label={t('screens.stocksItemDetail.avgPurchaseRate')}      value={avgPurchRate} />
            <PricingRow label={t('screens.stocksItemDetail.lastSellingPrice')}         value={sellingPrice} />
            {/* HSN — inline under Last Selling Price; edit → save */}
            <View style={[pr.row, { borderBottomWidth: 0 }]}>
              <Text style={pr.label}>{t('pdf.hsn')}</Text>
              <View style={hsnInline.valueWrap}>
                {hsnEditing ? (
                  <TextInput
                    style={hsnInline.input}
                    value={hsnDraft}
                    onChangeText={(v) => { setHsnDraft(v.replace(/\D/g, '').slice(0, 8)); setHsnHint(null); }}
                    placeholder={t('screens.stocksItemDetail.hsnPlaceholder')}
                    placeholderTextColor={COLORS.textTertiary}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoFocus
                    onBlur={async () => {
                      const code = hsnDraft.trim();
                      if (!code) { setHsnHint(null); return; }
                      try {
                        const res: any = await checkHsnCode(code);
                        if (res?.data?.valid === false) {
                          setHsnHint(t('screens.stocksItemDetail.invalidHsnHint'));
                        } else setHsnHint(null);
                      } catch { setHsnHint(null); }
                    }}
                  />
                ) : (
                  <Text style={[pr.value, !liveItem?.hsn && { color: COLORS.textTertiary, fontWeight: '500' }]}>
                    {liveItem?.hsn || '—'}
                  </Text>
                )}
                <TouchableOpacity
                  style={hsnInline.iconBtn}
                  activeOpacity={0.7}
                  disabled={hsnSaving}
                  onPress={async () => {
                    if (!hsnEditing) {
                      setHsnDraft(liveItem?.hsn || '');
                      setHsnHint(null);
                      setHsnEditing(true);
                      return;
                    }
                    const code = hsnDraft.trim();
                    const saved = liveItem?.hsn || '';
                    // No change yet → cancel edit
                    if (!code || code === saved) {
                      setHsnDraft(saved);
                      setHsnHint(null);
                      setHsnEditing(false);
                      return;
                    }
                    if (!companyGuid || !liveItem?.name) return;
                    setHsnSaving(true);
                    try {
                      const check: any = await checkHsnCode(code);
                      if (check?.data?.valid === false) {
                        setHsnHint(t('screens.stocksItemDetail.invalidHsnHint'));
                        Toast.show({ type: 'error', text1: t('screens.stocksItemDetail.invalidHsn'), text2: t('screens.stocksItemDetail.codeNotAccepted') });
                        return;
                      }
                      const res: any = await alterStockItem({
                        companyGuid,
                        companyName: company?.name || '',
                        existingName: liveItem.name,
                        changes: { hsnCode: code },
                      });
                      setLiveItem((prev: any) => prev ? { ...prev, hsn: code } : prev);
                      setHsnEditing(false);
                      setHsnHint(null);
                      Toast.show({
                        type: 'success',
                        text1: res?.queued ? t('screens.stocksItemDetail.hsnQueued') : t('screens.stocksItemDetail.hsnSaved'),
                        text2: res?.queued
                          ? t('screens.stocksItemDetail.willUpdateInTally')
                          : t('screens.stocksItemDetail.updatedInTally'),
                      });
                    } catch (e: any) {
                      Toast.show({ type: 'error', text1: t('screens.stocksItemDetail.hsnUpdateFailed'), text2: e?.message || t('screens.stocksItemDetail.tryAgain') });
                    } finally {
                      setHsnSaving(false);
                    }
                  }}
                >
                  {hsnSaving ? (
                    <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  ) : hsnEditing && hsnDraft.trim() && hsnDraft.trim() !== (liveItem?.hsn || '') ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.brandPrimary} />
                  ) : (
                    <Ionicons name="pencil-outline" size={16} color={COLORS.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {!!hsnHint && <Text style={hsnInline.hint}>{hsnHint}</Text>}
          </View>

          {/* Narration / Alias */}
          {narration !== '—' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('voucher.narration')}</Text>
              <Text style={styles.narrationTxt}>{narration}</Text>
            </View>
          )}

          {/* Movement History */}
          <View style={styles.card}>
            <View style={styles.movHeader}>
              <Text style={styles.cardTitle}>{t('screens.stocksItemDetail.movementHistory')}</Text>
              <TouchableOpacity style={styles.calBtn} onPress={() => setCalOpen(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.brandPrimary} />
                <Text style={styles.calBtnTxt}>{dateLabel}</Text>
              </TouchableOpacity>
            </View>

            {movLoading ? (
              <ActivityIndicator color={COLORS.brandPrimary} style={{ marginVertical: 16 }} />
            ) : movError ? (
              <ErrorBanner message={movError} onRetry={() => setMovReload(k => k + 1)} />
            ) : movements.length === 0 ? (
              <Text style={{ color: COLORS.textTertiary, fontSize: TYPOGRAPHY.sm, textAlign: 'center', paddingVertical: 16 }}>
                {t('screens.stocksItemDetail.noMovementHistory')}
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
                const typeLabel = isTransfer ? t('screens.stocksItemDetail.transfer') : (m.type || m.voucher_type || '—');
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

const hsnInline = StyleSheet.create({
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, maxWidth: '62%' },
  input: {
    minWidth: 96, maxWidth: 140, height: 32, paddingHorizontal: 8, paddingVertical: 0,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.borderStrong,
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'right',
  },
  iconBtn: { padding: 2, minWidth: 28, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11, color: '#92400E', marginTop: 4, lineHeight: 15 },
});
