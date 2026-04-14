import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const LANGUAGES = [
  { code:'en', label:'English', native:'English', region:'India' },
  { code:'hi', label:'Hindi', native:'हिन्दी', region:'India' },
  { code:'gu', label:'Gujarati', native:'ગુજરાતી', region:'India' },
  { code:'mr', label:'Marathi', native:'मराठी', region:'India' },
  { code:'ta', label:'Tamil', native:'தமிழ்', region:'India' },
  { code:'te', label:'Telugu', native:'తెలుగు', region:'India' },
  { code:'kn', label:'Kannada', native:'ಕನ್ನಡ', region:'India' },
  { code:'pa', label:'Punjabi', native:'ਪੰਜਾਬੀ', region:'India' },
];
const DATE_FORMATS = ['DD/MM/YYYY','MM/DD/YYYY','YYYY-MM-DD','DD-MM-YYYY'];
const TIMEZONES = ['UTC+05:30 (IST)', 'UTC+00:00 (GMT)', 'UTC-05:00 (EST)', 'UTC+08:00 (CST)'];
const WEEK_STARTS = ['Monday','Sunday','Saturday'];

export default function LanguageRegionScreen() {
  const router = useRouter();
  const [lang, setLang] = useState('en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timezone, setTimezone] = useState('UTC+05:30 (IST)');
  const [weekStart, setWeekStart] = useState('Monday');

  const save = () => Alert.alert('Saved!', 'Language & Region settings updated.', [{text:'OK', onPress:()=>router.back()}]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Language & Region</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="language-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>App Language</Text></View>
          {LANGUAGES.map(l=>(
            <TouchableOpacity key={l.code} style={s.optRow} onPress={()=>setLang(l.code)} activeOpacity={0.7}>
              <View style={s.optLeft}>
                <Text style={s.optLabel}>{l.label}</Text>
                <Text style={s.optSub}>{l.native} · {l.region}</Text>
              </View>
              {lang===l.code && <Ionicons name="checkmark-circle" size={22} color={COLORS.positive} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="calendar-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>Date & Time</Text></View>
          <Text style={s.fieldLabel}>Date Format</Text>
          <View style={s.chips}>
            {DATE_FORMATS.map(f=>(
              <TouchableOpacity key={f} style={[s.chip, dateFormat===f && s.chipActive]} onPress={()=>setDateFormat(f)}>
                <Text style={[s.chipTxt, dateFormat===f && s.chipTxtActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.fieldLabel, {marginTop:SPACING.md}]}>Timezone</Text>
          {TIMEZONES.map(tz=>(
            <TouchableOpacity key={tz} style={s.optRow} onPress={()=>setTimezone(tz)} activeOpacity={0.7}>
              <Text style={s.optLabel}>{tz}</Text>
              {timezone===tz && <Ionicons name="checkmark-circle" size={20} color={COLORS.positive} />}
            </TouchableOpacity>
          ))}
          <Text style={[s.fieldLabel, {marginTop:SPACING.md}]}>Week Starts On</Text>
          <View style={s.chips}>
            {WEEK_STARTS.map(w=>(
              <TouchableOpacity key={w} style={[s.chip, weekStart===w && s.chipActive]} onPress={()=>setWeekStart(w)}>
                <Text style={[s.chipTxt, weekStart===w && s.chipTxtActive]}>{w}</Text>
              </TouchableOpacity>
            ))}
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
  optRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:12,borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  optLeft:{gap:2},
  optLabel:{fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary,fontWeight:'500'},
  optSub:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary},
  fieldLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textSecondary,marginBottom:SPACING.sm},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8},
  chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:RADIUS.md,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  chipActive:{backgroundColor:COLORS.brandPrimary,borderColor:COLORS.brandPrimary},
  chipTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  chipTxtActive:{color:COLORS.white,fontWeight:'700'},
  saveBtn:{backgroundColor:COLORS.brandPrimary,borderRadius:RADIUS.md,paddingVertical:15,alignItems:'center',marginTop:SPACING.sm},
  saveTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.white},
});
