import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

import { useAuth } from '../../src/context/AuthContext';
import { getVouchers } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

export default function JournalVouchersScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
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
    getVouchers(companyGuid, 'journal', selectedFY?.startDate && selectedFY?.endDate ? { from: selectedFY.startDate, to: selectedFY.endDate } : {}).then((res: any) => {
      const rows = res?.data ?? [];
      setLiveItems(rows.map((r: any) => ({ id: r.voucher_number||String(r.id), narration: r.narration||'', date: r.date||'', amount: formatAmount(Math.abs(+r.amount||0)), status: 'posted' })));
    }).catch((err: any) => { console.error('[API Error]', err?.message); setApiError(err?.message || 'Failed to load data'); }).finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY?.startDate]);

  const filtered = liveItems.filter((i: any) => !search || (i.narration||'').toLowerCase().includes(search.toLowerCase()) || (i.id||'').toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top:8,bottom:8,left:8,right:8 }}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Journal Vouchers</Text>
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
          <TextInput style={s.searchIn} placeholder="Search journal entries..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        </View>
        <View style={s.statsRow}>
          {(() => {
            const parseAmount = (amtStr: string) => { const n = parseFloat((amtStr || '0').replace(/[₹,]/g, '')); return isNaN(n) ? 0 : n; };
            const totalAmt = filtered.reduce((sum: number, i: any) => sum + parseAmount(i.amount), 0);
            const fmtAmt = (n: number) => formatAmount(Math.round(n));
            return [{l:'Total Dr/Cr',v:fmtAmt(totalAmt)},{l:'Docs',v:String(filtered.length)},{l:'Period',v:'Jan 25'},{l:'All Posted',v:'✓'}];
          })().map(st=>(
            <View key={st.l} style={s.stat}><Text style={s.statV}>{st.v}</Text><Text style={s.statL}>{st.l}</Text></View>
          ))}
        </View>
        <View style={s.secHdr}><Text style={s.secT}>Journal Entries</Text></View>
        <View style={s.card}>
          {filtered.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                style={s.row}
                activeOpacity={0.7}
                onPress={() => router.push(`/document/${item.id}?type=journal_voucher` as any)}
              >
                <View style={[s.iconBox, { backgroundColor: COLORS.infoBg }]}>
                  <Ionicons name="book-outline" size={18} color={COLORS.info} />
                </View>
                <View style={s.rInfo}>
                  <View style={s.topR}>
                    <Text style={s.docId}>{item.id}</Text>
                    <View style={s.postedChip}><Text style={s.postedTxt}>Posted</Text></View>
                  </View>
                  <Text style={s.narration} numberOfLines={2}>{item.narration}</Text>
                  <Text style={s.meta}>{item.date} · {item.time}</Text>
                </View>
                <View style={s.drCr}>
                  <Text style={s.drTxt}>Dr {item.debit}</Text>
                  <Text style={s.crTxt}>Cr {item.credit}</Text>
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
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:SPACING.md,paddingVertical:14,gap:12},
  iconBox:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'}, rInfo:{flex:1,gap:3}, topR:{flexDirection:'row',alignItems:'center',gap:8},
  docId:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary}, postedChip:{backgroundColor:COLORS.positiveBg,paddingHorizontal:6,paddingVertical:2,borderRadius:4}, postedTxt:{fontSize:10,fontWeight:'600',color:COLORS.positive},
  narration:{fontSize:TYPOGRAPHY.sm,fontWeight:'500',color:COLORS.textPrimary}, meta:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
  drCr:{alignItems:'flex-end',gap:3}, drTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.negative}, crTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'600',color:COLORS.positive},
  div:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:16},
});
