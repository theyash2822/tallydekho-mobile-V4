import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const BANKS = [
  { id:'b1', name:'HDFC Bank', account:'XXXX 4892', type:'Current A/c', status:'connected', lastSync:'15 Jun, 2:40 PM' },
  { id:'b2', name:'SBI', account:'XXXX 7301', type:'Savings A/c', status:'disconnected', lastSync:'Never' },
];

export default function BankFeedsScreen() {
  const router = useRouter();
  const [banks, setBanks] = useState(BANKS);

  const disconnect = (id:string) => Alert.alert('Disconnect Bank?', 'Bank feed will stop syncing.', [
    {text:'Cancel', style:'cancel'},
    {text:'Disconnect', style:'destructive', onPress:()=>setBanks(prev=>prev.map(b=>b.id===id?{...b,status:'disconnected'}:b))},
  ]);
  const addBank = () => Alert.alert('Add Bank', 'Bank feed integration coming soon!');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Bank Feeds</Text>
        <TouchableOpacity onPress={addBank} style={s.addBtn}><Ionicons name="add" size={22} color={COLORS.white} /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={s.infoTxt}>Connect your bank accounts to auto-reconcile transactions with Tally entries.</Text>
        </View>
        {banks.map(bank=>(
          <View key={bank.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={s.bankIcon}><Ionicons name="business-outline" size={22} color={COLORS.info} /></View>
              <View style={s.bankInfo}>
                <Text style={s.bankName}>{bank.name}</Text>
                <Text style={s.bankAcc}>{bank.account} · {bank.type}</Text>
              </View>
              <View style={[s.badge, {backgroundColor: bank.status==='connected'?COLORS.positiveBg:COLORS.pageBg}]}>
                <View style={[s.dot, {backgroundColor: bank.status==='connected'?COLORS.positive:COLORS.textTertiary}]} />
                <Text style={[s.badgeTxt, {color: bank.status==='connected'?COLORS.positive:COLORS.textTertiary}]}>
                  {bank.status==='connected'?'Connected':'Offline'}
                </Text>
              </View>
            </View>
            <Text style={s.syncTxt}>Last synced: {bank.lastSync}</Text>
            <View style={s.btnRow}>
              {bank.status==='connected' ? (
                <><TouchableOpacity style={s.syncBtn} onPress={()=>Alert.alert('Syncing', 'Fetching latest transactions...')} activeOpacity={0.7}>
                  <Ionicons name="sync-outline" size={14} color={COLORS.info} /><Text style={[s.btnTxt, {color:COLORS.info}]}>Sync Now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.disBtn} onPress={()=>disconnect(bank.id)} activeOpacity={0.7}>
                  <Text style={[s.btnTxt, {color:COLORS.negative}]}>Disconnect</Text>
                </TouchableOpacity></>
              ) : (
                <TouchableOpacity style={s.connectBtn} onPress={()=>Alert.alert('Reconnect', 'Reconnecting bank feed...')} activeOpacity={0.7}>
                  <Ionicons name="link-outline" size={14} color={COLORS.white} /><Text style={[s.btnTxt, {color:COLORS.white}]}>Reconnect</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        <TouchableOpacity style={s.addBankBtn} onPress={addBank} activeOpacity={0.8}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.textPrimary} />
          <Text style={s.addBankTxt}>Add Another Bank</Text>
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
  addBtn:{width:40,height:40,borderRadius:20,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  scroll:{padding:SPACING.md,paddingBottom:32},
  infoCard:{flexDirection:'row',gap:10,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.md,padding:SPACING.md,marginBottom:SPACING.md},
  infoTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.info,lineHeight:20},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardTop:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:SPACING.sm},
  bankIcon:{width:48,height:48,borderRadius:RADIUS.md,backgroundColor:COLORS.infoBg,alignItems:'center',justifyContent:'center'},
  bankInfo:{flex:1},
  bankName:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  bankAcc:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,marginTop:2},
  badge:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:4,borderRadius:RADIUS.full,borderWidth:1,borderColor:COLORS.borderDefault},
  dot:{width:7,height:7,borderRadius:4},
  badgeTxt:{fontSize:11,fontWeight:'600'},
  syncTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary,marginBottom:SPACING.sm},
  btnRow:{flexDirection:'row',gap:10},
  syncBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:RADIUS.md,borderWidth:1,borderColor:COLORS.info},
  disBtn:{paddingHorizontal:14,paddingVertical:9,borderRadius:RADIUS.md,borderWidth:1,borderColor:COLORS.negative},
  connectBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary},
  btnTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'600'},
  addBankBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingVertical:14,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.borderStrong,borderStyle:'dashed'},
  addBankTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textSecondary},
});
