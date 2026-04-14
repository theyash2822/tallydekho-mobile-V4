import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

interface GSTConfig { gstr1: boolean; gstr3b: boolean; autoPause: boolean; email:boolean; push:boolean; whatsapp:boolean; }
interface EWBConfig { expiryAlert: boolean; push:boolean; email:boolean; }
interface EINVConfig { irnDigest: boolean; push:boolean; email:boolean; }
interface OtherConfig { tdsPayment: boolean; vatReturn: boolean; push:boolean; email:boolean; }

export default function ComplianceRemindersScreen() {
  const router = useRouter();
  const [gst, setGst] = useState<GSTConfig>({gstr1:true,gstr3b:true,autoPause:false,email:true,push:true,whatsapp:false});
  const [ewb, setEwb] = useState<EWBConfig>({expiryAlert:true,push:true,email:false});
  const [einv, setEinv] = useState<EINVConfig>({irnDigest:true,push:true,email:false});
  const [other, setOther] = useState<OtherConfig>({tdsPayment:true,vatReturn:false,push:true,email:true});

  const save = () => Alert.alert('Saved!', 'Compliance reminder settings updated.', [{text:'OK', onPress:()=>router.back()}]);

  const Section = ({title, icon, color, items}: {title:string; icon:string; color:string; items: {label:string; val:boolean; set:(v:boolean)=>void}[]}) => (
    <View style={s.card}>
      <View style={s.cardHdr}><Ionicons name={icon as any} size={18} color={color} /><Text style={s.cardTitle}>{title}</Text></View>
      {items.map((item, idx)=>(
        <View key={item.label} style={[s.row, idx>0 && s.rowBorder]}>
          <Text style={s.rowLabel}>{item.label}</Text>
          <Switch value={item.val} onValueChange={item.set} trackColor={{false:COLORS.borderDefault,true:COLORS.positive}} thumbColor={COLORS.white} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Compliance Reminders</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Section title="GST" icon="receipt-outline" color={COLORS.positive} items={[
          {label:'GSTR-1 Filing Reminder', val:gst.gstr1, set:v=>setGst(p=>({...p,gstr1:v}))},
          {label:'GSTR-3B Filing Reminder', val:gst.gstr3b, set:v=>setGst(p=>({...p,gstr3b:v}))},
          {label:'Auto-Pause during filing period', val:gst.autoPause, set:v=>setGst(p=>({...p,autoPause:v}))},
          {label:'Email Notifications', val:gst.email, set:v=>setGst(p=>({...p,email:v}))},
          {label:'Push Notifications', val:gst.push, set:v=>setGst(p=>({...p,push:v}))},
          {label:'WhatsApp Notifications', val:gst.whatsapp, set:v=>setGst(p=>({...p,whatsapp:v}))},
        ]} />
        <Section title="E-Way Bill" icon="document-outline" color={COLORS.warning} items={[
          {label:'Expiry Reminder (24h before)', val:ewb.expiryAlert, set:v=>setEwb(p=>({...p,expiryAlert:v}))},
          {label:'Push Notifications', val:ewb.push, set:v=>setEwb(p=>({...p,push:v}))},
          {label:'Email Notifications', val:ewb.email, set:v=>setEwb(p=>({...p,email:v}))},
        ]} />
        <Section title="E-Invoice" icon="barcode-outline" color={COLORS.info} items={[
          {label:'IRN Error Digest', val:einv.irnDigest, set:v=>setEinv(p=>({...p,irnDigest:v}))},
          {label:'Push Notifications', val:einv.push, set:v=>setEinv(p=>({...p,push:v}))},
          {label:'Email Notifications', val:einv.email, set:v=>setEinv(p=>({...p,email:v}))},
        ]} />
        <Section title="Other Taxes" icon="card-outline" color={'#7C3AED'} items={[
          {label:'TDS Payment Reminder', val:other.tdsPayment, set:v=>setOther(p=>({...p,tdsPayment:v}))},
          {label:'VAT Return Reminder', val:other.vatReturn, set:v=>setOther(p=>({...p,vatReturn:v}))},
          {label:'Push Notifications', val:other.push, set:v=>setOther(p=>({...p,push:v}))},
          {label:'Email Notifications', val:other.email, set:v=>setOther(p=>({...p,email:v}))},
        ]} />
        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}><Text style={s.saveTxt}>Save Settings</Text></TouchableOpacity>
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
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:13},
  rowBorder:{borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  rowLabel:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'500',flex:1,marginRight:12},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
