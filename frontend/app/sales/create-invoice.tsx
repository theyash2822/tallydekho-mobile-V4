import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal,
  LayoutAnimation, UIManager,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import SearchableDropdown from '../../src/components/forms/SearchableDropdown';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GOLD = '#A89060';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const LEDGER_ACCOUNTS = [
  { label: 'Credit Sales', value: 'credit_sales' },
  { label: 'Cash Sales', value: 'cash_sales' },
  { label: 'Export Sales', value: 'export_sales' },
  { label: 'Domestic Sales', value: 'domestic_sales' },
  { label: 'Online Sales', value: 'online_sales' },
  { label: 'Retail Sales', value: 'retail_sales' },
  { label: 'Wholesale Sales', value: 'wholesale_sales' },
];
const PARTIES = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'XYZ Retail', value: 'xyz' },
  { label: 'Sharma Electronics', value: 'sharma' },
  { label: 'Delhi Suppliers', value: 'delhi' },
  { label: 'Raj Enterprises', value: 'raj' },
];
const WAREHOUSES = [
  { label: 'Main Warehouse', value: 'main_wh' },
  { label: 'Store A', value: 'store_a' },
  { label: 'Store B', value: 'store_b' },
  { label: 'Delhi Depot', value: 'delhi_depot' },
];
const WAREHOUSE_PRODUCTS: Record<string, string[]> = {
  main_wh:     ['jbl_speaker', 'samsung_j1', 'lycan_hp', 'sony_xm5', 'jbl_wired', 'shipping', 'consulting'],
  store_a:     ['jbl_speaker', 'lycan_hp', 'consulting'],
  store_b:     ['samsung_j1', 'sony_xm5', 'shipping'],
  delhi_depot: ['jbl_wired', 'consulting', 'shipping'],
};
const ALL_PRODUCTS = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
  { label: 'Shipping & Handling', value: 'shipping' },
  { label: 'Consulting Services', value: 'consulting' },
];
const BARCODE_MAP: Record<string, string> = {
  '123456789012': 'jbl_speaker',
  '234567890123': 'samsung_j1',
  '345678901234': 'lycan_hp',
  '456789012345': 'sony_xm5',
  '567890123456': 'jbl_wired',
};
const UNITS = [
  { label: 'Pcs', value: 'pcs' },
  { label: 'Kg', value: 'kg' },
  { label: 'Ltr', value: 'ltr' },
  { label: 'Mtr', value: 'mtr' },
  { label: 'Box', value: 'box' },
  { label: 'Nos', value: 'nos' },
  { label: 'Set', value: 'set' },
  { label: 'Dz', value: 'dz' },
];
const TAX_TYPES = [
  { label: 'CGST', value: 'CGST' },
  { label: 'SGST', value: 'SGST' },
  { label: 'IGST', value: 'IGST' },
  { label: 'CESS', value: 'CESS' },
  { label: 'Add. Cess', value: 'ADD_CESS' },
  { label: 'Other', value: 'OTHER' },
];
const PAY_MODES = [
  { label: 'Cash', value: 'cash' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'NEFT', value: 'neft' },
  { label: 'Bank Transfer', value: 'bank' },
  { label: 'UPI', value: 'upi' },
];
const PAYMENT_TERMS = [
  { label: 'Due on Receipt', value: 'due_on_receipt' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: '45 Days', value: '45d' },
  { label: 'Custom', value: 'custom' },
];
const TRANSPORT_MODES = [
  { label: 'Road', value: 'road' },
  { label: 'Rail', value: 'rail' },
  { label: 'Air', value: 'air' },
  { label: 'Ship', value: 'ship' },
  { label: 'Not Applicable', value: 'na' },
];
const VEHICLE_TYPES = [
  { label: 'Regular', value: 'regular' },
  { label: 'Over Dimensional', value: 'over' },
  { label: 'Not Applicable', value: 'not' },
];
const INVOICE_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Chandigarh','Puducherry',
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaxLine {
  id: string;
  type: string;
  rate: string;
  amount: string;
}
interface InvoiceItem {
  id: string;
  warehouse: string;
  product: string;
  qty: string;
  unit: string;
  rate: string;
  discountType: '%' | 'flat';
  discount: string;
  taxes: TaxLine[];
  isExpanded: boolean;
}
interface EWayBill {
  dispatchFrom: string;
  shipTo: string;
  transportMode: string;
  transporterName: string;
  transporterId: string;
  vehicleNo: string;
  vehicleType: string;
  docNo: string;
  docDate: string;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
const newTaxLine = (type = 'CGST', rate = '9'): TaxLine => ({
  id: Date.now().toString() + Math.random(),
  type, rate, amount: '',
});
const newItem = (): InvoiceItem => ({
  id: Date.now().toString() + Math.random(),
  warehouse: '', product: '', qty: '1', unit: 'pcs',
  rate: '', discountType: '%', discount: '0',
  taxes: [],
  isExpanded: true,
});
const calcItemBase = (item: InvoiceItem) => {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gross = qty * rate;
  const disc = parseFloat(item.discount) || 0;
  const discAmt = item.discountType === '%' ? gross * disc / 100 : Math.min(disc, gross);
  const taxable = gross - discAmt;
  return { qty, rate, gross, discAmt, taxable };
};
const calcItem = (item: InvoiceItem) => {
  const base = calcItemBase(item);
  let totalTax = 0;
  item.taxes.forEach(tax => {
    const manAmt = parseFloat(tax.amount);
    if (!isNaN(manAmt) && tax.amount.trim() !== '') {
      totalTax += manAmt;
    } else {
      totalTax += base.taxable * (parseFloat(tax.rate) || 0) / 100;
    }
  });
  return { ...base, totalTax, subtotal: base.taxable + totalTax };
};
const fmtINR = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const webFix = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }) || {};

// ─── Themed Input ─────────────────────────────────────────────────────────────
function TInput({ style, ...props }: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[ti.base, focused && ti.focused, style, webFix]}
      placeholderTextColor={COLORS.textTertiary}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  );
}
const ti = StyleSheet.create({
  base: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  focused: { borderColor: GOLD, borderWidth: 1.5 },
});

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: 1|2|3 }) {
  const steps = [
    { n: 1, label: 'Invoice\nDetails' },
    { n: 2, label: 'Items &\nServices' },
    { n: 3, label: 'Review &\nSubmit' },
  ];
  return (
    <View style={si.wrap}>
      {steps.map((s, idx) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <React.Fragment key={s.n}>
            <View style={si.stepWrap}>
              <View style={[si.circle, done && si.circleDone, active && si.circleActive]}>
                {done
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <Text style={[si.num, active && si.numActive]}>{s.n}</Text>
                }
              </View>
              <Text style={[si.label, active && si.labelActive]}>{s.label}</Text>
            </View>
            {idx < 2 && (
              <View style={[si.line, current > s.n && si.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
const si = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  stepWrap: { alignItems: 'center', width: 72 },
  circle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg },
  circleDone: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  circleActive: { backgroundColor: GOLD, borderColor: GOLD },
  num: { fontSize: 13, fontWeight: '700', color: COLORS.textTertiary },
  numActive: { color: '#fff' },
  label: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 13 },
  labelActive: { color: GOLD, fontWeight: '700' },
  line: { flex: 1, height: 2, backgroundColor: COLORS.borderDefault, marginTop: 15, marginHorizontal: 2 },
  lineDone: { backgroundColor: COLORS.textPrimary },
});

// ─── Small Picker Modals ──────────────────────────────────────────────────────
function PickerSheet({ visible, title, options, value, onSelect, onClose }: {
  visible: boolean; title: string;
  options: { label: string; value: string }[];
  value: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ps.overlay} activeOpacity={1} onPress={onClose} />
      <View style={ps.sheet}>
        <View style={ps.handle} />
        <Text style={ps.title}>{title}</Text>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {options.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[ps.row, opt.value === value && ps.rowActive]}
              onPress={() => { onSelect(opt.value); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[ps.rowTxt, opt.value === value && ps.rowTxtActive]}>{opt.label}</Text>
              {opt.value === value && <Ionicons name="checkmark" size={16} color={GOLD} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
const ps = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', paddingTop: 8 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  rowActive: { backgroundColor: COLORS.pageBg },
  rowTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  rowTxtActive: { fontWeight: '700', color: GOLD },
});

// ─── Tax Line Row ─────────────────────────────────────────────────────────────
function TaxLineRow({ tax, taxable, onChangeType, onChangeRate, onChangeAmount, onRemove }: {
  tax: TaxLine; taxable: number;
  onChangeType: (v: string) => void;
  onChangeRate: (v: string) => void;
  onChangeAmount: (v: string) => void;
  onRemove: () => void;
}) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const autoAmt = (taxable * (parseFloat(tax.rate) || 0) / 100).toFixed(2);
  const displayAmt = tax.amount !== '' ? tax.amount : autoAmt;
  const typeLabel = TAX_TYPES.find(t => t.value === tax.type)?.label || tax.type;

  return (
    <View style={tlr.row}>
      {/* Type */}
      <TouchableOpacity style={tlr.typeBtn} onPress={() => setShowTypePicker(true)} activeOpacity={0.7}>
        <Text style={tlr.typeTxt}>{typeLabel}</Text>
        <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {/* Rate % */}
      <View style={tlr.rateWrap}>
        <TextInput
          style={[tlr.rateInput, webFix]}
          value={tax.rate}
          onChangeText={v => { onChangeRate(v); }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={COLORS.textTertiary}
        />
        <Text style={tlr.pct}>%</Text>
      </View>
      {/* Amount ₹ — manual editable */}
      <View style={tlr.amtWrap}>
        <Text style={tlr.rupee}>₹</Text>
        <TextInput
          style={[tlr.amtInput, webFix]}
          value={tax.amount}
          onChangeText={onChangeAmount}
          keyboardType="decimal-pad"
          placeholder={autoAmt}
          placeholderTextColor={COLORS.textTertiary}
        />
      </View>
      {/* Remove */}
      <TouchableOpacity style={tlr.removeBtn} onPress={onRemove} activeOpacity={0.7}>
        <Ionicons name="close-circle" size={18} color={COLORS.negative} />
      </TouchableOpacity>
      <PickerSheet
        visible={showTypePicker}
        title="Tax Type"
        options={TAX_TYPES}
        value={tax.type}
        onSelect={onChangeType}
        onClose={() => setShowTypePicker(false)}
      />
    </View>
  );
}
const tlr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.info + '30', minWidth: 72 },
  typeTxt: { fontSize: 11, fontWeight: '700', color: COLORS.info, flex: 1 },
  rateWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 6, paddingVertical: 4, width: 64 },
  rateInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center', paddingVertical: 2 },
  pct: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600' },
  amtWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 6, paddingVertical: 4 },
  rupee: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600', marginRight: 2 },
  amtInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right', paddingVertical: 2 },
  removeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});

// ─── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, index, onUpdate, onRemove, onToggle }: {
  item: InvoiceItem; index: number;
  onUpdate: (id: string, patch: Partial<InvoiceItem>) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [showWarehouse, setShowWarehouse] = useState(false);
  const [showProduct, setShowProduct] = useState(false);
  const [showUnit, setShowUnit] = useState(false);
  const [showBarcode, setShowBarcode] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const calc = calcItem(item);
  const warehouseLabel = WAREHOUSES.find(w => w.value === item.warehouse)?.label;
  const availableProducts = item.warehouse
    ? ALL_PRODUCTS.filter(p => (WAREHOUSE_PRODUCTS[item.warehouse] || []).includes(p.value))
    : ALL_PRODUCTS;
  const productLabel = availableProducts.find(p => p.value === item.product)?.label
    || ALL_PRODUCTS.find(p => p.value === item.product)?.label;
  const unitLabel = UNITS.find(u => u.value === item.unit)?.label || item.unit;

  const updateTax = (taxId: string, patch: Partial<TaxLine>) => {
    onUpdate(item.id, {
      taxes: item.taxes.map(t => t.id === taxId ? { ...t, ...patch } : t),
    });
  };
  const updateTaxRate = (taxId: string, rate: string) => {
    const base = calcItemBase(item);
    const autoAmt = (base.taxable * (parseFloat(rate) || 0) / 100).toFixed(2);
    onUpdate(item.id, {
      taxes: item.taxes.map(t => t.id === taxId
        ? { ...t, rate, amount: t.amount === '' ? '' : autoAmt }
        : t),
    });
  };
  const addTax = () => {
    onUpdate(item.id, { taxes: [...item.taxes, newTaxLine('OTHER', '0')] });
  };
  const removeTax = (taxId: string) => {
    onUpdate(item.id, { taxes: item.taxes.filter(t => t.id !== taxId) });
  };

  return (
    <View style={ic.card}>
      {/* ── Card Header ── */}
      <TouchableOpacity style={ic.header} onPress={() => onToggle(item.id)} activeOpacity={0.8}>
        <View style={ic.headerLeft}>
          <View style={ic.indexBadge}>
            <Text style={ic.indexTxt}>{index + 1}</Text>
          </View>
          {item.isExpanded ? (
            <Text style={ic.headerTitle}>Item {index + 1}</Text>
          ) : (
            <View style={ic.collapsedInfo}>
              <Text style={ic.collapsedName} numberOfLines={1}>
                {productLabel || 'No product selected'}
              </Text>
              <Text style={ic.collapsedSub}>
                {item.qty} {unitLabel} × {item.rate ? `₹${item.rate}` : '—'}
                {item.taxes.length > 0 && `  ·  GST ${item.taxes[0].rate}%`}
              </Text>
            </View>
          )}
        </View>
        <View style={ic.headerRight}>
          {!item.isExpanded && (
            <Text style={ic.collapsedTotal}>{fmtINR(calc.subtotal)}</Text>
          )}
          <View style={[ic.chevronWrap, item.isExpanded && ic.chevronOpen]}>
            <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Expanded Content ── */}
      {item.isExpanded && (
        <View style={ic.body}>
          {/* Product — shown first */}
          <Text style={ic.label}>Product / Service <Text style={ic.star}>*</Text></Text>
          <View style={ic.productRow}>
            <TouchableOpacity
              style={ic.productBtn}
              onPress={() => setShowProduct(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="cube-outline" size={15} color={COLORS.textSecondary} />
              <Text style={[ic.selectTxt, !productLabel && ic.selectPlaceholder]} numberOfLines={1}>
                {productLabel || 'Search or select product...'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={ic.scanBtn}
              onPress={() => setShowBarcode(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="barcode-outline" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Warehouse — mandatory second */}
          <Text style={ic.label}>Warehouse <Text style={ic.star}>*</Text></Text>
          <TouchableOpacity
            style={[ic.selectBtn, item.warehouse && ic.selectBtnFilled]}
            onPress={() => setShowWarehouse(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="business-outline" size={15} color={item.warehouse ? COLORS.info : COLORS.textTertiary} />
            <Text style={[ic.selectTxt, !warehouseLabel && ic.selectPlaceholder]} numberOfLines={1}>
              {warehouseLabel || 'Select warehouse...'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* Qty + UOM + Rate */}
          <View style={ic.row3}>
            <View style={ic.qtyWrap}>
              <Text style={ic.label}>Qty</Text>
              <TInput
                style={ic.miniInput}
                value={item.qty}
                onChangeText={v => onUpdate(item.id, { qty: v })}
                keyboardType="decimal-pad"
                placeholder="1"
              />
            </View>
            <View style={ic.uomWrap}>
              <Text style={ic.label}>UOM</Text>
              <TouchableOpacity style={ic.uomBtn} onPress={() => setShowUnit(true)} activeOpacity={0.7}>
                <Text style={ic.uomTxt}>{unitLabel}</Text>
                <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={ic.rateWrap}>
              <Text style={ic.label}>Rate (₹) <Text style={ic.star}>*</Text></Text>
              <TInput
                style={ic.rateInput}
                value={item.rate}
                onChangeText={v => onUpdate(item.id, { rate: v })}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
          </View>

          {/* Discount */}
          <Text style={ic.label}>Discount</Text>
          <View style={ic.discRow}>
            <TouchableOpacity
              style={ic.discTypeBtn}
              onPress={() => onUpdate(item.id, { discountType: item.discountType === '%' ? 'flat' : '%' })}
              activeOpacity={0.7}
            >
              <Text style={ic.discTypeTxt}>{item.discountType === '%' ? '%' : '₹'}</Text>
            </TouchableOpacity>
            <TInput
              style={ic.discInput}
              value={item.discount}
              onChangeText={v => onUpdate(item.id, { discount: v })}
              keyboardType="decimal-pad"
              placeholder="0"
            />
            {calcItemBase(item).discAmt > 0 && (
              <Text style={ic.discCalc}>= ₹{calcItemBase(item).discAmt.toFixed(2)}</Text>
            )}
          </View>

          {/* Taxable Amount */}
          <View style={ic.taxableRow}>
            <Text style={ic.taxableLabel}>Taxable Amount</Text>
            <Text style={ic.taxableVal}>{fmtINR(calcItemBase(item).taxable)}</Text>
          </View>

          {/* Taxes */}
          <View style={ic.taxHeader}>
            <Text style={ic.label}>Taxes</Text>
            <Text style={ic.taxHint}>Type · Rate % · Amount ₹</Text>
          </View>
          {item.taxes.map(tax => (
            <TaxLineRow
              key={tax.id}
              tax={tax}
              taxable={calcItemBase(item).taxable}
              onChangeType={v => updateTax(tax.id, { type: v })}
              onChangeRate={v => updateTaxRate(tax.id, v)}
              onChangeAmount={v => updateTax(tax.id, { amount: v })}
              onRemove={() => removeTax(tax.id)}
            />
          ))}
          <TouchableOpacity style={ic.addTaxBtn} onPress={addTax} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={15} color={GOLD} />
            <Text style={ic.addTaxTxt}>Add Tax</Text>
          </TouchableOpacity>

          {/* Item Total */}
          <View style={ic.totalRow}>
            <Text style={ic.totalLabel}>Item Total</Text>
            <Text style={ic.totalVal}>{fmtINR(calc.subtotal)}</Text>
          </View>

          {/* Remove Item */}
          <TouchableOpacity style={ic.removeItemBtn} onPress={() => onRemove(item.id)} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={14} color={COLORS.negative} />
            <Text style={ic.removeItemTxt}>Remove Item</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pickers */}
      <PickerSheet visible={showWarehouse} title="Select Warehouse" options={WAREHOUSES} value={item.warehouse}
        onSelect={v => { onUpdate(item.id, { warehouse: v, product: '' }); }}
        onClose={() => setShowWarehouse(false)} />
      <PickerSheet
        visible={showProduct}
        title="All Products"
        options={availableProducts}
        value={item.product}
        onSelect={v => onUpdate(item.id, { product: v })}
        onClose={() => setShowProduct(false)}
      />
      <PickerSheet visible={showUnit} title="Unit of Measure" options={UNITS} value={item.unit}
        onSelect={v => onUpdate(item.id, { unit: v })}
        onClose={() => setShowUnit(false)} />

      {/* Barcode Scanner */}
      <Modal visible={showBarcode} animationType="slide" onRequestClose={() => setShowBarcode(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.cardBg }}>
            <TouchableOpacity onPress={() => setShowBarcode(false)} style={{ marginRight: 12 }}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, flex: 1 }}>Scan Barcode</Text>
            <TouchableOpacity onPress={() => { scanned.current = false; }}>
              <Text style={{ fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: GOLD }}>Rescan</Text>
            </TouchableOpacity>
          </View>
          {!permission?.granted ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
              <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
              <Text style={{ fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, textAlign: 'center' }}>Camera permission required to scan barcodes.</Text>
              <TouchableOpacity style={{ backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: 24, paddingVertical: 14 }} onPress={requestPermission}>
                <Text style={{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' }}>Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
              onBarcodeScanned={({ data }) => {
                if (scanned.current) return;
                scanned.current = true;
                const pv = BARCODE_MAP[data];
                if (pv) {
                  onUpdate(item.id, { product: pv });
                  setShowBarcode(false);
                  Toast.show({ type: 'success', text1: 'Product Scanned', text2: ALL_PRODUCTS.find(p => p.value === pv)?.label });
                } else {
                  Alert.alert('Not Found', `No product mapped to barcode: ${data}`, [
                    { text: 'Try Again', onPress: () => { scanned.current = false; } },
                    { text: 'Close', onPress: () => setShowBarcode(false) },
                  ]);
                }
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const ic = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: 10, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, backgroundColor: COLORS.cardBg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  indexTxt: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary },
  headerTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  collapsedInfo: { flex: 1 },
  collapsedName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  collapsedSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  collapsedTotal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: GOLD },
  chevronWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.pageBg },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  body: { padding: SPACING.md, paddingTop: 0, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  star: { color: COLORS.negative },
  selectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 48 },
  selectBtnFilled: { backgroundColor: COLORS.infoBg, borderColor: COLORS.info + '40' },
  selectTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  selectPlaceholder: { color: COLORS.textTertiary, fontWeight: '400' },
  productRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  productBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 48 },
  disabledBtn: { opacity: 0.45 },
  scanBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  row3: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 },
  qtyWrap: { width: 72 },
  uomWrap: { width: 72 },
  rateWrap: { flex: 1 },
  miniInput: { minHeight: 44, paddingHorizontal: 10, textAlign: 'center' } as any,
  uomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 8, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 44 },
  uomTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  rateInput: { minHeight: 44 } as any,
  discRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discTypeBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.sm },
  discTypeTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: '#fff' },
  discInput: { flex: 1, minHeight: 44 } as any,
  discCalc: { fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600', minWidth: 64, textAlign: 'right' },
  taxableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm },
  taxableLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  taxableVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  taxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 6 },
  taxHint: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '500' },
  addTaxBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 4 },
  addTaxTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: GOLD },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 12, marginTop: 8 },
  totalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  totalVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  removeItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 6 },
  removeItemTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.negative },
});

// ─── Toggle Section Card ───────────────────────────────────────────────────────
function ToggleSectionCard({ icon, title, subtitle, iconBg, enabled, onToggle, children }: {
  icon: string; title: string; subtitle: string;
  iconBg: string; enabled: boolean;
  onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={tsc.card}>
      <TouchableOpacity style={tsc.header} onPress={() => onToggle(!enabled)} activeOpacity={0.8}>
        <View style={[tsc.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={20} color={enabled ? COLORS.textPrimary : COLORS.textTertiary} />
        </View>
        <View style={tsc.textWrap}>
          <Text style={tsc.title}>{title}</Text>
          <Text style={tsc.subtitle}>{subtitle}</Text>
        </View>
        <BrandSwitch value={enabled} onValueChange={onToggle} />
      </TouchableOpacity>
      {enabled && (
        <View style={tsc.body}>
          <View style={tsc.divider} />
          {children}
        </View>
      )}
    </View>
  );
}
const tsc = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.md },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 1 },
  body: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: SPACING.md },
});

// ─── Add Customer Drawer ──────────────────────────────────────────────────────
const GST_TYPES = ['Regular', 'Unregistered', 'Composition'];
function AddCustomerDrawer({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [openBal, setOpenBal] = useState('');
  const [isCr, setIsCr] = useState(false);
  const [creditDays, setCreditDays] = useState('');
  const [mailing, setMailing] = useState(false);
  const [bank, setBank] = useState(false);
  const [mailingName, setMailingName] = useState('');
  const [address, setAddress] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [gstType, setGstType] = useState('Regular');
  const [gstOpen, setGstOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    onSaved(name.trim());
    setName(''); setOpenBal(''); setIsCr(false); setCreditDays('');
    setMailing(false); setBank(false); setGstType('Regular'); setGstin(''); setPan('');
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        <View style={[acd.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={acd.handle} />
          <View style={acd.hdr}>
            <Text style={acd.title}>New Customer</Text>
            <Text style={acd.subtitle}>Sundry Debtors</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: SPACING.md, paddingTop: 0 }}>
            <Text style={acd.label}>Name <Text style={acd.star}>*</Text></Text>
            <TInput value={name} onChangeText={setName} placeholder="Enter customer name" />
            <Text style={acd.label}>Opening Balance</Text>
            <View style={acd.balBox}>
              <TInput style={{ flex: 1 }} value={openBal} onChangeText={setOpenBal} keyboardType="numeric" placeholder="0.00" />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 }}>
                <Text style={[acd.drCr, !isCr && acd.drCrActive]}>Dr</Text>
                <BrandSwitch value={isCr} onValueChange={setIsCr} />
                <Text style={[acd.drCr, isCr && acd.drCrActive]}>Cr</Text>
              </View>
            </View>
            <Text style={acd.label}>Credit Period (Days)</Text>
            <TInput value={creditDays} onChangeText={setCreditDays} keyboardType="numeric" placeholder="Enter credit period" />
            <View style={acd.divider} />
            <View style={acd.toggleRow}><Text style={acd.toggleLbl}>Enable Mailing Details</Text><BrandSwitch value={mailing} onValueChange={setMailing} /></View>
            {mailing && (
              <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLORS.borderDefault, marginBottom: 8 }}>
                <Text style={acd.label}>Mailing Name</Text><TInput value={mailingName} onChangeText={setMailingName} placeholder="Enter mailing name" />
                <Text style={acd.label}>Address</Text><TInput value={address} onChangeText={setAddress} placeholder="Enter address" multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' } as any} />
                <Text style={acd.label}>State</Text>
                <TouchableOpacity style={[acd.selectBox, stateOpen && acd.selectBoxOpen]} onPress={() => setStateOpen(!stateOpen)} activeOpacity={0.7}>
                  <Text style={[acd.selectTxt, !stateVal && { color: COLORS.textTertiary }]}>{stateVal || 'Select state'}</Text>
                  <Ionicons name={stateOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {stateOpen && (
                  <View style={acd.dropList}>
                    <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                      {INVOICE_STATES.map(st => (
                        <TouchableOpacity key={st} style={acd.dropItem} onPress={() => { setStateVal(st); setStateOpen(false); }}>
                          <Text style={[acd.dropTxt, stateVal === st && { fontWeight: '700', color: GOLD }]}>{st}</Text>
                          {stateVal === st && <Ionicons name="checkmark" size={14} color={GOLD} />}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Text style={acd.label}>Pincode</Text><TInput value={pincode} onChangeText={setPincode} keyboardType="numeric" placeholder="Pincode" /></View>
                  <View style={{ flex: 1 }}><Text style={acd.label}>Country</Text><TInput value={country} onChangeText={setCountry} /></View>
                </View>
              </View>
            )}
            <View style={acd.toggleRow}><Text style={acd.toggleLbl}>Provide Bank Details</Text><BrandSwitch value={bank} onValueChange={setBank} /></View>
            {bank && (
              <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: COLORS.borderDefault, marginBottom: 8 }}>
                <Text style={acd.label}>Beneficiary Name</Text><TInput value={beneficiaryName} onChangeText={setBeneficiaryName} placeholder="Enter beneficiary name" />
                <Text style={acd.label}>Bank Name</Text><TInput value={bankName} onChangeText={setBankName} placeholder="Enter bank name" />
                <Text style={acd.label}>Account Number</Text><TInput value={accountNo} onChangeText={setAccountNo} keyboardType="numeric" placeholder="Enter account number" />
                <Text style={acd.label}>IFSC Code</Text><TInput value={ifscCode} onChangeText={v => setIfscCode(v.toUpperCase())} autoCapitalize="characters" placeholder="Enter IFSC code" />
                <Text style={acd.label}>Bank Branch</Text><TInput value={bankBranch} onChangeText={setBankBranch} placeholder="Enter branch name" />
              </View>
            )}
            <View style={acd.divider} />
            <Text style={acd.label}>GST Registration Type <Text style={acd.star}>*</Text></Text>
            <TouchableOpacity style={[acd.selectBox, gstOpen && acd.selectBoxOpen]} onPress={() => setGstOpen(!gstOpen)} activeOpacity={0.7}>
              <Text style={acd.selectTxt}>{gstType}</Text>
              <Ionicons name={gstOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {gstOpen && (
              <View style={acd.dropList}>
                {GST_TYPES.map(t => (
                  <TouchableOpacity key={t} style={acd.dropItem} onPress={() => { setGstType(t); setGstOpen(false); }}>
                    <Text style={[acd.dropTxt, gstType === t && { fontWeight: '700', color: GOLD }]}>{t}</Text>
                    {gstType === t && <Ionicons name="checkmark" size={14} color={GOLD} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={acd.label}>GSTIN <Text style={acd.star}>*</Text></Text>
            <TInput value={gstin} onChangeText={v => setGstin(v.toUpperCase())} autoCapitalize="characters" placeholder="Enter GSTIN" />
            <Text style={acd.label}>PAN / IT No.</Text>
            <TInput value={pan} onChangeText={v => setPan(v.toUpperCase())} autoCapitalize="characters" placeholder="Enter PAN / IT number" />
            <View style={{ height: 8 }} />
          </ScrollView>
          <View style={{ paddingHorizontal: SPACING.md }}>
            <TouchableOpacity style={acd.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={acd.saveBtnTxt}>Save Customer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const acd = StyleSheet.create({
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginVertical: 10 },
  hdr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, gap: 6 },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, flex: 1 },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  star: { color: COLORS.negative },
  balBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  drCr: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textTertiary },
  drCrActive: { color: COLORS.textPrimary },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, marginBottom: 4 },
  toggleLbl: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 48, marginBottom: 4 },
  selectBoxOpen: { borderColor: GOLD, borderWidth: 1.5 },
  selectTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  dropList: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 4 },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  saveBtn: { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center' },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateSalesInvoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Global ──
  const [step, setStep] = useState<1|2|3>(1);
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [invoiceNo] = useState('INV-30979');

  // ── Step 1: Invoice Details ──
  const [ledger, setLedger] = useState('credit_sales');
  const [date, setDate] = useState(todayStr());
  const [party, setParty] = useState('');
  const [parties, setParties] = useState(PARTIES);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  // Payment terms collapsible
  const [payTermsOpen, setPayTermsOpen] = useState(false);
  const [payTerms, setPayTerms] = useState('due_on_receipt');
  const [showPayTermsPicker, setShowPayTermsPicker] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [refNo, setRefNo] = useState('');

  // ── Step 2: Items & Services ──
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  // ── Step 3: Payment & Review ──
  const [collectPayNow, setCollectPayNow] = useState(false);
  const [payNowMode, setPayNowMode] = useState('');
  const [showPayModePicker, setShowPayModePicker] = useState(false);
  const [payNowAmount, setPayNowAmount] = useState('');
  const [payNowRef, setPayNowRef] = useState('');
  const [eWayEnabled, setEWayEnabled] = useState(false);
  const [eWay, setEWay] = useState<EWayBill>({
    dispatchFrom: '', shipTo: '', transportMode: 'road',
    transporterName: '', transporterId: '', vehicleNo: '',
    vehicleType: 'regular', docNo: '', docDate: '',
  });
  const [narration, setNarration] = useState('');
  const [termsText, setTermsText] = useState('Goods once sold will not be taken back.');

  // ── Item helpers ──
  const updateItem = useCallback((id: string, patch: Partial<InvoiceItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);
  const toggleItem = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setItems(prev => prev.map(i => i.id === id ? { ...i, isExpanded: !i.isExpanded } : i));
  }, []);
  const addItem = useCallback(() => {
    const ni = newItem();
    setItems(prev => [...prev.map(i => ({ ...i, isExpanded: false })), ni]);
  }, []);

  // ── Totals ──
  const logisticsTotal = useMemo(() => calcLogisticsTotal(logEntries), [logEntries]);
  const totals = useMemo(() => {
    let gross = 0, discTotal = 0, taxByType: Record<string, number> = {};
    items.forEach(item => {
      const c = calcItem(item);
      gross += c.gross;
      discTotal += c.discAmt;
      const base = calcItemBase(item);
      item.taxes.forEach(tax => {
        const manAmt = parseFloat(tax.amount);
        const amt = (!isNaN(manAmt) && tax.amount.trim() !== '') ? manAmt : base.taxable * (parseFloat(tax.rate) || 0) / 100;
        taxByType[tax.type] = (taxByType[tax.type] || 0) + amt;
      });
    });
    const totalTax = Object.values(taxByType).reduce((a, b) => a + b, 0);
    const grand = gross - discTotal + totalTax + logisticsTotal;
    return { gross, discTotal, taxByType, totalTax, logisticsTotal, grand };
  }, [items, logisticsTotal]);

  const paymentStatus = useMemo(() => {
    if (!collectPayNow) return 'pending';
    const paid = parseFloat(payNowAmount) || 0;
    if (paid <= 0) return 'pending';
    if (paid >= totals.grand) return 'paid';
    return 'partial';
  }, [collectPayNow, payNowAmount, totals.grand]);

  const payTermLabel = PAYMENT_TERMS.find(t => t.value === payTerms)?.label || '';

  const handleSubmit = useCallback(() => {
    Toast.show({ type: 'success', text1: 'Invoice Submitted', text2: `Invoice ${invoiceNo} submitted successfully.` });
    setTimeout(() => router.back(), 1000);
  }, [invoiceNo, router]);

  // ── Step validation ──
  const canGoStep2 = ledger && party;
  const canGoStep3 = items.length > 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Global Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? () => router.back() : () => setStep(s2 => (s2 - 1) as 1|2|3)}
          style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Create Sales Invoice</Text>
          <Text style={s.headerSub}>{invoiceNo}</Text>
        </View>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      {/* ── Step Indicator ── */}
      <StepIndicator current={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ══════════════════════════════════════════════════════════
              STEP 1 — Invoice Details
          ══════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <View>
              {/* Sales Ledger */}
              <SearchableDropdown
                label="Sales Ledger"
                required
                placeholder="Search ledger account..."
                options={LEDGER_ACCOUNTS}
                value={ledger}
                onSelect={o => setLedger(o.value)}
                icon="book-outline"
                containerStyle={{ marginBottom: SPACING.md }}
              />

              {/* Invoice Details Card */}
              <View style={s.card}>
                <View style={s.cardHdr}>
                  <View style={s.cardIconWrap}><Ionicons name="document-text-outline" size={16} color={GOLD} /></View>
                  <Text style={s.cardTitle}>Invoice Details</Text>
                </View>

                {/* Invoice No + Date */}
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Invoice No.</Text>
                    <View style={s.lockedBox}>
                      <Text style={s.lockedTxt}>{invoiceNo}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>
                      Date {entryType === 'regular' && <Ionicons name="lock-closed-outline" size={11} color={COLORS.textTertiary} />}
                      {entryType !== 'regular' && <Text style={s.star}> *</Text>}
                    </Text>
                    {entryType === 'regular' ? (
                      <View style={s.lockedBox}>
                        <Text style={s.lockedTxt}>{date}</Text>
                        <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                      </View>
                    ) : (
                      <TInput
                        value={date}
                        onChangeText={setDate}
                        placeholder="DD/MM/YYYY"
                        keyboardType="numeric"
                      />
                    )}
                  </View>
                </View>

                {/* Customer / Party */}
                <SearchableDropdown
                  label="Customer / Party"
                  required
                  placeholder="Search customer..."
                  options={parties}
                  value={party}
                  onSelect={o => setParty(o.value)}
                  onAddNew={() => setShowAddCustomer(true)}
                  addNewLabel="+ Add New Customer"
                />
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 2 — Items & Services
          ══════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <View>
              {/* Items Header */}
              <View style={s.sectionHdr}>
                <View style={s.sectionIconWrap}><Ionicons name="cube-outline" size={15} color={GOLD} /></View>
                <Text style={s.sectionTitle}>Items & Services</Text>
                <View style={s.countBadge}>
                  <Text style={s.countTxt}>{items.length}</Text>
                </View>
              </View>

              {/* Item Cards */}
              {items.map((item, idx) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={idx}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onToggle={toggleItem}
                />
              ))}

              {/* Add Item */}
              <TouchableOpacity style={s.addItemBtn} onPress={addItem} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
                <Text style={s.addItemTxt}>Add Item / Service</Text>
              </TouchableOpacity>

              {/* Logistics — collapsible */}
              <TouchableOpacity
                style={[s.sectionToggle, { marginTop: 8 }, logOpen && s.sectionToggleOpen]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setLogOpen(v => !v);
                }}
                activeOpacity={0.8}
              >
                <View style={s.sectionToggleLeft}>
                  <View style={s.sectionIconWrap}>
                    <Ionicons name="car-outline" size={16} color={GOLD} />
                  </View>
                  <View>
                    <Text style={s.sectionToggleTitle}>Logistics & Shipping</Text>
                    <Text style={s.sectionToggleSub}>
                      {logEntries.length > 0 ? `${logEntries.length} entr${logEntries.length > 1 ? 'ies' : 'y'} · ${fmtINR(logisticsTotal)}` : 'Freight, packing, other charges'}
                    </Text>
                  </View>
                </View>
                <Ionicons name={logOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {logOpen && (
                <View style={s.logBody}>
                  <LogisticsSection
                    entries={logEntries}
                    onEntriesChange={setLogEntries}
                  />
                </View>
              )}

              {/* Running subtotal strip */}
              <View style={s.subtotalStrip}>
                <View style={s.subtotalItem}>
                  <Text style={s.subtotalLbl}>Items</Text>
                  <Text style={s.subtotalVal}>{items.length}</Text>
                </View>
                <View style={s.subtotalDivider} />
                <View style={s.subtotalItem}>
                  <Text style={s.subtotalLbl}>Subtotal</Text>
                  <Text style={s.subtotalVal}>{fmtINR(totals.gross - totals.discTotal)}</Text>
                </View>
                <View style={s.subtotalDivider} />
                <View style={s.subtotalItem}>
                  <Text style={s.subtotalLbl}>Tax</Text>
                  <Text style={s.subtotalVal}>{fmtINR(totals.totalTax)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════
              STEP 3 — Review & Submit
          ══════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <View>
              {/* Collect Payment Now */}
              <ToggleSectionCard
                icon="cash-outline"
                title="Collect Payment Now"
                subtitle="Record payment received at the time of billing"
                iconBg={collectPayNow ? COLORS.positiveBg : COLORS.pageBg}
                enabled={collectPayNow}
                onToggle={setCollectPayNow}
              >
                <Text style={s.fLabel}>Mode of Payment <Text style={s.star}>*</Text></Text>
                <TouchableOpacity style={[s.dropBtn, { marginBottom: SPACING.sm }]} onPress={() => setShowPayModePicker(true)} activeOpacity={0.7}>
                  <Text style={[s.dropBtnTxt, !payNowMode && { color: COLORS.textTertiary }]}>
                    {PAY_MODES.find(p => p.value === payNowMode)?.label || 'Select payment mode...'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Amount Received (₹)</Text>
                    <TInput value={payNowAmount} onChangeText={setPayNowAmount} keyboardType="decimal-pad" placeholder={fmtINR(totals.grand).replace('₹', '')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Reference No.</Text>
                    <TInput value={payNowRef} onChangeText={setPayNowRef} placeholder="Txn / Cheque No." />
                  </View>
                </View>
                {/* Payment status */}
                <View style={[s.payChip,
                  paymentStatus === 'paid' ? s.payChipPaid :
                  paymentStatus === 'partial' ? s.payChipPartial : s.payChipPending]}>
                  <Ionicons
                    name={paymentStatus === 'paid' ? 'checkmark-circle' : paymentStatus === 'partial' ? 'time-outline' : 'alert-circle-outline'}
                    size={15}
                    color={paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative}
                  />
                  <Text style={[s.payChipTxt, { color: paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative }]}>
                    {paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? `Partial — ₹${(totals.grand - (parseFloat(payNowAmount) || 0)).toFixed(2)} due` : 'Payment Pending'}
                  </Text>
                </View>
              </ToggleSectionCard>

              {/* Dispatch / E-Way Bill */}
              <ToggleSectionCard
                icon="car-outline"
                title="Dispatch / E-Way Bill Details"
                subtitle="Required for goods movement & E-Way Bill"
                iconBg={eWayEnabled ? COLORS.infoBg : COLORS.pageBg}
                enabled={eWayEnabled}
                onToggle={setEWayEnabled}
              >
                {/* Dispatch From + Ship To */}
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Dispatch From</Text>
                    <TInput value={eWay.dispatchFrom} onChangeText={v => setEWay(e => ({ ...e, dispatchFrom: v }))} placeholder="City / Address" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Ship To</Text>
                    <TInput value={eWay.shipTo} onChangeText={v => setEWay(e => ({ ...e, shipTo: v }))} placeholder="City / Address" />
                  </View>
                </View>

                {/* Transport Mode chips */}
                <Text style={s.fLabel}>Transport Mode</Text>
                <View style={s.chipsRow}>
                  {TRANSPORT_MODES.map(m => (
                    <TouchableOpacity
                      key={m.value}
                      style={[s.chip, eWay.transportMode === m.value && s.chipActive]}
                      onPress={() => setEWay(e => ({ ...e, transportMode: m.value }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipTxt, eWay.transportMode === m.value && s.chipTxtActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Transporter Name + ID */}
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Transporter Name</Text>
                    <TInput value={eWay.transporterName} onChangeText={v => setEWay(e => ({ ...e, transporterName: v }))} placeholder="Optional" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Transporter ID</Text>
                    <TInput value={eWay.transporterId} onChangeText={v => setEWay(e => ({ ...e, transporterId: v }))} placeholder="GSTIN / ID" autoCapitalize="characters" />
                  </View>
                </View>

                {/* Vehicle No */}
                <Text style={s.fLabel}>Vehicle Number</Text>
                <TInput value={eWay.vehicleNo} onChangeText={v => setEWay(e => ({ ...e, vehicleNo: v.toUpperCase() }))} placeholder="e.g. MH12AB1234" autoCapitalize="characters" />

                {/* Vehicle Type chips */}
                <Text style={s.fLabel}>Vehicle Type</Text>
                <View style={s.chipsRow}>
                  {VEHICLE_TYPES.map(vt => (
                    <TouchableOpacity
                      key={vt.value}
                      style={[s.chip, eWay.vehicleType === vt.value && s.chipActive]}
                      onPress={() => setEWay(e => ({ ...e, vehicleType: vt.value }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.chipTxt, eWay.vehicleType === vt.value && s.chipTxtActive]}>{vt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Doc No + Doc Date */}
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Doc / LR / RR No.</Text>
                    <TInput value={eWay.docNo} onChangeText={v => setEWay(e => ({ ...e, docNo: v }))} placeholder="Document number" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Doc Date</Text>
                    <TInput value={eWay.docDate} onChangeText={v => setEWay(e => ({ ...e, docDate: v }))} placeholder="DD/MM/YYYY" keyboardType="numeric" />
                  </View>
                </View>
              </ToggleSectionCard>

              {/* ── Payment Terms (collapsible) ── */}
              <TouchableOpacity
                style={[s.sectionToggle, payTermsOpen && s.sectionToggleOpen]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setPayTermsOpen(v => !v);
                }}
                activeOpacity={0.8}
              >
                <View style={s.sectionToggleLeft}>
                  <View style={s.sectionIconWrap}>
                    <Ionicons name="calendar-outline" size={16} color={GOLD} />
                  </View>
                  <View>
                    <Text style={s.sectionToggleTitle}>Payment Terms</Text>
                    {!payTermsOpen && (
                      <Text style={s.sectionToggleSub}>{payTermLabel}{dueDate ? `  ·  Due: ${dueDate}` : ''}</Text>
                    )}
                  </View>
                </View>
                <Ionicons name={payTermsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {payTermsOpen && (
                <View style={s.payTermsBody}>
                  <Text style={s.fLabel}>Terms</Text>
                  <TouchableOpacity style={s.dropBtn} onPress={() => setShowPayTermsPicker(true)} activeOpacity={0.7}>
                    <Text style={s.dropBtnTxt}>{payTermLabel}</Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                  {payTerms === 'custom' && (
                    <View>
                      <Text style={s.fLabel}>Custom Days <Text style={s.star}>*</Text></Text>
                      <View style={s.customDaysRow}>
                        <TInput style={{ flex: 1 }} value={customDays} onChangeText={setCustomDays} keyboardType="numeric" placeholder="Enter number of days" />
                        <View style={s.daysBadge}><Text style={s.daysBadgeTxt}>Days</Text></View>
                      </View>
                    </View>
                  )}
                  <View style={s.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fLabel}>Due Date</Text>
                      <TInput value={dueDate} onChangeText={setDueDate} placeholder="DD/MM/YYYY" keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fLabel}>Reference No.</Text>
                      <TInput value={refNo} onChangeText={setRefNo} placeholder="Optional" />
                    </View>
                  </View>
                </View>
              )}

              {/* Invoice Summary */}
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>Invoice Summary</Text>
                <View style={s.sumRow}>
                  <Text style={s.sumLbl}>Subtotal (Gross)</Text>
                  <Text style={s.sumVal}>{fmtINR(totals.gross)}</Text>
                </View>
                {totals.discTotal > 0 && (
                  <View style={s.sumRow}>
                    <Text style={s.sumLbl}>Discount</Text>
                    <Text style={[s.sumVal, { color: COLORS.positive }]}>−{fmtINR(totals.discTotal)}</Text>
                  </View>
                )}
                <View style={s.sumRow}>
                  <Text style={s.sumLbl}>Taxable Amount</Text>
                  <Text style={s.sumVal}>{fmtINR(totals.gross - totals.discTotal)}</Text>
                </View>
                {/* Each tax type */}
                {Object.entries(totals.taxByType).map(([type, amt]) => (
                  <View key={type} style={s.sumRow}>
                    <Text style={s.sumLbl}>{TAX_TYPES.find(t => t.value === type)?.label || type}</Text>
                    <Text style={s.sumVal}>{fmtINR(amt)}</Text>
                  </View>
                ))}
                {totals.logisticsTotal > 0 && (
                  <View style={s.sumRow}>
                    <Text style={s.sumLbl}>Logistics & Shipping</Text>
                    <Text style={s.sumVal}>{fmtINR(totals.logisticsTotal)}</Text>
                  </View>
                )}
                <View style={s.sumDivider} />
                <View style={s.sumRow}>
                  <Text style={s.grandLbl}>Grand Total</Text>
                  <Text style={s.grandVal}>{fmtINR(totals.grand)}</Text>
                </View>
              </View>

              {/* Notes & Terms */}
              <View style={s.card}>
                <View style={s.cardHdr}>
                  <View style={s.cardIconWrap}><Ionicons name="document-outline" size={16} color={COLORS.textSecondary} /></View>
                  <Text style={s.cardTitle}>Notes & Terms</Text>
                </View>
                <Text style={s.fLabel}>Narration</Text>
                <TInput
                  value={narration}
                  onChangeText={setNarration}
                  placeholder="Internal notes for this invoice..."
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: 'top' } as any}
                />
                <Text style={[s.fLabel, { marginTop: SPACING.sm }]}>Terms & Conditions</Text>
                <TInput
                  value={termsText}
                  onChangeText={setTermsText}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top', marginBottom: 0 } as any}
                />
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Footer Navigation ── */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 1 && (
            <TouchableOpacity
              style={[s.nextBtn, !canGoStep2 && s.nextBtnDisabled]}
              onPress={() => canGoStep2 && setStep(2)}
              activeOpacity={0.85}
            >
              <Text style={s.nextBtnTxt}>Next: Add Items</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
          {step === 2 && (
            <>
              <TouchableOpacity style={s.backNavBtn} onPress={() => setStep(1)} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={16} color={COLORS.textSecondary} />
                <Text style={s.backNavTxt}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.nextBtn, !canGoStep3 && s.nextBtnDisabled]}
                onPress={() => canGoStep3 && setStep(3)}
                activeOpacity={0.85}
              >
                <Text style={s.nextBtnTxt}>Next: Review</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          )}
          {step === 3 && (
            <>
              <TouchableOpacity style={s.backNavBtn} onPress={() => setStep(2)} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={16} color={COLORS.textSecondary} />
                <Text style={s.backNavTxt}>Items</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.submitTxt}>Submit Invoice</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Pickers ── */}
      <PickerSheet visible={showPayTermsPicker} title="Payment Terms" options={PAYMENT_TERMS} value={payTerms}
        onSelect={setPayTerms} onClose={() => setShowPayTermsPicker(false)} />
      <PickerSheet visible={showPayModePicker} title="Mode of Payment" options={PAY_MODES} value={payNowMode}
        onSelect={setPayNowMode} onClose={() => setShowPayModePicker(false)} />

      {/* ── Add Customer Drawer ── */}
      <AddCustomerDrawer
        visible={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onSaved={(name) => {
          const val = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
          setParties(prev => [...prev, { label: name, value: val }]);
          setParty(val);
          setShowAddCustomer(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 20 },
  headerSub: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600' },
  scroll: { padding: SPACING.md, paddingBottom: 16 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12, marginBottom: SPACING.sm },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  lockedBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  lockedTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  // Payment Terms section toggle
  sectionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: 0, borderWidth: 1, borderColor: COLORS.borderDefault },
  sectionToggleOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  sectionToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  sectionToggleTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionToggleSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  payTermsBody: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault },
  dropBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 48, marginBottom: SPACING.sm },
  dropBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '500', color: COLORS.textPrimary },
  customDaysRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  daysBadge: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderLeftWidth: 0, borderColor: COLORS.borderDefault, borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  daysBadgeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  // Items section
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  sectionTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  countBadge: { backgroundColor: COLORS.brandPrimary, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: '#fff' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.positive + '40', borderStyle: 'dashed' },
  addItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  logBody: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginBottom: SPACING.md, borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault },
  // Subtotal strip
  subtotalStrip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  subtotalItem: { flex: 1, alignItems: 'center' },
  subtotalLbl: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 2 },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  subtotalDivider: { width: 1, height: 28, backgroundColor: COLORS.borderDefault },
  // Payment chip
  payChip: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: RADIUS.sm, borderWidth: 1, marginTop: 10 },
  payChipPaid: { backgroundColor: COLORS.positiveBg, borderColor: COLORS.positive + '40' },
  payChipPartial: { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning + '40' },
  payChipPending: { backgroundColor: COLORS.negativeBg, borderColor: COLORS.negative + '40' },
  payChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  // Chips (transport/vehicle)
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  chipTxtActive: { color: '#fff' },
  // Summary
  summaryCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  summaryTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sumLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sumDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 10 },
  grandLbl: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  grandVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: GOLD },
  // Footer
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  backNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  backNavTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  submitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
