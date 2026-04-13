import React, { useState, useCallback } from 'react';
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

const WAREHOUSES: DropdownOption[] = [
  { label: 'Main Warehouse - Mumbai', value: 'main_mumbai' },
  { label: 'Warehouse B - Delhi', value: 'wh_delhi' },
  { label: 'Warehouse C - Pune', value: 'wh_pune' },
  { label: 'Transit Hub - Chennai', value: 'transit_chennai' },
];
const PRODUCTS: DropdownOption[] = [
  { label: 'JBL Portable Speaker', value: 'jbl_speaker' },
  { label: 'Samsung Galaxy J1 Bluetooth', value: 'samsung_j1' },
  { label: 'Lycan Wireless Headphone', value: 'lycan_hp' },
  { label: 'Sony WH-1000XM5', value: 'sony_xm5' },
  { label: 'JBL Wired Speaker', value: 'jbl_wired' },
];
const UNITS = ['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Nos'];
const ADJ_REASONS: DropdownOption[] = [
  { label: 'Physical Count Correction', value: 'physical' },
  { label: 'Damaged / Spoiled Goods', value: 'damaged' },
  { label: 'Expired Goods', value: 'expired' },
  { label: 'Theft / Loss', value: 'theft' },
  { label: 'Production Consumption', value: 'production' },
  { label: 'Sample / Display', value: 'sample' },
  { label: 'Opening Stock Entry', value: 'opening' },
  { label: 'Other', value: 'other' },
];

interface AdjItem { id: string; product: string; qty: string; unit: string; rate: string; reason: string; }
const newItem = (): AdjItem => ({ id: Date.now().toString(), product: '', qty: '1', unit: 'Pcs', rate: '', reason: 'physical' });
const todayStr = () => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; };

type ModalState = { type: 'product'|'unit'; itemId: string }|null;

function AdjItemRow({ item, onUpdate, onRemove, onModal, adjType }: {
  item: AdjItem; adjType: 'increase'|'decrease';
  onUpdate:(id:string,f:keyof AdjItem,v:string)=>void;
  onRemove:(id:string)=>void; onModal:(s:ModalState)=>void;
}) {
  const pname = PRODUCTS.find(p=>p.value===item.product)?.label;
  const color = adjType==='increase' ? COLORS.positive : COLORS.negative;
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
        <View style={[ir.qtyBadge,{borderColor:color+'40',backgroundColor:color+'12'}]}>
          <Ionicons name={adjType==='increase'?'add':'remove'} size={14} color={color} />
          <TextInput style={[ir.qtyInput,{color}]} value={item.qty} onChangeText={v=>onUpdate(item.id,'qty',v)}
            keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.textTertiary} />
          <TouchableOpacity style={ir.unitBtn} onPress={()=>onModal({type:'unit',itemId:item.id})} activeOpacity={0.7}>
            <Text style={ir.unitTxt}>{item.unit}</Text><Ionicons name="chevron-down" size={9} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={ir.rBox}><Text style={ir.ml}>Value Rate (₹)</Text>
          <TextInput style={ir.mi} value={item.rate} onChangeText={v=>onUpdate(item.id,'rate',v)}
            keyboardType="numeric" placeholder="0.00" placeholderTextColor={COLORS.textTertiary} />
        </View>
      </View>
    </View>
  );
}

export default function CreateStockAdjustmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entryType, setEntryType] = useState<EntryType>('regular');
  const [adjNo] = useState('ADJ-0024');
  const [date, setDate] = useState(todayStr());
  const [warehouse, setWarehouse] = useState('');
  const [adjType, setAdjType] = useState<'increase'|'decrease'>('increase');
  const [reason, setReason] = useState('physical');
  const [items, setItems] = useState<AdjItem[]>([newItem()]);
  const [narration, setNarration] = useState('');
  const [activeModal, setActiveModal] = useState<ModalState>(null);

  const updateItem = useCallback((id:string,f:keyof AdjItem,v:string)=>setItems(prev=>prev.map(i=>i.id===id?{...i,[f]:v}:i)),[]);
  const removeItem = useCallback((id:string)=>setItems(prev=>prev.length>1?prev.filter(i=>i.id!==id):prev),[]);

  const handleSubmit = useCallback(()=>{
    Alert.alert('✓ Adjustment Saved', `Stock Adjustment ${adjNo} recorded.`,[{text:'OK',onPress:()=>router.back()}]);
  },[adjNo,router]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Adjustment</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
        <View style={s.badge}><Text style={s.badgeTxt}>{adjNo}</Text></View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="layers-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>Adjustment Details</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Adj. No.</Text>
                <View style={s.autoBox}><Text style={s.autoTxt}>{adjNo}</Text><Ionicons name="lock-closed-outline" size={13} color={COLORS.textTertiary} /></View>
              </View>
              <View style={{flex:1}}>
                <Text style={s.fLabel}>Date <Text style={s.star}>*</Text></Text>
                <TextInput style={s.fInput} value={date} onChangeText={setDate} placeholder="DD/MM/YY" placeholderTextColor={COLORS.textTertiary} />
              </View>
            </View>
            <FormDropdown label="Warehouse" value={warehouse} options={WAREHOUSES} onSelect={o=>setWarehouse(o.value)} placeholder="Select warehouse..." required />
            <Text style={s.fLabel}>Adjustment Type <Text style={s.star}>*</Text></Text>
            <View style={s.typeRow}>
              <TouchableOpacity style={[s.typeChip,adjType==='increase'&&s.typeChipInc]} onPress={()=>setAdjType('increase')} activeOpacity={0.7}>
                <Ionicons name="trending-up-outline" size={16} color={adjType==='increase'?COLORS.white:COLORS.positive} />
                <Text style={[s.typeChipTxt,adjType==='increase'&&{color:COLORS.white}]}>Increase (Inward)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.typeChip,adjType==='decrease'&&s.typeChipDec]} onPress={()=>setAdjType('decrease')} activeOpacity={0.7}>
                <Ionicons name="trending-down-outline" size={16} color={adjType==='decrease'?COLORS.white:COLORS.negative} />
                <Text style={[s.typeChipTxt,adjType==='decrease'&&{color:COLORS.white}]}>Decrease (Outward)</Text>
              </TouchableOpacity>
            </View>
            <FormDropdown label="Reason" value={reason} options={ADJ_REASONS} onSelect={o=>setReason(o.value)} placeholder="Select reason..." containerStyle={{marginBottom:0}} />
          </View>

          <View style={s.secHdr}>
            <View style={[s.adjBadge,{backgroundColor:adjType==='increase'?COLORS.positiveBg:COLORS.negativeBg}]}>
              <Ionicons name={adjType==='increase'?'add':'remove'} size={12} color={adjType==='increase'?COLORS.positive:COLORS.negative} />
            </View>
            <Text style={s.secTitle}>Items to Adjust</Text>
            <View style={s.countBadge}><Text style={s.countTxt}>{items.length}</Text></View>
          </View>
          {items.map(item=>(
            <AdjItemRow key={item.id} item={item} adjType={adjType} onUpdate={updateItem} onRemove={removeItem} onModal={setActiveModal} />
          ))}
          <TouchableOpacity style={s.addBtn} onPress={()=>setItems(p=>[...p,newItem()])} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.positive} />
            <Text style={s.addTxt}>Add Item</Text>
          </TouchableOpacity>

          <View style={s.card}>
            <FormField label="Narration" value={narration} onChangeText={setNarration} placeholder="Reason for adjustment..." multiline numberOfLines={2}
              style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} activeOpacity={0.7}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Save Adjustment</Text>
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
                <Ionicons name="cube-outline" size={14} color={COLORS.textSecondary} /><Text style={m.optTxt}>{p.label}</Text>
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
  badge:{backgroundColor:COLORS.warningBg,paddingHorizontal:8,paddingVertical:4,borderRadius:RADIUS.full},
  badgeTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.warning},
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
  typeRow:{flexDirection:'row',gap:8,marginBottom:SPACING.md},
  typeChip:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:12,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.borderDefault,backgroundColor:COLORS.cardBg},
  typeChipInc:{backgroundColor:COLORS.positive,borderColor:COLORS.positive},
  typeChipDec:{backgroundColor:COLORS.negative,borderColor:COLORS.negative},
  typeChipTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textSecondary},
  secHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  adjBadge:{width:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center'},
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
  qtyBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:8,borderRadius:RADIUS.md,borderWidth:1.5,minHeight:44},
  qtyInput:{fontSize:TYPOGRAPHY.md,fontWeight:'800',width:50,textAlign:'center'},
  unitBtn:{flexDirection:'row',alignItems:'center',gap:2},
  unitTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.textPrimary},
  rBox:{flex:1},
  ml:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:4},
  mi:{backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault,borderRadius:RADIUS.sm,paddingHorizontal:8,paddingVertical:9,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,textAlign:'center',minHeight:38},
});
