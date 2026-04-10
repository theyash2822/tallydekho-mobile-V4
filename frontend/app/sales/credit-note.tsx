import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_CREDIT_NOTES } from '../../src/data/mockData';

const SC: Record<string,string> = { issued: COLORS.warning, settled: COLORS.positive };
const SL: Record<string,string> = { issued: 'Issued', settled: 'Settled' };

export default function CreditNotesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const data = MOCK_CREDIT_NOTES;
  const filtered = data.notes.filter(n => !search || n.party.toLowerCase().includes(search.toLowerCase()) || n.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Credit Notes</Text>
        <TouchableOpacity style={s.hdrAct}><Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.filterRow}>
          <TouchableOpacity style={s.dd}><Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} /><Text style={s.ddTxt}>June 25</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>Status</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>FY 2025-26</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
        </View>
        <View style={s.search}><Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search credit notes..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <View style={s.statsRow}>
          {[{l:'Total',v:data.summary.total},{l:'Issued',v:String(data.summary.count)},{l:'Docs',v:String(data.summary.docs)}].map(st=>(
            <View key={st.l} style={s.stat}><Text style={s.statV}>{st.v}</Text><Text style={s.statL}>{st.l}</Text></View>
          ))}
          <View style={s.stat}><Text style={s.statV}>Jan 25</Text><Text style={s.statL}>Period</Text></View>
        </View>
        <View style={s.secHdr}><Text style={s.secT}>Credit Notes</Text></View>
        <View style={s.card}>
          {filtered.map((n, idx) => (
            <View key={n.id}>
              <TouchableOpacity style={s.row} activeOpacity={0.7}>
                <View style={s.rowL}>
                  <View style={[s.dot, { backgroundColor: SC[n.status] || '#9CA3AF' }]} />
                  <View style={s.rInfo}>
                    <View style={s.topR}><Text style={[s.stLbl, { color: SC[n.status] }]}>{SL[n.status]}</Text><Text style={s.docId}>{n.id}</Text></View>
                    <Text style={s.party}>{n.party}</Text>
                    <Text style={s.meta}>{n.date} · {n.time} · Ref: {n.ref}</Text>
                  </View>
                </View>
                <View style={s.rowR}><Text style={s.amt}>{n.amount}</Text>
                  <TouchableOpacity style={s.shareB}><Ionicons name="share-outline" size={14} color={COLORS.positive} /><Text style={s.shareT}>Share</Text></TouchableOpacity>
                </View>
              </TouchableOpacity>
              {idx < filtered.length - 1 && <View style={s.div} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg}, hdr:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  back:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'}, hdrTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary}, hdrAct:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  filterRow:{flexDirection:'row',gap:8,paddingHorizontal:SPACING.md,paddingTop:SPACING.md}, dd:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:COLORS.cardBg,borderRadius:RADIUS.md,paddingHorizontal:10,paddingVertical:10,borderWidth:1,borderColor:COLORS.borderDefault,flex:1},
  ddTxt:{flex:1,fontSize:12,color:COLORS.textSecondary}, search:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,borderRadius:RADIUS.md,marginHorizontal:SPACING.md,marginTop:SPACING.sm,paddingHorizontal:14,paddingVertical:12,borderWidth:1,borderColor:COLORS.borderDefault},
  searchIn:{flex:1,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary}, statsRow:{flexDirection:'row',gap:8,marginHorizontal:SPACING.md,marginTop:SPACING.md},
  stat:{flex:1,backgroundColor:COLORS.cardBg,borderRadius:RADIUS.md,padding:12,alignItems:'center',borderWidth:1,borderColor:COLORS.borderDefault}, statV:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textPrimary}, statL:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,marginTop:3},
  secHdr:{flexDirection:'row',alignItems:'center',marginHorizontal:SPACING.md,marginTop:SPACING.md,marginBottom:SPACING.sm}, secT:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  card:{backgroundColor:COLORS.cardBg,marginHorizontal:SPACING.md,borderRadius:RADIUS.lg,borderWidth:1,borderColor:COLORS.borderDefault,overflow:'hidden'},
  row:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:SPACING.md,paddingVertical:14,gap:12}, rowL:{flexDirection:'row',alignItems:'flex-start',gap:10,flex:1},
  dot:{width:9,height:9,borderRadius:5,marginTop:4}, rInfo:{flex:1,gap:3}, topR:{flexDirection:'row',alignItems:'center',gap:8}, stLbl:{fontSize:TYPOGRAPHY.xs,fontWeight:'600'}, docId:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary},
  party:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary}, meta:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary}, rowR:{alignItems:'flex-end',gap:8}, amt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  shareB:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,paddingVertical:5,backgroundColor:COLORS.positiveBg,borderRadius:RADIUS.md}, shareT:{fontSize:TYPOGRAPHY.xs,color:COLORS.positive,fontWeight:'600'},
  div:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:16},
});
