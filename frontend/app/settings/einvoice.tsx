import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const PROVIDERS: DropdownOption[] = [
  {label:'NIC (Government)', value:'nic'},
  {label:'Cygnet', value:'cygnet'},
  {label:'Clear (formerly ClearTax)', value:'clear'},
  {label:'EY Tax Tech', value:'ey'},
  {label:'IRIS Business', value:'iris'},
  {label:'Masterindia', value:'masterindia'},
];

export default function EInvoiceScreen() {
  const router = useRouter();
  const [provider, setProvider] = useState('nic');
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = () => setIsDirty(true);
  const [gstin, setGstin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const pendingIRN = 3;

  const save = () => Alert.alert('Saved!', 'E-Invoice credentials saved.', [{text:'OK'}]);
  const test = () => Alert.alert('Connection Test', 'Successfully connected to IRP portal');
  const bulkGenerate = () => Alert.alert('Bulk Generate', `Generating IRN for ${pendingIRN} pending invoices...`);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>E-Invoice (IRN)</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {pendingIRN > 0 && (
          <View style={s.pendingBanner}>
            <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
            <Text style={s.pendingTxt}><Text style={{fontWeight:'800'}}>{pendingIRN} invoices</Text> pending IRN generation</Text>
            <TouchableOpacity style={s.genBtn} onPress={bulkGenerate} activeOpacity={0.7}>
              <Text style={s.genTxt}>Generate All</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="server-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>IRP Provider</Text></View>
          <FormDropdown label="Provider" value={provider} options={PROVIDERS} onSelect={o=>setProvider(o.value)} placeholder="Select IRP" containerStyle={{marginBottom:0}} />
        </View>
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="key-outline" size={18} color={'#7C3AED'} /><Text style={s.cardTitle}>Credentials</Text></View>
          {[{l:'GSTIN', v:gstin, set:(v:string)=>setGstin(v.toUpperCase()), ph:'15-digit GSTIN', sec:false},
            {l:'Username', v:username, set:setUsername, ph:'Portal username', sec:false},
            {l:'Password', v:password, set:setPassword, ph:'Portal password', sec:true},
            {l:'Client ID', v:clientId, set:setClientId, ph:'API Client ID', sec:false},
            {l:'Client Secret', v:secret, set:setSecret, ph:'API Client Secret', sec:false},
          ].map(f=>(
            <View key={f.l} style={s.field}>
              <Text style={s.fLabel}>{f.l}</Text>
              <View style={s.fRow}>
                <TextInput style={s.fInput} value={f.v} onChangeText={f.set} placeholder={f.ph} secureTextEntry={f.sec && !showPass}
                  placeholderTextColor={COLORS.textTertiary} autoCapitalize="none" />
                {f.sec && <TouchableOpacity onPress={()=>setShowPass(p=>!p)} style={s.eyeBtn}>
                  <Ionicons name={showPass?'eye-off-outline':'eye-outline'} size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>}
              </View>
            </View>
          ))}
        </View>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.outBtn} onPress={test} activeOpacity={0.7}>
            <Ionicons name="wifi-outline" size={16} color={COLORS.info} />
            <Text style={[s.outTxt, {color:COLORS.info}]}>Test Connection</Text>
          </TouchableOpacity>
          {isDirty && <TouchableOpacity style={s.primaryBtn} onPress={() => { save(); setIsDirty(false); }} activeOpacity={0.8}>
            <Text style={s.primaryTxt}>Save Credentials</Text>
          </TouchableOpacity>}
        </View>
        <TouchableOpacity style={s.portalBtn} onPress={()=>Linking.openURL('https://einvoice1.gst.gov.in')} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
          <Text style={s.portalTxt}>Open IRP Portal</Text>
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
  pendingBanner:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:COLORS.warningBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.warning+'40'},
  pendingTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.warning},
  genBtn:{backgroundColor:COLORS.warning,paddingHorizontal:12,paddingVertical:7,borderRadius:RADIUS.md},
  genTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'700',color:COLORS.white},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  field:{marginBottom:SPACING.md},
  fLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:6},
  fRow:{flexDirection:'row',alignItems:'center',backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,borderWidth:1,borderColor:COLORS.borderDefault},
  fInput:{flex:1,paddingHorizontal:14,paddingVertical:11,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary},
  eyeBtn:{paddingHorizontal:12,paddingVertical:12},
  btnRow:{flexDirection:'row',gap:12,marginBottom:SPACING.sm},
  outBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.info},
  outTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700'},
  primaryBtn:{flex:1,paddingVertical:13,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  primaryTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.white},
  portalBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:RADIUS.md,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  portalTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary},
});
