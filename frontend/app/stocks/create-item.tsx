import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormField from '../../src/components/forms/FormField';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import RegularOptionalToggle, { EntryType } from '../../src/components/forms/RegularOptionalToggle';

const CATEGORIES: DropdownOption[] = [
  { label: 'Electronics', value: 'electronics' },
  { label: 'Accessories', value: 'accessories' },
  { label: 'Raw Materials', value: 'raw_materials' },
  { label: 'Finished Goods', value: 'finished_goods' },
  { label: 'Services', value: 'services' },
  { label: 'Consumables', value: 'consumables' },
  { label: 'Spare Parts', value: 'spare_parts' },
  { label: 'Packaging', value: 'packaging' },
];
const UNITS: DropdownOption[] = [
  { label: 'Pcs (Pieces)', value: 'pcs' },
  { label: 'Kg (Kilogram)', value: 'kg' },
  { label: 'Ltr (Litre)', value: 'ltr' },
  { label: 'Mtr (Meter)', value: 'mtr' },
  { label: 'Box', value: 'box' },
  { label: 'Nos (Numbers)', value: 'nos' },
  { label: 'Bag', value: 'bag' },
  { label: 'Roll', value: 'roll' },
];
const GST_RATES: DropdownOption[] = [
  { label: '0% - Exempt', value: '0' },
  { label: '5% GST', value: '5' },
  { label: '12% GST', value: '12' },
  { label: '18% GST', value: '18' },
  { label: '28% GST', value: '28' },
];
const WAREHOUSES: DropdownOption[] = [
  { label: 'Main Warehouse - Mumbai', value: 'main_mumbai' },
  { label: 'Warehouse B - Delhi', value: 'wh_delhi' },
  { label: 'Warehouse C - Pune', value: 'wh_pune' },
];

export default function CreateStockItemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entryType, setEntryType] = useState<EntryType>('regular');

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [hsnSac, setHsnSac] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [openingStock, setOpeningStock] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [sellingRate, setSellingRate] = useState('');
  const [mrp, setMrp] = useState('');
  const [minStock, setMinStock] = useState('');
  const [reorderQty, setReorderQty] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Error', 'Item name is required.'); return; }
    Alert.alert('✓ Item Added', `"${name}" has been added to inventory.`,[{text:'OK',onPress:()=>router.back()}]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add New Item</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="cube-outline" size={18} color={COLORS.brandPrimary} /><Text style={s.cardTitle}>Basic Info</Text></View>
            <FormField label="Item Name" value={name} onChangeText={setName} placeholder="e.g. JBL Portable Speaker" required />
            <View style={s.row2}>
              <View style={{flex:1}}>
                <FormField label="Item Code / SKU" value={sku} onChangeText={setSku} placeholder="Auto or custom" containerStyle={{marginBottom:0}} />
              </View>
              <View style={{flex:1}}>
                <FormDropdown label="Category" value={category} options={CATEGORIES} onSelect={o=>setCategory(o.value)} placeholder="Select..." containerStyle={{marginBottom:0}} />
              </View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="receipt-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Tax & Compliance</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}>
                <FormField label="HSN / SAC Code" value={hsnSac} onChangeText={setHsnSac} placeholder="8 digit code" containerStyle={{marginBottom:0}} />
              </View>
              <View style={{flex:1}}>
                <FormDropdown label="GST Rate" value={gstRate} options={GST_RATES} onSelect={o=>setGstRate(o.value)} placeholder="Select %" containerStyle={{marginBottom:0}} />
              </View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="pricetag-outline" size={18} color={COLORS.positive} /><Text style={s.cardTitle}>Pricing</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}><FormField label="Purchase Rate (₹)" value={purchaseRate} onChangeText={setPurchaseRate} keyboardType="numeric" placeholder="0.00" containerStyle={{marginBottom:0}} /></View>
              <View style={{flex:1}}><FormField label="Selling Rate (₹)" value={sellingRate} onChangeText={setSellingRate} keyboardType="numeric" placeholder="0.00" containerStyle={{marginBottom:0}} /></View>
            </View>
            <View style={[s.row2,{marginTop:SPACING.md}]}>
              <View style={{flex:1}}><FormField label="MRP (₹)" value={mrp} onChangeText={setMrp} keyboardType="numeric" placeholder="0.00" containerStyle={{marginBottom:0}} /></View>
              <View style={{flex:1}}><FormDropdown label="Unit of Measure" value={unit} options={UNITS} onSelect={o=>setUnit(o.value)} placeholder="Select unit" containerStyle={{marginBottom:0}} /></View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="layers-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>Stock Info</Text></View>
            <View style={s.row2}>
              <View style={{flex:1}}><FormField label="Opening Stock" value={openingStock} onChangeText={setOpeningStock} keyboardType="numeric" placeholder="0" containerStyle={{marginBottom:0}} /></View>
              <View style={{flex:1}}><FormDropdown label="Primary Warehouse" value={warehouse} options={WAREHOUSES} onSelect={o=>setWarehouse(o.value)} placeholder="Select..." containerStyle={{marginBottom:0}} /></View>
            </View>
            <View style={[s.row2,{marginTop:SPACING.md}]}>
              <View style={{flex:1}}><FormField label="Min. Stock Level" value={minStock} onChangeText={setMinStock} keyboardType="numeric" placeholder="0 (alert threshold)" containerStyle={{marginBottom:0}} /></View>
              <View style={{flex:1}}><FormField label="Reorder Qty" value={reorderQty} onChangeText={setReorderQty} keyboardType="numeric" placeholder="0" containerStyle={{marginBottom:0}} /></View>
            </View>
          </View>

          <View style={s.card}>
            <FormField label="Description" value={description} onChangeText={setDescription} placeholder="Optional product description..." multiline numberOfLines={3}
              style={{minHeight:72,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={s.submitBtn} onPress={handleSave} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Save Item</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  header:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  scroll:{padding:SPACING.md,paddingBottom:8},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row2:{flexDirection:'row',gap:12},
  footer:{paddingHorizontal:SPACING.md,paddingTop:SPACING.md,borderTopWidth:1,borderTopColor:COLORS.borderDefault,backgroundColor:COLORS.cardBg},
  submitBtn:{flexDirection:'row',gap:8,paddingVertical:14,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  submitTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
