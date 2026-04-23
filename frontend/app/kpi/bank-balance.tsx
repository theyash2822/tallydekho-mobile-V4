import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const { width: SW } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────
const KPI_DATA = [
  { id: 'total',   icon: 'wallet-outline',              label: 'Total Balance',  amount: '₹23,25,000', trend: '+12%',  positive: true  },
  { id: 'inflow',  icon: 'arrow-down-circle-outline',   label: 'Inflow Today',   amount: '₹1,25,000',  trend: '+6.8%', positive: true  },
  { id: 'outflow', icon: 'arrow-up-circle-outline',     label: 'Outflow Today',  amount: '₹74,000',    trend: '+9.1%', positive: false },
];

const BANKS = [
  {
    id: 'hdfc',
    name: 'HDFC Bank',
    account: 'CA-1234',
    balance: '₹11,25,000',
    lastFeed: '10 Jun 2025',
    gradient: ['#1B5E40', '#0D3B2E'] as const,
    transactions: [
      { id: 'HDFC-CH-778',   date: 'Jun 10', amount: '75,000', type: 'Dr' },
      { id: 'HDFC-DEP-009',  date: '9 Jun',  amount: '30,000', type: 'Cr' },
      { id: 'HDFC-RTGS-778', date: '08 Jun', amount: '75,000', type: 'Cr' },
      { id: 'HDFC-UPI-779',  date: '08 Jun', amount: '45,000', type: 'Cr' },
      { id: 'HDFC-NEFT-780', date: '07 Jun', amount: '25,000', type: 'Dr' },
    ],
  },
  {
    id: 'sbi',
    name: 'SBI Bank',
    account: 'SB-5678',
    balance: '₹7,50,000',
    lastFeed: '09 Jun 2025',
    gradient: ['#1B3A5E', '#0D2040'] as const,
    transactions: [
      { id: 'SBI-CH-456',   date: 'Jun 10', amount: '50,000', type: 'Dr' },
      { id: 'SBI-DEP-123',  date: '9 Jun',  amount: '20,000', type: 'Cr' },
      { id: 'SBI-RTGS-456', date: '08 Jun', amount: '60,000', type: 'Cr' },
      { id: 'SBI-IMPS-789', date: '08 Jun', amount: '35,000', type: 'Cr' },
      { id: 'SBI-NEFT-012', date: '07 Jun', amount: '15,000', type: 'Dr' },
    ],
  },
  {
    id: 'icici',
    name: 'ICICI Bank',
    account: 'IC-9012',
    balance: '₹4,50,000',
    lastFeed: '08 Jun 2025',
    gradient: ['#3D1A5E', '#200D40'] as const,
    transactions: [
      { id: 'ICICI-CH-234',   date: 'Jun 10', amount: '40,000', type: 'Dr' },
      { id: 'ICICI-DEP-567',  date: '9 Jun',  amount: '25,000', type: 'Cr' },
      { id: 'ICICI-RTGS-890', date: '08 Jun', amount: '55,000', type: 'Cr' },
      { id: 'ICICI-UPI-123',  date: '08 Jun', amount: '30,000', type: 'Cr' },
      { id: 'ICICI-NEFT-456', date: '07 Jun', amount: '20,000', type: 'Dr' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function BankBalanceScreen() {
  const router  = useRouter();
  const kpiRef  = useRef<FlatList>(null);
  const [kpiIdx,  setKpiIdx]  = useState(0);
  const [bankIdx, setBankIdx] = useState(0);

  // Auto-scroll KPI every 4 s
  useEffect(() => {
    const t = setInterval(() => {
      setKpiIdx(prev => {
        const next = (prev + 1) % KPI_DATA.length;
        kpiRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const activeBank = BANKS[bankIdx];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Bank Balances</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── KPI Carousel ───────────────────────────────────────────────── */}
        <View style={s.kpiSection}>
          <FlatList
            ref={kpiRef}
            horizontal
            pagingEnabled
            data={KPI_DATA}
            keyExtractor={i => i.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
            renderItem={({ item }) => (
              <View style={s.kpiItem}>
                <View style={s.kpiCard}>
                  <View style={s.kpiIconBox}>
                    <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
                  </View>
                  <View style={s.kpiTextWrap}>
                    <Text style={s.kpiLabel}>{item.label}</Text>
                    <Text style={s.kpiAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                  </View>
                  <View style={[s.kpiTrendBadge, {
                    backgroundColor: item.positive ? COLORS.positiveBg : COLORS.negativeBg,
                  }]}>
                    <Ionicons
                      name={item.positive ? 'trending-up' : 'trending-down'}
                      size={11}
                      color={item.positive ? COLORS.positive : COLORS.negative}
                    />
                    <Text style={[s.kpiTrendTxt, {
                      color: item.positive ? COLORS.positive : COLORS.negative,
                    }]}>{item.trend}</Text>
                  </View>
                </View>
              </View>
            )}
          />
          {/* KPI dots */}
          <View style={s.dots}>
            {KPI_DATA.map((_, i) => (
              <View key={i} style={[s.dot, i === kpiIdx && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Bank Cards Carousel ─────────────────────────────────────────── */}
        <View style={s.bankSection}>
          <FlatList
            horizontal
            pagingEnabled
            data={BANKS}
            keyExtractor={b => b.id}
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
            onScrollToIndexFailed={() => {}}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              setBankIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
            }}
            renderItem={({ item: bank }) => (
              <View style={s.bankItem}>
                <LinearGradient
                  colors={bank.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.bankCard}
                >
                  {/* Bank name row */}
                  <View style={s.bankTopRow}>
                    <Text style={s.bankName}>{bank.name}</Text>
                    <View style={s.bankDotSep} />
                    <Text style={s.bankAcct}>{bank.account}</Text>
                  </View>

                  {/* Balance row */}
                  <View style={s.bankBottomRow}>
                    <View>
                      <Text style={s.bankBalLabel}>Balance</Text>
                      <Text style={s.bankBal}>{bank.balance}</Text>
                    </View>
                    <Text style={s.bankFeed}>Last feed {bank.lastFeed}</Text>
                  </View>
                </LinearGradient>
              </View>
            )}
          />
          {/* Bank card dots */}
          <View style={s.dots}>
            {BANKS.map((_, i) => (
              <View key={i} style={[s.dot, i === bankIdx && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Recent Transactions ─────────────────────────────────────────── */}
        <View style={s.txSection}>
          <Text style={s.txHeading}>Recent Transactions</Text>

          {activeBank.transactions.map((tx, idx) => {
            const isCr = tx.type === 'Cr';
            return (
              <View
                key={tx.id}
                style={[s.txRow, idx < activeBank.transactions.length - 1 && s.txBorder]}
              >
                {/* Icon — neutral for all, only amount carries Dr/Cr color */}
                <View style={s.txIconBox}>
                  <Ionicons name="card-outline" size={18} color={COLORS.textSecondary} />
                </View>

                {/* ID + date */}
                <View style={s.txInfo}>
                  <Text style={s.txId}>{tx.id}</Text>
                  <Text style={s.txDate}>{tx.date}</Text>
                </View>

                {/* Amount Dr/Cr */}
                <Text style={[s.txAmt, { color: isCr ? COLORS.positive : COLORS.negative }]}>
                  ₹{tx.amount} {tx.type}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:   { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  scroll: { paddingTop: SPACING.md },

  // ── KPI Carousel
  kpiSection: { marginBottom: SPACING.md },
  kpiItem:    { width: SW },
  kpiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  kpiIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  kpiTextWrap:  { flex: 1, gap: 2 },
  kpiLabel:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount:    { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  kpiTrendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: RADIUS.full, flexShrink: 0,
  },
  kpiTrendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },

  // ── Dots
  dots: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 5, marginTop: 10,
  },
  dot:       { width: 5,  height: 5, borderRadius: 3,   backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3,   backgroundColor: COLORS.textPrimary },

  // ── Bank Cards
  bankSection: { marginBottom: SPACING.md },
  bankItem:    { width: SW },
  bankCard: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 24,
  },
  bankTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bankName:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#FFFFFF' },
  bankDotSep:  { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  bankAcct:    { fontSize: TYPOGRAPHY.base, color: 'rgba(255,255,255,0.8)' },
  bankBottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  bankBalLabel:  { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  bankBal:       { fontSize: TYPOGRAPHY.xxl, fontWeight: '800', color: '#FFFFFF' },
  bankFeed:      { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.65)', paddingBottom: 4 },

  // ── Recent Transactions
  txSection: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: 16,
    paddingBottom: 4,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  txHeading: {
    fontSize: TYPOGRAPHY.base, fontWeight: '700',
    color: COLORS.textPrimary, marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
  },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  txInfo:  { flex: 1 },
  txId:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txDate:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', flexShrink: 0 },
});
