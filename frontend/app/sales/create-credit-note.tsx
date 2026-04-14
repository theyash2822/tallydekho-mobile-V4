import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

const PARTIES: DropdownOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'XYZ Retail', value: 'xyz' },
  { label: 'Sharma Electronics', value: 'sharma' },
  { label: 'Delhi Suppliers', value: 'delhi' },
];
const LINKED_INVOICES: DropdownOption[] = [
  { label: 'INV-30978 — ₹42,500', value: 'inv30978' },
  { label: 'INV-30977 — ₹28,000', value: 'inv30977' },
  { label: 'INV-30976 — ₹15,000', value: 'inv30976' },
  { label: 'INV-30975 — ₹42,500', value: 'inv30975' },
  { label: 'INV-30974 — ₹35,000', value: 'inv30974' },
];
const WAREHOUSES: DropdownOption[] = [
  { label: 'Main Warehouse', value: 'main_wh' },
  { label: 'Store A', value: 'store_a' },
  { label: 'Store B', value: 'store_b' },
  { label: 'Delhi Depot', value: 'delhi_depot' },
];
const PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
];
const UNITS = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
const TAX_RATES = ['0', '5', '12', '18', '28'];

interface CItem {
  id: string; product: string; qty: string; unit: string;
  rate: string; discountType: '%'|'flat'; discount: string; taxRate: string; warehouse: string;
}
const newItem = (): CItem => ({ id: Date.now().toString(), product: '', qty: '1', unit: 'Pcs', rate: '', discountType: '%', discount: '0', taxRate: '18', warehouse: '' });
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };
const calcItem = (item: CItem) => {
  const qty = parseFloat(item.qty)||0, rate = parseFloat(item.rate)||0;
  const gross = qty*rate;
  const disc = parseFloat(item.discount)||0;
  const discAmt = item.discountType==='%' ? gross*disc/100 : Math.min(disc,gross);
  const taxable = gross - discAmt;
  const taxAmt = taxable*(parseFloat(item.taxRate)||0)/100;
  return { gross, discAmt, taxable, taxAmt, subtotal: taxable+taxAmt };
};

type ModalState = { type: 'product'|'unit'|'tax'|'warehouse'; itemId: string }|null;

function CreditItemRow({ item, onUpdate, onRemove, onModal }: {
  item: CItem; onUpdate:(id:string,f:keyof CItem,v:string)=>void;
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
          <Text style={[ir.prodTxt,!item.product&&ir.phTxt]} numberOfLines={1}>{pname||'Select returned product...'}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
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
        <View style={ir.qBox}><Text style={ir.ml}>Return Qty</Text>
          <TextInput style={ir.mi} value={item.qty} onChangeText={v=>onUpdate(item.id,'qty',v)} keyboardType="numeric" placeholder="1" placeholderTextColor={COLORS.textTertiary} />
        </View>
        <TouchableOpacity style={ir.unitBtn} onPress={()=>onModal({type:'unit',itemId:item.id})} activeOpacity={0.7}>
          <Text style={ir.unitTxt}>{item.unit}</Text><Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={ir.rBox}><Text style={ir.ml}>Unit Price (₹)</Text>
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
        <Text style={ir.subL}>Credit Amount</Text>
        <Text style={[ir.subV,{color:COLORS.negative}]}>₹{calc.subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text>
      </View>
    </View>
  );
}

export default function CreateCreditNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [cnNo] = useState('CN-00713');
  const [date, setDate] = useState(todayStr());
  const [party, setParty] = useState('');
  const [linkedInvoice, setLinkedInvoice] = useState('');
  const [items, setItems] = useState<CItem[]>([newItem()]);
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string,f:keyof CItem,v:string)=>setItems(prev=>prev.map(i=>i.id===id?{...i,[f]:v}:i)),[]);
  const removeItem = useCallback((id:string)=>setItems(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev),[]);

  const totals = useMemo(()=>{
    let gross=0,discTotal=0,taxTotal=0;
    items.forEach(i=>{const c=calcItem(i);gross+=c.gross;discTotal+=c.discAmt;taxTotal+=c.taxAmt;});
    return { gross, discTotal, taxTotal, grand: gross-discTotal+taxTotal };
  },[items]);

  const handleSubmit = useCallback(()=>{
    Alert.alert('✓ Credit Note Submitted', `Credit Note ${cnNo} submitted successfully!`,[{text:'OK',onPress:()=>router.back()}]);
  },[cnNo,router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Credit Note</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{cnNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <View style={s.cardHdr}>
              <View style={s.cnIcon}><Ionicons name="return-up-back-outline" size={16} color={COLORS.negative} /></View>
              <Text style={s.cardTitle}>Credit Note Details</Text>
            </View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>CN No.</Text>
                <View style={s.autoBox}><Text style={s.autoTxt}>{cnNo}</Text><Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} /></View>
              </View>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                <TextInput style={s.fInput} value={date} onChangeText={setDate} placeholder="DD/MM/YY" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <FormDropdown label="Customer / Party" value={party} options={PARTIES} onSelect={o=>setParty(o.value)} placeholder="Select customer..." required />
            <FormDropdown label="Reference Invoice" value={linkedInvoice} options={LINKED_INVOICES} onSelect={o=>setLinkedInvoice(o.value)} placeholder="Select reference invoice..." required containerStyle={{marginBottom:0}} />
          </View>

          <View style={s.secHdr}>
            <Ionicons name="return-up-back-outline" size={16} color={COLORS.negative} />
            <Text style={s.secTitle}>Returned Items</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item=>(
            <CreditItemRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={()=>setItems(p=>[...p,newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.negative} />
            <Text style={[s.addTxt,{color:COLORS.negative}]}>Add Returned Item</Text>
          </TouchableOpacity>

          <View style={s.sumCard}>
            <Text style={s.sumTitle}>Credit Note Summary</Text>
            <View style={s.sumRow}><Text style={s.sumL}>Subtotal</Text><Text style={s.sumV}>₹{totals.gross.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
            {totals.discTotal>0&&<View style={s.sumRow}><Text style={s.sumL}>Discount</Text><Text style={[s.sumV,{color:COLORS.positive}]}>-₹{totals.discTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            {totals.taxTotal>0&&<View style={s.sumRow}><Text style={s.sumL}>Tax (GST)</Text><Text style={s.sumV}>₹{totals.taxTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            <View style={s.sumDiv} />
            <View style={s.sumRow}><Text style={s.sumGL}>Total Credit</Text><Text style={[s.sumGV,{color:COLORS.negative}]}>₹{totals.grand.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
          </View>

          <View style={s.card}>
            <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Reason and internal notes..." multiline numberOfLines={2}
              style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={[s.submitBtn,{backgroundColor:COLORS.negative}]} onPress={handleSubmit} activeOpacity={0.7}>
            <Ionicons name="return-up-back-outline" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Submit Credit Note</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={activeModal?.type==='product'} transparent animationType="slide" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)} />
        <View style={m.sheet}>
          <View style={m.handle}/><Text style={m.title}>Select Product</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {PRODUCTS.map(p=>(
              <TouchableOpacity key={p.value} style={m.opt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'product',p.value);setActiveModal(null);}} activeOpacity={0.7}>
                <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} />
                <Text style={m.optTxt}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={activeModal?.type==='warehouse'} transparent animationType="slide" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)} />
        <View style={m.sheet}>
          <View style={m.handle}/><Text style={m.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAREHOUSES.map(w=>(
              <TouchableOpacity key={w.value} style={m.opt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'warehouse',w.value);setActiveModal(null);}} activeOpacity={0.7}>
                <Ionicons name="business-outline" size={14} color={COLORS.info} />
                <Text style={m.optTxt}>{w.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={activeModal?.type==='unit'} transparent animationType="fade" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)}>
          <View style={m.center}>{UNITS.map(u=>(
            <TouchableOpacity key={u} style={m.unitOpt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'unit',u);setActiveModal(null);}} activeOpacity={0.7}>
              <Text style={m.unitTxt}>{u}</Text>
            </TouchableOpacity>
          ))}</View>
        </TouchableOpacity>
      </Modal>
      <Modal visible={activeModal?.type==='tax'} transparent animationType="fade" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)}>
          <View style={m.center}>{TAX_RATES.map(t=>(
            <TouchableOpacity key={t} style={m.unitOpt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'taxRate',t);setActiveModal(null);}} activeOpacity={0.7}>
              <Text style={m.unitTxt}>GST {t}%</Text>
            </TouchableOpacity>
          ))}</View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  header:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  badge:{backgroundColor:COLORS.negativeBg,paddingHorizontal:8,paddingVertical:4,borderRadius:RADIUS.full},
  badgeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.negative},
  scroll:{padding:SPACING.md,paddingBottom:8},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cnIcon:{width:32,height:32,borderRadius:16,backgroundColor:COLORS.negativeBg,alignItems:'center',justifyContent:'center'},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row2:{flexDirection:'row',gap:12,marginBottom:SPACING.md},
  fLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:6},
  fInput:{backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,minHeight:48},
  autoBox:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,minHeight:48},
  autoTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'600'},
  star:{color:COLORS.negative},
  reasonBanner:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.warningBg,borderRadius:RADIUS.md,padding:12,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.warning+'40'},
  reasonTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.warning,flex:1},
  secHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  secTitle:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  countBadge:{backgroundColor:COLORS.negative,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center'},
  countTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:'#fff'},
  addBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:COLORS.negativeBg,borderRadius:RADIUS.md,paddingVertical:14,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.negative+'40',borderStyle:'dashed'},
  addTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.positive},
  sumCard:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  sumTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary,marginBottom:SPACING.md},
  sumRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},
  sumL:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  sumV:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary},
  sumDiv:{height:1,backgroundColor:COLORS.borderDefault,marginBottom:12},
  sumGL:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  sumGV:{fontSize:TYPOGRAPHY.lg,fontWeight:'800',color:COLORS.brandPrimary},
  footer:{paddingHorizontal:SPACING.md,paddingTop:SPACING.md,borderTopWidth:1,borderTopColor:COLORS.borderDefault,backgroundColor:COLORS.cardBg},
  submitBtn:{flexDirection:'row',gap:8,paddingVertical:14,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  submitTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
const m = StyleSheet.create({
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
  topRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},
  prodBtn:{flex:1,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:10,borderWidth:1,borderColor:COLORS.borderDefault},
  prodTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,fontWeight:'500'},
  phTxt:{color:COLORS.textTertiary},
  delBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  row:{flexDirection:'row',gap:8,marginBottom:8,alignItems:'flex-end'},
  qBox:{width:110},rBox:{flex:1},
  ml:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:4},
  mi:{backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',minHeight:38},
  unitBtn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.borderDefault,alignSelf:'flex-end',minHeight:38},
  unitTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.textPrimary},
  taxBtn:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.info+'30',minHeight:38},
  taxTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.info},
  subRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingTop:4},
  subL:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary},
  subV:{fontSize:TYPOGRAPHY.sm,fontWeight:'800',color:COLORS.textPrimary},
  warehouseBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:7,borderWidth:1,borderColor:COLORS.info+'30',marginBottom:8},
  warehouseTxt:{flex:1,fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.info},
  discRow:{flex:1,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,borderWidth:1,borderColor:COLORS.borderDefault,paddingHorizontal:6,paddingVertical:4,minHeight:38},
  discType:{backgroundColor:COLORS.brandPrimary,paddingHorizontal:6,paddingVertical:4,borderRadius:4},
  discTypeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'800',color:'#fff',width:16,textAlign:'center'},
  discInput:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',paddingVertical:2},
  dl:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
});
