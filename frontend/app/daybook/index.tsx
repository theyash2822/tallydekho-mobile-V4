import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const DAYBOOK_TYPE_MAP: Record<string, string> = {
  Sales:    'sales_invoice',
  Purchase: 'purchase_invoice',
  Payment:  'payment_voucher',
  Receipt:  'receipt_voucher',
  Journal:  'journal_voucher',
  Contra:   'contra_voucher',
};

type ViewMode = 'daybook' | 'myentries';
type VType = 'ALL' | 'Sales' | 'Purchase' | 'Payment' | 'Receipt' | 'Journal' | 'Contra';

const VTYPES: VType[] = ['ALL', 'Sales', 'Purchase', 'Payment', 'Receipt', 'Journal', 'Contra'];

interface Entry {
  id: string; date: string; month: string; type: VType;
  party: string; ref: string; amount: string;
  isCredit: boolean; status: 'posted' | 'pending'; isMine: boolean;
}

const ENTRIES: Entry[] = [
  { id:'e1', date:'15 Jun', month:'Jun 25', type:'Sales', party:'ABC Traders', ref:'INV-30979', amount:'₹42,500', isCredit:false, status:'posted', isMine:true },
  { id:'e2', date:'15 Jun', month:'Jun 25', type:'Purchase', party:'PQR Exports', ref:'PO-00124', amount:'₹28,000', isCredit:true, status:'posted', isMine:false },
  { id:'e3', date:'14 Jun', month:'Jun 25', type:'Payment', party:'Kumar & Sons', ref:'PV-00081', amount:'₹15,000', isCredit:true, status:'posted', isMine:true },
  { id:'e4', date:'14 Jun', month:'Jun 25', type:'Receipt', party:'XYZ Retail', ref:'RV-00062', amount:'₹33,200', isCredit:false, status:'posted', isMine:true },
  { id:'e5', date:'13 Jun', month:'Jun 25', type:'Journal', party:'Capital A/c', ref:'JV-00015', amount:'₹5,000', isCredit:true, status:'pending', isMine:true },
  { id:'e6', date:'13 Jun', month:'Jun 25', type:'Sales', party:'Sharma Electronics', ref:'INV-30978', amount:'₹18,750', isCredit:false, status:'posted', isMine:false },
  { id:'e7', date:'12 Jun', month:'Jun 25', type:'Contra', party:'HDFC → SBI', ref:'CV-00008', amount:'₹50,000', isCredit:false, status:'posted', isMine:true },
  { id:'e8', date:'10 Jun', month:'Jun 25', type:'Purchase', party:'Delhi Suppliers', ref:'PO-00123', amount:'₹62,400', isCredit:true, status:'pending', isMine:false },
  { id:'e9', date:'05 May', month:'May 25', type:'Sales', party:'Raj Enterprises', ref:'INV-30950', amount:'₹27,300', isCredit:false, status:'posted', isMine:true },
  { id:'e10', date:'02 May', month:'May 25', type:'Payment', party:'Indian Export House', ref:'PV-00070', amount:'₹44,000', isCredit:true, status:'posted', isMine:false },
];

const TYPE_COLORS: Record<string,string> = {
  Sales: COLORS.positive, Purchase: COLORS.info, Payment: COLORS.negative,
  Receipt: COLORS.positive, Journal: COLORS.warning, Contra: '#7C3AED',
};

export default function DaybookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<ViewMode>('daybook');
  const [vType, setVType] = useState<VType>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(false);

  const filtered = useMemo(() => {
    let arr = mode === 'myentries' ? ENTRIES.filter(e => e.isMine) : ENTRIES;
    if (vType !== 'ALL') arr = arr.filter(e => e.type === vType);
    if (search) arr = arr.filter(e =>
      e.party.toLowerCase().includes(search.toLowerCase()) ||
      e.ref.toLowerCase().includes(search.toLowerCase())
    );
    return arr;
  }, [mode, vType, search]);

  // Group by month
  const grouped = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    filtered.forEach(e => {
      if (!map[e.month]) map[e.month] = [];
      map[e.month].push(e);
    });
    return Object.entries(map);
  }, [filtered]);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  };

  const handlePush = () => {
    if (selected.length === 0) return;
    setSelected([]);
    setMultiSelect(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{mode === 'myentries' ? 'My Entries' : 'Day Book'}</Text>
        <TouchableOpacity style={s.filterBtn}>
          <Ionicons name="options-outline" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={s.modeRow}>
        {(['daybook','myentries'] as ViewMode[]).map(m => (
          <TouchableOpacity key={m} style={[s.modeBtn, mode===m && s.modeBtnActive]} onPress={()=>{setMode(m);setSelected([]);setMultiSelect(false);}} activeOpacity={0.7}>
            <Text style={[s.modeTxt, mode===m && s.modeTxtActive]}>{m==='daybook'?'Day Book':'My Entries'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Voucher Type Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
        {VTYPES.map(vt=>(
          <TouchableOpacity key={vt} style={[s.typeChip, vType===vt && s.typeChipActive]} onPress={()=>setVType(vt)} activeOpacity={0.7}>
            <Text style={[s.typeChipTxt, vType===vt && s.typeChipTxtActive]}>{vt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={COLORS.textTertiary} />
        <TextInput style={s.searchIn} placeholder="Search party, reference..." placeholderTextColor={COLORS.textTertiary} value={search} onChangeText={setSearch} />
        {search.length>0 && <TouchableOpacity onPress={()=>setSearch('')}><Ionicons name="close-circle" size={16} color={COLORS.textTertiary} /></TouchableOpacity>}
      </View>

      {/* Multi-select action bar */}
      {multiSelect && selected.length > 0 && mode === 'myentries' && (
        <View style={s.actionBar}>
          <Text style={s.actionTxt}>{selected.length} selected</Text>
          <TouchableOpacity style={s.pushBtn} onPress={handlePush} activeOpacity={0.8}>
            <Ionicons name="cloud-upload-outline" size={16} color={COLORS.white} />
            <Text style={s.pushTxt}>Push to Tally</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: Math.max(insets.bottom,20)+16}} keyboardShouldPersistTaps="handled">
        {grouped.map(([month, entries]) => (
          <View key={month}>
            {/* Month header */}
            <View style={s.monthHdr}>
              <Text style={s.monthTxt}>{month}</Text>
              <View style={s.monthLine} />
            </View>
            {/* Entries */}
            <View style={s.card}>
              {entries.map((entry, idx) => {
                const isSel = selected.includes(entry.id);
                const tc = TYPE_COLORS[entry.type] || COLORS.textSecondary;
                return (
                  <View key={entry.id}>
                    <TouchableOpacity
                      style={[s.row, isSel && s.rowSelected]}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (multiSelect) {
                          toggleSelect(entry.id);
                        } else {
                          const docType = DAYBOOK_TYPE_MAP[entry.type] || 'sales_invoice';
                          router.push(`/document/${entry.ref}?type=${docType}` as any);
                        }
                      }}
                      onLongPress={() => { if (mode==='myentries') { setMultiSelect(true); toggleSelect(entry.id); } }}
                    >
                      {multiSelect && mode==='myentries' && (
                        <View style={[s.checkbox, isSel && s.checkboxActive]}>
                          {isSel && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                        </View>
                      )}
                      <View style={[s.typeIcon, {backgroundColor: tc+'15'}]}>
                        <Ionicons name={entry.isCredit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={18} color={tc} />
                      </View>
                      <View style={s.entryInfo}>
                        <View style={s.entryTop}>
                          <View style={[s.vTypePill, {backgroundColor: tc+'18'}]}>
                            <Text style={[s.vTypeTxt, {color:tc}]}>{entry.type}</Text>
                          </View>
                          <Text style={s.refTxt}>{entry.ref}</Text>
                          {entry.status === 'pending' && (
                            <View style={s.pendingBadge}><Text style={s.pendingTxt}>Pending</Text></View>
                          )}
                        </View>
                        <Text style={s.partyTxt}>{entry.party}</Text>
                        <Text style={s.dateTxt}>{entry.date}</Text>
                      </View>
                      <View style={s.amtCol}>
                        <Text style={[s.amtTxt, {color: entry.isCredit ? COLORS.negative : COLORS.positive}]}>{entry.amount}</Text>
                        <Text style={[s.drCrTxt, {color: entry.isCredit ? COLORS.negative : COLORS.positive}]}>{entry.isCredit?'Cr':'Dr'}</Text>
                      </View>
                    </TouchableOpacity>
                    {idx < entries.length-1 && <View style={s.divider} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
        {filtered.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.borderStrong} />
            <Text style={s.emptyTxt}>No entries found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.pageBg},
  header:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,paddingHorizontal:SPACING.md,paddingVertical:14,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:COLORS.pageBg,alignItems:'center',justifyContent:'center'},
  headerTitle:{flex:1,fontSize:TYPOGRAPHY.md,fontWeight:'700',color:COLORS.textPrimary},
  filterBtn:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  modeRow:{flexDirection:'row',backgroundColor:COLORS.cardBg,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  modeBtn:{flex:1,paddingVertical:12,alignItems:'center',borderBottomWidth:2,borderBottomColor:'transparent'},
  modeBtnActive:{borderBottomColor:COLORS.brandPrimary},
  modeTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'500',color:COLORS.textSecondary},
  modeTxtActive:{fontWeight:'700',color:COLORS.textPrimary},
  typeScroll:{backgroundColor:COLORS.cardBg,borderBottomWidth:1,borderBottomColor:COLORS.borderDefault},
  typeRow:{flexDirection:'row',gap:8,paddingHorizontal:SPACING.md,paddingVertical:10},
  typeChip:{paddingHorizontal:12,paddingVertical:7,borderRadius:RADIUS.full,backgroundColor:COLORS.pageBg,borderWidth:1,borderColor:COLORS.borderDefault},
  typeChipActive:{backgroundColor:COLORS.brandPrimary,borderColor:COLORS.brandPrimary},
  typeChipTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.textSecondary,fontWeight:'500'},
  typeChipTxtActive:{color:COLORS.white,fontWeight:'700'},
  searchBox:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.cardBg,marginHorizontal:SPACING.md,marginTop:SPACING.md,paddingHorizontal:14,paddingVertical:11,borderRadius:RADIUS.md,borderWidth:1,borderColor:COLORS.borderDefault},
  searchIn:{flex:1,fontSize:TYPOGRAPHY.base,color:COLORS.textPrimary},
  actionBar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#1A1A1A',paddingHorizontal:SPACING.md,paddingVertical:12,marginHorizontal:SPACING.md,marginTop:SPACING.sm,borderRadius:RADIUS.md},
  actionTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.white,fontWeight:'600'},
  pushBtn:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:COLORS.positive,paddingHorizontal:14,paddingVertical:8,borderRadius:RADIUS.md},
  pushTxt:{fontSize:TYPOGRAPHY.sm,color:COLORS.white,fontWeight:'700'},
  monthHdr:{flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:SPACING.md,marginTop:SPACING.lg,marginBottom:SPACING.sm},
  monthTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'700',color:COLORS.textSecondary},
  monthLine:{flex:1,height:1,backgroundColor:COLORS.borderDefault},
  card:{backgroundColor:COLORS.cardBg,marginHorizontal:SPACING.md,borderRadius:RADIUS.lg,borderWidth:1,borderColor:COLORS.borderDefault,overflow:'hidden'},
  row:{flexDirection:'row',alignItems:'center',paddingHorizontal:SPACING.md,paddingVertical:13,gap:12},
  rowSelected:{backgroundColor:COLORS.infoBg},
  checkbox:{width:22,height:22,borderRadius:11,borderWidth:2,borderColor:COLORS.borderStrong,alignItems:'center',justifyContent:'center'},
  checkboxActive:{backgroundColor:COLORS.info,borderColor:COLORS.info},
  typeIcon:{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},
  entryInfo:{flex:1,gap:3},
  entryTop:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
  vTypePill:{paddingHorizontal:7,paddingVertical:2,borderRadius:RADIUS.sm},
  vTypeTxt:{fontSize:10,fontWeight:'700'},
  refTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textSecondary},
  pendingBadge:{backgroundColor:COLORS.warningBg,paddingHorizontal:6,paddingVertical:2,borderRadius:RADIUS.sm},
  pendingTxt:{fontSize:10,fontWeight:'600',color:COLORS.warning},
  partyTxt:{fontSize:TYPOGRAPHY.sm,fontWeight:'600',color:COLORS.textPrimary},
  dateTxt:{fontSize:TYPOGRAPHY.xs,color:COLORS.textTertiary},
  amtCol:{alignItems:'flex-end',gap:2},
  amtTxt:{fontSize:TYPOGRAPHY.base,fontWeight:'700'},
  drCrTxt:{fontSize:TYPOGRAPHY.xs,fontWeight:'600'},
  divider:{height:1,backgroundColor:COLORS.borderDefault,marginLeft:60},
  empty:{alignItems:'center',paddingVertical:60,gap:12},
  emptyTxt:{fontSize:TYPOGRAPHY.base,color:COLORS.textSecondary},
});
