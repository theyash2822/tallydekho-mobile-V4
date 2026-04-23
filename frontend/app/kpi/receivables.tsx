import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

const { width: SW } = Dimensions.get('window');

// ── Mock Data ─────────────────────────────────────────────────────────────────
const AGING_CARDS = [
  { id: 'total',  icon: 'documents-outline', label: 'Total Due', amount: '\u20b975,000',   trend: '+12%', positive: true  },
  { id: 'b1_30',  icon: 'calendar-outline',  label: '1\u201330d',  amount: '\u20b928,000',   trend: '+8%',  positive: true  },
  { id: 'b31_60', icon: 'calendar-outline',  label: '31\u201360d', amount: '\u20b922,000',   trend: '+15%', positive: true  },
  { id: 'b61_90', icon: 'calendar-outline',  label: '61\u201390d', amount: '\u20b918,000',   trend: '-5%',  positive: false },
  { id: 'b90p',   icon: 'calendar-outline',  label: '90+d',       amount: '\u20b97,000',    trend: '+20%', positive: true  },
];

const RECENT_OUTSTANDINGS = [
  { id: 'rc1578', party: 'ABC Traders',   ref: 'RC-1578', date: '10 Nov', amount: '\u20b954,000' },
  { id: 'rc1579', party: 'XYZ Retail',    ref: 'RC-1579', date: '12 Dec', amount: '\u20b954,000' },
  { id: 'rc1580', party: 'ABC Traders',   ref: 'RC-1580', date: '15 Nov', amount: '\u20b954,000' },
  { id: 'rc1581', party: 'XYZ Retail',    ref: 'RC-1581', date: '18 Dec', amount: '\u20b954,000' },
  { id: 'rc1582', party: 'Metro Infra',   ref: 'RC-1582', date: '20 Nov', amount: '\u20b942,000' },
  { id: 'rc1583', party: 'AGL Traders',   ref: 'RC-1583', date: '22 Dec', amount: '\u20b928,500' },
];

const OVERDUE_PARTIES = [
  { id: 'r1', party: 'ABC Traders',       days: '35d', amount: '\u20b93,75 K' },
  { id: 'r2', party: 'PQR Exports',       days: '42d', amount: '\u20b93,75 K' },
  { id: 'r3', party: 'XYZ Warehousing',   days: '28d', amount: '\u20b93,75 K' },
  { id: 'r4', party: 'LMN Distributors',  days: '55d', amount: '\u20b93,75 K' },
  { id: 'r5', party: 'RST Logistics',     days: '38d', amount: '\u20b93,75 K' },
  { id: 'r6', party: 'Elite Corp',        days: '45d', amount: '\u20b93,75 K' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ReceivablesScreen() {
  const router = useRouter();
  const agingRef = useRef<FlatList>(null);

  const [agingIdx,     setAgingIdx]     = useState(0);
  const [activeTab,    setActiveTab]    = useState<'recent' | 'overdue'>('recent');
  const [showDatePick, setShowDatePick] = useState(false);
  const [dateFrom,     setDateFrom]     = useState('30/09/24');
  const [dateTo,       setDateTo]       = useState('23/04/25');
  const [activeChips,  setActiveChips]  = useState<Set<string>>(new Set());

  // Auto-scroll aging carousel every 3s
  useEffect(() => {
    const timer = setInterval(() => {
      setAgingIdx(prev => {
        const next = (prev + 1) % AGING_CARDS.length;
        agingRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const toggleChip = (chip: 'overdue' | 'receipts') => {
    setActiveChips(prev => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
        if (chip === 'overdue') setActiveTab('recent');
      } else {
        next.add(chip);
        if (chip === 'overdue') setActiveTab('overdue');
      }
      return next;
    });
  };

  const fmtRange = () => {
    const fmt = (s: string) => {
      const parts = s.split('/');
      if (parts.length < 3) return s;
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${parseInt(parts[0])} ${months[parseInt(parts[1]) - 1]}`;
    };
    if (!dateFrom && !dateTo) return 'Select Range';
    if (dateFrom && !dateTo) return fmt(dateFrom);
    return `${fmt(dateFrom)} \u2013 ${fmt(dateTo)}`;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Receivables</Text>
        <View style={s.headerBtn} />
      </View>

      {/* ── Filter Row ──────────────────────────────────────────────────────── */}
      <View style={s.filterRow}>
        <TouchableOpacity style={s.dateChip} onPress={() => setShowDatePick(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={s.dateChipTxt}>{fmtRange()}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, activeChips.has('overdue') && s.filterChipActive]}
          onPress={() => toggleChip('overdue')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterChipTxt, activeChips.has('overdue') && s.filterChipActiveTxt]}>Overdue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterChip, activeChips.has('receipts') && s.filterChipActive]}
          onPress={() => toggleChip('receipts')}
          activeOpacity={0.7}
        >
          <Text style={[s.filterChipTxt, activeChips.has('receipts') && s.filterChipActiveTxt]}>Receipts</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Aging Bucket Carousel ───────────────────────────────────────── */}
        <View style={s.agingSection}>
          <FlatList
            ref={agingRef}
            horizontal pagingEnabled
            data={AGING_CARDS}
            keyExtractor={i => i.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setAgingIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
            renderItem={({ item }) => (
              <View style={s.agingItem}>
                <View style={s.agingCard}>
                  <View style={s.agingIconBox}>
                    <Ionicons name={item.icon as any} size={24} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.agingTextWrap}>
                    <Text style={s.agingLabel}>{item.label}</Text>
                    <Text style={s.agingAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                  </View>
                  <View style={[
                    s.trendBadge,
                    { backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg },
                  ]}>
                    <Ionicons
                      name={item.positive ? 'trending-up' : 'trending-down'}
                      size={11}
                      color={item.positive ? COLORS.positive : COLORS.negative}
                    />
                    <Text style={[s.trendTxt, { color: item.positive ? COLORS.positive : COLORS.negative }]}>
                      {item.trend}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
          <View style={s.dots}>
            {AGING_CARDS.map((_, i) => (
              <View key={i} style={[s.dot, i === agingIdx && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Tab Card ────────────────────────────────────────────────────── */}
        <View style={s.tabCard}>
          <View style={s.tabRow}>
            {(['recent', 'overdue'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabBtnTxt, activeTab === tab && s.tabBtnTxtActive]}>
                  {tab === 'recent' ? 'Recent Outstandings' : 'Overdue Parties'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Recent Outstandings */}
          {activeTab === 'recent' && (
            <View style={s.listWrap}>
              {RECENT_OUTSTANDINGS.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.listRow, idx < RECENT_OUTSTANDINGS.length - 1 && s.listRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push({
                    pathname: '/voucher/preview' as any,
                    params: {
                      type: 'receivable_invoice',
                      voucherNumber: item.ref,
                      date: item.date,
                      party: item.party,
                      amount: item.amount,
                      status: 'Outstanding',
                    },
                  })}
                >
                  <View style={s.partyIconBox}>
                    <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.listInfo}>
                    <View style={s.listTopRow}>
                      <Text style={s.listParty}>{item.party}</Text>
                      <Text style={s.listRef}>{` · ${item.ref}`}</Text>
                    </View>
                    <Text style={s.listDate}>{item.date}</Text>
                  </View>
                  <Text style={s.listAmount}>{item.amount}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Overdue Parties */}
          {activeTab === 'overdue' && (
            <View style={s.listWrap}>
              {OVERDUE_PARTIES.map((item, idx) => (
                <View
                  key={item.id}
                  style={[s.listRow, idx < OVERDUE_PARTIES.length - 1 && s.listRowBorder]}
                >
                  <View style={s.partyIconBox}>
                    <Ionicons name="business-outline" size={18} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.listInfo}>
                    <Text style={s.listParty}>{item.party}</Text>
                    <Text style={[s.listDate, { color: COLORS.negative }]}>{item.days} overdue</Text>
                  </View>
                  <Text style={[s.listAmount, { color: COLORS.negative }]}>{item.amount}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

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
  scroll: { paddingTop: SPACING.sm },

  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  filterRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  dateChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  dateChipTxt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  filterChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  filterChipTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  filterChipActive:  { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  filterChipActiveTxt: { color: '#FFFFFF' },

  agingSection:  { marginTop: SPACING.md, marginBottom: SPACING.sm },
  agingItem:     { width: SW },
  agingCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  agingIconBox:  { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  agingTextWrap: { flex: 1, gap: 4 },
  agingLabel:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  agingAmount:   { fontSize: TYPOGRAPHY.xl, fontWeight: '800', color: COLORS.textPrimary },
  trendBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, flexShrink: 0 },
  trendTxt:      { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  dots:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10 },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  tabCard:         { marginHorizontal: SPACING.md, marginTop: SPACING.sm, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tabRow:          { flexDirection: 'row', backgroundColor: COLORS.pageBg, margin: 4, borderRadius: RADIUS.md, padding: 3 },
  tabBtn:          { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabBtnActive:    { backgroundColor: COLORS.cardBg },
  tabBtnTxt:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabBtnTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },

  listWrap:      { paddingHorizontal: SPACING.md, paddingBottom: 8 },
  listRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  partyIconBox:  { width: 42, height: 42, borderRadius: 8, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listInfo:      { flex: 1 },
  listTopRow:    { flexDirection: 'row', alignItems: 'center' },
  listParty:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  listRef:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  listDate:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  listAmount:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 0 },
});
