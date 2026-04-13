import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';

// ─── Mock data ────────────────────────────────────────────────────────────────
const LEDGER_OPTS: DropdownOption[] = [
  { label: 'Credit Sales', value: 'credit_sales' },
  { label: 'Cash Sales', value: 'cash_sales' },
  { label: 'Off-Books', value: 'off_books' },
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
const PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
  { label: 'Shipping & Handling', value: 'shipping' },
  { label: 'Consulting Services', value: 'consulting' },
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface InvoiceItem {
  id: string;
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
  product: '', qty: '1', unit: 'pcs', rate: '', discountType: '%', discount: '0', taxRate: '18',
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
          {PRODUCTS.map(p => (
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

type ModalState = { type: 'product'|'unit'|'tax'; itemId: string } | null;

function ItemRow({ item, onUpdate, onRemove, onOpenModal }: {
  item: InvoiceItem;
  onUpdate: (id: string, field: keyof InvoiceItem, val: string) => void;
  onRemove: (id: string) => void;
  onOpenModal: (s: ModalState) => void;
}) {
  const calc = calcItem(item);
  const productName = PRODUCTS.find(p => p.value === item.product)?.label;
  const unitLabel = UNITS.find(u => u.value === item.unit)?.label || item.unit;

  return (
    <View style={ir.card}>
      {/* Product Row */}
      <View style={ir.topRow}>
        <TouchableOpacity style={ir.productBtn} onPress={() => onOpenModal({ type: 'product', itemId: item.id })} activeOpacity={0.7}>
          <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
          <Text style={[ir.productTxt, !item.product && ir.placeholderTxt]} numberOfLines={1}>
            {productName || 'Select product / service...'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [ledger, setLedger] = useState('credit_sales');
  const [invoiceNo] = useState('INV-30979');
  const [date, setDate] = useState(todayStr());
  const [party, setParty] = useState('');
  const [payTerms, setPayTerms] = useState('due_on_receipt');
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

  const handleSubmit = useCallback(() => {
    Alert.alert(
      '✓ Invoice Submitted',
      `Invoice ${invoiceNo} submitted successfully!`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  }, [invoiceNo, router]);

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
          {/* Ledger Selector */}
          <View style={s.ledgerRow}>
            {LEDGER_OPTS.map(l => (
              <TouchableOpacity
                key={l.value}
                style={[s.ledgerChip, ledger === l.value && s.ledgerChipActive]}
                onPress={() => setLedger(l.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.ledgerChipTxt, ledger === l.value && s.ledgerChipTxtActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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
                <TextInput
                  style={s.fInput}
                  value={date} onChangeText={setDate}
                  placeholder="DD/MM/YY"
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>
            </View>

            <FormDropdown
              label="Customer / Party"
              value={party} options={PARTIES}
              onSelect={o => setParty(o.value)}
              placeholder="Select customer..."
              required
            />

            <FormDropdown
              label="Payment Terms"
              value={payTerms} options={TERMS}
              onSelect={o => setPayTerms(o.value)}
              placeholder="Select terms..."
            />

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Due Date</Text>
                <TextInput
                  style={s.fInput}
                  value={dueDate} onChangeText={setDueDate}
                  placeholder="DD/MM/YY"
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Reference No.</Text>
                <TextInput
                  style={s.fInput}
                  value={refNo} onChangeText={setRefNo}
                  placeholder="Optional"
                  placeholderTextColor={COLORS.textTertiary}
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
              <Switch
                value={collectPayNow}
                onValueChange={setCollectPayNow}
                trackColor={{ false: COLORS.borderDefault, true: COLORS.positive }}
                thumbColor={COLORS.white}
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
          <TouchableOpacity style={s.draftBtn} onPress={() => handleSubmit(true)} activeOpacity={0.7}>
            <Text style={s.draftTxt}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={() => handleSubmit(false)} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Submit Invoice</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Product Modal */}
      <ProductDropdownModal
        visible={activeModal?.type === 'product'}
        value={activeModal ? items.find(i => i.id === activeModal.itemId)?.product || '' : ''}
        onSelect={opt => {
          if (activeModal) updateItem(activeModal.itemId, 'product', opt.value);
        }}
        onClose={closeModal}
      />
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
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  star: { color: COLORS.negative },
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
