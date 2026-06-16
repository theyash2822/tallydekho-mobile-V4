import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { createQuotation } from '../../src/services/api';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import { useSettings } from '../../src/context/SettingsContext';

// ─── Mock data ────────────────────────────────────────────────────────────────
const PARTIES: DropdownOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'XYZ Retail', value: 'xyz' },
  { label: 'Sharma Electronics', value: 'sharma' },
  { label: 'Delhi Suppliers', value: 'delhi' },
  { label: 'Raj Enterprises', value: 'raj' },
];
const WAREHOUSES: DropdownOption[] = [
  { label: 'Main Warehouse', value: 'main_wh' },
  { label: 'Store A', value: 'store_a' },
  { label: 'Store B', value: 'store_b' },
  { label: 'Delhi Depot', value: 'delhi_depot' },
];
// Warehouse → Products mapping
const WAREHOUSE_PRODUCTS: Record<string, string[]> = {
  main_wh:     ['jbl_speaker', 'samsung_j1', 'lycan_hp', 'sony_xm5', 'jbl_wired', 'consulting'],
  store_a:     ['jbl_speaker', 'lycan_hp', 'consulting'],
  store_b:     ['samsung_j1', 'sony_xm5'],
  delhi_depot: ['jbl_wired', 'consulting'],
};
const ALL_PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
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
const UNITS = ['Pcs','Kg','Ltr','Mtr','Box','Nos'];
const TAX_RATES = ['0','5','12','18','28'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface QItem {
  id: string; warehouse: string; product: string; qty: string; unit: string;
  rate: string; discountType: '%' | 'flat'; discount: string; taxRate: string;
}
const newItem = (): QItem => ({
  id: Date.now().toString(),
  warehouse: '', product: '', qty: '1', unit: 'Pcs',
  rate: '', discountType: '%', discount: '0', taxRate: '0',
});
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };
const calcItem = (item: QItem) => {
  const qty = parseFloat(item.qty)||0, rate = parseFloat(item.rate)||0;
  const gross = qty*rate;
  const disc = parseFloat(item.discount)||0;
  const discAmt = item.discountType==='%' ? gross*disc/100 : Math.min(disc,gross);
  const taxable = gross-discAmt;
  const taxAmt = taxable*(parseFloat(item.taxRate)||0)/100;
  return { gross, discAmt, taxAmt, subtotal: taxable+taxAmt };
};

type ModalState = { type: 'product'|'unit'|'tax'|'warehouse'|'barcode'; itemId: string }|null;

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

// ─── Item Row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, onUpdate, onRemove, onModal }: {
  item: QItem;
  onUpdate: (id:string, f:keyof QItem, v:string) => void;
  onRemove: (id:string) => void;
  onModal: (s:ModalState) => void;
}) {
  const calc = calcItem(item);
  const warehouseLabel = WAREHOUSES.find(w => w.value === item.warehouse)?.label;
  // Filter products by selected warehouse
  const availableProducts = item.warehouse
    ? ALL_PRODUCTS.filter(p => (WAREHOUSE_PRODUCTS[item.warehouse] || []).includes(p.value))
    : ALL_PRODUCTS;
  const productName = availableProducts.find(p => p.value === item.product)?.label
    || ALL_PRODUCTS.find(p => p.value === item.product)?.label;

  return (
    <View style={ir.card}>
      {/* Row 1: Warehouse FIRST */}
      <TouchableOpacity
        style={[ir.warehouseBtn, item.warehouse && ir.warehouseBtnActive]}
        onPress={() => onModal({ type: 'warehouse', itemId: item.id })}
        activeOpacity={0.7}
      >
        <Ionicons name="business-outline" size={13} color={item.warehouse ? COLORS.info : COLORS.textTertiary} />
        <Text style={[ir.warehouseTxt, !warehouseLabel && ir.phTxt]}>
          {warehouseLabel || 'Select Warehouse first...'}
        </Text>
        <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Row 2: Product + Barcode + Delete */}
      <View style={ir.topRow}>
        <TouchableOpacity
          style={ir.prodBtn}
          onPress={() => onModal({ type: 'product', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="cube-outline" size={13} color={COLORS.textSecondary} />
          <Text style={[ir.prodTxt, !item.product && ir.phTxt]} numberOfLines={1}>
            {productName || (item.warehouse ? 'Select product...' : 'Select warehouse first')}
          </Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={ir.barcodeBtn}
          onPress={() => onModal({ type: 'barcode', itemId: item.id })}
          activeOpacity={0.7}
        >
          <Ionicons name="barcode-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.delBtn} onPress={() => onRemove(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.negative} />
        </TouchableOpacity>
      </View>

      {/* Qty + Unit + Rate */}
      <View style={ir.row}>
        <View style={ir.qBox}>
          <Text style={ir.mLabel}>Qty</Text>
          <TextInput
            style={ir.mInput}
            value={item.qty}
            onChangeText={v => onUpdate(item.id, 'qty', v)}
            keyboardType="numeric" placeholder="1"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
        <TouchableOpacity style={ir.unitBtn} onPress={() => onModal({ type: 'unit', itemId: item.id })} activeOpacity={0.7}>
          <Text style={ir.unitTxt}>{item.unit}</Text>
          <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={ir.rBox}>
          <Text style={ir.mLabel}>Rate (₹)</Text>
          <TextInput
            style={ir.mInput}
            value={item.rate}
            onChangeText={v => onUpdate(item.id, 'rate', v)}
            keyboardType="numeric" placeholder="0.00"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
      </View>

      {/* Discount + Tax */}
      <View style={ir.row}>
        <View style={ir.discRow}>
          <TouchableOpacity
            style={ir.discType}
            onPress={() => onUpdate(item.id, 'discountType', item.discountType === '%' ? 'flat' : '%')}
            activeOpacity={0.7}
          >
            <Text style={ir.discTypeTxt}>{item.discountType}</Text>
          </TouchableOpacity>
          <TextInput
            style={ir.discInput}
            value={item.discount}
            onChangeText={v => onUpdate(item.id, 'discount', v)}
            keyboardType="numeric" placeholder="0"
            placeholderTextColor={COLORS.textTertiary}
          />
          <Text style={ir.discLabel}>Disc</Text>
        </View>
        <TouchableOpacity style={ir.taxBtn} onPress={() => onModal({ type: 'tax', itemId: item.id })} activeOpacity={0.7}>
          <Text style={ir.taxTxt}>GST {item.taxRate}%</Text>
          <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Item Total */}
      <View style={ir.subRow}>
        <Text style={ir.subLabel}>Item Total</Text>
        <Text style={ir.subVal}>₹{calc.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CreateQuotationScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, isPaired } = useAuth();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [qtNo] = useState('QT-00157');
  const [date, setDate] = useState(todayStr());
  const [validUntil, setValidUntil] = useState('');
  const [party, setParty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refNo, setRefNo] = useState('');
  const [items, setItems] = useState<QItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logTaxRate, setLogTaxRate] = useState('0');
  const [narration, setNarration] = useState('');
  const [terms, setTerms] = useState('This quotation is valid for 30 days from the date of issue.');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string, f:keyof QItem, v:string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [f]: v } : i)), []);
  const removeItem = useCallback((id:string) =>
    setItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev), []);

  const logisticsTotal = useMemo(() => calcLogisticsTotal(logEntries, logTaxRate), [logEntries, logTaxRate]);

  const totals = useMemo(() => {
    let gross = 0, discTotal = 0, taxTotal = 0;
    items.forEach(i => {
      const c = calcItem(i);
      gross += c.gross;
      discTotal += c.discAmt;
      taxTotal += c.taxAmt;
    });
    const grand = gross - discTotal + taxTotal + logisticsTotal;
    return { gross, discTotal, taxTotal, logisticsTotal, grand };
  }, [items, logisticsTotal]);

  const closeModal = useCallback(() => setActiveModal(null), []);

  const handleSubmit = useCallback(async () => {
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' }); return; }
    try {
      setSubmitting(true);
      await createQuotation({
        company_guid: company?.guid,
        party, date, valid_until: validUntil || undefined, ref_no: refNo || undefined,
        items: items.map(i => ({ stock_item: i.product, qty: parseFloat(i.qty)||0, rate: parseFloat(i.rate)||0, unit: i.unit, discount: parseFloat(i.discount)||0, tax_rate: parseFloat(i.taxRate)||0 })),
        narration: narration || undefined,
      });
      Toast.show({ type: 'success', text1: 'Quotation Created', text2: `${qtNo} sent to Tally.` });
      setTimeout(() => router.back(), 1000);
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message || 'Could not submit.' });
    } finally { setSubmitting(false); }
  }, [isPaired, company?.guid, party, date, validUntil, refNo, items, narration, qtNo, router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Quotation</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{qtNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Quotation Details */}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="chatbubble-outline" size={18} color={COLORS.warning} />
              <Text style={s.cardTitle}>Quotation Details</Text>
            </View>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Quotation No.</Text>
                <View style={s.autoBox}>
                  <Text style={s.autoTxt}>{qtNo}</Text>
                  <Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                <TextInput style={s.fInput} value={date} onChangeText={setDate} placeholder="DD/MM/YY" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <FormDropdown label="Customer / Party" value={party} options={PARTIES} onSelect={o => setParty(o.value)} placeholder="Select customer..." required />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Valid Until <Text style={s.star}>*</Text></Text>
                <TextInput style={s.fInput} value={validUntil} onChangeText={setValidUntil} placeholder="DD/MM/YY" placeholderTextColor={COLORS.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fLabel}>Reference No.</Text>
                <TextInput style={s.fInput} value={refNo} onChangeText={setRefNo} placeholder="Optional" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
          </View>

          {/* Validity Banner */}
          {validUntil.length > 0 && (
            <View style={s.validBanner}>
              <Ionicons name="time-outline" size={16} color={COLORS.warning} />
              <Text style={s.validTxt}>This quotation is valid until <Text style={{ fontWeight: '700' }}>{validUntil}</Text></Text>
            </View>
          )}

          {/* Items */}
          <View style={s.secHdr}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
            <Text style={s.secTitle}>Items & Services</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item => (
            <ItemRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={() => setItems(p => [...p, newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add Item / Service</Text>
          </TouchableOpacity>

          {/* Logistics */}
          <LogisticsSection
            entries={logEntries}
            taxRate={logTaxRate}
            onEntriesChange={setLogEntries}
            onTaxRateChange={setLogTaxRate}
          />

          {/* Summary */}
          <View style={s.sumCard}>
            <Text style={s.sumTitle}>Quotation Summary</Text>
            <View style={s.sumRow}>
              <Text style={s.sumL}>Subtotal</Text>
              <Text style={s.sumV}>₹{totals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
            {totals.discTotal > 0 && (
              <View style={s.sumRow}>
                <Text style={s.sumL}>Discount</Text>
                <Text style={[s.sumV, { color: COLORS.positive }]}>-₹{totals.discTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {totals.taxTotal > 0 && (
              <View style={s.sumRow}>
                <Text style={s.sumL}>Total Tax (GST)</Text>
                <Text style={s.sumV}>₹{totals.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            {totals.logisticsTotal > 0 && (
              <View style={s.sumRow}>
                <Text style={s.sumL}>Logistics</Text>
                <Text style={s.sumV}>₹{totals.logisticsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            )}
            <View style={s.sumDiv} />
            <View style={s.sumRow}>
              <Text style={s.sumGrandL}>Quoted Amount</Text>
              <Text style={s.sumGrandV}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Notes */}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="document-outline" size={18} color={COLORS.textSecondary} />
              <Text style={s.cardTitle}>Notes & Terms</Text>
            </View>
            <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Internal notes..." multiline numberOfLines={2} style={{ minHeight: 60, textAlignVertical: 'top' } as any} />
            <FormField label="Terms & Conditions" value={terms} onChangeText={setTerms} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' } as any} containerStyle={{ marginBottom: 0 }} />
          </View>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={[s.submitBtn, submitting && {opacity:0.6}]} onPress={handleSubmit} activeOpacity={0.7} disabled={submitting}>
            {submitting ? <ActivityIndicator size="small" color={COLORS.white}/> : <Ionicons name="send-outline" size={16} color={COLORS.white} />}
            <Text style={s.submitTxt}>{submitting ? 'Submitting...' : 'Create Quotation'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Product Modal — warehouse-filtered */}
      <Modal visible={activeModal?.type === 'product'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={m.overlay}>
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={closeModal} />
          <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Product / Service</Text>
          {(() => {
            const item = items.find(i => i.id === activeModal?.itemId);
            const filteredProducts = item?.warehouse
              ? ALL_PRODUCTS.filter(p => (WAREHOUSE_PRODUCTS[item.warehouse] || []).includes(p.value))
              : ALL_PRODUCTS;
            return (
              <ScrollView showsVerticalScrollIndicator={false}>
                {item?.warehouse ? (
                  <View style={m.whHint}>
                    <Ionicons name="business-outline" size={13} color={COLORS.info} />
                    <Text style={m.whHintTxt}>Showing products from: {WAREHOUSES.find(w => w.value === item.warehouse)?.label}</Text>
                  </View>
                ) : (
                  <View style={m.whHint}>
                    <Ionicons name="alert-circle-outline" size={13} color={COLORS.warning} />
                    <Text style={[m.whHintTxt, { color: COLORS.warning }]}>Select warehouse to filter products</Text>
                  </View>
                )}
                {filteredProducts.map(p => (
                  <TouchableOpacity
                    key={p.value}
                    style={[m.opt, item?.product === p.value && m.optA]}
                    onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'product', p.value); closeModal(); }}
                    activeOpacity={0.7}
                  >
                    <View style={m.optRow}>
                      <Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={[m.optTxt, item?.product === p.value && m.optTxtA]}>{p.label}</Text>
                    </View>
                    {item?.product === p.value && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            );
          })()}
          </View>
        </View>
      </Modal>

      {/* Unit Modal */}
      <Modal visible={activeModal?.type === 'unit'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal}>
          <View style={m.center}>
            {UNITS.map(u => (
              <TouchableOpacity key={u} style={m.unitOpt}
                onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'unit', u); closeModal(); }}
                activeOpacity={0.7}>
                <Text style={[m.unitTxt, items.find(i => i.id === activeModal?.itemId)?.unit === u && { fontWeight: '800', color: COLORS.brandPrimary }]}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tax Modal */}
      <Modal visible={activeModal?.type === 'tax'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal}>
          <View style={m.center}>
            {TAX_RATES.map(t => (
              <TouchableOpacity key={t} style={m.unitOpt}
                onPress={() => { if (activeModal) updateItem(activeModal.itemId, 'taxRate', t); closeModal(); }}
                activeOpacity={0.7}>
                <Text style={[m.unitTxt, items.find(i => i.id === activeModal?.itemId)?.taxRate === t && { fontWeight: '800', color: COLORS.brandPrimary }]}>GST {t}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Warehouse Modal */}
      <Modal visible={activeModal?.type === 'warehouse'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={m.overlay}>
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={closeModal} />
          <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAREHOUSES.map(w => (
              <TouchableOpacity key={w.value} style={m.opt}
                onPress={() => {
                  if (activeModal) {
                    updateItem(activeModal.itemId, 'warehouse', w.value);
                    // Reset product when warehouse changes
                    updateItem(activeModal.itemId, 'product', '');
                  }
                  closeModal();
                }}
                activeOpacity={0.7}
              >
                <View style={m.optRow}>
                  <Ionicons name="business-outline" size={16} color={COLORS.info} />
                  <Text style={m.optTxt}>{w.label}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          </View>
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  badge: { backgroundColor: COLORS.warningBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.warning },
  scroll: { padding: SPACING.md, paddingBottom: 8 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  row2: { flexDirection: 'row', gap: 12, marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fInput: { backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, minHeight: 48 },
  autoBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48 },
  autoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  star: { color: COLORS.negative },
  validBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md, padding: 12, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.warning + '40' },
  validTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.warning, flex: 1 },
  secHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  secTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  countBadge: { backgroundColor: COLORS.brandPrimary, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  countTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: '#fff' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.positiveBg, borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.positive + '40', borderStyle: 'dashed' },
  addTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.positive },
  sumCard: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  sumTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sumL: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  sumV: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  sumDiv: { height: 1, backgroundColor: COLORS.borderDefault, marginBottom: 12 },
  sumGrandL: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sumGrandV: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.warning },
  footer: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  submitBtn: { flexDirection: 'row', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  submitTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});

const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%', paddingTop: 12 },
  handle: { width: 40, height: 4, backgroundColor: COLORS.borderStrong, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, paddingBottom: 8, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  whHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.infoBg },
  whHintTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.info, fontWeight: '600', flex: 1 },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  optA: { backgroundColor: COLORS.pageBg },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  optTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  optTxtA: { fontWeight: '700', color: COLORS.brandPrimary },
  center: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, margin: SPACING.xl, overflow: 'hidden' },
  unitOpt: { paddingHorizontal: SPACING.xl, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, alignItems: 'center' },
  unitTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '600' },
});

const ir = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  warehouseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: 8 },
  warehouseBtnActive: { backgroundColor: COLORS.infoBg, borderColor: COLORS.info + '40' },
  warehouseTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.info },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  prodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  prodTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  phTxt: { color: COLORS.textTertiary },
  barcodeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  delBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-end' },
  qBox: { width: 72 }, rBox: { flex: 1 },
  mLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  mInput: { backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 9, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center', minHeight: 38 },
  unitBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'flex-end', minHeight: 38 },
  unitTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  discRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 6, paddingVertical: 4, minHeight: 38 },
  discType: { backgroundColor: COLORS.brandPrimary, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  discTypeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: '#fff', width: 16, textAlign: 'center' },
  discInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, textAlign: 'center', paddingVertical: 2 },
  discLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  taxBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.warning + '30', minHeight: 38 },
  taxTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.warning },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8 },
  subLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  subVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
});

// ─── Barcode Scanner Styles ───────────────────────────────────────────────────
const bs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  rescanBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  rescanText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  camera: { flex: 1 },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 60 },
  scanFrame: { width: 220, height: 220, borderWidth: 2, borderColor: COLORS.white, borderRadius: 16, marginBottom: 24, opacity: 0.8 },
  hint: { fontSize: TYPOGRAPHY.sm, color: COLORS.white, fontWeight: '600' },
  permWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: SPACING.xl, backgroundColor: COLORS.pageBg },
  permText: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  permBtn: { backgroundColor: COLORS.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.md },
  permBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
