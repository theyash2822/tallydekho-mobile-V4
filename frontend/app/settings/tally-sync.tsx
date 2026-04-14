import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

export default function TallySyncScreen() {
  const router = useRouter();
  const [pairingCode, setPairingCode] = useState('');
  const [status, setStatus] = useState<'idle'|'pairing'|'paired'>('paired');
  const lastSeen = '15 Jun 2025, 11:42 AM';

  const handleDisconnect = () =>
    Alert.alert('Disconnect Tally?', 'You will need to re-pair your device to sync data again.', [
      {text:'Cancel', style:'cancel'},
      {text:'Disconnect', style:'destructive', onPress:()=>setStatus('idle')},
    ]);

  const handlePair = () => {
    if (!pairingCode || pairingCode.length !== 6) { Alert.alert('Invalid Code', 'Please enter the 6-digit code from Tally Desktop.'); return; }
    setStatus('pairing');
    setTimeout(()=>setStatus('paired'), 1800);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Tally Prime Sync</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Status Banner */}
        <View style={[s.statusBanner, {backgroundColor: status==='paired' ? COLORS.positiveBg : COLORS.warningBg}]}>
          <Ionicons name={status==='paired'?'checkmark-circle':'sync-outline'} size={20} color={status==='paired'?COLORS.positive:COLORS.warning} />
          <View>
            <Text style={[s.statusTitle, {color:status==='paired'?COLORS.positive:COLORS.warning}]}>{status==='paired'?'Tally Paired':'Not Connected'}</Text>
            {status==='paired' && <Text style={s.statusSub}>Last synced: {lastSeen}</Text>}
          </View>
        </View>

        {status === 'paired' ? (
          <View style={s.card}>
            <View style={s.deviceRow}>
              <View style={s.deviceIcon}><Ionicons name="desktop-outline" size={28} color={COLORS.info} /></View>
              <View style={s.deviceInfo}>
                <Text style={s.deviceName}>ASHISH-PC \ TallyPrime</Text>
                <Text style={s.deviceSub}>Last seen: {lastSeen}</Text>
                <View style={s.onlineDot}><View style={s.dot} /><Text style={s.onlineTxt}>Online</Text></View>
              </View>
            </View>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.outlineBtn} onPress={handleDisconnect} activeOpacity={0.7}>
                <Ionicons name="unlink-outline" size={16} color={COLORS.negative} />
                <Text style={[s.outlineTxt, {color:COLORS.negative}]}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={()=>Alert.alert('Sync Started', 'Syncing data from Tally...')} activeOpacity={0.7}>
                <Ionicons name="sync-outline" size={16} color={COLORS.white} />
                <Text style={s.primaryTxt}>Sync Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.card}>
            <View style={s.cardHdr}><Ionicons name="key-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Enter Pairing Code</Text></View>
            <Text style={s.sub}>Open TallyDekho on your desktop → find the 6-digit pairing code and enter it below</Text>
            <TextInput
              style={s.codeInput}
              value={pairingCode}
              onChangeText={v=>setPairingCode(v.replace(/\D/g,'').slice(0,6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              placeholderTextColor={COLORS.textTertiary}
            />
            <TouchableOpacity style={[s.primaryBtn, {marginTop:SPACING.md}]} onPress={handlePair} activeOpacity={0.8}>
              {status==='pairing' ? <Text style={s.primaryTxt}>Pairing...</Text> :
              <><Ionicons name="link-outline" size={16} color={COLORS.white} /><Text style={s.primaryTxt}>Pair Device</Text></>}
            </TouchableOpacity>
          </View>
        )}

        <View style={s.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.info} />
          <Text style={s.infoTxt}>Make sure TallyPrime is open and TallyDekho Desktop Agent is running to enable sync.</Text>
        </View>
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
  statusBanner:{flexDirection:'row',alignItems:'center',gap:12,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md},
  statusTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700'},
  statusSub:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,marginTop:2},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  sub:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,lineHeight:20,marginBottom:SPACING.md},
  deviceRow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:SPACING.md},
  deviceIcon:{width:56,height:56,borderRadius:RADIUS.md,backgroundColor:COLORS.infoBg,alignItems:'center',justifyContent:'center'},
  deviceInfo:{flex:1},
  deviceName:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  deviceSub:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,marginTop:2},
  onlineDot:{flexDirection:'row',alignItems:'center',gap:6,marginTop:4},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:COLORS.positive},
  onlineTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.positive,fontWeight:'600'},
  btnRow:{flexDirection:'row',gap:12},
  outlineBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12,borderRadius:RADIUS.md,borderWidth:1.5,borderColor:COLORS.negative},
  outlineTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700'},
  primaryBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12,borderRadius:RADIUS.md,backgroundColor:COLORS.brandPrimary},
  primaryTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.white},
  codeInput:{backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,paddingHorizontal:SPACING.lg,paddingVertical:SPACING.md,fontSize:TYPOGRAPHY.xxl,fontWeight:'800',color:COLORS.textPrimary,textAlign:'center',letterSpacing:8,borderWidth:2,borderColor:COLORS.borderDefault},
  infoCard:{flexDirection:'row',gap:10,backgroundColor:COLORS.infoBg,borderRadius:RADIUS.md,padding:SPACING.md},
  infoTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.info,lineHeight:20},
});
