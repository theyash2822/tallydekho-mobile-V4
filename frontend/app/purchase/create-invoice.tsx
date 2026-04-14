import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

// ─── Mock data ────────────────────────────────────────────────────────────────
const LEDGER_OPTS: DropdownOption[] = [
  { label: 'Purchase - Raw Materials', value: 'purchase_raw' },
  { label: 'Purchase - Finished Goods', value: 'purchase_fg' },
  { label: 'Expenses', value: 'expenses' },
  { label: 'Capital Purchase', value: 'capital' },
];
const VENDORS: DropdownOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'XYZ Retail', value: 'xyz' },
  { label: 'Delhi Suppliers', value: 'delhi' },
  { label: 'Indian Export House', value: 'ieh' },
];
const TERMS: DropdownOption[] = [
  { label: 'Due on Receipt', value: 'due' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: 'Custom', value: 'custom' },
  { label: 'Paid', value: 'paid' },
];
const PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
];
const UNITS = ['Pcs','Kg','Ltr','Mtr','Box','Nos'];
const TAX_RATES = ['0','5','12','18','28'];
const WAREHOUSES: DropdownOption[] = [
  { label: 'Main Warehouse', value: 'main_wh' },
  { label: 'Store A', value: 'store_a' },
  { label: 'Store B', value: 'store_b' },
  { label: 'Delhi Depot', value: 'delhi_depot' },
];
const PAY_STATUS_OPTS: DropdownOption[] = [
  { label: 'Payment Received', value: 'received' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: 'Custom', value: 'custom' },
];
const LOGISTICS_TYPES: DropdownOption[] = [
  { label: 'Courier', value: 'courier' },
  { label: 'Transport', value: 'transport' },
  { label: 'Freight', value: 'freight' },
  { label: 'Custom', value: 'custom' },
];

// OCR Mock Data — simulates a real sales invoice from vendor becoming our purchase record
const OCR_MOCK = {
  vendor: 'pqr', vendorName: 'PQR Exports', vendorInvNo: 'PQR/INV/2025-26/4872',
  items: [
    { id: '1', product: 'jbl_speaker', qty: '10', unit: 'Pcs', rate: '3400', discountType: '%' as '%'|'flat', discount: '5', taxRate: '18', warehouse: '' },
    { id: '2', product: 'sony_xm5', qty: '5', unit: 'Pcs', rate: '28500', discountType: '%' as '%'|'flat', discount: '0', taxRate: '18', warehouse: '' },
  ],
};

interface PItem {
  id: string; product: string; qty: string; unit: string;
  rate: string; discountType: '%'|'flat'; discount: string; taxRate: string; warehouse: string;
}
const newItem = (): PItem => ({ id: Date.now().toString(), product:'', qty:'1', unit:'Pcs', rate:'', discountType:'%', discount:'0', taxRate:'18', warehouse:'' });

type ModalState = { type:'product'|'unit'|'tax'|'warehouse'; itemId:string }|null;
const todayStr = () => { const d=new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };
const calcItem = (item: PItem) => {
  const qty=parseFloat(item.qty)||0, rate=parseFloat(item.rate)||0;
  const gross=qty*rate;
  const disc=parseFloat(item.discount)||0;
  const discAmt=item.discountType==='%'?gross*disc/100:Math.min(disc,gross);
  const taxable=gross-discAmt;
  const taxAmt=taxable*(parseFloat(item.taxRate)||0)/100;
  return { gross, discAmt, taxAmt, subtotal: taxable+taxAmt };
};

type OcrStatus = 'idle'|'scanning'|'done';

function ItemRow({ item, onUpdate, onRemove, onModal }: {
  item: PItem; onUpdate:(id:string,f:keyof PItem,v:string)=>void;
  onRemove:(id:string)=>void; onModal:(s:ModalState)=>void;
}) {
  const calc = calcItem(item);
  const pname = PRODUCTS.find(p=>p.value===item.product)?.label;
  const wname = WAREHOUSES.find(w=>w.value===item.warehouse)?.label;
  return (
    <View style={ir.card}>
      <View style={ir.topRow}>
        <TouchableOpacity style={ir.prodBtn} onPress={()=>onModal({type:'product',itemId:item.id})} activeOpacity={0.7}>
          <Ionicons name="cube-outline" size={13} color={COLORS.textSecondary} />
          <Text style={[ir.prodTxt,!item.product&&ir.phTxt]} numberOfLines={1}>{pname||'Select product...'}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.barcodeBtn} activeOpacity={0.7}>
          <Ionicons name="barcode-outline" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.delBtn} onPress={()=>onRemove(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={ir.warehouseBtn} onPress={()=>onModal({type:'warehouse',itemId:item.id})} activeOpacity={0.7}>
        <Ionicons name="business-outline" size={12} color={COLORS.info} />
        <Text style={[ir.warehouseTxt,!wname&&ir.phTxt]}>{wname||'Select Warehouse'}</Text>
        <Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <View style={ir.row}>
        <View style={ir.qBox}><Text style={ir.ml}>Qty</Text>
          <TextInput style={ir.mi} value={item.qty} onChangeText={v=>onUpdate(item.id,'qty',v)} keyboardType="numeric" placeholder="1" placeholderTextColor={COLORS.textTertiary} />
        </View>
        <TouchableOpacity style={ir.unitBtn} onPress={()=>onModal({type:'unit',itemId:item.id})} activeOpacity={0.7}>
          <Text style={ir.unitTxt}>{item.unit}</Text><Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={ir.rBox}><Text style={ir.ml}>Rate (₹)</Text>
          <TextInput style={ir.mi} value={item.rate} onChangeText={v=>onUpdate(item.id,'rate',v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
        </View>
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

export default function CreatePurchaseInvoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [showCamera, setShowCamera] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [ledger, setLedger] = useState('purchase_raw');
  const [invNo] = useState('PINV-00089');
  const [date, setDate] = useState(todayStr());
  const [vendor, setVendor] = useState('');
  const [vendorInvNo, setVendorInvNo] = useState('');
  const [vendorInvDate, setVendorInvDate] = useState('');
  const [payTerms, setPayTerms] = useState('30d');
  const [purchaseRefNo, setPurchaseRefNo] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [payCustomDays, setPayCustomDays] = useState('');
  const [logRemark, setLogRemark] = useState('');
  const [logTaxRate, setLogTaxRate] = useState('0');
  const [items, setItems] = useState<PItem[]>([newItem()]);
  const [showLogistics, setShowLogistics] = useState(false);
  const [logType, setLogType] = useState('');
  const [logAmount, setLogAmount] = useState('');
  const [logTracking, setLogTracking] = useState('');
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string,f:keyof PItem,v:string)=>setItems(prev=>prev.map(i=>i.id===id?{...i,[f]:v}:i)),[]);
  const removeItem = useCallback((id:string)=>setItems(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev),[]);

  const totals = useMemo(()=>{
    let gross=0,discTotal=0,taxTotal=0;
    items.forEach(i=>{const c=calcItem(i);gross+=c.gross;discTotal+=c.discAmt;taxTotal+=c.taxAmt;});
    const logAmt = parseFloat(logAmount)||0;
    const grand = gross-discTotal+taxTotal+logAmt;
    return { gross, discTotal, taxTotal, cgst:taxTotal/2, sgst:taxTotal/2, logAmt, grand };
  },[items,logAmount]);

  // handleCapture: called when user presses shutter inside camera modal
  const handleCapture = useCallback(()=>{
    setShowCamera(false);
    setOcrStatus('scanning');
    setTimeout(()=>{
      setVendor(OCR_MOCK.vendor);
      setVendorInvNo(OCR_MOCK.vendorInvNo);
      setVendorInvDate(todayStr());
      setItems(OCR_MOCK.items.map(i=>({...i})));
      setOcrStatus('done');
    }, 2200);
  },[]);

  // openCamera: request permission then open camera modal
  const openCamera = useCallback(async ()=>{
    if (permission && !permission.granted && permission.canAskAgain) {
      await requestPermission();
    }
    setShowCamera(true);
  },[permission, requestPermission]);

  const handleSubmit = useCallback((draft:boolean)=>{
    Alert.alert(draft?'Draft Saved':'Invoice Submitted', draft?`${invNo} saved as draft.`:`Purchase invoice ${invNo} submitted successfully!`,[{text:'OK',onPress:()=>router.back()}]);
  },[invNo,router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Purchase Invoice</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{invNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* OCR SCAN BANNER */}
          {ocrStatus === 'idle' && (
            <View style={s.ocrCard}>
              <View style={s.ocrTop}>
                <View style={s.ocrIconBox}>
                  <Ionicons name="scan-outline" size={28} color={COLORS.brandPrimary} />
                </View>
                <View style={{flex:1}}>
                  <Text style={s.ocrTitle}>Scan Vendor Bill</Text>
                  <Text style={s.ocrSub}>Auto-fill invoice details using OCR</Text>
                </View>
              </View>
              <View style={s.ocrBtns}>
                <TouchableOpacity style={s.ocrBtn} onPress={openCamera} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={16} color={COLORS.white} />
                  <Text style={s.ocrBtnTxt}>Scan Bill</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ocrBtnOutline} onPress={openCamera} activeOpacity={0.7}>
                  <Ionicons name="cloud-upload-outline" size={16} color={COLORS.brandPrimary} />
                  <Text style={s.ocrBtnOutlineTxt}>Upload Image / PDF</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.ocrHint}>OCR will extract: Vendor • Date • Items • Tax & Total</Text>
            </View>
          )}

          {ocrStatus === 'scanning' && (
            <View style={s.scanningCard}>
              <ActivityIndicator size="large" color={COLORS.brandPrimary} />
              <Text style={s.scanningTitle}>Scanning Bill...</Text>
              <Text style={s.scanningSub}>Extracting vendor details, items and tax info</Text>
            </View>
          )}

          {ocrStatus === 'done' && (
            <View style={s.ocrSuccess}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.positive} />
              <Text style={s.ocrSuccessTxt}>Bill scanned! Details auto-filled below. Review and edit if needed.</Text>
              <TouchableOpacity onPress={()=>setOcrStatus('idle')} activeOpacity={0.7}>
                <Text style={s.ocrRescan}>Re-scan</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ledger */}
          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="albums-outline" size={18} color={COLORS.textSecondary} /><Text style={s.cardTitle}>Ledger Selection</Text></View>
            <FormDropdown label="Purchase Ledger" value={ledger} options={LEDGER_OPTS} onSelect={o=>setLedger(o.value)} placeholder="Select ledger..." required containerStyle={{marginBottom:0}} />
          </View>

          {/* Invoice Details */}
          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="document-text-outline" size={18} color={COLORS.brandPrimary} /><Text style={s.cardTitle}>Invoice Details</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Our Ref. No.</Text>
                <View style={s.autoBox}><Text style={s.autoTxt}>{invNo}</Text><Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} /></View>
              </View>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                <TextInput style={s.fInput} value={date} onChangeText={setDate} placeholder="DD/MM/YY" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <FormDropdown label="Vendor / Supplier" value={vendor} options={VENDORS} onSelect={o=>setVendor(o.value)} placeholder="Select vendor..." required />
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Purchase Reference No. <Text style={s.star}>*</Text></Text>
                <TextInput style={s.fInput} value={purchaseRefNo} onChangeText={setPurchaseRefNo} placeholder="e.g. PR-2025/001" placeholderTextColor={COLORS.textTertiary} />
              </View>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Vendor Invoice No.</Text>
                <TextInput style={s.fInput} value={vendorInvNo} onChangeText={setVendorInvNo} placeholder="Optional" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Vendor Inv. Date</Text>
                <TextInput style={s.fInput} value={vendorInvDate} onChangeText={setVendorInvDate} placeholder="DD/MM/YY" placeholderTextColor={COLORS.textTertiary} />
              </View>
              <View style={{flex:1}}>
                <FormDropdown label="Payment Terms" value={payTerms} options={TERMS} onSelect={o=>setPayTerms(o.value)} placeholder="Select terms..." containerStyle={{marginBottom:0}} />
              </View>
            </View>
          </View>

          {/* Products Section */}
          <View style={s.secHdr}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
            <Text style={s.secTitle}>Products / Items</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item=>(
            <ItemRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={()=>setItems(p=>[...p,newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add Product</Text>
          </TouchableOpacity>

          {/* Logistics */}
          <TouchableOpacity style={s.logToggle} onPress={()=>setShowLogistics(!showLogistics)} activeOpacity={0.7}>
            <Ionicons name="car-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.logToggleTxt}>Logistics / Shipping</Text>
            <Ionicons name={showLogistics?"chevron-up":"chevron-down"} size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {showLogistics && (
            <View style={s.card}>
              <FormDropdown label="Logistics Type" value={logType} options={LOGISTICS_TYPES} onSelect={o=>setLogType(o.value)} placeholder="Select type..." />
              <View style={s.row2}>
                <View style={{flex:1}}><Text style={s.fLabel}>Amount (₹)</Text>
                  <TextInput style={s.fInput} value={logAmount} onChangeText={setLogAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
                </View>
                <View style={{flex:1}}><Text style={s.fLabel}>Tracking No.</Text>
                  <TextInput style={s.fInput} value={logTracking} onChangeText={setLogTracking} placeholder="Optional" placeholderTextColor={COLORS.textTertiary} />
                </View>
              </View>
              <FormDropdown label="Tax on Logistics" value={logTaxRate} options={[{label:'No Tax (0%)',value:'0'},{label:'GST 5%',value:'5'},{label:'GST 12%',value:'12'},{label:'GST 18%',value:'18'}]} onSelect={o=>setLogTaxRate(o.value)} placeholder="Select tax..." containerStyle={{marginBottom:SPACING.sm}} />
              <FormField label="Remark" value={logRemark} onChangeText={setLogRemark} placeholder="Logistics notes..." containerStyle={{marginBottom:0}} />
            </View>
          )}

          {/* Payment Status */}
          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="card-outline" size={18} color={COLORS.positive} /><Text style={s.cardTitle}>Payment Status</Text></View>
            <FormDropdown label="Status" value={payStatus} options={PAY_STATUS_OPTS} onSelect={o=>setPayStatus(o.value)} placeholder="Select payment status..." containerStyle={{marginBottom: payStatus==='custom' ? SPACING.sm : 0}} />
            {payStatus==='custom' && (
              <View>
                <Text style={s.fLabel}>Number of Days</Text>
                <TextInput style={[s.fInput,{marginBottom:0}]} value={payCustomDays} onChangeText={setPayCustomDays} placeholder="e.g. 45" keyboardType="numeric" placeholderTextColor={COLORS.textTertiary} />
              </View>
            )}
          </View>

          {/* Narration */}
          <View style={s.card}>
            <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Internal notes..." multiline numberOfLines={2} style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>

          {/* Summary */}
          <View style={s.sumCard}>
            <Text style={s.sumTitle}>Invoice Summary</Text>
            <View style={s.sumRow}><Text style={s.sumL}>Subtotal</Text><Text style={s.sumV}>₹{totals.gross.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
            {totals.discTotal>0&&<View style={s.sumRow}><Text style={s.sumL}>Discount</Text><Text style={[s.sumV,{color:COLORS.positive}]}>-₹{totals.discTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            {totals.taxTotal>0&&<><View style={s.sumRow}><Text style={s.sumL}>CGST</Text><Text style={s.sumV}>₹{totals.cgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
            <View style={s.sumRow}><Text style={s.sumL}>SGST</Text><Text style={s.sumV}>₹{totals.sgst.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View></> }
            {totals.logAmt>0&&<View style={s.sumRow}><Text style={s.sumL}>Logistics</Text><Text style={s.sumV}>₹{totals.logAmt.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            <View style={s.sumDiv}/>
            <View style={s.sumRow}><Text style={s.sumGL}>Grand Total</Text><Text style={s.sumGV}>₹{totals.grand.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={s.draftBtn} onPress={()=>handleSubmit(true)} activeOpacity={0.7}>
            <Text style={s.draftTxt}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={()=>handleSubmit(false)} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Submit Invoice</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Camera OCR Modal */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent onRequestClose={()=>setShowCamera(false)}>
        <View style={cam.container}>
          {permission?.granted ? (
            <CameraView style={StyleSheet.absoluteFillObject} facing="back">
              <View style={cam.overlay}>
                <SafeAreaView edges={['top']} style={cam.topBar}>
                  <TouchableOpacity style={cam.closeBtn} onPress={()=>setShowCamera(false)} activeOpacity={0.7}>
                    <Ionicons name="close" size={26} color="#fff" />
                  </TouchableOpacity>
                  <Text style={cam.topTitle}>Scan Vendor Bill</Text>
                  <View style={{width:44}} />
                </SafeAreaView>
                <View style={cam.frameArea}>
                  <View style={cam.scanFrame}>
                    <View style={[cam.corner,cam.tl]} /><View style={[cam.corner,cam.tr]} />
                    <View style={[cam.corner,cam.bl]} /><View style={[cam.corner,cam.br]} />
                    <View style={cam.scanLine} />
                  </View>
                  <Text style={cam.frameHint}>Align vendor bill within the frame</Text>
                </View>
                <View style={cam.bottomBar}>
                  <View style={cam.ocrBadge}>
                    <Ionicons name="scan-outline" size={12} color={COLORS.brandPrimary} />
                    <Text style={cam.ocrBadgeTxt}>OCR • Auto-fill Invoice Details</Text>
                  </View>
                  <TouchableOpacity style={cam.captureBtn} onPress={handleCapture} activeOpacity={0.8}>
                    <View style={cam.captureRing}><View style={cam.captureDot} /></View>
                  </TouchableOpacity>
                  <Text style={cam.captureLabel}>Tap to Capture & Scan</Text>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={cam.permBox}>
              <View style={cam.permIconBox}><Ionicons name="camera-outline" size={52} color={COLORS.textTertiary} /></View>
              <Text style={cam.permTitle}>Camera Access Required</Text>
              <Text style={cam.permSub}>Allow camera to scan vendor bills{'\n'}and auto-fill purchase invoice details</Text>
              <TouchableOpacity style={cam.permBtn} onPress={requestPermission} activeOpacity={0.7}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={cam.permBtnTxt}>Allow Camera Access</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cam.skipBtn} onPress={handleCapture} activeOpacity={0.7}>
                <Text style={cam.skipTxt}>Use Sample Data Instead →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Item Modals */}
      <Modal visible={activeModal?.type==='product'} transparent animationType="slide" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={mm.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)} />
        <View style={mm.sheet}>
          <View style={mm.handle}/><Text style={mm.title}>Select Product</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {PRODUCTS.map(p=>(
              <TouchableOpacity key={p.value} style={mm.opt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'product',p.value);setActiveModal(null);}} activeOpacity={0.7}>
                <Ionicons name="cube-outline" size={15} color={COLORS.textSecondary} />
                <Text style={mm.optTxt}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={activeModal?.type==='unit'} transparent animationType="fade" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={mm.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)}>
          <View style={mm.center}>
            {UNITS.map(u=>(
              <TouchableOpacity key={u} style={mm.unitOpt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'unit',u);setActiveModal(null);}} activeOpacity={0.7}>
                <Text style={mm.unitTxt}>{u}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={activeModal?.type==='tax'} transparent animationType="fade" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={mm.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)}>
          <View style={mm.center}>
            {TAX_RATES.map(t=>(
              <TouchableOpacity key={t} style={mm.unitOpt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'taxRate',t);setActiveModal(null);}} activeOpacity={0.7}>
                <Text style={mm.unitTxt}>GST {t}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={activeModal?.type==='warehouse'} transparent animationType="slide" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={mm.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)} />
        <View style={mm.sheet}>
          <View style={mm.handle}/><Text style={mm.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAREHOUSES.map(w=>(
              <TouchableOpacity key={w.value} style={mm.opt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'warehouse',w.value);setActiveModal(null);}} activeOpacity={0.7}>
                <Ionicons name="business-outline" size={15} color={COLORS.info} />
                <Text style={mm.optTxt}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  header:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  badge:{backgroundColor:COLORS.positiveBg,paddingHorizontal:10,paddingVertical:4,borderRadius:RADIUS.full},
  badgeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.positive},
  scroll:{padding:SPACING.md,paddingBottom:8},
  ocrCard:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:2,borderColor:COLORS.brandPrimary,borderStyle:'dashed'},
  ocrTop:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:SPACING.md},
  ocrIconBox:{width:52,height:52,borderRadius:26,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center'},
  ocrTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'800',color:COLORS.textPrimary},
  ocrSub:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,marginTop:2},
  ocrBtns:{flexDirection:'row',gap:10,marginBottom:SPACING.sm},
  ocrBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:12},
  ocrBtnTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.white},
  ocrBtnOutline:{flex:1.5,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:COLORS.cardBg,borderRadius:RADIUS.md,paddingVertical:12,borderWidth:1.5,borderColor:COLORS.borderStrong},
  ocrBtnOutlineTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary},
  ocrHint:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary,textAlign:'center'},
  scanningCard:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.xl,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',gap:12},
  scanningTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  scanningSub:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,textAlign:'center'},
  ocrSuccess:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.positiveBg,borderRadius:RADIUS.md,padding:12,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.positive+'40'},
  ocrSuccessTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.positive,fontWeight:'500'},
  ocrRescan:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.brandPrimary},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row2:{flexDirection:'row',gap:12,marginBottom:SPACING.md},
  fLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:6},
  fInput:{backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,minHeight:48},
  autoBox:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,minHeight:48},
  autoTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'600'},
  star:{color:COLORS.negative},
  secHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  secTitle:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  countBadge:{backgroundColor:COLORS.brandPrimary,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center'},
  countTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:'#fff'},
  addBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:COLORS.positiveBg,borderRadius:RADIUS.md,paddingVertical:14,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.positive+'40',borderStyle:'dashed'},
  addTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.positive},
  logToggle:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,borderRadius:RADIUS.md,padding:SPACING.md,marginBottom:SPACING.sm,borderWidth:1,borderColor:COLORS.borderDefault},
  logToggleTxt:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textSecondary},
  sumCard:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  sumTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary,marginBottom:SPACING.md},
  sumRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},
  sumL:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  sumV:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary},
  sumDiv:{height:1,backgroundColor:COLORS.borderDefault,marginBottom:12},
  sumGL:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  sumGV:{fontSize:TYPOGRAPHY.lg,fontWeight:'800',color:COLORS.brandPrimary},
  footer:{flexDirection:'row',gap:12,paddingHorizontal:SPACING.md,paddingTop:SPACING.md,borderTopWidth:1,borderTopColor:COLORS.borderDefault,backgroundColor:COLORS.cardBg},
  draftBtn:{flex:1,paddingVertical:14,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center'},
  draftTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textSecondary},
  submitBtn:{flex:2,flexDirection:'row',gap:8,paddingVertical:14,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  submitTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
const mm = StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)'},
  sheet:{backgroundColor:COLORS.cardBg,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'60%',paddingTop:12},
  handle:{width:40,height:4,backgroundColor:COLORS.borderStrong,borderRadius:2,alignSelf:'center',marginBottom:16},
  title:{fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary,paddingHorizontal:SPACING.md,paddingBottom:8,marginBottom:4,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  opt:{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  optTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary},
  center:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,margin:SPACING.xl,overflow:'hidden'},
  unitOpt:{paddingHorizontal:SPACING.xl,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault,alignItems:'center'},
  unitTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'600'},
});
const ir = StyleSheet.create({
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.sm,borderWidth:1,borderColor:COLORS.borderDefault},
  topRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10},
  prodBtn:{flex:1,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:10,borderWidth:1,borderColor:COLORS.borderDefault},
  prodTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,fontWeight:'500'},
  phTxt:{color:COLORS.textTertiary},
  barcodeBtn:{width:36,height:36,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center'},
  delBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  warehouseBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:7,borderWidth:1,borderColor:COLORS.info+'30',marginBottom:8},
  warehouseTxt:{flex:1,fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.info},
  row:{flexDirection:'row',gap:8,marginBottom:8,alignItems:'flex-end'},
  qBox:{width:72},rBox:{flex:1},
  ml:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:4},
  mi:{backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',minHeight:38},
  unitBtn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.borderDefault,alignSelf:'flex-end',minHeight:38},
  unitTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.textPrimary},
  discRow:{flex:1,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,borderWidth:1,borderColor:COLORS.borderDefault,paddingHorizontal:6,paddingVertical:4,minHeight:38},
  discType:{backgroundColor:COLORS.brandPrimary,paddingHorizontal:6,paddingVertical:4,borderRadius:4},
  discTypeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'800',color:'#fff',width:16,textAlign:'center'},
  discInput:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',paddingVertical:2},
  dl:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
  taxBtn:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.info+'30',minHeight:38},
  taxTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.info},
  subRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderTopWidth:1,borderTopColor:COLORS.borderDefault,paddingTop:8},
  subL:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary},
  subV:{fontSize:TYPOGRAPHY.sm,fontWeight:'800',color:COLORS.textPrimary},
});

const cam = StyleSheet.create({
  container:{flex:1,backgroundColor:'#000'},
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.3)'},
  topBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:12},
  closeBtn:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(0,0,0,0.55)',alignItems:'center',justifyContent:'center'},
  topTitle:{fontSize:17,fontWeight:'700',color:'#fff'},
  frameArea:{flex:1,alignItems:'center',justifyContent:'center',gap:18},
  scanFrame:{width:290,height:188,borderRadius:6,position:'relative',overflow:'visible'},
  corner:{position:'absolute',width:26,height:26,borderColor:COLORS.brandPrimary,borderWidth:3},
  tl:{top:-1,left:-1,borderRightWidth:0,borderBottomWidth:0,borderTopLeftRadius:6},
  tr:{top:-1,right:-1,borderLeftWidth:0,borderBottomWidth:0,borderTopRightRadius:6},
  bl:{bottom:-1,left:-1,borderRightWidth:0,borderTopWidth:0,borderBottomLeftRadius:6},
  br:{bottom:-1,right:-1,borderLeftWidth:0,borderTopWidth:0,borderBottomRightRadius:6},
  scanLine:{position:'absolute',top:'48%',left:10,right:10,height:2,backgroundColor:COLORS.brandPrimary,opacity:0.7,borderRadius:1},
  frameHint:{fontSize:14,color:'rgba(255,255,255,0.82)',textAlign:'center',fontWeight:'500'},
  bottomBar:{paddingBottom:52,paddingHorizontal:32,alignItems:'center',gap:14},
  ocrBadge:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(0,0,0,0.65)',paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:COLORS.brandPrimary+'60'},
  ocrBadgeTxt:{fontSize:12,color:COLORS.brandPrimary,fontWeight:'700'},
  captureBtn:{width:76,height:76,borderRadius:38,borderWidth:3,borderColor:'rgba(255,255,255,0.9)',alignItems:'center',justifyContent:'center'},
  captureRing:{width:62,height:62,borderRadius:31,borderWidth:2,borderColor:'rgba(255,255,255,0.4)',alignItems:'center',justifyContent:'center'},
  captureDot:{width:52,height:52,borderRadius:26,backgroundColor:'#fff'},
  captureLabel:{fontSize:12,color:'rgba(255,255,255,0.65)',fontWeight:'500'},
  permBox:{flex:1,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center',padding:32,gap:18},
  permIconBox:{width:100,height:100,borderRadius:50,backgroundColor:COLORS.pageBg,borderWidth:1.5,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center',marginBottom:4},
  permTitle:{fontSize:20,fontWeight:'800',color:COLORS.textPrimary,textAlign:'center'},
  permSub:{fontSize:14,color:COLORS.textSecondary,textAlign:'center',lineHeight:22},
  permBtn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.brandPrimary,paddingHorizontal:28,paddingVertical:14,borderRadius:12,marginTop:4},
  permBtnTxt:{fontSize:15,fontWeight:'700',color:'#fff'},
  skipBtn:{paddingVertical:10},
  skipTxt:{fontSize:14,color:COLORS.textSecondary,textDecorationLine:'underline'},
});
