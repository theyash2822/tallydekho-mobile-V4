/**
 * Inventory QA — Stock Transfer (Option A).
 * Multi-select items, per-item source warehouse, shared destination, TDK-STJ preview.
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
import { getStocks, getWarehouses, getStockGodowns, createStockTransfer } from '../../src/services/api';
import { StockItem } from '../../src/data/stockData';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { CompactQtyInput, SubmitButton } from '../../src/components/forms/StockFormHelpers';
import { clearStockListCache } from '../../src/utils/stockCache';
import { useTranslation } from 'react-i18next';
import { useRequireCapability } from '../../src/components/RequireCapability';

type GodownRow = { name: string; qty: number };

type TransferRow = {
  item: StockItem;
  qty: number;
  sourceWh: string;
  godowns: GodownRow[];
};

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

function sourceQty(row: TransferRow): number {
  const g = row.godowns.find(x => x.name === row.sourceWh);
  return g?.qty ?? row.item.qty ?? 0;
}

async function buildTransferRow(item: StockItem, companyGuid: string): Promise<TransferRow> {
  let godowns: GodownRow[] = [];
  try {
    const res = await getStockGodowns(companyGuid, item.id);
    godowns = parseGodowns(res);
  } catch { /* fallback */ }

  if (godowns.length === 0 && item.warehouse) {
    godowns = [{ name: item.warehouse, qty: item.qty || 0 }];
  }
  if (godowns.length === 0) {
    godowns = [{ name: 'Main Location', qty: item.qty || 0 }];
  }

  const sourceWh = godowns.length === 1
    ? godowns[0].name
    : (item.warehouse || godowns[0]?.name || '');

  return { item, qty: 1, sourceWh, godowns };
}

function TransferItemTile({
  row,
  destWh,
  onRemove,
  onQty,
  onSource,
}: {
  row: TransferRow;
  destWh: string;
  onRemove: () => void;
  onQty: (q: number) => void;
  onSource: (wh: string) => void;
}) {
  const avail = sourceQty(row);
  const multiWh = row.godowns.length > 1;
  const whOptions: BSSOption[] = row.godowns.map(g => ({
    label: g.name,
    value: g.name,
    subtitle: `${g.qty} ${row.item.unit || 'pcs'}`,
  }));

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
            <Text style={s.qtyLbl}>Source</Text>
            <BottomSheetSearch
              compact
              placeholder="Source"
              sheetTitle="Source Warehouse"
              searchPlaceholder="Search..."
              icon="home-outline"
              options={whOptions}
              value={row.sourceWh}
              onSelect={o => onSource(o.value)}
            />
          </View>
        ) : (
          <View style={s.whBadge}>
            <Ionicons name="home-outline" size={12} color={COLORS.textSecondary} />
            <Text style={s.whBadgeTxt} numberOfLines={1}>{row.sourceWh}</Text>
            <Text style={s.whQtyTxt}>{avail} {row.item.unit || 'pcs'}</Text>
          </View>
        )}

        <View style={s.qtyCol}>
          <Text style={s.qtyLbl}>Transfer</Text>
          <CompactQtyInput value={row.qty} onChange={onQty} min={1} />
        </View>
      </View>

      {multiWh && row.sourceWh ? (
        <Text style={s.effectHint}>
          Max {avail} {row.item.unit || 'pcs'} at {row.sourceWh}
          {destWh && row.sourceWh === destWh ? ' · same as destination' : ''}
        </Text>
      ) : (
        <Text style={s.effectHint}>Max {avail} {row.item.unit || 'pcs'}</Text>
      )}
    </View>
  );
}

export default function CreateStockTransferScreen() {
  const allowed = useRequireCapability('stock_transfer.create');
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { company } = useAuth();
  const { formatAmount } = useSettings();
  const { numberingPolicy } = useNumberingPolicy(company?.guid);
  const { scopeGodowns, assertCanCreate } = useRbasCreate();
  const companyGuid = company?.guid;

  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingItems, setAddingItems] = useState(false);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [destWh, setDestWh] = useState('');
  const [note, setNote] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    tdkRef?: string;
    voucherNumber?: string;
    numberingPolicy?: string;
    isQueued: boolean;
  } | null>(null);

  const scrollNoteIntoView = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true });
    }, 250);
  }, []);

  useEffect(() => {
    if (!companyGuid) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getStocks(companyGuid, { limit: '1000' }),
      getWarehouses(companyGuid),
    ])
      .then(([stockRes, whRes]: any[]) => {
        const items = stockRes?.data?.items ?? [];
        setStocks(items.map((r: any) => mapStockRow(r, formatAmount)));
        const wh = scopeGodowns(whRes?.data ?? []);
        setAllWarehouses((Array.isArray(wh) ? wh : []).map((w: any) => w.name).filter(Boolean));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyGuid, formatAmount, scopeGodowns]);

  const selectedIds = useMemo(() => new Set(rows.map(r => r.item.id)), [rows]);

  const itemOptions: BSSOption[] = stocks
    .filter(st => !selectedIds.has(st.id))
    .map(st => ({
      label: st.name,
      value: st.id,
      subtitle: [st.sku, `${st.qty} ${st.unit || 'pcs'}`].filter(Boolean).join(' · '),
    }));

  const destOptions: BSSOption[] = allWarehouses.map(w => ({ label: w, value: w }));

  const addItems = useCallback(async (opts: BSSOption[]) => {
    if (!companyGuid || opts.length === 0) return;
    setAddingItems(true);
    try {
      const newRows = await Promise.all(
        opts.map(opt => {
          const item = stocks.find(st => st.id === opt.value);
          if (!item) return null;
          return buildTransferRow(item, companyGuid);
        }),
      );
      setRows(prev => {
        const ids = new Set(prev.map(r => r.item.id));
        const toAdd = newRows.filter((r): r is TransferRow => !!r && !ids.has(r.item.id));
        return [...prev, ...toAdd];
      });
    } finally {
      setAddingItems(false);
    }
  }, [companyGuid, stocks]);

  const removeItem = (id: string) => setRows(p => p.filter(r => r.item.id !== id));
  const updQty = (id: string, q: number) =>
    setRows(p => p.map(r => r.item.id === id ? { ...r, qty: q } : r));
  const updSource = (id: string, wh: string) =>
    setRows(p => p.map(r => r.item.id === id ? { ...r, sourceWh: wh } : r));

  const validate = () => {
    if (rows.length === 0) {
      Toast.show({ type: 'error', text1: 'No Items', text2: 'Add at least one stock item.' });
      return false;
    }
    if (rows.some(r => !r.sourceWh)) {
      Toast.show({ type: 'error', text1: 'Source Required', text2: 'Select source warehouse for each item.' });
      return false;
    }
    if (!destWh) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Select destination warehouse.' });
      return false;
    }
    const same = rows.find(r => r.sourceWh === destWh);
    if (same) {
      Toast.show({
        type: 'error',
        text1: 'Invalid',
        text2: `${same.item.name}: source cannot match destination.`,
      });
      return false;
    }
    if (rows.some(r => r.qty <= 0)) {
      Toast.show({ type: 'error', text1: 'Invalid Qty', text2: 'Each item needs qty greater than 0.' });
      return false;
    }
    const over = rows.find(r => r.qty > sourceQty(r));
    if (over) {
      Toast.show({
        type: 'error',
        text1: 'Exceeds Stock',
        text2: `${over.item.name}: max ${sourceQty(over)} ${over.item.unit || 'pcs'} in ${over.sourceWh}`,
      });
      return false;
    }
    return true;
  };

  const handleDone = async () => {
    if (!company?.guid) return;
    if (!assertCanCreate('stock_transfer.create')) return;
    try {
      const res: any = await createStockTransfer({
        companyGuid: company.guid,
        companyName: company.name || '',
        date: new Date().toISOString().slice(0, 10),
        toGodown: destWh,
        narration: note || `Transfer ${rows.length} item(s) → ${destWh}`,
        note,
        numbering_policy: numberingPolicy,
        items: rows.map(r => ({
          itemName: r.item.name,
          qty: r.qty,
          rate: +(r.item.value?.replace(/[^0-9.]/g, '') || 0),
          unit: r.item.unit || 'pcs',
          fromGodown: r.sourceWh,
          availableQty: sourceQty(r),
        })),
      });
      setSubmitResult({
        tdkRef: res?.tdkRef || res?.tdkReferenceNo,
        voucherNumber: res?.voucherNumber,
        numberingPolicy: res?.numberingPolicy || numberingPolicy,
        isQueued: !!res?.queued,
      });
      clearStockListCache();
      setShowSuccess(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Transfer Failed', text2: err?.message || 'Please try again.' });
    }
  };

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('stocks.createTransfer')}</Text>
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
                <TransferItemTile
                  key={r.item.id}
                  row={r}
                  destWh={destWh}
                  onRemove={() => removeItem(r.item.id)}
                  onQty={q => updQty(r.item.id, q)}
                  onSource={wh => updSource(r.item.id, wh)}
                />
              ))}
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionTitle}>Destination</Text>
            <BottomSheetSearch
              label="Destination Warehouse"
              required
              placeholder="Select destination..."
              sheetTitle="Destination Warehouse"
              searchPlaceholder="Search warehouses..."
              icon="navigate-outline"
              options={destOptions}
              value={destWh}
              onSelect={o => setDestWh(o.value)}
              onClear={() => setDestWh('')}
            />
          </View>

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
        </ScrollView>
      )}

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <SubmitButton
          idleLabel={rows.length ? `Transfer ${rows.length} Item${rows.length !== 1 ? 's' : ''}` : 'Transfer'}
          loadingLabel="Transferring..."
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
              {submitResult.isQueued ? 'Saved. Pending Sync' : 'Transfer Saved!'}
            </Text>
            <Text style={ss.sub}>
              {rows.length} item(s) → {destWh}.
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
                  router.replace(`/stocks/transfer-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef!)}` as any);
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
