import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─── Data ────────────────────────────────────────────────────────────────────
const SECURITY_SECTIONS = [
  {
    title: 'Data at Rest',
    icon:  'lock-closed-outline',
    items: [
      { label: 'Encrypt local database', badge: 'AES-256' },
      { label: 'Clear cache on logout',  badge: undefined },
    ],
  },
  {
    title: 'Network',
    icon:  'wifi-outline',
    items: [
      { label: 'Allow only HTTPS endpoints', badge: undefined },
    ],
  },
  {
    title: 'Data Retention',
    icon:  'time-outline',
    items: [
      { label: 'Anonymise deleted user data',           badge: undefined },
      { label: 'Auto-purge recycle bin after [30] days', badge: undefined },
    ],
  },
];

// ─── Static Check Row ────────────────────────────────────────────────────────
function CheckRow({ label, badge, isLast }: { label: string; badge?: string; isLast: boolean }) {
  return (
    <>
      <View style={r.row}>
        <Text style={r.label}>{label}</Text>
        <View style={r.right}>
          {badge && (
            <View style={r.badge}><Text style={r.badgeTxt}>{badge}</Text></View>
          )}
          <View style={r.check}>
            <Ionicons name="checkmark" size={14} color={COLORS.white} />
          </View>
        </View>
      </View>
      {!isLast && <View style={r.divider} />}
    </>
  );
}
const r = StyleSheet.create({
  row:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:15, paddingHorizontal:SPACING.md },
  label:    { flex:1, fontSize:TYPOGRAPHY.base, color:COLORS.textSecondary, fontWeight:'400' },
  right:    { flexDirection:'row', alignItems:'center', gap:8 },
  badge:    { backgroundColor:COLORS.activeBg, paddingHorizontal:8, paddingVertical:3, borderRadius:RADIUS.full },
  badgeTxt: { fontSize:11, fontWeight:'700', color:COLORS.textSecondary },
  check:    { width:28, height:28, borderRadius:14, backgroundColor:COLORS.positive, alignItems:'center', justifyContent:'center' },
  divider:  { height:1, backgroundColor:COLORS.borderDefault, marginLeft:SPACING.md },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function DataSecurityScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Data Security</Text>
        <View style={{width:40}} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Protection banner */}
        <View style={s.banner}>
          <View style={s.bannerIconWrap}>
            <Ionicons name="shield-checkmark" size={30} color={COLORS.positive} />
          </View>
          <View style={s.bannerText}>
            <Text style={s.bannerTitle}>Your account and data is protected</Text>
            <Text style={s.bannerSub}>Data is stored securely on AWS servers</Text>
          </View>
        </View>

        {/* Sections */}
        <View style={s.card}>
          {SECURITY_SECTIONS.map((sec, si) => (
            <View key={sec.title}>
              {si > 0 && <View style={s.sectionDivider} />}
              {/* Section title */}
              <View style={s.secHeader}>
                <View style={s.secIconBox}>
                  <Ionicons name={sec.icon as any} size={14} color={COLORS.textSecondary} />
                </View>
                <Text style={s.secTitle}>{sec.title}</Text>
              </View>
              {/* Items */}
              {sec.items.map((item, ii) => (
                <CheckRow
                  key={item.label}
                  label={item.label}
                  badge={item.badge}
                  isLast={ii === sec.items.length - 1}
                />
              ))}
            </View>
          ))}
        </View>

        {/* AWS note */}
        <View style={s.awsNote}>
          <Ionicons name="cloud-outline" size={16} color={COLORS.textSecondary} />
          <Text style={s.awsNoteTxt}>
            All your business data is encrypted and backed up on Amazon Web Services (AWS) — one of the world's most trusted cloud infrastructures.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex:1, backgroundColor:COLORS.pageBg },
  hdr:     { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.cardBg, paddingHorizontal:SPACING.sm, paddingVertical:10, borderBottomWidth:1, borderBottomColor:COLORS.borderDefault },
  back:    { width:40, height:40, alignItems:'center', justifyContent:'center' },
  hdrTitle:{ flex:1, fontSize:TYPOGRAPHY.md, fontWeight:'700', color:COLORS.textPrimary, textAlign:'center' },
  scroll:  { padding:SPACING.md, paddingBottom:48 },

  banner: {
    flexDirection:'row', alignItems:'center', gap:14,
    backgroundColor:COLORS.positiveBg, borderRadius:RADIUS.lg,
    padding:SPACING.md, marginBottom:SPACING.md,
    borderWidth:1, borderColor:COLORS.positive+'40',
  },
  bannerIconWrap: { width:52, height:52, borderRadius:26, backgroundColor:'#DCFCE7', alignItems:'center', justifyContent:'center' },
  bannerText:  { flex:1 },
  bannerTitle: { fontSize:TYPOGRAPHY.base, fontWeight:'700', color:'#1A4D2E' },
  bannerSub:   { fontSize:TYPOGRAPHY.xs, color:COLORS.positive, marginTop:3, fontWeight:'500' },

  card: { backgroundColor:COLORS.cardBg, borderRadius:RADIUS.lg, borderWidth:1, borderColor:COLORS.borderDefault, marginBottom:SPACING.md, overflow:'hidden' },

  sectionDivider: { height:8, backgroundColor:COLORS.pageBg },
  secHeader:  { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:SPACING.md, paddingTop:14, paddingBottom:6 },
  secIconBox: { width:24, height:24, borderRadius:12, backgroundColor:COLORS.activeBg, alignItems:'center', justifyContent:'center' },
  secTitle:   { fontSize:TYPOGRAPHY.sm, fontWeight:'800', color:COLORS.textPrimary, textTransform:'uppercase', letterSpacing:0.6 },

  awsNote: {
    flexDirection:'row', alignItems:'flex-start', gap:10,
    backgroundColor:COLORS.activeBg, borderRadius:RADIUS.md,
    padding:SPACING.md, borderWidth:1, borderColor:COLORS.borderStrong,
  },
  awsNoteTxt: { flex:1, fontSize:TYPOGRAPHY.sm, color:COLORS.textSecondary, lineHeight:20 },
});
