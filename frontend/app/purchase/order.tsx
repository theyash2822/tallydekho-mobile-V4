import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getPurchaseOrders } from '../../src/services/api';

const SC: Record<string,string> = { confirmed: COLORS.positive, pending: COLORS.warning, received: COLORS.info };
const SL: Record<string,string> = { confirmed: 'Confirmed', pending: 'Pending', received: 'Received' };

export default function PurchaseOrdersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [liveData, setLiveData] = useState<any[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    getPurchaseOrders(companyGuid).then((res: any) => {
      const rows = res?.data ?? [];
      if (rows.length) setLiveData(rows.map((r: any) => ({ id: r.voucher_number||String(r.id), party: r.party_name||'', date: r.date||'', amount: `₹${Math.abs(+r.amount||0).toLocaleString('en-IN')}`, status: 'confirmed' })));
    }).catch((err: any) => { console.error('[API Error]', err?.message); setApiError(err?.message || 'Failed to load data'); });
  }, [companyGuid]);

  const filtered = (liveData.length > 0 ? liveData : data.orders).filter(o => !search || o.vendor.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Purchase Orders</Text>
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
          <TextInput style={s.searchIn} placeholder="Search purchase orders..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={COLORS.textTertiary} /></TouchableOpacity>}
        </View>
        <View style={s.statsRow}>
          {[{l:'Total',v:"—"},{l:'Confirmed',v:String("—")},{l:'Pending',v:String("—")},{l:'Docs',v:String("—")}].map(st=>(
            <View key={st.l} style={s.stat}><Text style={s.statV} numberOfLines={1} adjustsFontSizeToFit>{st.v}</Text><Text style={s.statL}>{st.l}</Text></View>
          ))}
        </View>
        <View style={s.secHdr}><Text style={s.secT}>Purchase Orders</Text></View>
        <View style={s.card}>
          {filtered.map((o, idx) => (
            <View key={o.id}>
              <TouchableOpacity style={s.row} activeOpacity={0.7}>
                <View style={s.rowL}>
                  <View style={[s.dot, { backgroundColor: SC[o.status] || '#9CA3AF' }]} />
                  <View style={s.rInfo}>
                    <View style={s.topR}><Text style={[s.stLbl, { color: SC[o.status] }]}>{SL[o.status]}</Text><Text style={s.docId}>{o.id}</Text></View>
                    <Text style={s.party}>{o.vendor}</Text>
                    <Text style={s.meta}>{o.date} · {o.time}</Text>
                  </View>
                </View>
                <View style={s.rowR}><Text style={s.amt}>{o.amount}</Text>
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
