import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { createStockItem, getStockGroups, getWarehouses } from '../../src/services/api';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import FormDropdown from '../../src/components/forms/FormDropdown';
import BrandSwitch from '../../src/components/forms/BrandSwitch';

const UNITS = ['Pcs (Pieces)', 'Kg (Kilogram)', 'Ltr (Litre)', 'Mtr (Meter)', 'Box', 'Nos (Numbers)', 'Bag', 'Roll'];
const TAX_RATES = ['0%', '5%', '12%', '18%', '28%']; // Standard GST slabs — not mock data
const WEB = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; };

function ThemedInput({ style, onFocus: of_, onBlur: ob_, ...props }: React.ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[s.input, focused && s.inputFocused, WEB, style]}
      placeholderTextColor={COLORS.textTertiary}
      onFocus={e => { setFocused(true); of_?.(e); }}
      onBlur={e => { setFocused(false); ob_?.(e); }}
      {...props}
    />
  );
}

function InrInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.inrBox, focused && s.inputFocused]}>
      <TextInput
        style={[s.inrInput, WEB]}
        placeholder={placeholder || 'Enter price'}
        placeholderTextColor={COLORS.textTertiary}
        value={value} onChangeText={onChange}
        keyboardType="decimal-pad"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <View style={s.inrBadge}>
        <Text style={s.inrTxt}>INR</Text>
      </View>
    </View>
  );
}

export default function CreateStockItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, isPaired } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [groupOptions,     setGroupOptions]     = useState<{label:string;value:string}[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{label:string;value:string}[]>([]);

  useEffect(() => {
    if (!company?.guid) return;
    getStockGroups(company.guid)
      .then((res: any) => setGroupOptions((res?.data || []).map((g: string) => ({ label: g, value: g }))))
      .catch(() => {});
    getWarehouses(company.guid)
      .then((res: any) => {
        const wh = res?.data ?? (Array.isArray(res) ? res : []);
        setWarehouseOptions(wh.map((w: any) => ({ label: w.name, value: w.name })));
      })
      .catch(() => {});
  }, [company?.guid]);

  const [group, setGroup] = useState('');
  const [productName, setProductName] = useState('');
  const [unit, setUnit] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [quantity, setQuantity] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [expiryDate, setExpiryDate] = useState(todayStr());
  const [batchNo, setBatchNo] = useState('');
  const [generateBarcode, setGenerateBarcode] = useState(true);
  const [bcItemName, setBcItemName] = useState(true);
  const [bcSku, setBcSku] = useState(false);
  const [bcSalePrice, setBcSalePrice] = useState(false);

  const handleSave = async () => {
    if (!productName.trim()) { Alert.alert('Required', 'Product name is required.'); return; }
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' }); return; }
    try {
      setSubmitting(true);
      await createStockItem({
        company_guid: company?.guid,
        name: productName,
        group: group || undefined,
        unit: unit || undefined,
        tax_rate: parseFloat(taxRate) || 0,
        purchase_price: parseFloat(purchasePrice) || 0,
        sale_price: parseFloat(salePrice) || 0,
        opening_qty: parseFloat(quantity) || 0,
        warehouse: warehouse || undefined,
        batch_no: batchNo || undefined,
        expiry_date: expiryDate || undefined,
      });
      Toast.show({ type: 'success', text1: 'Item Saved', text2: `"${productName}" added to Tally.` });
      setTimeout(()=>router.back(),1000);
    } catch(err:any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message||'Could not save item.' });
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add New Item</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group */}
          <FormDropdown
            label="Group"
            value={group}
            options={groupOptions}
            placeholder={groupOptions.length > 0 ? 'Select group' : 'Loading...'}
            onSelect={o => setGroup(o.value)}
          />

          {/* Product Name */}
          <Text style={s.label}>Product name <Text style={s.star}>*</Text></Text>
          <ThemedInput placeholder="Enter product name" value={productName} onChangeText={setProductName} />

          {/* Unit + Tax Rate */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <FormDropdown
                label="Unit of measure"
                required
                value={unit}
                options={UNITS.map(s => ({ label: s, value: s }))}
                placeholder="Select unit"
                onSelect={o => setUnit(o.value)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FormDropdown
                label="Tax rate"
                value={taxRate}
                options={TAX_RATES.map(s => ({ label: s, value: s }))}
                placeholder="Select tax rate"
                onSelect={o => setTaxRate(o.value)}
              />
            </View>
          </View>

          {/* Purchase Price */}
          <Text style={s.label}>Purchase Price</Text>
          <InrInput value={purchasePrice} onChange={setPurchasePrice} placeholder="Enter price" />

          {/* Warehouse Placement */}
          <FormDropdown
            label="Warehouse Placement"
            value={warehouse}
            options={warehouseOptions}
            placeholder={warehouseOptions.length > 0 ? 'Select warehouse' : 'Loading...'}
            onSelect={o => setWarehouse(o.value)}
          />

          {/* Quantity + Sale Price */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Quantity</Text>
              <ThemedInput placeholder="Enter quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Default Sale Price</Text>
              <InrInput value={salePrice} onChange={setSalePrice} placeholder="Enter sale price" />
            </View>
          </View>

          {/* Expiry Date + Batch Number */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Expiry Date</Text>
              <TouchableOpacity style={s.dateBtn} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                <Text style={s.dateTxt}>{expiryDate}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Batch Number</Text>
              <ThemedInput placeholder="Enter batch number" value={batchNo} onChangeText={setBatchNo} />
            </View>
          </View>

          {/* Generate Barcode toggle */}
          <View style={s.toggleRow}>
            <Text style={s.toggleLbl}>Generate Barcode</Text>
            <BrandSwitch value={generateBarcode} onValueChange={setGenerateBarcode} />
          </View>

          {/* Barcode content checkboxes */}
          {generateBarcode && (
            <View style={s.checkRow}>
              {([
                { label: 'Item Name', val: bcItemName, set: setBcItemName },
                { label: 'SKU', val: bcSku, set: setBcSku },
                { label: 'Sale Price', val: bcSalePrice, set: setBcSalePrice },
              ] as const).map(c => (
                <TouchableOpacity
                  key={c.label}
                  style={s.checkItem}
                  onPress={() => (c.set as any)(!c.val)}
                  activeOpacity={0.7}
                >
                  <View style={[s.checkbox, c.val && s.checkboxActive]}>
                    {c.val && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                  </View>
                  <Text style={s.checkLbl}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity style={[s.saveBtn,submitting&&{opacity:0.6}]} onPress={handleSave} activeOpacity={0.85} disabled={submitting}>
            {submitting&&<ActivityIndicator size="small" color={COLORS.white} style={{marginRight:8}}/>}
            <Text style={s.saveBtnTxt}>{submitting?'Saving...':'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  form: { padding: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: 8, marginTop: 16 },
  star: { color: COLORS.negative },
  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary, backgroundColor: COLORS.cardBg,
  },
  inputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  row2: { flexDirection: 'row', gap: 12, marginTop: 4 },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: COLORS.cardBg,
  },
  selectBoxOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  selectTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  dropList: {
    borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTxtActive: { fontWeight: '700' },
  // INR input
  inrBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg, overflow: 'hidden',
  },
  inrInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingHorizontal: 14, paddingVertical: 13 },
  inrBadge: {
    backgroundColor: COLORS.pageBg, borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault,
    paddingHorizontal: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
  },
  inrTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  // Date picker
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13, backgroundColor: COLORS.cardBg,
  },
  dateTxt: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, marginTop: 8,
  },
  toggleLbl: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  // Barcode checkboxes
  checkRow: { flexDirection: 'row', gap: 16, paddingBottom: 8 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  checkLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600' },
  footer: {
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
