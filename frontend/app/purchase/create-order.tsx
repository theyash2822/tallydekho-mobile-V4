import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import LogisticsSection, { LogEntry, calcLogisticsTotal } from '../../src/components/forms/LogisticsSection';
import SearchableDropdown, { SDOption } from '../../src/components/forms/SearchableDropdown';
import DatePickerModal from '../../src/components/forms/DatePickerModal';

const PURCHASE_LEDGERS: SDOption[] = [
  { label: 'Purchase - Raw Materials', value: 'purchase_raw' },
  { label: 'Purchase - Finished Goods', value: 'purchase_fg' },
  { label: 'Expenses A/c', value: 'expenses' },
  { label: 'Capital Purchase', value: 'capital' },
  { label: 'Stock Purchases', value: 'stock_purchases' },
  { label: 'Import Purchases', value: 'import_purchases' },
];
const VENDORS: SDOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'Delhi Suppliers', value: 'delhi' },
  { label: 'Indian Export House', value: 'ieh' },
  { label: 'Raj Manufacturers', value: 'raj' },
];
const WAREHOUSES: SDOption[] = [
  { label: 'Main Warehouse', value: 'main_wh' },
  { label: 'Store A', value: 'store_a' },
  { label: 'Store B', value: 'store_b' },
  { label: 'Delhi Depot', value: 'delhi_depot' },
];
const WAREHOUSE_PRODUCTS: Record<string, string[]> = {
  main_wh:     ['jbl_speaker','samsung_j1','lycan_hp','sony_xm5','jbl_wired'],
  store_a:     ['jbl_speaker','lycan_hp'],
  store_b:     ['samsung_j1','sony_xm5'],
  delhi_depot: ['jbl_wired'],
};
const ALL_PRODUCTS: SDOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
];
const BARCODE_MAP: Record<string,string> = {
  '123456789012':'jbl_speaker','234567890123':'samsung_j1',
  '345678901234':'lycan_hp','456789012345':'sony_xm5','567890123456':'jbl_wired',
};
const PAYMENT_TERMS: SDOption[] = [
  { label: 'Due on Receipt', value: 'due' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: '45 Days', value: '45d' },
  { label: '60 Days', value: '60d' },
  { label: 'Custom', value: 'custom' },
];
const UNITS = ['Pcs','Kg','Ltr','Mtr','Box','Nos'];
const TAX_RATES = ['0','5','12','18','28'];

interface POItem {
  id: string; warehouse: string; product: string; qty: string; unit: string;
  rate: string; discountType: '%'|'flat'; discount: string; taxRate: string;
}
const newItem = (): POItem => ({
  id: Date.now().toString(),
  warehouse:'', product:'', qty:'1', unit:'Pcs',
  rate:'', discountType:'%', discount:'0', taxRate:'18',
});
const todayStr = () => { const d=new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };
const calcItem = (item: POItem) => {
  const qty=parseFloat(item.qty)||0, rate=parseFloat(item.rate)||0;
  const gross=qty*rate;
  const disc=parseFloat(item.discount)||0;
  const discAmt=item.discountType==='%'?gross*disc/100:Math.min(disc,gross);
  const taxable=gross-discAmt;
  const taxAmt=taxable*(parseFloat(item.taxRate)||0)/100;
  return { gross, discAmt, taxAmt, subtotal: taxable+taxAmt };
};

type ModalState = { type:'product'|'unit'|'tax'|'warehouse'|'barcode'; itemId:string }|null;

function BarcodeScannerModal({ visible, onScan, onClose }: { visible:boolean; onScan:(v:string)=>void; onClose:()=>void; }) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned.current) return;
    scanned.current = true;
    const product = BARCODE_MAP[data];
    if (product) { onScan(product); }
    else Alert.alert('Not Found',`No product for barcode: ${data}`,[{text:'OK',onPress:()=>{scanned.current=false;}}]);
  };
  if (!visible) return null;
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={bs.safe}>
          <View style={bs.header}><TouchableOpacity onPress={onClose} style={bs.closeBtn}><Ionicons name="close" size={24} color={COLORS.textPrimary} /></TouchableOpacity><Text style={bs.title}>Scan Barcode</Text></View>
          <View style={bs.permWrap}>
            <Ionicons name="camera-outline" size={64} color={COLORS.textTertiary} />
            <Text style={bs.permText}>Camera permission required.</Text>
            <TouchableOpacity style={bs.permBtn} onPress={requestPermission}><Text style={bs.permBtnText}>Grant Camera Access</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={bs.safe} edges={['top']}>
        <View style={bs.header}>
          <TouchableOpacity onPress={onClose} style={bs.closeBtn}><Ionicons name="close" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
          <Text style={bs.title}>Scan Barcode</Text>
          <TouchableOpacity onPress={()=>{scanned.current=false;}} style={bs.rescanBtn}><Text style={bs.rescanText}>Rescan</Text></TouchableOpacity>
        </View>
        <CameraView style={bs.camera} facing="back"
          barcodeScannerSettings={{barcodeTypes:['qr','ean13','ean8','code128','code39']}}
          onBarcodeScanned={handleBarcodeScanned} />
        <View style={bs.overlay}><View style={bs.scanFrame} /><Text style={bs.hint}>Point camera at product barcode</Text></View>
      </SafeAreaView>
    </Modal>
  );
}

function DateInput({ label, value, onChange, required, title }: { label:string; value:string; onChange:(v:string)=>void; required?:boolean; title?:string; }) {
  const [show, setShow] = useState(false);
  return (
    <View style={{flex:1}}>
      <Text style={s.fLabel}>{label}{required&&<Text style={s.star}> *</Text>}</Text>
      <TouchableOpacity style={s.dateBox} onPress={()=>setShow(true)} activeOpacity={0.7}>
        <Text style={[s.dateTxt,!value&&s.datePlh]}>{value||'DD/MM/YY'}</Text>
        <Ionicons name="calendar-outline" size={18} color={COLORS.brandPrimary} />
      </TouchableOpacity>
      <DatePickerModal visible={show} value={value} onSelect={onChange} onClose={()=>setShow(false)} title={title||label} />
    </View>
  );
}

function ItemRow({ item, onUpdate, onRemove, onModal }: {
  item: POItem; onUpdate:(id:string,f:keyof POItem,v:string)=>void;
  onRemove:(id:string)=>void; onModal:(s:ModalState)=>void;
}) {
  const calc = calcItem(item);
  const warehouseLabel = WAREHOUSES.find(w=>w.value===item.warehouse)?.label;
  const availableProducts = item.warehouse
    ? ALL_PRODUCTS.filter(p=>(WAREHOUSE_PRODUCTS[item.warehouse]||[]).includes(p.value))
    : ALL_PRODUCTS;
  const productName = availableProducts.find(p=>p.value===item.product)?.label
    || ALL_PRODUCTS.find(p=>p.value===item.product)?.label;

  return (
    <View style={ir.card}>
      {/* Warehouse FIRST */}
      <TouchableOpacity style={[ir.warehouseBtn,item.warehouse&&ir.warehouseBtnActive]} onPress={()=>onModal({type:'warehouse',itemId:item.id})} activeOpacity={0.7}>
        <Ionicons name="business-outline" size={13} color={item.warehouse?COLORS.info:COLORS.textTertiary} />
        <Text style={[ir.warehouseTxt,!warehouseLabel&&ir.phTxt]}>{warehouseLabel||'Select Warehouse first...'}</Text>
        <Ionicons name="chevron-down" size={11} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <View style={ir.topRow}>
        <TouchableOpacity style={ir.prodBtn} onPress={()=>onModal({type:'product',itemId:item.id})} activeOpacity={0.7}>
          <Ionicons name="cube-outline" size={13} color={COLORS.textSecondary} />
          <Text style={[ir.prodTxt,!item.product&&ir.phTxt]} numberOfLines={1}>
            {productName||(item.warehouse?'Select product...':'Select warehouse first')}
          </Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.barcodeBtn} onPress={()=>onModal({type:'barcode',itemId:item.id})} activeOpacity={0.7}>
          <Ionicons name="barcode-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.delBtn} onPress={()=>onRemove(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
      <View style={ir.row}>
        <View style={ir.qBox}><Text style={ir.ml}>Qty</Text>
          <TextInput style={ir.mi} value={item.qty} onChangeText={v=>onUpdate(item.id,'qty',v)} keyboardType="numeric" placeholder="1" placeholderTextColor={COLORS.textTertiary} /></View>
        <TouchableOpacity style={ir.unitBtn} onPress={()=>onModal({type:'unit',itemId:item.id})} activeOpacity={0.7}>
          <Text style={ir.unitTxt}>{item.unit}</Text><Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={ir.rBox}><Text style={ir.ml}>Rate (₹)</Text>
          <TextInput style={ir.mi} value={item.rate} onChangeText={v=>onUpdate(item.id,'rate',v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} /></View>
      </View>
      <View style={ir.row}>
        <View style={ir.discRow}>
          <TouchableOpacity style={ir.discType} onPress={()=>onUpdate(item.id,'discountType',item.discountType==='%'?'flat':'%')} activeOpacity={0.7}>
            <Text style={ir.discTypeTxt}>{item.discountType}</Text>
          </TouchableOpacity>
          <TextInput style={ir.discInput} value={item.discount} onChangeText={v=>onUpdate(item.id,'discount',v)} keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textTertiary} />
          <Text style={ir.dl}>Disc</Text>
        </View>
        <TouchableOpacity style={ir.taxBtn} onPress={()=>onModal({type:'tax',itemId:item.id})} activeOpacity={0.7}>
          <Text style={ir.taxTxt}>GST {item.taxRate}%</Text><Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={ir.subRow}>
        <Text style={ir.subL}>Item Total</Text>
        <Text style={ir.subV}>₹{calc.subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text>
      </View>
    </View>
  );
}

export default function CreatePurchaseOrderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [poNo] = useState('PO-00190');
  const [date, setDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState('');
  const [ledger, setLedger] = useState('purchase_raw');
  const [vendor, setVendor] = useState('');
  const [terms, setTerms] = useState('30d');
  const [customDays, setCustomDays] = useState('');
  const [refNo, setRefNo] = useState('');
  const [items, setItems] = useState<POItem[]>([newItem()]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logTaxRate, setLogTaxRate] = useState('0');
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string,f:keyof POItem,v:string)=>setItems(prev=>prev.map(i=>i.id===id?{...i,[f]:v}:i)),[]);
  const removeItem = useCallback((id:string)=>setItems(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev),[]);
  const closeModal = useCallback(()=>setActiveModal(null),[]);

  const logisticsTotal = useMemo(()=>calcLogisticsTotal(logEntries,logTaxRate),[logEntries,logTaxRate]);

  const totals = useMemo(()=>{
    let gross=0,discTotal=0,taxTotal=0;
    items.forEach(i=>{const c=calcItem(i);gross+=c.gross;discTotal+=c.discAmt;taxTotal+=c.taxAmt;});
    const grand=gross-discTotal+taxTotal+logisticsTotal;
    return { gross, discTotal, taxTotal, cgst:taxTotal/2, sgst:taxTotal/2, logisticsTotal, grand };
  },[items,logisticsTotal]);

  const handleSubmit = useCallback((draft:boolean)=>{
    Toast.show({ type: 'success', text1: draft ? 'Draft Saved' : 'PO Created', text2: draft ? `${poNo} saved as draft.` : `Purchase Order ${poNo} sent to vendor.` });
    setTimeout(() => router.back(), 1000);
  },[poNo,router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Purchase Order</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{poNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Purchase Ledger */}
          <SearchableDropdown label="Purchase Ledger" required placeholder="Search ledger account..." options={PURCHASE_LEDGERS} value={ledger} onSelect={o=>setLedger(o.value)} icon="book-outline" />

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="bag-outline" size={18} color={COLORS.positive} /><Text style={s.cardTitle}>Order Details</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>PO No.</Text>
                <View style={s.autoBox}><Text style={s.autoTxt}>{poNo}</Text><Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} /></View>
              </View>
              <DateInput label="PO Date" required value={date} onChange={setDate} title="Order Date" />
            </View>
            <SearchableDropdown label="Vendor / Supplier" required placeholder="Search vendor..." options={VENDORS} value={vendor} onSelect={o=>setVendor(o.value)} />
            <View style={s.row2}>
              <DateInput label="Due Date" value={dueDate} onChange={setDueDate} title="Due Date" />
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Reference No.</Text>
                <TextInput style={s.fInput} value={refNo} onChangeText={setRefNo} placeholder="Optional" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <SearchableDropdown label="Payment Terms" options={PAYMENT_TERMS} value={terms} onSelect={o=>setTerms(o.value)} icon="time-outline" containerStyle={{marginBottom:terms==='custom'?SPACING.sm:0}} />
            {terms==='custom'&&(
              <View style={{marginBottom:0}}>
                <Text style={s.fLabel}>Number of Days</Text>
                <TextInput style={s.fInput} value={customDays} onChangeText={setCustomDays} placeholder="e.g. 45" keyboardType="numeric" placeholderTextColor={COLORS.textTertiary} />
              </View>
            )}
          </View>

          <View style={s.secHdr}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
            <Text style={s.secTitle}>Items to Order</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item=>(
            <ItemRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={()=>setItems(p=>[...p,newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add Product</Text>
          </TouchableOpacity>

          <LogisticsSection entries={logEntries} taxRate={logTaxRate} onEntriesChange={setLogEntries} onTaxRateChange={setLogTaxRate} />

          <View style={s.sumCard}>
            <Text style={s.sumTitle}>PO Summary</Text>
            <View style={s.sumRow}><Text style={s.sumL}>Subtotal</Text><Text style={s.sumV}>₹{totals.gross.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
            {totals.discTotal>0&&<View style={s.sumRow}><Text style={s.sumL}>Discount</Text><Text style={[s.sumV,{color:COLORS.positive}]}>-₹{totals.discTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            {totals.taxTotal>0&&<>
              <View style={s.sumRow}><Text style={s.sumL}>CGST</Text><Text style={s.sumV}>₹{totals.cgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
              <View style={s.sumRow}><Text style={s.sumL}>SGST</Text><Text style={s.sumV}>₹{totals.sgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
            </>}
            {totals.logisticsTotal>0&&<View style={s.sumRow}><Text style={s.sumL}>Logistics</Text><Text style={s.sumV}>₹{totals.logisticsTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            <View style={s.sumDiv} />
            <View style={s.sumRow}><Text style={s.sumGL}>PO Total</Text><Text style={s.sumGV}>₹{totals.grand.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
          </View>

          <View style={s.card}>
            <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Internal notes for vendor..." multiline numberOfLines={2}
              style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={s.draftBtn} onPress={()=>handleSubmit(true)} activeOpacity={0.7}>
            <Ionicons name="document-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.draftTxt}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={()=>handleSubmit(false)} activeOpacity={0.7}>
            <Ionicons name="send-outline" size={16} color={COLORS.white} />
            <Text style={s.submitTxt}>Send to Vendor</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Product Modal */}
      <Modal visible={activeModal?.type==='product'} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle}/><Text style={m.title}>Select Product</Text>
          {(()=>{
            const item=items.find(i=>i.id===activeModal?.itemId);
            const filtered=item?.warehouse?ALL_PRODUCTS.filter(p=>(WAREHOUSE_PRODUCTS[item.warehouse]||[]).includes(p.value)):ALL_PRODUCTS;
            return (<ScrollView showsVerticalScrollIndicator={false}>
              {item?.warehouse?(<View style={m.whHint}><Ionicons name="business-outline" size={13} color={COLORS.info} /><Text style={m.whHintTxt}>From: {WAREHOUSES.find(w=>w.value===item.warehouse)?.label}</Text></View>)
                :(<View style={m.whHint}><Ionicons name="alert-circle-outline" size={13} color={COLORS.warning} /><Text style={[m.whHintTxt,{color:COLORS.warning}]}>Select warehouse first</Text></View>)}
              {filtered.map(p=>(<TouchableOpacity key={p.value} style={[m.opt,item?.product===p.value&&m.optA]}
                onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'product',p.value);closeModal();}} activeOpacity={0.7}>
                <View style={m.optRow}><Ionicons name="cube-outline" size={16} color={COLORS.textSecondary} /><Text style={[m.optTxt,item?.product===p.value&&m.optTxtA]}>{p.label}</Text></View>
                {item?.product===p.value&&<Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
              </TouchableOpacity>))}
            </ScrollView>);
          })()}
        </View>
      </Modal>
      <Modal visible={activeModal?.type==='unit'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal}>
          <View style={m.center}>{UNITS.map(u=>(<TouchableOpacity key={u} style={m.unitOpt}
            onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'unit',u);closeModal();}} activeOpacity={0.7}>
            <Text style={[m.unitTxt,items.find(i=>i.id===activeModal?.itemId)?.unit===u&&{fontWeight:'800',color:COLORS.brandPrimary}]}>{u}</Text>
          </TouchableOpacity>))}</View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={activeModal?.type==='tax'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal}>
          <View style={m.center}>{TAX_RATES.map(t=>(<TouchableOpacity key={t} style={m.unitOpt}
            onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'taxRate',t);closeModal();}} activeOpacity={0.7}>
            <Text style={[m.unitTxt,items.find(i=>i.id===activeModal?.itemId)?.taxRate===t&&{fontWeight:'800',color:COLORS.brandPrimary}]}>GST {t}%</Text>
          </TouchableOpacity>))}</View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={activeModal?.type==='warehouse'} transparent animationType="slide" onRequestClose={closeModal}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={closeModal} />
        <View style={m.sheet}>
          <View style={m.handle}/><Text style={m.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAREHOUSES.map(w=>(<TouchableOpacity key={w.value} style={m.opt}
              onPress={()=>{if(activeModal){updateItem(activeModal.itemId,'warehouse',w.value);updateItem(activeModal.itemId,'product','');}closeModal();}} activeOpacity={0.7}>
              <View style={m.optRow}><Ionicons name="business-outline" size={16} color={COLORS.info} /><Text style={m.optTxt}>{w.label}</Text></View>
            </TouchableOpacity>))}
          </ScrollView>
        </View>
      </Modal>
      <BarcodeScannerModal visible={activeModal?.type==='barcode'}
        onScan={(v)=>{if(activeModal){updateItem(activeModal.itemId,'product',v);Alert.alert('✓ Product Found',`Added: ${ALL_PRODUCTS.find(p=>p.value===v)?.label||v}`);}closeModal();}}
        onClose={closeModal} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  header:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  badge:{backgroundColor:COLORS.positiveBg,paddingHorizontal:8,paddingVertical:4,borderRadius:RADIUS.full},
  badgeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.positive},
  scroll:{padding:SPACING.md,paddingBottom:8},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row2:{flexDirection:'row',gap:12,marginBottom:SPACING.md},
  fLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:6},
  fInput:{backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,minHeight:48},
  autoBox:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,minHeight:48},
  autoTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'600'},
  star:{color:COLORS.negative},
  dateBox:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,minHeight:48},
  dateTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'500',flex:1},
  datePlh:{color:COLORS.textTertiary},
  secHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  secTitle:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  countBadge:{backgroundColor:COLORS.brandPrimary,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center'},
  countTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:'#fff'},
  addBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:COLORS.positiveBg,borderRadius:RADIUS.md,paddingVertical:14,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.positive+'40',borderStyle:'dashed'},
  addTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.positive},
  sumCard:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  sumTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary,marginBottom:SPACING.md},
  sumRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},
  sumL:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  sumV:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary},
  sumDiv:{height:1,backgroundColor:COLORS.borderDefault,marginBottom:12},
  sumGL:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  sumGV:{fontSize:TYPOGRAPHY.lg,fontWeight:'800',color:COLORS.positive},
  footer:{flexDirection:'row',gap:12,paddingHorizontal:SPACING.md,paddingTop:SPACING.md,borderTopWidth:1,borderTopColor:COLORS.borderDefault,backgroundColor:COLORS.cardBg},
  draftBtn:{flex:1,flexDirection:'row',gap:6,paddingVertical:14,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center'},
  draftTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textSecondary},
  submitBtn:{flex:2,flexDirection:'row',gap:8,paddingVertical:14,borderRadius:RADIUS.md,backgroundColor:COLORS.positive,alignItems:'center',justifyContent:'center'},
  submitTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
const m = StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)'},
  sheet:{backgroundColor:COLORS.cardBg,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'65%',paddingTop:12},
  handle:{width:40,height:4,backgroundColor:COLORS.borderStrong,borderRadius:2,alignSelf:'center',marginBottom:16},
  title:{fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary,paddingHorizontal:SPACING.md,paddingBottom:8,marginBottom:4,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  whHint:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:SPACING.md,paddingVertical:10,backgroundColor:COLORS.infoBg},
  whHintTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.info,fontWeight:'600',flex:1},
  opt:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  optA:{backgroundColor:COLORS.pageBg},
  optRow:{flexDirection:'row',alignItems:'center',gap:10,flex:1},
  optTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary},
  optTxtA:{fontWeight:'700',color:COLORS.brandPrimary},
  center:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,margin:SPACING.xl,overflow:'hidden'},
  unitOpt:{paddingHorizontal:SPACING.xl,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault,alignItems:'center'},
  unitTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'600'},
});
const ir = StyleSheet.create({
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.sm,borderWidth:1,borderColor:COLORS.borderDefault},
  warehouseBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:9,borderWidth:1,borderColor:COLORS.borderDefault,marginBottom:8},
  warehouseBtnActive:{backgroundColor:COLORS.infoBg,borderColor:COLORS.info+'40'},
  warehouseTxt:{flex:1,fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.info},
  topRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},
  prodBtn:{flex:1,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:10,borderWidth:1,borderColor:COLORS.borderDefault},
  prodTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,fontWeight:'500'},
  phTxt:{color:COLORS.textTertiary},
  barcodeBtn:{width:36,height:36,alignItems:'center',justifyContent:'center',backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,borderWidth:1,borderColor:COLORS.borderDefault},
  delBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  row:{flexDirection:'row',gap:8,marginBottom:8,alignItems:'flex-end'},
  qBox:{width:72},rBox:{flex:1},
  ml:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:4},
  mi:{backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',minHeight:38},
  unitBtn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.borderDefault,alignSelf:'flex-end',minHeight:38},
  unitTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.textPrimary},
  discRow:{flex:1,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,borderWidth:1,borderColor:COLORS.borderDefault,paddingHorizontal:6,paddingVertical:4,minHeight:38},
  discType:{backgroundColor:COLORS.positive,paddingHorizontal:6,paddingVertical:4,borderRadius:4},
  discTypeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'800',color:'#fff',width:16,textAlign:'center'},
  discInput:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',paddingVertical:2},
  dl:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
  taxBtn:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.warningBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.warning+'30',minHeight:38},
  taxTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.warning},
  subRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderTopWidth:1,borderTopColor:COLORS.borderDefault,paddingTop:8},
  subL:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary},
  subV:{fontSize:TYPOGRAPHY.sm,fontWeight:'800',color:COLORS.textPrimary},
});
const bs = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#000'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:SPACING.md,paddingVertical:14,backgroundColor:COLORS.cardBg,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  closeBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  title:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary,textAlign:'center'},
  rescanBtn:{paddingHorizontal:12,paddingVertical:8,backgroundColor:COLORS.positive,borderRadius:RADIUS.md},
  rescanText:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.white},
  camera:{flex:1},
  overlay:{position:'absolute',bottom:0,left:0,right:0,alignItems:'center',paddingBottom:60},
  scanFrame:{width:220,height:220,borderWidth:2,borderColor:COLORS.white,borderRadius:16,marginBottom:24,opacity:0.8},
  hint:{fontSize:TYPOGRAPHY.sm,color:COLORS.white,fontWeight:'600'},
  permWrap:{flex:1,alignItems:'center',justifyContent:'center',gap:16,padding:SPACING.xl,backgroundColor:COLORS.pageBg},
  permText:{fontSize:TYPOGRAPHY.base,color:COLORS.textSecondary,textAlign:'center',lineHeight:22},
  permBtn:{backgroundColor:COLORS.positive,paddingHorizontal:24,paddingVertical:14,borderRadius:RADIUS.md},
  permBtnText:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
