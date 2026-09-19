import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { createStockItem, getStockGroups, getStockUnits, getWarehouses } from '../../src/services/api';
import { clearStockListCache } from '../../src/utils/stockCache';
import FormDropdown from '../../src/components/forms/FormDropdown';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import { useRequireCapability } from '../../src/components/RequireCapability';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';

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

/** Tax rate field — matches FormDropdown label + control height for side-by-side rows. */
function TaxRateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>Tax rate</Text>
      <View style={[s.taxBox, focused && s.inputFocused]}>
        <TextInput
          style={[s.taxInput, WEB]}
          placeholder="e.g. 18"
          placeholderTextColor={COLORS.textTertiary}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <View style={s.taxBadge}>
          <Text style={s.taxBadgeTxt}>%</Text>
        </View>
      </View>
    </View>
  );
}

export default function CreateStockItemScreen() {
  const allowed = useRequireCapability('stock_item.create');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const { scopeGodowns, assertCanCreate } = useRbasCreate();
  const [submitting, setSubmitting] = useState(false);
  const [groupOptions,     setGroupOptions]     = useState<{label:string;value:string}[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{label:string;value:string}[]>([]);
  const [unitOptions,      setUnitOptions]      = useState<{label:string;value:string}[]>([]);

  useEffect(() => {
    if (!company?.guid) return;
    // Load real groups from Tally
    getStockGroups(company.guid)
      .then((res: any) => setGroupOptions((res?.data || []).map((g: string) => ({ label: g, value: g }))))
      .catch(() => {});
    // Load real units from Tally
    getStockUnits(company.guid)
      .then((res: any) => setUnitOptions((res?.data || []).map((u: string) => ({ label: u, value: u }))))
      .catch(() => {});
    // Load real warehouses from Tally
    getWarehouses(company.guid)
      .then((res: any) => {
        const wh = scopeGodowns(res?.data ?? (Array.isArray(res) ? res : []));
        setWarehouseOptions(wh.map((w: any) => ({ label: w.name, value: w.name })));
      })
      .catch(() => {});
  }, [company?.guid, scopeGodowns]);

  const [group, setGroup] = useState('');
  const [productName, setProductName] = useState('');
  const [unit, setUnit] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [quantity, setQuantity] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [expiryDate, setExpiryDate] = useState(todayStr());
  const [batchNo, setBatchNo] = useState('');
  const [generateBarcode, setGenerateBarcode] = useState(false);
  const [bcItemName, setBcItemName] = useState(true);
  const [bcSku, setBcSku] = useState(false);
  const [bcSalePrice, setBcSalePrice] = useState(false);

  const handleSave = async () => {
    if (!productName.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Product name is required.' });
      return;
    }
    if (!group) {
      Toast.show({ type: 'error', text1: 'Group Required', text2: 'Select a stock group from the list.' });
      return;
    }
    if (!unit) {
      Toast.show({ type: 'error', text1: 'Unit Required', text2: 'Select a unit of measure.' });
      return;
    }
    if (!company?.guid) {
      Toast.show({ type: 'error', text1: 'No Company', text2: 'Select a company first.' });
      return;
    }
    if (!assertCanCreate('stock_item.create')) return;
    try {
      setSubmitting(true);
      const igst = parseFloat(String(taxRate).replace('%', '')) || 0;
      const itemName = productName.trim();
      const res: any = await createStockItem({
        companyGuid: company.guid,
        companyName: company.name || '',
        name: itemName,
        groupName: group,
        unit: unit || 'Nos',
        openingQty: parseFloat(quantity) || 0,
        openingRate: parseFloat(purchasePrice) || 0,
        warehouse: warehouse || '',
        salePrice: parseFloat(salePrice) || 0,
        igstRate: igst,
        cgstRate: igst / 2,
        sgstRate: igst / 2,
        hsnCode: hsnCode.trim(),
        generateBarcode: !!generateBarcode,
        barcodeLabel: generateBarcode
          ? { itemName: !!bcItemName, sku: !!bcSku, salePrice: !!bcSalePrice }
          : undefined,
      });
      clearStockListCache();

      const queued = res?.queued;
      const stockGuid = res?.stockGuid || res?.data?.stockGuid || null;
      const barcode = res?.barcode || null;

      if (generateBarcode && barcode && stockGuid) {
        Toast.show({
          type: 'success',
          text1: queued ? 'Item Queued + Barcode ✅' : 'Item + Barcode Saved ✅',
          text2: `Barcode: ${barcode}`,
        });
        // Open label preview with selected label content prefs
        setTimeout(() => {
          router.replace({
            pathname: '/stocks/label-preview',
            params: {
              ids: stockGuid,
              labelSize: '50×30 mm',
              copies: '1',
              showSku: bcSku ? '1' : '0',
              showPrice: bcSalePrice ? '1' : '0',
              showBatch: '0',
            },
          } as any);
        }, 600);
        return;
      }

      if (generateBarcode && !barcode) {
        Toast.show({
          type: 'info',
          text1: queued ? 'Item Queued ⏳' : 'Item Saved ✅',
          text2: res?.barcodeError
            ? `Barcode failed: ${res.barcodeError}`
            : 'Item saved. Generate barcode from item detail after sync.',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: queued ? 'Item Queued ⏳' : 'Item Saved ✅',
          text2: queued
            ? 'Will create in Tally when desktop connects.'
            : `"${itemName}" added to Tally.`,
        });
      }
      const queueId = res?.queueId ?? res?.data?.queueId;
      if (queueId && !(generateBarcode && barcode && stockGuid)) {
        setTimeout(() => {
          router.replace(`/masters/preview?queueId=${encodeURIComponent(String(queueId))}` as any);
        }, 800);
        return;
      }
      setTimeout(() => router.back(), 1000);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not save item.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add New Item</Text>
        <View style={{ width: 36 }} />
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
            required
            value={group}
            options={groupOptions}
            placeholder={groupOptions.length > 0 ? 'Select group' : 'Loading...'}
            onSelect={o => setGroup(o.value)}
          />

          {/* Product Name */}
          <Text style={s.label}>Product name <Text style={s.star}>*</Text></Text>
          <ThemedInput placeholder="Enter product name" value={productName} onChangeText={setProductName} />

          <Text style={s.label}>HSN</Text>
          <ThemedInput placeholder="HSN / SAC" value={hsnCode} onChangeText={setHsnCode} keyboardType="numeric" />

          {/* Unit + Tax Rate — shared field geometry so labels/controls align */}
          <View style={s.row2}>
            <View style={s.rowCol}>
              <FormDropdown
                label="Unit of measure"
                required
                value={unit}
                options={unitOptions}
                placeholder={unitOptions.length > 0 ? 'Select unit' : 'Loading...'}
                onSelect={o => setUnit(o.value)}
                containerStyle={s.rowDropdown}
              />
            </View>
            <View style={s.rowCol}>
              <TaxRateInput value={taxRate} onChange={setTaxRate} />
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

          {/* Barcode content checkboxes — map to label print prefs (SKU / Sale Price).
              Item name is always printed on labels; checkbox kept for clarity. */}
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
  row2: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  rowCol: { flex: 1, minWidth: 0 },
  // Match FormDropdown wrap + label so Unit / Tax sit on the same baseline
  rowDropdown: { marginBottom: SPACING.md },
  fieldWrap: { marginBottom: SPACING.md },
  fieldLabel: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6,
  },
  taxBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg, overflow: 'hidden', minHeight: 48,
  },
  taxInput: {
    flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 48,
  },
  taxBadge: {
    backgroundColor: COLORS.pageBg, borderLeftWidth: 1, borderLeftColor: COLORS.borderDefault,
    paddingHorizontal: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center',
  },
  taxBadgeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
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
