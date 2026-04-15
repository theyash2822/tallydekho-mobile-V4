import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_CONTRA_VOUCHERS } from '../../src/data/mockData';

export default function ContraVouchersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const data = MOCK_CONTRA_VOUCHERS;
  const filtered = data.items.filter(i => !search || i.narration.toLowerCase().includes(search.toLowerCase()) || i.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Contra Vouchers</Text>
        <TouchableOpacity style={s.hdrAct}><Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.filterRow}>
          <TouchableOpacity style={s.dd}><Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} /><Text style={s.ddTxt}>June 25</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>Account</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>FY 2025-26</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
        </View>
        <View style={s.search}><Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search contra entries..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <View style={s.statsRow}>
          {[{l:'Total',v:data.summary.total},{l:'Docs',v:String(data.summary.docs)},{l:'Period',v:'Jan 25'},{l:'All Clear',v:'✓'}].map(st=>(
            <View key={st.l} style={s.stat}><Text style={s.statV}>{st.v}</Text><Text style={s.statL}>{st.l}</Text></View>
          ))}
        </View>
        <View style={s.secHdr}><Text style={s.secT}>Contra Entries</Text></View>
        <View style={s.card}>
          {filtered.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => router.push(`/document/${item.id}?type=contra_voucher` as any)}
              >
                <View style={[s.iconBox, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="swap-horizontal-outline" size={18} color="#7C3AED" />
                </View>
                <View style={s.rInfo}>
                  <View style={s.topR}><Text style={s.docId}>{item.id}</Text><View style={s.clrChip}><Text style={s.clrTxt}>Cleared</Text></View></View>
                  <Text style={s.narration} numberOfLines={1}>{item.narration}</Text>
                  <View style={s.fromTo}>
                    <Text style={s.fromTxt}>{item.from}</Text>
                    <Ionicons name="arrow-forward" size={12} color={COLORS.textSecondary} />
                    <Text style={s.toTxt}>{item.to}</Text>
                  </View>
                  <Text style={s.meta}>{item.date} · {item.time}</Text>
                </View>
                <Text style={s.amt}>{item.amount}</Text>
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
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:SPACING.md,paddingVertical:14,gap:12},
  iconBox:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'}, rInfo:{flex:1,gap:3}, topR:{flexDirection:'row',alignItems:'center',gap:8},
  docId:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary}, clrChip:{backgroundColor:COLORS.positiveBg,paddingHorizontal:6,paddingVertical:2,borderRadius:4}, clrTxt:{fontSize:10,fontWeight:'600',color:COLORS.positive},
  narration:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary}, fromTo:{flexDirection:'row',alignItems:'center',gap:6,marginTop:1},
  fromTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,fontWeight:'500'}, toTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary,fontWeight:'500'},
  meta:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary}, amt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.textPrimary},
  div:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:16},
});
