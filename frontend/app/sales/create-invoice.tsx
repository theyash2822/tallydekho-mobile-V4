import React, { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Pressable,
  Platform, Alert, TextInput, Modal, TextInputProps, ActivityIndicator, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useRequireCapability } from '../../src/components/RequireCapability';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import {
  getParties, createSalesInvoice, createProformaInvoice, convertProformaInvoice, getStocks, getWarehouses,
  getSalesLedgerAccounts, getTaxLedgers, createTallyParty, lookupBarcode,
  getComplianceConfig, getChargeLedgers, getStockGodowns, getBankLedgers,
  invoiceSharePdf, getCompanyProfile,
} from '../../src/services/api';
import {
  proformaPrefillStorageKey,
  legacyProformaPrefillKey,
  buildProformaToInvoicePrefillFromForm,
} from '../../src/utils/proformaToInvoicePrefill';
import { currentTenantKey, draftFeature, prefillFeature, dropLegacyKeys } from '../../src/utils/tenantStorage';
import { toVoucherDocument } from '../../src/utils/voucherDocumentAdapter';
import { confirmIfNegativeStockRisk } from '../../src/utils/negativeStockWarn';
import { shareVoucherPdf } from '../../src/utils/voucherPdf';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import PartyForm, { PartyFormRef } from '../../src/components/forms/PartyForm';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType, defaultEntryTypeForMode } from '../../src/components/forms/RegularOptionalToggle';
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
import i18n from '../../src/i18n';
import { todayLocalISO } from '../../src/utils/periodDates';

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
    return i18n.t('screens.salesCreateInvoice.dueOn', { date: `${d.getDate()} ${d.toLocaleString('en-IN', { month: 'long' })} ${d.getFullYear()}` });
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
type LocalizedOption = DropdownOption & { labelKey?: string };

const TERMS: LocalizedOption[] = [
  { label: 'Due on Receipt', labelKey: 'screens.salesCreateInvoice.termDueOnReceipt', value: 'due_on_receipt' },
  { label: '15 Days', labelKey: 'screens.salesCreateInvoice.term15Days', value: '15d' },
  { label: '30 Days', labelKey: 'screens.salesCreateInvoice.term30Days', value: '30d' },
  { label: 'Custom', labelKey: 'screens.salesCreateInvoice.termCustom', value: 'custom' },
];

const PAY_MODES: LocalizedOption[] = [
  { label: 'Cash', labelKey: 'screens.salesCreateInvoice.payCash', value: 'cash' },
  { label: 'NEFT', value: 'neft' },
  { label: 'RTGS', value: 'rtgs' },
  { label: 'Cheque', labelKey: 'screens.salesCreateInvoice.payCheque', value: 'cheque' },
  { label: 'UPI', value: 'upi' },
  { label: 'IMPS', value: 'imps' },
];

// Transport Mode — per EWB/GST spec
const TRANSPORT_MODES: LocalizedOption[] = [
  { label: 'Road', labelKey: 'screens.salesCreateInvoice.modeRoad', value: 'Road' },
  { label: 'Rail', labelKey: 'screens.salesCreateInvoice.modeRail', value: 'Rail' },
  { label: 'Air', labelKey: 'screens.salesCreateInvoice.modeAir', value: 'Air' },
  { label: 'Ship', labelKey: 'screens.salesCreateInvoice.modeShip', value: 'Ship' },
  { label: 'Not Applicable', labelKey: 'screens.salesCreateInvoice.notApplicable', value: 'Not Applicable' },
];

// Vehicle Type — mapped per Transport Mode
const VEHICLE_TYPE_MAP: Record<string, LocalizedOption[]> = {
  Road: [
    { label: 'Regular', labelKey: 'screens.salesCreateInvoice.vtRegular', value: 'Regular' },
    { label: 'Over Dimensional Cargo (ODC)', labelKey: 'screens.salesCreateInvoice.vtOdc', value: 'Over Dimensional' },
    { label: 'LMV (Light Motor Vehicle)', labelKey: 'screens.salesCreateInvoice.vtLmv', value: 'LMV' },
    { label: 'HMV (Heavy Motor Vehicle)', labelKey: 'screens.salesCreateInvoice.vtHmv', value: 'HMV' },
    { label: 'Two-Wheeler', labelKey: 'screens.salesCreateInvoice.vtTwoWheeler', value: 'Two-Wheeler' },
    { label: 'Three-Wheeler', labelKey: 'screens.salesCreateInvoice.vtThreeWheeler', value: 'Three-Wheeler' },
    { label: 'Tempo', labelKey: 'screens.salesCreateInvoice.vtTempo', value: 'Tempo' },
    { label: 'Container', labelKey: 'screens.salesCreateInvoice.vtContainer', value: 'Container' },
    { label: 'Trailer', labelKey: 'screens.salesCreateInvoice.vtTrailer', value: 'Trailer' },
  ],
  Rail: [
    { label: 'Goods Train', labelKey: 'screens.salesCreateInvoice.vtGoodsTrain', value: 'Goods Train' },
    { label: 'Container Train', labelKey: 'screens.salesCreateInvoice.vtContainerTrain', value: 'Container Train' },
    { label: 'Wagon', labelKey: 'screens.salesCreateInvoice.vtWagon', value: 'Wagon' },
  ],
  Air: [
    { label: 'Cargo Plane', labelKey: 'screens.salesCreateInvoice.vtCargoPlane', value: 'Cargo Plane' },
  ],
  Ship: [
    { label: 'Cargo Ship', labelKey: 'screens.salesCreateInvoice.vtCargoShip', value: 'Cargo Ship' },
    { label: 'Container Ship', labelKey: 'screens.salesCreateInvoice.vtContainerShip', value: 'Container Ship' },
    { label: 'Barge', labelKey: 'screens.salesCreateInvoice.vtBarge', value: 'Barge' },
  ],
  'Not Applicable': [
    { label: 'Not Applicable', labelKey: 'screens.salesCreateInvoice.notApplicable', value: 'Not Applicable' },
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
  hsn?: string;
}

const newItem = (warehouseName = ''): InvoiceItem => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2),
  warehouse: warehouseName, product: '', qty: '1', unit: 'pcs', rate: '',
  discountType: '%', discount: '0', taxEntries: [], hsn: undefined,
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
  const { t } = useTranslation();
  const STEPS = [
    { num: 1 as const, label: t('screens.salesCreateInvoice.invoiceDetails') },
    { num: 2 as const, label: t('screens.salesCreateInvoice.itemsServices') },
    { num: 3 as const, label: t('screens.salesCreateInvoice.reviewSubmit') },
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
  const { t } = useTranslation();
  const [text, setText] = useState(value);
  const [showSugg, setShowSugg] = useState(false);

  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(value);
  }

  const suggestions = text.trim()
    ? INVOICE_STATES.filter(s => s.toLowerCase().includes(text.toLowerCase()))
    : INVOICE_STATES;

  return (
    <View>
      <BottomSheetTextInput
        style={[acd.input, showSugg && acd.inputFocused] as any}
        placeholder={t('screens.salesCreateInvoice.searchStatePlaceholder')}
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
  const { t } = useTranslation();
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
    if (!name.trim()) { Alert.alert(t('common.required'), t('screens.salesCreateInvoice.customerNameRequired')); return; }
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
      if (result?.queued) Alert.alert(t('screens.salesCreateInvoice.queuedTitle'), t('screens.salesCreateInvoice.queuedMsg', { name: savedName }));
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
        Alert.alert(t('screens.salesCreateInvoice.queuedTitle'), t('screens.salesCreateInvoice.queuedMsg', { name: savedName }));
      } else {
        Alert.alert(t('common.error'), msg || t('screens.salesCreateInvoice.createCustomerFailed'));
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
        <Text style={acd.title}>{t('screens.salesCreateInvoice.newCustomer')}</Text>
        <Text style={acd.subtitle}>{t('quickActions.sundryDebtors')}</Text>
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
        <Text style={acd.label}>{t('screens.salesCreateInvoice.name')} <Text style={acd.star}>*</Text></Text>
        <BottomSheetTextInput
          style={acd.input as any}
          placeholder={t('screens.salesCreateInvoice.customerNamePlaceholder')}
          placeholderTextColor={COLORS.textTertiary}
          value={name}
          onChangeText={setName}
        />

        {/* ── Opening Balance ── */}
        <Text style={acd.label}>{t('ledger.opening')}</Text>
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
          <Text style={acd.saveBtnTxt}>{saving ? t('common.saving') : t('screens.salesCreateInvoice.saveCustomer')}</Text>
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
            placeholder={t('screens.salesCreateInvoice.selectTaxLedger')}
            sheetTitle={t('screens.salesCreateInvoice.taxLedger')}
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
              placeholder={entry.ledgerName ? '0' : t('screens.salesCreateInvoice.selectLedgerFirst')}
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const calc = calcItem(item);

  const stockOpts: BSSOption[] = stockItems.map(si => ({
    label: si.displayName || si.name,
    value: si.name,
    subtitle: `${si.closing_qty ?? 0} ${si.unit || 'pcs'}`,
  }));

  const stockItem = stockItems.find(si => si.name === item.product);
  const productLabel = stockItem ? (stockItem.displayName || stockItem.name) : '';
  const headerLabel = productLabel || t('screens.salesCreateInvoice.itemN', { n: itemIndex + 1 });

  // Warehouse options: use per-item godowns if available.
  // If godowns is empty (item only in Main Location / no warehouse transactions), show Main Location with closing_qty.
  // NEVER fall back to all global warehouses — that is misleading.
  // Always show warehouse options as a picker when a product is selected.
  // godowns is populated after product selection via the /godowns API.
  // Fallback to Main Location only if product is selected but godowns haven't loaded yet.
  const warehouseOpts: BSSOption[] = godowns.length > 0
    ? godowns.map(g => ({ label: g.name, value: g.name, subtitle: t('screens.salesCreateInvoice.unitsAvailable', { qty: Math.round(g.qty), unit: stockItem?.unit || t('screens.salesCreateInvoice.units') }) }))
    : item.product
      ? [{ label: 'Main Location', value: 'Main Location', subtitle: stockItem?.closing_qty != null ? t('screens.salesCreateInvoice.unitsAvailable', { qty: Math.round(stockItem.closing_qty), unit: stockItem?.unit || t('screens.salesCreateInvoice.units') }) : t('screens.salesCreateInvoice.defaultWarehouse') }]
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
            <Text style={ir.fieldLabel}>{t('screens.salesCreateInvoice.productService')} <Text style={ir.star}>*</Text></Text>
            <View style={ir.productRow}>
              <View style={{ flex: 1 }}>
                <BottomSheetSearch
                  placeholder={t('screens.salesCreateInvoice.selectProduct')}
                  options={stockOpts}
                  value={item.product}
                  onSelect={opt => onProductSelect(item.id, opt)}
                  onClear={() => onProductClear(item.id)}
                  sheetTitle={t('screens.salesCreateInvoice.productService')}
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
                <Text style={ir.fieldLabel}>{t('screens.salesCreateInvoice.warehouse')} <Text style={ir.star}>*</Text></Text>
                <BottomSheetSearch
                  placeholder={t('screens.salesCreateInvoice.selectWarehouse')}
                  options={warehouseOpts}
                  value={item.warehouse}
                  onSelect={opt => onUpdate(item.id, 'warehouse', opt.value)}
                  onClear={() => onUpdate(item.id, 'warehouse', '')}
                  sheetTitle={t('screens.salesCreateInvoice.warehouse')}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            ) : null
          ) : null}

          {/* Row: Qty | Unit | Rate */}
          <View style={ir.qurRow}>
            {/* Qty */}
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
            {/* Unit */}
            <View style={ir.unitBox}>
              <Text style={ir.miniLabel}>{t('screens.salesCreateInvoice.unit')}</Text>
              <TouchableOpacity style={ir.unitBtn} onPress={() => onOpenModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
                <Text style={ir.unitTxt}>{item.unit || 'pcs'}</Text>
                <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            {/* Rate */}
            <View style={ir.rateBox}>
              <Text style={ir.miniLabel}>{t('screens.salesCreateInvoice.rateRupee')} <Text style={ir.star}>*</Text></Text>
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
            <Text style={ir.miniLabel}>{t('pdf.discount')}</Text>
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
            <Text style={ir.taxableLabel}>{t('screens.salesCreateInvoice.taxableAmount')}</Text>
            <Text style={ir.taxableVal}>₹{calc.taxable.toFixed(2)}</Text>
          </View>

          {/* Tax Section */}
          <View style={ir.taxSection}>
            <View style={ir.taxSectionHdr}>
              <Text style={ir.taxSectionTitle}>{t('screens.salesCreateInvoice.taxes')}</Text>
              <Text style={ir.taxColHint}>{t('screens.salesCreateInvoice.taxColHint')}</Text>
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
              <Text style={ir.addTaxDashedTxt}>{t('screens.salesCreateInvoice.addTax')}</Text>
            </TouchableOpacity>
          </View>

          {/* Item Total */}
          <View style={ir.subtotalRow}>
            <Text style={ir.subtotalLabel}>{t('screens.salesCreateInvoice.itemTotal')}</Text>
            <Text style={ir.subtotalVal}>₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>


        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateSalesInvoiceScreen() {
  const allowed = useRequireCapability('sales_invoice.create');
  const { t } = useTranslation();
  const loc = (opts: LocalizedOption[]): DropdownOption[] =>
    opts.map(o => (o.labelKey ? { ...o, label: t(o.labelKey) } : o));
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
  const companyGuid = company?.guid;
  const { assertCanCreate } = useRbasCreate();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;
  const pathname = usePathname();
  const isProforma = (pathname || '').includes('create-proforma');
  const draftKey = () => currentTenantKey(company?.guid, draftFeature(isProforma ? 'proforma' : 'invoice'));
  const legacyDraftKey = () => `${isProforma ? 'tdproforma_draft' : 'tdinvoice_draft'}_${company?.guid || ''}`;

  // ── Core state ───────────────────────────────────────────────────────────────
  const { entryMode, filterScoped, hasCapability } = useWorkspace();
  const canSharePdf = hasCapability('document.pdf.generate');
  const [entryType, setEntryType] = useState<EntryType>(
    isProforma ? 'optional' : defaultEntryTypeForMode(entryMode)
  );
  const [prevEntryDeps, setPrevEntryDeps] = useState<unknown[]>([entryMode, isProforma]);
  if (prevEntryDeps[0] !== entryMode || prevEntryDeps[1] !== isProforma) {
    setPrevEntryDeps([entryMode, isProforma]);
    if (!isProforma) setEntryType(defaultEntryTypeForMode(entryMode));
  }
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
      const list = filterScoped(res?.data || [], 'ledgers');
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
  }, [company?.guid, filterScoped]);

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
      const list: Warehouse[] = filterScoped(res?.data || res?.warehouses || [], 'godowns');
      setWarehouses(list);
      if (list.length === 1) setItems(prev => prev.map(i => ({ ...i, warehouse: list[0].name })));
    }).catch(() => {});
  }, [company?.guid, filterScoped]);

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
    if (!companyGuid) {
      console.warn('[bank-ledgers] no company guid yet — skipping fetch');
      return;
    }
    if (__DEV__) console.log('[bank-ledgers] fetching');
    getBankLedgers(companyGuid).then((res: any) => {
      const list: any[] = res?.data || [];
      if (__DEV__) console.log(`[bank-ledgers] loaded ${list.length} ledgers`);
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
      Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.payLedgersLoadFailed'), text2: t('screens.salesCreateInvoice.tapPickerRetry') });
    });
  }, [companyGuid]);

  useEffect(() => {
    fetchBankLedgers();
  }, [fetchBankLedgers]);

  // Safety net — refetch on entering Step 3 if list is empty
  useEffect(() => {
    if (step === 3 && bankLedgers.length === 0 && company?.guid) {
      if (__DEV__) console.log('[bank-ledgers] empty list — retrying');
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
  const [dispatchPrefillDeps, setDispatchPrefillDeps] = useState<unknown[] | null>(null);
  if (!dispatchPrefillDeps || dispatchPrefillDeps[0] !== showDispatch || dispatchPrefillDeps[1] !== companyProfile) {
    setDispatchPrefillDeps([showDispatch, companyProfile]);
    if (showDispatch && companyProfile) {
      const [c1, c2] = String(companyProfile.address || '').split(/\r?\n/).map(l => l.trim());
      if (!dispatchFromAddress1 && c1) setDispatchFromAddress1(c1);
      if (!dispatchFromAddress2 && c2) setDispatchFromAddress2(c2);
      if (!dispatchFromPincode  && companyProfile.pincode) setDispatchFromPincode(String(companyProfile.pincode));
      if (!dispatchFromState && companyProfile.state && INDIAN_STATES.includes(companyProfile.state)) {
        setDispatchFromState(companyProfile.state);
      }
    }
  }

  // ── Ship To prefill ─ fires when a party is selected and Dispatch section is open ─────────────────────────────────────────────────────────
  // Only prefills when the target fields are still empty — user edits win.
  const [shipToPrefillDeps, setShipToPrefillDeps] = useState<unknown[] | null>(null);
  if (
    !shipToPrefillDeps || shipToPrefillDeps[0] !== party || shipToPrefillDeps[1] !== parties ||
    shipToPrefillDeps[2] !== showDispatch
  ) {
    setShipToPrefillDeps([party, parties, showDispatch]);
    if (showDispatch && party) {
      const p = parties.find(x => x.value === party);
      const pd: any = p?.data || {};
      const [l1, l2] = String(pd.address || '').split(/\r?\n/).map((l: string) => l.trim());
      if (!shipToAddress1 && l1) setShipToAddress1(l1);
      if (!shipToAddress2 && l2) setShipToAddress2(l2);
      if (!shipToPincode  && pd.pincode) setShipToPincode(String(pd.pincode));
      if (!shipToState && pd.state_name && INDIAN_STATES.includes(pd.state_name)) {
        setShipToState(pd.state_name);
      }
    }
  }

  const [prevIsProforma, setPrevIsProforma] = useState(isProforma);
  if (prevIsProforma !== isProforma) {
    setPrevIsProforma(isProforma);
    if (isProforma) setEntryType('optional');
  }

  const routeParams = useLocalSearchParams<{ party?: string }>();
  const [routePartyApplied, setRoutePartyApplied] = useState(false);
  if (!routePartyApplied) {
    setRoutePartyApplied(true);
    if (routeParams?.party) setParty(routeParams.party as string);
  }

  // ── Draft: check for saved draft on mount ────────────────────────────────
  useEffect(() => {
    if (!company?.guid) return;
    const key = draftKey();
    const convertKey = proformaPrefillStorageKey(company.guid);
    dropLegacyKeys([legacyDraftKey(), legacyProformaPrefillKey(company.guid)]);
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
    const key = currentTenantKey(company.guid, prefillFeature('tdso'));
    dropLegacyKeys([`tdso_to_invoice_prefill_${company.guid}`]);
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
        Toast.show({ type: 'success', text1: t('screens.salesCreateInvoice.soLoaded'), text2: t('screens.salesCreateInvoice.soLoadedMsg') });
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
        Toast.show({ type: 'success', text1: t('screens.salesCreateInvoice.proformaLoaded'), text2: t('screens.salesCreateInvoice.proformaLoadedMsg') });
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
      AsyncStorage.setItem(draftKey(), JSON.stringify(draft)).catch(() => {});
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
    AsyncStorage.getItem(draftKey()).then(raw => {
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
    AsyncStorage.removeItem(draftKey()).catch(() => {});
    setShowDraftBanner(false);
  }, [company?.guid]);

  const clearDraftOnSubmit = useCallback(() => {
    if (!company?.guid) return;
    AsyncStorage.removeItem(draftKey()).catch(() => {});
  }, [company?.guid]);

  // Due date auto-calc
  const [dueDateDeps, setDueDateDeps] = useState<unknown[] | null>(null);
  if (!dueDateDeps || dueDateDeps[0] !== payTerms || dueDateDeps[1] !== date || dueDateDeps[2] !== customDays) {
    setDueDateDeps([payTerms, date, customDays]);
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
  }

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
      hsn: si?.hsn || undefined,
      warehouse: '',
    } : i));
    if (!si || !companyGuid) {
      if (warehouses.length === 1) updateItem(itemId, 'warehouse', warehouses[0].name);
      return;
    }
    try {
      // Use guid (Tally GUID) for the godowns lookup — NOT numeric id which may be undefined
      const stockIdentifier = si.guid || '';
      const res: any = await getStockGodowns(companyGuid, stockIdentifier);
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
  }, [stockItems, companyGuid, warehouses, updateItem]);

  const handleProductClear = useCallback((itemId: string) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, product: '', unit: 'pcs', rate: '', warehouse: '', hsn: undefined } : i));
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
      if (!ledger) { Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errSalesLedger') }); return; }
      if (!party) { Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errCustomerParty') }); return; }
      setStep(2);
    } else if (step === 2) {
      const filledItems = items.filter(i => i.product && (parseFloat(i.qty) || 0) > 0 && (parseFloat(i.rate) || 0) > 0);
      if (filledItems.length === 0) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errAddItem') }); return;
      }
      if (items.some(i => i.product && (!(parseFloat(i.qty) > 0) || !(parseFloat(i.rate) > 0)))) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errQtyRate') }); return;
      }
      const multiWarehouseItems = items.filter(i => i.product && (itemGodowns[i.id]?.length || 0) > 1);
      if (multiWarehouseItems.some(i => !i.warehouse)) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errSelectWarehouse') }); return;
      }
      setStep(3);
    }
  }, [step, ledger, party, items, itemGodowns, t]);

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
    if (filled.length === 0) return t(items.length !== 1 ? 'screens.salesCreateInvoice.notFilledMany' : 'screens.salesCreateInvoice.notFilledOne', { n: items.length });
    const first = stockItems.find(si => si.name === filled[0].product);
    const firstName = first?.displayName || filled[0].product;
    if (filled.length === 1) return firstName;
    return t('screens.salesCreateInvoice.plusMore', { name: firstName, n: filled.length - 1 });
  }, [items, stockItems, t]);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!assertCanCreate('sales_invoice.create')) return;
    // Dismiss any open keyboard before validation / submit — prevents the keyboard from
    // hovering over the success modal when user submits with a text field still focused.
    Keyboard.dismiss();
    if (submittingRef.current) return;
    if (!party) { Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errCustomer') }); return; }
    if (items.some(i => !i.product)) { Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errProduct') }); return; }
    const multiWarehouseItems = items.filter(i => i.product && (itemGodowns[i.id]?.length || 0) > 1);
    if (multiWarehouseItems.some(i => !i.warehouse)) { Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errWarehouse') }); return; }
    if (ewbRequired && showDispatch) {
      if (!dispatchFrom || !shipTo) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errDispatch'), text2: t('screens.salesCreateInvoice.errDispatchMsg') });
        return;
      }
      if (!dispatchFromAddress1?.trim() || !shipToAddress1?.trim()) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errAddress'), text2: t('screens.salesCreateInvoice.errAddressMsg') });
        return;
      }
      const isValidPin = (p: string) => /^\d{6}$/.test(String(p || '').trim());
      if (!isValidPin(dispatchFromPincode) || !isValidPin(shipToPincode)) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errPincode'), text2: t('screens.salesCreateInvoice.errPincodeMsg') });
        return;
      }
    }
    if (!isProforma && collectPayNow && !payNowLedger) {
      Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errPayLedger'), text2: t('screens.salesCreateInvoice.errPayLedgerMsg') });
      return;
    }
    if (!isProforma && collectPayNow && payNowLedger) {
      const pAmt = parseFloat(payNowAmount) || 0;
      if (pAmt <= 0) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errPayAmount'), text2: t('screens.salesCreateInvoice.errPayAmountMsg') });
        return;
      }
      if (pAmt > totals.grand) {
        Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.errPayExceeds'), text2: t('screens.salesCreateInvoice.errPayExceedsMsg', { paid: pAmt.toLocaleString('en-IN'), total: totals.grand.toLocaleString('en-IN') }) });
        return;
      }
    }

    const okNeg = await confirmIfNegativeStockRisk({
      companyGuid: company?.guid,
      lines: items.filter(i => i.product).map(i => {
        const master = stockItems.find(s => s.name === i.product);
        return {
          name: i.product,
          qty: parseFloat(i.qty) || 0,
          available: master != null ? parseFloat(String((master as any).closing_qty ?? (master as any).qty ?? NaN)) : undefined,
        };
      }),
    });
    if (!okNeg) return;

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
          hsn: item.hsn || stockItems.find(s => s.name === item.product)?.hsn || undefined,
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

      if (!result?.status) throw new Error(result?.message || t('screens.salesCreateInvoice.submitFailedLower'));
      if (convertProformaTdkRef && result?.data?.status === false) {
        throw new Error(result?.data?.message || result?.message || t('screens.salesCreateInvoice.tallyNotUpdated'));
      }

      const tdkRef = result?.tdkReferenceNo || result?.data?.tdkReferenceNo || convertProformaTdkRef || '';
      const isQueued = result?.queued === true;
      const invoiceUuid = result?.invoiceUuid || result?.data?.invoiceUuid || undefined;
      const respNumberingPolicy = result?.numberingPolicy || numberingPolicy;
      const invoiceNumber = result?.invoiceNumber || result?.data?.invoiceNumber || undefined;
      setSubmitResult({ tdkRef, isQueued, message: result?.message || '', invoiceUuid, numberingPolicy: respNumberingPolicy, invoiceNumber });
      setShowSuccess(true);
      clearDraftOnSubmit();
      // Clear button spinner; keep submittingRef locked against double-submit.
      setSubmitting(false);
      return;
    } catch (err: any) {
      Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.submitFailed'), text2: err?.message || t('screens.salesCreateInvoice.checkTally') });
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    party, items, itemGodowns, ewbRequired, showDispatch, dispatchFrom, shipTo,
    company, date, ledger, entryType, totals.grand, refNo, narration, warehouses,
    collectPayNow, payNowMode, payNowAmount, payNowRef, payNowLedger, logEntries, roundOffLedger, roundOffAmount,
    transportMode, transporterName, transporterId, vehicleNumber, vehicleType, transportDocNo, transportDocDate,
    dispatchFromState, shipToState,
    numberingPolicy, againstOrderNo, isProforma, convertProformaTdkRef, t,
  ]);

  const handleConvertProformaFromSuccess = useCallback(async () => {
    if (!companyGuid || !submitResult?.tdkRef) return;
    try {
      const prefill = buildProformaToInvoicePrefillFromForm({
        party, ledger, date, refNo, narration, termsText,
        items, logEntries, roundOffLedger, roundOffAmount, dueDate,
        tdkRef: submitResult.tdkRef,
        tallyVoucherNo: submitResult.invoiceNumber,
      });
      await AsyncStorage.setItem(proformaPrefillStorageKey(companyGuid), JSON.stringify(prefill));
      setShowSuccess(false);
      router.replace('/sales/create-invoice');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.startInvoiceFailed'), text2: err?.message || '' });
    }
  }, [companyGuid, submitResult, party, ledger, date, refNo, narration, termsText, items, logEntries, roundOffLedger, roundOffAmount, dueDate, router, t]);

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!allowed) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Draft Restore Banner */}
      {showDraftBanner && (
        <View style={s.draftBanner}>
          <Ionicons name="save-outline" size={15} color="#92400E" />
          <Text style={s.draftBannerTxt}>{t('screens.salesCreateInvoice.draftBanner')}</Text>
          <TouchableOpacity onPress={restoreDraft} style={s.draftBannerBtn}>
            <Text style={s.draftBannerBtnTxt}>{t('screens.salesCreateInvoice.resume')}</Text>
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
              ? t('screens.salesCreateInvoice.alwaysOptional')
              : (convertProformaTdkRef
                ? (convertTallyVoucherNo || t('screens.salesCreateInvoice.fromProforma'))
                : (invoiceNo || 'INV-Auto'))}
          </Text>
        </View>
        {!isProforma && !convertProformaTdkRef && <RegularOptionalToggle value={entryType} onChange={setEntryType} entryMode={entryMode} />}
      </View>

      <StepIndicator step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'android' ? 120 : 0}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>

          {/* ═══════════ STEP 1 ═══════════ */}
          {step === 1 && (
            <>
              <BottomSheetSearch
                label={t('screens.salesCreateInvoice.salesLedger')} required
                placeholder={t('screens.salesCreateInvoice.searchLedger')}
                options={salesLedgers.map(l => ({ label: l.name, value: l.name }))}
                value={ledger}
                onSelect={opt => setLedger(opt.value)}
                onClear={() => setLedger('')}
                sheetTitle={t('screens.salesCreateInvoice.salesLedger')}
                icon="book-outline"
              />
              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.cardTitle}>{isProforma ? t('screens.salesCreateInvoice.proformaDetails') : t('screens.salesCreateInvoice.invoiceDetails')}</Text>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{isProforma ? t('screens.salesCreateInvoice.proformaNo') : t('screens.salesCreateInvoice.invoiceNo')}</Text>
                    <View style={s.autoBox}>
                      <Text style={s.autoTxt}>{invoiceNo || t('screens.salesCreateInvoice.auto')}</Text>
                      <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>{t('voucher.date')} <Text style={s.star}>*</Text></Text>
                    {entryType === 'regular' && !isProforma ? (
                      <View style={[s.autoBox, { opacity: 0.55 }]}>
                        <Text style={s.autoTxt}>{date}</Text>
                        <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                      </View>
                    ) : (
                      <TouchableOpacity style={s.fInput} onPress={() => setShowDatePicker(true)}>
                        <Text style={{ color: date ? COLORS.textPrimary : COLORS.textTertiary }}>{date || t('screens.salesCreateInvoice.selectDate')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
              <BottomSheetSearch
                label={t('screens.salesCreateInvoice.customerParty')} required
                placeholder={t('screens.salesCreateInvoice.searchCustomer')}
                options={parties}
                value={party}
                onSelect={opt => {
                  setParty(opt.value);
                  setPartyGstin(opt.data?.gstin || '');
                  setPartyGstRegType(opt.data?.gst_registration_type || '');
                }}
                onClear={() => { setParty(''); setPartyGstin(''); setPartyGstRegType(''); }}
                sheetTitle={t('screens.salesCreateInvoice.customerParty')}
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
                  <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary }}>{t('screens.salesCreateInvoice.noGstin')}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => addCustomerRef.current?.present()}
                  activeOpacity={0.6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 2, paddingHorizontal: 2 }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} />
                  <Text style={{ fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' }}>
                    {t('screens.salesCreateInvoice.addNewCustomer')}
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
                <Text style={s.sectionTitle}>{t('screens.salesCreateInvoice.itemsServices')}</Text>
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
                    safePush(router, `/stocks/barcode-scanner?mode=pick&companyGuid=${encodeURIComponent(company?.guid || '')}` as any);
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
                <Text style={s.addItemTxt}>{t('screens.salesCreateInvoice.addItem')}</Text>
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
                <Text style={s.runTotalTitle}>{t('screens.salesCreateInvoice.runningTotal')}</Text>
                <View style={s.runTotalRow}>
                  <Text style={s.runTotalLabel}>{t('screens.salesCreateInvoice.itemsSubtotal')}</Text>
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
                    <Text style={s.runTotalLabel}>{t('screens.salesCreateInvoice.charges')}</Text>
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
                      <Text style={s.payNowTitle}>{t('screens.salesCreateInvoice.collectPayment')}</Text>
                      <Text style={s.payNowSub}>{t('screens.salesCreateInvoice.collectPaymentSub')}</Text>
                    </View>
                  </View>
                  <BrandSwitch value={collectPayNow} onValueChange={setCollectPayNow} />
                </TouchableOpacity>
                {collectPayNow && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    <FormDropdown label={t('screens.salesCreateInvoice.modeOfPayment')} value={payNowMode} options={loc(PAY_MODES)} onSelect={(o: any) => {
                      setPayNowMode(o.value);
                      setPayNowLedger(''); // always clear — user must pick correct ledger
                    }} placeholder={t('screens.salesCreateInvoice.selectPayMode')} required />
                    {/* Payment Ledger picker — filtered by mode type */}
                    {bankLedgers.length === 0 ? (
                      <TouchableOpacity
                        onPress={fetchBankLedgers}
                        style={{ paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.warning, borderRadius: 8, backgroundColor: '#FFF8E1', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="refresh-outline" size={16} color={COLORS.warning} />
                        <Text style={{ color: COLORS.warning, fontWeight: '600', fontSize: 13, flex: 1 }}>
                          {t('screens.salesCreateInvoice.payLedgersNotLoaded')}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <BottomSheetSearch
                        label={t('screens.salesCreateInvoice.paymentLedger')}
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
                          !payNowMode ? t('screens.salesCreateInvoice.selectModeFirst') :
                          payNowMode === 'cash' ? t('screens.salesCreateInvoice.selectCashLedger') :
                          t('screens.salesCreateInvoice.selectBankLedger')
                        }
                        sheetTitle={t('screens.salesCreateInvoice.paymentLedger')}
                      />
                    )}
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>{t('screens.salesCreateInvoice.amountReceived')}</Text>
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
                        <Text style={s.fLabel}>{t('screens.salesCreateInvoice.referenceNo')}</Text>
                        <TextInput style={s.fInput} value={payNowRef} onChangeText={setPayNowRef} placeholder={t('screens.salesCreateInvoice.txnPlaceholder')} placeholderTextColor={COLORS.textTertiary} />
                      </View>
                    </View>
                    <View style={[s.payStatusChip, paymentStatus === 'paid' ? s.payStatusPaid : paymentStatus === 'partial' ? s.payStatusPartial : s.payStatusPending]}>
                      <Ionicons name={paymentStatus === 'paid' ? 'checkmark-circle' : paymentStatus === 'partial' ? 'time-outline' : 'alert-circle-outline'} size={16} color={paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative} />
                      <Text style={[s.payStatusTxt, { color: paymentStatus === 'paid' ? COLORS.positive : paymentStatus === 'partial' ? COLORS.warning : COLORS.negative }]}>
                        {paymentStatus === 'paid' ? t('screens.salesCreateInvoice.fullyPaid') : paymentStatus === 'partial' ? t('screens.salesCreateInvoice.partialRemaining', { amount: (totals.grand - (parseFloat(payNowAmount) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 }) }) : t('screens.salesCreateInvoice.enterPayAmount')}
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
                      <Text style={s.payNowTitle}>{t('screens.salesCreateInvoice.dispatchTitle')}</Text>
                      <Text style={s.payNowSub}>{t('screens.salesCreateInvoice.dispatchSub')}</Text>
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
                          label={t('screens.salesCreateInvoice.dispatchState')}
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
                          placeholder={t('screens.salesCreateInvoice.selectState')}
                          sheetTitle={t('screens.salesCreateInvoice.dispatchState')}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label={t('screens.salesCreateInvoice.dispatchFrom')}
                          options={getCitiesForState(dispatchFromState).map(c => ({ label: c, value: c }))}
                          value={dispatchFrom}
                          onSelect={(opt) => setDispatchFrom(opt.value)}
                          onClear={() => setDispatchFrom('')}
                          placeholder={dispatchFromState ? t('screens.salesCreateInvoice.selectCity') : t('screens.salesCreateInvoice.selectStateFirst')}
                          sheetTitle={t('screens.salesCreateInvoice.dispatchCity')}
                          disabled={!dispatchFromState}
                        />
                      </View>
                    </View>
                    {/* Dispatch From: Address Line 1 (required for EWB) */}
                    <Text style={s.fLabel}>{t('screens.salesCreateInvoice.dispatchAddr1')}{ewbRequired ? ' *' : ''}</Text>
                    <ThemedFInput
                      value={dispatchFromAddress1}
                      onChangeText={setDispatchFromAddress1}
                      placeholder={t('screens.salesCreateInvoice.addrPlaceholder')}
                    />
                    <Text style={s.fLabel}>{t('screens.salesCreateInvoice.dispatchAddr2')}</Text>
                    <ThemedFInput
                      value={dispatchFromAddress2}
                      onChangeText={setDispatchFromAddress2}
                      placeholder={t('screens.salesCreateInvoice.landmarkPlaceholder')}
                    />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>{t('screens.salesCreateInvoice.dispatchPincode')}{ewbRequired ? ' *' : ''}</Text>
                        <ThemedFInput
                          value={dispatchFromPincode}
                          onChangeText={(v) => setDispatchFromPincode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                          keyboardType="numeric"
                          placeholder={t('screens.salesCreateInvoice.pincodePlaceholder')}
                          maxLength={6}
                        />
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>
                    {/* Ship To: State (left, dropdown) → City (right, dropdown filtered by state) */}
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label={t('screens.salesCreateInvoice.shipToState')}
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
                          placeholder={t('screens.salesCreateInvoice.selectState')}
                          sheetTitle={t('screens.salesCreateInvoice.shipToState')}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <BottomSheetSearch
                          label={t('pdf.shipTo')}
                          options={getCitiesForState(shipToState).map(c => ({ label: c, value: c }))}
                          value={shipTo}
                          onSelect={(opt) => setShipTo(opt.value)}
                          onClear={() => setShipTo('')}
                          placeholder={shipToState ? t('screens.salesCreateInvoice.selectCity') : t('screens.salesCreateInvoice.selectStateFirst')}
                          sheetTitle={t('screens.salesCreateInvoice.shipToCity')}
                          disabled={!shipToState}
                        />
                      </View>
                    </View>
                    {/* Ship To: Address Line 1 (required for EWB) */}
                    <Text style={s.fLabel}>{t('screens.salesCreateInvoice.shipToAddr1')}{ewbRequired ? ' *' : ''}</Text>
                    <ThemedFInput
                      value={shipToAddress1}
                      onChangeText={setShipToAddress1}
                      placeholder={t('screens.salesCreateInvoice.addrPlaceholder')}
                    />
                    <Text style={s.fLabel}>{t('screens.salesCreateInvoice.shipToAddr2')}</Text>
                    <ThemedFInput
                      value={shipToAddress2}
                      onChangeText={setShipToAddress2}
                      placeholder={t('screens.salesCreateInvoice.landmarkPlaceholder')}
                    />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>{t('screens.salesCreateInvoice.shipToPincode')}{ewbRequired ? ' *' : ''}</Text>
                        <ThemedFInput
                          value={shipToPincode}
                          onChangeText={(v) => setShipToPincode(v.replace(/[^0-9]/g, '').slice(0, 6))}
                          keyboardType="numeric"
                          placeholder={t('screens.salesCreateInvoice.pincodePlaceholder')}
                          maxLength={6}
                        />
                      </View>
                      <View style={{ flex: 1 }} />
                    </View>
                    {/* Transport Mode dropdown */}
                    <FormDropdown
                      label={t('screens.salesCreateInvoice.transportMode')}
                      value={transportMode}
                      options={loc(TRANSPORT_MODES)}
                      onSelect={(o: any) => {
                        setTransportMode(o.value);
                        // Reset Vehicle Type to first valid option for the new mode
                        const firstVt = VEHICLE_TYPE_MAP[o.value]?.[0]?.value || 'Regular';
                        setVehicleType(firstVt);
                      }}
                      placeholder={t('screens.salesCreateInvoice.selectTransportMode')}
                    />
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>{t('screens.salesCreateInvoice.transporterName')}</Text><ThemedFInput value={transporterName} onChangeText={setTransporterName} placeholder={t('common.optional')} /></View>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>{t('screens.salesCreateInvoice.transporterId')}</Text><ThemedFInput value={transporterId} onChangeText={setTransporterId} placeholder={t('screens.salesCreateInvoice.gstinIdPlaceholder')} /></View>
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>{t('screens.salesCreateInvoice.vehicleNumber')}</Text><ThemedFInput value={vehicleNumber} onChangeText={v => setVehicleNumber(v.toUpperCase())} placeholder={t('screens.salesCreateInvoice.vehiclePlaceholder')} /></View>
                      <View style={{ flex: 1 }}>
                        {/* Vehicle Type dropdown — options mapped to selected Transport Mode */}
                        <FormDropdown
                          label={t('screens.salesCreateInvoice.vehicleType')}
                          value={vehicleType}
                          options={loc(VEHICLE_TYPE_MAP[transportMode] || VEHICLE_TYPE_MAP.Road)}
                          onSelect={(o: any) => setVehicleType(o.value)}
                          placeholder={t('screens.salesCreateInvoice.selectVehicleType')}
                        />
                      </View>
                    </View>
                    <View style={s.row2}>
                      <View style={{ flex: 1 }}><Text style={s.fLabel}>{t('screens.salesCreateInvoice.docNo')}</Text><ThemedFInput value={transportDocNo} onChangeText={setTransportDocNo} placeholder={t('common.optional')} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>{t('screens.salesCreateInvoice.docDate')}</Text>
                        <TouchableOpacity style={[s.fInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setShowTransportDocDatePicker(true)}>
                          <Text style={{ color: transportDocDate ? COLORS.textPrimary : COLORS.textTertiary, fontSize: TYPOGRAPHY.base }}>
                            {transportDocDate
                              ? (transportDocDate.includes('-')
                                  ? (() => { const [y, m, d] = transportDocDate.split('-'); return `${d}/${m}/${y.slice(2)}`; })()
                                  : transportDocDate)
                              : t('common.optional')}
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
                      <Text style={s.payNowTitle}>{t('screens.salesCreateInvoice.paymentTerms')}</Text>
                    </View>
                  </View>
                  <Ionicons name={payTermsExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
                {payTermsExpanded && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    <FormDropdown
                      label={t('screens.salesCreateInvoice.terms')}
                      value={payTerms}
                      options={loc(TERMS)}
                      onSelect={(o: any) => setPayTerms(o.value)}
                      placeholder={t('screens.salesCreateInvoice.selectPayTerms')}
                    />
                    {payTerms === 'custom' && (
                      <View style={s.customDaysRow}>
                        <ThemedFInput style={{ flex: 1 }} value={customDays} onChangeText={setCustomDays} keyboardType="numeric" placeholder={t('screens.salesCreateInvoice.enterDays')} />
                        <View style={s.daysBadge}><Text style={s.daysBadgeTxt}>{t('screens.salesCreateInvoice.days')}</Text></View>
                      </View>
                    )}
                    <View style={[s.row2, { marginTop: SPACING.sm }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.fLabel}>{t('pdf.dueDate')}</Text>
                        {payTerms === 'due_on_receipt' ? (
                          <View style={[s.autoBox, { opacity: 0.8 }]}>
                            <Text style={[s.autoTxt, { color: COLORS.textSecondary }]}>{t('screens.salesCreateInvoice.sameAsInvoiceDate')}</Text>
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
                        <Text style={s.fLabel}>{t('screens.salesCreateInvoice.referenceNo')}</Text>
                        <ThemedFInput value={refNo} onChangeText={setRefNo} placeholder={t('common.optional')} />
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* 4. Invoice Summary */}
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>{t('screens.salesCreateInvoice.invoiceSummary')}</Text>
                <View style={s.summaryRow}>
                  <Text style={s.sumLabel}>{t('screens.salesCreateInvoice.subtotalGross')}</Text>
                  <Text style={s.sumVal}>₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
                {totals.discTotal > 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>{t('pdf.discount')}</Text>
                    <Text style={[s.sumVal, { color: COLORS.positive }]}>-₹{totals.discTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {totals.taxTotal > 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>{t('pdf.tax')}</Text>
                    <Text style={s.sumVal}>₹{totals.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {totals.logisticsTotal > 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>{t('screens.salesCreateInvoice.logisticsCharges')}</Text>
                    <Text style={s.sumVal}>₹{totals.logisticsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                {totals.roundOff !== 0 && (
                  <View style={s.summaryRow}>
                    <Text style={s.sumLabel}>{t('pdf.roundOff')}</Text>
                    <Text style={s.sumVal}>₹{totals.roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                  </View>
                )}
                <View style={s.sumDivider} />
                <View style={s.summaryRow}>
                  <Text style={s.grandLabel}>{t('pdf.grandTotal')}</Text>
                  <Text style={s.grandVal}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>

              {/* 5. Notes & Terms */}
              <View style={s.card} onLayout={(e) => { notesCardY.current = e.nativeEvent.layout.y; }}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>{t('screens.salesCreateInvoice.notesTerms')}</Text>
                </View>
                <View onLayout={(e) => { narrationOffset.current = e.nativeEvent.layout.y; }}>
                  <FormField
                    label={t('voucher.narration')}
                    value={narration}
                    onChangeText={setNarration}
                    placeholder={t('screens.salesCreateInvoice.internalNotes')}
                    multiline
                    numberOfLines={2}
                    style={{ minHeight: 60, textAlignVertical: 'top' } as any}
                    onFocus={() => scrollToFieldY(narrationOffset.current)}
                  />
                </View>
                <View onLayout={(e) => { termsOffset.current = e.nativeEvent.layout.y; }}>
                  <FormField
                    label={t('pdf.terms')}
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

        {/* Footer — hide under success so Submitting/total never bleed through */}
        {!showSuccess && (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 3 && (
            <View style={s.grandTotalBar}>
              <View>
                <Text style={s.grandTotalMeta}>
                  {t(items.filter(i => i.product).length !== 1 ? 'screens.salesCreateInvoice.metaItemsMany' : 'screens.salesCreateInvoice.metaItemsOne', { n: items.filter(i => i.product).length })} · {party || t('screens.salesCreateInvoice.noCustomer')}
                </Text>
                <Text style={s.grandTotalLabel}>{t('pdf.grandTotal')}</Text>
              </View>
              <Text style={s.grandTotalAmt} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}
          <View style={s.footerBtnRow}>
            {step === 1 && (
              <TouchableOpacity style={s.fullNextBtn} onPress={goNext} activeOpacity={0.7}>
                <Text style={s.nextBtnTxt}>{t('screens.salesCreateInvoice.nextAddItems')}</Text>
              </TouchableOpacity>
            )}
            {step === 2 && (
              <>
                <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                  <Text style={s.backOutlineTxt}>{t('screens.salesCreateInvoice.backDetails')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.nextBtn} onPress={goNext} activeOpacity={0.7}>
                  <Text style={s.nextBtnTxt}>{t('screens.salesCreateInvoice.nextReview')}</Text>
                </TouchableOpacity>
              </>
            )}
            {step === 3 && (
              <>
                <TouchableOpacity style={s.backOutlineBtn} onPress={goBack} activeOpacity={0.7}>
                  <Text style={s.backOutlineTxt}>{t('screens.salesCreateInvoice.backItems')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} activeOpacity={0.7} disabled={submitting}>
                  {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />}
                  <Text style={s.submitTxt}>{submitting ? t('voucher.submitting') : t('screens.salesCreateInvoice.submitInvoice')}</Text>
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

      <DatePickerModal visible={showDatePicker} value={date} minDate={fyStart} maxDate={todayLocalISO()} onSelect={(d) => { setDate(d); setShowDatePicker(false); }} onClose={() => setShowDatePicker(false)} />
      <DatePickerModal visible={showTransportDocDatePicker} value={transportDocDate || todayStr()} maxDate={todayLocalISO()} onSelect={(d) => { setTransportDocDate(d); setShowTransportDocDatePicker(false); }} onClose={() => setShowTransportDocDatePicker(false)} />

      <AddCustomerDrawer
        ref={addCustomerRef}
        company={company}
        onClose={() => {}}
        onSaved={(name, success) => {
          const newOpt: BSSOption = { label: name, value: name };
          setParties(prev => [...prev, newOpt]);
          setParty(name);
          if (success !== false) Alert.alert(t('screens.salesCreateInvoice.customerAdded'), t('screens.salesCreateInvoice.customerAddedMsg', { name }));
        }}
      />

      {/* Success Overlay — full-screen Modal + flex backdrop (absoluteFill collapses inside Modal) */}
      <Modal
        visible={!!(showSuccess && submitResult)}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => {
          setShowSuccess(false);
          setSharePdfLoading(false);
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
            <Text style={ss.title}>{submitResult?.isQueued ? t('screens.salesCreateInvoice.savedPending') : (isProforma ? t('screens.salesCreateInvoice.proformaSubmitted') : (convertProformaTdkRef ? t('screens.salesCreateInvoice.convertedTitle') : t('screens.salesCreateInvoice.invoiceSubmitted')))}</Text>
            <Text style={ss.sub}>
              {submitResult?.isQueued
                ? t('screens.salesCreateInvoice.queuedSub')
                : (isProforma ? t('screens.salesCreateInvoice.proformaSub') : (convertProformaTdkRef ? t('screens.salesCreateInvoice.convertedSub') : t('screens.salesCreateInvoice.invoiceSub')))}
            </Text>
            {/* TallyDekho Series: show invoice number immediately */}
            {!!submitResult?.invoiceNumber && (
              <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                <Text style={ss.refLabel}>{t('screens.salesCreateInvoice.invoiceNo')}</Text>
                <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult.invoiceNumber}</Text>
              </View>
            )}
            {!!submitResult?.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>{t('screens.salesCreateInvoice.referenceNo')}</Text>
                <Text style={ss.refVal}>{submitResult.tdkRef}</Text>
              </View>
            )}

            {/* Preview — opens instantly with provisional/final data */}
            <TouchableOpacity
              style={ss.previewBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!submitResult?.tdkRef) return;
                const typeQ = isProforma ? '&type=proforma_invoice' : '&type=sales_invoice';
                setShowSuccess(false);
                safePush(router, `/sales/invoice-preview?tdkRef=${encodeURIComponent(submitResult.tdkRef)}${typeQ}` as any);
              }}
            >
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>{t('screens.salesCreateInvoice.preview')}</Text>
            </TouchableOpacity>

            {/* Share PDF — waits up to 10s for Tally number (TALLY_PRIME_SERIES) */}
            {canSharePdf ? (
            <TouchableOpacity
              style={[ss.pdfBtn, sharePdfLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              disabled={sharePdfLoading}
              onPress={async () => {
                if (!submitResult?.tdkRef || !company?.guid) return;
                setSharePdfLoading(true);
                try {
                  // TallyDekho Series: number is immediate — no wait needed
                  // TallyPrime Series: wait up to 10s for Tally to assign the number
                  const isTDSeries = submitResult.numberingPolicy === 'tallydekho_series';
                  const res = await invoiceSharePdf(submitResult.tdkRef, company.guid, !isTDSeries, isTDSeries ? 0 : 10000);
                  const docData = res?.data;
                  if (!docData) throw new Error(t('screens.salesCreateInvoice.noInvoiceData'));

                  const pdfDoc = toVoucherDocument(docData);
                  const fileName = docData.fileName
                    || `${pdfDoc.documentTitle.split(' - ')[0].replace(/\s+/g, '-')}-${submitResult.tdkRef}.pdf`;
                  await shareVoucherPdf(pdfDoc, {
                    companyGuid: company.guid,
                    fileName,
                    onBeforeShare: () => setSharePdfLoading(false),
                    fallback: async () => {
                      Toast.show({ type: 'info', text1: t('screens.salesCreateInvoice.sharingUnavailable') });
                    },
                  });
                } catch (err: any) {
                  Toast.show({ type: 'error', text1: t('screens.salesCreateInvoice.pdfError'), text2: err?.message || t('screens.salesCreateInvoice.pdfFailed') });
                } finally {
                  setSharePdfLoading(false);
                }
              }}
            >
              {sharePdfLoading
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Ionicons name="document-outline" size={18} color={COLORS.white} />}
              <Text style={ss.pdfBtnTxt}>{sharePdfLoading ? t('screens.salesCreateInvoice.pdfCreating') : t('pdf.sharePdf')}</Text>
            </TouchableOpacity>
            ) : null}

            {isProforma && !convertProformaTdkRef && (
              <TouchableOpacity
                style={ss.convertBtn}
                activeOpacity={0.85}
                onPress={handleConvertProformaFromSuccess}
              >
                <Ionicons name="repeat-outline" size={18} color={COLORS.white} />
                <Text style={ss.convertBtnTxt}>{t('screens.salesCreateInvoice.convertToSalesInvoice')}</Text>
              </TouchableOpacity>
            )}

            {/* Done — navigates away without waiting for Tally */}
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
  // Dim on flex root — absoluteFill inside transparent Modal collapses the scrim
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdrop: { flex: 1 },
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
