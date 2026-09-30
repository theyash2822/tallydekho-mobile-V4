import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, TextInput, Modal, TextInputProps, ActivityIndicator, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { currentTenantKey, prefillFeature, lowStockToPoPrefillFeature } from '../../src/utils/tenantStorage';
import {
  getParties, createPurchaseOrder, getStocks, getWarehouses,
  getPurchaseLedgerAccounts, getTaxLedgers, getChargeLedgers, getStockGodowns,
  getCompanyProfile,
} from '../../src/services/api';
import { shareVoucherPdf, shareVoucherPdfByRef } from '../../src/utils/voucherPdf';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import FormField from '../../src/components/forms/FormField';
import RegularOptionalToggle from '../../src/components/forms/RegularOptionalToggle';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import DatePickerModal, { parseDMY } from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { taxFieldsFromLedgerSelect, resolveTaxLedgerRate } from '../../src/utils/taxLedgerHelpers';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useRequireCapability } from '../../src/components/RequireCapability';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
};

const dmyToISO = (dmy: string): string => {
  if (!dmy) return '';
  const parts = dmy.split('/');
  if (parts.length < 3) return dmy;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
};

const formatDueDisplay = (dmy: string): string => {
  if (!dmy) return '';
  try {
    const parsed = parseDMY(dmy);
    if (!parsed) return dmy;
    const d = new Date(parsed);
    return `Due: ${d.getDate()} ${d.toLocaleString('en-IN', { month: 'long' })} ${d.getFullYear()}`;
  } catch { return dmy; }
};

const calcItem = (item: OrderItem) => {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gross = qty * rate;
  const disc = parseFloat(item.discount) || 0;
  const discAmt = item.discountType === '%' ? gross * disc / 100 : Math.min(disc, gross);
  const taxable = gross - discAmt;
  const taxAmt = (item.taxEntries || []).reduce((sum, t) => {
    const override = parseFloat(t.taxAmount);
    if (!isNaN(override) && t.taxAmount.trim() !== '') return sum + override;
    return sum + taxable * (parseFloat(t.taxRate) || 0) / 100;
  }, 0);
  return { gross, discAmt, taxable, taxAmt, subtotal: taxable + taxAmt };
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
  id?: number;
  guid?: string;        // Tally GUID — used for godowns API lookup
  name: string;
  displayName?: string;
  closing_qty?: number;
  unit?: string;
  rate?: number;
  hsn?: string;
}

interface Warehouse { id: number; name: string; guid?: string; }
interface Godown { name: string; qty: number; }

interface TaxLedgerEntry {
  id: string;
  ledgerName: string;
  taxRate: string;
  taxAmount: string;
}

interface OrderItem {
  id: string;
  warehouse: string;
  product: string;
  qty: string;
  unit: string;
  rate: string;
  discountType: '%' | 'flat';
  discount: string;
  taxEntries: TaxLedgerEntry[];
}

const newItem = (warehouseName = ''): OrderItem => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  warehouse: warehouseName, product: '', qty: '1', unit: 'pcs', rate: '',
  discountType: '%', discount: '0', taxEntries: [],
});

type ModalState = { type: 'unit'; itemId: string } | null;

// ─── ThemedFInput ──────────────────────────────────────────────────────────────
function ThemedFInput({ style, onFocus, onBlur, keyboardType, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const isNumeric = keyboardType === 'numeric' || keyboardType === 'decimal-pad' || keyboardType === 'number-pad';
  return (
    <TextInput
      style={[
        s.fInput,
        focused && s.fInputFocused,
        Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
        style,
      ]}
      placeholderTextColor={COLORS.textTertiary}
      keyboardType={keyboardType}
      selectTextOnFocus={isNumeric}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      {...props}
    />
  );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 }) {
  const { t } = useTranslation();
  const STEPS = [
    { num: 1 as const, label: t('screens.purchaseCreateOrder.orderDetails') },
    { num: 2 as const, label: t('screens.purchaseCreateOrder.itemsReview') },
  ];
  return (
    <View style={si.wrap}>
      {STEPS.map((st, idx) => (
        <React.Fragment key={st.num}>
          <View style={si.stepItem}>
            <View style={[si.circle, step === st.num && si.circleActive, step > st.num && si.circleDone]}>
              {step > st.num
                ? <Ionicons name="checkmark" size={13} color={COLORS.white} />
                : <Text style={[si.circleNum, step === st.num && si.circleNumActive]}>{st.num}</Text>}
            </View>
            <Text style={[si.label, step === st.num && si.labelActive]}>
              {st.label}
            </Text>
          </View>
          {idx < STEPS.length - 1 && <View style={[si.line, step > st.num && si.lineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── TaxEntryRow ─────────────────────────────────────────────────────────────
function TaxEntryRow({ entry, taxLedgers, onUpdate, onRemove, taxable }: {
  entry: TaxLedgerEntry;
  taxLedgers: { name: string; guid?: string; taxRate?: number }[];
  onUpdate: (field: keyof TaxLedgerEntry, val: string) => void;
  onRemove: () => void;
  taxable: number;
}) {
  const { t } = useTranslation();
  const taxOpts: BSSOption[] = taxLedgers.map(l => {
    const rate = resolveTaxLedgerRate(l);
    return { label: l.name, value: l.name, subtitle: rate > 0 ? `${rate}%` : undefined };
  });
  return (
    <View style={ir.taxEntryCard}>
      {/* Row 1: Ledger + Remove */}
      <View style={ir.taxEntryTopRow}>
        <View style={{ flex: 1 }}>
          <BottomSheetSearch
            compact
            options={taxOpts}
            value={entry.ledgerName}
            onSelect={opt => {
              const applied = taxFieldsFromLedgerSelect(opt.value, taxLedgers, taxable);
              onUpdate('ledgerName', applied.ledgerName);
              onUpdate('taxRate', applied.taxRate);
              onUpdate('taxAmount', applied.taxAmount);
            }}
            onClear={() => {
              onUpdate('ledgerName', '');
              onUpdate('taxRate', '');
              onUpdate('taxAmount', '');
            }}
            placeholder={t('screens.purchaseCreateOrder.selectTaxLedger')}
            sheetTitle={t('screens.purchaseCreateOrder.taxLedger')}
          />
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={16} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
      {/* Row 2: Rate % → Amount ₹ — disabled until ledger selected */}
      <View style={[ir.taxEntryBottomRow, !entry.ledgerName && { opacity: 0.38 }]} pointerEvents={entry.ledgerName ? 'auto' : 'none'}>
        <View style={ir.taxFieldGroup}>
          <Text style={ir.taxMiniLbl}>{t('pdf.rate')}</Text>
          <View style={ir.taxFieldInputRow}>
            <TextInput
              style={ir.taxRateInput}
              value={entry.taxRate}
              onChangeText={v => {
                onUpdate('taxRate', v);
                const auto = (taxable * (parseFloat(v) || 0) / 100).toFixed(2);
                onUpdate('taxAmount', auto);
              }}
              keyboardType="numeric"
              placeholder={entry.ledgerName ? '0' : t('screens.purchaseCreateOrder.selectLedgerFirst')}
              placeholderTextColor={COLORS.textTertiary}
              editable={!!entry.ledgerName}
            />
            <Text style={ir.taxRateSign}>%</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-outline" size={13} color={COLORS.textTertiary} style={{ marginTop: 16 }} />
        <View style={[ir.taxFieldGroup, { flex: 1 }]}>
          <Text style={ir.taxMiniLbl}>{t('pdf.amount')}</Text>
          <View style={ir.taxFieldInputRow}>
            <Text style={ir.taxRateSign}>₹</Text>
            <TextInput
              style={[ir.taxAmtInput, { flex: 1, width: undefined }]}
              value={entry.taxAmount}
              onChangeText={v => onUpdate('taxAmount', v)}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textTertiary}
              editable={!!entry.ledgerName}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── ItemRow ─────────────────────────────────────────────────────────────────
function ItemRow({
  item, stockItems, warehouses, taxLedgers, godowns,
  onProductSelect, onProductClear, onUpdate, onRemove, onOpenModal, onBarcodePress,
  onAddTaxEntry, onUpdateTaxEntry, onRemoveTaxEntry,
  itemIndex, canRemove,
}: {
  item: OrderItem;
  stockItems: StockItem[];
  warehouses: Warehouse[];
  taxLedgers: { name: string; guid?: string; taxRate?: number }[];
  godowns: Godown[];
  onProductSelect: (itemId: string, opt: BSSOption) => void;
  onProductClear: (itemId: string) => void;
  onUpdate: (id: string, field: keyof OrderItem, val: string) => void;
  onRemove: (id: string) => void;
  onOpenModal: (s: ModalState) => void;
  onBarcodePress: (itemId: string) => void;
  onAddTaxEntry: (itemId: string) => void;
  onUpdateTaxEntry: (itemId: string, entryId: string, field: keyof TaxLedgerEntry, val: string) => void;
  onRemoveTaxEntry: (itemId: string, entryId: string) => void;
  itemIndex: number;
  canRemove: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const calc = calcItem(item);

  const stockOpts: BSSOption[] = stockItems.map(si2 => ({
    label: si2.displayName || si2.name,
    value: si2.name,
    subtitle: `${si2.closing_qty ?? 0} ${si2.unit || 'pcs'}`,
  }));

  const stockItem = stockItems.find(si2 => si2.name === item.product);
  const productLabel = stockItem ? (stockItem.displayName || stockItem.name) : '';
  const headerLabel = productLabel || t('screens.purchaseCreateOrder.itemN', { n: itemIndex + 1 });

  // Purchase = destination godown: show ALL company warehouses (not only those with qty>0).
  const qtyByWh = useMemo(() => {
    const map: Record<string, number> = {};
    godowns.forEach(g => { map[g.name] = g.qty; });
    return map;
  }, [godowns]);
  const warehouseOpts: BSSOption[] = warehouses.length > 0
    ? warehouses.map(w => ({
        label: w.name,
        value: w.name,
        subtitle: qtyByWh[w.name] != null
          ? t('screens.purchaseCreateOrder.onHand', { qty: Math.round(qtyByWh[w.name]), unit: stockItem?.unit || t('screens.purchaseCreateOrder.units') })
          : t('screens.purchaseCreateOrder.receiveStockHere'),
      }))
    : item.product
      ? [{ label: 'Main Location', value: 'Main Location', subtitle: t('screens.purchaseCreateOrder.defaultWarehouse') }]
      : [];
  const needsWarehouseDropdown = !!item.product && warehouseOpts.length >= 1;

  return (
    <View style={ir.card}>
      {/* Always-visible header row */}
      <View style={ir.rowHeader}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <Ionicons name="cube-outline" size={14} color={item.product ? COLORS.brandPrimary : COLORS.textSecondary} />
          <Text style={[ir.rowHeaderTxt, item.product ? ir.rowHeaderTxtActive : undefined]} numberOfLines={1}>
            {headerLabel}
          </Text>
          {item.product && calc.subtotal > 0 && (
            <Text style={ir.rowHeaderAmt}>₹{calc.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
          )}
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
        {canRemove && (
          <TouchableOpacity onPress={() => onRemove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={ir.headerTrashBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={15} color={COLORS.negative} />
          </TouchableOpacity>
        )}
      </View>

      {expanded && (
        <View style={ir.expandedContent}>
          {/* Product / Service */}
          <View>
            <Text style={ir.fieldLabel}>{t('screens.purchaseCreateOrder.productService')} <Text style={ir.star}>*</Text></Text>
            <View style={ir.productRow}>
              <View style={{ flex: 1 }}>
                <BottomSheetSearch
                  placeholder={t('screens.purchaseCreateOrder.selectProduct')}
                  options={stockOpts}
                  value={item.product}
                  onSelect={opt => onProductSelect(item.id, opt)}
                  onClear={() => onProductClear(item.id)}
                  sheetTitle={t('screens.purchaseCreateOrder.productService')}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <TouchableOpacity style={ir.barcodeBtn} onPress={() => onBarcodePress(item.id)} activeOpacity={0.7}>
                <Ionicons name="scan-outline" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Warehouse — only shown when product is selected */}
          {item.product && needsWarehouseDropdown ? (
            <View>
              <Text style={ir.fieldLabel}>{t('screens.purchaseCreateOrder.warehouse')} <Text style={ir.star}>*</Text></Text>
              <BottomSheetSearch
                placeholder={t('screens.purchaseCreateOrder.selectWarehouse')}
                options={warehouseOpts}
                value={item.warehouse}
                onSelect={opt => onUpdate(item.id, 'warehouse', opt.value)}
                onClear={() => onUpdate(item.id, 'warehouse', '')}
                sheetTitle={t('screens.purchaseCreateOrder.warehouse')}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
          ) : null}

          {/* Row: Qty | Unit | Rate */}
          <View style={ir.qurRow}>
            <View style={ir.qtyBox}>
              <Text style={ir.miniLabel}>{t('pdf.qty')} <Text style={ir.star}>*</Text></Text>
              <TextInput
                style={[ir.miniInput, { textAlign: 'center' }]}
                value={item.qty}
                onChangeText={v => onUpdate(item.id, 'qty', v)}
                keyboardType="numeric"
                selectTextOnFocus
                placeholder="1"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
            <View style={ir.unitBox}>
              <Text style={ir.miniLabel}>{t('screens.purchaseCreateOrder.unit')}</Text>
              <TouchableOpacity style={ir.unitBtn} onPress={() => onOpenModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
                <Text style={ir.unitTxt}>{item.unit || 'pcs'}</Text>
                <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={ir.rateBox}>
              <Text style={ir.miniLabel}>{t('screens.purchaseCreateOrder.rateRupee')} <Text style={ir.star}>*</Text></Text>
              <TextInput
                style={[ir.miniInput, { textAlign: 'right' }]}
                value={item.rate}
                onChangeText={v => onUpdate(item.id, 'rate', v)}
                keyboardType="numeric"
                selectTextOnFocus
                placeholder="0.00"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          </View>

          {/* Row: Discount (compact inline) */}
          <View style={ir.discFullRow}>
            <Text style={ir.miniLabel}>{t('screens.purchaseCreateOrder.discount')}</Text>
            <View style={ir.discInner}>
              <TouchableOpacity style={ir.discTypeBtn} onPress={() => onUpdate(item.id, 'discountType', item.discountType === '%' ? 'flat' : '%')} activeOpacity={0.7}>
                <Text style={ir.discTypeTxt}>{item.discountType === '%' ? '%' : '₹'}</Text>
              </TouchableOpacity>
              <TextInput
                style={ir.discInput}
                value={item.discount}
                onChangeText={v => onUpdate(item.id, 'discount', v)}
                keyboardType="numeric"
                selectTextOnFocus
                placeholder="0"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>
          </View>

          {/* Taxable Amount */}
          <View style={ir.taxableRow}>
            <Text style={ir.taxableLabel}>{t('screens.purchaseCreateOrder.taxableAmount')}</Text>
            <Text style={ir.taxableVal}>₹{calc.taxable.toFixed(2)}</Text>
          </View>

          {/* Tax Section */}
          <View style={ir.taxSection}>
            <View style={ir.taxSectionHdr}>
              <Text style={ir.taxSectionTitle}>{t('screens.purchaseCreateOrder.taxes')}</Text>
              <Text style={ir.taxColHint}>{t('screens.purchaseCreateOrder.taxColHint')}</Text>
            </View>
            {item.taxEntries.map(te => (
              <TaxEntryRow
                key={te.id}
                entry={te}
                taxLedgers={taxLedgers}
                taxable={calc.taxable}
                onUpdate={(field, val) => onUpdateTaxEntry(item.id, te.id, field, val)}
                onRemove={() => onRemoveTaxEntry(item.id, te.id)}
              />
            ))}
            <TouchableOpacity
              style={ir.addTaxDashedBtn}
              onPress={() => onAddTaxEntry(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={ir.addTaxDashedTxt}>{t('screens.purchaseCreateOrder.addTax')}</Text>
            </TouchableOpacity>
          </View>

          {/* Item Total */}
          <View style={ir.subtotalRow}>
            <Text style={ir.subtotalLabel}>{t('screens.purchaseCreateOrder.itemTotal')}</Text>
            <Text style={ir.subtotalVal}>₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreatePurchaseOrderScreen() {
  const allowed = useRequireCapability('purchase_order.create');
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  // ── Core state ───────────────────────────────────────────────────────────────
  const {entryMode, entryType, setEntryType, scopeParties, scopeGodowns, assertCanCreate} = useRbasCreate();
  const [orderNo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [purchaseLedger, setPurchaseLedger] = useState('');
  const [vendor, setVendor] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorGstRegType, setVendorGstRegType] = useState('');
  const [vendors, setVendors] = useState<BSSOption[]>([]);
  const [refNo, setRefNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // API data — live masters, same as invoice
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [purchaseLedgers, setPurchaseLedgers] = useState<{ name: string; guid?: string }[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<{ name: string; guid?: string; taxRate?: number }[]>([]);
  const [chargeLedgers, setChargeLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);
  const [roundOffLedgers, setRoundOffLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);
  const [companyProfile, setCompanyProfile] = useState<{ address?: string; state?: string; pincode?: string; gstin?: string; pan?: string; phone?: string; email?: string } | null>(null);

  // Per-item godowns (fetched when product selected)
  const [itemGodowns, setItemGodowns] = useState<Record<string, Godown[]>>({});

  const [items, setItems] = useState<OrderItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [roundOffLedger, setRoundOffLedger] = useState('');
  const [roundOffAmount, setRoundOffAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [termsText, setTermsText] = useState('Goods once sold will not be taken back.');
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ tdkRef: string; isQueued: boolean; message: string; voucherNumber?: string; numberingPolicy?: string } | null>(null);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  // Universal numbering — Settings → Voucher Config only (no on-screen override)
  const { numberingPolicy } = useNumberingPolicy(company?.guid);

  // Low Stock → PO prefill (qty 0, rate from stock when available)
  useEffect(() => {
    if (!company?.guid) return;
    const key = currentTenantKey(company.guid, lowStockToPoPrefillFeature());
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const PREFILL_TTL_MS = 30 * 60 * 1000;
        const isFresh = d?.savedAt && (Date.now() - d.savedAt) < PREFILL_TTL_MS;
        if (!isFresh || !Array.isArray(d.items) || d.items.length === 0) {
          AsyncStorage.removeItem(key).catch(() => {});
          return;
        }
        const autoWh = ''; // warehouses may not be loaded yet; user/auto-fill later
        const mapped: OrderItem[] = d.items.map((it: any) => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          warehouse: String(it.warehouse || autoWh || ''),
          product: String(it.product || ''),
          qty: '0',
          unit: String(it.unit || 'pcs'),
          rate: it.rate != null && String(it.rate).trim() !== '' ? String(it.rate) : '',
          discountType: (it.discountType === 'flat' ? 'flat' : '%') as '%' | 'flat',
          discount: String(it.discount ?? '0'),
          taxEntries: Array.isArray(it.taxEntries) ? it.taxEntries : [],
        })).filter((it: OrderItem) => !!it.product);
        if (mapped.length) {
          setItems(mapped);
          setStep(2);
          Toast.show({
            type: 'success',
            text1: i18n.t('screens.purchaseCreateOrder.itemsAddedToPo'),
            text2: mapped.length === 1 ? i18n.t('screens.purchaseCreateOrder.prefillLinesOne', { count: mapped.length }) : i18n.t('screens.purchaseCreateOrder.prefillLinesOther', { count: mapped.length }),
          });
        }
      } catch { /* ignore bad prefill */ }
      AsyncStorage.removeItem(key).catch(() => {});
    }).catch(() => {});
  }, [company?.guid]);

  // Auto-scroll to top whenever step changes
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [step]);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    getParties(company.guid, { type: 'vendor' }).then((res: any) => {
      const list = scopeParties(res?.data || []);
      setVendors(list.map((p: any) => ({
        label: p.name,
        value: p.name,
        subtitle: p.gstin ? `GSTIN: ${p.gstin}` : undefined,
        data: {
          gstin: p.gstin || '',
          gst_registration_type: p.gst_registration_type || '',
          guid: p.guid || '',
          address: p.address || '',
          state_name: p.state_name || '',
          pincode: p.pincode || '',
        },
      })));
    }).catch(() => {});
  }, [company?.guid, scopeParties]);

  useEffect(() => {
    if (!company?.guid) return;
    getCompanyProfile(company.guid).then((res: any) => {
      const d = res?.data;
      if (d) setCompanyProfile({
        address: d.address || '', state: d.state || '', pincode: d.pincode || '',
        gstin: d.gstin || '', pan: d.pan || '', phone: d.phone || '', email: d.email || '',
      });
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getStocks(company.guid, { limit: 2000 }).then((res: any) => {
      const list = res?.data?.items || res?.items || res?.data || [];
      setStockItems(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getWarehouses(company.guid).then((res: any) => {
      const list: Warehouse[] = scopeGodowns(res?.data || res?.warehouses || []);
      setWarehouses(list);
      if (list.length === 1) setItems(prev => prev.map(i => ({ ...i, warehouse: list[0].name })));
    }).catch(() => {});
  }, [company?.guid, scopeGodowns]);

  useEffect(() => {
    if (!company?.guid) return;
    getPurchaseLedgerAccounts(company.guid).then((res: any) => {
      const list = res?.data || [];
      setPurchaseLedgers(list);
      if (list.length > 0 && !purchaseLedger) setPurchaseLedger(list[0].name);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getTaxLedgers(company.guid).then((res: any) => {
      setTaxLedgers(res?.data || []);
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getChargeLedgers(company.guid).then((res: any) => {
      const d = res?.data;
      if (d) {
        setChargeLedgers([...(d.logisticsCharges || []), ...(d.additionalCharges || [])]);
        setRoundOffLedgers(d.roundOffLedgers || []);
      }
    }).catch(() => {});
  }, [company?.guid]);

  // ── Item actions ─────────────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, field: keyof OrderItem, val: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val as any } : i));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
    setItemGodowns(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const addItem = useCallback(() => {
    const autoWarehouse = warehouses.length === 1 ? warehouses[0].name : '';
    setItems(prev => [...prev, newItem(autoWarehouse)]);
  }, [warehouses]);

  const handleProductSelect = useCallback(async (itemId: string, opt: BSSOption) => {
    const si2 = stockItems.find(s => s.name === opt.value);
    // Destination warehouse: auto-pick only when company has exactly one warehouse.
    const autoWh = warehouses.length === 1 ? warehouses[0].name : '';
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      product: opt.value,
      unit: si2?.unit || i.unit,
      rate: si2?.rate != null ? String(si2.rate) : i.rate,
      warehouse: autoWh,
    } : i));
    const guid = company?.guid;
    if (!si2 || !guid) return;
    try {
      const stockIdentifier = si2.guid || si2.name;
      const res: any = await getStockGodowns(guid, stockIdentifier);
      const godownList: Godown[] = res?.data?.warehouses || [];
      setItemGodowns(prev => ({ ...prev, [itemId]: godownList }));
    } catch {
      setItemGodowns(prev => ({ ...prev, [itemId]: [] }));
    }
  }, [stockItems, company?.guid, warehouses]);

  const handleProductClear = useCallback((itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, product: '', unit: 'pcs', rate: '', warehouse: '' } : i));
    setItemGodowns(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  }, []);

  const addTaxEntry = useCallback((itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      taxEntries: [...i.taxEntries, {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        ledgerName: '', taxRate: '', taxAmount: '',
      }],
    } : i));
  }, []);

  const updateTaxEntry = useCallback((itemId: string, entryId: string, field: keyof TaxLedgerEntry, val: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      taxEntries: i.taxEntries.map(t => t.id === entryId ? { ...t, [field]: val } : t),
    } : i));
  }, []);

  const removeTaxEntry = useCallback((itemId: string, entryId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i, taxEntries: i.taxEntries.filter(t => t.id !== entryId),
    } : i));
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!purchaseLedger) { Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.purchaseLedgerRequired') }); return; }
    if (!vendor) { Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.vendorRequired') }); return; }
    setStep(2);
  }, [purchaseLedger, vendor, t]);

  const goBack = useCallback(() => {
    setStep(1);
  }, []);

  const closeModal = useCallback(() => setActiveModal(null), []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let gross = 0, discTotal = 0, taxTotal = 0;
    items.forEach(item => {
      const c = calcItem(item);
      gross += c.gross; discTotal += c.discAmt; taxTotal += c.taxAmt;
    });
    const chargesOnly = calcLogisticsTotal(logEntries, 0);
    const roundOff = parseFloat(roundOffAmount) || 0;
    const grand = gross - discTotal + taxTotal + chargesOnly + roundOff;
    return { gross, discTotal, taxTotal, logisticsTotal: chargesOnly, roundOff, grand };
  }, [items, logEntries, roundOffAmount]);

  const unitOptions = useMemo(() => {
    const units = [...new Set(stockItems.map(i => i.unit).filter(Boolean))] as string[];
    return units.length > 0 ? units : ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
  }, [stockItems]);

  const itemsSummary = useMemo(() => {
    const filled = items.filter(i => i.product);
    if (filled.length === 0) return items.length !== 1 ? t('screens.purchaseCreateOrder.itemsNotFilledOther', { count: items.length }) : t('screens.purchaseCreateOrder.itemsNotFilledOne', { count: items.length });
    const first = stockItems.find(si2 => si2.name === filled[0].product);
    const firstName = first?.displayName || filled[0].product;
    if (filled.length === 1) return firstName;
    return t('screens.purchaseCreateOrder.firstPlusMore', { name: firstName, count: filled.length - 1 });
  }, [items, stockItems, t]);

  // Build a local VoucherDocument snapshot from current form state — used for
  // Share PDF so it doesn't depend on the backend having persisted an
  // app_vouchers row (sales orders are not yet fully wired into that table).
  const buildLocalDoc = useCallback((): any => {
    const vendorOpt = vendors.find(p => p.value === vendor);
    const docItems = items.filter(i => i.product).map((item, idx) => {
      const c = calcItem(item);
      return {
        id: String(idx), name: item.product, qty: parseFloat(item.qty) || 0,
        unit: item.unit, rate: parseFloat(item.rate) || 0,
        discount: parseFloat(item.discount) || 0,
        taxAmount: c.taxAmt, amount: c.taxable,
      };
    });
    const docTaxes = items.flatMap(item => {
      const c = calcItem(item);
      return (item.taxEntries || []).filter(t => t.ledgerName).map(t => ({
        description: t.ledgerName, rate: parseFloat(t.taxRate) || 0,
        taxableAmount: c.taxable, total: parseFloat(t.taxAmount) || 0,
      }));
    });
    return {
      documentTitle: `Purchase Order - ${submitResult?.voucherNumber || orderNo || 'Draft'}`,
      documentType: 'purchase_order',
      documentNumber: submitResult?.voucherNumber || 'Pending from TallyPrime',
      date: date ? dmyToISO(date) : '',
      company: {
        name: company?.name || '',
        address: companyProfile?.address || '',
        gstin: companyProfile?.gstin || '',
        pan: companyProfile?.pan || '',
        phone: companyProfile?.phone || '',
        email: companyProfile?.email || '',
        state: companyProfile?.state || '',
      },
      party: {
        name: vendor,
        address: vendorOpt?.data?.address || '',
        gstin: vendorGstin || '',
      },
      items: docItems,
      taxes: docTaxes,
      totals: {
        subtotal: totals.gross - totals.discTotal,
        taxTotal: totals.taxTotal,
        total: totals.grand,
        roundOff: totals.roundOff,
      },
      narration: narration || '',
      additionalCharges: logEntries.filter(e => e.ledgerName).map(e => ({ description: e.ledgerName, amount: parseFloat(e.amount) || 0 })),
      isProvisional: true,
    };
  }, [vendors, vendor, items, submitResult, orderNo, date, company, companyProfile, vendorGstin, totals, narration, logEntries]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!assertCanCreate('purchase_order.create')) return;
    Keyboard.dismiss();
    if (!purchaseLedger) { Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.purchaseLedgerRequired') }); return; }
    if (!vendor) { Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.vendorRequired') }); return; }
    const filledItems = items.filter(i => i.product && (parseFloat(i.qty) || 0) > 0 && (parseFloat(i.rate) || 0) > 0);
    if (filledItems.length === 0) { Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.addAtLeastOneItem') }); return; }
    if (items.some(i => i.product && (!(parseFloat(i.qty) > 0) || !(parseFloat(i.rate) > 0)))) {
      Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.allItemsNeedQtyRate') }); return;
    }
    // Match PI: any company warehouse list requires an explicit destination pick
    const needsWarehouse = items.filter(i => i.product && warehouses.length > 0);
    if (needsWarehouse.some(i => !i.warehouse)) { Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.selectWarehouseAll') }); return; }

    setSubmitting(true);
    try {
      const allLogistics = [
        ...logEntries.map(e => ({
          ledgerName: e.ledgerName,
          amount: parseFloat(e.amount) || 0,
          taxes: e.addTaxes ? e.taxEntries.map(t => ({
            ledgerName: t.ledgerName,
            taxRate: parseFloat(t.taxRate),
            taxAmount: parseFloat(t.taxAmount) || 0,
          })) : [],
        })),
        ...(roundOffLedger && roundOffAmount
          ? [{ ledgerName: roundOffLedger, amount: parseFloat(roundOffAmount) || 0, taxes: [] }]
          : []),
      ];

      const result: any = await createPurchaseOrder({
        companyGuid: company?.guid, companyName: company?.name,
        partyLedger: vendor, date: dmyToISO(date),
        dueDate: dueDate ? dmyToISO(dueDate) : undefined,
        isOptional: entryType === 'optional',
        original_entry_type: entryType,
        numbering_policy: numberingPolicy,
        totalAmount: totals.grand, reference: refNo || undefined,
        narration: narration || undefined, termsText: termsText || undefined,
        items: items.filter(i => i.product).map(item => ({
          itemName: item.product,
          billedQty: parseFloat(item.qty) || 0,
          actualQty: parseFloat(item.qty) || 0,
          rate: parseFloat(item.rate) || 0,
          amount: calcItem(item).taxable,
          purchaseLedger,
          godown: item.warehouse || warehouses[0]?.name || 'Main Location',
        })),
        taxes: items.flatMap(item => {
          const taxable = calcItem(item).taxable;
          return (item.taxEntries || [])
            .filter(t => t.ledgerName && (parseFloat(t.taxRate) > 0 || parseFloat(t.taxAmount) > 0))
            .map(t => {
              const override = parseFloat(t.taxAmount);
              const taxAmt = !isNaN(override) && t.taxAmount.trim() !== ''
                ? override
                : taxable * (parseFloat(t.taxRate) || 0) / 100;
              return { ledgerName: t.ledgerName, taxRate: parseFloat(t.taxRate), taxAmount: taxAmt, taxableValue: taxable };
            });
        }),
        logistics: allLogistics,
      });

      const tdkRef = result?.data?.tdkReferenceNo || result?.tdkReferenceNo || '';
      const isQueued = result?.queued === true;
      const voucherNumber = result?.voucherNumber || result?.data?.voucherNumber || undefined;
      const respNumberingPolicy = result?.numberingPolicy || numberingPolicy;
      setSubmitResult({ tdkRef, isQueued, message: result?.message || '', voucherNumber, numberingPolicy: respNumberingPolicy });
      setShowSuccess(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.submitFailed'), text2: err?.message || t('screens.purchaseCreateOrder.checkTallyConnection') });
    } finally {
      setSubmitting(false);
    }
  }, [
    purchaseLedger, vendor, items, company, date, dueDate, entryType, totals.grand,
    refNo, narration, termsText, warehouses, logEntries, roundOffLedger, roundOffAmount, numberingPolicy, t,
  ]);

  // ── Convert to Purchase Invoice ───────────────────────────────────────────────
  const handleConvertToInvoice = useCallback(async () => {
    const guid = company?.guid;
    if (!guid) return;
    try {
      const prefill = {
        // Keys mirror SI reader expectations; PI maps party→vendor, ledger→purchaseLedger.
        party: vendor,
        ledger: purchaseLedger,
        date, refNo, narration, termsText,
        items, logEntries, roundOffLedger, roundOffAmount,
        // Only stamp a real Tally/TD order number — never a TDK ref (invalid as ORDERNO).
        againstOrderNo: submitResult?.voucherNumber || undefined,
        sourceTdkRef: submitResult?.tdkRef || undefined,
        dueDate,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(currentTenantKey(guid, prefillFeature('tdpo')), JSON.stringify(prefill));
      setShowSuccess(false);
      router.replace('/purchase/create-invoice');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.couldNotStartInvoice'), text2: err?.message || '' });
    }
  }, [company?.guid, vendor, purchaseLedger, date, refNo, narration, termsText, items, logEntries, roundOffLedger, roundOffAmount, submitResult, dueDate, router, t]);

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? () => router.back() : goBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('purchase.createOrder')}</Text>
          <Text style={s.headerSub}>{orderNo || t('screens.purchaseCreateOrder.poAuto')}</Text>
        </View>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} entryMode={entryMode} />
      </View>

      <StepIndicator step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'android' ? 120 : 0}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>

          {/* ═══════════ STEP 1: Order Details ═══════════ */}
          {step === 1 && (
            <>
              <BottomSheetSearch
                label={t('screens.purchaseCreateOrder.purchaseLedger')} required
                placeholder={t('screens.purchaseCreateOrder.searchLedgerAccount')}
                options={purchaseLedgers.map(l => ({ label: l.name, value: l.name }))}
                value={purchaseLedger}
                onSelect={opt => setPurchaseLedger(opt.value)}
                onClear={() => setPurchaseLedger('')}
                sheetTitle={t('screens.purchaseCreateOrder.purchaseLedger')}
                icon="book-outline"
              />

              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.cardTitle}>{t('screens.purchaseCreateOrder.orderDetails')}</Text>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{t('screens.purchaseCreateOrder.orderNo')}</Text>
                    <View style={s.autoBox}>
                      <Text style={s.autoTxt}>{orderNo || t('screens.purchaseCreateOrder.auto')}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{t('voucher.date')} <Text style={s.star}>*</Text></Text>
                    <TouchableOpacity style={s.fInput} onPress={() => setShowDatePicker(true)}>
                      <Text style={{ color: date ? COLORS.textPrimary : COLORS.textTertiary }}>{date || t('screens.purchaseCreateOrder.selectDate')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{t('pdf.dueDate')}</Text>
                    <TouchableOpacity style={s.fInput} onPress={() => setShowDueDatePicker(true)}>
                      <Text style={{ color: dueDate ? COLORS.textPrimary : COLORS.textTertiary }} numberOfLines={1}>
                        {dueDate ? formatDueDisplay(dueDate) : 'DD/MM/YYYY'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{t('screens.purchaseCreateOrder.referenceNo')}</Text>
                    <ThemedFInput value={refNo} onChangeText={setRefNo} placeholder={t('common.optional')} />
                  </View>
                </View>
              </View>

              <BottomSheetSearch
                label={t('screens.purchaseCreateOrder.vendor')} required
                placeholder={t('screens.purchaseCreateOrder.searchVendor')}
                options={vendors}
                value={vendor}
                onSelect={opt => {
                  setVendor(opt.value);
                  setVendorGstin(opt.data?.gstin || '');
                  setVendorGstRegType(opt.data?.gst_registration_type || '');
                }}
                onClear={() => { setVendor(''); setVendorGstin(''); setVendorGstRegType(''); }}
                sheetTitle={t('screens.purchaseCreateOrder.vendor')}
                icon="person-outline"
              />
              {vendor && vendorGstin ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, marginBottom: 2, paddingHorizontal: 2 }}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.positive} />
                  <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600' }}>{vendorGstin}</Text>
                  {vendorGstRegType ? (
                    <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary }}>· {vendorGstRegType}</Text>
                  ) : null}
                </View>
              ) : vendor && !vendorGstin ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, marginBottom: 2, paddingHorizontal: 2 }}>
                  <Ionicons name="alert-circle-outline" size={13} color={COLORS.textTertiary} />
                  <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary }}>{t('screens.purchaseCreateOrder.noGstin')}</Text>
                </View>
              ) : null}
            </>
          )}

          {/* ═══════════ STEP 2: Items & Review ═══════════ */}
          {step === 2 && (
            <>
              <View style={s.sectionHdr}>
                <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
                <Text style={s.sectionTitle}>{t('screens.purchaseCreateOrder.itemsServices')}</Text>
                <View style={s.itemCount}><Text style={s.itemCountTxt}>{items.length}</Text></View>
                <Text style={s.sectionSummary} numberOfLines={1}>{itemsSummary}</Text>
              </View>

              {items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  itemIndex={idx}
                  canRemove={items.length > 1}
                  warehouses={warehouses}
                  godowns={itemGodowns[item.id] || []}
                  onProductSelect={handleProductSelect}
                  onProductClear={handleProductClear}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onOpenModal={setActiveModal}
                  onBarcodePress={(itemId) => {
                    barcodePicker.set((result) => {
                      const si2 = stockItems.find(s2 => s2.name === result.productName);
                      const autoWh = warehouses.length === 1 ? warehouses[0].name : '';
                      setItems(prev => prev.map(i => {
                        if (i.id !== itemId) return i;
                        return {
                          ...i,
                          product: result.productName,
                          unit: result.unit || si2?.unit || i.unit,
                          rate: si2?.rate != null ? String(si2.rate) : i.rate,
                          warehouse: i.warehouse || autoWh,
                        };
                      }));
                    });
                    safePush(router, `/stocks/barcode-scanner?mode=pick&companyGuid=${encodeURIComponent(company?.guid || '')}` as any);
                  }}
                  onAddTaxEntry={addTaxEntry}
                  onUpdateTaxEntry={updateTaxEntry}
                  onRemoveTaxEntry={removeTaxEntry}
                  stockItems={stockItems}
                  taxLedgers={taxLedgers}
                />
              ))}

              <TouchableOpacity style={s.addItemBtn} onPress={addItem} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
                <Text style={s.addItemTxt}>{t('screens.purchaseCreateOrder.addItemService')}</Text>
              </TouchableOpacity>

              <LogisticsSection
                entries={logEntries}
                onEntriesChange={setLogEntries}
                taxLedgers={taxLedgers}
                chargeLedgers={chargeLedgers}
                roundOffLedgers={roundOffLedgers}
                roundOffLedger={roundOffLedger}
                roundOffAmount={roundOffAmount}
                onRoundOffLedgerChange={setRoundOffLedger}
                onRoundOffAmountChange={setRoundOffAmount}
              />

              {/* Running total */}
              <View style={s.runningTotalCard}>
                <Text style={s.runTotalTitle}>{t('screens.purchaseCreateOrder.runningTotal')}</Text>
                <View style={s.runTotalRow}>
                  <Text style={s.runTotalLabel}>{t('screens.purchaseCreateOrder.itemsSubtotal')}</Text>
                  <Text style={s.runTotalVal}>₹{totals.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                {totals.discTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={[s.runTotalLabel, { color: COLORS.positive }]}>{t('pdf.discount')}</Text>
                    <Text style={[s.runTotalVal, { color: COLORS.positive }]}>-₹{totals.discTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.taxTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>{t('pdf.tax')}</Text>
                    <Text style={s.runTotalVal}>₹{totals.taxTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.logisticsTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>{t('screens.purchaseCreateOrder.charges')}</Text>
                    <Text style={s.runTotalVal}>₹{totals.logisticsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.roundOff !== 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>{t('pdf.roundOff')}</Text>
                    <Text style={s.runTotalVal}>₹{totals.roundOff.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
                <View style={[s.runTotalRow, s.runTotalGrandRow]}>
                  <Text style={s.runTotalGrandLabel}>{t('pdf.grandTotal')}</Text>
                  <Text style={s.runTotalGrandVal}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* Notes & Terms */}
              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>{t('screens.purchaseCreateOrder.notesTerms')}</Text>
                </View>
                <FormField
                  label={t('voucher.narration')}
                  value={narration}
                  onChangeText={setNarration}
                  placeholder={t('screens.purchaseCreateOrder.internalNotes')}
                  multiline
                  numberOfLines={2}
                  style={{ minHeight: 60, textAlignVertical: 'top' } as any}
                />
                <FormField
                  label={t('pdf.terms')}
                  value={termsText}
                  onChangeText={setTermsText}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: 'top' } as any}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer — hide under success overlay */}
        {!showSuccess && (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 2 && (
            <View style={s.grandTotalBar}>
              <View>
                <Text style={s.grandTotalMeta}>
                  {items.filter(i => i.product).length !== 1 ? t('screens.purchaseCreateOrder.footerMetaOther', { count: items.filter(i => i.product).length, vendor: vendor || t('screens.purchaseCreateOrder.noVendor') }) : t('screens.purchaseCreateOrder.footerMetaOne', { count: items.filter(i => i.product).length, vendor: vendor || t('screens.purchaseCreateOrder.noVendor') })}
                </Text>
                <Text style={s.grandTotalLabel}>{t('pdf.grandTotal')}</Text>
              </View>
              <Text style={s.grandTotalAmt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
          <View style={s.footerBtnRow}>
            {step === 1 && (
              <TouchableOpacity style={s.fullNextBtn} onPress={goNext} activeOpacity={0.7}>
                <Text style={s.nextBtnTxt}>{t('screens.purchaseCreateOrder.nextAddItems')}</Text>
              </TouchableOpacity>
            )}
            {step === 2 && (
              <>
                <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                  <Text style={s.backOutlineTxt}>{t('screens.purchaseCreateOrder.backDetails')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} activeOpacity={0.7} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />}
                  <Text style={s.submitTxt}>{submitting ? t('voucher.submitting') : t('screens.purchaseCreateOrder.createPoButton')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        )}
      </KeyboardAvoidingView>

      {/* Modals */}
      <Modal visible={activeModal?.type === 'unit'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal}>
          <View style={m.unitMenu}>
            {unitOptions.map(u => {
              const current = activeModal ? items.find(i => i.id === activeModal.itemId)?.unit || '' : '';
              return (
                <TouchableOpacity key={u} style={[m.unitOpt, u === current && m.unitOptActive]}
                  onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'unit', u); closeModal(); }} activeOpacity={0.7}>
                  <Text style={[m.unitOptTxt, u === current && m.unitOptActiveTxt]}>{u}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      <DatePickerModal visible={showDatePicker} value={date} minDate={fyStart} onSelect={(d) => { setDate(d); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} title={t('screens.purchaseCreateOrder.orderDate')} />
      <DatePickerModal visible={showDueDatePicker} value={dueDate || date} onSelect={(d) => { setDueDate(d); setShowDueDatePicker(false); }} onClose={() => setShowDueDatePicker(false)} title={t('pdf.dueDate')} />

      {/* Success Overlay — full-screen Modal + flex backdrop (absoluteFill collapses inside Modal) */}
      <Modal
        visible={!!(showSuccess && submitResult)}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => {
          setShowSuccess(false);
          router.back();
        }}
      >
        <View style={ss.overlay}>
          <View style={ss.card}>
            <View style={ss.iconWrap}>
              <Ionicons
                name={submitResult?.isQueued ? 'time-outline' : 'checkmark-circle'}
                size={56}
                color={submitResult?.isQueued ? COLORS.warning : COLORS.positive}
              />
            </View>
            <Text style={ss.title}>{submitResult?.isQueued ? t('voucher.journalQueued') : t('screens.purchaseCreateOrder.submitted')}</Text>
            <Text style={ss.sub}>
              {submitResult?.isQueued
                ? t('screens.purchaseCreateOrder.queuedSub')
                : t('screens.purchaseCreateOrder.pushedSub')}
            </Text>
            {!!submitResult?.voucherNumber && (
              <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                <Text style={ss.refLabel}>{t('screens.purchaseCreateOrder.orderNo')}</Text>
                <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult?.voucherNumber}</Text>
              </View>
            )}
            {!!submitResult?.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>{t('screens.purchaseCreateOrder.referenceNo')}</Text>
                <Text style={ss.refVal}>{submitResult?.tdkRef}</Text>
              </View>
            )}

            {!!submitResult?.tdkRef && (
              <TouchableOpacity
                style={ss.previewBtn}
                activeOpacity={0.85}
                onPress={() => {
                  if (!submitResult?.tdkRef) return;
                  setShowSuccess(false);
                  safePush(router, `/purchase/order-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}` as any);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
                <Text style={ss.previewBtnTxt}>{t('screens.purchaseCreateOrder.preview')}</Text>
              </TouchableOpacity>
            )}

            {/* Prefers the backend snapshot; falls back to the form data when the
                order has no TDK reference (offline queue with a failed ref). */}
            <TouchableOpacity
              style={[ss.pdfBtn, sharePdfLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              disabled={sharePdfLoading}
              onPress={async () => {
                setSharePdfLoading(true);
                try {
                  const fileName = `PurchaseOrder-${submitResult?.voucherNumber || submitResult?.tdkRef || Date.now()}.pdf`;
                  const noSharing = async () => {
                    Toast.show({ type: 'info', text1: t('screens.purchaseCreateOrder.sharingUnavailable') });
                  };
                  if (submitResult?.tdkRef && company?.guid) {
                    await shareVoucherPdfByRef(submitResult?.tdkRef, company.guid, {
                      documentType: 'purchase_order',
                      fileName,
                      onBeforeShare: () => setSharePdfLoading(false),
                      fallback: noSharing,
                    });
                  } else {
                    await shareVoucherPdf(buildLocalDoc() as any, {
                      companyGuid: company?.guid,
                      fileName,
                      onBeforeShare: () => setSharePdfLoading(false),
                      fallback: noSharing,
                    });
                  }
                } catch (err: any) {
                  Toast.show({ type: 'error', text1: t('screens.purchaseCreateOrder.pdfError'), text2: err?.message || t('screens.purchaseCreateOrder.couldNotGeneratePdf') });
                } finally {
                  setSharePdfLoading(false);
                }
              }}
            >
              {sharePdfLoading
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="document-outline" size={18} color={COLORS.white} />}
              <Text style={ss.pdfBtnTxt}>{sharePdfLoading ? t('screens.purchaseCreateOrder.pdfCreating') : t('pdf.sharePdf')}</Text>
            </TouchableOpacity>

            {/* Convert to Purchase Invoice */}
            <TouchableOpacity
              style={ss.convertBtn}
              activeOpacity={0.85}
              onPress={handleConvertToInvoice}
            >
              <Ionicons name="repeat-outline" size={18} color={COLORS.white} />
              <Text style={ss.convertBtnTxt}>{t('screens.purchaseCreateOrder.convertToInvoice')}</Text>
            </TouchableOpacity>

            {/* Done */}
            <TouchableOpacity style={ss.doneBtn} activeOpacity={0.85} onPress={() => {
              setShowSuccess(false);
              setSharePdfLoading(false);
              router.back();
            }}>
              <Text style={ss.doneTxt}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  scroll: { padding: SPACING.md, paddingBottom: 8 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48, justifyContent: 'center', ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }) },
  fInputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  star: { color: COLORS.negative },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionSummary: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
  itemCount: { backgroundColor: COLORS.brandPrimary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemCountTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#fff' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.positive + '40', borderStyle: 'dashed' },
  addItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  runningTotalCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.brandPrimary + '30' },
  runTotalTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  runTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  runTotalLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  runTotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  runTotalGrandRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginBottom: 0 },
  runTotalGrandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  runTotalGrandVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.brandPrimary },
  footer: { flexDirection: 'column' as const, gap: 8, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  footerBtnRow: { flexDirection: 'row' as const, gap: 12 },
  grandTotalBar: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingHorizontal: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  grandTotalMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' as const, marginBottom: 1 },
  grandTotalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' as const, color: COLORS.textSecondary },
  grandTotalAmt: { fontSize: TYPOGRAPHY.xl, fontWeight: '800' as const, color: COLORS.brandPrimary, flexShrink: 1, marginLeft: 8, textAlign: 'right' as const },
  fullNextBtn: { flex: 1, paddingVertical: 16, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  nextBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  backOutlineBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  backOutlineTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  unitMenu: { position: 'absolute', right: 0, top: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  unitOpt: { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, width: 200, alignItems: 'center' },
  unitOptActive: { backgroundColor: COLORS.pageBg },
  unitOptTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  unitOptActiveTxt: { fontWeight: '700', color: COLORS.brandPrimary },
});

const ir = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 12 },
  rowHeaderTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  rowHeaderTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  rowHeaderAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.positive, backgroundColor: COLORS.positiveBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full },
  expandedContent: { paddingHorizontal: SPACING.sm, paddingBottom: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 8, paddingTop: SPACING.sm },
  fieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  star: { color: COLORS.negative },
  productRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  barcodeBtn: { width: 44, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.borderDefault },
  qurRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  qtyBox: { width: 72 },
  unitBox: { width: 64 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 4 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  unitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 36 },
  unitTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  discFullRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  discInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discTypeBtn: { backgroundColor: COLORS.brandPrimary + '18', borderWidth: 1, borderColor: COLORS.brandPrimary + '40', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7, minWidth: 36, alignItems: 'center' },
  discTypeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  discInput: { width: 64, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center' },
  taxableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7 },
  taxableLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  taxableVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  taxSection: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8, gap: 6 },
  taxSectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taxSectionTitle: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  taxColHint: { fontSize: 10, color: COLORS.textTertiary, fontStyle: 'italic' },
  taxEntryCard: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' as const, marginBottom: 4 },
  taxEntryTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 6, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  taxEntryBottomRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 8, paddingTop: 6 },
  taxFieldGroup: { gap: 2 },
  taxMiniLbl: { fontSize: 10, fontWeight: '600' as const, color: COLORS.textTertiary },
  taxFieldInputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 },
  taxRateInput: { width: 44, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 4, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, paddingVertical: 5, textAlign: 'right' },
  taxRateSign: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  taxAmtInput: { width: 60, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 4, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, paddingVertical: 5, textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  subtotalLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  addTaxDashedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: COLORS.brandPrimary + '70', borderRadius: RADIUS.sm, paddingVertical: 10, marginTop: 4, marginBottom: 4 },
  addTaxDashedTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  headerTrashBtn: { marginLeft: 8, padding: 4, borderRadius: RADIUS.sm },
});

const si = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: SPACING.lg, paddingVertical: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  circleActive: { borderColor: '#C9A84C', backgroundColor: '#C9A84C' },
  circleDone: { borderColor: '#1C1C1C', backgroundColor: '#1C1C1C' },
  circleNum: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' as const, color: COLORS.textTertiary },
  circleNumActive: { color: COLORS.white },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' as const, color: COLORS.textTertiary },
  labelActive: { color: '#C9A84C', fontWeight: '700' as const },
  line: { flex: 1, height: 2, backgroundColor: COLORS.borderDefault, marginBottom: 18, marginHorizontal: 6 },
  lineDone: { backgroundColor: COLORS.brandPrimary },
});

const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 24, padding: 28, width: '88%', alignItems: 'center', gap: 10 },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  refBadge: { backgroundColor: COLORS.pageBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.borderDefault },
  refLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 2 },
  refVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.brandPrimary },
  previewBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.borderStrong },
  previewBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  pdfBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  convertBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.info, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  convertBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  doneBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});
