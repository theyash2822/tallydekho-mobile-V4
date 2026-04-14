import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

interface Reminder { id:string; name:string; daysBefore:number; time:string; onDueDate:boolean; enabled:boolean; channels:string[]; }

const DEFAULT_REMINDERS: Reminder[] = [
  { id:'r1', name:'First Reminder', daysBefore:3, time:'10:00 AM', onDueDate:false, enabled:true, channels:['push','whatsapp'] },
  { id:'r2', name:'Due Date Alert', daysBefore:0, time:'09:00 AM', onDueDate:true, enabled:true, channels:['push','email'] },
];

export default function PaymentRemindersScreen() {
  const router = useRouter();
  const [threshold, setThreshold] = useState(500);
  const [reminders, setReminders] = useState<Reminder[]>(DEFAULT_REMINDERS);

  const toggleChannel = (rid: string, ch: string) => {
    setReminders(prev => prev.map(r => r.id===rid ? {...r, channels: r.channels.includes(ch) ? r.channels.filter(c=>c!==ch) : [...r.channels, ch]} : r));
  };

  const save = () => Alert.alert('Saved!', 'Payment reminder settings updated.', [{text:'OK', onPress:()=>router.back()}]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Payment Reminders</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="filter-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>Threshold</Text></View>
          <Text style={s.sub}>Don't send reminders for invoices below</Text>
          <View style={s.thresholdRow}>
            <Text style={s.rupee}>₹</Text>
            <TextInput style={s.threshIn} value={String(threshold)} onChangeText={v=>setThreshold(Number(v)||0)} keyboardType="numeric" placeholder="500" />
          </View>
        </View>

        {reminders.map(r=>(
          <View key={r.id} style={s.card}>
            <View style={s.reminderHdr}>
              <Ionicons name="alarm-outline" size={18} color={COLORS.warning} />
              <Text style={s.reminderName}>{r.name}</Text>
              <Switch value={r.enabled} onValueChange={v=>setReminders(prev=>prev.map(x=>x.id===r.id?{...x,enabled:v}:x))}
                trackColor={{false:COLORS.borderDefault,true:COLORS.positive}} thumbColor={COLORS.white} />
            </View>
            <View style={s.row}>
              <Text style={s.rowLabel}>Days Before Due</Text>
              <View style={s.stepper}>
                <TouchableOpacity style={s.stepBtn} onPress={()=>setReminders(prev=>prev.map(x=>x.id===r.id?{...x,daysBefore:Math.max(0,x.daysBefore-1)}:x))}>
                  <Ionicons name="remove" size={16} color={COLORS.textPrimary} /></TouchableOpacity>
                <Text style={s.stepVal}>{r.daysBefore}</Text>
                <TouchableOpacity style={s.stepBtn} onPress={()=>setReminders(prev=>prev.map(x=>x.id===r.id?{...x,daysBefore:x.daysBefore+1}:x))}>
                  <Ionicons name="add" size={16} color={COLORS.textPrimary} /></TouchableOpacity>
              </View>
            </View>
            <View style={[s.row, s.rowBorder]}>
              <Text style={s.rowLabel}>Send Time</Text>
              <TextInput style={s.timeIn} value={r.time} onChangeText={v=>setReminders(prev=>prev.map(x=>x.id===r.id?{...x,time:v}:x))} placeholder="10:00 AM" />
            </View>
            <View style={[s.row, s.rowBorder]}>
              <Text style={s.rowLabel}>On Due Date</Text>
              <Switch value={r.onDueDate} onValueChange={v=>setReminders(prev=>prev.map(x=>x.id===r.id?{...x,onDueDate:v}:x))}
                trackColor={{false:COLORS.borderDefault,true:COLORS.positive}} thumbColor={COLORS.white} />
            </View>
            <Text style={[s.fieldLabel, {marginTop:SPACING.sm}]}>Channels</Text>
            <View style={s.chips}>
              {['push','email','whatsapp','sms'].map(ch=>(
                <TouchableOpacity key={ch} style={[s.chip, r.channels.includes(ch) && s.chipActive]} onPress={()=>toggleChannel(r.id,ch)} activeOpacity={0.7}>
                  <Text style={[s.chipTxt, r.channels.includes(ch) && s.chipTxtActive]}>{ch.charAt(0).toUpperCase()+ch.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
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
  sub:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,marginBottom:SPACING.sm},
  thresholdRow:{flexDirection:'row',alignItems:'center',backgroundColor:COLORS.pageBg,borderRadius:RADIUS.md,borderWidth:1,borderColor:COLORS.borderDefault,paddingHorizontal:14,paddingVertical:10},
  rupee:{fontSize:TYPOGRAPHY.lg,fontWeight:'700',color:COLORS.textSecondary,marginRight:8},
  threshIn:{flex:1,fontSize:TYPOGRAPHY.lg,fontWeight:'700',color:COLORS.textPrimary},
  reminderHdr:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:SPACING.sm},
  reminderName:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12},
  rowBorder:{borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  rowLabel:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'500'},
  stepper:{flexDirection:'row',alignItems:'center',gap:14},
  stepBtn:{width:30,height:30,borderRadius:15,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:COLORS.borderDefault},
  stepVal:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary,minWidth:28,textAlign:'center'},
  timeIn:{backgroundColor:COLORS.pageBg,borderRadius:RADIUS.sm,paddingHorizontal:10,paddingVertical:7,fontSize:TYPOGRAPHY.sm,color:COLORS.textPrimary,borderWidth:1,borderColor:COLORS.borderDefault},
  fieldLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:SPACING.sm},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8},
  chip:{paddingHorizontal:12,paddingVertical:7,borderRadius:RADIUS.full,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  chipActive:{backgroundColor:COLORS.brandPrimary,borderColor:COLORS.brandPrimary},
  chipTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,fontWeight:'500'},
  chipTxtActive:{color:COLORS.white,fontWeight:'700'},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
