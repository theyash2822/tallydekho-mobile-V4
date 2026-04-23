import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

// ── Mock Data ───────────────────────────────────────────────────────────────
type TxType = 'payment' | 'receipt' | 'contra';
const GROUPED_TXN = [
  { group: 'DEP-114',  items: [{ id: 't1', desc: 'Payment to SBI',        date: '10 Jul', amount: '₹15,000',  positive: false, type: 'payment' as TxType }] },
  { group: 'DEP-113',  items: [{ id: 't2', desc: 'Deposit to ICICI Bank',  date: '10 Jul', amount: '₹15,000',  positive: false, type: 'contra'  as TxType }] },
  { group: 'DEP-112',  items: [{ id: 't3', desc: 'Transfer to Axis Bank',  date: '10 Jul', amount: '₹15,000',  positive: false, type: 'contra'  as TxType }] },
  { group: 'RC-1452',  items: [{ id: 't4', desc: 'Cash Sales',             date: '10 Jul', amount: '₹8,000',   positive: true,  type: 'receipt' as TxType }] },
  { group: 'PMT-3491', items: [{ id: 't5', desc: 'Taxi Reimburse',         date: '10 Jul', amount: '₹1,200',   positive: false, type: 'payment' as TxType }] },
  { group: 'RC-1453',  items: [{ id: 't6', desc: 'Cash Sales',             date: '11 Jul', amount: '₹8,000',   positive: true,  type: 'receipt' as TxType }] },
  { group: 'RC-1454',  items: [{ id: 't7', desc: 'Cash Sales',             date: '12 Jul', amount: '₹12,500',  positive: true,  type: 'receipt' as TxType }] },
  { group: 'PMT-3493', items: [{ id: 't8', desc: 'Office Expense',         date: '12 Jul', amount: '₹3,500',   positive: false, type: 'payment' as TxType }] },
  { group: 'RC-1455',  items: [{ id: 't9', desc: 'Cash Sales',             date: '13 Jul', amount: '₹18,000',  positive: true,  type: 'receipt' as TxType }] },
  { group: 'PMT-3494', items: [{ id: 't10', desc: 'Vendor Payment',        date: '13 Jul', amount: '₹5,400',   positive: false, type: 'payment' as TxType }] },
];

type FilterType = 'all' | 'inflow' | 'outflow';

// ── Component ───────────────────────────────────────────────────────────────
export default function CashRegisterScreen() {
  const router = useRouter();
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState<FilterType>('all');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom,     setDateFrom]     = useState('31/03/25');
  const [dateTo,       setDateTo]       = useState('23/04/25');
  const [selected,     setSelected]     = useState<Set<string>>(new Set());

  const fmtRange = () => {
    const fmt = (s: string) => {
      const p = s.split('/');
      if (p.length < 3) return s;
      const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${parseInt(p[0])} ${m[parseInt(p[1]) - 1]}`;
    };
    return `${fmt(dateFrom)} \u2013 ${fmt(dateTo)}`;
  };

  const filteredGroups = GROUPED_TXN.filter(g => {
    const matchType =
      typeFilter === 'all'    ? true :
      typeFilter === 'inflow' ? g.items.some(i => i.positive) :
                                g.items.some(i => !i.positive);
    const matchSearch =
      !search ||
      g.group.toLowerCase().includes(search.toLowerCase()) ||
      g.items.some(i => i.desc.toLowerCase().includes(search.toLowerCase()));
    return matchType && matchSearch;
  });

  const inflowTotal  = GROUPED_TXN.flatMap(g => g.items).filter(i => i.positive).reduce((a, i) => a + parseFloat(i.amount.replace(/[^0-9.]/g, '')), 0);
  const outflowTotal = GROUPED_TXN.flatMap(g => g.items).filter(i => !i.positive).reduce((a, i) => a + parseFloat(i.amount.replace(/[^0-9.]/g, '')), 0);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fmtAmt = (v: number) => {
    if (v >= 100000) return `\u20b9${(v/100000).toFixed(2)}L`;
    if (v >= 1000)   return `\u20b9${(v/1000).toFixed(0)}K`;
    return `\u20b9${v}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Cash Register</Text>
        <View style={s.headerBtn} />
      </View>

      {/* Filter Row */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt} numberOfLines={1}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={12} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={s.typeWrap}>
          <TouchableOpacity
            style={[s.typeChip, showTypeMenu && s.typeChipActive]}
            onPress={() => setShowTypeMenu(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={[s.typeChipTxt, showTypeMenu && s.typeChipActiveTxt]}>
              {typeFilter === 'all' ? 'Type' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
            </Text>
            <Ionicons
              name={showTypeMenu ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={showTypeMenu ? '#fff' : COLORS.textSecondary}
            />
          </TouchableOpacity>
          {showTypeMenu && (
            <View style={s.dropdown}>
              {(['all', 'inflow', 'outflow'] as FilterType[]).map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.dropItem, typeFilter === opt && s.dropItemActive, opt === 'outflow' && { borderBottomWidth: 0 }]}
                  onPress={() => { setTypeFilter(opt); setShowTypeMenu(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropTxt, typeFilter === opt && s.dropTxtActive]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search"
          placeholderTextColor={COLORS.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Inflow / Outflow Summary */}
      <View style={s.summaryRow}>
        <View style={s.summaryItem}>
          <Text style={s.summaryLbl}>Inflow</Text>
          <Text style={[s.summaryVal, { color: COLORS.positive }]}>+{fmtAmt(inflowTotal)}</Text>
        </View>
        <View style={s.summaryDivider} />
        <View style={s.summaryItem}>
          <Text style={s.summaryLbl}>Outflow</Text>
          <Text style={[s.summaryVal, { color: COLORS.negative }]}>-{fmtAmt(outflowTotal)}</Text>
        </View>
      </View>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} style={s.list} onStartShouldSetResponder={() => { if (showTypeMenu) { setShowTypeMenu(false); } return false; }}>
        <View style={s.listHeader}>
          <Text style={s.listTitle}>List Transactions</Text>
          <TouchableOpacity
            style={s.pdfBtn}
            onPress={() => setSelected(new Set(filteredGroups.flatMap(g => g.items.map(i => i.id))))}
            activeOpacity={0.7}
          >
            <Text style={s.pdfTxt}>Share PDF</Text>
            <Ionicons name="share-outline" size={14} color={'#A89060'} />
          </TouchableOpacity>
        </View>

        {filteredGroups.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="document-outline" size={48} color={COLORS.borderDefault} />
            <Text style={s.emptyTxt}>No vouchers found</Text>
          </View>
        ) : (
          filteredGroups.map(group => (
            <View key={group.group} style={s.groupWrap}>
              <Text style={s.groupLabel}>{group.group}</Text>
              <View style={s.listCard}>
                {group.items.map((item, idx) => {
                  const isSel = selected.has(item.id);
                  const typeColor = item.type === 'receipt' ? '#2D7D46' : item.type === 'contra' ? '#A89060' : '#DC2626';
                  const typeBg    = item.type === 'receipt' ? '#F0FBF4' : item.type === 'contra' ? '#FDF9F4' : '#FFF0F0';
                  const typeLabel = item.type === 'receipt' ? 'Receipt' : item.type === 'contra' ? 'Contra' : 'Payment';
                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        style={[s.txRow, isSel && s.txRowSel]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (selected.size > 0) {
                            toggleSelect(item.id);
                          } else {
                            router.push({
                              pathname: '/voucher/preview' as any,
                              params: {
                                type: item.type,
                                voucherNumber: group.group,
                                date: `${item.date} 2025`,
                                mode: 'Cash In Hand',
                                paidTo: item.desc,
                                receivedFrom: item.desc,
                                amount: item.amount,
                                narration: '\u2014',
                              },
                            });
                          }
                        }}
                        onLongPress={() => toggleSelect(item.id)}
                      >
                        {/* Status dot */}
                        <View style={[s.statusDot, { backgroundColor: typeColor }]} />
                        <View style={s.txInfo}>
                          <View style={s.txTopRow}>
                            <View style={[s.typePill, { backgroundColor: typeBg, borderColor: typeColor }]}>
                              <Text style={[s.typePillTxt, { color: typeColor }]}>{typeLabel}</Text>
                            </View>
                          </View>
                          <Text style={s.txDesc}>{item.desc}</Text>
                          <Text style={s.txDate}>{item.date}</Text>
                        </View>
                        <Text style={[s.txAmt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
                          {item.positive ? '+' : '-'}{item.amount}
                        </Text>
                        {isSel && <Ionicons name="checkmark-circle" size={20} color={'#A89060'} style={{ marginLeft: 6 }} />}
                      </TouchableOpacity>
                      {idx < group.items.length - 1 && <View style={s.txDivider} />}
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Share Button (multi-select mode) */}
      {selected.size > 0 && (
        <View style={s.shareBtnWrap}>
          <TouchableOpacity
            style={s.shareBtn}
            onPress={() => setSelected(new Set())}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareBtnTxt}>Share ({selected.size} selected)</Text>
          </TouchableOpacity>
        </View>
      )}

      <DateRangePickerModal
        visible={showDatePick}
        fromDate={dateFrom}
        toDate={dateTo}
        onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
        onClose={() => setShowDatePick(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  filterRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, zIndex: 200, elevation: 200 },
  dateChip:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  typeWrap:    { position: 'relative', zIndex: 201 },
  typeChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  typeChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  typeChipActive:    { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  typeChipActiveTxt: { color: '#fff' },
  dropdown:    { position: 'absolute', right: 0, top: 44, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, zIndex: 999, minWidth: 120, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  dropItem:    { paddingHorizontal: SPACING.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropItemActive: { backgroundColor: COLORS.pageBg },
  dropTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },

  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  searchInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },

  summaryRow:     { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  summaryItem:    { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: 14, alignItems: 'center' },
  summaryLbl:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 4 },
  summaryVal:     { fontSize: TYPOGRAPHY.base, fontWeight: '800' },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderDefault, marginVertical: 10 },

  list:       { flex: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14 },
  listTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  pdfBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pdfTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: '#A89060' },
  emptyWrap:  { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  groupWrap:  { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  groupLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  listCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  txRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  txRowSel:   { backgroundColor: '#A8906012' },
  statusDot:  { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 2 },
  txInfo:     { flex: 1, gap: 3 },
  txTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typePill:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  typePillTxt:{ fontSize: 10, fontWeight: '700' },
  txDesc:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txDate:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  txAmt:      { fontSize: TYPOGRAPHY.sm, fontWeight: '800', flexShrink: 0 },
  txDivider:  { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md },

  shareBtnWrap: { paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  shareBtn:     { backgroundColor: '#1A1A1A', borderRadius: RADIUS.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareBtnTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
