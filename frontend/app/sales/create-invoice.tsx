import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, TextInputProps, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import {
  getParties, createSalesInvoice, getStocks, getWarehouses,
  getSalesLedgerAccounts, getTaxLedgers, createTallyParty, lookupBarcode,
} from '../../src/services/api';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import SearchableDropdown, { SDOption } from '../../src/components/forms/SearchableDropdown';
import DatePickerModal, { formatDMY, parseDMY } from '../../src/components/forms/DatePickerModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
};

/** Convert DD/MM/YY → YYYY-MM-DD for backend */
const dmyToISO = (dmy: string): string => {
  if (!dmy) return '';
  const parts = dmy.split('/');
  if (parts.length < 3) return dmy;
  const [dd, mm, yy] = parts;
  const year = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
  return `${year}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
};

const calcItem = (item: InvoiceItem) => {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gross = qty * rate;
  const disc = parseFloat(item.discount) || 0;
  const discAmt = item.discountType === '%' ? gross * disc / 100 : Math.min(disc, gross);
  const taxable = gross - discAmt;
  const taxAmt = taxable * (parseFloat(item.taxRate) || 0) / 100;
  return { gross, discAmt, taxable, taxAmt, subtotal: taxable + taxAmt };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TERMS: DropdownOption[] = [
  { label: 'Due on Receipt', value: 'due_on_receipt' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

const PAY_MODES: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'NEFT', value: 'neft' },
  { label: 'RTGS', value: 'rtgs' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'UPI', value: 'upi' },
  { label: 'IMPS', value: 'imps' },
];

const GST_TYPES = ['Regular', 'Unregistered', 'Composition'];
const INVOICE_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
  id: number;
  name: string;
  displayName?: string;
  closing_qty?: number;
  unit?: string;
  rate?: number;
  hsn?: string;
}

interface Warehouse { id: number; name: string; guid?: string; }

interface InvoiceItem {
  id: string;
  warehouse: string;
  product: string;
  qty: string;
  unit: string;
  rate: string;
  discountType: '%' | 'flat';
  discount: string;
  taxLedger: string;     // actual ledger name from tax ledger picker
  taxRate: string;       // user-entered % for calculation
  gstType: 'cgst_sgst' | 'igst';
}

const newItem = (warehouseName = ''): InvoiceItem => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  warehouse: warehouseName, product: '', qty: '1', unit: 'pcs', rate: '',
  discountType: '%', discount: '0', taxLedger: '', taxRate: '', gstType: 'cgst_sgst',
});

type ModalState = { type: 'product'|'unit'|'warehouse'|'barcode'|'taxLedger'; itemId: string } | null;

// ─── Themed inline input ──────────────────────────────────────────────────────
function ThemedFInput({ style, onFocus, onBlur, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        s.fInput,
        focused && s.fInputFocused,
        Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }),
        style,
      ]}
      placeholderTextColor={COLORS.textTertiary}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e)  => { setFocused(false); onBlur?.(e); }}
      {...props}
    />
  );
}

// ─── Barcode Scanner Modal ─────────────────────────────────────────────────────
function BarcodeScannerModal({ visible, onScan, onClose, companyGuid }: {
  visible: boolean;
  onScan: (productName: string) => void;
  onClose: () => void;
  companyGuid?: string;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    try {
      if (companyGuid) {
        const result: any = await lookupBarcode(companyGuid, data);
        const productName = result?.data?.name || result?.name;
        if (productName) {
          onScan(productName);
        } else {
          Alert.alert('Not Found', `No product mapped to barcode: ${data}`, [
            { text: 'OK', onPress: () => { scanned.current = false; } },
          ]);
        }
      } else {
        Alert.alert('No Company', 'Please select a company first.', [
          { text: 'OK', onPress: () => { scanned.current = false; } },
        ]);
      }
    } catch {
      Alert.alert('Not Found', `No product mapped to barcode: ${data}`, [
        { text: 'OK', onPress: () => { scanned.current = false; } },
      ]);
    }
  };

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={bs.safe}>
          <View style={bs.header}>
            <TouchableOpacity onPress={onClose} style={bs.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={bs.title}>Scan Barcode</Text>
          </View>
          <View style={bs.permWrap}>
            <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
            <Text style={bs.permText}>Camera permission required to scan barcodes.</Text>
            <TouchableOpacity style={bs.permBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={bs.permBtnText}>Grant Camera Access</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={bs.safe} edges={['top']}>
        <View style={bs.header}>
          <TouchableOpacity onPress={onClose} style={bs.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={bs.title}>Scan Barcode</Text>
          <TouchableOpacity onPress={() => { scanned.current = false; }} style={bs.rescanBtn}>
            <Text style={bs.rescanText}>Rescan</Text>
          </TouchableOpacity>
        </View>
        <CameraView
          style={bs.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={bs.overlay}>
          <View style={bs.scanFrame} />
          <Text style={bs.hint}>Point camera at product barcode</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── State Dropdown (for AddCustomerDrawer) ───────────────────────────────────
function StateDropdown({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={[acd.selectBox, open && acd.selectBoxOpen]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={[acd.selectTxt, !value && { color: COLORS.textTertiary }]}>{value || 'Select state'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={acd.dropList}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {INVOICE_STATES.map((st, idx) => (
              <TouchableOpacity
                key={st}
                style={[acd.dropItem, idx === INVOICE_STATES.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(st); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[acd.dropTxt, value === st && acd.dropTxtActive]}>{st}</Text>
                {value === st && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Add Customer Bottom Drawer ───────────────────────────────────────────────
function AddCustomerDrawer({ visible, onClose, onSaved, company }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (name: string, success?: boolean) => void;
  company?: { guid?: string; name?: string } | null;
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
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [creditFocused, setCreditFocused] = useState(false);
  const [gstinFocused, setGstinFocused] = useState(false);
  const [panFocused, setPanFocused] = useState(false);
  const [balFocused, setBalFocused] = useState(false);

  const webFix = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

  const resetForm = () => {
    setName(''); setOpenBal(''); setIsCr(false); setCreditDays('');
    setMailing(false); setBank(false); setGstType('Regular');
    setGstin(''); setPan(''); setSaving(false);
    setMailingName(''); setAddress(''); setStateVal(''); setPincode('');
    setBeneficiaryName(''); setBankName(''); setAccountNo(''); setIfscCode(''); setBankBranch('');
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    setSaving(true);
    try {
      await createTallyParty({
        companyGuid: company?.guid,
        companyName: company?.name,
        partyName: name.trim(),
        openingBalance: parseFloat(openBal) || 0,
        isCr,
        gstin: gstin.trim(),
        gstType,
        creditDays: parseInt(creditDays) || 0,
        mailingName: mailingName || name.trim(),
        address,
        state: stateVal,
        pincode,
        country: country || 'India',
        bankDetails: bank ? { beneficiaryName, bankName, accountNo, ifsc: ifscCode, branch: bankBranch } : undefined,
      });
      const savedName = name.trim();
      resetForm();
      onSaved(savedName, true);
    } catch (err: any) {
      const isOffline = err?.message?.includes('offline') || err?.message?.includes('not connected') || err?.message?.includes('Desktop');
      const savedName = name.trim();
      resetForm();
      onSaved(savedName, !isOffline);
      if (isOffline) {
        Alert.alert('Queued', `"${savedName}" will be created in Tally when desktop connects.`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={acd.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={acd.kvWrap}
      >
        <View style={[acd.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={acd.handle} />
          <View style={acd.header}>
            <Text style={acd.title}>New Customer</Text>
            <Text style={acd.subtitle}>Sundry Debtors</Text>
            <TouchableOpacity onPress={onClose} style={acd.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={acd.body}
          >
            <Text style={acd.label}>Name <Text style={acd.star}>*</Text></Text>
            <TextInput
              style={[acd.input, nameFocused && acd.inputFocused, webFix]}
              placeholder="Enter customer name"
              placeholderTextColor={COLORS.textTertiary}
              value={name} onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />

            <Text style={acd.label}>Opening Balance</Text>
            <View style={[acd.balBox, balFocused && acd.inputFocused]}>
              <TextInput
                style={[acd.balInput, webFix]}
                placeholder="0.00"
                placeholderTextColor={COLORS.textTertiary}
                value={openBal} onChangeText={setOpenBal}
                keyboardType="numeric"
                onFocus={() => setBalFocused(true)}
                onBlur={() => setBalFocused(false)}
              />
              <View style={acd.drCrRow}>
                <Text style={[acd.drCrLbl, !isCr && acd.drCrLblActive]}>Dr</Text>
                <BrandSwitch value={isCr} onValueChange={setIsCr} />
                <Text style={[acd.drCrLbl, isCr && acd.drCrLblActive]}>Cr</Text>
              </View>
            </View>

            <Text style={acd.label}>Credit Period (Days)</Text>
            <TextInput
              style={[acd.input, creditFocused && acd.inputFocused, webFix]}
              placeholder="Enter credit period"
              placeholderTextColor={COLORS.textTertiary}
              value={creditDays} onChangeText={setCreditDays}
              keyboardType="numeric"
              onFocus={() => setCreditFocused(true)}
              onBlur={() => setCreditFocused(false)}
            />

            <View style={acd.divider} />

            <View style={acd.toggleRow}>
              <Text style={acd.toggleLbl}>Enable Mailing Details</Text>
              <BrandSwitch value={mailing} onValueChange={setMailing} />
            </View>
            {mailing && (
              <View style={acd.expandSection}>
                <Text style={acd.label}>Mailing Name</Text>
                <TextInput style={[acd.input, webFix]} placeholder="Enter mailing name" placeholderTextColor={COLORS.textTertiary} value={mailingName} onChangeText={setMailingName} />
                <Text style={acd.label}>Address</Text>
                <TextInput style={[acd.input, acd.textarea, webFix]} placeholder="Enter address" placeholderTextColor={COLORS.textTertiary} value={address} onChangeText={setAddress} multiline numberOfLines={3} />
                <Text style={acd.label}>State</Text>
                <StateDropdown value={stateVal} onSelect={setStateVal} />
                <View style={acd.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={acd.label}>Pincode</Text>
                    <TextInput style={[acd.input, webFix]} placeholder="Pincode" placeholderTextColor={COLORS.textTertiary} value={pincode} onChangeText={setPincode} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={acd.label}>Country</Text>
                    <TextInput style={[acd.input, webFix]} value={country} onChangeText={setCountry} placeholderTextColor={COLORS.textTertiary} />
                  </View>
                </View>
              </View>
            )}

            <View style={acd.toggleRow}>
              <Text style={acd.toggleLbl}>Provide Bank Details</Text>
              <BrandSwitch value={bank} onValueChange={setBank} />
            </View>
            {bank && (
              <View style={acd.expandSection}>
                <Text style={acd.label}>Beneficiary Name</Text>
                <TextInput style={[acd.input, webFix]} placeholder="Enter beneficiary name" placeholderTextColor={COLORS.textTertiary} value={beneficiaryName} onChangeText={setBeneficiaryName} />
                <Text style={acd.label}>Bank Name</Text>
                <TextInput style={[acd.input, webFix]} placeholder="Enter bank name" placeholderTextColor={COLORS.textTertiary} value={bankName} onChangeText={setBankName} />
                <Text style={acd.label}>Account Number</Text>
                <TextInput style={[acd.input, webFix]} placeholder="Enter account number" placeholderTextColor={COLORS.textTertiary} value={accountNo} onChangeText={setAccountNo} keyboardType="numeric" />
                <Text style={acd.label}>IFSC Code</Text>
                <TextInput style={[acd.input, webFix]} placeholder="Enter IFSC code" placeholderTextColor={COLORS.textTertiary} value={ifscCode} onChangeText={v => setIfscCode(v.toUpperCase())} autoCapitalize="characters" />
                <Text style={acd.label}>Bank Branch</Text>
                <TextInput style={[acd.input, webFix]} placeholder="Enter branch name" placeholderTextColor={COLORS.textTertiary} value={bankBranch} onChangeText={setBankBranch} />
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
                {GST_TYPES.map((t, idx) => (
                  <TouchableOpacity key={t} style={[acd.dropItem, idx === GST_TYPES.length - 1 && { borderBottomWidth: 0 }]} onPress={() => { setGstType(t); setGstOpen(false); }} activeOpacity={0.7}>
                    <Text style={[acd.dropTxt, gstType === t && acd.dropTxtActive]}>{t}</Text>
                    {gstType === t && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={acd.label}>GSTIN <Text style={acd.star}>*</Text></Text>
            <TextInput style={[acd.input, gstinFocused && acd.inputFocused, webFix]} placeholder="Enter GSTIN" placeholderTextColor={COLORS.textTertiary} value={gstin} onChangeText={v => setGstin(v.toUpperCase())} autoCapitalize="characters" onFocus={() => setGstinFocused(true)} onBlur={() => setGstinFocused(false)} />

            <Text style={acd.label}>PAN/IT No.</Text>
            <TextInput style={[acd.input, panFocused && acd.inputFocused, webFix]} placeholder="Enter PAN/IT number" placeholderTextColor={COLORS.textTertiary} value={pan} onChangeText={v => setPan(v.toUpperCase())} autoCapitalize="characters" onFocus={() => setPanFocused(true)} onBlur={() => setPanFocused(false)} />

            <View style={{ height: 8 }} />
          </ScrollView>

          <TouchableOpacity
            style={[acd.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />}
            <Text style={acd.saveBtnTxt}>{saving ? 'Saving...' : 'Save Customer'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────
function ItemRow({ item, onUpdate, onRemove, onOpenModal, hasMultipleWarehouses, stockItems, taxLedgers, warehouses }: {
  item: InvoiceItem;
  onUpdate: (id: string, field: keyof InvoiceItem, val: string) => void;
  onRemove: (id: string) => void;
  onOpenModal: (s: ModalState) => void;
  hasMultipleWarehouses: boolean;
  stockItems: StockItem[];
  taxLedgers: { name: string }[];
  warehouses: Warehouse[];
}) {
  const calc = calcItem(item);
  const stockItem = stockItems.find(si => si.name === item.product);
  const productLabel = stockItem
    ? (stockItem.displayName || stockItem.name)
    : (item.product || '');

  return (
    <View style={ir.card}>
      {/* Warehouse selector — only if multiple warehouses */}
      {hasMultipleWarehouses && (
        <TouchableOpacity
          style={[ir.warehouseBtn, item.warehouse && ir.warehouseBtnActive]}
          onPress={() => onOpenModal({ type: 'warehouse', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="business-outline" size={13} color={item.warehouse ? COLORS.info : COLORS.textTertiary} />
          <Text style={[ir.warehouseTxt, !item.warehouse && ir.placeholderTxt]}>
            {item.warehouse || 'Select Warehouse first...'}
          </Text>
          <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Product + Barcode + Delete */}
      <View style={ir.topRow}>
        <TouchableOpacity
          style={ir.productBtn}
          onPress={() => onOpenModal({ type: 'product', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
          <Text style={[ir.productTxt, !item.product && ir.placeholderTxt]} numberOfLines={1}>
            {productLabel || 'Select product...'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={ir.barcodeBtn}
          onPress={() => onOpenModal({ type: 'barcode', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="barcode-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.delBtn} onPress={() => onRemove(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.negative} />
        </TouchableOpacity>
      </View>

      {/* Qty + Unit + Rate */}
      <View style={ir.fieldRow}>
        <View style={ir.qtyBox}>
          <Text style={ir.miniLabel}>Qty</Text>
          <TextInput
            style={ir.miniInput}
            value={item.qty}
            onChangeText={v => onUpdate(item.id, 'qty', v)}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
        <TouchableOpacity style={ir.unitBtn} onPress={() => onOpenModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
          <Text style={ir.unitTxt}>{item.unit || 'pcs'}</Text>
          <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={ir.rateBox}>
          <Text style={ir.miniLabel}>Rate (₹)</Text>
          <TextInput
            style={ir.miniInput}
            value={item.rate}
            onChangeText={v => onUpdate(item.id, 'rate', v)}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
      </View>

      {/* Discount + Tax Ledger Picker */}
      <View style={ir.fieldRow}>
        <View style={ir.discRow}>
          <TouchableOpacity
            style={ir.discTypeBtn}
            onPress={() => onUpdate(item.id, 'discountType', item.discountType === '%' ? 'flat' : '%')}
            activeOpacity={0.7}
          >
            <Text style={ir.discTypeTxt}>{item.discountType}</Text>
          </TouchableOpacity>
          <TextInput
            style={ir.discInput}
            value={item.discount}
            onChangeText={v => onUpdate(item.id, 'discount', v)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={COLORS.textTertiary}
          />
          <Text style={ir.discLabel}>Disc</Text>
        </View>
        <TouchableOpacity
          style={[ir.taxBtn, item.taxLedger ? { backgroundColor: COLORS.infoBg } : {}]}
          onPress={() => onOpenModal({ type: 'taxLedger', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="receipt-outline" size={12} color={COLORS.info} />
          <Text style={ir.taxTxt} numberOfLines={1}>
            {item.taxLedger ? item.taxLedger.slice(0, 14) : 'Tax Ledger'}
          </Text>
          <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tax Rate % + GST Type chips — shown only if taxLedger selected */}
      {!!item.taxLedger && (
        <View style={ir.fieldRow}>
          <View style={ir.qtyBox}>
            <Text style={ir.miniLabel}>Tax %</Text>
            <TextInput
              style={ir.miniInput}
              value={item.taxRate}
              onChangeText={v => onUpdate(item.id, 'taxRate', v)}
              keyboardType="numeric"
              placeholder="18"
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>
          <TouchableOpacity
            style={[ir.discTypeBtn, { flex: 1, marginLeft: 8 }, item.gstType === 'cgst_sgst' && { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary }]}
            onPress={() => onUpdate(item.id, 'gstType', 'cgst_sgst')}
            activeOpacity={0.7}
          >
            <Text style={[ir.discTypeTxt, item.gstType === 'cgst_sgst' && { color: COLORS.white }]}>CGST+SGST</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ir.discTypeBtn, { flex: 1, marginLeft: 4 }, item.gstType === 'igst' && { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary }]}
            onPress={() => onUpdate(item.id, 'gstType', 'igst')}
            activeOpacity={0.7}
          >
            <Text style={[ir.discTypeTxt, item.gstType === 'igst' && { color: COLORS.white }]}>IGST</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Item Total */}
      <View style={ir.subtotalRow}>
        <Text style={ir.subtotalLabel}>Item Total</Text>
        <Text style={ir.subtotalVal}>
          ₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateSalesInvoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();

  // FY date bounds
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  // ── State ──────────────────────────────────────────────────
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [ledger, setLedger] = useState('');
  const [invoiceNo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [party, setParty] = useState('');
  const [parties, setParties] = useState<DropdownOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Real API data
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [salesLedgers, setSalesLedgers] = useState<{ name: string; guid?: string }[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<{ name: string }[]>([]);

  const hasMultipleWarehouses = warehouses.length > 1;

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [payTerms, setPayTerms] = useState('due_on_receipt');
  const [customDays, setCustomDays] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [refNo, setRefNo] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logTaxRate, setLogTaxRate] = useState('0');
  const [narration, setNarration] = useState('');
  const [termsText, setTermsText] = useState('Goods once sold will not be taken back.');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  // Dispatch / E-Way Bill Details
  const [showDispatch, setShowDispatch]         = useState(false);
  const [dispatchFrom, setDispatchFrom]         = useState('');
  const [shipTo, setShipTo]                     = useState('');
  const [transporterName, setTransporterName]   = useState('');
  const [transporterId, setTransporterId]       = useState('');
  const [transportMode, setTransportMode]       = useState('Road');
  const [vehicleNumber, setVehicleNumber]       = useState('');
  const [vehicleType, setVehicleType]           = useState('Regular');
  const [transportDocNo, setTransportDocNo]     = useState('');

  // Collect Payment Now
  const [collectPayNow, setCollectPayNow] = useState(false);
  const [payNowMode, setPayNowMode] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [payNowRef, setPayNowRef] = useState('');

  // Success overlay
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ tdkRef: string; isQueued: boolean; message: string } | null>(null);

  // ── Data Loading Effects ────────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    getParties(company.guid).then((res: any) => {
      const list = res?.data || [];
      if (list.length > 0) {
        setParties(list.map((p: any) => ({ label: p.name, value: p.name })));
      }
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getStocks(company.guid).then((res: any) => {
      const list = res?.data?.items || res?.items || res?.data || [];
      setStockItems(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getWarehouses(company.guid).then((res: any) => {
      const list: Warehouse[] = res?.data || res?.warehouses || [];
      setWarehouses(list);
      if (list.length === 1) {
        setItems(prev => prev.map(i => ({ ...i, warehouse: list[0].name })));
      }
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getSalesLedgerAccounts(company.guid).then((res: any) => {
      const list = res?.data || [];
      setSalesLedgers(list);
      if (list.length > 0 && !ledger) setLedger(list[0].name);
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getTaxLedgers(company.guid).then((res: any) => {
      setTaxLedgers(res?.data || []);
    }).catch(() => {});
  }, [company?.guid]);

  // Due date auto-fill
  useEffect(() => {
    const days = payTerms === '15d' ? 15 : payTerms === '30d' ? 30 :
                 payTerms === 'due_on_receipt' ? 0 :
                 payTerms === 'custom' ? (parseInt(customDays) || 0) : 0;
    if (days > 0 && date) {
      const parsed = parseDMY(date);
      if (parsed) {
        const due = new Date(parsed);
        due.setDate(due.getDate() + days);
        setDueDate(formatDMY(due));
      }
    } else if (payTerms === 'due_on_receipt') {
      setDueDate(date);
    }
  }, [payTerms, date, customDays]);

  // ── Item Actions ────────────────────────────────────────────
  const updateItem = useCallback((id: string, field: keyof InvoiceItem, val: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val as any } : i));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);

  const addItem = useCallback(() => {
    const autoWarehouse = warehouses.length === 1 ? warehouses[0].name : '';
    setItems(prev => [...prev, newItem(autoWarehouse)]);
  }, [warehouses]);

  const closeModal = useCallback(() => setActiveModal(null), []);

  // ── Computed ────────────────────────────────────────────────
  const logisticsTotal = useMemo(() => calcLogisticsTotal(logEntries, logTaxRate), [logEntries, logTaxRate]);

  const totals = useMemo(() => {
    let gross = 0, discTotal = 0, cgst = 0, sgst = 0, igst = 0;
    items.forEach(item => {
      const c = calcItem(item);
      gross += c.gross;
      discTotal += c.discAmt;
      if (item.gstType === 'igst') {
        igst += c.taxAmt;
      } else {
        cgst += c.taxAmt / 2;
        sgst += c.taxAmt / 2;
      }
    });
    const grand = gross - discTotal + cgst + sgst + igst + logisticsTotal;
    return { gross, discTotal, cgst, sgst, igst, taxTotal: cgst + sgst + igst, logisticsTotal, grand };
  }, [items, logisticsTotal]);

  const paymentStatus = useMemo(() => {
    if (!collectPayNow) return 'pending';
    const paidAmt = parseFloat(payNowAmount) || 0;
    if (paidAmt <= 0) return 'pending';
    if (paidAmt >= totals.grand) return 'paid';
    return 'partial';
  }, [collectPayNow, payNowAmount, totals.grand]);

  // Derive unit options from real stock items
  const unitOptions = useMemo(() => {
    const units = [...new Set(stockItems.map(i => i.unit).filter(Boolean))] as string[];
    return units.length > 0 ? units : ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
  }, [stockItems]);

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async (isDraft = false) => {
    if (!party) {
      Toast.show({ type: 'error', text1: 'Customer required' });
      return;
    }
    if (items.some(i => !i.product)) {
      Toast.show({ type: 'error', text1: 'All items need a product selected' });
      return;
    }
    if (hasMultipleWarehouses && items.some(i => !i.warehouse)) {
      Toast.show({ type: 'error', text1: 'Warehouse required for all items' });
      return;
    }

    setSubmitting(true);
    try {
      const result: any = await createSalesInvoice({
        companyGuid: company?.guid,
        companyName: company?.name,
        partyLedger: party,
        date: dmyToISO(date),
        salesLedger: ledger,
        isOptional: entryType === 'optional',
        original_entry_type: entryType,
        voucherType: 'Sales',
        totalAmount: totals.grand,
        reference: refNo || undefined,
        narration: narration || undefined,
        items: items.map(item => ({
          itemName: item.product,
          billedQty: parseFloat(item.qty) || 0,
          actualQty: parseFloat(item.qty) || 0,
          rate: parseFloat(item.rate) || 0,
          amount: calcItem(item).taxable,
          salesLedger: ledger,
          godown: item.warehouse || warehouses[0]?.name || 'Main Location',
        })),
        taxes: items
          .filter(i => i.taxLedger && parseFloat(i.taxRate) > 0)
          .map(item => {
            const c = calcItem(item);
            if (item.gstType === 'igst') {
              return [{ ledgerName: item.taxLedger, taxRate: parseFloat(item.taxRate), taxAmount: c.taxAmt, taxableValue: c.taxable }];
            } else {
              const halfTax = c.taxAmt / 2;
              const halfRate = parseFloat(item.taxRate) / 2;
              return [
                { ledgerName: `CGST @${halfRate}%`, taxRate: halfRate, taxAmount: halfTax, taxableValue: c.taxable },
                { ledgerName: `SGST @${halfRate}%`, taxRate: halfRate, taxAmount: halfTax, taxableValue: c.taxable },
              ];
            }
          })
          .flat(),
        collect_payment: collectPayNow ? {
          mode: payNowMode,
          amount: parseFloat(payNowAmount) || 0,
          reference: payNowRef || undefined,
        } : undefined,
        dispatch_details: showDispatch ? {
          dispatch_from:    dispatchFrom,
          ship_to:          shipTo,
          transport_mode:   transportMode,
          transporter_name: transporterName || undefined,
          transporter_id:   transporterId || undefined,
          vehicle_number:   vehicleNumber || undefined,
          vehicle_type:     vehicleType,
          transport_doc_no: transportDocNo || undefined,
        } : undefined,
        is_draft: isDraft,
      });

      const tdkRef = result?.data?.tdkReferenceNo || result?.tdkReferenceNo || '';
      const isQueued = result?.queued === true;
      setSubmitResult({ tdkRef, isQueued, message: result?.message || '' });
      setShowSuccess(true);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: err?.message || 'Check Tally connection.' });
    } finally {
      setSubmitting(false);
    }
  }, [party, items, hasMultipleWarehouses, company, date, ledger, entryType, totals.grand, refNo, narration, warehouses, collectPayNow, payNowMode, payNowAmount, payNowRef, showDispatch, dispatchFrom, shipTo, transportMode, transporterName, transporterId, vehicleNumber, vehicleType, transportDocNo]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Success Overlay */}
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
              {submitResult.isQueued ? 'Saved. Pending Sync' : 'Invoice Submitted!'}
            </Text>
            <Text style={ss.sub}>
              {submitResult.isQueued
                ? 'Your entry is queued. Will push to Tally when desktop reconnects.'
                : 'Invoice pushed to Tally successfully.'}
            </Text>
            {!!submitResult.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>Reference No.</Text>
                <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
              </View>
            )}
            <TouchableOpacity style={ss.pdfBtn} activeOpacity={0.85} onPress={() => {
              Toast.show({ type: 'info', text1: 'PDF sharing coming soon' });
            }}>
              <Ionicons name="document-outline" size={18} color={COLORS.white} />
              <Text style={ss.pdfBtnTxt}>Share PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.waBtn} activeOpacity={0.85} onPress={() => {
              Toast.show({ type: 'info', text1: 'WhatsApp sharing coming soon' });
            }}>
              <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
              <Text style={ss.waBtnTxt}>Share on WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ss.doneBtn} activeOpacity={0.85} onPress={() => {
              setShowSuccess(false);
              router.back();
            }}>
              <Text style={ss.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Sales Invoice</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.invNoBadge}>
          <Text style={s.invNoTxt}>{invoiceNo || 'Auto'}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sales Ledger */}
          <SearchableDropdown
            label="Sales Ledger"
            required
            placeholder="Search ledger account..."
            options={salesLedgers.map(l => ({ label: l.name, value: l.name }))}
            value={ledger}
            onSelect={(o: any) => setLedger(o.value)}
            icon="book-outline"
            containerStyle={{ marginBottom: SPACING.md }}
          />

          {/* Invoice Details Card */}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={s.cardTitle}>Invoice Details</Text>
            </View>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Invoice No.</Text>
                <View style={s.autoBox}>
                  <Text style={s.autoTxt}>{invoiceNo || 'Auto'}</Text>
                  <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                {entryType === 'regular' ? (
                  <View style={[s.autoBox, { opacity: 0.55 }]}>
                    <Text style={s.autoTxt}>{date}</Text>
                    <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                  </View>
                ) : (
                  <TouchableOpacity style={s.fInput} onPress={() => setShowDatePicker(true)}>
                    <Text style={{ color: date ? COLORS.textPrimary : COLORS.textTertiary }}>
                      {date || 'Select date'}
                    </Text>
                  </TouchableOpacity>
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
              onSelect={(o: any) => setParty(o.value)}
              onAddNew={() => setShowAddCustomer(true)}
              addNewLabel="Add New Customer"
            />

            {/* Payment Terms */}
            <View style={{ marginBottom: SPACING.md }}>
              <Text style={s.fLabel}>Payment Terms</Text>
              <View style={s.termsRow}>
                {TERMS.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.termChip, payTerms === t.value && s.termChipActive]}
                    onPress={() => setPayTerms(t.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.termChipTxt, payTerms === t.value && s.termChipTxtActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {payTerms === 'custom' && (
                <View style={s.customDaysRow}>
                  <ThemedFInput
                    style={{ flex: 1 }}
                    value={customDays}
                    onChangeText={setCustomDays}
                    keyboardType="numeric"
                    placeholder="Enter number of days"
                  />
                  <View style={s.daysBadge}>
                    <Text style={s.daysBadgeTxt}>Days</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Due Date</Text>
                <ThemedFInput value={dueDate} onChangeText={setDueDate} placeholder="DD/MM/YY" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Reference No.</Text>
                <ThemedFInput value={refNo} onChangeText={setRefNo} placeholder="Optional" />
              </View>
            </View>
          </View>

          {/* Items Section */}
          <View style={s.sectionHdr}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
            <Text style={s.sectionTitle}>Items & Services</Text>
            <View style={s.itemCount}>
              <Text style={s.itemCountTxt}>{items.length}</Text>
            </View>
          </View>

          {items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdate={updateItem}
              onRemove={removeItem}
              onOpenModal={setActiveModal}
              hasMultipleWarehouses={hasMultipleWarehouses}
              stockItems={stockItems}
              taxLedgers={taxLedgers}
              warehouses={warehouses}
            />
          ))}

          <TouchableOpacity style={s.addItemBtn} onPress={addItem} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addItemTxt}>Add Item / Service</Text>
          </TouchableOpacity>

          {/* Logistics Section */}
          <LogisticsSection
            entries={logEntries}
            taxRate={logTaxRate}
            onEntriesChange={setLogEntries}
            onTaxRateChange={setLogTaxRate}
          />

          {/* Collect Payment Now */}
          <View style={s.card}>
            <TouchableOpacity
              style={s.payNowToggleRow}
              onPress={() => setCollectPayNow(v => !v)}
              activeOpacity={0.8}
            >
              <View style={s.payNowLeft}>
                <View style={[s.payNowIcon, { backgroundColor: collectPayNow ? COLORS.positiveBg : COLORS.pageBg }]}>
                  <Ionicons name="cash-outline" size={18} color={collectPayNow ? COLORS.positive : COLORS.textSecondary} />
                </View>
                <View>
                  <Text style={s.payNowTitle}>Collect Payment Now</Text>
                  <Text style={s.payNowSub}>Record payment received at the time of billing</Text>
                </View>
              </View>
              <BrandSwitch value={collectPayNow} onValueChange={setCollectPayNow} />
            </TouchableOpacity>

            {collectPayNow && (
              <View style={s.payNowBody}>
                <View style={s.divider} />
                <FormDropdown
                  label="Mode of Payment"
                  value={payNowMode}
                  options={PAY_MODES}
                  onSelect={(o: any) => setPayNowMode(o.value)}
                  placeholder="Select payment mode..."
                  required
                />
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Amount Received (₹)</Text>
                    <TextInput
                      style={s.fInput}
                      value={payNowAmount}
                      onChangeText={setPayNowAmount}
                      keyboardType="numeric"
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textTertiary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Reference No.</Text>
                    <TextInput
                      style={s.fInput}
                      value={payNowRef}
                      onChangeText={setPayNowRef}
                      placeholder="Txn / Cheque No."
                      placeholderTextColor={COLORS.textTertiary}
                    />
                  </View>
                </View>
                <View style={[
                  s.payStatusChip,
                  paymentStatus === 'paid' ? s.payStatusPaid :
                  paymentStatus === 'partial' ? s.payStatusPartial : s.payStatusPending
                ]}>
                  <Ionicons
                    name={paymentStatus === 'paid' ? 'checkmark-circle' : paymentStatus === 'partial' ? 'time-outline' : 'alert-circle-outline'}
                    size={16}
                    color={paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative}
                  />
                  <Text style={[
                    s.payStatusTxt,
                    { color: paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative }
                  ]}>
                    {paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? 'Partially Paid' : 'Payment Pending'}
                  </Text>
                  {paymentStatus === 'partial' && totals.grand > 0 && (
                    <Text style={[s.payStatusSub, { color: COLORS.warning }]}>
                      {' '}(₹{(totals.grand - (parseFloat(payNowAmount) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })} due)
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Dispatch / E-Way Bill Details */}
          <View style={s.card}>
            <TouchableOpacity style={s.payNowToggleRow} onPress={() => setShowDispatch(v => !v)} activeOpacity={0.8}>
              <View style={s.payNowLeft}>
                <View style={[s.payNowIcon, { backgroundColor: showDispatch ? '#EFF6FF' : COLORS.pageBg }]}>
                  <Ionicons name="car-outline" size={18} color={showDispatch ? COLORS.info : COLORS.textSecondary} />
                </View>
                <View>
                  <Text style={s.payNowTitle}>Dispatch / E-Way Bill Details</Text>
                  <Text style={s.payNowSub}>Required for goods movement & E-Way Bill</Text>
                </View>
              </View>
              <BrandSwitch value={showDispatch} onValueChange={setShowDispatch} />
            </TouchableOpacity>

            {showDispatch && (
              <View style={s.payNowBody}>
                <View style={s.divider} />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Dispatch From</Text>
                    <ThemedFInput value={dispatchFrom} onChangeText={setDispatchFrom} placeholder="City / Address" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Ship To</Text>
                    <ThemedFInput value={shipTo} onChangeText={setShipTo} placeholder="City / Address" />
                  </View>
                </View>

                <Text style={s.fLabel}>Transport Mode</Text>
                <View style={s.termsRow}>
                  {['Road','Rail','Air','Ship','Not Applicable'].map(mode => (
                    <TouchableOpacity key={mode}
                      style={[s.termChip, transportMode === mode && s.termChipActive]}
                      onPress={() => setTransportMode(mode)} activeOpacity={0.7}>
                      <Text style={[s.termChipTxt, transportMode === mode && s.termChipTxtActive]}>{mode}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Transporter Name</Text>
                    <ThemedFInput value={transporterName} onChangeText={setTransporterName} placeholder="Optional" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Transporter ID</Text>
                    <ThemedFInput value={transporterId} onChangeText={setTransporterId} placeholder="GSTIN / ID" />
                  </View>
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Vehicle Number</Text>
                    <ThemedFInput value={vehicleNumber} onChangeText={v => setVehicleNumber(v.toUpperCase())} placeholder="e.g. MH12AB1234" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Vehicle Type</Text>
                    <View style={s.termsRow}>
                      {['Regular','Over Dimensional','Not Applicable'].map(vt => (
                        <TouchableOpacity key={vt}
                          style={[s.termChip, vehicleType === vt && s.termChipActive]}
                          onPress={() => setVehicleType(vt)} activeOpacity={0.7}>
                          <Text style={[s.termChipTxt, vehicleType === vt && s.termChipTxtActive]}>{vt.split(' ')[0]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Doc / LR / RR No.</Text>
                    <ThemedFInput value={transportDocNo} onChangeText={setTransportDocNo} placeholder="Optional" />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Invoice Summary */}
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Invoice Summary</Text>
            <View style={s.summaryRow}>
              <Text style={s.sumLabel}>Subtotal</Text>
              <Text style={s.sumVal}>₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
            {totals.discTotal > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.sumLabel}>Discount</Text>
                <Text style={[s.sumVal, { color: COLORS.positive }]}>-₹{totals.discTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {totals.cgst > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.sumLabel}>CGST</Text>
                <Text style={s.sumVal}>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {totals.sgst > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.sumLabel}>SGST</Text>
                <Text style={s.sumVal}>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {totals.igst > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.sumLabel}>IGST</Text>
                <Text style={s.sumVal}>₹{totals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {totals.logisticsTotal > 0 && (
              <View style={s.summaryRow}>
                <Text style={s.sumLabel}>Logistics</Text>
                <Text style={s.sumVal}>₹{totals.logisticsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            <View style={s.sumDivider} />
            <View style={s.summaryRow}>
              <Text style={s.grandLabel}>Grand Total</Text>
              <Text style={s.grandVal}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Notes & Terms */}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
              <Text style={s.cardTitle}>Notes & Terms</Text>
            </View>
            <FormField
              label="Narration"
              value={narration} onChangeText={setNarration}
              placeholder="Internal notes..."
              multiline numberOfLines={2}
              style={{ minHeight: 60, textAlignVertical: 'top' } as any}
            />
            <FormField
              label="Terms & Conditions"
              value={termsText} onChangeText={setTermsText}
              multiline numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' } as any}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={[s.draftBtn, submitting && { opacity: 0.5 }]} onPress={() => handleSubmit(true)} activeOpacity={0.7} disabled={submitting}>
            <Text style={s.draftTxt}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={() => handleSubmit(false)} activeOpacity={0.7} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />}
            <Text style={s.submitTxt}>{submitting ? 'Submitting...' : 'Submit Invoice'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Modals ── */}

      {/* Product Modal */}
      <Modal visible={activeModal?.type === 'product'} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Product / Service</Text>
          {(() => {
            const currentItem = items.find(i => i.id === activeModal?.itemId);
            const currentProduct = currentItem?.product || '';
            return (
              <ScrollView showsVerticalScrollIndicator={false}>
                {stockItems.length === 0 && (
                  <View style={mAdd.warehouseHint}>
                    <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                    <Text style={mAdd.warehouseHintTxt}>Loading products...</Text>
                  </View>
                )}
                {stockItems.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[m.opt, p.name === currentProduct && m.optActive]}
                    onPress={() => {
                      if (activeModal) {
                        setItems(prev => prev.map(i => {
                          if (i.id !== activeModal.itemId) return i;
                          return {
                            ...i,
                            product: p.name,
                            unit: p.unit || i.unit,
                            rate: p.rate != null ? String(p.rate) : i.rate,
                          };
                        }));
                      }
                      closeModal();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={m.optLeft}>
                      <Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={[m.optTxt, p.name === currentProduct && m.optActiveTxt]}>
                        {`${p.displayName || p.name} (${p.closing_qty ?? 0} ${p.unit || 'pcs'})`}
                      </Text>
                    </View>
                    {p.name === currentProduct && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* Unit Modal */}
      <Modal visible={activeModal?.type === 'unit'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal}>
          <View style={m.unitMenu}>
            {unitOptions.map(u => {
              const current = activeModal ? items.find(i => i.id === activeModal.itemId)?.unit || '' : '';
              return (
                <TouchableOpacity
                  key={u}
                  style={[m.unitOpt, u === current && m.unitOptActive]}
                  onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'unit', u); closeModal(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[m.unitOptTxt, u === current && m.unitOptActiveTxt]}>{u}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tax Ledger Modal */}
      <Modal visible={activeModal?.type === 'taxLedger'} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Tax Ledger</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {taxLedgers.length === 0 && (
              <View style={mAdd.warehouseHint}>
                <Ionicons name="alert-circle-outline" size={13} color={COLORS.warning} />
                <Text style={[mAdd.warehouseHintTxt, { color: COLORS.warning }]}>No tax ledgers found</Text>
              </View>
            )}
            {taxLedgers.map((t, idx) => {
              const currentTaxLedger = activeModal ? items.find(i => i.id === activeModal.itemId)?.taxLedger || '' : '';
              return (
                <TouchableOpacity
                  key={idx}
                  style={[m.opt, t.name === currentTaxLedger && m.optActive]}
                  onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'taxLedger', t.name); closeModal(); }}
                  activeOpacity={0.7}
                >
                  <View style={m.optLeft}>
                    <Ionicons name="receipt-outline" size={16} color={COLORS.info} />
                    <Text style={[m.optTxt, t.name === currentTaxLedger && m.optActiveTxt]}>{t.name}</Text>
                  </View>
                  {t.name === currentTaxLedger && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Warehouse Modal */}
      <Modal visible={activeModal?.type === 'warehouse'} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {warehouses.map(w => (
              <TouchableOpacity
                key={w.id}
                style={m.opt}
                onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'warehouse', w.name); closeModal(); }}
                activeOpacity={0.7}
              >
                <View style={m.optLeft}>
                  <Ionicons name="business-outline" size={16} color={COLORS.info} />
                  <Text style={m.optTxt}>{w.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={activeModal?.type === 'barcode'}
        companyGuid={company?.guid}
        onScan={(productName) => {
          if (activeModal) {
            const si = stockItems.find(s => s.name === productName);
            setItems(prev => prev.map(i => {
              if (i.id !== activeModal.itemId) return i;
              return {
                ...i,
                product: productName,
                unit: si?.unit || i.unit,
                rate: si?.rate != null ? String(si.rate) : i.rate,
              };
            }));
            Alert.alert('✓ Product Found', `Added: ${si?.displayName || productName}`);
          }
          closeModal();
        }}
        onClose={closeModal}
      />

      {/* Date Picker Modal (OPT mode only) */}
      <DatePickerModal
        visible={showDatePicker}
        value={date}
        minDate={fyStart}
        maxDate={new Date().toISOString().slice(0, 10)}
        onSelect={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Add New Customer Drawer */}
      <AddCustomerDrawer
        visible={showAddCustomer}
        company={company}
        onClose={() => setShowAddCustomer(false)}
        onSaved={(name, success) => {
          const newOpt: DropdownOption = { label: name, value: name };
          setParties(prev => [...prev, newOpt]);
          setParty(name);
          setShowAddCustomer(false);
          if (success !== false) {
            Alert.alert('✓ Customer Added', `"${name}" has been added and selected.`);
          }
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  invNoBadge: { backgroundColor: COLORS.infoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  invNoTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  scroll: { padding: SPACING.md, paddingBottom: 8 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48, justifyContent: 'center', ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }) },
  fInputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  star: { color: COLORS.negative },
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  termChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  termChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  termChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  termChipTxtActive: { color: COLORS.white },
  customDaysRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  daysBadge: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderLeftWidth: 0, borderColor: COLORS.borderDefault, borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  daysBadgeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  sectionTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  itemCount: { backgroundColor: COLORS.brandPrimary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemCountTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#fff' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.positive + '40', borderStyle: 'dashed' },
  addItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  summaryCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  summaryTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sumLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sumDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: 12 },
  grandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  grandVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.brandPrimary },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  draftBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  draftTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8 },
  payNowToggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 12, paddingHorizontal: SPACING.md },
  payNowLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  payNowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center' as const, justifyContent: 'center' as const },
  payNowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600' as const, color: COLORS.textPrimary },
  payNowSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  payNowBody: { paddingHorizontal: SPACING.md, paddingBottom: 12, gap: 10 },
  payStatusChip: { flexDirection: 'row' as const, gap: 8, paddingVertical: 8 },
  payStatusPaid: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.positiveBg, borderWidth: 1, borderColor: COLORS.positive },
  payStatusPartial: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.warningBg, borderWidth: 1, borderColor: COLORS.warning },
  payStatusPending: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  payStatusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' as const, color: COLORS.textSecondary },
  payStatusSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%', paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  optActive: { backgroundColor: COLORS.pageBg },
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  optTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, flex: 1 },
  optActiveTxt: { fontWeight: '700', color: COLORS.brandPrimary },
  unitMenu: { position: 'absolute', right: 0, top: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  unitOpt: { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, width: 200, alignItems: 'center' },
  unitOptActive: { backgroundColor: COLORS.pageBg },
  unitOptTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  unitOptActiveTxt: { fontWeight: '700', color: COLORS.brandPrimary },
});

const ir = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.sm, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 8 },
  warehouseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  warehouseBtnActive: { borderColor: COLORS.info, backgroundColor: COLORS.infoBg },
  warehouseTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.info },
  placeholderTxt: { color: COLORS.textTertiary, fontWeight: '400' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault },
  productTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  barcodeBtn: { width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  delBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBox: { width: 64 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 3 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right' },
  unitBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'flex-end', marginBottom: 0 },
  unitTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  discRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discTypeBtn: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7 },
  discTypeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  discInput: { width: 44, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 6, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center' },
  discLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  taxBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.borderDefault, flex: 1 },
  taxTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.info },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  subtotalLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});

const bs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  rescanBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  rescanText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  camera: { flex: 1 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 40 },
  scanFrame: { width: 220, height: 220, borderWidth: 2, borderColor: COLORS.brandPrimary, borderRadius: 12, marginBottom: 20 },
  hint: { fontSize: TYPOGRAPHY.sm, color: COLORS.white, fontWeight: '600' },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: SPACING.xl },
  permText: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, textAlign: 'center' },
  permBtn: { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, paddingVertical: 14 },
  permBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const acd = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  kvWrap: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginRight: 8 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  star: { color: COLORS.negative },
  input: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  inputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  balBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingLeft: 14, paddingRight: 8, minHeight: 48 },
  balInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 12 },
  drCrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  drCrLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '600' },
  drCrLblActive: { color: COLORS.brandPrimary },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleLbl: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  expandSection: { paddingLeft: 4, paddingBottom: 8 },
  row2: { flexDirection: 'row', gap: 12 },
  selectBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  selectBoxOpen: { borderColor: COLORS.brandPrimary },
  selectTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropList: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, marginTop: 4, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTxtActive: { fontWeight: '700', color: COLORS.brandPrimary },
  saveBtn: { flexDirection: 'row', margin: SPACING.md, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const mAdd = StyleSheet.create({
  warehouseHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.infoBg, marginBottom: 4 },
  warehouseHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.info, fontWeight: '600' },
});

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 24, padding: 28, width: '85%', alignItems: 'center', gap: 12 },
  iconWrap: { marginBottom: 4 },
  title: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  refBadge: { backgroundColor: COLORS.pageBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.borderDefault },
  refLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 2 },
  refVal: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.brandPrimary },
  pdfBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  waBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  waBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  doneBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});
