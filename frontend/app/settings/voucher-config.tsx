import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';

const BANK_OPTS: DropdownOption[] = [
  {label:'HDFC Bank - Current A/c', value:'hdfc'},
  {label:'SBI - Savings A/c', value:'sbi'},
  {label:'ICICI Bank - Current A/c', value:'icici'},
  {label:'Cash', value:'cash'},
];

interface VConfig {
  bank: string;
  dueDate: boolean;
  paymentMethods: boolean;
  acceptedForms: boolean;
  latePenalty: boolean;
}

const VOUCHER_TYPES = [
  { id:'sales_inv', label:'Sales Invoice', icon:'receipt-outline', color:COLORS.positive },
  { id:'purchase_inv', label:'Purchase Invoice', icon:'cart-outline', color:COLORS.info },
  { id:'sales_order', label:'Sales Order', icon:'bag-outline', color:COLORS.warning },
  { id:'purchase_order', label:'Purchase Order', icon:'cube-outline', color:'#7C3AED' },
  { id:'quotation', label:'Quotation', icon:'chatbubble-outline', color:'#0891B2' },
  { id:'credit_note', label:'Credit Note', icon:'arrow-undo-outline', color:COLORS.negative },
];

const defaultConfig = (): VConfig => ({ bank:'hdfc', dueDate:true, paymentMethods:true, acceptedForms:false, latePenalty:false });

export default function VoucherConfigScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string|null>('sales_inv');
  const [configs, setConfigs] = useState<Record<string, VConfig>>(
    Object.fromEntries(VOUCHER_TYPES.map(v=>[v.id, defaultConfig()]))
  );

  const update = (id: string, key: keyof VConfig, val: any) =>
    setConfigs(prev => ({...prev, [id]: {...prev[id], [key]: val}}));

  const save = () => Alert.alert('Saved!', 'Voucher configuration updated.', [{text:'OK', onPress:()=>router.back()}]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Voucher Configuration</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.subtitle}>Configure default settings for each voucher type</Text>
        {VOUCHER_TYPES.map(vt => {
          const cfg = configs[vt.id];
          const isOpen = expanded === vt.id;
          return (
            <View key={vt.id} style={s.section}>
              <TouchableOpacity style={s.sectionHdr} onPress={()=>setExpanded(isOpen?null:vt.id)} activeOpacity={0.7}>
                <View style={[s.typeIcon, {backgroundColor: vt.color+'18'}]}>
                  <Ionicons name={vt.icon as any} size={18} color={vt.color} />
                </View>
                <Text style={s.sectionTitle}>{vt.label}</Text>
                <Ionicons name={isOpen?'chevron-up':'chevron-down'} size={16} color={COLORS.textTertiary} />
              </TouchableOpacity>
              {isOpen && (
                <View style={s.sectionBody}>
                  <FormDropdown label="Default Bank Account" value={cfg.bank} options={BANK_OPTS}
                    onSelect={o=>update(vt.id,'bank',o.value)} placeholder="Select bank" />
                  <Text style={s.termTitle}>Terms & Conditions</Text>
                  {[
                    {key:'dueDate', label:'Due Date', icon:'calendar-outline'},
                    {key:'paymentMethods', label:'Payment Methods', icon:'card-outline'},
                    {key:'acceptedForms', label:'Accepted Payment Forms', icon:'checkmark-circle-outline'},
                    {key:'latePenalty', label:'Late Payment Penalties', icon:'warning-outline'},
                  ].map(item=>(
                    <View key={item.key} style={s.toggleRow}>
                      <View style={s.toggleLeft}>
                        <Ionicons name={item.icon as any} size={16} color={COLORS.textSecondary} />
                        <Text style={s.toggleLabel}>{item.label}</Text>
                      </View>
                      <Switch
                        value={cfg[item.key as keyof VConfig] as boolean}
                        onValueChange={v=>update(vt.id, item.key as keyof VConfig, v)}
                        trackColor={{false:COLORS.borderDefault, true:COLORS.positive}}
                        thumbColor={COLORS.white}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.8}>
          <Text style={s.saveTxt}>Save Configuration</Text>
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
  subtitle:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,marginBottom:SPACING.md,lineHeight:20},
  section:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,marginBottom:SPACING.sm,borderWidth:1,borderColor:COLORS.borderDefault,overflow:'hidden'},
  sectionHdr:{flexDirection:'row',alignItems:'center',gap:12,padding:SPACING.md},
  typeIcon:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},
  sectionTitle:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textPrimary},
  sectionBody:{borderTopWidth:1,borderTopColor:COLORS.borderDefault,padding:SPACING.md},
  termTitle:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textSecondary,marginTop:SPACING.md,marginBottom:SPACING.sm},
  toggleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12,borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  toggleLeft:{flexDirection:'row',alignItems:'center',gap:10},
  toggleLabel:{fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,fontWeight:'500'},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
