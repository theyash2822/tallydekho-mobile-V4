import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

// ── Mock Data ────────────────────────────────────────────────────────────────
type TxType = 'payment' | 'receipt' | 'contra';

interface TxItem {
  id: string; voucher: string; desc: string; date: string;
  amount: string; positive: boolean; type: TxType;
}
interface MonthGroup { id: string; label: string; items: TxItem[] }

const MONTH_GROUPS: MonthGroup[] = [
  {
    id: 'jul25', label: 'Jul 2025',
    items: [
      { id: 't1',  voucher: 'DEP-114',  desc: 'Payment to SBI',        date: '10 Jul', amount: '₹15,000', positive: false, type: 'payment'  },
      { id: 't2',  voucher: 'DEP-113',  desc: 'Deposit to ICICI Bank',  date: '10 Jul', amount: '₹15,000', positive: false, type: 'contra'   },
      { id: 't3',  voucher: 'DEP-112',  desc: 'Transfer to Axis Bank',  date: '10 Jul', amount: '₹15,000', positive: false, type: 'contra'   },
      { id: 't4',  voucher: 'RC-1452',  desc: 'Cash Sales',             date: '10 Jul', amount: '₹8,000',  positive: true,  type: 'receipt'  },
      { id: 't5',  voucher: 'PMT-3491', desc: 'Taxi Reimburse',         date: '10 Jul', amount: '₹1,200',  positive: false, type: 'payment'  },
      { id: 't6',  voucher: 'RC-1453',  desc: 'Cash Sales',             date: '11 Jul', amount: '₹8,000',  positive: true,  type: 'receipt'  },
      { id: 't7',  voucher: 'RC-1454',  desc: 'Cash Sales',             date: '12 Jul', amount: '₹12,500', positive: true,  type: 'receipt'  },
      { id: 't8',  voucher: 'PMT-3493', desc: 'Office Expense',         date: '12 Jul', amount: '₹3,500',  positive: false, type: 'payment'  },
      { id: 't9',  voucher: 'RC-1455',  desc: 'Cash Sales',             date: '13 Jul', amount: '₹18,000', positive: true,  type: 'receipt'  },
      { id: 't10', voucher: 'PMT-3494', desc: 'Vendor Payment',         date: '13 Jul', amount: '₹5,400',  positive: false, type: 'payment'  },
    ],
  },
  {
    id: 'jun25', label: 'Jun 2025',
    items: [
      { id: 't11', voucher: 'RC-1448',  desc: 'Cash Sales',             date: '28 Jun', amount: '₹22,000', positive: true,  type: 'receipt'  },
      { id: 't12', voucher: 'PMT-3485', desc: 'Electricity Bill',       date: '28 Jun', amount: '₹4,200',  positive: false, type: 'payment'  },
      { id: 't13', voucher: 'DEP-108',  desc: 'Transfer to SBI',        date: '25 Jun', amount: '₹20,000', positive: false, type: 'contra'   },
      { id: 't14', voucher: 'RC-1445',  desc: 'Cash Sales',             date: '20 Jun', amount: '₹15,500', positive: true,  type: 'receipt'  },
    ],
  },
  {
    id: 'may25', label: 'May 2025',
    items: [
      { id: 't15', voucher: 'RC-1440',  desc: 'Cash Sales',             date: '30 May', amount: '₹18,200', positive: true,  type: 'receipt'  },
      { id: 't16', voucher: 'PMT-3478', desc: 'Staff Salary',           date: '31 May', amount: '₹35,000', positive: false, type: 'payment'  },
      { id: 't17', voucher: 'DEP-102',  desc: 'Deposit to HDFC',        date: '15 May', amount: '₹25,000', positive: false, type: 'contra'   },
    ],
  },
];

const MONTH_TABS = ['All', ...MONTH_GROUPS.map(g => g.id)];
const MONTH_LABELS: Record<string, string> = {
  all: 'All', jul25: 'Jul', jun25: 'Jun', may25: 'May',
};

type FilterType = 'all' | 'inflow' | 'outflow';

// ── Component ────────────────────────────────────────────────────────────────
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

  const allItems = MONTH_GROUPS.flatMap(g => g.items);
  const inflowTotal  = allItems.filter(i => i.positive).reduce((a, i) => a + parseFloat(i.amount.replace(/[^0-9.]/g, '')), 0);
  const outflowTotal = allItems.filter(i => !i.positive).reduce((a, i) => a + parseFloat(i.amount.replace(/[^0-9.]/g, '')), 0);

  const fmtAmt = (v: number) => {
    if (v >= 100000) return `\u20b9${(v / 100000).toFixed(2)}L`;
    if (v >= 1000)   return `\u20b9${(v / 1000).toFixed(0)}K`;
    return `\u20b9${v}`;
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const filteredGroups = MONTH_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(item => {
        const matchType =
          typeFilter === 'all'     ? true :
          typeFilter === 'inflow'  ? item.positive :
                                     !item.positive;
        const matchSearch =
          !search ||
          item.desc.toLowerCase().includes(search.toLowerCase()) ||
          item.voucher.toLowerCase().includes(search.toLowerCase());
        return matchType && matchSearch;
      }),
    }))
    .filter(g => g.items.length > 0);

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

      {/* ── Date Range Row (centered) ──────────────────────────────────────── */}
      <View style={s.dateRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt} numberOfLines={1}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
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
              {(['all', 'inflow', 'outflow'] as FilterType[]).map((opt, idx) => (
                <TouchableOpacity
                  key={opt}
                  style={[s.dropItem, typeFilter === opt && s.dropItemActive, idx === 2 && { borderBottomWidth: 0 }]}
                  onPress={() => { setTypeFilter(opt); setShowTypeMenu(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dropTxt, typeFilter === opt && s.dropTxtActive]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                  {typeFilter === opt && <Ionicons name="checkmark" size={14} color={COLORS.brandPrimary} />}
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
          placeholder="Search transactions..."
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={s.list}
        onStartShouldSetResponder={() => { if (showTypeMenu) setShowTypeMenu(false); return false; }}
      >
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
            <Text style={s.emptyTxt}>No transactions found</Text>
          </View>
        ) : (
          filteredGroups.map(group => (
            <View key={group.id} style={s.groupWrap}>
              {/* Month Section Header */}
              <View style={s.monthHeader}>
                <View style={s.monthDot} />
                <Text style={s.monthHeaderLabel}>{group.label}</Text>
                <Text style={s.monthHeaderCount}>{group.items.length} entries</Text>
              </View>

              {/* Transaction Cards */}
              <View style={s.cardGroup}>
                {group.items.map((item, idx) => {
                  const isSel = selected.has(item.id);
                  const typeColor  = item.type === 'receipt' ? COLORS.positive : item.type === 'contra' ? '#A89060' : COLORS.negative;
                  const typeLabel  = item.type === 'receipt' ? 'Cr' : 'Dr';
                  const typeBg     = item.type === 'receipt' ? COLORS.positiveBg : item.type === 'contra' ? '#FDF9F4' : COLORS.negativeBg;

                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        style={[s.itemCard, isSel && s.itemCardSel]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (selected.size > 0) {
                            toggleSelect(item.id);
                          } else {
                            router.push({
                              pathname: '/voucher/preview' as any,
                              params: {
                                type: item.type,
                                voucherNumber: item.voucher,
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
                        {/* Avatar Circle */}
                        <View style={[s.avatar, isSel && s.avatarSel]}>
                          {isSel
                            ? <Ionicons name="checkmark" size={16} color="#fff" />
                            : <Text style={s.avatarTxt}>{item.desc.charAt(0).toUpperCase()}</Text>
                          }
                        </View>

                        {/* Info */}
                        <View style={s.itemInfo}>
                          <Text style={s.itemDesc} numberOfLines={1}>{item.desc}</Text>
                          <Text style={s.itemMeta}>{item.voucher} · {item.date}</Text>
                        </View>

                        {/* Right: Amount + Cr/Dr badge */}
                        <View style={s.itemRight}>
                          <Text style={[s.itemAmt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
                            {item.positive ? '+' : '-'}{item.amount}
                          </Text>
                          <View style={[s.crDrBadge, { backgroundColor: typeBg }]}>
                            <Text style={[s.crDrTxt, { color: typeColor }]}>{typeLabel}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                      {idx < group.items.length - 1 && <View style={s.divider} />}
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

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  // Date row: centered date pill + type button on right
  dateRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, gap: 8, zIndex: 200, elevation: 200 },
  dateChip:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  typeWrap:    { position: 'relative', zIndex: 201 },
  typeChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  typeChipTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  typeChipActive:    { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  typeChipActiveTxt: { color: '#fff' },
  dropdown:    { position: 'absolute', right: 0, top: 48, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, zIndex: 999, minWidth: 130, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  dropItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dropItemActive: { backgroundColor: COLORS.pageBg },
  dropTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  dropTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },

  // Month chips
  monthRow:    { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  monthScroll: { paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8 },
  monthChip:   { paddingHorizontal: 16, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  monthChipActive:  { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  monthChipTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  monthChipTxtActive: { color: '#fff' },

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

  // Month section
  groupWrap:        { paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  monthHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4 },
  monthDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  monthHeaderLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  monthHeaderCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Ledger-style card group
  cardGroup:  { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  itemCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14 },
  itemCardSel:{ backgroundColor: '#A8906010' },

  // Avatar circle (like Ledger tab)
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSel:  { backgroundColor: COLORS.textPrimary },
  avatarTxt:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: '#fff' },

  itemInfo:   { flex: 1, gap: 3 },
  itemDesc:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  itemRight:  { alignItems: 'flex-end', gap: 6 },
  itemAmt:    { fontSize: TYPOGRAPHY.base, fontWeight: '800' },

  // Cr/Dr badge (like Ledger)
  crDrBadge:  { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  crDrTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  divider:    { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: SPACING.md + 40 + 12 },

  shareBtnWrap: { paddingHorizontal: SPACING.md, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  shareBtn:     { backgroundColor: '#1A1A1A', borderRadius: RADIUS.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareBtnTxt:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
