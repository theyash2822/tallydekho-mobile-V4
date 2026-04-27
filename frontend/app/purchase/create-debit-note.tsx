import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { createDebitNote } from '../../src/services/api';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import SearchableDropdown, { SDOption } from '../../src/components/forms/SearchableDropdown';
import DatePickerModal from '../../src/components/forms/DatePickerModal';

const VENDORS: SDOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'Delhi Suppliers', value: 'delhi' },
  { label: 'Indian Export House', value: 'ieh' },
];
const LINKED_PO: SDOption[] = [
  { label: 'INV-30978 — ₹42,500', value: 'inv30978' },
  { label: 'INV-30977 — ₹28,000', value: 'inv30977' },
  { label: 'INV-30976 — ₹15,000', value: 'inv30976' },
  { label: 'PO-00189 — ₹45,000', value: 'po189' },
  { label: 'PO-00188 — ₹32,000', value: 'po188' },
];
const REASONS: SDOption[] = [
  { label: 'Defective / Damaged Goods', value: 'defective' },
  { label: 'Goods Not as Ordered', value: 'wrong_item' },
  { label: 'Short Supply', value: 'short' },
  { label: 'Overcharge / Price Correction', value: 'overcharge' },
  { label: 'Duplicate Billing', value: 'duplicate' },
  { label: 'Goods Returned to Vendor', value: 'return' },
  { label: 'Other', value: 'other' },
];
const ALL_PRODUCTS: SDOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
];
const UNITS = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
const TAX_RATES = ['0', '5', '12', '18', '28'];
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

interface DItem { id: string; product: string; qty: string; unit: string; rate: string; taxRate: string; warehouse: string; }
const newItem = (): DItem => ({ id: Date.now().toString(), product: '', qty: '1', unit: 'Pcs', rate: '', taxRate: '18', warehouse: '' });
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };
const calcItem = (item: DItem) => {
  const taxable = (parseFloat(item.qty)||0)*(parseFloat(item.rate)||0);
  const taxAmt = taxable*(parseFloat(item.taxRate)||0)/100;
  return { taxable, taxAmt, subtotal: taxable+taxAmt };
};

type ModalState = { type: 'product'|'unit'|'tax'|'warehouse'; itemId: string }|null;

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

function DebitItemRow({ item, onUpdate, onRemove, onModal }: {
  item: DItem; onUpdate:(id:string,f:keyof DItem,v:string)=>void;
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
        <TouchableOpacity style={ir.delBtn} onPress={()=>onRemove(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
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
      <View style={[ir.row,{justifyContent:'space-between',alignItems:'center'}]}>
        <TouchableOpacity style={ir.taxBtn} onPress={()=>onModal({type:'tax',itemId:item.id})} activeOpacity={0.7}>
          <Text style={ir.taxTxt}>GST {item.taxRate}%</Text><Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={ir.subV}>₹{calc.subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text>
      </View>
    </View>
  );
}

export default function CreateDebitNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, isPaired } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [dbnNo] = useState('DBN-00046');
  const [date, setDate] = useState(todayStr());
  const [vendor, setVendor] = useState('');
  const [linkedRef, setLinkedRef] = useState('');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<DItem[]>([newItem()]);
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string,f:keyof DItem,v:string)=>setItems(prev=>prev.map(i=>i.id===id?{...i,[f]:v}:i)),[]);
  const removeItem = useCallback((id:string)=>setItems(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev),[]);

  const totals = useMemo(()=>{
    let taxable=0,taxTotal=0;
    items.forEach(i=>{const c=calcItem(i);taxable+=c.taxable;taxTotal+=c.taxAmt;});
    return { taxable, taxTotal, grand:taxable+taxTotal };
  },[items]);

  const handleSubmit = useCallback(async (draft:boolean)=>{
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' }); return; }
    try {
      setSubmitting(true);
      await createDebitNote({
        company_guid: company?.guid, vendor, date,
        linked_ref: linkedRef || undefined,
        reason: reason || undefined,
        items: items.map(i=>({ stock_item: i.product, qty: parseFloat(i.qty)||0, rate: parseFloat(i.rate)||0, unit: i.unit, tax_rate: parseFloat(i.taxRate)||0 })),
        narration: narration || undefined,
        is_draft: draft,
      });
      Toast.show({ type: 'success', text1: draft?'Draft Saved':'Debit Note Issued', text2: draft?`${dbnNo} saved.`:`${dbnNo} sent to Tally.` });
      setTimeout(()=>router.back(),1000);
    } catch(err:any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message||'Could not submit.' });
    } finally { setSubmitting(false); }
  },[isPaired,company?.guid,vendor,date,linkedRef,reason,items,narration,dbnNo,router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Debit Note</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{dbnNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <View style={s.cardHdr}>
              <View style={s.dbnIcon}><Ionicons name="remove-circle-outline" size={16} color={COLORS.warning} /></View>
              <Text style={s.cardTitle}>Debit Note Details</Text>
            </View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>DBN No.</Text>
                <View style={s.autoBox}><Text style={s.autoTxt}>{dbnNo}</Text><Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} /></View>
              </View>
              <DateInput label="Date" required value={date} onChange={setDate} />
            </View>
            <SearchableDropdown label="Vendor Name" required placeholder="Search vendor..." options={VENDORS} value={vendor} onSelect={o=>setVendor(o.value)} />
            <SearchableDropdown label="Reference Invoice" placeholder="Select reference invoice..." options={LINKED_PO} value={linkedRef} onSelect={o=>setLinkedRef(o.value)} icon="document-outline" />
            <SearchableDropdown label="Reason" required placeholder="Select reason..." options={REASONS} value={reason} onSelect={o=>setReason(o.value)} icon="warning-outline" containerStyle={{marginBottom:0}} />
          </View>

          {reason !== '' && (
            <View style={s.reasonBanner}>
              <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
              <Text style={s.reasonTxt}>{REASONS.find(r=>r.value===reason)?.label}</Text>
            </View>
          )}

          <View style={s.secHdr}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
            <Text style={s.secTitle}>Items (Returned / Disputed)</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item=>(
            <DebitItemRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={()=>setItems(p=>[...p,newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add Item</Text>
          </TouchableOpacity>

          <View style={s.sumCard}>
            <Text style={s.sumTitle}>Debit Note Summary</Text>
            <View style={s.sumRow}><Text style={s.sumL}>Taxable Value</Text><Text style={s.sumV}>₹{totals.taxable.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
            {totals.taxTotal>0&&<View style={s.sumRow}><Text style={s.sumL}>Tax</Text><Text style={s.sumV}>₹{totals.taxTotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>}
            <View style={s.sumDiv} />
            <View style={s.sumRow}><Text style={s.sumGL}>Debit Amount</Text><Text style={[s.sumGV,{color:COLORS.warning}]}>₹{totals.grand.toLocaleString('en-IN',{minimumFractionDigits:2})}</Text></View>
          </View>

          <View style={s.card}>
            <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Notes for vendor..." multiline numberOfLines={2}
              style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={[s.draftBtn,submitting&&{opacity:0.5}]} onPress={()=>handleSubmit(true)} activeOpacity={0.7} disabled={submitting}>
            <Text style={s.draftTxt}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.submitBtn,{backgroundColor:COLORS.warning},submitting&&{opacity:0.6}]} onPress={()=>handleSubmit(false)} activeOpacity={0.7} disabled={submitting}>
            {submitting?<ActivityIndicator size="small" color={COLORS.white}/>:<Ionicons name="remove-circle-outline" size={16} color={COLORS.white}/>}
            <Text style={s.submitTxt}>{submitting?'Submitting...':'Issue Debit Note'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={activeModal?.type==='product'} transparent animationType="slide" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)} />
        <View style={m.sheet}>
          <View style={m.handle}/><Text style={m.title}>Select Product</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {(()=>{
              const item=items.find(i=>i.id===activeModal?.itemId);
              const filtered=item?.warehouse?ALL_PRODUCTS.filter(p=>(WAREHOUSE_PRODUCTS[item.warehouse]||[]).includes(p.value)):ALL_PRODUCTS;
              return filtered.map(p=>(
                <TouchableOpacity key={p.value} style={m.opt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'product',p.value);setActiveModal(null);}} activeOpacity={0.7}>
                  <Text style={m.optTxt}>{p.label}</Text>
                </TouchableOpacity>
              ));
            })()}
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
      <Modal visible={activeModal?.type==='warehouse'} transparent animationType="slide" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)} />
        <View style={m.sheet}>
          <View style={m.handle}/><Text style={m.title}>Select Warehouse</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {WAREHOUSES.map(w=>(
              <TouchableOpacity key={w.value} style={m.opt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'warehouse',w.value);setActiveModal(null);}} activeOpacity={0.7}>
                <Text style={m.optTxt}>{w.label}</Text>
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
  header:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  badge:{backgroundColor:COLORS.warningBg,paddingHorizontal:8,paddingVertical:4,borderRadius:RADIUS.full},
  badgeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.warning},
  scroll:{padding:SPACING.md,paddingBottom:8},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  dbnIcon:{width:32,height:32,borderRadius:16,backgroundColor:COLORS.warningBg,alignItems:'center',justifyContent:'center'},
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
  reasonBanner:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.warningBg,borderRadius:RADIUS.md,padding:12,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.warning+'40'},
  reasonTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.warning,flex:1,fontWeight:'600'},
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
  sumGV:{fontSize:TYPOGRAPHY.lg,fontWeight:'800',color:COLORS.brandPrimary},
  footer:{flexDirection:'row',gap:12,paddingHorizontal:SPACING.md,paddingTop:SPACING.md,borderTopWidth:1,borderTopColor:COLORS.borderDefault,backgroundColor:COLORS.cardBg},
  draftBtn:{flex:1,paddingVertical:14,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center'},
  draftTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textSecondary},
  submitBtn:{flex:2,flexDirection:'row',gap:8,paddingVertical:14,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  submitTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
const m = StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.4)'},
  sheet:{backgroundColor:COLORS.cardBg,borderTopLeftRadius:20,borderTopRightRadius:20,maxHeight:'60%',paddingTop:12},
  handle:{width:40,height:4,backgroundColor:COLORS.borderStrong,borderRadius:2,alignSelf:'center',marginBottom:16},
  title:{fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary,paddingHorizontal:SPACING.md,paddingBottom:8,marginBottom:4,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  opt:{paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
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
  warehouseBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:7,borderWidth:1,borderColor:COLORS.borderDefault,marginBottom:8},
  warehouseBtnActive:{backgroundColor:COLORS.infoBg,borderColor:COLORS.info+'40'},
  warehouseTxt:{flex:1,fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.info},
  row:{flexDirection:'row',gap:8,marginBottom:8,alignItems:'flex-end'},
  qBox:{width:72},rBox:{flex:1},
  ml:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:4},
  mi:{backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',minHeight:38},
  unitBtn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.borderDefault,alignSelf:'flex-end',minHeight:38},
  unitTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.textPrimary},
  taxBtn:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.info+'30',minHeight:38},
  taxTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.info},
  subV:{fontSize:TYPOGRAPHY.sm,fontWeight:'800',color:COLORS.textPrimary},
});
