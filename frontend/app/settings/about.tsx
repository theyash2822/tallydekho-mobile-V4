import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const CHANGELOG = [
  { version:'v3.7.2', date:'Jun 2025', changes:['Fixed Quick Actions routing to create forms','Added RegularOptionalToggle to all 12 form screens','Improved Daybook with multi-select and push-to-Tally'] },
  { version:'v3.7.0', date:'May 2025', changes:['E-Way Bill compliance dashboard','Audit trail with bar charts','AI Insights redesign with 6 insight cards'] },
  { version:'v3.6.0', date:'Apr 2025', changes:['New Stock Dashboard with 5 metric cards','Barcode print queue','Warehouse management screens'] },
];

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>About & Version</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.logoCard}>
          <View style={s.appIcon}><Ionicons name="bar-chart-outline" size={36} color={COLORS.white} /></View>
          <Text style={s.appName}>TallyDekho</Text>
          <Text style={s.appVersion}>Version 3.7.2 (Build 257)</Text>
          <View style={s.planBadge}><Text style={s.planTxt}>Free Plan</Text></View>
        </View>

        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="rocket-outline" size={18} color={COLORS.info} /><Text style={s.cardTitle}>What's New</Text></View>
          {CHANGELOG.map(cl=>(
            <View key={cl.version} style={s.changeItem}>
              <View style={s.changeHdr}>
                <Text style={s.changeVersion}>{cl.version}</Text>
                <Text style={s.changeDate}>{cl.date}</Text>
              </View>
              {cl.changes.map(c=>(
                <View key={c} style={s.changeRow}><Text style={s.changeDot}>•</Text><Text style={s.changeTxt}>{c}</Text></View>
              ))}
            </View>
          ))}
        </View>

        <View style={s.card}>
          {[
            {icon:'globe-outline', label:'Website', action:()=>Linking.openURL('https://tallydekho.com'), color:COLORS.info},
            {icon:'mail-outline', label:'Contact Support', action:()=>Linking.openURL('mailto:support@tallydekho.com'), color:COLORS.positive},
            {icon:'shield-checkmark-outline', label:'Privacy Policy', action:()=>Alert.alert('Privacy Policy'), color:'#7C3AED'},
            {icon:'document-text-outline', label:'Terms of Service', action:()=>Alert.alert('Terms of Service'), color:COLORS.warning},
          ].map((item,idx)=>(
            <TouchableOpacity key={item.label} style={[s.linkRow, idx>0 && s.linkBorder]} onPress={item.action} activeOpacity={0.7}>
              <View style={[s.linkIcon, {backgroundColor:item.color+'15'}]}><Ionicons name={item.icon as any} size={18} color={item.color} /></View>
              <Text style={s.linkLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.footer}>🇮🇳 Made in India with ❤️ by the TallyDekho Team</Text>
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
  logoCard:{alignItems:'center',backgroundColor:COLORS.cardBg,borderRadius:RADIUS.xl,padding:SPACING.xl,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault,gap:8},
  appIcon:{width:72,height:72,borderRadius:RADIUS.xl,backgroundColor:COLORS.brandPrimary,alignItems:'center',justifyContent:'center'},
  appName:{fontSize:TYPOGRAPHY.lg,fontWeight:'800',color:COLORS.textPrimary},
  appVersion:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary},
  planBadge:{backgroundColor:COLORS.positiveBg,paddingHorizontal:12,paddingVertical:4,borderRadius:RADIUS.full},
  planTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.positive},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  changeItem:{marginBottom:SPACING.md},
  changeHdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:SPACING.sm},
  changeVersion:{fontSize:TYPOGRAPHY.sm,fontWeight:'800',color:COLORS.textPrimary},
  changeDate:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
  changeRow:{flexDirection:'row',gap:8,marginBottom:4},
  changeDot:{fontSize:TYPOGRAPHY.sm,color:COLORS.textTertiary},
  changeTxt:{flex:1,fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,lineHeight:20},
  linkRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14},
  linkBorder:{borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  linkIcon:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center'},
  linkLabel:{flex:1,fontSize:TYPOGRAPHY.base,fontWeight:'500',color:COLORS.textPrimary},
  footer:{textAlign:'center',fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,marginTop:SPACING.sm},
});
