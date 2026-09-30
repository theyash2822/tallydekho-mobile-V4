import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';

const APP_VERSION = Constants.expoConfig?.version ?? '';
const APP_BUILD = Platform.OS === 'ios'
  ? Constants.expoConfig?.ios?.buildNumber
  : Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : undefined;

const CHANGELOG = [
  { version:'v4.0.0', date:'May 2026', changeKeys:[
    'screens.settingsAbout.v400Change1',
    'screens.settingsAbout.v400Change2',
    'screens.settingsAbout.v400Change3',
    'screens.settingsAbout.v400Change4',
    'screens.settingsAbout.v400Change5',
    'screens.settingsAbout.v400Change6',
    'screens.settingsAbout.v400Change7',
  ]},
  { version:'v3.8.0', date:'Jun 2025', changeKeys:[
    'screens.settingsAbout.v380Change1',
    'screens.settingsAbout.v380Change2',
    'screens.settingsAbout.v380Change3',
  ]},
  { version:'v3.7.0', date:'May 2025', changeKeys:[
    'screens.settingsAbout.v370Change1',
    'screens.settingsAbout.v370Change2',
    'screens.settingsAbout.v370Change3',
  ]},
  { version:'v3.6.0', date:'Apr 2025', changeKeys:[
    'screens.settingsAbout.v360Change1',
    'screens.settingsAbout.v360Change2',
    'screens.settingsAbout.v360Change3',
  ]},
];

const LINKS = [
  { icon:'globe-outline',           labelKey:'screens.settingsAbout.website',          action:()=>Linking.openURL('https://tallydekho.com'),                  color:COLORS.info },
  { icon:'shield-checkmark-outline', labelKey:'screens.settingsAbout.privacyPolicy',   action:()=>Linking.openURL('https://www.tallydekho.com/privacy-policy.html'), color:'#7C3AED' },
  { icon:'document-text-outline',   labelKey:'screens.settingsAbout.termsOfService', action:()=>Linking.openURL('https://staticv2.tallydekho.com/TallyDekho_TermsOfService.pdf'), color:COLORS.warning },
];

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const appVersionLabel = APP_VERSION
    ? APP_BUILD != null
      ? t('screens.settingsAbout.versionWithBuild', { version: APP_VERSION, build: APP_BUILD })
      : t('screens.settingsAbout.version', { version: APP_VERSION })
    : '';
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>{t('settings.about')}</Text>
        <View style={{width:40}} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Logo card */}
        <View style={s.logoCard}>
          <View style={s.appIcon}>
            <Ionicons name="bar-chart-outline" size={36} color={COLORS.white} />
          </View>
          <Text style={s.appName}>TallyDekho</Text>
          <Text style={s.appVersion}>{appVersionLabel}</Text>
          <TouchableOpacity
            style={s.planBadge}
            onPress={()=>safePush(router, '/settings/license' as any)}
            activeOpacity={0.75}
          >
            <Text style={s.planTxt}>{t('settings.license')}</Text>
            <Ionicons name="chevron-forward" size={12} color={COLORS.positive} />
          </TouchableOpacity>
        </View>

        {/* What's New */}
        <View style={s.card}>
          <View style={s.cardHdr}>
            <Ionicons name="rocket-outline" size={18} color={COLORS.info} />
            <Text style={s.cardTitle}>{t('screens.settingsAbout.whatsNew')}</Text>
          </View>
          {CHANGELOG.map(cl=>(
            <View key={cl.version} style={s.changeItem}>
              <View style={s.changeHdr}>
                <Text style={s.changeVersion}>{cl.version}</Text>
                <Text style={s.changeDate}>{cl.date}</Text>
              </View>
              {cl.changeKeys.map(c=>(
                <View key={c} style={s.changeRow}>
                  <Text style={s.changeDot}>·</Text>
                  <Text style={s.changeTxt}>{t(c)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Links (Contact Support REMOVED) */}
        <View style={s.card}>
          {LINKS.map((item,idx)=>(
            <TouchableOpacity
              key={item.labelKey}
              style={[s.linkRow, idx>0 && s.linkBorder]}
              onPress={item.action}
              activeOpacity={0.7}
            >
              <View style={[s.linkIcon, {backgroundColor:item.color+'15'}]}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
              </View>
              <Text style={s.linkLabel}>{t(item.labelKey)}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.footer}>{t('screens.settingsAbout.footer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex:1, backgroundColor:COLORS.pageBg },
  hdr:        { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.cardBg, paddingHorizontal:SPACING.sm, paddingVertical:10, borderBottomWidth:1, borderBottomColor:COLORS.borderDefault },
  back:       { width:40, height:40, alignItems:'center', justifyContent:'center' },
  hdrTitle:   { flex:1, fontSize:TYPOGRAPHY.md, fontWeight:'700', color:COLORS.textPrimary, textAlign:'center' },
  scroll:     { padding:SPACING.md, paddingBottom:40 },

  logoCard:   { alignItems:'center', backgroundColor:COLORS.cardBg, borderRadius:RADIUS.xl, padding:SPACING.xl, marginBottom:SPACING.md, borderWidth:1, borderColor:COLORS.borderDefault, gap:8 },
  appIcon:    { width:72, height:72, borderRadius:RADIUS.xl, backgroundColor:COLORS.brandPrimary, alignItems:'center', justifyContent:'center' },
  appName:    { fontSize:TYPOGRAPHY.lg, fontWeight:'800', color:COLORS.textPrimary },
  appVersion: { fontSize:TYPOGRAPHY.sm, color:COLORS.textSecondary },
  planBadge:  { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:COLORS.positiveBg, paddingHorizontal:12, paddingVertical:5, borderRadius:RADIUS.full },
  planTxt:    { fontSize:TYPOGRAPHY.sm, fontWeight:'700', color:COLORS.positive },

  card:        { backgroundColor:COLORS.cardBg, borderRadius:RADIUS.lg, padding:SPACING.md, marginBottom:SPACING.md, borderWidth:1, borderColor:COLORS.borderDefault },
  cardHdr:     { flexDirection:'row', alignItems:'center', gap:8, marginBottom:SPACING.md },
  cardTitle:   { fontSize:TYPOGRAPHY.base, fontWeight:'700', color:COLORS.textPrimary },
  changeItem:  { marginBottom:SPACING.md },
  changeHdr:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:SPACING.sm },
  changeVersion:{ fontSize:TYPOGRAPHY.sm, fontWeight:'800', color:COLORS.textPrimary },
  changeDate:  { fontSize:TYPOGRAPHY.xs, color:COLORS.textTertiary },
  changeRow:   { flexDirection:'row', gap:8, marginBottom:4 },
  changeDot:   { fontSize:TYPOGRAPHY.sm, color:COLORS.textTertiary, fontWeight:'800' },
  changeTxt:   { flex:1, fontSize:TYPOGRAPHY.sm, color:COLORS.textSecondary, lineHeight:20 },

  linkRow:    { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:14 },
  linkBorder: { borderTopWidth:1, borderTopColor:COLORS.borderDefault },
  linkIcon:   { width:38, height:38, borderRadius:19, alignItems:'center', justifyContent:'center' },
  linkLabel:  { flex:1, fontSize:TYPOGRAPHY.base, fontWeight:'500', color:COLORS.textPrimary },

  footer: { textAlign:'center', fontSize:TYPOGRAPHY.sm, color:COLORS.textSecondary, marginTop:SPACING.sm },
});
