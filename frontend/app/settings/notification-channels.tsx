import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ── Custom Themed Toggle ──────────────────────────────────────────────────────
function CustomToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, tension: 60, friction: 7 }).start();
  }, [value, anim]);
  const trackBg = anim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.borderStrong, COLORS.brandPrimary] });
  const thumbX  = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.85}>
      <Animated.View style={[ct.track, { backgroundColor: trackBg }]}>
        <Animated.View style={[ct.thumb, { transform: [{ translateX: thumbX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}
const ct = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 13, justifyContent: 'center' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.white, elevation: 2 },
});

const CHANNELS = [
  { id:'email', label:'Email', icon:'mail-outline', sub:'Get notified via email' },
  { id:'whatsapp', label:'WhatsApp', icon:'logo-whatsapp', sub:'Alerts on WhatsApp' },
  { id:'sms', label:'SMS', icon:'chatbox-outline', sub:'Text message alerts' },
  { id:'push', label:'Push Notification', icon:'notifications-outline', sub:'In-app push alerts' },
];

export default function NotificationChannelsScreen() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string,boolean>>({ email:true, whatsapp:true, sms:false, push:true });
  const [quietHours, setQuietHours] = useState(false);
  const [startTime, setStartTime] = useState('10:00 PM');
  const [endTime, setEndTime] = useState('07:00 AM');
  const [saturday, setSaturday] = useState(false);
  const [sunday, setSunday] = useState(true);

  const save = () => {
    Toast.show({ type: 'success', text1: 'Settings Saved', text2: 'Notification preferences updated.' });
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Channels & Quiet Hours</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="notifications-outline" size={18} color={COLORS.textSecondary} /><Text style={s.cardTitle}>Notification Channels</Text></View>
          {CHANNELS.map((ch, idx)=>(
            <View key={ch.id} style={[s.row, idx>0 && s.rowBorder]}>
              <View style={s.chIcon}>
                <Ionicons name={ch.icon as any} size={18} color={COLORS.textSecondary} />
              </View>
              <View style={s.rowInfo}>
                <Text style={s.rowLabel}>{ch.label}</Text>
                <Text style={s.rowSub}>{ch.sub}</Text>
              </View>
              <CustomToggle value={enabled[ch.id]} onChange={v => setEnabled(prev => ({...prev, [ch.id]: v}))} />
            </View>
          ))}
        </View>

        <View style={s.card}>
          <View style={[s.row, {borderBottomWidth:0}]}>
            <View style={s.cardHdr}><Ionicons name="moon-outline" size={18} color={COLORS.textSecondary} /><Text style={s.cardTitle}>Quiet Hours</Text></View>
            <CustomToggle value={quietHours} onChange={setQuietHours} />
          </View>
          {quietHours && (
            <View style={s.quietBody}>
              <View style={s.timeRow}>
                <View style={s.timeBox}>
                  <Text style={s.timeLabel}>Start Time</Text>
                  <TextInput style={s.timeIn} value={startTime} onChangeText={setStartTime} placeholder="10:00 PM" />
                </View>
                <Ionicons name="arrow-forward" size={18} color={COLORS.textTertiary} />
                <View style={s.timeBox}>
                  <Text style={s.timeLabel}>End Time</Text>
                  <TextInput style={s.timeIn} value={endTime} onChangeText={setEndTime} placeholder="07:00 AM" />
                </View>
              </View>
              <Text style={s.weekendLabel}>Weekends</Text>
              <View style={s.weekendRow}>
                {[{label:'Saturday', val:saturday, set:setSaturday}, {label:'Sunday', val:sunday, set:setSunday}].map(d=>(
                  <TouchableOpacity key={d.label} style={[s.dayBox, d.val && s.dayBoxActive]} onPress={()=>d.set(!d.val)} activeOpacity={0.7}>
                    <Text style={[s.dayTxt, d.val && s.dayTxtActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.sm},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
  rowBorder:{borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  chIcon:{width:40,height:40,borderRadius:20,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:COLORS.borderDefault},
  rowInfo:{flex:1},
  rowLabel:{fontSize:TYPOGRAPHY.base,fontWeight:'600',color:COLORS.textPrimary},
  rowSub:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,marginTop:2},
  quietBody:{borderTopWidth:1,borderTopColor:COLORS.borderDefault,paddingTop:SPACING.md},
  timeRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:SPACING.md},
  timeBox:{flex:1},
  timeLabel:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.textSecondary,marginBottom:6},
  timeIn:{backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,paddingHorizontal:12,paddingVertical:10,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,borderWidth:1,borderColor:COLORS.borderDefault},
  weekendLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:SPACING.sm},
  weekendRow:{flexDirection:'row',gap:12},
  dayBox:{flex:1,paddingVertical:10,alignItems:'center',borderRadius:RADIUS.md,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  dayBoxActive:{backgroundColor:COLORS.brandPrimary,borderColor:COLORS.brandPrimary},
  dayTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'500'},
  dayTxtActive:{color:COLORS.white,fontWeight:'700'},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
