import React, { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Pressable,
  Platform, Alert, TextInput, Modal, TextInputProps, ActivityIndicator, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import {
  getParties, createSalesInvoice, createProformaInvoice, convertProformaInvoice, getStocks, getWarehouses,
  getSalesLedgerAccounts, getTaxLedgers, createTallyParty, lookupBarcode,
  getComplianceConfig, getChargeLedgers, getStockGodowns, getBankLedgers,
  invoiceSharePdf, getCompanyProfile,
} from '../../src/services/api';
import {
  proformaPrefillStorageKey,
  buildProformaToInvoicePrefillFromForm,
} from '../../src/utils/proformaToInvoicePrefill';
import { toVoucherDocument } from '../../src/utils/voucherDocumentAdapter';
import { shareVoucherPdf } from '../../src/utils/voucherPdf';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import PartyForm, { PartyFormRef } from '../../src/components/forms/PartyForm';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import DatePickerModal, { formatDMY, parseDMY } from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { taxFieldsFromLedgerSelect, resolveTaxLedgerRate } from '../../src/utils/taxLedgerHelpers';
import { INDIAN_STATES } from '../../src/constants/indianStates';
import { getCitiesForState } from '../../src/constants/indianCities';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';

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

// Transport Mode — per EWB/GST spec
const TRANSPORT_MODES: DropdownOption[] = [
  { label: 'Road', value: 'Road' },
  { label: 'Rail', value: 'Rail' },
  { label: 'Air', value: 'Air' },
  { label: 'Ship', value: 'Ship' },
  { label: 'Not Applicable', value: 'Not Applicable' },
];

// Vehicle Type — mapped per Transport Mode
const VEHICLE_TYPE_MAP: Record<string, DropdownOption[]> = {
  Road: [
    { label: 'Regular', value: 'Regular' },
    { label: 'Over Dimensional Cargo (ODC)', value: 'Over Dimensional' },
    { label: 'LMV (Light Motor Vehicle)', value: 'LMV' },
    { label: 'HMV (Heavy Motor Vehicle)', value: 'HMV' },
    { label: 'Two-Wheeler', value: 'Two-Wheeler' },
    { label: 'Three-Wheeler', value: 'Three-Wheeler' },
    { label: 'Tempo', value: 'Tempo' },
    { label: 'Container', value: 'Container' },
    { label: 'Trailer', value: 'Trailer' },
  ],
  Rail: [
    { label: 'Goods Train', value: 'Goods Train' },
    { label: 'Container Train', value: 'Container Train' },
    { label: 'Wagon', value: 'Wagon' },
  ],
  Air: [
    { label: 'Cargo Plane', value: 'Cargo Plane' },
  ],
  Ship: [
    { label: 'Cargo Ship', value: 'Cargo Ship' },
    { label: 'Container Ship', value: 'Container Ship' },
    { label: 'Barge', value: 'Barge' },
  ],
  'Not Applicable': [
    { label: 'Not Applicable', value: 'Not Applicable' },
  ],
};

const GST_TYPES = ['Regular', 'Composition', 'Unregistered/Consumer', 'Consumer', 'SEZ', 'Overseas'];
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

// ─── StateAutocomplete ────────────────────────────────────────────────────────
function StateAutocomplete({ value, onSelect }: { value: string; onSelect: (v: string) => void }) {
  const [text, setText] = useState(value);
  const [showSugg, setShowSugg] = useState(false);

  useEffect(() => { setText(value); }, [value]);

  const suggestions = text.trim()
    ? INVOICE_STATES.filter(s => s.toLowerCase().includes(text.toLowerCase()))
    : INVOICE_STATES;

  return (
    <View>
      <BottomSheetTextInput
        style={[acd.input, showSugg && acd.inputFocused] as any}
        placeholder="Type to search state…"
        placeholderTextColor={COLORS.textTertiary}
        value={text}
        onChangeText={v => { setText(v); setShowSugg(true); }}
        onFocus={() => setShowSugg(true)}
      />
      {showSugg && suggestions.length > 0 && (
        <View style={[acd.dropList, { maxHeight: 220 }]}>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {suggestions.slice(0, 7).map((st, idx) => (
              <TouchableOpacity
                key={st}
                style={[acd.dropItem, idx === Math.min(suggestions.length, 7) - 1 && { borderBottomWidth: 0 }]}
                onPress={() => { onSelect(st); setText(st); setShowSugg(false); }}
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

// ─── AddCustomerDrawer ────────────────────────────────────────────────────────
export interface AddCustomerDrawerMethods { present: () => void; }

const AddCustomerDrawer = forwardRef<AddCustomerDrawerMethods, {
  onClose: () => void;
  onSaved: (name: string, success?: boolean) => void;
  company?: { guid?: string; name?: string } | null;
}>(function AddCustomerDrawer({ onClose, onSaved, company }, ref) {
  const sheetRef  = useRef<BottomSheetModal>(null);
  const formRef   = useRef<PartyFormRef>(null);
  const insets    = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['92%'], []);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  const [name,    setName]    = useState('');
  const [openBal, setOpenBal] = useState('');
  const [isCr,    setIsCr]    = useState(false);
  const [saving,  setSaving]  = useState(false);

  const resetForm = () => {
    setName(''); setOpenBal(''); setIsCr(false); setSaving(false);
    formRef.current?.reset();
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Customer name is required.'); return; }
    setSaving(true);
    try {
      const pd = formRef.current?.getData();
      const address = [pd?.addressLine1, pd?.addressLine2].filter(Boolean).join('\n');
      const result = await createTallyParty({
        companyGuid:    company?.guid,
        companyName:    company?.name,
        partyName:      name.trim(),
        openingBalance: parseFloat(openBal) || 0,
        isCr,
        phone:          pd?.phone?.trim()   || '',
        email:          pd?.email?.trim()   || '',
        website:        pd?.website?.trim() || '',
        gstin:          pd?.gstin?.trim()   || '',
        gstType:        pd?.gstRegType      || 'Regular',
        pan:            pd?.pan?.trim()     || '',
        mailingName:    name.trim(),
        address,
        state:          pd?.state   || '',
        pincode:        pd?.pincode || '',
        country:        pd?.country || 'India',
        vatDetails: pd?.vatEnabled ? {
          dealerType:      pd.vatDealerType,
          vatTin:          pd.vatTin,
          cstNo:           pd.cstNo,
          formCApplicable: pd.formCApplicable,
        } : undefined,
        // Bank details write removed 2026-07-06 — not needed on customer
        // ledgers. Read path (Tally → DB sync) still populates bank fields.
      });
      const savedName = name.trim();
      resetForm();
      sheetRef.current?.dismiss();
      if (result?.queued) Alert.alert('Queued', `"${savedName}" will be created in Tally when desktop connects.`);
      onSaved(savedName, true);
    } catch (err: any) {
      setSaving(false);
      const msg = err?.message || '';
      const isOffline = msg.includes('offline') || msg.includes('not connected') || msg.includes('Desktop');
      if (isOffline) {
        const savedName = name.trim();
        resetForm();
        sheetRef.current?.dismiss();
        onSaved(savedName, false);
        Alert.alert('Queued', `"${savedName}" will be created in Tally when desktop connects.`);
      } else {
        Alert.alert('Error', msg || 'Failed to create customer. Please try again.');
      }
    } finally { setSaving(false); }
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} onPress={onClose} />
    ), [onClose]
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: COLORS.cardBg }}
      handleIndicatorStyle={{ backgroundColor: COLORS.borderStrong, width: 40 }}
    >
      <View style={acd.header}>
        <Text style={acd.title}>New Customer</Text>
        <Text style={acd.subtitle}>Sundry Debtors</Text>
        <TouchableOpacity onPress={() => sheetRef.current?.dismiss()} style={acd.closeBtn}>
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[acd.body, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Name ── */}
        <Text style={acd.label}>Name <Text style={acd.star}>*</Text></Text>
        <BottomSheetTextInput
          style={acd.input as any}
          placeholder="Enter customer name"
          placeholderTextColor={COLORS.textTertiary}
          value={name}
          onChangeText={setName}
        />

        {/* ── Opening Balance ── */}
        <Text style={acd.label}>Opening Balance</Text>
        <View style={acd.balBox}>
          <BottomSheetTextInput
            style={acd.balInput as any}
            placeholder="0.00"
            placeholderTextColor={COLORS.textTertiary}
            value={openBal}
            onChangeText={setOpenBal}
            keyboardType="numeric"
          />
          <View style={acd.drCrRow}>
            <Text style={[acd.drCrLbl, !isCr && acd.drCrLblActive]}>Dr</Text>
            <BrandSwitch value={isCr} onValueChange={setIsCr} />
            <Text style={[acd.drCrLbl, isCr && acd.drCrLblActive]}>Cr</Text>
          </View>
        </View>

        {/* ── Party Fields via shared PartyForm ── */}
        <View style={acd.divider} />
        <PartyForm ref={formRef} InputComponent={BottomSheetTextInput as any} />
      </BottomSheetScrollView>

      <View style={[acd.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={[acd.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
          {saving && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />}
          <Text style={acd.saveBtnTxt}>{saving ? 'Saving...' : 'Save Customer'}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
});

// ─── TaxEntryRow ─────────────────────────────────────────────────────────────
function TaxEntryRow({ entry, taxLedgers, onUpdate, onRemove, taxable }: {
  entry: TaxLedgerEntry;
  taxLedgers: { name: string; guid?: string; taxRate?: number }[];
  onUpdate: (field: keyof TaxLedgerEntry, val: string) => void;
  onRemove: () => void;
  taxable: number;
}) {
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
            placeholder="Select tax ledger..."
            sheetTitle="Tax Ledger"
          />
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={16} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
      {/* Row 2: Rate % → Amount ₹ — disabled until ledger selected */}
      <View style={[ir.taxEntryBottomRow, !entry.ledgerName && { opacity: 0.38 }]} pointerEvents={entry.ledgerName ? 'auto' : 'none'}>
        <View style={ir.taxFieldGroup}>
          <Text style={ir.taxMiniLbl}>Rate</Text>
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
              placeholder={entry.ledgerName ? '0' : 'Select ledger first'}
              placeholderTextColor={COLORS.textTertiary}
              editable={!!entry.ledgerName}
            />
            <Text style={ir.taxRateSign}>%</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward-outline" size={13} color={COLORS.textTertiary} style={{ marginTop: 16 }} />
        <View style={[ir.taxFieldGroup, { flex: 1 }]}>
          <Text style={ir.taxMiniLbl}>Amount</Text>
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
  item: InvoiceItem;
  stockItems: StockItem[];
  warehouses: Warehouse[];
  taxLedgers: { name: string; guid?: string; taxRate?: number }[];
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

  // Warehouse options: use per-item godowns if available.
  // If godowns is empty (item only in Main Location / no warehouse transactions), show Main Location with closing_qty.
  // NEVER fall back to all global warehouses — that is misleading.
  // Always show warehouse options as a picker when a product is selected.
  // godowns is populated after product selection via the /godowns API.
  // Fallback to Main Location only if product is selected but godowns haven't loaded yet.
  const warehouseOpts: BSSOption[] = godowns.length > 0
    ? godowns.map(g => ({ label: g.name, value: g.name, subtitle: `${Math.round(g.qty)} ${stockItem?.unit || 'units'} available` }))
    : item.product
      ? [{ label: 'Main Location', value: 'Main Location', subtitle: stockItem?.closing_qty != null ? `${Math.round(stockItem.closing_qty)} ${stockItem?.unit || 'units'} available` : 'Default warehouse' }]
      : [];
  // Always render the dropdown picker when a product is selected so user can see/change warehouse
  const needsWarehouseDropdown = item.product ? warehouseOpts.length >= 1 : false;
  const singleWarehouseName = null; // No longer use chip — always use picker

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
                <Ionicons name="scan-outline" size={20} color={COLORS.textPrimary} />
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
            ) : null
          ) : null}

          {/* Row: Qty | Unit | Rate */}
          <View style={ir.qurRow}>
            {/* Qty */}
            <View style={ir.qtyBox}>
              <Text style={ir.miniLabel}>Qty <Text style={ir.star}>*</Text></Text>
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
            {/* Unit */}
            <View style={ir.unitBox}>
              <Text style={ir.miniLabel}>Unit</Text>
              <TouchableOpacity style={ir.unitBtn} onPress={() => onOpenModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
                <Text style={ir.unitTxt}>{item.unit || 'pcs'}</Text>
                <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            {/* Rate */}
            <View style={ir.rateBox}>
              <Text style={ir.miniLabel}>Rate (₹) <Text style={ir.star}>*</Text></Text>
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
            <Text style={ir.miniLabel}>Discount</Text>
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
            <Text style={ir.taxableLabel}>Taxable Amount</Text>
            <Text style={ir.taxableVal}>₹{calc.taxable.toFixed(2)}</Text>
          </View>

          {/* Tax Section */}
          <View style={ir.taxSection}>
            <View style={ir.taxSectionHdr}>
              <Text style={ir.taxSectionTitle}>Taxes</Text>
              <Text style={ir.taxColHint}>Type · Rate % · Amount ₹</Text>
            </View>
            {/* Tax entry rows */}
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
            {/* Add Tax button - outside header, after rows */}
            <TouchableOpacity
              style={ir.addTaxDashedBtn}
              onPress={() => onAddTaxEntry(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={ir.addTaxDashedTxt}>Add Tax</Text>
            </TouchableOpacity>
          </View>

          {/* Item Total */}
          <View style={ir.subtotalRow}>
            <Text style={ir.subtotalLabel}>Item Total</Text>
            <Text style={ir.subtotalVal}>₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>


        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateSalesInvoiceScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<any>(null);
  // Notes & Terms: capture Y offsets via onLayout so we can scroll the focused field above the keyboard
  // (replaces the previous scrollToEnd hack which scrolled PAST Narration onto Terms).
  // notesCardY = absolute Y of the Notes & Terms card inside the ScrollView's inner content.
  // narrationOffset / termsOffset = Y of each field relative to that card.
  const notesCardY     = useRef<number>(0);
  const narrationOffset = useRef<number>(0);
  const termsOffset     = useRef<number>(0);
  const scrollToFieldY = (fieldOffset: number) => {
    setTimeout(() => {
      // ~100px headroom above the field so the label is visible above the keyboard
      const absY = notesCardY.current + fieldOffset;
      scrollRef.current?.scrollTo?.({ y: Math.max(0, absY - 100), animated: true });
    }, 250); // wait for keyboard to begin showing before measuring
  };
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;
  const pathname = usePathname();
  const isProforma = (pathname || '').includes('create-proforma');
  const draftPrefix = isProforma ? 'tdproforma_draft' : 'tdinvoice_draft';

  // ── Core state ───────────────────────────────────────────────────────────────
  const [entryType, setEntryType] = useState<EntryType>(isProforma ? 'optional' : 'regular');
  const [ledger, setLedger] = useState('');
  const [invoiceNo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [party, setParty] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyGstRegType, setPartyGstRegType] = useState('');
  const [parties, setParties] = useState<BSSOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // API data
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [salesLedgers, setSalesLedgers] = useState<{ name: string; guid?: string }[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<{ name: string; guid?: string; taxRate?: number }[]>([]);
  const [chargeLedgers, setChargeLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);
  const [roundOffLedgers, setRoundOffLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);

  // Per-item godowns (fetched when product selected)
  const [itemGodowns, setItemGodowns] = useState<Record<string, Godown[]>>({});

  // Compliance state
  const [ewbRequired, setEwbRequired] = useState(false);
  const [ewbApplicable, setEwbApplicable] = useState(false);
  const [eInvoiceApplicable, setEInvoiceApplicable] = useState(false);

  const addCustomerRef = useRef<AddCustomerDrawerMethods>(null);
  const [payTerms, setPayTerms] = useState('due_on_receipt');
  const [customDays, setCustomDays] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [refNo, setRefNo] = useState('');
  // Set when this invoice is created by converting a Sales Order (see prefill effect below).
  // Sent to backend as `againstOrderNo` so the invoice can be traced back to its source order.
  const [againstOrderNo, setAgainstOrderNo] = useState('');
  const [convertProformaTdkRef, setConvertProformaTdkRef] = useState('');
  const [convertTallyVoucherNo, setConvertTallyVoucherNo] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [roundOffLedger, setRoundOffLedger] = useState('');
  const [roundOffAmount, setRoundOffAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [termsText, setTermsText] = useState('Goods once sold will not be taken back.');
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payTermsExpanded, setPayTermsExpanded] = useState(false);

  // Auto-scroll to top whenever step changes — ensures Collect Payment is visible on entering Step 3
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [step]);

  // Dispatch
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchFrom, setDispatchFrom] = useState('');
  const [dispatchFromState, setDispatchFromState] = useState('');
  const [dispatchFromAddress1, setDispatchFromAddress1] = useState('');
  const [dispatchFromAddress2, setDispatchFromAddress2] = useState('');
  const [dispatchFromPincode, setDispatchFromPincode] = useState('');
  const [shipTo, setShipTo] = useState('');
  const [shipToState, setShipToState] = useState('');
  const [shipToAddress1, setShipToAddress1] = useState('');
  const [shipToAddress2, setShipToAddress2] = useState('');
  const [shipToPincode, setShipToPincode] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [transportMode, setTransportMode] = useState('Road');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Regular');
  const [transportDocNo, setTransportDocNo] = useState('');
  const [transportDocDate, setTransportDocDate] = useState('');
  const [showTransportDocDatePicker, setShowTransportDocDatePicker] = useState(false);

  // Company profile (for dispatch prefill) — loaded once on mount
  const [companyProfile, setCompanyProfile] = useState<{ address?: string; state?: string; pincode?: string } | null>(null);

  // Collect Payment
  const [collectPayNow, setCollectPayNow] = useState(false);
  const [payNowMode, setPayNowMode] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [payNowRef, setPayNowRef] = useState('');
  const [payNowLedger, setPayNowLedger] = useState(''); // actual Tally ledger name for payment
  const [bankLedgers, setBankLedgers] = useState<BSSOption[]>([]);

  // Draft restore banner
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ tdkRef: string; isQueued: boolean; message: string; invoiceUuid?: string; numberingPolicy?: string; invoiceNumber?: string } | null>(null);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  // Universal numbering — Settings → Voucher Config only (no on-screen override)
  const { numberingPolicy, setNumberingPolicy } = useNumberingPolicy(company?.guid);

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    getParties(company.guid).then((res: any) => {
      const list = res?.data || [];
      if (list.length > 0) setParties(list.map((p: any) => ({
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
  }, [company?.guid]);

  // Load company profile once — used to prefill Dispatch From address/pincode
  useEffect(() => {
    if (!company?.guid) return;
    getCompanyProfile(company.guid).then((res: any) => {
      const d = res?.data;
      if (d) setCompanyProfile({ address: d.address || '', state: d.state || '', pincode: d.pincode || '' });
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

  // Fetch bank/cash ledgers — used by Collect Payment Now picker (Step 3)
  const fetchBankLedgers = useCallback(() => {
    if (!company?.guid) {
      console.warn('[bank-ledgers] no company guid yet — skipping fetch');
      return;
    }
    console.log('[bank-ledgers] fetching for company:', company.guid);
    getBankLedgers(company.guid).then((res: any) => {
      const list: any[] = res?.data || [];
      console.log(`[bank-ledgers] loaded ${list.length} ledgers`);
      const mapped = list.map(l => {
        const bal = parseFloat(l.balance || 0);
        const balStr = bal !== 0
          ? ` — ₹${Math.abs(bal).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ${l.balance_type || ''}`
          : '';
        return {
          label: `${l.name}${balStr}`,
          value: l.name,
          sub: l.type === 'cash' ? 'Cash' : 'Bank',
        };
      });
      setBankLedgers(mapped);
      if (list.length === 0) {
        console.warn('[bank-ledgers] API returned 0 ledgers — check ledger "parent" groups in DB');
      }
    }).catch((err) => {
      console.error('[bank-ledgers] fetch failed:', err?.message || err);
      Toast.show({ type: 'error', text1: 'Could not load payment ledgers', text2: 'Tap the picker to retry' });
    });
  }, [company?.guid]);

  useEffect(() => {
    fetchBankLedgers();
  }, [fetchBankLedgers]);

  // Safety net — refetch on entering Step 3 if list is empty
  useEffect(() => {
    if (step === 3 && bankLedgers.length === 0 && company?.guid) {
      console.log('[bank-ledgers] step 3 reached with empty list — retrying');
      fetchBankLedgers();
    }
  }, [step, bankLedgers.length, company?.guid, fetchBankLedgers]);

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

  // ── Dispatch From prefill ─ fires when Dispatch section opens and company profile loaded ────────────────────────────────────────────────────────────
  // Only fills blank fields — user edits are preserved.
  useEffect(() => {
    if (!showDispatch || !companyProfile) return;
    const [c1, c2] = String(companyProfile.address || '').split(/\r?\n/).map(l => l.trim());
    if (!dispatchFromAddress1 && c1) setDispatchFromAddress1(c1);
    if (!dispatchFromAddress2 && c2) setDispatchFromAddress2(c2);
    if (!dispatchFromPincode  && companyProfile.pincode) setDispatchFromPincode(String(companyProfile.pincode));
    if (!dispatchFromState && companyProfile.state && INDIAN_STATES.includes(companyProfile.state)) {
      setDispatchFromState(companyProfile.state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDispatch, companyProfile]);

  // ── Ship To prefill ─ fires when a party is selected and Dispatch section is open ─────────────────────────────────────────────────────────
  // Only prefills when the target fields are still empty — user edits win.
  useEffect(() => {
    if (!showDispatch || !party) return;
    const p = parties.find(x => x.value === party);
    const pd: any = p?.data || {};
    const [l1, l2] = String(pd.address || '').split(/\r?\n/).map((l: string) => l.trim());
    if (!shipToAddress1 && l1) setShipToAddress1(l1);
    if (!shipToAddress2 && l2) setShipToAddress2(l2);
    if (!shipToPincode  && pd.pincode) setShipToPincode(String(pd.pincode));
    if (!shipToState && pd.state_name && INDIAN_STATES.includes(pd.state_name)) {
      setShipToState(pd.state_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party, parties, showDispatch]);

  useEffect(() => {
    if (isProforma) setEntryType('optional');
  }, [isProforma]);

  const routeParams = useLocalSearchParams<{ party?: string }>();
  useEffect(() => {
    if (routeParams?.party) setParty(routeParams.party as string);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft: check for saved draft on mount ────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    const key = `${draftPrefix}_${company.guid}`;
    const convertKey = proformaPrefillStorageKey(company.guid);
    Promise.all([AsyncStorage.getItem(key), AsyncStorage.getItem(convertKey)]).then(([raw, convertRaw]) => {
      if (convertRaw) return; // Proforma convert owns the form — don't overlay an old invoice draft
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const DRAFT_TTL_MS = 30 * 60 * 1000; // 30 minutes
        const isRecent = d?.savedAt && (Date.now() - d.savedAt) < DRAFT_TTL_MS;
        if (isRecent && (d?.party || d?.items?.some((i: any) => i.product))) {
          setShowDraftBanner(true);
        } else if (!isRecent) {
          // silently discard stale draft
          AsyncStorage.removeItem(key).catch(() => {});
        }
      } catch { /* ignore bad draft */ }
    }).catch(() => {});
  }, [company?.guid]);

  // ── Sales Order → Invoice prefill: "Convert to Sales Invoice" writes this key
  //    before navigating here. Applied immediately (no banner) — checked AFTER the
  //    draft-restore-on-mount logic above so a genuine unsaved invoice draft still
  //    surfaces its own Resume banner independently of this conversion flow.
  useEffect(() => {
    if (!company?.guid) return;
    const key = `tdso_to_invoice_prefill_${company.guid}`;
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const PREFILL_TTL_MS = 30 * 60 * 1000; // 30 minutes
        const isFresh = d?.savedAt && (Date.now() - d.savedAt) < PREFILL_TTL_MS;
        if (!isFresh) { AsyncStorage.removeItem(key).catch(() => {}); return; }
        if (d.party)          setParty(d.party);
        if (d.ledger)         setLedger(d.ledger);
        if (d.date)           setDate(d.date);
        if (d.refNo)          setRefNo(d.refNo);
        if (d.narration)      setNarration(d.narration);
        if (d.termsText)      setTermsText(d.termsText);
        if (d.items?.length)  setItems(d.items);
        if (d.logEntries?.length) setLogEntries(d.logEntries);
        if (d.roundOffLedger) setRoundOffLedger(d.roundOffLedger);
        if (d.roundOffAmount) setRoundOffAmount(d.roundOffAmount);
        if (d.dueDate)        setDueDate(d.dueDate);
        // againstOrderNo must be Tally's Sales Order voucher number (not a TDK- ref).
        if (d.againstOrderNo && !String(d.againstOrderNo).startsWith('TDK-')) {
          setAgainstOrderNo(d.againstOrderNo);
        }
        Toast.show({ type: 'success', text1: 'Sales Order Loaded', text2: 'Review and submit to convert to an invoice.' });
      } catch { /* ignore bad prefill */ }
      AsyncStorage.removeItem(key).catch(() => {});
    }).catch(() => {});
  }, [company?.guid]);

  // ── Proforma → Invoice prefill: Convert opens this screen. Submit Alters the
  //    same Tally voucher (ISOPTIONAL=No) — it does not create a second invoice.
  useEffect(() => {
    if (!company?.guid || isProforma) return;
    const key = proformaPrefillStorageKey(company.guid);
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const PREFILL_TTL_MS = 30 * 60 * 1000;
        const isFresh = d?.savedAt && (Date.now() - d.savedAt) < PREFILL_TTL_MS;
        if (!isFresh) { AsyncStorage.removeItem(key).catch(() => {}); return; }
        if (d.party)          setParty(d.party);
        if (d.ledger)         setLedger(d.ledger);
        if (d.date)           setDate(d.date);
        if (d.refNo)          setRefNo(d.refNo);
        if (d.narration)      setNarration(d.narration);
        if (d.termsText)      setTermsText(d.termsText);
        if (d.items?.length)  setItems(d.items);
        if (d.logEntries?.length) setLogEntries(d.logEntries);
        if (d.roundOffLedger) setRoundOffLedger(d.roundOffLedger);
        if (d.roundOffAmount) setRoundOffAmount(d.roundOffAmount);
        if (d.dueDate)        setDueDate(d.dueDate);
        if (d.convertProformaTdkRef) setConvertProformaTdkRef(d.convertProformaTdkRef);
        if (d.tallyVoucherNo) setConvertTallyVoucherNo(d.tallyVoucherNo);
        setEntryType('regular');
        setShowDraftBanner(false);
        Toast.show({ type: 'success', text1: 'Proforma Loaded', text2: 'Review and submit. Same Tally voucher becomes the invoice.' });
      } catch { /* ignore bad prefill */ }
      AsyncStorage.removeItem(key).catch(() => {});
    }).catch(() => {});
  }, [company?.guid, isProforma]);

  // ── Draft: auto-save on any significant field change (debounced 800ms) ───
  useEffect(() => {
    if (!company?.guid) return;
    // Guard: only save if the form has meaningful data — prevents overwriting a real
    // draft with an empty form on mount (which would break the Resume banner flow)
    const hasMeaningfulData = !!party || items.some(i => i.product);
    if (!hasMeaningfulData) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const draft = {
        date, ledger, party, refNo, entryType, narration, termsText,
        items, logEntries, roundOffLedger, roundOffAmount,
        payTerms, customDays, dueDate,
        showDispatch, dispatchFrom, dispatchFromState, shipTo, shipToState,
        dispatchFromAddress1, dispatchFromAddress2, dispatchFromPincode,
        shipToAddress1, shipToAddress2, shipToPincode,
        transporterName, transporterId, transportMode, vehicleNumber, vehicleType,
        transportDocNo, transportDocDate,
        collectPayNow, payNowMode, payNowAmount, payNowLedger, payNowRef,
        numberingPolicy,
        savedAt: Date.now(),
      };
      AsyncStorage.setItem(`${draftPrefix}_${company.guid}`, JSON.stringify(draft)).catch(() => {});
    }, 800);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, ledger, party, refNo, entryType, narration, termsText, items, logEntries,
      roundOffLedger, roundOffAmount, payTerms, customDays, dueDate, showDispatch,
      dispatchFrom, dispatchFromState, shipTo, shipToState,
      dispatchFromAddress1, dispatchFromAddress2, dispatchFromPincode,
      shipToAddress1, shipToAddress2, shipToPincode,
      transporterName, transporterId,
      transportMode, vehicleNumber, vehicleType, transportDocNo, transportDocDate,
      collectPayNow, payNowMode, payNowAmount, payNowLedger, payNowRef, numberingPolicy]);

  const restoreDraft = useCallback(() => {
    if (!company?.guid) return;
    AsyncStorage.getItem(`${draftPrefix}_${company.guid}`).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (d.date)           setDate(d.date);
        if (d.ledger)         setLedger(d.ledger);
        if (d.party)          setParty(d.party);
        if (d.refNo)          setRefNo(d.refNo);
        if (d.entryType)      setEntryType(d.entryType);
        if (d.narration)      setNarration(d.narration);
        if (d.termsText)      setTermsText(d.termsText);
        if (d.items?.length)  setItems(d.items);
        if (d.logEntries?.length) setLogEntries(d.logEntries);
        if (d.roundOffLedger) setRoundOffLedger(d.roundOffLedger);
        if (d.roundOffAmount) setRoundOffAmount(d.roundOffAmount);
        if (d.payTerms)       setPayTerms(d.payTerms);
        if (d.customDays)     setCustomDays(d.customDays);
        if (d.dueDate)        setDueDate(d.dueDate);
        if (d.showDispatch)   setShowDispatch(d.showDispatch);
        // Sanitize restored state/city against canonical lists — stale drafts with
        // free-text values (pre-dropdown era) would otherwise show as empty pickers
        // while still holding bad values; better to clear and let user re-pick.
        if (d.dispatchFromState && INDIAN_STATES.includes(d.dispatchFromState)) {
          setDispatchFromState(d.dispatchFromState);
          if (d.dispatchFrom && getCitiesForState(d.dispatchFromState).includes(d.dispatchFrom)) {
            setDispatchFrom(d.dispatchFrom);
          }
        }
        if (d.shipToState && INDIAN_STATES.includes(d.shipToState)) {
          setShipToState(d.shipToState);
          if (d.shipTo && getCitiesForState(d.shipToState).includes(d.shipTo)) {
            setShipTo(d.shipTo);
          }
        }
        if (d.dispatchFromAddress1) setDispatchFromAddress1(d.dispatchFromAddress1);
        if (d.dispatchFromAddress2) setDispatchFromAddress2(d.dispatchFromAddress2);
        if (d.dispatchFromPincode)  setDispatchFromPincode(d.dispatchFromPincode);
        if (d.shipToAddress1)       setShipToAddress1(d.shipToAddress1);
        if (d.shipToAddress2)       setShipToAddress2(d.shipToAddress2);
        if (d.shipToPincode)        setShipToPincode(d.shipToPincode);
        if (d.transporterName) setTransporterName(d.transporterName);
        if (d.transporterId)  setTransporterId(d.transporterId);
        if (d.transportMode)  setTransportMode(d.transportMode);
        if (d.vehicleNumber)  setVehicleNumber(d.vehicleNumber);
        if (d.vehicleType)    setVehicleType(d.vehicleType);
        if (d.transportDocNo) setTransportDocNo(d.transportDocNo);
        if (d.transportDocDate) setTransportDocDate(d.transportDocDate);
        if (d.collectPayNow)  setCollectPayNow(d.collectPayNow);
        if (d.payNowMode)     setPayNowMode(d.payNowMode);
        if (d.payNowAmount)   setPayNowAmount(d.payNowAmount);
        if (d.payNowLedger)   setPayNowLedger(d.payNowLedger);
        if (d.payNowRef)      setPayNowRef(d.payNowRef);
        if (d.numberingPolicy) setNumberingPolicy(d.numberingPolicy);
      } catch { /* ignore */ }
    }).catch(() => {});
    setShowDraftBanner(false);
  }, [company?.guid]);

  const discardDraft = useCallback(() => {
    if (!company?.guid) return;
    AsyncStorage.removeItem(`${draftPrefix}_${company.guid}`).catch(() => {});
    setShowDraftBanner(false);
  }, [company?.guid]);

  const clearDraftOnSubmit = useCallback(() => {
    if (!company?.guid) return;
    AsyncStorage.removeItem(`${draftPrefix}_${company.guid}`).catch(() => {});
  }, [company?.guid]);

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
      // Use guid (Tally GUID) for the godowns lookup — NOT numeric id which may be undefined
      const stockIdentifier = si.guid || '';
      const res: any = await getStockGodowns(company.guid, stockIdentifier);
      const godownList: Godown[] = res?.data?.warehouses || [];
      // Always store godowns (even single entry) so the warehouse dropdown renders
      const finalGodowns: Godown[] = godownList.length > 0
        ? godownList
        : [{ name: 'Main Location', qty: si.closing_qty ?? 0 }];
      setItemGodowns(prev => ({ ...prev, [itemId]: finalGodowns }));
      // Auto-select only when there is exactly one warehouse — user can still see & change it
      if (finalGodowns.length === 1) {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, warehouse: finalGodowns[0].name } : i));
      }
    } catch {
      // API failed — default to Main Location
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, warehouse: 'Main Location' } : i));
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
    // Dismiss any open keyboard before validation / submit — prevents the keyboard from
    // hovering over the success modal when user submits with a text field still focused.
    Keyboard.dismiss();
    if (submittingRef.current) return;
    if (!party) { Toast.show({ type: 'error', text1: 'Customer required' }); return; }
    if (items.some(i => !i.product)) { Toast.show({ type: 'error', text1: 'All items need a product selected' }); return; }
    const multiWarehouseItems = items.filter(i => i.product && (itemGodowns[i.id]?.length || 0) > 1);
    if (multiWarehouseItems.some(i => !i.warehouse)) { Toast.show({ type: 'error', text1: 'Warehouse required for all items' }); return; }
    if (ewbRequired && showDispatch) {
      if (!dispatchFrom || !shipTo) {
        Toast.show({ type: 'error', text1: 'Dispatch details required', text2: 'Dispatch From and Ship To are mandatory for E-Way Bill' });
        return;
      }
      if (!dispatchFromAddress1?.trim() || !shipToAddress1?.trim()) {
        Toast.show({ type: 'error', text1: 'Address required', text2: 'Address Line 1 is mandatory for both Dispatch From and Ship To' });
        return;
      }
      const isValidPin = (p: string) => /^\d{6}$/.test(String(p || '').trim());
      if (!isValidPin(dispatchFromPincode) || !isValidPin(shipToPincode)) {
        Toast.show({ type: 'error', text1: 'Pincode required', text2: 'Enter a valid 6-digit pincode for both Dispatch From and Ship To' });
        return;
      }
    }
    if (!isProforma && collectPayNow && !payNowLedger) {
      Toast.show({ type: 'error', text1: 'Payment Ledger required', text2: 'Select a Cash or Bank ledger for payment.' });
      return;
    }
    if (!isProforma && collectPayNow && payNowLedger) {
      const pAmt = parseFloat(payNowAmount) || 0;
      if (pAmt <= 0) {
        Toast.show({ type: 'error', text1: 'Invalid payment amount', text2: 'Payment amount must be greater than 0.' });
        return;
      }
      if (pAmt > totals.grand) {
        Toast.show({ type: 'error', text1: 'Payment exceeds invoice total', text2: `Payment ₹${pAmt.toLocaleString('en-IN')} cannot exceed invoice total ₹${totals.grand.toLocaleString('en-IN')}` });
        return;
      }
    }

    setSubmitting(true);
    submittingRef.current = true;
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

      const payload = {
        companyGuid: company?.guid, companyName: company?.name,
        partyLedger: party, date: dmyToISO(date),
        salesLedger: ledger, isOptional: isProforma ? true : entryType === 'optional',
        original_entry_type: isProforma ? 'optional' : entryType, voucherType: 'Sales',
        numbering_policy: numberingPolicy,
        totalAmount: totals.grand, reference: refNo || undefined,
        narration: narration || undefined,
        againstOrderNo: againstOrderNo || undefined,
        items: items.map(item => ({
          itemName: item.product,
          billedQty: parseFloat(item.qty) || 0,
          actualQty: parseFloat(item.qty) || 0,
          rate: parseFloat(item.rate) || 0,
          amount: calcItem(item).taxable,
          salesLedger: ledger,
          godown: item.warehouse || warehouses[0]?.name || 'Main Location',
          unit: item.unit || '',
          discountType: item.discountType,
          discount: parseFloat(item.discount) || 0,
          taxEntries: item.taxEntries,
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
        collect_payment: !isProforma && collectPayNow && payNowLedger ? {
          mode: payNowMode, ledgerName: payNowLedger,
          amount: parseFloat(payNowAmount) || 0, reference: payNowRef || undefined,
        } : undefined,
        dispatch_details: showDispatch ? {
          dispatch_from: dispatchFrom, dispatch_from_state: dispatchFromState || undefined,
          dispatch_from_address1: dispatchFromAddress1 || undefined,
          dispatch_from_address2: dispatchFromAddress2 || undefined,
          dispatch_from_pincode:  dispatchFromPincode  || undefined,
          ship_to: shipTo, ship_to_state: shipToState || undefined,
          ship_to_address1: shipToAddress1 || undefined,
          ship_to_address2: shipToAddress2 || undefined,
          ship_to_pincode:  shipToPincode  || undefined,
          transport_mode: transportMode,
          transporter_name: transporterName || undefined, transporter_id: transporterId || undefined,
          vehicle_number: vehicleNumber || undefined, vehicle_type: vehicleType,
          transport_doc_no: transportDocNo || undefined, transport_doc_date: transportDocDate ? dmyToISO(transportDocDate) : undefined,
        } : undefined,
      };

      const result: any = convertProformaTdkRef
        ? await convertProformaInvoice({
            ...payload,
            tdkRef: convertProformaTdkRef,
            isOptional: false,
            original_entry_type: 'optional',
          })
        : await (isProforma ? createProformaInvoice : createSalesInvoice)(payload);

      if (!result?.status) throw new Error(result?.message || 'Submit failed');
      if (convertProformaTdkRef && result?.data?.status === false) {
        throw new Error(result?.data?.message || result?.message || 'Tally did not update the voucher');
      }

      const tdkRef = result?.tdkReferenceNo || result?.data?.tdkReferenceNo || convertProformaTdkRef || '';
      const isQueued = result?.queued === true;
      const invoiceUuid = result?.invoiceUuid || result?.data?.invoiceUuid || undefined;
      const respNumberingPolicy = result?.numberingPolicy || numberingPolicy;
      const invoiceNumber = result?.invoiceNumber || result?.data?.invoiceNumber || undefined;
      setSubmitResult({ tdkRef, isQueued, message: result?.message || '', invoiceUuid, numberingPolicy: respNumberingPolicy, invoiceNumber });
      setShowSuccess(true);
      clearDraftOnSubmit();
      // Keep the lock after success so a second tap cannot mint another invoice
      // while the success overlay is still up.
      return;
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: err?.message || 'Check Tally connection.' });
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    party, items, itemGodowns, ewbRequired, showDispatch, dispatchFrom, shipTo,
    company, date, ledger, entryType, totals.grand, refNo, narration, warehouses,
    collectPayNow, payNowMode, payNowAmount, payNowRef, payNowLedger, logEntries, roundOffLedger, roundOffAmount,
    transportMode, transporterName, transporterId, vehicleNumber, vehicleType, transportDocNo, transportDocDate,
    dispatchFromState, shipToState,
    numberingPolicy, againstOrderNo, isProforma, convertProformaTdkRef,
  ]);

  const handleConvertProformaFromSuccess = useCallback(async () => {
    if (!company?.guid || !submitResult?.tdkRef) return;
    try {
      const prefill = buildProformaToInvoicePrefillFromForm({
        party, ledger, date, refNo, narration, termsText,
        items, logEntries, roundOffLedger, roundOffAmount, dueDate,
        tdkRef: submitResult.tdkRef,
        tallyVoucherNo: submitResult.invoiceNumber,
      });
      await AsyncStorage.setItem(proformaPrefillStorageKey(company.guid), JSON.stringify(prefill));
      setShowSuccess(false);
      router.replace('/sales/create-invoice');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not start invoice', text2: err?.message || '' });
    }
  }, [company?.guid, submitResult, party, ledger, date, refNo, narration, termsText, items, logEntries, roundOffLedger, roundOffAmount, dueDate, router]);

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
            <Text style={ss.title}>{submitResult.isQueued ? 'Saved. Pending Sync' : (isProforma ? 'Proforma Submitted!' : (convertProformaTdkRef ? 'Converted to Sales Invoice!' : 'Invoice Submitted!'))}</Text>
            <Text style={ss.sub}>
              {submitResult.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : (isProforma ? 'Proforma pushed to Tally as optional Sales.' : (convertProformaTdkRef ? 'Same Tally voucher is now a regular Sales Invoice.' : 'Invoice pushed to Tally successfully.'))}
            </Text>
            {/* TallyDekho Series: show invoice number immediately */}
            {!!submitResult.invoiceNumber && (
              <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                <Text style={ss.refLabel}>Invoice No.</Text>
                <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult.invoiceNumber}</Text>
              </View>
            )}
            {!!submitResult.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>Reference No.</Text>
                <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
              </View>
            )}

            {/* Preview — opens instantly with provisional/final data */}
            <TouchableOpacity
              style={ss.previewBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!submitResult.tdkRef) return;
                const typeQ = isProforma ? '&type=proforma_invoice' : '&type=sales_invoice';
                safePush(router, `/sales/invoice-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}${typeQ}` as any);
              }}
            >
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>Preview</Text>
            </TouchableOpacity>

            {/* Share PDF — waits up to 10s for Tally number (TALLY_PRIME_SERIES) */}
            <TouchableOpacity
              style={[ss.pdfBtn, sharePdfLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              disabled={sharePdfLoading}
              onPress={async () => {
                if (!submitResult.tdkRef || !company?.guid) return;
                setSharePdfLoading(true);
                try {
                  // TallyDekho Series: number is immediate — no wait needed
                  // TallyPrime Series: wait up to 10s for Tally to assign the number
                  const isTDSeries = submitResult.numberingPolicy === 'tallydekho_series';
                  const res = await invoiceSharePdf(submitResult.tdkRef, company.guid, !isTDSeries, isTDSeries ? 0 : 10000);
                  const docData = res?.data;
                  if (!docData) throw new Error('No invoice data returned');

                  const pdfDoc = toVoucherDocument(docData);
                  const fileName = docData.fileName
                    || `${pdfDoc.documentTitle.split(' - ')[0].replace(/\s+/g, '-')}-${submitResult.tdkRef}.pdf`;
                  await shareVoucherPdf(pdfDoc, {
                    companyGuid: company.guid,
                    fileName,
                    onBeforeShare: () => setSharePdfLoading(false),
                    fallback: async () => {
                      Toast.show({ type: 'info', text1: 'Sharing not available on this device' });
                    },
                  });
                } catch (err: any) {
                  Toast.show({ type: 'error', text1: 'PDF Error', text2: err?.message || 'Could not generate PDF' });
                } finally {
                  setSharePdfLoading(false);
                }
              }}
            >
              {sharePdfLoading
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="document-outline" size={18} color={COLORS.white} />}
              <Text style={ss.pdfBtnTxt}>{sharePdfLoading ? 'PDF is creating...' : 'Share PDF'}</Text>
            </TouchableOpacity>

            {isProforma && !convertProformaTdkRef && (
              <TouchableOpacity
                style={ss.convertBtn}
                activeOpacity={0.85}
                onPress={handleConvertProformaFromSuccess}
              >
                <Ionicons name="repeat-outline" size={18} color={COLORS.white} />
                <Text style={ss.convertBtnTxt}>Convert to Sales Invoice</Text>
              </TouchableOpacity>
            )}

            {/* Done — navigates away without waiting for Tally */}
            <TouchableOpacity style={ss.doneBtn} activeOpacity={0.85} onPress={() => {
              setShowSuccess(false);
              setSharePdfLoading(false);
              router.back();
            }}>
              <Text style={ss.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Draft Restore Banner */}
      {showDraftBanner && (
        <View style={s.draftBanner}>
          <Ionicons name="save-outline" size={15} color="#92400E" />
          <Text style={s.draftBannerTxt}>You have an unsaved draft. Resume where you left off?</Text>
          <TouchableOpacity onPress={restoreDraft} style={s.draftBannerBtn}>
            <Text style={s.draftBannerBtnTxt}>Resume</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={discardDraft} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#92400E" />
          </TouchableOpacity>
        </View>
      )}
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={step === 1 ? () => router.back() : goBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{isProforma ? t('sales.createProforma') : t('sales.createInvoice')}</Text>
          <Text style={s.headerSub}>
            {isProforma
              ? 'Always optional'
              : (convertProformaTdkRef
                ? (convertTallyVoucherNo || 'From Proforma')
                : (invoiceNo || 'INV-Auto'))}
          </Text>
        </View>
        {!isProforma && !convertProformaTdkRef && <RegularOptionalToggle value={entryType} onChange={setEntryType} />}
      </View>

      <StepIndicator step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'android' ? 120 : 0}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>

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
                  <Text style={s.cardTitle}>{isProforma ? 'Proforma Details' : 'Invoice Details'}</Text>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{isProforma ? 'Proforma No.' : 'Invoice No.'}</Text>
                    <View style={s.autoBox}>
                      <Text style={s.autoTxt}>{invoiceNo || 'Auto'}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                    {entryType === 'regular' && !isProforma ? (
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
                onSelect={opt => {
                  setParty(opt.value);
                  setPartyGstin(opt.data?.gstin || '');
                  setPartyGstRegType(opt.data?.gst_registration_type || '');
                }}
                onClear={() => { setParty(''); setPartyGstin(''); setPartyGstRegType(''); }}
                sheetTitle="Customer / Party"
                icon="person-outline"
              />
              {party && partyGstin ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, marginBottom: 2, paddingHorizontal: 2 }}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.positive} />
                  <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.positive, fontWeight: '600' }}>{partyGstin}</Text>
                  {partyGstRegType ? (
                    <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary }}>· {partyGstRegType}</Text>
                  ) : null}
                </View>
              ) : party && !partyGstin ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, marginBottom: 2, paddingHorizontal: 2 }}>
                  <Ionicons name="alert-circle-outline" size={13} color={COLORS.textTertiary} />
                  <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary }}>No GSTIN registered</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => addCustomerRef.current?.present()}
                  activeOpacity={0.6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 2, paddingHorizontal: 2 }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} />
                  <Text style={{ fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' }}>
                    Add New Customer
                  </Text>
                </TouchableOpacity>
              )}
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
                    safePush(router, `/sales/product-scanner?companyGuid=${company?.guid}` as any);
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
              {/* 1. Collect Payment Now — not on Proforma (not a tax invoice yet) */}
              {!isProforma && (
              <View style={s.card}>
                <TouchableOpacity style={s.payNowToggleRow} onPress={() => setCollectPayNow(v => !v)} activeOpacity={0.8}>
                  <View style={s.payNowLeft}>
                    <View style={[s.payNowIcon, { backgroundColor: collectPayNow ? COLORS.positiveBg : COLORS.pageBg }]}>
                      <Ionicons name="cash-outline" size={18} color={collectPayNow ? COLORS.positive : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1, flexShrink: 1 }}>
                      <Text style={s.payNowTitle}>Collect Payment Now</Text>
                      <Text style={s.payNowSub}>Record payment received at the time of billing</Text>
                    </View>
                  </View>
                  <BrandSwitch value={collectPayNow} onValueChange={setCollectPayNow} />
                </TouchableOpacity>
                {collectPayNow && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    <FormDropdown label="Mode of Payment" value={payNowMode} options={PAY_MODES} onSelect={(o: any) => {
                      setPayNowMode(o.value);
                      setPayNowLedger(''); // always clear — user must pick correct ledger
                    }} placeholder="Select payment mode..." required />
                    {/* Payment Ledger picker — filtered by mode type */}
                    {bankLedgers.length === 0 ? (
                      <TouchableOpacity
                        onPress={fetchBankLedgers}
                        style={{ paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.warning, borderRadius: 8, backgroundColor: '#FFF8E1', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh-outline" size={16} color={COLORS.warning} />
                        <Text style={{ color: COLORS.warning, fontWeight: '600', fontSize: 13, flex: 1 }}>
                          Payment ledgers not loaded — Tap to retry
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <BottomSheetSearch
                        label="Payment Ledger"
                        required
                        options={
                          payNowMode === 'cash'
                            ? bankLedgers.filter(l => l.sub === 'Cash')
                            : payNowMode
                              ? bankLedgers.filter(l => l.sub === 'Bank')
                              : bankLedgers
                        }
                        value={payNowLedger}
                        onSelect={(opt) => setPayNowLedger(opt.value)}
                        onClear={() => setPayNowLedger('')}
                        placeholder={
                          !payNowMode ? 'Select mode first...' :
                          payNowMode === 'cash' ? 'Select cash ledger...' :
                          'Select bank ledger...'
                        }
                        sheetTitle="Payment Ledger"
                      />
                    )}
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Amount Received (₹)</Text>
                        <TextInput
                          style={s.fInput}
                          value={payNowAmount}
                          onChangeText={setPayNowAmount}
                          onBlur={() => {
                            const v = parseFloat(payNowAmount) || 0;
                            if (v > totals.grand) setPayNowAmount(String(totals.grand));
                          }}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={COLORS.textTertiary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Reference No.</Text>
                        <TextInput style={s.fInput} value={payNowRef} onChangeText={setPayNowRef} placeholder="Txn / Cheque No." placeholderTextColor={COLORS.textTertiary} />
                      </View>
                    </View>
                    <View style={[s.payStatusChip, paymentStatus === 'paid' ? s.payStatusPaid : paymentStatus === 'partial' ? s.payStatusPartial : s.payStatusPending]}>
                      <Ionicons name={paymentStatus === 'paid' ? 'checkmark-circle' : paymentStatus === 'partial' ? 'time-outline' : 'alert-circle-outline'} size={16} color={paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative} />
                      <Text style={[s.payStatusTxt, { color: paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative }]}>
                        {paymentStatus === 'paid' ? 'Fully Paid' : paymentStatus === 'partial' ? `Partial — ₹${(totals.grand - (parseFloat(payNowAmount) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} remaining` : 'Enter payment amount'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
              )}

              {/* 2. Dispatch / EWB */}
              <View style={s.card}>
                <TouchableOpacity style={s.payNowToggleRow} onPress={() => setShowDispatch(v => !v)} activeOpacity={0.8}>
                  <View style={s.payNowLeft}>
                    <View style={[s.payNowIcon, { backgroundColor: showDispatch ? '#EFF6FF' : COLORS.pageBg }]}>
                      <Ionicons name="car-outline" size={18} color={showDispatch ? COLORS.info : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1, flexShrink: 1 }}>
                      <Text style={s.payNowTitle}>Dispatch / E-Way Bill Details</Text>
                      <Text style={s.payNowSub}>Required for goods movement & E-Way Bill</Text>
                    </View>
                  </View>
                  <BrandSwitch value={showDispatch} onValueChange={setShowDispatch} />
                </TouchableOpacity>
                {showDispatch && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    {/* Dispatch From: State (left, dropdown) → City (right, dropdown filtered by state) */}
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label="Dispatch State"
                          options={INDIAN_STATES.map(st => ({ label: st, value: st }))}
                          value={dispatchFromState}
                          onSelect={(opt) => {
                            setDispatchFromState(opt.value);
                            // Reset city if it no longer belongs to the new state
                            const validCities = getCitiesForState(opt.value);
                            if (dispatchFrom && !validCities.includes(dispatchFrom)) {
                              setDispatchFrom('');
                            }
                          }}
                          onClear={() => { setDispatchFromState(''); setDispatchFrom(''); }}
                          placeholder="Select state..."
                          sheetTitle="Dispatch State"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label="Dispatch From"
                          options={getCitiesForState(dispatchFromState).map(c => ({ label: c, value: c }))}
                          value={dispatchFrom}
                          onSelect={(opt) => setDispatchFrom(opt.value)}
                          onClear={() => setDispatchFrom('')}
                          placeholder={dispatchFromState ? 'Select city...' : 'Select state first'}
                          sheetTitle="Dispatch City"
                          disabled={!dispatchFromState}
                        />
                      </View>
                    </View>
                    {/* Dispatch From: Address Line 1 (required for EWB) */}
                    <Text style={s.fLabel}>Dispatch Address Line 1{ewbRequired ? ' *' : ''}</Text>
                    <ThemedFInput
                      value={dispatchFromAddress1}
                      onChangeText={setDispatchFromAddress1}
                      placeholder="Building / Street / Area"
                    />
                    <Text style={s.fLabel}>Dispatch Address Line 2</Text>
                    <ThemedFInput
                      value={dispatchFromAddress2}
                      onChangeText={setDispatchFromAddress2}
                      placeholder="Landmark / Locality (optional)"
                    />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Dispatch Pincode{ewbRequired ? ' *' : ''}</Text>
                        <ThemedFInput
                          value={dispatchFromPincode}
                          onChangeText={(v) => setDispatchFromPincode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                          keyboardType="numeric"
                          placeholder="6-digit pincode"
                          maxLength={6}
                        />
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>
                    {/* Ship To: State (left, dropdown) → City (right, dropdown filtered by state) */}
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label="Ship To State"
                          options={INDIAN_STATES.map(st => ({ label: st, value: st }))}
                          value={shipToState}
                          onSelect={(opt) => {
                            setShipToState(opt.value);
                            const validCities = getCitiesForState(opt.value);
                            if (shipTo && !validCities.includes(shipTo)) {
                              setShipTo('');
                            }
                          }}
                          onClear={() => { setShipToState(''); setShipTo(''); }}
                          placeholder="Select state..."
                          sheetTitle="Ship To State"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label="Ship To"
                          options={getCitiesForState(shipToState).map(c => ({ label: c, value: c }))}
                          value={shipTo}
                          onSelect={(opt) => setShipTo(opt.value)}
                          onClear={() => setShipTo('')}
                          placeholder={shipToState ? 'Select city...' : 'Select state first'}
                          sheetTitle="Ship To City"
                          disabled={!shipToState}
                        />
                      </View>
                    </View>
                    {/* Ship To: Address Line 1 (required for EWB) */}
                    <Text style={s.fLabel}>Ship To Address Line 1{ewbRequired ? ' *' : ''}</Text>
                    <ThemedFInput
                      value={shipToAddress1}
                      onChangeText={setShipToAddress1}
                      placeholder="Building / Street / Area"
                    />
                    <Text style={s.fLabel}>Ship To Address Line 2</Text>
                    <ThemedFInput
                      value={shipToAddress2}
                      onChangeText={setShipToAddress2}
                      placeholder="Landmark / Locality (optional)"
                    />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Ship To Pincode{ewbRequired ? ' *' : ''}</Text>
                        <ThemedFInput
                          value={shipToPincode}
                          onChangeText={(v) => setShipToPincode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                          keyboardType="numeric"
                          placeholder="6-digit pincode"
                          maxLength={6}
                        />
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>
                    {/* Transport Mode dropdown */}
                    <FormDropdown
                      label="Transport Mode"
                      value={transportMode}
                      options={TRANSPORT_MODES}
                      onSelect={(o: any) => {
                        setTransportMode(o.value);
                        // Reset Vehicle Type to first valid option for the new mode
                        const firstVt = VEHICLE_TYPE_MAP[o.value]?.[0]?.value || 'Regular';
                        setVehicleType(firstVt);
                      }}
                      placeholder="Select transport mode..."
                    />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Transporter Name</Text><ThemedFInput value={transporterName} onChangeText={setTransporterName} placeholder="Optional" /></View>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Transporter ID</Text><ThemedFInput value={transporterId} onChangeText={setTransporterId} placeholder="GSTIN / ID" /></View>
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Vehicle Number</Text><ThemedFInput value={vehicleNumber} onChangeText={v => setVehicleNumber(v.toUpperCase())} placeholder="e.g. MH12AB1234" /></View>
                      <View style={{ flex: 1 }}>
                        {/* Vehicle Type dropdown — options mapped to selected Transport Mode */}
                        <FormDropdown
                          label="Vehicle Type"
                          value={vehicleType}
                          options={VEHICLE_TYPE_MAP[transportMode] || VEHICLE_TYPE_MAP.Road}
                          onSelect={(o: any) => setVehicleType(o.value)}
                          placeholder="Select vehicle type..."
                        />
                      </View>
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>Doc / LR / RR No.</Text><ThemedFInput value={transportDocNo} onChangeText={setTransportDocNo} placeholder="Optional" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Doc Date</Text>
                        <TouchableOpacity style={[s.fInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setShowTransportDocDatePicker(true)}>
                          <Text style={{ color: transportDocDate ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.base }}>
                            {transportDocDate
                              ? (transportDocDate.includes('-')
                                  ? (() => { const [y, m, d] = transportDocDate.split('-'); return `${d}/${m}/${y.slice(2)}`; })()
                                  : transportDocDate)
                              : 'Optional'}
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
                    <View style={{ flex: 1, flexShrink: 1 }}>
                      <Text style={s.payNowTitle}>Payment Terms</Text>
                    </View>
                  </View>
                  <Ionicons name={payTermsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {payTermsExpanded && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    <FormDropdown
                      label="Terms"
                      value={payTerms}
                      options={TERMS}
                      onSelect={(o: any) => setPayTerms(o.value)}
                      placeholder="Select payment terms..."
                    />
                    {payTerms === 'custom' && (
                      <View style={s.customDaysRow}>
                        <ThemedFInput style={{ flex: 1 }} value={customDays} onChangeText={setCustomDays} keyboardType="numeric" placeholder="Enter number of days" />
                        <View style={s.daysBadge}><Text style={s.daysBadgeTxt}>Days</Text></View>
                      </View>
                    )}
                    <View style={[s.row2, { marginTop: SPACING.sm }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>Due Date</Text>
                        {payTerms === 'due_on_receipt' ? (
                          <View style={[s.autoBox, { opacity: 0.8 }]}>
                            <Text style={[s.autoTxt, { color: COLORS.textSecondary }]}>Same as invoice date</Text>
                            <Ionicons name="checkmark-circle" size={14} color={COLORS.positive} />
                          </View>
                        ) : (
                          <View style={[s.fInput, { justifyContent: 'center' }]}>
                            <Text style={{ color: dueDate ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.base }}>
                              {dueDate ? formatDueDisplay(dueDate) : 'DD/MM/YYYY'}
                            </Text>
                          </View>
                        )}
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
              <View style={s.card} onLayout={(e) => { notesCardY.current = e.nativeEvent.layout.y; }}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>Notes & Terms</Text>
                </View>
                <View onLayout={(e) => { narrationOffset.current = e.nativeEvent.layout.y; }}>
                  <FormField
                    label="Narration"
                    value={narration}
                    onChangeText={setNarration}
                    placeholder="Internal notes..."
                    multiline
                    numberOfLines={2}
                    style={{ minHeight: 60, textAlignVertical: 'top' } as any}
                    onFocus={() => scrollToFieldY(narrationOffset.current)}
                  />
                </View>
                <View onLayout={(e) => { termsOffset.current = e.nativeEvent.layout.y; }}>
                  <FormField
                    label="Terms & Conditions"
                    value={termsText}
                    onChangeText={setTermsText}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 72, textAlignVertical: 'top' } as any}
                    containerStyle={{ marginBottom: 0 }}
                    onFocus={() => scrollToFieldY(termsOffset.current)}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 3 && (
            <View style={s.grandTotalBar}>
              <View>
                <Text style={s.grandTotalMeta}>
                  {items.filter(i => i.product).length} item{items.filter(i => i.product).length !== 1 ? 's' : ''} · {party || 'No customer'}
                </Text>
                <Text style={s.grandTotalLabel}>Grand Total</Text>
              </View>
              <Text style={s.grandTotalAmt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
          <View style={s.footerBtnRow}>
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
      <DatePickerModal visible={showTransportDocDatePicker} value={transportDocDate || todayStr()} maxDate={new Date().toISOString().slice(0, 10)} onSelect={(d) => { setTransportDocDate(d); setShowTransportDocDatePicker(false); }} onClose={() => setShowTransportDocDatePicker(false)} />

      <AddCustomerDrawer
        ref={addCustomerRef}
        company={company}
        onClose={() => {}}
        onSaved={(name, success) => {
          const newOpt: BSSOption = { label: name, value: name };
          setParties(prev => [...prev, newOpt]);
          setParty(name);
          if (success !== false) Alert.alert('✓ Customer Added', `"${name}" has been added and selected.`);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  draftBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: '#FFF8E1', paddingHorizontal: SPACING.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F59E0B33' },
  draftBannerTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: '#92400E' },
  draftBannerBtn: { backgroundColor: '#F59E0B', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 },
  draftBannerBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' as const, color: '#fff' },
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
  footer: { flexDirection: 'column' as const, gap: 8, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  footerBtnRow: { flexDirection: 'row' as const, gap: 12 },
  grandTotalBar: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingHorizontal: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  grandTotalMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' as const, marginBottom: 1 },
  grandTotalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' as const, color: COLORS.textSecondary },
  grandTotalAmt: { fontSize: TYPOGRAPHY.xl, fontWeight: '800' as const, color: COLORS.brandPrimary, flexShrink: 1, marginLeft: 8, textAlign: 'right' as const },
  naChip: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, alignSelf: 'flex-start' as const, marginTop: 4 },
  naChipActive: { backgroundColor: COLORS.textSecondary, borderColor: COLORS.textSecondary },
  naChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' as const, color: COLORS.textTertiary },
  naChipTxtActive: { color: COLORS.white },
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
  barcodeBtn: { width: 44, height: 48, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.borderDefault },
  warehouseChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.infoBg, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.info + '40' },
  warehouseChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.info },
  // Qty | Unit | Rate row
  qurRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  qtyBox: { width: 72 },
  unitBox: { width: 64 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600', marginBottom: 4 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary },
  unitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 36 },
  unitTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  // Discount row
  discFullRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  discInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discTypeBtn: { backgroundColor: COLORS.brandPrimary + '18', borderWidth: 1, borderColor: COLORS.brandPrimary + '40', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7, minWidth: 36, alignItems: 'center' },
  discTypeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  discInput: { width: 64, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center' },
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
  addTaxDashedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: COLORS.brandPrimary + '70', borderRadius: RADIUS.sm, paddingVertical: 10, marginTop: 4, marginBottom: 4 },
  addTaxDashedTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  // Tax Entry Card (2-row layout)
  taxEntryCard: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' as const, marginBottom: 4 },
  taxEntryTopRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 6, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  taxEntryBottomRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, padding: 8, paddingTop: 6 },
  taxFieldGroup: { gap: 2 },
  taxMiniLbl: { fontSize: 10, fontWeight: '600' as const, color: COLORS.textTertiary },
  taxFieldInputRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3 },
  headerTrashBtn: { marginLeft: 8, padding: 4, borderRadius: RADIUS.sm },
});

const acd = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { width: '100%', maxHeight: '92%', backgroundColor: COLORS.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  footer: { paddingHorizontal: SPACING.md, paddingTop: 12, paddingBottom: 4, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
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
  stateSearch: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, paddingHorizontal: 14, paddingVertical: 10, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  dropTxtActive: { fontWeight: '700', color: COLORS.brandPrimary },
  saveBtn: { flexDirection: 'row', backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
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
  convertBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  convertBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  waBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  waBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  irnBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.info, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  irnBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  ewbBtn: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.warning, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, width: '100%', justifyContent: 'center', alignItems: 'center' },
  ewbBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  doneBtn: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});
