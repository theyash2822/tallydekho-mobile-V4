import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getDeliveryNotes } from '../../src/services/api';

const SC: Record<string,string> = { delivered: COLORS.positive, in_transit: COLORS.info, pending: COLORS.warning };
const SL: Record<string,string> = { delivered: 'Delivered', in_transit: 'In Transit', pending: 'Pending' };

export default function DeliveryNotesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [liveData, setLiveData] = useState<any[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    getDeliveryNotes(companyGuid).then((res: any) => {
      const rows = res?.data ?? [];
      if (rows.length) setLiveData(rows.map((r: any) => ({ id: r.voucher_number||String(r.id), party: r.party_name||'', date: r.date||'', amount: `₹${Math.abs(+r.amount||0).toLocaleString('en-IN')}`, status: 'confirmed' })));
    }).catch((err: any) => { console.error('[API Error]', err?.message); setApiError(err?.message || 'Failed to load data'); });
  }, [companyGuid]);

    const data = MOCK_DELIVERY_NOTES;
  const filtered = data.notes.filter(n => !search || n.party.toLowerCase().includes(search.toLowerCase()) || n.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Delivery Notes</Text>
        <TouchableOpacity style={s.hdrAct}><Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
      </View>
      {apiError && <ErrorBanner message={apiError} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.filterRow}>
          <TouchableOpacity style={s.dd}><Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} /><Text style={s.ddTxt}>June 25</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>Status</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>FY 2025-26</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
        </View>
        <View style={s.search}><Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search delivery notes..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <View style={s.statsRow}>
          {[{l:'Delivered',v:String(data.summary.delivered)},{l:'In Transit',v:String(data.summary.in_transit)},{l:'Pending',v:String(data.summary.pending)},{l:'Total',v:String(data.summary.docs)}].map(st=>(
            <View key={st.l} style={s.stat}><Text style={s.statV}>{st.v}</Text><Text style={s.statL}>{st.l}</Text></View>
          ))}
        </View>
        <View style={s.secHdr}><Text style={s.secT}>Delivery Notes</Text></View>
        <View style={s.card}>
          {filtered.map((n, idx) => (
            <View key={n.id}>
              <TouchableOpacity style={s.row} activeOpacity={0.7}>
                <View style={[s.iconBox, { backgroundColor: (SC[n.status] || '#9CA3AF') + '18' }]}>
                  <Ionicons name={n.status === 'delivered' ? 'checkmark-circle-outline' : n.status === 'in_transit' ? 'car-outline' : 'time-outline'} size={20} color={SC[n.status] || '#9CA3AF'} />
                </View>
                <View style={s.rInfo}>
                  <View style={s.topR}><Text style={[s.stLbl, { color: SC[n.status] }]}>{SL[n.status]}</Text><Text style={s.docId}>{n.id}</Text></View>
                  <Text style={s.party}>{n.party}</Text>
                  <Text style={s.meta}>{n.date} · {n.time}</Text>
                </View>
                <Text style={s.amt}>{n.amount}</Text>
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
  iconBox:{width:42,height:42,borderRadius:21,alignItems:'center',justifyContent:'center'}, rInfo:{flex:1,gap:3}, topR:{flexDirection:'row',alignItems:'center',gap:8}, stLbl:{fontSize:TYPOGRAPHY.xs,fontWeight:'600'}, docId:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary},
  party:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary}, meta:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary}, amt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textPrimary},
  div:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:16},
});
