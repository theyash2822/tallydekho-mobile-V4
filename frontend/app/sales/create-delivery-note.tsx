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
import { createDeliveryNote } from '../../src/services/api';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';
import SearchableDropdown, { SDOption } from '../../src/components/forms/SearchableDropdown';
import DatePickerModal from '../../src/components/forms/DatePickerModal';
import BrandSwitch from '../../src/components/forms/BrandSwitch';

const PARTIES: SDOption[] = [
  { label: 'ABC Traders', value: 'abc' },
  { label: 'PQR Exports', value: 'pqr' },
  { label: 'Kumar & Sons', value: 'kumar' },
  { label: 'XYZ Retail', value: 'xyz' },
  { label: 'Sharma Electronics', value: 'sharma' },
  { label: 'Delhi Suppliers', value: 'delhi' },
];
const INVOICES: SDOption[] = [
  { label: 'INV-30979 - ABC Traders', value: 'inv30979' },
  { label: 'INV-30978 - ABC Traders', value: 'inv30978' },
  { label: 'INV-30977 - PQR Exports', value: 'inv30977' },
  { label: 'SO-00246 - Kumar & Sons', value: 'so246' },
  { label: 'SO-00245 - ABC Traders', value: 'so245' },
];
const DISPATCH_METHODS: SDOption[] = [
  { label: 'By Courier', value: 'courier' },
  { label: 'By Road', value: 'road' },
  { label: 'By Rail', value: 'rail' },
  { label: 'By Air', value: 'air' },
  { label: 'Own Vehicle', value: 'own' },
  { label: 'By Hand', value: 'hand' },
];
const PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
];
const UNITS = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];

interface DNItem { id: string; product: string; qty: string; unit: string; unitPrice: string; }
const newItem = (): DNItem => ({ id: Date.now().toString(), product: '', qty: '1', unit: 'Pcs', unitPrice: '' });
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };

type ModalState = { type: 'product'|'unit'; itemId: string }|null;

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

function DeliveryItemRow({ item, onUpdate, onRemove, onModal }: {
  item: DNItem; onUpdate:(id:string,f:keyof DNItem,v:string)=>void;
  onRemove:(id:string)=>void; onModal:(s:ModalState)=>void;
}) {
  const pname = PRODUCTS.find(p=>p.value===item.product)?.label;
  return (
    <View style={ir.card}>
      <View style={ir.topRow}>
        <TouchableOpacity style={ir.prodBtn} onPress={()=>onModal({type:'product',itemId:item.id})} activeOpacity={0.7}>
          <Ionicons name="cube-outline" size={13} color={COLORS.textSecondary} />
          <Text style={[ir.prodTxt,!item.product&&ir.phTxt]} numberOfLines={1}>{pname||'Select product...'}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={ir.delBtn} onPress={()=>onRemove(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle" size={20} color={COLORS.negative} />
        </TouchableOpacity>
      </View>
      <View style={ir.row}>
        <View style={ir.qBox}><Text style={ir.ml}>Qty to Deliver</Text>
          <TextInput style={ir.mi} value={item.qty} onChangeText={v=>onUpdate(item.id,'qty',v)} keyboardType="numeric" placeholder="1" placeholderTextColor={COLORS.textTertiary} />
        </View>
        <TouchableOpacity style={ir.unitBtn} onPress={()=>onModal({type:'unit',itemId:item.id})} activeOpacity={0.7}>
          <Text style={ir.unitTxt}>{item.unit}</Text><Ionicons name="chevron-down" size={10} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={ir.rBox}><Text style={ir.ml}>Unit Price (₹)</Text>
          <TextInput style={ir.mi} value={item.unitPrice} onChangeText={v=>onUpdate(item.id,'unitPrice',v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
        </View>
      </View>
    </View>
  );
}

export default function CreateDeliveryNoteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, isPaired } = useAuth();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [submitting, setSubmitting] = useState(false);
  const [dnNo] = useState('DN-00235');
  const [date, setDate] = useState(todayStr());
  const [dispatchDate, setDispatchDate] = useState('');
  const [party, setParty] = useState('');
  const [linkedRef, setLinkedRef] = useState('');
  const [dispatchMethod, setDispatchMethod] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [showVehicleInfo, setShowVehicleInfo] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleNarration, setVehicleNarration] = useState('');
  const [items, setItems] = useState<DNItem[]>([newItem()]);
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string,f:keyof DNItem,v:string)=>setItems(prev=>prev.map(i=>i.id===id?{...i,[f]:v}:i)),[]);
  const removeItem = useCallback((id:string)=>setItems(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev),[]);

  const handleSubmit = useCallback(async ()=>{
    if (!isPaired) { Toast.show({ type: 'error', text1: 'Not Paired', text2: 'Please pair with Tally Desktop first.' }); return; }
    try {
      setSubmitting(true);
      await createDeliveryNote({
        company_guid: company?.guid, party, date,
        dispatch_date: dispatchDate || undefined,
        linked_ref: linkedRef || undefined,
        dispatch_method: dispatchMethod || undefined,
        tracking_no: trackingNo || undefined,
        items: items.map(i=>({ stock_item: i.product, qty: parseFloat(i.qty)||0, unit: i.unit, warehouse: i.warehouse||undefined })),
        narration: narration || undefined,
      });
      Toast.show({ type: 'success', text1: 'Delivery Note Created', text2: `${dnNo} sent to Tally.` });
      setTimeout(()=>router.back(),1000);
    } catch(err:any) {
      Toast.show({ type: 'error', text1: 'Failed', text2: err?.message||'Could not submit.' });
    } finally { setSubmitting(false); }
  },[isPaired,company?.guid,party,date,dispatchDate,linkedRef,dispatchMethod,trackingNo,items,narration,dnNo,router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Create Delivery Note</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{dnNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="car-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Delivery Details</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>DN No.</Text>
                <View style={s.autoBox}><Text style={s.autoTxt}>{dnNo}</Text><Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} /></View>
              </View>
              <DateInput label="Date" required value={date} onChange={setDate} title="Delivery Date" />
            </View>
            <SearchableDropdown label="Customer / Party" required placeholder="Search customer..." options={PARTIES} value={party} onSelect={o=>setParty(o.value)} />
            <SearchableDropdown label="Linked Invoice / Order" placeholder="Select reference..." options={INVOICES} value={linkedRef} onSelect={o=>setLinkedRef(o.value)} icon="document-outline" />
            <View style={s.row2}>
              <DateInput label="Dispatch Date" value={dispatchDate} onChange={setDispatchDate} title="Dispatch Date" />
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Tracking No.</Text>
                <TextInput style={s.fInput} value={trackingNo} onChangeText={setTrackingNo} placeholder="Optional" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <SearchableDropdown label="Dispatch Method" options={DISPATCH_METHODS} value={dispatchMethod} onSelect={o=>setDispatchMethod(o.value)} placeholder="Select dispatch method..." icon="car-outline" containerStyle={{marginBottom:SPACING.sm}} />
            {/* Vehicle Information Toggle */}
            <View style={s.switchRow}>
              <View style={s.switchLabelWrap}>
                <Ionicons name="car-sport-outline" size={16} color={COLORS.textSecondary} />
                <Text style={s.switchLabel}>Vehicle Information</Text>
              </View>
              <BrandSwitch value={showVehicleInfo} onValueChange={setShowVehicleInfo} />
            </View>
            {showVehicleInfo && (
              <View style={s.vehicleBox}>
                <View style={s.row2}>
                  <View style={{flex:1}}>
                    <Text style={s.fLabel}>Driver Name</Text>
                    <TextInput style={s.fInput} value={driverName} onChangeText={setDriverName} placeholder="Full name" placeholderTextColor={COLORS.textTertiary} />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={s.fLabel}>Phone Number</Text>
                    <TextInput style={s.fInput} value={driverPhone} onChangeText={setDriverPhone} placeholder="+91 XXXXX" keyboardType="phone-pad" placeholderTextColor={COLORS.textTertiary} />
                  </View>
                </View>
                <View style={{marginBottom:SPACING.sm}}>
                  <Text style={s.fLabel}>Vehicle Number</Text>
                  <TextInput style={s.fInput} value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="e.g. MH12AB1234" placeholderTextColor={COLORS.textTertiary} autoCapitalize="characters" />
                </View>
                <FormField label="Narration / Notes" value={vehicleNarration} onChangeText={setVehicleNarration} placeholder="Additional vehicle info..." containerStyle={{marginBottom:0}} />
              </View>
            )}
          </View>

          <View style={s.secHdr}>
            <Ionicons name="cube-outline" size={16} color={COLORS.textPrimary} />
            <Text style={s.secTitle}>Items to Deliver</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item=>(
            <DeliveryItemRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={()=>setItems(p=>[...p,newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add Item</Text>
          </TouchableOpacity>

          <View style={s.card}>
            <FormField label="Narration / Instructions" value={narration} onChangeText={setNarration} placeholder="Delivery instructions..." multiline numberOfLines={2}
              style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={[s.submitBtn,submitting&&{opacity:0.6}]} onPress={handleSubmit} activeOpacity={0.7} disabled={submitting}>
            {submitting?<ActivityIndicator size="small" color={COLORS.white}/>:<Ionicons name="checkmark-circle" size={18} color={COLORS.white}/>}
            <Text style={s.submitTxt}>{submitting?'Submitting...':'Issue Delivery Note'}</Text>
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
      <Modal visible={activeModal?.type==='unit'} transparent animationType="fade" onRequestClose={()=>setActiveModal(null)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={()=>setActiveModal(null)}>
          <View style={m.center}>{UNITS.map(u=>(
            <TouchableOpacity key={u} style={m.unitOpt} onPress={()=>{if(activeModal)updateItem(activeModal.itemId,'unit',u);setActiveModal(null);}} activeOpacity={0.7}>
              <Text style={m.unitTxt}>{u}</Text>
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
  badge:{backgroundColor:COLORS.infoBg,paddingHorizontal:8,paddingVertical:4,borderRadius:RADIUS.full},
  badgeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.info},
  scroll:{padding:SPACING.md,paddingBottom:8},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row2:{flexDirection:'row',gap:12,marginBottom:SPACING.md},
  fLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:6},
  star:{color:COLORS.negative},
  dateBox:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,minHeight:48},
  dateTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'500',flex:1},
  datePlh:{color:COLORS.textTertiary},
  fInput:{backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,minHeight:48},
  autoBox:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:12,minHeight:48},
  autoTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'600'},
  star:{color:COLORS.negative},
  switchRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12,borderTopWidth:1,borderTopColor:COLORS.borderDefault,marginTop:4},
  switchLabelWrap:{flexDirection:'row',alignItems:'center',gap:8},
  switchLabel:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textPrimary},
  vehicleBox:{backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,padding:SPACING.md,marginTop:8,borderWidth:1,borderColor:COLORS.borderDefault},
  secHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  secTitle:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  countBadge:{backgroundColor:COLORS.brandPrimary,width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center'},
  countTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:'#fff'},
  addBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:COLORS.positiveBg,borderRadius:RADIUS.md,paddingVertical:14,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.positive+'40',borderStyle:'dashed'},
  addTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.positive},
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
  row:{flexDirection:'row',gap:8,marginBottom:4,alignItems:'flex-end'},
  qBox:{width:110},rBox:{flex:1},
  ml:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:4},
  mi:{backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',minHeight:38},
  unitBtn:{flexDirection:'row',alignItems:'center',gap:3,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,borderWidth:1,borderColor:COLORS.borderDefault,alignSelf:'flex-end',minHeight:38},
  unitTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.textPrimary},
});
