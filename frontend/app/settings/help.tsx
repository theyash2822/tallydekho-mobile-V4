import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const FAQS = [
  {q:'How do I sync with Tally?', a:'Go to Settings → Integrations → Tally Prime Sync and enter the 6-digit pairing code from your desktop.'},
  {q:'How do I generate an E-Way Bill?', a:'Open any Sales Invoice and use the E-Way Bill option from the menu, or navigate to Reports → E-Way Bill.'},
  {q:'Can I use the app offline?', a:'Yes! All data entry works offline. It syncs to Tally when you’re back online.'},
  {q:'How do I add a new party/ledger?', a:'Go to Ledger tab → tap the + button and fill in the party details.'},
  {q:'What is Optional entry?', a:'Optional entries are saved but not posted to Tally books until you approve them manually.'},
];

export default function HelpCenterScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.title}>Help Center</Text>
        <View style={{width:40}} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Support Buttons */}
        <View style={s.supportRow}>
          <TouchableOpacity style={s.supportCard} onPress={()=>Linking.openURL('https://wa.me/919876543210')} activeOpacity={0.7}>
            <View style={s.supportIcon}><Ionicons name="logo-whatsapp" size={24} color={'#25D366'} /></View>
            <Text style={s.supportLabel}>WhatsApp Support</Text>
            <Text style={s.supportSub}>Mon–Fri 9am–6pm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.supportCard} onPress={()=>Linking.openURL('mailto:support@tallydekho.com')} activeOpacity={0.7}>
            <View style={[s.supportIcon, {backgroundColor:COLORS.infoBg}]}><Ionicons name="mail-outline" size={24} color={COLORS.info} /></View>
            <Text style={s.supportLabel}>Email Support</Text>
            <Text style={s.supportSub}>Reply within 24h</Text>
          </TouchableOpacity>
        </View>

        {/* Video Tutorials */}
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="play-circle-outline" size={18} color={COLORS.negative} /><Text style={s.cardTitle}>Video Tutorials</Text></View>
          {[
            {title:'Getting Started with TallyDekho', duration:'3:42'},
            {title:'Creating your first Sales Invoice', duration:'5:15'},
            {title:'Setting up Tally Prime Sync', duration:'4:28'},
            {title:'Managing Stocks & Inventory', duration:'6:10'},
          ].map((v, idx)=>(
            <TouchableOpacity key={v.title} style={[s.videoRow, idx>0 && s.rowBorder]} onPress={()=>Alert.alert('Video Tutorial', v.title)} activeOpacity={0.7}>
              <View style={s.playBtn}><Ionicons name="play" size={14} color={COLORS.white} /></View>
              <Text style={s.videoTitle}>{v.title}</Text>
              <Text style={s.duration}>{v.duration}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQs */}
        <View style={s.card}>
          <View style={s.cardHdr}><Ionicons name="help-circle-outline" size={18} color={COLORS.warning} /><Text style={s.cardTitle}>FAQs</Text></View>
          {FAQS.map((faq,idx)=>(
            <View key={idx} style={[s.faqItem, idx>0 && s.rowBorder]}>
              <Text style={s.faqQ}>{faq.q}</Text>
              <Text style={s.faqA}>{faq.a}</Text>
            </View>
          ))}
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
  supportRow:{flexDirection:'row',gap:12,marginBottom:SPACING.md},
  supportCard:{flex:1,backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,alignItems:'center',gap:6,borderWidth:1,borderColor:COLORS.borderDefault},
  supportIcon:{width:52,height:52,borderRadius:26,backgroundColor:'#F0FDF4',alignItems:'center',justifyContent:'center'},
  supportLabel:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textPrimary,textAlign:'center'},
  supportSub:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,textAlign:'center'},
  card:{backgroundColor:COLORS.cardBg,borderRadius:RADIUS.lg,padding:SPACING.md,marginBottom:SPACING.md,borderWidth:1,borderColor:COLORS.borderDefault},
  cardHdr:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:SPACING.md},
  cardTitle:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  videoRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
  rowBorder:{borderTopWidth:1,borderTopColor:COLORS.borderDefault},
  playBtn:{width:32,height:32,borderRadius:16,backgroundColor:COLORS.negative,alignItems:'center',justifyContent:'center'},
  videoTitle:{flex:1,fontSize:TYPOGRAPHY.sm,fontWeight:'500',color:COLORS.textPrimary},
  duration:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary,fontWeight:'600'},
  faqItem:{paddingVertical:SPACING.md},
  faqQ:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary,marginBottom:6},
  faqA:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,lineHeight:20},
});
