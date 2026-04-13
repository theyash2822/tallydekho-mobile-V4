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

const WH_TYPES: DropdownOption[] = [
  { label: 'Main Warehouse', value: 'main' },
  { label: 'Secondary / Sub-Warehouse', value: 'secondary' },
  { label: 'Transit Hub', value: 'transit' },
  { label: 'Cold Storage', value: 'cold' },
  { label: 'Distribution Center', value: 'distribution' },
];

export default function CreateWarehouseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [entryType, setEntryType] = useState<EntryType>('regular');

  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [managerName, setManagerName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [capacity, setCapacity] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Error', 'Warehouse name is required.'); return; }
    Alert.alert('✓ Warehouse Added', `"${name}" has been created.`,[{text:'OK',onPress:()=>router.back()}]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={()=>router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Add Warehouse</Text>
        <RegularOptionalToggle value={entryType} onChange={setEntryType} />
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="business-outline" size={18} color={COLORS.brandPrimary} /><Text style={s.cardTitle}>Warehouse Info</Text></View>
            <FormField label="Warehouse Name" value={name} onChangeText={setName} placeholder="e.g. Main Warehouse - Mumbai" required />
            <FormDropdown label="Warehouse Type" value={type} options={WH_TYPES} onSelect={o=>setType(o.value)} placeholder="Select type..." required />
            <View style={s.row2}>
              <View style={{flex:2}}>
                <FormField label="Address" value={address} onChangeText={setAddress} placeholder="Street address" multiline numberOfLines={2}
                  style={{minHeight:56,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
              </View>
            </View>
            <View style={[s.row2,{marginTop:SPACING.md}]}>
              <View style={{flex:1}}><FormField label="City" value={city} onChangeText={setCity} placeholder="City" containerStyle={{marginBottom:0}} /></View>
              <View style={{flex:1}}><FormField label="Pincode" value={pincode} onChangeText={setPincode} placeholder="6 digits" keyboardType="numeric" containerStyle={{marginBottom:0}} /></View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="person-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Contact Person</Text></View>
            <FormField label="Manager / In-charge Name" value={managerName} onChangeText={setManagerName} placeholder="Full name" />
            <View style={s.row2}>
              <View style={{flex:1}}><FormField label="Mobile" value={contact} onChangeText={setContact} placeholder="10-digit" keyboardType="phone-pad" containerStyle={{marginBottom:0}} /></View>
              <View style={{flex:1}}><FormField label="Email" value={email} onChangeText={setEmail} placeholder="Optional" keyboardType="email-address" containerStyle={{marginBottom:0}} /></View>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="stats-chart-outline" size={18} color={COLORS.positive} /><Text style={s.cardTitle}>Capacity & Notes</Text></View>
            <FormField label="Storage Capacity (Sq. ft. or Units)" value={capacity} onChangeText={setCapacity} placeholder="Optional" keyboardType="numeric" />
            <FormField label="Description / Notes" value={description} onChangeText={setDescription} placeholder="Any additional details..." multiline numberOfLines={2}
              style={{minHeight:60,textAlignVertical:'top'} as any} containerStyle={{marginBottom:0}} />
          </View>
        </ScrollView>

        <View style={[s.footer,{paddingBottom:Math.max(insets.bottom,12)}]}>
          <TouchableOpacity style={s.submitBtn} onPress={handleSave} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={s.submitTxt}>Create Warehouse</Text>
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
