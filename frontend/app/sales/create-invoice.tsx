import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, TextInputProps, ActivityIndicator,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import {
  getParties, createSalesInvoice, getStocks, getWarehouses,
  getSalesLedgerAccounts, getTaxLedgers, createTallyParty, lookupBarcode,
  getComplianceConfig, getChargeLedgers, getStockGodowns,
} from '../../src/services/api';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import DatePickerModal, { formatDMY, parseDMY } from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';

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

const calcItem = (item: InvoiceItem) => {
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
interface Godown { name: string; qty: number; }

interface TaxLedgerEntry {
  id: string;
  ledgerName: string;
  taxRate: string;
  taxAmount: string;
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
  taxEntries: TaxLedgerEntry[];
}

const newItem = (warehouseName = ''): InvoiceItem => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  warehouse: warehouseName, product: '', qty: '1', unit: 'pcs', rate: '',
  discountType: '%', discount: '0', taxEntries: [],
});

type ModalState = { type: 'unit'; itemId: string } | null;

// ─── ThemedFInput ──────────────────────────────────────────────────────────────
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
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      {...props}
    />
  );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const STEPS = [
    { num: 1 as const, label: 'Invoice Details' },
    { num: 2 as const, label: 'Items & Services' },
    { num: 3 as const, label: 'Review & Submit' },
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
            <Text style={[si.label, step === st.num && si.labelActive, step > st.num && { color: COLORS.brandPrimary }]}>
              {st.label}
            </Text>
          </View>
          {idx < STEPS.length - 1 && <View style={[si.line, step > st.num && si.lineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

// ─── StateDropdown ────────────────────────────────────────────────────────────
function StateDropdown({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={[acd.selectBox, open && acd.selectBoxOpen]} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={[acd.selectTxt, !value && { color: COLORS.textTertiary }]}>{value || 'Select state'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={acd.dropList}>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {INVOICE_STATES.map((st, idx) => (
              <TouchableOpacity key={st} style={[acd.dropItem, idx === INVOICE_STATES.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(st); setOpen(false); }} activeOpacity={0.7}>
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

// ─── AddCustomerDrawer ────────────────────────────────────────────────────────
function AddCustomerDrawer({ visible, onClose, onSaved, company }: {
  visible: boolean; onClose: () => void;
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
        companyGuid: company?.guid, companyName: company?.name,
        partyName: name.trim(), openingBalance: parseFloat(openBal) || 0, isCr,
        gstin: gstin.trim(), gstType, creditDays: parseInt(creditDays) || 0,
        mailingName: mailingName || name.trim(), address, state: stateVal,
        pincode, country: country || 'India',
        bankDetails: bank ? { beneficiaryName, bankName, accountNo, ifsc: ifscCode, branch: bankBranch } : undefined,
      });
      const savedName = name.trim(); resetForm(); onSaved(savedName, true);
    } catch (err: any) {
      const isOffline = err?.message?.includes('offline') || err?.message?.includes('not connected') || err?.message?.includes('Desktop');
      const savedName = name.trim(); resetForm(); onSaved(savedName, !isOffline);
      if (isOffline) Alert.alert('Queued', `"${savedName}" will be created in Tally when desktop connects.`);
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={acd.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={acd.kvWrap}>
        <View style={[acd.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={acd.handle} />
          <View style={acd.header}>
            <Text style={acd.title}>New Customer</Text>
            <Text style={acd.subtitle}>Sundry Debtors</Text>
            <TouchableOpacity onPress={onClose} style={acd.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={acd.body}>
            <Text style={acd.label}>Name <Text style={acd.star}>*</Text></Text>
            <TextInput style={[acd.input, nameFocused && acd.inputFocused, webFix]} placeholder="Enter customer name" placeholderTextColor={COLORS.textTertiary} value={name} onChangeText={setName} onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)} />
            <Text style={acd.label}>Opening Balance</Text>
            <View style={[acd.balBox, balFocused && acd.inputFocused]}>
              <TextInput style={[acd.balInput, webFix]} placeholder="0.00" placeholderTextColor={COLORS.textTertiary} value={openBal} onChangeText={setOpenBal} keyboardType="numeric" onFocus={() => setBalFocused(true)} onBlur={() => setBalFocused(false)} />
              <View style={acd.drCrRow}>
                <Text style={[acd.drCrLbl, !isCr && acd.drCrLblActive]}>Dr</Text>
                <BrandSwitch value={isCr} onValueChange={setIsCr} />
                <Text style={[acd.drCrLbl, isCr && acd.drCrLblActive]}>Cr</Text>
              </View>
            </View>
            <Text style={acd.label}>Credit Period (Days)</Text>
            <TextInput style={[acd.input, creditFocused && acd.inputFocused, webFix]} placeholder="Enter credit period" placeholderTextColor={COLORS.textTertiary} value={creditDays} onChangeText={setCreditDays} keyboardType="numeric" onFocus={() => setCreditFocused(true)} onBlur={() => setCreditFocused(false)} />
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
                  <View style={{ flex: 1 }}><Text style={acd.label}>Pincode</Text><TextInput style={[acd.input, webFix]} placeholder="Pincode" placeholderTextColor={COLORS.textTertiary} value={pincode} onChangeText={setPincode} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Text style={acd.label}>Country</Text><TextInput style={[acd.input, webFix]} value={country} onChangeText={setCountry} placeholderTextColor={COLORS.textTertiary} /></View>
                </View>
              </View>
            )}
            <View style={acd.toggleRow}>
              <Text style={acd.toggleLbl}>Provide Bank Details</Text>
              <BrandSwitch value={bank} onValueChange={setBank} />
            </View>
            {bank && (
              <View style={acd.expandSection}>
                <Text style={acd.label}>Beneficiary Name</Text><TextInput style={[acd.input, webFix]} placeholder="Enter beneficiary name" placeholderTextColor={COLORS.textTertiary} value={beneficiaryName} onChangeText={setBeneficiaryName} />
                <Text style={acd.label}>Bank Name</Text><TextInput style={[acd.input, webFix]} placeholder="Enter bank name" placeholderTextColor={COLORS.textTertiary} value={bankName} onChangeText={setBankName} />
                <Text style={acd.label}>Account Number</Text><TextInput style={[acd.input, webFix]} placeholder="Enter account number" placeholderTextColor={COLORS.textTertiary} value={accountNo} onChangeText={setAccountNo} keyboardType="numeric" />
                <Text style={acd.label}>IFSC Code</Text><TextInput style={[acd.input, webFix]} placeholder="Enter IFSC code" placeholderTextColor={COLORS.textTertiary} value={ifscCode} onChangeText={v => setIfscCode(v.toUpperCase())} autoCapitalize="characters" />
                <Text style={acd.label}>Bank Branch</Text><TextInput style={[acd.input, webFix]} placeholder="Enter branch name" placeholderTextColor={COLORS.textTertiary} value={bankBranch} onChangeText={setBankBranch} />
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
          <TouchableOpacity style={[acd.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
            {saving && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />}
            <Text style={acd.saveBtnTxt}>{saving ? 'Saving...' : 'Save Customer'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── TaxEntryRow ─────────────────────────────────────────────────────────────
function TaxEntryRow({ entry, taxLedgers, onUpdate, onRemove, taxable }: {
  entry: TaxLedgerEntry;
  taxLedgers: { name: string }[];
  onUpdate: (field: keyof TaxLedgerEntry, val: string) => void;
  onRemove: () => void;
  taxable: number;
}) {
  const taxOpts: BSSOption[] = taxLedgers.map(l => ({ label: l.name, value: l.name }));
  return (
    <View style={ir.taxEntryRow}>
      <View style={{ flex: 1 }}>
        <BottomSheetSearch
          compact
          options={taxOpts}
          value={entry.ledgerName}
          onSelect={opt => onUpdate('ledgerName', opt.value)}
          onClear={() => onUpdate('ledgerName', '')}
          placeholder="Select ledger..."
          sheetTitle="Tax Ledger"
        />
      </View>
      <TextInput
        style={ir.taxRateInput}
        value={entry.taxRate}
        onChangeText={v => {
          onUpdate('taxRate', v);
          const auto = (taxable * (parseFloat(v) || 0) / 100).toFixed(2);
          onUpdate('taxAmount', auto);
        }}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={COLORS.textTertiary}
      />
      <Text style={ir.taxRateSign}>%</Text>
      <TextInput
        style={ir.taxAmtInput}
        value={entry.taxAmount}
        onChangeText={v => onUpdate('taxAmount', v)}
        keyboardType="numeric"
        placeholder="0.00"
        placeholderTextColor={COLORS.textTertiary}
      />
      <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close-circle" size={16} color={COLORS.negative} />
      </TouchableOpacity>
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
  item: InvoiceItem;
  stockItems: StockItem[];
  warehouses: Warehouse[];
  taxLedgers: { name: string }[];
  godowns: Godown[];
  onProductSelect: (itemId: string, opt: BSSOption) => void;
  onProductClear: (itemId: string) => void;
  onUpdate: (id: string, field: keyof InvoiceItem, val: string) => void;
  onRemove: (id: string) => void;
  onOpenModal: (s: ModalState) => void;
  onBarcodePress: (itemId: string) => void;
  onAddTaxEntry: (itemId: string) => void;
  onUpdateTaxEntry: (itemId: string, entryId: string, field: keyof TaxLedgerEntry, val: string) => void;
  onRemoveTaxEntry: (itemId: string, entryId: string) => void;
  itemIndex: number;
  canRemove: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const calc = calcItem(item);

  const stockOpts: BSSOption[] = stockItems.map(si => ({
    label: si.displayName || si.name,
    value: si.name,
    subtitle: `${si.closing_qty ?? 0} ${si.unit || 'pcs'}`,
  }));

  const stockItem = stockItems.find(si => si.name === item.product);
  const productLabel = stockItem ? (stockItem.displayName || stockItem.name) : '';
  const headerLabel = productLabel || `Item ${itemIndex + 1}`;

  // Warehouse options: use per-item godowns if available, else global warehouses
  const warehouseOpts: BSSOption[] = godowns.length > 0
    ? godowns.map(g => ({ label: g.name, value: g.name, subtitle: `Stock: ${Math.round(g.qty)} units` }))
    : warehouses.map(w => ({ label: w.name, value: w.name }));
  const needsWarehouseDropdown = warehouseOpts.length > 1;
  const singleWarehouseName = warehouseOpts.length === 1 ? warehouseOpts[0].label : null;

  return (
    <View style={ir.card}>
      {/* Always-visible header row */}
      <TouchableOpacity style={ir.rowHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Ionicons name="cube-outline" size={14} color={item.product ? COLORS.brandPrimary : COLORS.textSecondary} />
        <Text style={[ir.rowHeaderTxt, item.product ? ir.rowHeaderTxtActive : undefined]} numberOfLines={1}>
          {headerLabel}
        </Text>
        {item.product && calc.subtotal > 0 && (
          <Text style={ir.rowHeaderAmt}>₹{calc.subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
        )}
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {expanded && (
        <View style={ir.expandedContent}>
          {/* Product / Service */}
          <View>
            <Text style={ir.fieldLabel}>Product / Service <Text style={ir.star}>*</Text></Text>
            <View style={ir.productRow}>
              <View style={{ flex: 1 }}>
                <BottomSheetSearch
                  placeholder="Select product..."
                  options={stockOpts}
                  value={item.product}
                  onSelect={opt => onProductSelect(item.id, opt)}
                  onClear={() => onProductClear(item.id)}
                  sheetTitle="Product / Service"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <TouchableOpacity style={ir.barcodeBtn} onPress={() => onBarcodePress(item.id)} activeOpacity={0.7}>
                <Ionicons name="barcode-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Warehouse — only shown when product is selected */}
          {item.product ? (
            needsWarehouseDropdown ? (
              <View>
                <Text style={ir.fieldLabel}>Warehouse <Text style={ir.star}>*</Text></Text>
                <BottomSheetSearch
                  placeholder="Select warehouse..."
                  options={warehouseOpts}
                  value={item.warehouse}
                  onSelect={opt => onUpdate(item.id, 'warehouse', opt.value)}
                  onClear={() => onUpdate(item.id, 'warehouse', '')}
                  sheetTitle="Warehouse"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            ) : singleWarehouseName ? (
              <View style={ir.warehouseChip}>
                <Ionicons name="business-outline" size={11} color={COLORS.info} />
                <Text style={ir.warehouseChipTxt}>{singleWarehouseName}</Text>
              </View>
            ) : null
          ) : null}

          {/* Qty + Unit + Rate */}
          <View style={ir.fieldRow}>
            <View style={ir.qtyBox}>
              <Text style={ir.miniLabel}>Qty</Text>
              <TextInput style={ir.miniInput} value={item.qty} onChangeText={v => onUpdate(item.id, 'qty', v)} keyboardType="numeric" placeholder="1" placeholderTextColor={COLORS.textTertiary} />
            </View>
            <TouchableOpacity style={ir.unitBtn} onPress={() => onOpenModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
              <Text style={ir.unitTxt}>{item.unit || 'pcs'}</Text>
              <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <View style={ir.rateBox}>
              <Text style={ir.miniLabel}>Rate (₹)</Text>
              <TextInput style={ir.miniInput} value={item.rate} onChangeText={v => onUpdate(item.id, 'rate', v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
            </View>
          </View>

          {/* Discount */}
          <View style={ir.fieldRow}>
            <View style={ir.discRow}>
              <TouchableOpacity style={ir.discTypeBtn} onPress={() => onUpdate(item.id, 'discountType', item.discountType === '%' ? 'flat' : '%')} activeOpacity={0.7}>
                <Text style={ir.discTypeTxt}>{item.discountType}</Text>
              </TouchableOpacity>
              <TextInput style={ir.discInput} value={item.discount} onChangeText={v => onUpdate(item.id, 'discount', v)} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textTertiary} />
              <Text style={ir.discLabel}>Disc</Text>
            </View>
          </View>

          {/* Taxable Amount */}
          <View style={ir.taxableRow}>
            <Text style={ir.taxableLabel}>Taxable Amount</Text>
            <Text style={ir.taxableVal}>₹{calc.taxable.toFixed(2)}</Text>
          </View>

          {/* Tax Section */}
          <View style={ir.taxSection}>
            <View style={ir.taxSectionHdr}>
              <Ionicons name="receipt-outline" size={13} color={COLORS.textSecondary} />
              <Text style={ir.taxSectionTitle}>Taxes</Text>
              <Text style={ir.taxColHint}>Type · Rate% · Amt ₹</Text>
              <TouchableOpacity style={ir.addTaxBtn} onPress={() => onAddTaxEntry(item.id)} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={13} color={COLORS.brandPrimary} />
                <Text style={ir.addTaxTxt}>Add Tax</Text>
              </TouchableOpacity>
            </View>
            {item.taxEntries.length === 0 ? (
              <View style={ir.noTaxPlaceholder}>
                <Text style={ir.noTaxTxt}>No tax — tap Add to attach ledger</Text>
              </View>
            ) : (
              item.taxEntries.map(te => (
                <TaxEntryRow
                  key={te.id}
                  entry={te}
                  taxLedgers={taxLedgers}
                  taxable={calc.taxable}
                  onUpdate={(field, val) => onUpdateTaxEntry(item.id, te.id, field, val)}
                  onRemove={() => onRemoveTaxEntry(item.id, te.id)}
                />
              ))
            )}
          </View>

          {/* Item Total */}
          <View style={ir.subtotalRow}>
            <Text style={ir.subtotalLabel}>Item Total</Text>
            <Text style={ir.subtotalVal}>₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          {canRemove && (
            <TouchableOpacity style={ir.removeItemBtn} onPress={() => onRemove(item.id)} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={14} color={COLORS.negative} />
              <Text style={ir.removeItemTxt}>Remove Item</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateSalesInvoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  // ── Core state ───────────────────────────────────────────────────────────────
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [ledger, setLedger] = useState('');
  const [invoiceNo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [party, setParty] = useState('');
  const [parties, setParties] = useState<BSSOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // API data
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [salesLedgers, setSalesLedgers] = useState<{ name: string; guid?: string }[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<{ name: string }[]>([]);
  const [chargeLedgers, setChargeLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);
  const [roundOffLedgers, setRoundOffLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);

  // Per-item godowns (fetched when product selected)
  const [itemGodowns, setItemGodowns] = useState<Record<string, Godown[]>>({});

  // Compliance state
  const [ewbRequired, setEwbRequired] = useState(false);
  const [ewbApplicable, setEwbApplicable] = useState(false);
  const [eInvoiceApplicable, setEInvoiceApplicable] = useState(false);

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [payTerms, setPayTerms] = useState('due_on_receipt');
  const [customDays, setCustomDays] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [refNo, setRefNo] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [roundOffLedger, setRoundOffLedger] = useState('');
  const [roundOffAmount, setRoundOffAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [termsText, setTermsText] = useState('Goods once sold will not be taken back.');
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payTermsExpanded, setPayTermsExpanded] = useState(false);

  // Dispatch
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchFrom, setDispatchFrom] = useState('');
  const [shipTo, setShipTo] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [transportMode, setTransportMode] = useState('Road');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Regular');
  const [transportDocNo, setTransportDocNo] = useState('');
  const [transportDocDate, setTransportDocDate] = useState('');
  const [showTransportDocDatePicker, setShowTransportDocDatePicker] = useState(false);

  // Collect Payment
  const [collectPayNow, setCollectPayNow] = useState(false);
  const [payNowMode, setPayNowMode] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [payNowRef, setPayNowRef] = useState('');

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ tdkRef: string; isQueued: boolean; message: string } | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    getParties(company.guid).then((res: any) => {
      const list = res?.data || [];
      if (list.length > 0) setParties(list.map((p: any) => ({ label: p.name, value: p.name })));
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
      if (list.length === 1) setItems(prev => prev.map(i => ({ ...i, warehouse: list[0].name })));
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

  useEffect(() => {
    if (!company?.guid) return;
    getChargeLedgers(company.guid).then((res: any) => {
      const d = res?.data;
      if (d) {
        // Exclude round-off from logistics dropdown — round-off is a separate line
        setChargeLedgers([...(d.logisticsCharges || []), ...(d.additionalCharges || [])]);
        setRoundOffLedgers(d.roundOffLedgers || []);
      }
    }).catch(() => {});
  }, [company?.guid]);

  useEffect(() => {
    if (!company?.guid) return;
    getComplianceConfig(company.guid).then((res: any) => {
      const cfg = res?.data || res;
      if (cfg?.e_way_bill_applicable === 'applicable_configured') {
        setShowDispatch(true);
        setEwbRequired(true);
        setEwbApplicable(true);
      }
      if (cfg?.e_invoice_applicable === 'applicable_configured') {
        setEInvoiceApplicable(true);
      }
    }).catch(() => {});
  }, [company?.guid]);

  const routeParams = useLocalSearchParams<{ party?: string; fromQuotation?: string }>();
  useEffect(() => {
    if (routeParams?.party) setParty(routeParams.party as string);
    if (routeParams?.fromQuotation) setRefNo(routeParams.fromQuotation as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Due date auto-calc
  useEffect(() => {
    const days = payTerms === '15d' ? 15 : payTerms === '30d' ? 30 :
      payTerms === 'due_on_receipt' ? 0 : payTerms === 'custom' ? (parseInt(customDays) || 0) : 0;
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

  // ── Item actions ─────────────────────────────────────────────────────────────
  const updateItem = useCallback((id: string, field: keyof InvoiceItem, val: string) => {
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

  // Product selection: update item + fetch per-item godowns
  const handleProductSelect = useCallback(async (itemId: string, opt: BSSOption) => {
    const si = stockItems.find(s => s.name === opt.value);
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      product: opt.value,
      unit: si?.unit || i.unit,
      rate: si?.rate != null ? String(si.rate) : i.rate,
      warehouse: '',
    } : i));
    if (!si || !company?.guid) {
      if (warehouses.length === 1) updateItem(itemId, 'warehouse', warehouses[0].name);
      return;
    }
    try {
      const res: any = await getStockGodowns(company.guid, String(si.id));
      const godownList: Godown[] = res?.data?.warehouses || [];
      setItemGodowns(prev => ({ ...prev, [itemId]: godownList }));
      if (godownList.length === 1) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, warehouse: godownList[0].name } : i));
      } else if (godownList.length === 0 && warehouses.length === 1) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, warehouse: warehouses[0].name } : i));
      }
    } catch {
      if (warehouses.length === 1) updateItem(itemId, 'warehouse', warehouses[0].name);
    }
  }, [stockItems, company?.guid, warehouses, updateItem]);

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
    if (step === 1) {
      if (!ledger) { Toast.show({ type: 'error', text1: 'Sales Ledger required' }); return; }
      if (!party) { Toast.show({ type: 'error', text1: 'Customer / Party required' }); return; }
      setStep(2);
    } else if (step === 2) {
      const filledItems = items.filter(i => i.product && (parseFloat(i.qty) || 0) > 0 && (parseFloat(i.rate) || 0) > 0);
      if (filledItems.length === 0) {
        Toast.show({ type: 'error', text1: 'Add at least 1 item with qty and rate' }); return;
      }
      if (items.some(i => i.product && (!(parseFloat(i.qty) > 0) || !(parseFloat(i.rate) > 0)))) {
        Toast.show({ type: 'error', text1: 'All items need qty and rate' }); return;
      }
      const multiWarehouseItems = items.filter(i => i.product && (itemGodowns[i.id]?.length || 0) > 1);
      if (multiWarehouseItems.some(i => !i.warehouse)) {
        Toast.show({ type: 'error', text1: 'Select warehouse for all items' }); return;
      }
      setStep(3);
    }
  }, [step, ledger, party, items, itemGodowns]);

  const goBack = useCallback(() => {
    setStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3);
  }, []);

  const closeModal = useCallback(() => setActiveModal(null), []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const logisticsTotal = useMemo(
    () => calcLogisticsTotal(logEntries, parseFloat(roundOffAmount) || 0),
    [logEntries, roundOffAmount]
  );

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

  const paymentStatus = useMemo(() => {
    if (!collectPayNow) return 'pending';
    const paidAmt = parseFloat(payNowAmount) || 0;
    if (paidAmt <= 0) return 'pending';
    if (paidAmt >= totals.grand) return 'paid';
    return 'partial';
  }, [collectPayNow, payNowAmount, totals.grand]);

  const unitOptions = useMemo(() => {
    const units = [...new Set(stockItems.map(i => i.unit).filter(Boolean))] as string[];
    return units.length > 0 ? units : ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
  }, [stockItems]);

  // Section header summary
  const itemsSummary = useMemo(() => {
    const filled = items.filter(i => i.product);
    if (filled.length === 0) return `${items.length} item${items.length !== 1 ? 's' : ''} (not filled)`;
    const first = stockItems.find(si => si.name === filled[0].product);
    const firstName = first?.displayName || filled[0].product;
    if (filled.length === 1) return firstName;
    return `${firstName} + ${filled.length - 1} more`;
  }, [items, stockItems]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!party) { Toast.show({ type: 'error', text1: 'Customer required' }); return; }
    if (items.some(i => !i.product)) { Toast.show({ type: 'error', text1: 'All items need a product selected' }); return; }
    const multiWarehouseItems = items.filter(i => i.product && (itemGodowns[i.id]?.length || 0) > 1);
    if (multiWarehouseItems.some(i => !i.warehouse)) { Toast.show({ type: 'error', text1: 'Warehouse required for all items' }); return; }
    if (ewbRequired && showDispatch) {
      if (!dispatchFrom || !shipTo) {
        Toast.show({ type: 'error', text1: 'Dispatch details required', text2: 'Dispatch From and Ship To are mandatory for E-Way Bill' });
        return;
      }
    }

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

      const result: any = await createSalesInvoice({
        companyGuid: company?.guid, companyName: company?.name,
        partyLedger: party, date: dmyToISO(date),
        salesLedger: ledger, isOptional: entryType === 'optional',
        original_entry_type: entryType, voucherType: 'Sales',
        totalAmount: totals.grand, reference: refNo || undefined,
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
        collect_payment: collectPayNow ? {
          mode: payNowMode, amount: parseFloat(payNowAmount) || 0, reference: payNowRef || undefined,
        } : undefined,
        dispatch_details: showDispatch ? {
          dispatch_from: dispatchFrom, ship_to: shipTo,
          transport_mode: transportMode,
          transporter_name: transporterName || undefined, transporter_id: transporterId || undefined,
          vehicle_number: vehicleNumber || undefined, vehicle_type: vehicleType,
          transport_doc_no: transportDocNo || undefined, transport_doc_date: transportDocDate || undefined,
        } : undefined,
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
  }, [
    party, items, itemGodowns, ewbRequired, showDispatch, dispatchFrom, shipTo,
    company, date, ledger, entryType, totals.grand, refNo, narration, warehouses,
    collectPayNow, payNowMode, payNowAmount, payNowRef, logEntries, roundOffLedger, roundOffAmount,
    transportMode, transporterName, transporterId, vehicleNumber, vehicleType, transportDocNo, transportDocDate,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────────
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
            <Text style={ss.title}>{submitResult.isQueued ? 'Saved. Pending Sync' : 'Invoice Submitted!'}</Text>
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
            {/* Preview */}
            <TouchableOpacity style={ss.previewBtn} activeOpacity={0.85} onPress={() => Toast.show({ type: 'info', text1: 'Invoice preview coming soon' })}>
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>Preview Invoice</Text>
            </TouchableOpacity>
            {/* Share PDF */}
            <TouchableOpacity style={ss.pdfBtn} activeOpacity={0.85} onPress={() => Toast.show({ type: 'info', text1: 'PDF sharing coming soon' })}>
              <Ionicons name="document-outline" size={18} color={COLORS.white} />
              <Text style={ss.pdfBtnTxt}>Share PDF</Text>
            </TouchableOpacity>
            {/* Share WhatsApp */}
            <TouchableOpacity style={ss.waBtn} activeOpacity={0.85} onPress={() => Toast.show({ type: 'info', text1: 'WhatsApp sharing coming soon' })}>
              <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} />
              <Text style={ss.waBtnTxt}>Share on WhatsApp</Text>
            </TouchableOpacity>
            {/* Generate IRN */}
            {eInvoiceApplicable && (
              <TouchableOpacity style={ss.irnBtn} activeOpacity={0.85} onPress={() => Toast.show({ type: 'info', text1: 'IRN generation coming soon' })}>
                <Ionicons name="qr-code-outline" size={18} color={COLORS.white} />
                <Text style={ss.irnBtnTxt}>Generate IRN (E-Invoice)</Text>
              </TouchableOpacity>
            )}
            {/* Generate EWB */}
            {ewbApplicable && (
              <TouchableOpacity style={ss.ewbBtn} activeOpacity={0.85} onPress={() => Toast.show({ type: 'info', text1: 'E-Way Bill generation coming soon' })}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
                <Text style={ss.ewbBtnTxt}>Generate E-Way Bill</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={ss.doneBtn} activeOpacity={0.85} onPress={() => { setShowSuccess(false); router.back(); }}>
              <Text style={ss.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? () => router.back() : goBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Create Sales Invoice</Text>
          <Text style={s.headerSub}>{invoiceNo || 'INV-Auto'}</Text>
        </View>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <StepIndicator step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ═══════════ STEP 1 ═══════════ */}
          {step === 1 && (
            <>
              <BottomSheetSearch
                label="Sales Ledger" required
                placeholder="Search ledger account..."
                options={salesLedgers.map(l => ({ label: l.name, value: l.name }))}
                value={ledger}
                onSelect={opt => setLedger(opt.value)}
                onClear={() => setLedger('')}
                sheetTitle="Sales Ledger"
                icon="book-outline"
              />
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
                        <Text style={{ color: date ? COLORS.textPrimary : COLORS.textTertiary }}>{date || 'Select date'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
              <BottomSheetSearch
                label="Customer / Party" required
                placeholder="Search customer..."
                options={parties}
                value={party}
                onSelect={opt => setParty(opt.value)}
                onClear={() => setParty('')}
                onAddNew={() => setShowAddCustomer(true)}
                addNewLabel="Add New Customer"
                sheetTitle="Customer / Party"
                icon="person-outline"
              />
            </>
          )}

          {/* ═══════════ STEP 2 ═══════════ */}
          {step === 2 && (
            <>
              <View style={s.sectionHdr}>
                <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
                <Text style={s.sectionTitle}>Items & Services</Text>
                <View style={s.itemCount}><Text style={s.itemCountTxt}>{items.length}</Text></View>
                <Text style={s.sectionSummary} numberOfLines={1}>{itemsSummary}</Text>
              </View>

              {items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  itemIndex={idx}
                  canRemove={items.length > 1}
                  godowns={itemGodowns[item.id] || []}
                  onProductSelect={handleProductSelect}
                  onProductClear={handleProductClear}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                  onOpenModal={setActiveModal}
                  onBarcodePress={(itemId) => {
                    barcodePicker.set((result) => {
                      const si = stockItems.find(s2 => s2.name === result.productName);
                      setItems(prev => prev.map(i => {
                        if (i.id !== itemId) return i;
                        return { ...i, product: result.productName, unit: result.unit || si?.unit || i.unit, rate: si?.rate != null ? String(si.rate) : i.rate };
                      }));
                    });
                    router.push(`/sales/product-scanner?companyGuid=${company?.guid}` as any);
                  }}
                  onAddTaxEntry={addTaxEntry}
                  onUpdateTaxEntry={updateTaxEntry}
                  onRemoveTaxEntry={removeTaxEntry}
                  stockItems={stockItems}
                  taxLedgers={taxLedgers}
                  warehouses={warehouses}
                />
              ))}

              <TouchableOpacity style={s.addItemBtn} onPress={addItem} activeOpacity={0.7}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
                <Text style={s.addItemTxt}>+ Add Item / Service</Text>
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

              {/* Running total — always visible at bottom of Step 2 */}
              <View style={s.runningTotalCard}>
                <Text style={s.runTotalTitle}>Running Total</Text>
                <View style={s.runTotalRow}>
                  <Text style={s.runTotalLabel}>Items Subtotal</Text>
                  <Text style={s.runTotalVal}>₹{totals.gross.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                </View>
                {totals.discTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={[s.runTotalLabel, { color: COLORS.positive }]}>Discount</Text>
                    <Text style={[s.runTotalVal, { color: COLORS.positive }]}>-₹{totals.discTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.taxTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>Tax</Text>
                    <Text style={s.runTotalVal}>₹{totals.taxTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.logisticsTotal > 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>Charges</Text>
                    <Text style={s.runTotalVal}>₹{totals.logisticsTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                  </View>
                )}
                {totals.roundOff !== 0 && (
                  <View style={s.runTotalRow}>
                    <Text style={s.runTotalLabel}>Round Off</Text>
                    <Text style={s.runTotalVal}>₹{totals.roundOff.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
                  </View>
                )}
                <View style={[s.runTotalRow, s.runTotalGrandRow]}>
                  <Text style={s.runTotalGrandLabel}>Grand Total</Text>
                  <Text style={s.runTotalGrandVal}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </>
          )}

          {/* ═══════════ STEP 3 ═══════════ */}
          {step === 3 && (
            <>
              {/* 1. Collect Payment Now */}
              <View style={s.card}>
                <TouchableOpacity style={s.payNowToggleRow} onPress={() => setCollectPayNow(v => !v)} activeOpacity={0.8}>
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
                    <FormDropdown label="Mode of Payment" value={payNowMode} options={PAY_MODES} onSelect={(o: any) => setPayNowMode(o.value)} placeholder="Select payment mode..." required />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Amount Received (₹)</Text>
                        <TextInput style={s.fInput} value={payNowAmount} onChangeText={setPayNowAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Reference No.</Text>
                        <TextInput style={s.fInput} value={payNowRef} onChangeText={setPayNowRef} placeholder="Txn / Cheque No." placeholderTextColor={COLORS.textTertiary} />
                      </View>
                    </View>
                    <View style={[s.payStatusChip, paymentStatus === 'paid' ? s.payStatusPaid : paymentStatus === 'partial' ? s.payStatusPartial : s.payStatusPending]}>
                      <Ionicons name={paymentStatus === 'paid' ? 'checkmark-circle' : paymentStatus === 'partial' ? 'time-outline' : 'alert-circle-outline'} size={16} color={paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative} />
                      <Text style={[s.payStatusTxt, { color: paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative }]}>
                        {paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? 'Partially Paid' : 'Payment Pending'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {/* 2. Dispatch / EWB */}
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
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Dispatch From</Text><ThemedFInput value={dispatchFrom} onChangeText={setDispatchFrom} placeholder="City / Address" /></View>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Ship To</Text><ThemedFInput value={shipTo} onChangeText={setShipTo} placeholder="City / Address" /></View>
                    </View>
                    <Text style={s.fLabel}>Transport Mode</Text>
                    <View style={s.termsRow}>
                      {['Road', 'Rail', 'Air', 'Ship', 'Not Applicable'].map(mode => (
                        <TouchableOpacity key={mode} style={[s.termChip, transportMode === mode && s.termChipActive]} onPress={() => setTransportMode(mode)} activeOpacity={0.7}>
                          <Text style={[s.termChipTxt, transportMode === mode && s.termChipTxtActive]}>{mode}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Transporter Name</Text><ThemedFInput value={transporterName} onChangeText={setTransporterName} placeholder="Optional" /></View>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Transporter ID</Text><ThemedFInput value={transporterId} onChangeText={setTransporterId} placeholder="GSTIN / ID" /></View>
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Vehicle Number</Text><ThemedFInput value={vehicleNumber} onChangeText={v => setVehicleNumber(v.toUpperCase())} placeholder="e.g. MH12AB1234" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Vehicle Type</Text>
                        <View style={s.termsRow}>
                          {['Regular', 'Over Dimensional', 'Not Applicable'].map(vt => (
                            <TouchableOpacity key={vt} style={[s.termChip, vehicleType === vt && s.termChipActive]} onPress={() => setVehicleType(vt)} activeOpacity={0.7}>
                              <Text style={[s.termChipTxt, vehicleType === vt && s.termChipTxtActive]}>{vt.split(' ')[0]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Doc / LR / RR No.</Text><ThemedFInput value={transportDocNo} onChangeText={setTransportDocNo} placeholder="Optional" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Doc Date</Text>
                        <TouchableOpacity style={[s.fInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setShowTransportDocDatePicker(true)}>
                          <Text style={{ color: transportDocDate ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.base }}>
                            {transportDocDate ? (() => { const [y, m, d] = transportDocDate.split('-'); return `${d}/${m}/${y.slice(2)}`; })() : 'Optional'}
                          </Text>
                          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* 3. Payment Terms collapsible */}
              <View style={s.card}>
                <TouchableOpacity style={s.payNowToggleRow} onPress={() => setPayTermsExpanded(v => !v)} activeOpacity={0.8}>
                  <View style={s.payNowLeft}>
                    <View style={[s.payNowIcon, { backgroundColor: COLORS.pageBg }]}>
                      <Ionicons name="calendar-outline" size={18} color={payTermsExpanded ? COLORS.brandPrimary : COLORS.textSecondary} />
                    </View>
                    <View>
                      <Text style={s.payNowTitle}>Payment Terms</Text>
                      {dueDate ? <Text style={s.dueDateDisplay}>{formatDueDisplay(dueDate)}</Text> : null}
                    </View>
                  </View>
                  <Ionicons name={payTermsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {payTermsExpanded && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    <View style={s.termsRow}>
                      {TERMS.map(t => (
                        <TouchableOpacity key={t.value} style={[s.termChip, payTerms === t.value && s.termChipActive]} onPress={() => setPayTerms(t.value)} activeOpacity={0.7}>
                          <Text style={[s.termChipTxt, payTerms === t.value && s.termChipTxtActive]}>{t.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {payTerms === 'custom' && (
                      <View style={s.customDaysRow}>
                        <ThemedFInput style={{ flex: 1 }} value={customDays} onChangeText={setCustomDays} keyboardType="numeric" placeholder="Enter number of days" />
                        <View style={s.daysBadge}><Text style={s.daysBadgeTxt}>Days</Text></View>
                      </View>
                    )}
                    {dueDate ? (
                      <View style={s.dueDateChip}>
                        <Ionicons name="calendar-outline" size={13} color={COLORS.info} />
                        <Text style={s.dueDateChipTxt}>{formatDueDisplay(dueDate)}</Text>
                      </View>
                    ) : null}
                    <View style={[s.row2, { marginTop: SPACING.sm }]}>
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
                )}
              </View>

              {/* 4. Invoice Summary */}
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>Invoice Summary</Text>
                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>Subtotal (Gross)</Text>
                  <Text style={s.sumVal}>₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
                {totals.discTotal > 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>Discount</Text>
                    <Text style={[s.sumVal, { color: COLORS.positive }]}>-₹{totals.discTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {totals.taxTotal > 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>Tax</Text>
                    <Text style={s.sumVal}>₹{totals.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {totals.logisticsTotal > 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>Logistics & Charges</Text>
                    <Text style={s.sumVal}>₹{totals.logisticsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {totals.roundOff !== 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>Round Off</Text>
                    <Text style={s.sumVal}>₹{totals.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                <View style={s.sumDivider} />
                <View style={s.summaryRow}>
                  <Text style={s.grandLabel}>Grand Total</Text>
                  <Text style={s.grandVal}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* 5. Notes & Terms */}
              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>Notes & Terms</Text>
                </View>
                <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Internal notes..." multiline numberOfLines={2} style={{ minHeight: 60, textAlignVertical: 'top' } as any} />
                <FormField label="Terms & Conditions" value={termsText} onChangeText={setTermsText} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' } as any} containerStyle={{ marginBottom: 0 }} />
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 1 && (
            <TouchableOpacity style={s.fullNextBtn} onPress={goNext} activeOpacity={0.7}>
              <Text style={s.nextBtnTxt}>Next: Add Items →</Text>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <>
              <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                <Text style={s.backOutlineTxt}>← Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.nextBtn} onPress={goNext} activeOpacity={0.7}>
                <Text style={s.nextBtnTxt}>Next: Review →</Text>
              </TouchableOpacity>
            </>
          )}
          {step === 3 && (
            <>
              <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                <Text style={s.backOutlineTxt}>← Items</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} activeOpacity={0.7} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />}
                <Text style={s.submitTxt}>{submitting ? 'Submitting...' : '✓ Submit Invoice'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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

      <DatePickerModal visible={showDatePicker} value={date} minDate={fyStart} maxDate={new Date().toISOString().slice(0, 10)} onSelect={(d) => { setDate(d); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} />
      <DatePickerModal visible={showTransportDocDatePicker} value={transportDocDate || new Date().toISOString().slice(0, 10)} maxDate={new Date().toISOString().slice(0, 10)} onSelect={(d) => { setTransportDocDate(d); setShowTransportDocDatePicker(false); }} onClose={() => setShowTransportDocDatePicker(false)} />

      <AddCustomerDrawer
        visible={showAddCustomer}
        company={company}
        onClose={() => setShowAddCustomer(false)}
        onSaved={(name, success) => {
          const newOpt: BSSOption = { label: name, value: name };
          setParties(prev => [...prev, newOpt]);
          setParty(name);
          setShowAddCustomer(false);
          if (success !== false) Alert.alert('✓ Customer Added', `"${name}" has been added and selected.`);
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
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
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
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2, marginBottom: SPACING.sm },
  termChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  termChipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  termChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  termChipTxtActive: { color: COLORS.white },
  customDaysRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: SPACING.sm },
  daysBadge: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderLeftWidth: 0, borderColor: COLORS.borderDefault, borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  daysBadgeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  dueDateDisplay: { fontSize: TYPOGRAPHY.xs, color: COLORS.info, marginTop: 2, fontWeight: '600' },
  dueDateChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 8, borderWidth: 1, borderColor: COLORS.info + '40' },
  dueDateChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  sectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionSummary: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontStyle: 'italic' },
  itemCount: { backgroundColor: COLORS.brandPrimary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  itemCountTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#fff' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.positive + '40', borderStyle: 'dashed' },
  addItemTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  // Running total card
  runningTotalCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1.5, borderColor: COLORS.brandPrimary + '30' },
  runTotalTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  runTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  runTotalLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  runTotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  runTotalGrandRow: { paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginBottom: 0 },
  runTotalGrandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  runTotalGrandVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.brandPrimary },
  summaryCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  summaryTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sumLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sumDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: 12 },
  grandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  grandVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.brandPrimary },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  fullNextBtn: { flex: 1, paddingVertical: 16, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 2, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  nextBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  backOutlineBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  backOutlineTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 8 },
  payNowToggleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingVertical: 12, paddingHorizontal: SPACING.md },
  payNowLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, flex: 1 },
  payNowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center' as const, justifyContent: 'center' as const },
  payNowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600' as const, color: COLORS.textPrimary },
  payNowSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  payNowBody: { paddingHorizontal: SPACING.md, paddingBottom: 12, gap: 10 },
  payStatusChip: { flexDirection: 'row' as const, gap: 8, paddingVertical: 8 },
  payStatusPaid: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.positiveBg, borderWidth: 1, borderColor: COLORS.positive },
  payStatusPartial: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.warningBg, borderWidth: 1, borderColor: COLORS.warning },
  payStatusPending: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  payStatusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' as const, color: COLORS.textSecondary },
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
  barcodeBtn: { width: 44, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  warehouseChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.info + '40' },
  warehouseChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.info },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBox: { width: 64 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 3 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 6, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right' },
  unitBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'flex-end' },
  unitTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  discRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  discTypeBtn: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7 },
  discTypeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  discInput: { width: 44, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 6, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center' },
  discLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  taxableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7 },
  taxableLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  taxableVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  taxSection: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8, gap: 6 },
  taxSectionHdr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taxSectionTitle: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  taxColHint: { fontSize: 10, color: COLORS.textTertiary, fontStyle: 'italic' },
  addTaxBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.brandPrimary },
  addTaxTxt: { fontSize: 10, fontWeight: '700', color: COLORS.brandPrimary },
  noTaxPlaceholder: { paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  noTaxTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  taxEntryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingVertical: 4, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.borderDefault },
  taxRateInput: { width: 44, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 4, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, paddingVertical: 5, textAlign: 'right' },
  taxRateSign: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  taxAmtInput: { width: 60, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 4, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, paddingVertical: 5, textAlign: 'right' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  subtotalLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  removeItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.negative + '50', backgroundColor: COLORS.negativeBg },
  removeItemTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.negative },
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

const si = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: SPACING.lg, paddingVertical: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center' },
  circleActive: { borderColor: COLORS.brandPrimary },
  circleDone: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.brandPrimary },
  circleNum: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' as const, color: COLORS.textTertiary },
  circleNumActive: { color: COLORS.brandPrimary },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' as const, color: COLORS.textTertiary },
  labelActive: { color: COLORS.brandPrimary },
  line: { flex: 1, height: 2, backgroundColor: COLORS.borderDefault, marginBottom: 18, marginHorizontal: 6 },
  lineDone: { backgroundColor: COLORS.brandPrimary },
});

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
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
  waBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  waBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  irnBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.info, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  irnBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  ewbBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.warning, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  ewbBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  doneBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});
