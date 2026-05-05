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
import { getParties, getLedgers, createSalesInvoice } from '../../src/services/api';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import SearchableDropdown, { SDOption } from '../../src/components/forms/SearchableDropdown';
import { useSettings } from '../../src/context/SettingsContext';

// ─── Mock data ────────────────────────────────────────────────────────────────
const LEDGER_ACCOUNTS: DropdownOption[] = [
  { label: 'Credit Sales', value: 'credit_sales' },
  { label: 'Cash Sales', value: 'cash_sales' },
  { label: 'Off-Books Sales', value: 'off_books' },
  { label: 'Export Sales', value: 'export_sales' },
  { label: 'Domestic Sales', value: 'domestic_sales' },
  { label: 'Online Sales', value: 'online_sales' },
  { label: 'Retail Sales', value: 'retail_sales' },
  { label: 'Wholesale Sales', value: 'wholesale_sales' },
];
const PARTIES: DropdownOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'XYZ Retail', value: 'xyz' },
  { label: 'Sharma Electronics', value: 'sharma' },
  { label: 'Delhi Suppliers', value: 'delhi' },
  { label: 'Raj Enterprises', value: 'raj' },
  { label: 'Indian Export House', value: 'ieh' },
];
const TERMS: DropdownOption[] = [
  { label: 'Due on Receipt', value: 'due_on_receipt' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];

// Warehouse → Products mapping
const WAREHOUSE_PRODUCTS: Record<string, string[]> = {
  main_wh:     ['jbl_speaker', 'samsung_j1', 'lycan_hp', 'sony_xm5', 'jbl_wired', 'shipping', 'consulting'],
  store_a:     ['jbl_speaker', 'lycan_hp', 'consulting'],
  store_b:     ['samsung_j1', 'sony_xm5', 'shipping'],
  delhi_depot: ['jbl_wired', 'consulting', 'shipping'],
};
const ALL_PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
  { label: 'Shipping & Handling', value: 'shipping' },
  { label: 'Consulting Services', value: 'consulting' },
];
// Barcode → product value mapping (mock)
const BARCODE_MAP: Record<string, string> = {
  '123456789012': 'jbl_speaker',
  '234567890123': 'samsung_j1',
  '345678901234': 'lycan_hp',
  '456789012345': 'sony_xm5',
  '567890123456': 'jbl_wired',
};
const WAREHOUSES: DropdownOption[] = [
  { label: 'Main Warehouse', value: 'main_wh' },
  { label: 'Store A', value: 'store_a' },
  { label: 'Store B', value: 'store_b' },
  { label: 'Delhi Depot', value: 'delhi_depot' },
];
const UNITS: DropdownOption[] = [
  { label: 'Pcs', value: 'pcs' },
  { label: 'Kg', value: 'kg' },
  { label: 'Ltr', value: 'ltr' },
  { label: 'Mtr', value: 'mtr' },
  { label: 'Box', value: 'box' },
  { label: 'Nos', value: 'nos' },
];
const TAX_RATES: DropdownOption[] = [
  { label: '0% (Exempt)', value: '0' },
  { label: '5% GST', value: '5' },
  { label: '12% GST', value: '12' },
  { label: '18% GST', value: '18' },
  { label: '28% GST', value: '28' },
];

// ─── Themed inline input (theme-colored focus border, no blue) ────────────────
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
function BarcodeScannerModal({ visible, onScan, onClose }: {
  visible: boolean;
  onScan: (productValue: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    const product = BARCODE_MAP[data];
    if (product) {
      onScan(product);
    } else {
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

// ─── Add Customer Bottom Drawer ───────────────────────────────────────────────
const GST_TYPES = ['Regular', 'Unregistered', 'Composition'];
const INVOICE_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
];

// Simple inline state picker for the drawer
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

function AddCustomerDrawer({ visible, onClose, onSaved }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [openBal, setOpenBal] = useState('');
  const [isCr, setIsCr] = useState(false);
  const [creditDays, setCreditDays] = useState('');
  const [mailing, setMailing] = useState(false);
  const [bank, setBank] = useState(false);
  // Mailing fields
  const [mailingName, setMailingName] = useState('');
  const [address, setAddress] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  // Bank fields
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  // GST
  const [gstType, setGstType] = useState('Regular');
  const [gstOpen, setGstOpen] = useState(false);
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [creditFocused, setCreditFocused] = useState(false);
  const [gstinFocused, setGstinFocused] = useState(false);
  const [panFocused, setPanFocused] = useState(false);
  const [balFocused, setBalFocused] = useState(false);

  const webFix = Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any });

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    onSaved(name.trim());
    // Reset
    setName(''); setOpenBal(''); setIsCr(false); setCreditDays('');
    setMailing(false); setBank(false); setGstType('Regular');
    setGstin(''); setPan('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={acd.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={acd.kvWrap}
      >
        <View style={[acd.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Handle + Header */}
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
            {/* Name */}
            <Text style={acd.label}>Name <Text style={acd.star}>*</Text></Text>
            <TextInput
              style={[acd.input, nameFocused && acd.inputFocused, webFix]}
              placeholder="Enter customer name"
              placeholderTextColor={COLORS.textTertiary}
              value={name} onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />

            {/* Opening Balance */}
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
                <BrandSwitch
                  value={isCr} onValueChange={setIsCr}
                />
                <Text style={[acd.drCrLbl, isCr && acd.drCrLblActive]}>Cr</Text>
              </View>
            </View>

            {/* Credit Period */}
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

            {/* Toggles + Expandable Sections */}
            <View style={acd.divider} />

            {/* Enable Mailing Details */}
            <View style={acd.toggleRow}>
              <Text style={acd.toggleLbl}>Enable Mailing Details</Text>
              <BrandSwitch value={mailing} onValueChange={setMailing} />
            </View>
            {mailing && (
              <View style={acd.expandSection}>
                <Text style={acd.label}>Mailing Name</Text>
                <TextInput
                  style={[acd.input, webFix]}
                  placeholder="Enter mailing name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={mailingName} onChangeText={setMailingName}
                />
                <Text style={acd.label}>Address</Text>
                <TextInput
                  style={[acd.input, acd.textarea, webFix]}
                  placeholder="Enter address"
                  placeholderTextColor={COLORS.textTertiary}
                  value={address} onChangeText={setAddress}
                  multiline numberOfLines={3}
                />
                <Text style={acd.label}>State</Text>
                <StateDropdown value={stateVal} onSelect={setStateVal} />
                <View style={acd.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={acd.label}>Pincode</Text>
                    <TextInput
                      style={[acd.input, webFix]}
                      placeholder="Pincode"
                      placeholderTextColor={COLORS.textTertiary}
                      value={pincode} onChangeText={setPincode}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={acd.label}>Country</Text>
                    <TextInput
                      style={[acd.input, webFix]}
                      value={country} onChangeText={setCountry}
                      placeholderTextColor={COLORS.textTertiary}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Provide Bank Details */}
            <View style={acd.toggleRow}>
              <Text style={acd.toggleLbl}>Provide Bank Details</Text>
              <BrandSwitch value={bank} onValueChange={setBank} />
            </View>
            {bank && (
              <View style={acd.expandSection}>
                <Text style={acd.label}>Beneficiary Name</Text>
                <TextInput
                  style={[acd.input, webFix]}
                  placeholder="Enter beneficiary name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={beneficiaryName} onChangeText={setBeneficiaryName}
                />
                <Text style={acd.label}>Bank Name</Text>
                <TextInput
                  style={[acd.input, webFix]}
                  placeholder="Enter bank name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={bankName} onChangeText={setBankName}
                />
                <Text style={acd.label}>Account Number</Text>
                <TextInput
                  style={[acd.input, webFix]}
                  placeholder="Enter account number"
                  placeholderTextColor={COLORS.textTertiary}
                  value={accountNo} onChangeText={setAccountNo}
                  keyboardType="numeric"
                />
                <Text style={acd.label}>IFSC Code</Text>
                <TextInput
                  style={[acd.input, webFix]}
                  placeholder="Enter IFSC code"
                  placeholderTextColor={COLORS.textTertiary}
                  value={ifscCode} onChangeText={v => setIfscCode(v.toUpperCase())}
                  autoCapitalize="characters"
                />
                <Text style={acd.label}>Bank Branch</Text>
                <TextInput
                  style={[acd.input, webFix]}
                  placeholder="Enter branch name"
                  placeholderTextColor={COLORS.textTertiary}
                  value={bankBranch} onChangeText={setBankBranch}
                />
              </View>
            )}
            <View style={acd.divider} />

            {/* GST Registration Type */}
            <Text style={acd.label}>GST Registration Type <Text style={acd.star}>*</Text></Text>
            <TouchableOpacity
              style={[acd.selectBox, gstOpen && acd.selectBoxOpen]}
              onPress={() => setGstOpen(!gstOpen)}
              activeOpacity={0.7}
            >
              <Text style={acd.selectTxt}>{gstType}</Text>
              <Ionicons name={gstOpen ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {gstOpen && (
              <View style={acd.dropList}>
                {GST_TYPES.map((t, idx) => (
                  <TouchableOpacity
                    key={t}
                    style={[acd.dropItem, idx === GST_TYPES.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => { setGstType(t); setGstOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[acd.dropTxt, gstType === t && acd.dropTxtActive]}>{t}</Text>
                    {gstType === t && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* GSTIN */}
            <Text style={acd.label}>GSTIN <Text style={acd.star}>*</Text></Text>
            <TextInput
              style={[acd.input, gstinFocused && acd.inputFocused, webFix]}
              placeholder="Enter GSTIN"
              placeholderTextColor={COLORS.textTertiary}
              value={gstin} onChangeText={v => setGstin(v.toUpperCase())}
              autoCapitalize="characters"
              onFocus={() => setGstinFocused(true)}
              onBlur={() => setGstinFocused(false)}
            />

            {/* PAN */}
            <Text style={acd.label}>PAN/IT No.</Text>
            <TextInput
              style={[acd.input, panFocused && acd.inputFocused, webFix]}
              placeholder="Enter PAN/IT number"
              placeholderTextColor={COLORS.textTertiary}
              value={pan} onChangeText={v => setPan(v.toUpperCase())}
              autoCapitalize="characters"
              onFocus={() => setPanFocused(true)}
              onBlur={() => setPanFocused(false)}
            />

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Save */}
          <TouchableOpacity style={acd.saveBtn} onPress={handleSave} activeOpacity={0.85}>
            <Text style={acd.saveBtnTxt}>Save Customer</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceItem {
  id: string;
  warehouse: string;
  product: string;
  qty: string;
  unit: string;
  rate: string;
  discountType: '%' | 'flat';
  discount: string;
  taxRate: string;
}

const newItem = (): InvoiceItem => ({
  id: Date.now().toString(),
  warehouse: '', product: '', qty: '1', unit: 'pcs', rate: '',
  discountType: '%', discount: '0', taxRate: '18',
});

const todayStr = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProductDropdownModal({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string;
  onSelect: (v: DropdownOption) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose} />
      <View style={m.sheet}>
        <View style={m.handle} />
        <Text style={m.title}>Select Product / Service</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {ALL_PRODUCTS.map(p => (
            <TouchableOpacity key={p.value} style={[m.opt, p.value === value && m.optActive]}
              onPress={() => { onSelect(p); onClose(); }} activeOpacity={0.7}>
              <View style={m.optLeft}>
                <Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} />
                <Text style={[m.optTxt, p.value === value && m.optActiveTxt]}>{p.label}</Text>
              </View>
              {p.value === value && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={m.addNew} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={COLORS.positive} />
            <Text style={m.addNewTxt}>Add New Product</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function UnitModal({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string;
  onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose}>
        <View style={m.unitMenu}>
          {UNITS.map(u => (
            <TouchableOpacity key={u.value}
              style={[m.unitOpt, u.value === value && m.unitOptActive]}
              onPress={() => { onSelect(u.value); onClose(); }} activeOpacity={0.7}>
              <Text style={[m.unitOptTxt, u.value === value && m.unitOptActiveTxt]}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function TaxModal({ visible, value, onSelect, onClose }: {
  visible: boolean; value: string;
  onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose}>
        <View style={m.taxMenu}>
          {TAX_RATES.map(t => (
            <TouchableOpacity key={t.value}
              style={[m.unitOpt, t.value === value && m.unitOptActive]}
              onPress={() => { onSelect(t.value); onClose(); }} activeOpacity={0.7}>
              <Text style={[m.unitOptTxt, t.value === value && m.unitOptActiveTxt]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

type ModalState = { type: 'product'|'unit'|'tax'|'warehouse'|'barcode'; itemId: string } | null;

function ItemRow({ item, onUpdate, onRemove, onOpenModal }: {
  item: InvoiceItem;
  onUpdate: (id: string, field: keyof InvoiceItem, val: string) => void;
  onRemove: (id: string) => void;
  onOpenModal: (s: ModalState) => void;
}) {
  const calc = calcItem(item);
  const warehouseLabel = WAREHOUSES.find(w => w.value === item.warehouse)?.label;

  // Products filtered by selected warehouse
  const availableProducts = item.warehouse
    ? ALL_PRODUCTS.filter(p => (WAREHOUSE_PRODUCTS[item.warehouse] || []).includes(p.value))
    : ALL_PRODUCTS;
  const productName = availableProducts.find(p => p.value === item.product)?.label
    || ALL_PRODUCTS.find(p => p.value === item.product)?.label;
  const unitLabel = UNITS.find(u => u.value === item.unit)?.label || item.unit;

  return (
    <View style={ir.card}>
      {/* Row 1: Warehouse (FIRST) */}
      <TouchableOpacity
        style={[ir.warehouseBtn, item.warehouse && ir.warehouseBtnActive]}
        onPress={() => onOpenModal({ type: 'warehouse', itemId: item.id })}
        activeOpacity={0.7}
      >
        <Ionicons name="business-outline" size={13} color={item.warehouse ? COLORS.info : COLORS.textTertiary} />
        <Text style={[ir.warehouseTxt, !warehouseLabel && ir.placeholderTxt]}>
          {warehouseLabel || 'Select Warehouse first...'}
        </Text>
        <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Row 2: Product + Barcode + Delete */}
      <View style={ir.topRow}>
        <TouchableOpacity
          style={ir.productBtn}
          onPress={() => onOpenModal({ type: 'product', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
          <Text style={[ir.productTxt, !item.product && ir.placeholderTxt]} numberOfLines={1}>
            {productName || (item.warehouse ? 'Select product...' : 'Select warehouse first')}
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
          <Text style={ir.unitTxt}>{unitLabel}</Text>
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

      {/* Discount + Tax */}
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
        <TouchableOpacity style={ir.taxBtn} onPress={() => onOpenModal({ type: 'tax', itemId: item.id })} activeOpacity={0.7}>
          <Ionicons name="receipt-outline" size={12} color={COLORS.info} />
          <Text style={ir.taxTxt}>GST {item.taxRate}%</Text>
          <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Subtotal */}
      <View style={ir.subtotalRow}>
        <Text style={ir.subtotalLabel}>Item Total</Text>
        <Text style={ir.subtotalVal}>
          ₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>
    </View>
  );
}

// ─── Payment Mode options ─────────────────────────────────────────────────────
const PAY_MODES: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'NEFT', value: 'neft' },
  { label: 'RTGS', value: 'rtgs' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'UPI', value: 'upi' },
  { label: 'IMPS', value: 'imps' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateSalesInvoiceScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, isPaired } = useAuth();

  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [ledger, setLedger] = useState('credit_sales');
  const [invoiceNo] = useState('INV-30979');
  const [date, setDate] = useState(todayStr());
  const [party, setParty] = useState('');
  const [parties, setParties] = useState<DropdownOption[]>(PARTIES);
  const [submitting, setSubmitting] = useState(false);

  // Load real parties from API
  useEffect(() => {
    if (!company?.guid) return;
    getParties(company.guid).then((res: any) => {
      const list = res?.data || [];
      if (list.length > 0) {
        setParties(list.map((p: any) => ({ label: p.name, value: p.guid || p.id?.toString() || p.name })));
      }
    }).catch(() => {});
  }, [company?.guid]);
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

  // Collect Payment Now
  const [collectPayNow, setCollectPayNow] = useState(false);
  const [payNowMode, setPayNowMode] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [payNowRef, setPayNowRef] = useState('');

  const updateItem = useCallback((id: string, field: keyof InvoiceItem, val: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
  }, []);
  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  }, []);
  const addItem = useCallback(() => setItems(prev => [...prev, newItem()]), []);

  const logisticsTotal = useMemo(() => calcLogisticsTotal(logEntries, logTaxRate), [logEntries, logTaxRate]);

  const totals = useMemo(() => {
    let gross = 0, discTotal = 0, taxTotal = 0;
    items.forEach(item => {
      const c = calcItem(item);
      gross += c.gross;
      discTotal += c.discAmt;
      taxTotal += c.taxAmt;
    });
    const grand = gross - discTotal + taxTotal + logisticsTotal;
    return { gross, discTotal, taxTotal, cgst: taxTotal/2, sgst: taxTotal/2, logisticsTotal, grand };
  }, [items, logisticsTotal]);

  const paymentStatus = useMemo(() => {
    if (!collectPayNow) return 'pending';
    const paidAmt = parseFloat(payNowAmount) || 0;
    if (paidAmt <= 0) return 'pending';
    if (paidAmt >= totals.grand) return 'paid';
    return 'partial';
  }, [collectPayNow, payNowAmount, totals.grand]);

  const handleSubmit = useCallback(async (isDraft = false) => {
    if (!isPaired) {
      Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' });
      return;
    }
    try {
      setSubmitting(true);
      await createSalesInvoice({
        company_guid: company?.guid,
        party,
        date,
        ledger_account: ledger,
        payment_terms: payTerms,
        due_date: dueDate || undefined,
        ref_no: refNo || undefined,
        items: items.map(item => ({
          stock_item: item.product,
          warehouse: item.warehouse,
          qty: parseFloat(item.qty) || 0,
          unit: item.unit,
          rate: parseFloat(item.rate) || 0,
          discount: parseFloat(item.discount) || 0,
          tax_rate: parseFloat(item.taxRate) || 0,
        })),
        narration: narration || undefined,
        terms: termsText || undefined,
        collect_payment: collectPayNow ? {
          mode: payNowMode,
          amount: parseFloat(payNowAmount) || 0,
          reference: payNowRef || undefined,
        } : undefined,
        is_draft: isDraft,
      });
      Toast.show({ type: 'success', text1: isDraft ? 'Draft Saved' : 'Invoice Submitted', text2: `Invoice ${invoiceNo} ${isDraft ? 'saved as draft' : 'submitted to Tally'}.` });
      setTimeout(() => router.back(), 1000);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not submit. Check Tally connection.' });
    } finally {
      setSubmitting(false);
    }
  }, [isPaired, company?.guid, party, date, ledger, payTerms, dueDate, refNo, items, narration, termsText, collectPayNow, payNowMode, payNowAmount, payNowRef, invoiceNo, router]);

  const closeModal = useCallback(() => setActiveModal(null), []);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}
          hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Sales Invoice</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.invNoBadge}>
          <Text style={s.invNoTxt}>{invoiceNo}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ledger Searchable Selector */}
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
              <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={s.cardTitle}>Invoice Details</Text>
            </View>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Invoice No.</Text>
                <View style={s.autoBox}>
                  <Text style={s.autoTxt}>{invoiceNo}</Text>
                  <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                <ThemedFInput
                  value={date} onChangeText={setDate}
                  placeholder="DD/MM/YY"
                />
              </View>
            </View>

            {/* Customer / Party — searchable + Add New */}
            <SearchableDropdown
              label="Customer / Party"
              required
              placeholder="Search customer..."
              options={parties}
              value={party}
              onSelect={o => setParty(o.value)}
              onAddNew={() => setShowAddCustomer(true)}
              addNewLabel="Add New Customer"
            />

            {/* Payment Terms — inline accordion */}
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
                <ThemedFInput
                  value={dueDate} onChangeText={setDueDate}
                  placeholder="DD/MM/YY"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Reference No.</Text>
                <ThemedFInput
                  value={refNo} onChangeText={setRefNo}
                  placeholder="Optional"
                />
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
              <BrandSwitch
                value={collectPayNow}
                onValueChange={setCollectPayNow}
              />
            </TouchableOpacity>

            {collectPayNow && (
              <View style={s.payNowBody}>
                <View style={s.divider} />
                <FormDropdown
                  label="Mode of Payment"
                  value={payNowMode}
                  options={PAY_MODES}
                  onSelect={o => setPayNowMode(o.value)}
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
                {/* Payment Status Chip */}
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

          {/* Summary */}
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
            {totals.taxTotal > 0 && (
              <>
                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>CGST</Text>
                  <Text style={s.sumVal}>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>SGST</Text>
                  <Text style={s.sumVal}>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </>
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

          {/* Notes */}
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

      {/* Product Modal — shows warehouse-filtered products */}
      <Modal
        visible={activeModal?.type === 'product'}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Product / Service</Text>
          {(() => {
            const itemId = activeModal?.itemId;
            const item = items.find(i => i.id === itemId);
            const filteredProducts = item?.warehouse
              ? ALL_PRODUCTS.filter(p => (WAREHOUSE_PRODUCTS[item.warehouse] || []).includes(p.value))
              : ALL_PRODUCTS;
            const currentProduct = item?.product || '';
            return (
              <ScrollView showsVerticalScrollIndicator={false}>
                {item?.warehouse ? (
                  <View style={mAdd.warehouseHint}>
                    <Ionicons name="business-outline" size={13} color={COLORS.info} />
                    <Text style={mAdd.warehouseHintTxt}>
                      Showing products from: {WAREHOUSES.find(w => w.value === item.warehouse)?.label}
                    </Text>
                  </View>
                ) : (
                  <View style={mAdd.warehouseHint}>
                    <Ionicons name="alert-circle-outline" size={13} color={COLORS.warning} />
                    <Text style={[mAdd.warehouseHintTxt, { color: COLORS.warning }]}>Select warehouse to filter products</Text>
                  </View>
                )}
                {filteredProducts.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    style={[m.opt, p.value === currentProduct && m.optActive]}
                    onPress={() => {
                      if (activeModal) updateItem(activeModal.itemId, 'product', p.value);
                      closeModal();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={m.optLeft}>
                      <Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={[m.optTxt, p.value === currentProduct && m.optActiveTxt]}>{p.label}</Text>
                    </View>
                    {p.value === currentProduct && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            );
          })()}
        </View>
      </Modal>
      {/* Unit Modal */}
      <UnitModal
        visible={activeModal?.type === 'unit'}
        value={activeModal ? items.find(i => i.id === activeModal.itemId)?.unit || 'pcs' : 'pcs'}
        onSelect={v => { if (activeModal) updateItem(activeModal.itemId, 'unit', v); }}
        onClose={closeModal}
      />
      {/* Tax Modal */}
      <TaxModal
        visible={activeModal?.type === 'tax'}
        value={activeModal ? items.find(i => i.id === activeModal.itemId)?.taxRate || '18' : '18'}
        onSelect={v => { if (activeModal) updateItem(activeModal.itemId, 'taxRate', v); }}
        onClose={closeModal}
      />
      {/* Warehouse Modal */}
      <Modal visible={activeModal?.type === 'warehouse'} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAREHOUSES.map(w => (
              <TouchableOpacity key={w.value} style={m.opt} onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'warehouse', w.value); closeModal(); }} activeOpacity={0.7}>
                <View style={m.optLeft}><Ionicons name="business-outline" size={16} color={COLORS.info} /><Text style={m.optTxt}>{w.label}</Text></View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={activeModal?.type === 'barcode'}
        onScan={(productValue) => {
          if (activeModal) {
            updateItem(activeModal.itemId, 'product', productValue);
            const product = ALL_PRODUCTS.find(p => p.value === productValue);
            Alert.alert('✓ Product Found', `Added: ${product?.label || productValue}`);
          }
          closeModal();
        }}
        onClose={closeModal}
      />

      {/* Add New Customer Drawer */}
      <AddCustomerDrawer
        visible={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onSaved={(name) => {
          const newVal = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
          const newOpt: DropdownOption = { label: name, value: newVal };
          setParties(prev => [...prev, newOpt]);
          setParty(newVal);
          setShowAddCustomer(false);
          Alert.alert('✓ Customer Added', `"${name}" has been added and selected.`);
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
  ledgerRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  ledgerChip: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, alignItems: 'center' },
  ledgerChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  ledgerChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  ledgerChipTxtActive: { color: '#fff' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48, ...Platform.select({ web: { outlineWidth: 0, outlineStyle: 'none' } as any }) },
  fInputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  star: { color: COLORS.negative },
  // Payment terms chips
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  termChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  termChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  termChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  termChipTxtActive: { color: COLORS.white },
  // Custom days input
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
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  optActiveTxt: { fontWeight: '700', color: COLORS.brandPrimary },
  addNew: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginTop: 4 },
  addNewTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  unitMenu: { position: 'absolute', right: 0, top: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  taxMenu: { position: 'absolute', right: 0, top: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center' },
  unitOpt: { backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, width: 200, alignItems: 'center' },
  unitOptActive: { backgroundColor: COLORS.pageBg },
  unitOptTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  unitOptActiveTxt: { fontWeight: '700', color: COLORS.brandPrimary },
});

const ir = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  productBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  productTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  placeholderTxt: { color: COLORS.textTertiary },
  delBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  barcodeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  warehouseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 8 },
  warehouseBtnActive: { backgroundColor: COLORS.infoBg, borderColor: COLORS.info + '40' },
  warehouseTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.info },
  fieldRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-end' },
  qtyBox: { width: 72 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 9, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center', minHeight: 38 },
  unitBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'flex-end', minHeight: 38 },
  unitTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  discRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 6, paddingVertical: 4, minHeight: 38 },
  discTypeBtn: { backgroundColor: COLORS.brandPrimary, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  discTypeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: '#fff', width: 16, textAlign: 'center' },
  discInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center', paddingVertical: 2 },
  discLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  taxBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.info + '30', minHeight: 38 },
  taxTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8 },
  subtotalLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
});


// ─── SearchableDD Styles ──────────────────────────────────────────────────────
const sdd = StyleSheet.create({
  wrap: { marginBottom: SPACING.md },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 4, minHeight: 48,
  },
  inputBoxFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  input: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 8 },
  dropList: {
    borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropText: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, flex: 1 },
  dropTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
  addNewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  addNewText: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.brandPrimary },
});

// ─── Barcode Scanner Styles ───────────────────────────────────────────────────
const bs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  rescanBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.md },
  rescanText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.info },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  scanFrame: {
    width: 260, height: 180, borderWidth: 3, borderColor: COLORS.white,
    borderRadius: RADIUS.lg, backgroundColor: 'transparent',
  },
  hint: { color: COLORS.white, fontSize: TYPOGRAPHY.sm, marginTop: 20, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4 },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: SPACING.xl, backgroundColor: COLORS.pageBg },
  permText: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, textAlign: 'center' },
  permBtn: { backgroundColor: COLORS.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.md },
  permBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

// ─── m additions ─────────────────────────────────────────────────────────────
const mAdd = StyleSheet.create({
  warehouseHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  warehouseHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.info, flex: 1 },
});

// ─── Add Customer Drawer Styles ───────────────────────────────────────────────
const acd = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  kvWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    gap: 8,
  },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textTertiary,
    backgroundColor: COLORS.pageBg, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.sm, overflow: 'hidden',
  },
  closeBtn: {
    marginLeft: 'auto', width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderRadius: 16,
  },
  body: { paddingHorizontal: SPACING.md, paddingTop: 4, paddingBottom: 8 },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: 8, marginTop: 16 },
  star: { color: COLORS.negative },
  input: {
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary,
    backgroundColor: COLORS.cardBg,
  },
  inputFocused: { borderColor: COLORS.brandPrimary, borderWidth: 1.5 },
  balBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    backgroundColor: COLORS.cardBg, paddingLeft: 14, paddingRight: 10, paddingVertical: 4,
  },
  balInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 9 },
  drCrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 },
  drCrLbl: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textTertiary },
  drCrLblActive: { color: COLORS.textPrimary, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleLbl: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: COLORS.cardBg,
  },
  selectBoxOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  selectTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
  dropList: {
    borderWidth: 1, borderTopWidth: 0, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
    borderBottomLeftRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md,
    overflow: 'hidden',
  },
  dropItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTxtActive: { fontWeight: '700' },
  saveBtn: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md,
    paddingVertical: 15, alignItems: 'center',
    marginHorizontal: SPACING.md, marginTop: 8,
  },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  expandSection: {
    backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  row2: { flexDirection: 'row', gap: 10 },
  textarea: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
});

