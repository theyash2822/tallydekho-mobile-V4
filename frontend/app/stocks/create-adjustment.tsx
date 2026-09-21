/**
 * Inventory QA — Stock Adjustment (multi-item).
 * Multi-select in bottom sheet, per-item warehouse + qty, shared reason/note.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import { todayLocalISO } from '../../src/utils/periodDates';
import { getStocks, createStockAdjustment, getStockGodowns } from '../../src/services/api';
import { StockItem } from '../../src/data/stockData';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import FormDropdown from '../../src/components/forms/FormDropdown';
import { CompactQtyInput, SubmitButton } from '../../src/components/forms/StockFormHelpers';
import { clearStockListCache } from '../../src/utils/stockCache';
import { useTranslation } from 'react-i18next';
import { useRequireCapability } from '../../src/components/RequireCapability';

type GodownRow = { name: string; qty: number };

type AdjRow = {
  item: StockItem;
  qty: number;
  warehouse: string;
  godowns: GodownRow[];
};

const REDUCE_REASONS = ['Damage', 'Shortage', 'Expired', 'Lost'];
const INCREASE_REASONS = ['Excess'];

const REASON_OPTS = [
  { label: 'Damage', value: 'Damage' },
  { label: 'Shortage', value: 'Shortage' },
  { label: 'Expired', value: 'Expired' },
  { label: 'Lost', value: 'Lost' },
  { label: 'Excess', value: 'Excess' },
  { label: 'Correction', value: 'Correction' },
];

const DIRECTION_OPTS = [
  { label: '+ Add stock', value: 'Add' },
  { label: '− Reduce stock', value: 'Reduce' },
];

function mapStockRow(r: any, formatAmount: (n: number) => string): StockItem {
  const qty = +(r.closing_qty || 0);
  const reorder = +(r.reorder_level || 0);
  return {
    id: r.guid || String(r.id),
    name: r.displayName || r.name || '',
    sku: r.sku || r.alias || r.hsn || '',
    category: r.category || '',
    group: r.group_name || '',
    qty,
    value: r.closing_value ? formatAmount(Math.round(+r.closing_value)) : formatAmount(0),
    unit: r.unit || 'pcs',
    warehouse: r.warehouse_name || 'Main Location',
    warehouseId: r.warehouse_name || 'WH01',
    reorderLevel: reorder,
    status: qty <= 0 ? 'out_of_stock' : qty <= reorder ? 'low_stock' : 'in_stock',
    icon: 'cube-outline',
    iconColor: '#1A1A1A',
    iconBg: '#E8E7E1',
  };
}

function parseGodowns(res: any): GodownRow[] {
  const d = res?.data;
  if (d?.warehouses && Array.isArray(d.warehouses)) {
    return d.warehouses.map((g: any) => ({
      name: g.name || g,
      qty: parseFloat(g.qty) || 0,
    }));
  }
  if (Array.isArray(d)) {
    return d.map((g: any) =>
      typeof g === 'string' ? { name: g, qty: 0 } : { name: g.name, qty: parseFloat(g.qty) || 0 },
    );
  }
  return [];
}

function adjustmentEffect(reason: string, direction: string): 'increase' | 'reduce' | null {
  if (REDUCE_REASONS.includes(reason)) return 'reduce';
  if (INCREASE_REASONS.includes(reason)) return 'increase';
  if (reason === 'Correction') {
    if (direction === 'Add') return 'increase';
    if (direction === 'Reduce') return 'reduce';
  }
  return null;
}

function warehouseQty(row: AdjRow): number {
  const g = row.godowns.find(x => x.name === row.warehouse);
  return g?.qty ?? row.item.qty ?? 0;
}

async function buildAdjRow(
  item: StockItem,
  companyGuid: string,
): Promise<AdjRow> {
  let godowns: GodownRow[] = [];
  try {
    const res = await getStockGodowns(companyGuid, item.id);
    godowns = parseGodowns(res);
  } catch { /* fallback below */ }

  if (godowns.length === 0 && item.warehouse) {
    godowns = [{ name: item.warehouse, qty: item.qty || 0 }];
  }
  if (godowns.length === 0) {
    godowns = [{ name: 'Main Location', qty: item.qty || 0 }];
  }

  const warehouse = godowns.length === 1 ? godowns[0].name : (item.warehouse || godowns[0]?.name || '');
  return { item, qty: 1, warehouse, godowns };
}

function AdjItemTile({
  row,
  reason,
  direction,
  onRemove,
  onQty,
  onWarehouse,
}: {
  row: AdjRow;
  reason: string;
  direction: string;
  onRemove: () => void;
  onQty: (q: number) => void;
  onWarehouse: (wh: string) => void;
}) {
  const whQty = warehouseQty(row);
  const multiWh = row.godowns.length > 1;
  const whOptions: BSSOption[] = row.godowns.map(g => ({
    label: g.name,
    value: g.name,
    subtitle: `${g.qty} ${row.item.unit || 'pcs'}`,
  }));

  const effect = reason ? adjustmentEffect(reason, direction) : null;
  const effectHint = effect === 'reduce'
    ? `Max ${whQty} ${row.item.unit || 'pcs'}`
    : effect === 'increase'
    ? '+ add to stock'
    : null;

  return (
    <View style={s.tile}>
      <View style={s.tileTop}>
        <Text style={s.tileName} numberOfLines={1}>{row.item.name}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={20} color={COLORS.textTertiary} />
        </TouchableOpacity>
      </View>

      <View style={s.tileRow}>
        {multiWh ? (
          <View style={s.whCol}>
            <BottomSheetSearch
              compact
              placeholder="Warehouse"
              sheetTitle="Select Warehouse"
              searchPlaceholder="Search..."
              icon="home-outline"
              options={whOptions}
              value={row.warehouse}
              onSelect={o => onWarehouse(o.value)}
            />
          </View>
        ) : (
          <View style={s.whBadge}>
            <Ionicons name="home-outline" size={12} color={COLORS.textSecondary} />
            <Text style={s.whBadgeTxt} numberOfLines={1}>{row.warehouse}</Text>
            <Text style={s.whQtyTxt}>{whQty} {row.item.unit || 'pcs'}</Text>
          </View>
        )}

        <View style={s.qtyCol}>
          <Text style={s.qtyLbl}>Adjust</Text>
          <CompactQtyInput value={row.qty} onChange={onQty} min={1} />
        </View>
      </View>

      {effectHint ? (
        <Text style={[s.effectHint, effect === 'reduce' && s.effectReduce]}>{effectHint}</Text>
      ) : null}
    </View>
  );
}

export default function CreateStockAdjustmentScreen() {
  const allowed = useRequireCapability('stock_adjustment.create');
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { company } = useAuth();
  const { formatAmount } = useSettings();
  const { numberingPolicy } = useNumberingPolicy(company?.guid);
  const { assertCanCreate } = useRbasCreate();
  const companyGuid = company?.guid;

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingItems, setAddingItems] = useState(false);
  const [rows, setRows] = useState<AdjRow[]>([]);
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState('');
  const [note, setNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef?: string;
    voucherNumber?: string;
    numberingPolicy?: string;
    isQueued: boolean;
    savedCount: number;
    totalCount: number;
  } | null>(null);

  /** Option A: Note is last field — scrollToEnd after keyboard begins showing */
  const scrollNoteIntoView = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 250);
  }, []);

  useEffect(() => {
    if (!companyGuid) { setLoading(false); return; }
    setLoading(true);
    getStocks(companyGuid, { limit: '1000' })
      .then((stockRes: any) => {
        const items = stockRes?.data?.items ?? [];
        setStocks(items.map((r: any) => mapStockRow(r, formatAmount)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyGuid, formatAmount]);

  const selectedIds = useMemo(() => new Set(rows.map(r => r.item.id)), [rows]);

  const itemOptions: BSSOption[] = stocks
    .filter(st => !selectedIds.has(st.id))
    .map(st => ({
      label: st.name,
      value: st.id,
      subtitle: [st.sku, `${st.qty} ${st.unit || 'pcs'}`].filter(Boolean).join(' · '),
    }));

  const addItems = useCallback(async (opts: BSSOption[]) => {
    if (!companyGuid || opts.length === 0) return;
    setAddingItems(true);
    try {
      const newRows = await Promise.all(
        opts.map(opt => {
          const item = stocks.find(st => st.id === opt.value);
          if (!item) return null;
          return buildAdjRow(item, companyGuid);
        }),
      );
      setRows(prev => {
        const ids = new Set(prev.map(r => r.item.id));
        const toAdd = newRows.filter((r): r is AdjRow => !!r && !ids.has(r.item.id));
        return [...prev, ...toAdd];
      });
    } finally {
      setAddingItems(false);
    }
  }, [companyGuid, stocks]);

  const removeItem = (id: string) => setRows(p => p.filter(r => r.item.id !== id));
  const updQty = (id: string, q: number) =>
    setRows(p => p.map(r => r.item.id === id ? { ...r, qty: q } : r));
  const updWarehouse = (id: string, wh: string) =>
    setRows(p => p.map(r => r.item.id === id ? { ...r, warehouse: wh } : r));

  const validate = () => {
    if (rows.length === 0) {
      Toast.show({ type: 'error', text1: 'No Items', text2: 'Add at least one stock item.' });
      return false;
    }
    if (rows.some(r => !r.warehouse)) {
      Toast.show({ type: 'error', text1: 'Warehouse Required', text2: 'Select warehouse for each item.' });
      return false;
    }
    if (rows.some(r => r.qty <= 0)) {
      Toast.show({ type: 'error', text1: 'Invalid Qty', text2: 'Each item needs qty greater than 0.' });
      return false;
    }
    if (!reason) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select adjustment reason.' });
      return false;
    }
    if (reason === 'Correction' && !direction) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select Add or Reduce for Correction.' });
      return false;
    }

    const effect = adjustmentEffect(reason, direction);
    if (effect === 'reduce') {
      const over = rows.find(r => r.qty > warehouseQty(r));
      if (over) {
        Toast.show({
          type: 'error',
          text1: 'Exceeds Stock',
          text2: `${over.item.name}: max ${warehouseQty(over)} ${over.item.unit || 'pcs'} in ${over.warehouse}`,
        });
        return false;
      }
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid) return;
    if (!assertCanCreate('stock_adjustment.create')) return;
    let ok = 0;
    let fail = 0;
    let lastResult: any = null;
    for (const r of rows) {
      try {
        const res: any = await createStockAdjustment({
          companyGuid: company.guid,
          companyName: company.name || '',
          stockGuid: r.item.id,
          stockName: r.item.name,
          warehouse: r.warehouse,
          adjustmentQty: r.qty,
          adjustmentReason: reason,
          adjustmentDirection: reason === 'Correction' ? direction : null,
          qtyBefore: warehouseQty(r),
          unit: r.item.unit || 'pcs',
          note,
          numbering_policy: numberingPolicy,
          date: todayLocalISO(),
        });
        ok += 1;
        lastResult = res;
      } catch {
        fail += 1;
      }
    }
    if (ok > 0) {
      const tdkRef = lastResult?.tdkRef || lastResult?.tdkReferenceNo;
      setSubmitResult({
        tdkRef,
        voucherNumber: lastResult?.voucherNumber,
        numberingPolicy: lastResult?.numberingPolicy || numberingPolicy,
        isQueued: !!lastResult?.queued || fail > 0,
        savedCount: ok,
        totalCount: rows.length,
      });
      clearStockListCache();
      setShowSuccess(true);
    } else {
      Toast.show({ type: 'error', text1: 'Adjustment Failed', text2: 'Could not save adjustments.' });
    }
  };

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('stocks.createAdjustment')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brandPrimary} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[s.form, { paddingBottom: 56 }]}
        >
          <View style={s.field}>
            <BottomSheetSearch
              label="Add Stock Items"
              placeholder={itemOptions.length ? 'Search and select items...' : 'All items added'}
              sheetTitle="Select Stock Items"
              searchPlaceholder="Search by name or SKU..."
              icon="cube-outline"
              options={itemOptions}
              value=""
              onSelect={() => {}}
              multiSelect
              confirmLabel={n => `Add ${n} Item${n !== 1 ? 's' : ''}`}
              onMultiConfirm={addItems}
              disabled={itemOptions.length === 0 || addingItems}
            />
            {addingItems ? (
              <ActivityIndicator size="small" color={COLORS.brandPrimary} style={{ marginTop: 8 }} />
            ) : null}
          </View>

          {rows.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Items ({rows.length})</Text>
              {rows.map(r => (
                <AdjItemTile
                  key={r.item.id}
                  row={r}
                  reason={reason}
                  direction={direction}
                  onRemove={() => removeItem(r.item.id)}
                  onQty={q => updQty(r.item.id, q)}
                  onWarehouse={wh => updWarehouse(r.item.id, wh)}
                />
              ))}
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Reason</Text>
            <FormDropdown
              label="Adjustment Reason"
              required
              value={reason}
              options={REASON_OPTS}
              placeholder="Select reason"
              onSelect={o => {
                setReason(o.value);
                if (o.value !== 'Correction') setDirection('');
              }}
            />
            {reason === 'Correction' && (
              <FormDropdown
                label="Direction"
                required
                value={direction}
                options={DIRECTION_OPTS}
                placeholder="Add or Reduce"
                onSelect={o => setDirection(o.value)}
              />
            )}
            {reason && reason !== 'Correction' ? (
              <Text style={s.reasonHint}>
                {REDUCE_REASONS.includes(reason)
                  ? `${reason} automatically reduces stock.`
                  : `${reason} automatically adds stock.`}
              </Text>
            ) : null}
            <View style={s.field}>
              <Text style={s.label}>Note</Text>
              <TextInput
                style={s.noteInput}
                placeholder="Optional note"
                placeholderTextColor={COLORS.textTertiary}
                value={note}
                onChangeText={setNote}
                onFocus={scrollNoteIntoView}
                multiline
              />
            </View>
          </View>
        </ScrollView>
      )}

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <SubmitButton
          idleLabel={rows.length ? `Adjust ${rows.length} Item${rows.length !== 1 ? 's' : ''}` : 'Adjust'}
          loadingLabel="Saving..."
          successLabel="✓ Done"
          onValidate={validate}
          onDone={handleDone}
        />
      </View>

      {showSuccess && submitResult && (
        <View style={ss.overlay}>
          <View style={ss.card}>
            <View style={ss.iconWrap}>
              <Ionicons
                name={submitResult.isQueued ? 'time-outline' : 'checkmark-circle'}
                size={56}
                color={submitResult.isQueued ? COLORS.warning : COLORS.positive}
              />
            </View>
            <Text style={ss.title}>
              {submitResult.isQueued ? 'Saved. Pending Sync' : 'Adjustment Saved!'}
            </Text>
            <Text style={ss.sub}>
              {submitResult.savedCount === submitResult.totalCount
                ? `${submitResult.savedCount} item(s) adjusted.`
                : `${submitResult.savedCount} of ${submitResult.totalCount} saved.`}
              {submitResult.isQueued ? ' Will push to Tally when desktop connects.' : ''}
            </Text>
            {submitResult.numberingPolicy === 'tallydekho_series' && submitResult.voucherNumber && (
              <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                <Text style={ss.refLabel}>Voucher No.</Text>
                <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult.voucherNumber}</Text>
              </View>
            )}
            {!!submitResult.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>Reference No.</Text>
                <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
              </View>
            )}
            {!!submitResult.tdkRef && (
              <TouchableOpacity
                style={ss.previewBtn}
                activeOpacity={0.85}
                onPress={() => {
                  router.replace(`/stocks/adjustment-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef!)}` as any);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.previewBtnTxt}>Preview</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={ss.closeBtn}
              activeOpacity={0.85}
              onPress={() => { setShowSuccess(false); router.back(); }}
            >
              <Text style={ss.closeBtnTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, zIndex: 100,
  },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.lg, alignItems: 'center', gap: 12,
  },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  refBadge: {
    width: '100%', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault, padding: 12, alignItems: 'center',
  },
  refLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase' },
  refVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  previewBtn: {
    flexDirection: 'row', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md,
    paddingVertical: 12, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.brandPrimary,
  },
  previewBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  closeBtn: { paddingVertical: 10 },
  closeBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  form: { padding: SPACING.md },
  field: { marginBottom: SPACING.sm },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  section: { marginTop: 4, marginBottom: SPACING.sm },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10,
  },
  tile: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tileName: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  tileRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  whCol: { flex: 1.1 },
  whBadge: {
    flex: 1.1, flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  whBadgeTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textPrimary },
  whQtyTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  qtyCol: { flex: 0.9 },
  qtyLbl: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, marginBottom: 4, textTransform: 'uppercase' },
  effectHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 6 },
  effectReduce: { color: COLORS.negative },
  reasonHint: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: -4, marginBottom: SPACING.sm },
  noteInput: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 10, minHeight: 56,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.cardBg,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: 12,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
});
