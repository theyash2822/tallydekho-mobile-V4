import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const CURRENCIES: DropdownOption[] = [
  {label:'INR - Indian Rupee (₹)', value:'INR'},
  {label:'USD - US Dollar ($)', value:'USD'},
  {label:'EUR - Euro (€)', value:'EUR'},
  {label:'GBP - British Pound (£)', value:'GBP'},
  {label:'AED - UAE Dirham (د.إ)', value:'AED'},
];
const DATE_STYLES: DropdownOption[] = [
  {label:'DD/MM/YYYY', value:'dmy'},
  {label:'MM/DD/YYYY', value:'mdy'},
  {label:'YYYY-MM-DD', value:'ymd'},
];
const TIME_STYLES: DropdownOption[] = [
  {label:'12-hour (3:30 PM)', value:'12h'},
  {label:'24-hour (15:30)', value:'24h'},
];
const THOUSANDS: DropdownOption[] = [
  {label:'12,34,567.89 (Indian)', value:'in'},
  {label:'1,234,567.89 (International)', value:'int'},
  {label:'1.234.567,89 (European)', value:'eu'},
];
const NEGATIVE_STYLES: DropdownOption[] = [
  {label:'-1234 (Minus sign)', value:'minus'},
  {label:'(1234) (Parentheses)', value:'paren'},
  {label:'1234- (Trailing minus)', value:'trail'},
];

export default function CurrencyScreen() {
  const router = useRouter();
  const [currency, setCurrency] = useState('INR');
  const [dateStyle, setDateStyle] = useState('dmy');
  const [timeStyle, setTimeStyle] = useState('12h');
  const [thousands, setThousands] = useState('in');
  const [negStyle, setNegStyle] = useState('minus');
  const [decimals, setDecimals] = useState(2);

  const save = () => Alert.alert('Saved!', 'Currency & format settings updated.', [{text:'OK', onPress:()=>router.back()}]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Currency & Number Format</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="cash-outline" size={18} color={COLORS.positive} /><Text style={s.cardTitle}>Currency</Text></View>
          <FormDropdown label="Currency" value={currency} options={CURRENCIES} onSelect={o=>setCurrency(o.value)} placeholder="Select currency" containerStyle={{marginBottom:0}} />
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="calendar-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Date & Time Format</Text></View>
          <FormDropdown label="Date Style" value={dateStyle} options={DATE_STYLES} onSelect={o=>setDateStyle(o.value)} placeholder="Date format" />
          <FormDropdown label="Time Style" value={timeStyle} options={TIME_STYLES} onSelect={o=>setTimeStyle(o.value)} placeholder="Time format" containerStyle={{marginBottom:0}} />
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="calculator-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>Number Formatting</Text></View>
          <FormDropdown label="Thousands Separator" value={thousands} options={THOUSANDS} onSelect={o=>setThousands(o.value)} placeholder="Number format" />
          <FormDropdown label="Negative Numbers" value={negStyle} options={NEGATIVE_STYLES} onSelect={o=>setNegStyle(o.value)} placeholder="Negative style" />
          <Text style={s.fieldLabel}>Decimal Places</Text>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={()=>setDecimals(d=>Math.max(0,d-1))}><Ionicons name="remove" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
            <Text style={s.stepVal}>{decimals}</Text>
            <TouchableOpacity style={s.stepBtn} onPress={()=>setDecimals(d=>Math.min(4,d+1))}><Ionicons name="add" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
          </View>
          <View style={s.preview}>
            <Text style={s.previewLabel}>Preview</Text>
            <Text style={s.previewVal}>₹ 12,34,567.{Array(decimals).fill('0').join('')||'00'}</Text>
          </View>
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  hdr:{flexDirection:'row',alignItems:'center',backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.sm,paddingVertical:10,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  back:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  title:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary,textAlign:'center'},
  scroll:{padding:SPACING.md,paddingBottom:32},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  fieldLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginTop:SPACING.md,marginBottom:SPACING.sm},
  stepper:{flexDirection:'row',alignItems:'center',gap:20,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,padding:12,borderWidth:1,borderColor:COLORS.borderDefault},
  stepBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.cardBg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:COLORS.borderDefault},
  stepVal:{fontSize:TYPOGRAPHY.lg,fontWeight:'700',color:COLORS.textPrimary,minWidth:30,textAlign:'center'},
  preview:{backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,padding:14,marginTop:SPACING.md,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  previewLabel:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  previewVal:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.positive},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
