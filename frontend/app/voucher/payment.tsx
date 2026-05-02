import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getVouchers } from '../../src/services/api';

const MC: Record<string,string> = { NEFT:'#2563EB', RTGS:'#7C3AED', Cash:COLORS.positive, Cheque:COLORS.warning };
const SC: Record<string,string> = { cleared:COLORS.positive, pending:COLORS.warning };
const SL: Record<string,string> = { cleared:'Cleared', pending:'Pending' };

export default function PaymentVouchersScreen() {
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const [search, setSearch] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [liveItems, setLiveItems] = useState<any[]>([]);

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getVouchers(companyGuid, 'payment', selectedFY?.startDate && selectedFY?.endDate ? { from: selectedFY.startDate, to: selectedFY.endDate } : {}).then((res: any) => {
      const rows = res?.data ?? [];
      setLiveItems(rows.map((r: any) => ({
        id: r.voucher_number || String(r.id),
        party: r.party_name || '',
        date: r.date || '',
        time: '',
        amount: `₹${Math.abs(+r.amount||0).toLocaleString('en-IN')}`,
        method: 'NEFT',
        status: 'cleared',
      })));
    }).catch((err: any) => { console.error('[API Error]', err?.message); setApiError(err?.message || 'Failed to load data'); }).finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY?.startDate]);

  const filtered = liveItems.filter((i: any) => !search || (i.party||'').toLowerCase().includes(search.toLowerCase()) || (i.id||'').toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Payment Vouchers</Text>
        <TouchableOpacity style={s.hdrAct}><Ionicons name="ellipsis-vertical" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
      </View>
      {apiError && <ErrorBanner message={apiError} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={s.filterRow}>
          <TouchableOpacity style={s.dd}><Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} /><Text style={s.ddTxt}>June 25</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>Method</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={s.dd}><Text style={s.ddTxt}>FY 2025-26</Text><Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} /></TouchableOpacity>
        </View>
        <View style={s.search}><Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput style={s.searchIn} placeholder="Search payment vouchers..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={COLORS.textTertiary} /></TouchableOpacity>}
        </View>
        <View style={s.statsRow}>
          {(() => {
            const parseAmount = (amtStr: string) => { const n = parseFloat((amtStr || '0').replace(/[₹,]/g, '')); return isNaN(n) ? 0 : n; };
            const totalAmt = filtered.reduce((sum: number, i: any) => sum + parseAmount(i.amount), 0);
            const fmtAmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
            return [{l:'Total',v:fmtAmt(totalAmt)},{l:'Docs',v:String(filtered.length)}];
          })().map(st=>(
            <View key={st.l} style={s.stat}><Text style={s.statV}>{st.v}</Text><Text style={s.statL}>{st.l}</Text></View>
          ))}
          <View style={s.stat}><Text style={s.statV}>Jan 25</Text><Text style={s.statL}>Period</Text></View>
          <View style={s.stat}><Text style={s.statV}>4</Text><Text style={s.statL}>Methods</Text></View>
        </View>
        <View style={s.secHdr}><Text style={s.secT}>Payment Vouchers</Text></View>
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Ionicons name="send-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>No payment vouchers</Text>
            <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' }}>Sync your Tally data to see payment records</Text>
          </View>
        )}
        {filtered.length > 0 && <View style={s.card}>
          {filtered.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => router.push(`/document/${item.id}?type=payment_voucher` as any)}
              >
                <View style={s.rowL}>
                  <View style={[s.dot, { backgroundColor: SC[item.status] || '#9CA3AF' }]} />
                  <View style={s.rInfo}>
                    <View style={s.topR}>
                      <Text style={[s.stLbl, { color: SC[item.status] }]}>{SL[item.status]}</Text>
                      <Text style={s.docId}>{item.id}</Text>
                      <View style={[s.methodChip, { backgroundColor: (MC[item.method] || '#9CA3AF') + '18' }]}>
                        <Text style={[s.methodTxt, { color: MC[item.method] || '#9CA3AF' }]}>{item.method}</Text>
                      </View>
                    </View>
                    <Text style={s.party}>{item.party}</Text>
                    <Text style={s.meta}>{item.date} · {item.time}</Text>
                  </View>
                </View>
                <Text style={s.amt}>{item.amount}</Text>
              </TouchableOpacity>
              {idx < filtered.length - 1 && <View style={s.div} />}
            </View>
          ))}
        </View>}
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
  dot:{width:9,height:9,borderRadius:5,marginTop:4}, rInfo:{flex:1,gap:3}, topR:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
  stLbl:{fontSize:TYPOGRAPHY.xs,fontWeight:'600'}, docId:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary},
  methodChip:{paddingHorizontal:6,paddingVertical:2,borderRadius:4}, methodTxt:{fontSize:10,fontWeight:'600'},
  party:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary}, meta:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary}, amt:{fontSize:TYPOGRAPHY.base,fontWeight:'700',color:COLORS.negative},
  div:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:16},
});
