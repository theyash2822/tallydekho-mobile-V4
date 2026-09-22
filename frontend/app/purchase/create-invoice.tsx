import React, { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, Alert, TextInput, Modal, TextInputProps, ActivityIndicator, Keyboard, KeyboardAvoidingView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { barcodePicker } from '../../src/utils/barcodePicker';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { currentTenantKey, prefillFeature, dropLegacyKeys } from '../../src/utils/tenantStorage';
import {
  getParties, createPurchaseInvoice, getStocks, getWarehouses,
  getPurchaseLedgerAccounts, getTaxLedgers, createTallyParty,
  getChargeLedgers, getStockGodowns, getBankLedgers,
  invoiceSharePdf,
} from '../../src/services/api';
import { toVoucherDocument } from '../../src/utils/voucherDocumentAdapter';
import { shareVoucherPdf } from '../../src/utils/voucherPdf';
import { useNumberingPolicy } from '../../src/hooks/useNumberingPolicy';
import BrandSwitch from '../../src/components/forms/BrandSwitch';
import PartyForm, { PartyFormRef } from '../../src/components/forms/PartyForm';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle from '../../src/components/forms/RegularOptionalToggle';
import { useRbasCreate } from '../../src/hooks/useRbasCreate';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BottomSheetSearch, { BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { taxFieldsFromLedgerSelect, resolveTaxLedgerRate } from '../../src/utils/taxLedgerHelpers';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { todayLocalISO } from '../../src/utils/periodDates';
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
const PAY_MODES: DropdownOption[] = [
  { label: 'Cash', value: 'cash' },
  { label: 'NEFT', value: 'neft' },
  { label: 'RTGS', value: 'rtgs' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'UPI', value: 'upi' },
  { label: 'IMPS', value: 'imps' },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
  id?: number;
  guid?: string;
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

// ─── DateInput (simple, for optional dates outside DatePickerModal-only fields) ─
function DateInput({ label, value, onChange, minDate, maxDate }: { label: string; value: string; onChange: (v: string) => void; minDate?: string; maxDate?: string; }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fLabel}>{label}</Text>
      <TouchableOpacity style={[s.fInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]} onPress={() => setShow(true)} activeOpacity={0.7}>
        <Text style={{ fontSize: TYPOGRAPHY.base, color: value ? COLORS.textPrimary : COLORS.textTertiary }}>{value || 'DD/MM/YY'}</Text>
        <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <DatePickerModal visible={show} value={value || todayStr()} minDate={minDate} maxDate={maxDate} onSelect={(d) => { onChange(d); setShow(false); }} onClose={() => setShow(false)} title={label} />
    </View>
  );
}

// ─── StepIndicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const STEPS = [
    { num: 1 as const, label: 'Invoice Details' },
    { num: 2 as const, label: 'Items' },
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

// ─── AddVendorDrawer ──────────────────────────────────────────────────────────
export interface AddVendorDrawerMethods { present: () => void; }

const AddVendorDrawer = forwardRef<AddVendorDrawerMethods, {
  onClose: () => void;
  onSaved: (name: string, success?: boolean) => void;
  company?: { guid?: string; name?: string } | null;
}>(function AddVendorDrawer({ onClose, onSaved, company }, ref) {
  const sheetRef  = useRef<BottomSheetModal>(null);
  const formRef   = useRef<PartyFormRef>(null);
  const insets    = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['92%'], []);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
  }));

  const [name,    setName]    = useState('');
  const [openBal, setOpenBal] = useState('');
  const [isCr,    setIsCr]    = useState(true); // Sundry Creditors typically carry a Cr balance
  const [saving,  setSaving]  = useState(false);

  const resetForm = () => {
    setName(''); setOpenBal(''); setIsCr(true); setSaving(false);
    formRef.current?.reset();
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Vendor name is required.'); return; }
    setSaving(true);
    try {
      const pd = formRef.current?.getData();
      const address = [pd?.addressLine1, pd?.addressLine2].filter(Boolean).join('\n');
      const result = await createTallyParty({
        companyGuid:    company?.guid,
        companyName:    company?.name,
        partyName:      name.trim(),
        parent:         'Sundry Creditors',
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
        Alert.alert('Error', msg || 'Failed to create vendor. Please try again.');
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
        <View style={{ flex: 1 }}>
          <Text style={acd.title}>New Vendor</Text>
          <Text style={[acd.subtitle, { marginTop: 2 }]}>Sundry Creditors</Text>
        </View>
        <TouchableOpacity onPress={() => sheetRef.current?.dismiss()} style={acd.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[acd.body, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={acd.label}>Name <Text style={acd.star}>*</Text></Text>
        <BottomSheetTextInput
          style={acd.input as any}
          placeholder="Enter vendor name"
          placeholderTextColor={COLORS.textTertiary}
          value={name}
          onChangeText={setName}
        />

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

        <View style={acd.divider} />
        <View style={{ paddingBottom: SPACING.sm }}>
          <PartyForm ref={formRef} InputComponent={BottomSheetTextInput as any} />
        </View>
      </BottomSheetScrollView>

      <View style={[acd.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity style={[acd.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
          {saving && <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 8 }} />}
          <Text style={acd.saveBtnTxt}>{saving ? 'Saving...' : 'Save Vendor'}</Text>
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

  // Purchase = destination godown: show ALL company warehouses (not only those with qty>0).
  // Godown qty is shown as an on-hand hint when available.
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
          ? `On hand: ${Math.round(qtyByWh[w.name])} ${stockItem?.unit || 'units'}`
          : 'Receive stock here',
      }))
    : item.product
      ? [{ label: 'Main Location', value: 'Main Location', subtitle: 'Default warehouse' }]
      : [];
  const needsWarehouseDropdown = !!item.product && warehouseOpts.length >= 1;

  return (
    <View style={ir.card}>
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
          <View>
            <Text style={ir.fieldLabel}>Product <Text style={ir.star}>*</Text></Text>
            <View style={ir.productRow}>
              <View style={{ flex: 1 }}>
                <BottomSheetSearch
                  placeholder="Select product..."
                  options={stockOpts}
                  value={item.product}
                  onSelect={opt => onProductSelect(item.id, opt)}
                  onClear={() => onProductClear(item.id)}
                  sheetTitle="Product"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <TouchableOpacity style={ir.barcodeBtn} onPress={() => onBarcodePress(item.id)} activeOpacity={0.7}>
                <Ionicons name="scan-outline" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {item.product ? (
            needsWarehouseDropdown ? (
              <View>
                <Text style={ir.fieldLabel}>Receive in Warehouse <Text style={ir.star}>*</Text></Text>
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

          <View style={ir.qurRow}>
            <View style={ir.qtyBox}>
              <Text style={ir.miniLabel}>Billed Qty <Text style={ir.star}>*</Text></Text>
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
              <Text style={ir.miniLabel}>Unit</Text>
              <TouchableOpacity style={ir.unitBtn} onPress={() => onOpenModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
                <Text style={ir.unitTxt}>{item.unit || 'pcs'}</Text>
                <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
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

          <View style={ir.taxableRow}>
            <Text style={ir.taxableLabel}>Taxable Amount</Text>
            <Text style={ir.taxableVal}>₹{calc.taxable.toFixed(2)}</Text>
          </View>

          <View style={ir.taxSection}>
            <View style={ir.taxSectionHdr}>
              <Text style={ir.taxSectionTitle}>Taxes</Text>
              <Text style={ir.taxColHint}>Type · Rate % · Amount ₹</Text>
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
              <Text style={ir.addTaxDashedTxt}>Add Tax</Text>
            </TouchableOpacity>
          </View>

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
export default function CreatePurchaseInvoiceScreen() {
  const allowed = useRequireCapability('purchase_invoice.create');
  const { t } = useTranslation();
  const router = useRouter();
  const scrollRef = useRef<any>(null);
  // Scroll focused fields (e.g. narration) above the keyboard — same pattern as sales invoice.
  const notesCardY = useRef<number>(0);
  const narrationOffset = useRef<number>(0);
  const scrollToFieldY = (fieldOffset: number) => {
    setTimeout(() => {
      const absY = notesCardY.current + fieldOffset;
      scrollRef.current?.scrollTo?.({ y: Math.max(0, absY - 100), animated: true });
    }, 250);
  };
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const fyStart = selectedFY?.startDate || `${new Date().getFullYear()}-04-01`;

  // ── Core state ───────────────────────────────────────────────────────────────
  const {entryMode, entryType, setEntryType, scopeParties, scopeGodowns, assertCanCreate} = useRbasCreate();
  const [purchaseLedger, setPurchaseLedger] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [vendor, setVendor] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorGstRegType, setVendorGstRegType] = useState('');
  const [vendors, setVendors] = useState<BSSOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // API data
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [purchaseLedgers, setPurchaseLedgers] = useState<{ name: string; guid?: string }[]>([]);
  const [taxLedgers, setTaxLedgers] = useState<{ name: string; guid?: string; taxRate?: number }[]>([]);
  const [chargeLedgers, setChargeLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);
  const [roundOffLedgers, setRoundOffLedgers] = useState<{ ledgerName: string; guid?: string }[]>([]);

  // Per-item godowns (fetched when product selected)
  const [itemGodowns, setItemGodowns] = useState<Record<string, Godown[]>>({});

  const addVendorRef = useRef<AddVendorDrawerMethods>(null);
  const [vendorInvNo, setVendorInvNo] = useState('');
  const [vendorInvDate, setVendorInvDate] = useState('');
  const [purchaseRefNo, setPurchaseRefNo] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [roundOffLedger, setRoundOffLedger] = useState('');
  const [roundOffAmount, setRoundOffAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Auto-scroll to top whenever step changes
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [step]);

  // Make Payment Now
  const [makePayNow, setMakePayNow] = useState(false);
  const [payNowMode, setPayNowMode] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [payNowRef, setPayNowRef] = useState('');
  const [payNowLedger, setPayNowLedger] = useState('');
  const [bankLedgers, setBankLedgers] = useState<BSSOption[]>([]);

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ tdkRef: string; isQueued: boolean; message: string; invoiceUuid?: string; numberingPolicy?: string; invoiceNumber?: string } | null>(null);
  const [sharePdfLoading, setSharePdfLoading] = useState(false);

  // e-Invoice QR / Bill scan
  const [showCamera, setShowCamera] = useState(false);
  const [billAttachmentUri, setBillAttachmentUri] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  // Universal numbering — Settings → Voucher Config only (no on-screen override)
  const { numberingPolicy } = useNumberingPolicy(company?.guid);

  // Set when this invoice is created by converting a Purchase Order.
  // Sent to backend as `againstOrderNo` so the invoice can be traced back to its source order.
  const [againstOrderNo, setAgainstOrderNo] = useState('');

  // ── Purchase Order → Invoice prefill: "Convert to Purchase Invoice" writes this key
  //    before navigating here. Applied immediately (no banner).
  useEffect(() => {
    if (!company?.guid) return;
    const key = currentTenantKey(company.guid, prefillFeature('tdpo'));
    dropLegacyKeys([`tdpo_to_invoice_prefill_${company.guid}`]);
    AsyncStorage.getItem(key).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        const PREFILL_TTL_MS = 30 * 60 * 1000; // 30 minutes
        const isFresh = d?.savedAt && (Date.now() - d.savedAt) < PREFILL_TTL_MS;
        if (!isFresh) { AsyncStorage.removeItem(key).catch(() => {}); return; }
        // SO-shaped keys → PI state (party→vendor, ledger→purchaseLedger)
        if (d.party)          setVendor(d.party);
        if (d.ledger)         setPurchaseLedger(d.ledger);
        if (d.date)           setDate(d.date);
        if (d.refNo)          setPurchaseRefNo(d.refNo);
        if (d.narration)      setNarration(d.narration);
        if (d.items?.length)  setItems(d.items);
        if (d.logEntries?.length) setLogEntries(d.logEntries);
        if (d.roundOffLedger) setRoundOffLedger(d.roundOffLedger);
        if (d.roundOffAmount) setRoundOffAmount(d.roundOffAmount);
        // againstOrderNo must be Tally's Purchase Order voucher number (not a TDK- ref).
        if (d.againstOrderNo && !String(d.againstOrderNo).startsWith('TDK-')) {
          setAgainstOrderNo(d.againstOrderNo);
        }
        Toast.show({ type: 'success', text1: 'Purchase Order Loaded', text2: 'Review and submit to convert to an invoice.' });
      } catch { /* ignore bad prefill */ }
      AsyncStorage.removeItem(key).catch(() => {});
    }).catch(() => {});
  }, [company?.guid]);

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
        },
      })));
    }).catch(() => {});
  }, [company?.guid, scopeParties]);

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

  // Fetch bank/cash ledgers — used by Make Payment Now picker (Step 3)
  const fetchBankLedgers = useCallback(() => {
    if (!company?.guid) return;
    getBankLedgers(company.guid).then((res: any) => {
      const list: any[] = res?.data || [];
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
    }).catch(() => {
      Toast.show({ type: 'error', text1: 'Could not load payment ledgers', text2: 'Tap the picker to retry' });
    });
  }, [company?.guid]);

  useEffect(() => { fetchBankLedgers(); }, [fetchBankLedgers]);

  useEffect(() => {
    if (step === 3 && bankLedgers.length === 0 && company?.guid) fetchBankLedgers();
  }, [step, bankLedgers.length, company?.guid, fetchBankLedgers]);

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

  const handleProductSelect = useCallback(async (itemId: string, opt: BSSOption) => {
    const si = stockItems.find(s => s.name === opt.value);
    // Destination warehouse: auto-pick only when company has exactly one warehouse.
    const autoWh = warehouses.length === 1 ? warehouses[0].name : '';
    setItems(prev => prev.map(i => i.id === itemId ? {
      ...i,
      product: opt.value,
      unit: si?.unit || i.unit,
      rate: si?.rate != null ? String(si.rate) : i.rate,
      warehouse: autoWh,
    } : i));
    if (!si || !company?.guid) return;
    try {
      // Prefer Tally GUID; backend also accepts stock name as fallback.
      const stockIdentifier = si.guid || si.name;
      const res: any = await getStockGodowns(company.guid, stockIdentifier);
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

  // ── QR / Bill scan ───────────────────────────────────────────────────────────
  const openQrScanner = useCallback(async () => {
    if (permission && !permission.granted && permission.canAskAgain) await requestPermission();
    scannedRef.current = false;
    setShowCamera(true);
  }, [permission, requestPermission]);

  const openBillScanner = useCallback(() => {
    Alert.alert('Scan / Upload Bill', 'Capture the vendor bill to attach it. Details must still be entered manually.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo', onPress: async () => {
          try {
            const camPerm = await ImagePicker.requestCameraPermissionsAsync();
            if (!camPerm.granted) {
              Toast.show({ type: 'error', text1: 'Permission required', text2: 'Allow camera access to photograph the bill.' });
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.75,
              allowsEditing: false,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setBillAttachmentUri(result.assets[0].uri);
              Toast.show({ type: 'success', text1: 'Bill photo attached', text2: 'Enter invoice details manually below.' });
            }
          } catch {
            Toast.show({ type: 'error', text1: 'Could not open camera' });
          }
        },
      },
      {
        text: 'Choose from Library', onPress: async () => {
          try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Toast.show({ type: 'error', text1: 'Permission required', text2: 'Allow photo library access to pick a bill image.' });
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.75,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setBillAttachmentUri(result.assets[0].uri);
              Toast.show({ type: 'success', text1: 'Bill attached', text2: 'Enter invoice details manually below.' });
            }
          } catch {
            Toast.show({ type: 'error', text1: 'Could not open photo library' });
          }
        },
      },
    ]);
  }, []);

  // Best-effort GST e-invoice QR payload parsing.
  const applyEInvoiceQrData = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw);
      const docNo = data.DocNo || data.Docno || data.docNo || data.doc_no;
      const docDt = data.DocDt || data.Docdt || data.docDt || data.doc_dt;
      const sellerGstin = data.SellerGstin || data.Seller_Gstin || data.SellerGSTIN;
      const buyerGstin = data.BuyerGstin || data.Buyer_Gstin || data.BuyerGSTIN;
      const itemList = data.ItemList || data.itemList || data.Items;

      if (docNo) setVendorInvNo(String(docNo));
      if (docDt) {
        const parsed = typeof docDt === 'string' && docDt.includes('-')
          ? (() => { const parts = docDt.split(/[-/]/); return parts.length === 3 ? `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2].slice(-2)}` : ''; })()
          : '';
        if (parsed) setVendorInvDate(parsed);
      }

      const parts: string[] = [];
      if (sellerGstin) parts.push(`Seller GSTIN: ${sellerGstin}`);
      if (buyerGstin) parts.push(`Buyer GSTIN: ${buyerGstin}`);
      if (Array.isArray(itemList) && itemList.length > 0) parts.push(`${itemList.length} item(s) found — add manually`);

      Toast.show({
        type: 'success',
        text1: 'e-Invoice QR scanned',
        text2: parts.length > 0 ? parts.join(' · ') : 'Vendor invoice details auto-filled where available.',
      });
    } catch {
      setVendorInvNo(raw.slice(0, 120));
      Toast.show({ type: 'info', text1: 'Could not parse QR as e-Invoice JSON', text2: 'Raw value saved to Vendor Invoice No.' });
    }
  }, []);

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowCamera(false);
    applyEInvoiceQrData(data);
  }, [applyEInvoiceQrData]);

  const closeCamera = useCallback(() => {
    scannedRef.current = false;
    setShowCamera(false);
  }, []);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (step === 1) {
      if (!purchaseLedger) { Toast.show({ type: 'error', text1: 'Purchase Ledger required' }); return; }
      if (!vendor) { Toast.show({ type: 'error', text1: 'Vendor / Party required' }); return; }
      setStep(2);
    } else if (step === 2) {
      const filledItems = items.filter(i => i.product && (parseFloat(i.qty) || 0) > 0 && (parseFloat(i.rate) || 0) > 0);
      if (filledItems.length === 0) {
        Toast.show({ type: 'error', text1: 'Add at least 1 item with qty and rate' }); return;
      }
      if (items.some(i => i.product && (!(parseFloat(i.qty) > 0) || !(parseFloat(i.rate) > 0)))) {
        Toast.show({ type: 'error', text1: 'All items need qty and rate' }); return;
      }
      // Match submit: any company warehouse list requires an explicit destination pick
      // (auto-filled when length === 1; user may still clear it).
      const needsWarehouse = items.filter(i => i.product && warehouses.length > 0);
      if (needsWarehouse.some(i => !i.warehouse)) {
        Toast.show({ type: 'error', text1: 'Select warehouse for all items' }); return;
      }
      setStep(3);
    }
  }, [step, purchaseLedger, vendor, items, warehouses]);

  const goBack = useCallback(() => {
    setStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3);
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

  const paymentStatus = useMemo(() => {
    if (!makePayNow) return 'pending';
    const paidAmt = parseFloat(payNowAmount) || 0;
    if (paidAmt <= 0) return 'pending';
    if (paidAmt >= totals.grand) return 'paid';
    return 'partial';
  }, [makePayNow, payNowAmount, totals.grand]);

  const unitOptions = useMemo(() => {
    const units = [...new Set(stockItems.map(i => i.unit).filter(Boolean))] as string[];
    return units.length > 0 ? units : ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
  }, [stockItems]);

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
    if (!assertCanCreate('purchase_invoice.create')) return;
    Keyboard.dismiss();
    if (submittingRef.current) return;
    if (!vendor) { Toast.show({ type: 'error', text1: 'Vendor required' }); return; }
    if (items.some(i => !i.product)) { Toast.show({ type: 'error', text1: 'All items need a product selected' }); return; }
    const needsWarehouse = items.filter(i => i.product && warehouses.length > 0);
    if (needsWarehouse.some(i => !i.warehouse)) { Toast.show({ type: 'error', text1: 'Warehouse required for all items' }); return; }
    if (makePayNow && !payNowLedger) {
      Toast.show({ type: 'error', text1: 'Payment Ledger required', text2: 'Select a Cash or Bank ledger for Make Payment Now.' });
      return;
    }
    if (makePayNow && payNowLedger) {
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

      const result: any = await createPurchaseInvoice({
        companyGuid: company?.guid, companyName: company?.name,
        date: dmyToISO(date),
        partyLedger: vendor,
        voucherType: 'Purchase',
        totalAmount: totals.grand,
        items: items.map(item => ({
          itemName: item.product,
          billedQty: parseFloat(item.qty) || 0,
          actualQty: parseFloat(item.qty) || 0,
          rate: parseFloat(item.rate) || 0,
          amount: calcItem(item).taxable,
          purchaseLedger,
          godown: item.warehouse || warehouses[0]?.name || 'Main Location',
          unit: item.unit || 'pcs',
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
        make_payment: makePayNow && payNowLedger ? {
          mode: payNowMode, ledgerName: payNowLedger,
          amount: parseFloat(payNowAmount) || 0, reference: payNowRef || undefined,
        } : null,
        isOptional: entryType === 'optional',
        original_entry_type: entryType,
        numbering_policy: numberingPolicy,
        narration: narration || undefined,
        reference: vendorInvNo || purchaseRefNo || undefined,
        vendorInvoiceNo: vendorInvNo || undefined,
        vendorInvoiceDate: vendorInvDate ? dmyToISO(vendorInvDate) : undefined,
        againstOrderNo: againstOrderNo || undefined,
      });

      const tdkRef = result?.tdkReferenceNo || result?.tdkRef || result?.data?.tdkReferenceNo || '';
      const isQueued = result?.queued === true;
      const invoiceUuid = result?.invoiceUuid || result?.data?.invoiceUuid || undefined;
      const respNumberingPolicy = result?.numberingPolicy || numberingPolicy;
      const invoiceNumber = result?.invoiceNumber || result?.data?.invoiceNumber || undefined;
      setSubmitResult({ tdkRef, isQueued, message: result?.message || '', invoiceUuid, numberingPolicy: respNumberingPolicy, invoiceNumber });
      setShowSuccess(true);
      setSubmitting(false);
      return;
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Submit Failed', text2: err?.message || 'Check Tally connection.' });
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    vendor, items, company, date, purchaseLedger, entryType, totals.grand, narration, warehouses,
    makePayNow, payNowMode, payNowAmount, payNowRef, payNowLedger, logEntries, roundOffLedger, roundOffAmount,
    numberingPolicy, vendorInvNo, vendorInvDate, purchaseRefNo, againstOrderNo,
  ]);

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
          <Text style={s.headerTitle}>{t('purchase.createInvoice')}</Text>
          <Text style={s.headerSub}>PINV-Auto</Text>
        </View>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} entryMode={entryMode} />
      </View>

      <StepIndicator step={step} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 120}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={Keyboard.dismiss}>

          {/* ═══════════ STEP 1 ═══════════ */}
          {step === 1 && (
            <>
              {/* Scan Banner */}
              <View style={s.scanCard}>
                <View style={s.scanTop}>
                  <View style={s.scanIconBox}>
                    <Ionicons name="scan-outline" size={26} color={COLORS.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.scanTitle}>Scan Vendor Bill</Text>
                    <Text style={s.scanSub}>Scan the e-Invoice QR or capture the bill</Text>
                  </View>
                </View>
                <View style={s.scanBtns}>
                  <TouchableOpacity style={s.scanBtn} onPress={openQrScanner} activeOpacity={0.7}>
                    <Ionicons name="qr-code-outline" size={16} color={COLORS.white} />
                    <Text style={s.scanBtnTxt}>Scan e-Invoice QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.scanBtnOutline} onPress={openBillScanner} activeOpacity={0.7}>
                    <Ionicons name="camera-outline" size={16} color={COLORS.brandPrimary} />
                    <Text style={s.scanBtnOutlineTxt}>Scan / Upload Bill</Text>
                  </TouchableOpacity>
                </View>
                {billAttachmentUri ? (
                  <View style={s.billAttachedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.positive} />
                    <Text style={s.billAttachedTxt} numberOfLines={1}>Bill photo attached</Text>
                    <TouchableOpacity onPress={() => setBillAttachmentUri(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>

              <BottomSheetSearch
                label="Purchase Ledger" required
                placeholder="Search ledger account..."
                options={purchaseLedgers.map(l => ({ label: l.name, value: l.name }))}
                value={purchaseLedger}
                onSelect={opt => setPurchaseLedger(opt.value)}
                onClear={() => setPurchaseLedger('')}
                sheetTitle="Purchase Ledger"
                icon="book-outline"
              />

              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} />
                  <Text style={s.cardTitle}>Invoice Details</Text>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Our Ref. No.</Text>
                    <View style={s.autoBox}>
                      <Text style={s.autoTxt}>Auto</Text>
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
                label="Vendor / Party" required
                placeholder="Search vendor..."
                options={vendors}
                value={vendor}
                onSelect={opt => {
                  setVendor(opt.value);
                  setVendorGstin(opt.data?.gstin || '');
                  setVendorGstRegType(opt.data?.gst_registration_type || '');
                }}
                onClear={() => { setVendor(''); setVendorGstin(''); setVendorGstRegType(''); }}
                sheetTitle="Vendor / Party"
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
                  <Text style={{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary }}>No GSTIN registered</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => addVendorRef.current?.present()}
                  activeOpacity={0.6}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, marginBottom: 2, paddingHorizontal: 2 }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={COLORS.brandPrimary} />
                  <Text style={{ fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' }}>
                    Add New Vendor
                  </Text>
                </TouchableOpacity>
              )}

              <View style={s.card}>
                <View style={s.cardHdr}>
                  <Ionicons name="receipt-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>Vendor Invoice Details</Text>
                </View>
                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fLabel}>Vendor Invoice No.</Text>
                    <ThemedFInput value={vendorInvNo} onChangeText={setVendorInvNo} placeholder="Optional" />
                  </View>
                  <DateInput label="Vendor Inv. Date" value={vendorInvDate} onChange={setVendorInvDate} maxDate={todayLocalISO()} />
                </View>
                <FormField
                  label="Purchase Reference No."
                  value={purchaseRefNo}
                  onChangeText={setPurchaseRefNo}
                  placeholder="Optional"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            </>
          )}

          {/* ═══════════ STEP 2 ═══════════ */}
          {step === 2 && (
            <>
              <View style={s.sectionHdr}>
                <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
                <Text style={s.sectionTitle}>Items</Text>
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
                      handleProductSelect(itemId, { label: result.productName, value: result.productName });
                    });
                    safePush(router, `/sales/product-scanner?companyGuid=${company?.guid}` as any);
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
                <Text style={s.addItemTxt}>+ Add Product</Text>
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
              {/* Make Payment Now */}
              <View style={s.card}>
                <TouchableOpacity style={s.payNowToggleRow} onPress={() => setMakePayNow(v => !v)} activeOpacity={0.8}>
                  <View style={s.payNowLeft}>
                    <View style={[s.payNowIcon, { backgroundColor: makePayNow ? COLORS.positiveBg : COLORS.pageBg }]}>
                      <Ionicons name="cash-outline" size={18} color={makePayNow ? COLORS.positive : COLORS.textSecondary} />
                    </View>
                    <View style={{ flex: 1, flexShrink: 1 }}>
                      <Text style={s.payNowTitle}>Make Payment Now</Text>
                      <Text style={s.payNowSub}>Record payment to vendor at the time of billing</Text>
                    </View>
                  </View>
                  <BrandSwitch value={makePayNow} onValueChange={setMakePayNow} />
                </TouchableOpacity>
                {makePayNow && (
                  <View style={s.payNowBody}>
                    <View style={s.divider} />
                    <FormDropdown label="Mode of Payment" value={payNowMode} options={PAY_MODES} onSelect={(o: any) => {
                      setPayNowMode(o.value);
                      setPayNowLedger('');
                    }} placeholder="Select payment mode..." required />
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
                        <Text style={s.fLabel}>Amount Paid (₹)</Text>
                        <TextInput
                          style={s.fInput}
                          value={payNowAmount}
                          onChangeText={setPayNowAmount}
                          onBlur={() => {
                            const v = parseFloat(payNowAmount) || 0;
                            if (v > totals.grand) setPayNowAmount(String(totals.grand));
                          }}
                          keyboardType="numeric"
                          placeholder={String(Math.round(totals.grand))}
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

              {/* Invoice Summary */}
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

              {/* Narration */}
              <View
                style={s.card}
                onLayout={(e) => { notesCardY.current = e.nativeEvent.layout.y; }}
              >
                <View style={s.cardHdr}>
                  <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
                  <Text style={s.cardTitle}>Narration</Text>
                </View>
                <View onLayout={(e) => { narrationOffset.current = e.nativeEvent.layout.y; }}>
                  <FormField
                    label="Narration"
                    value={narration}
                    onChangeText={setNarration}
                    placeholder="Internal notes..."
                    multiline
                    numberOfLines={2}
                    onFocus={() => scrollToFieldY(narrationOffset.current)}
                    style={{ minHeight: 60, textAlignVertical: 'top' } as any}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer — hide under success overlay */}
        {!showSuccess && (
        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {step === 3 && (
            <View style={s.grandTotalBar}>
              <View>
                <Text style={s.grandTotalMeta}>
                  {items.filter(i => i.product).length} item{items.filter(i => i.product).length !== 1 ? 's' : ''} · {vendor || 'No vendor'}
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
        )}
      </KeyboardAvoidingView>

      {/* Unit Modal */}
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

      {/* QR Camera Modal — overlay OUTSIDE CameraView so close button receives touches */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent onRequestClose={closeCamera}>
        <View style={cam.container}>
          {permission?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View style={[cam.overlay, StyleSheet.absoluteFillObject]} pointerEvents="box-none">
                <SafeAreaView edges={['top']} style={cam.topBar} pointerEvents="box-none">
                  <TouchableOpacity style={cam.closeBtn} onPress={closeCamera} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="close" size={26} color="#fff" />
                  </TouchableOpacity>
                  <Text style={cam.topTitle}>Scan e-Invoice QR</Text>
                  <View style={{ width: 44 }} />
                </SafeAreaView>
                <View style={cam.frameArea} pointerEvents="none">
                  <View style={cam.scanFrame}>
                    <View style={[cam.corner, cam.tl]} /><View style={[cam.corner, cam.tr]} />
                    <View style={[cam.corner, cam.bl]} /><View style={[cam.corner, cam.br]} />
                    <View style={cam.scanLine} />
                  </View>
                  <Text style={cam.frameHint}>Align the e-Invoice QR code within the frame</Text>
                </View>
                <View style={cam.bottomBar} pointerEvents="box-none">
                  <Text style={cam.captureLabel}>Waiting for QR code...</Text>
                  <TouchableOpacity style={cam.skipBtn} onPress={closeCamera} activeOpacity={0.7}>
                    <Text style={[cam.skipTxt, { color: 'rgba(255,255,255,0.85)' }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            <View style={cam.permBox}>
              <View style={cam.permIconBox}><Ionicons name="camera-outline" size={52} color={COLORS.textTertiary} /></View>
              <Text style={cam.permTitle}>Camera Access Required</Text>
              <Text style={cam.permSub}>Allow camera access to scan e-Invoice QR codes</Text>
              <TouchableOpacity style={cam.permBtn} onPress={requestPermission} activeOpacity={0.7}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={cam.permBtnTxt}>Allow Camera Access</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cam.skipBtn} onPress={closeCamera} activeOpacity={0.7}>
                <Text style={cam.skipTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <AddVendorDrawer
        ref={addVendorRef}
        company={company}
        onClose={() => {}}
        onSaved={(name, success) => {
          const newOpt: BSSOption = { label: name, value: name };
          setVendors(prev => [...prev, newOpt]);
          setVendor(name);
          if (success !== false) Alert.alert('✓ Vendor Added', `"${name}" has been added and selected.`);
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
            <Text style={ss.title}>{submitResult?.isQueued ? 'Saved. Pending Sync' : 'Purchase Invoice Submitted!'}</Text>
            <Text style={ss.sub}>
              {submitResult?.isQueued
                ? 'Entry queued. Will push to Tally when desktop reconnects.'
                : 'Purchase invoice pushed to Tally successfully.'}
            </Text>
            {submitResult?.numberingPolicy === 'tallydekho_series' && submitResult?.invoiceNumber && (
              <View style={[ss.refBadge, { backgroundColor: '#F0FDF4', borderColor: '#22C55E44' }]}>
                <Text style={ss.refLabel}>Invoice No.</Text>
                <Text style={[ss.refVal, { color: '#166534' }]}>{submitResult?.invoiceNumber}</Text>
              </View>
            )}
            {!!submitResult?.tdkRef && (
              <View style={ss.refBadge}>
                <Text style={ss.refLabel}>Reference No.</Text>
                <Text style={ss.refVal}>{submitResult?.tdkRef}</Text>
              </View>
            )}

            <TouchableOpacity
              style={ss.previewBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!submitResult?.tdkRef) return;
                setShowSuccess(false);
                safePush(router, `/sales/invoice-preview?tdkRef=${encodeURIComponent(submitResult?.tdkRef)}&type=purchase_invoice` as any);
              }}
            >
              <Ionicons name="eye-outline" size={18} color={COLORS.brandPrimary} />
              <Text style={ss.previewBtnTxt}>Preview</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ss.pdfBtn, sharePdfLoading && { opacity: 0.7 }]}
              activeOpacity={0.85}
              disabled={sharePdfLoading}
              onPress={async () => {
                if (!submitResult?.tdkRef || !company?.guid) return;
                setSharePdfLoading(true);
                try {
                  const isTDSeries = submitResult?.numberingPolicy === 'tallydekho_series';
                  const res = await invoiceSharePdf(submitResult?.tdkRef, company.guid, !isTDSeries, isTDSeries ? 0 : 10000);
                  const docData = res?.data;
                  if (!docData) throw new Error('No invoice data returned');

                  const pdfDoc = toVoucherDocument(docData, { documentType: 'purchase_invoice' });
                  await shareVoucherPdf(pdfDoc, {
                    companyGuid: company.guid,
                    fileName: docData.fileName || `PurchaseInvoice-${submitResult?.tdkRef}.pdf`,
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

            <TouchableOpacity style={ss.doneBtn} activeOpacity={0.85} onPress={() => {
              setShowSuccess(false);
              setSharePdfLoading(false);
              router.back();
            }}>
              <Text style={ss.doneTxt}>Done</Text>
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
  scanCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 2, borderColor: COLORS.brandPrimary, borderStyle: 'dashed' },
  scanTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.md },
  scanIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  scanSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  scanBtns: { flexDirection: 'row', gap: 10 },
  billAttachedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: COLORS.positive + '12', borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.positive + '40' },
  billAttachedTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.positive },
  scanBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 12 },
  scanBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white, textAlign: 'center' },
  scanBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  scanBtnOutlineTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
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
  payNowToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  payNowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  payNowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  payNowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  payNowSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  payNowBody: { paddingTop: 12, gap: 10 },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: 2 },
  payStatusChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  payStatusPaid: { backgroundColor: COLORS.positiveBg, borderColor: COLORS.positive + '40' },
  payStatusPartial: { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning + '40' },
  payStatusPending: { backgroundColor: COLORS.negativeBg, borderColor: COLORS.negative + '30' },
  payStatusTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', flex: 1 },
  summaryCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  summaryTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sumLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sumDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: 12 },
  grandLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  grandVal: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.brandPrimary },
  footer: { flexDirection: 'column', gap: 8, paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  footerBtnRow: { flexDirection: 'row', gap: 12 },
  grandTotalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  grandTotalMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 2 },
  grandTotalLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  grandTotalAmt: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.brandPrimary, maxWidth: '55%' },
  fullNextBtn: { flex: 1, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  nextBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  backOutlineBtn: { flex: 1, paddingVertical: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  backOutlineTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: { flex: 2, flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const si = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  stepItem: { alignItems: 'center', width: 90 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.pageBg, borderWidth: 1.5, borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  circleActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  circleDone: { backgroundColor: COLORS.positive, borderColor: COLORS.positive },
  circleNum: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary },
  circleNumActive: { color: COLORS.white },
  label: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary, textAlign: 'center' },
  labelActive: { color: COLORS.textPrimary, fontWeight: '700' },
  line: { flex: 1, height: 1.5, backgroundColor: COLORS.borderDefault, marginTop: 13 },
  lineDone: { backgroundColor: COLORS.positive },
});

const acd = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  label: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  star: { color: COLORS.negative },
  input: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  balBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingLeft: 14, paddingRight: 8, minHeight: 48 },
  balInput: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, paddingVertical: 12 },
  drCrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  drCrLbl: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, fontWeight: '600' },
  drCrLblActive: { color: COLORS.brandPrimary },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 12 },
  footer: { paddingHorizontal: SPACING.md, paddingTop: 12, paddingBottom: 4, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14 },
  saveBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const ir = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 12 },
  rowHeaderTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  rowHeaderTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  rowHeaderAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary, marginRight: 4 },
  headerTrashBtn: { padding: 4, marginLeft: 8 },
  expandedContent: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, gap: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: SPACING.sm },
  fieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  star: { color: COLORS.negative },
  productRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  barcodeBtn: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  qurRow: { flexDirection: 'row', gap: 8 },
  qtyBox: { width: 76 },
  unitBox: { width: 76 },
  rateBox: { flex: 1 },
  miniLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  miniInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 10, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, minHeight: 40 },
  unitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault, minHeight: 40 },
  unitTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  discFullRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  discInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discTypeBtn: { backgroundColor: COLORS.brandPrimary + '18', borderWidth: 1, borderColor: COLORS.brandPrimary + '40', borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 7, minWidth: 36, alignItems: 'center' },
  discTypeTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  discInput: { width: 64, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 7, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center' },
  taxableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 8 },
  taxableLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  taxableVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  taxSection: { gap: 6 },
  taxSectionHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taxSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  taxColHint: { fontSize: 10, color: COLORS.textTertiary },
  taxEntryCard: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, padding: 8, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 6 },
  taxEntryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taxEntryBottomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  taxFieldGroup: { gap: 4 },
  taxMiniLbl: { fontSize: 10, fontWeight: '600', color: COLORS.textTertiary },
  taxFieldInputRow: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.cardBg, borderRadius: 6, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 8, paddingVertical: 6 },
  taxRateInput: { width: 40, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center' },
  taxRateSign: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  taxAmtInput: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'right' },
  addTaxDashedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.brandPrimary + '40', borderStyle: 'dashed', borderRadius: RADIUS.sm, paddingVertical: 8 },
  addTaxDashedTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8 },
  subtotalLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  subtotalVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  unitMenu: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, margin: SPACING.xl, overflow: 'hidden', minWidth: 180 },
  unitOpt: { paddingHorizontal: SPACING.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, alignItems: 'center' },
  unitOptActive: { backgroundColor: COLORS.pageBg },
  unitOptTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
  unitOptActiveTxt: { color: COLORS.brandPrimary },
});

const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center', width: '100%', maxWidth: 400, gap: 6 },
  iconWrap: { marginBottom: 6 },
  title: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  sub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 8 },
  refBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 8, width: '100%', justifyContent: 'space-between' },
  refLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  refVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  previewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 13, width: '100%', marginTop: 6 },
  previewBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.brandPrimary },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 13, width: '100%', marginTop: 10 },
  pdfBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
  doneBtn: { paddingVertical: 12, width: '100%', alignItems: 'center', marginTop: 6 },
  doneTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
});

const cam = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  scanFrame: { width: 260, height: 260, borderRadius: 6, position: 'relative', overflow: 'visible' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: COLORS.brandPrimary, borderWidth: 3 },
  tl: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: { position: 'absolute', top: '48%', left: 10, right: 10, height: 2, backgroundColor: COLORS.brandPrimary, opacity: 0.7, borderRadius: 1 },
  frameHint: { fontSize: 14, color: 'rgba(255,255,255,0.82)', textAlign: 'center', fontWeight: '500', paddingHorizontal: 30 },
  bottomBar: { paddingBottom: 52, paddingHorizontal: 32, alignItems: 'center', gap: 14 },
  captureBtn: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  captureRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  captureDot: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' },
  captureLabel: { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  permBox: { flex: 1, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 },
  permIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.pageBg, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  permTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  permSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.brandPrimary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginTop: 4 },
  permBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn: { paddingVertical: 10 },
  skipTxt: { fontSize: 14, color: COLORS.textSecondary, textDecorationLine: 'underline' },
});
