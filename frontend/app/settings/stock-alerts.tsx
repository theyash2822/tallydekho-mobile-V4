import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const CATEGORY_OPTS: DropdownOption[] = [
  {label:'Group-wise', value:'group'}, {label:'Item-wise', value:'item'},
];
const EXPIRY_OPTS: DropdownOption[] = [
  {label:'7 Days', value:'7'}, {label:'15 Days', value:'15'},
  {label:'30 Days', value:'30'}, {label:'60 Days', value:'60'},
];
const FREQ_OPTS: DropdownOption[] = [
  {label:'Immediate', value:'immediate'}, {label:'Daily Digest', value:'daily'}, {label:'Weekly Summary', value:'weekly'},
];

export default function StockAlertsScreen() {
  const router = useRouter();
  const [category, setCategory] = useState('group');
  const [reorderPoint, setReorderPoint] = useState(5);
  const [includeNeg, setIncludeNeg] = useState(false);
  const [expiryDays, setExpiryDays] = useState('30');
  const [trackedOnly, setTrackedOnly] = useState(true);
  const [groupByWh, setGroupByWh] = useState(false);
  const [channels, setChannels] = useState({push:true, email:false, whatsapp:true, sms:false});
  const [freq, setFreq] = useState('daily');

  const save = () => Alert.alert('Saved!', 'Stock alert settings updated.', [{text:'OK', onPress:()=>router.back()}]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Low Stock & Expiry Alerts</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="alert-circle-outline" size={18} color={COLORS.negative} /><Text style={s.cardTitle}>Low Stock</Text></View>
          <FormDropdown label="Alert Category" value={category} options={CATEGORY_OPTS} onSelect={o=>setCategory(o.value)} placeholder="Select" />
          <Text style={s.fieldLabel}>Reorder Point (Units)</Text>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepBtn} onPress={()=>setReorderPoint(p=>Math.max(1,p-1))}><Ionicons name="remove" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
            <Text style={s.stepVal}>{reorderPoint}</Text>
            <TouchableOpacity style={s.stepBtn} onPress={()=>setReorderPoint(p=>p+1)}><Ionicons name="add" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
          </View>
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Include Negative Stock</Text>
            <Switch value={includeNeg} onValueChange={setIncludeNeg} trackColor={{false:COLORS.borderDefault,true:COLORS.positive}} thumbColor={COLORS.white} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="time-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>Expiry Alerts</Text></View>
          <FormDropdown label="Alert Before" value={expiryDays} options={EXPIRY_OPTS} onSelect={o=>setExpiryDays(o.value)} placeholder="Days" />
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Only Tracked Batches</Text>
            <Switch value={trackedOnly} onValueChange={setTrackedOnly} trackColor={{false:COLORS.borderDefault,true:COLORS.positive}} thumbColor={COLORS.white} />
          </View>
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Group by Warehouse</Text>
            <Switch value={groupByWh} onValueChange={setGroupByWh} trackColor={{false:COLORS.borderDefault,true:COLORS.positive}} thumbColor={COLORS.white} />
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="send-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Delivery</Text></View>
          <Text style={s.fieldLabel}>Channels</Text>
          <View style={s.chipsRow}>
            {Object.entries(channels).map(([k,v])=>(
              <TouchableOpacity key={k} style={[s.chip, v && s.chipActive]} onPress={()=>setChannels(prev=>({...prev,[k]:!v}))} activeOpacity={0.7}>
                <Text style={[s.chipTxt, v && s.chipTxtActive]}>{k.charAt(0).toUpperCase()+k.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FormDropdown label="Frequency" value={freq} options={FREQ_OPTS} onSelect={o=>setFreq(o.value)} placeholder="Frequency" containerStyle={{marginTop:SPACING.md,marginBottom:0}} />
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Settings</Text>
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
  fieldLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:SPACING.sm},
  stepper:{flexDirection:'row',alignItems:'center',gap:20,backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,padding:12,borderWidth:1,borderColor:COLORS.borderDefault},
  stepBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.cardBg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:COLORS.borderDefault},
  stepVal:{fontSize:TYPOGRAPHY.lg,fontWeight:'700',color:COLORS.textPrimary,minWidth:30,textAlign:'center'},
  switchRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12,borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  switchLabel:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'500'},
  chipsRow:{flexDirection:'row',flexWrap:'wrap',gap:8},
  chip:{paddingHorizontal:14,paddingVertical:8,borderRadius:RADIUS.full,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  chipActive:{backgroundColor:COLORS.brandPrimary,borderColor:COLORS.brandPrimary},
  chipTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'500'},
  chipTxtActive:{color:COLORS.white,fontWeight:'700'},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
