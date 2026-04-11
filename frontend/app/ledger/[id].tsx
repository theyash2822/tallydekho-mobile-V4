import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Path, Text as SvgText, G } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_LEDGERS } from '../../src/data/mockData';

const SCREEN_W = Dimensions.get('window').width;

// Simple donut chart for Dr/Cr split
function DrCrDonut({ drPct }: { drPct: number }) {
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const r = 42;
  const stroke = 14;
  const circ = 2 * Math.PI * r;
  const drDash = (drPct / 100) * circ;
  const crDash = circ - drDash;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background ring */}
      <Circle cx={cx} cy={cy} r={r} stroke={COLORS.borderDefault} strokeWidth={stroke} fill="none" />
      {/* Cr arc (green) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={COLORS.positive}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${crDash} ${circ}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Dr arc (red) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={COLORS.negative}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${drDash} ${circ}`}
        strokeDashoffset={-crDash}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Centre text */}
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill={COLORS.textPrimary} fontWeight="700">{drPct}%</SvgText>
      <SvgText x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill={COLORS.textTertiary}>Debit</SvgText>
    </Svg>
  );
}

const MOCK_TRANSACTIONS = [
  { id: 't1', date: '01 Apr', voucher: 'SI-30865', type: 'Sales Invoice', amount: '₹12,500', isDebit: false, balance: '-₹12,500' },
  { id: 't2', date: '05 Apr', voucher: 'PV-2045', type: 'Payment',       amount: '₹8,000',  isDebit: true,  balance: '-₹4,500'  },
  { id: 't3', date: '12 Apr', voucher: 'SI-30901', type: 'Sales Invoice', amount: '₹22,000', isDebit: false, balance: '-₹26,500' },
  { id: 't4', date: '18 Apr', voucher: 'RV-1023', type: 'Receipt',       amount: '₹15,000', isDebit: true,  balance: '-₹11,500' },
  { id: 't5', date: '25 Apr', voucher: 'JV-0034', type: 'Journal',       amount: '₹5,400',  isDebit: false, balance: '-₹16,900' },
  { id: 't6', date: '03 May', voucher: 'SI-30977', type: 'Sales Invoice', amount: '₹18,700', isDebit: false, balance: '-₹35,600' },
  { id: 't7', date: '10 May', voucher: 'PV-2089', type: 'Payment',       amount: '₹20,000', isDebit: true,  balance: '-₹15,600' },
];

const KPI_CHIPS = [
  { label: 'Opening',      value: '₹0',      color: COLORS.textSecondary },
  { label: 'Closing',      value: '₹37.5K Dr', color: COLORS.negative   },
  { label: 'Total Credit', value: '₹87.7K',  color: COLORS.positive     },
  { label: 'Total Debit',  value: '₹17.9K',  color: COLORS.negative     },
  { label: 'Vouchers',     value: '6',        color: COLORS.brandPrimary },
];

export default function LedgerDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showDrOnly, setShowDrOnly] = useState(false);
  const [showCrOnly, setShowCrOnly] = useState(false);

  // Find ledger from mock or use a default
  const ledger = MOCK_LEDGERS?.find((l: any) => l.id === id) ||
    { id: id || 'L001', name: 'Alliance Trading Co.', group: 'Sundry Debtors', balance: '₹37,500 Dr' };

  const txns = MOCK_TRANSACTIONS.filter(t => {
    if (showDrOnly && !t.isDebit) return false;
    if (showCrOnly && t.isDebit) return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{ledger.name}</Text>
        <TouchableOpacity style={styles.infoBtn} activeOpacity={0.7}>
          <Ionicons name="information-circle-outline" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Donut + KPI chips */}
        <View style={styles.chartSection}>
          <DrCrDonut drPct={67} />
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.negative }]} />
              <Text style={styles.legendText}>Dr ₹67K</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.positive }]} />
              <Text style={styles.legendText}>Cr ₹33K</Text>
            </View>
          </View>
        </View>

        {/* KPI Chips — horizontal scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRow}>
          {KPI_CHIPS.map(chip => (
            <View key={chip.label} style={styles.kpiChip}>
              <Text style={styles.kpiLabel}>{chip.label}</Text>
              <Text style={[styles.kpiValue, { color: chip.color }]}>{chip.value}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Search + Dr/Cr filter */}
        <View style={styles.filterRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={14} color={COLORS.textTertiary} />
            <Text style={styles.searchPlaceholder}>Search transactions</Text>
          </View>
          <TouchableOpacity
            style={[styles.filterPill, showDrOnly && styles.filterPillActive]}
            onPress={() => { setShowDrOnly(!showDrOnly); setShowCrOnly(false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, showDrOnly && styles.filterPillTextActive]}>Dr</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, showCrOnly && styles.filterPillActive]}
            onPress={() => { setShowCrOnly(!showCrOnly); setShowDrOnly(false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, showCrOnly && styles.filterPillTextActive]}>Cr</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction List with month separators */}
        <View style={styles.txnList}>
          {txns.map((txn, idx) => {
            const isNewMonth = idx === 0 || txn.date.split(' ')[1] !== txns[idx - 1].date.split(' ')[1];
            return (
              <React.Fragment key={txn.id}>
                {isNewMonth && (
                  <View style={styles.monthSep}>
                    <Text style={styles.monthSepText}>{txn.date.split(' ')[1]} 25 ▾</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.txnRow} activeOpacity={0.75}>
                  {/* Date */}
                  <Text style={styles.txnDate}>{txn.date}</Text>

                  {/* Voucher info */}
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnVoucher}>{txn.voucher}</Text>
                    <Text style={styles.txnType}>{txn.type}</Text>
                  </View>

                  {/* Amount */}
                  <View style={styles.txnAmounts}>
                    <Text style={[styles.txnAmt, { color: txn.isDebit ? COLORS.negative : COLORS.positive }]}>
                      {txn.isDebit ? 'Dr ' : 'Cr '}{txn.amount}
                    </Text>
                    <Text style={styles.txnBalance}>{txn.balance}</Text>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        {/* Share button */}
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.8}>
          <Ionicons name="share-outline" size={16} color={COLORS.white} />
          <Text style={styles.shareBtnText}>Share PDF / XLSX</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  infoBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },

  // Donut chart section
  chartSection: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24,
    backgroundColor: COLORS.cardBg, margin: SPACING.md,
    borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  chartLegend: { gap: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendText:  { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },

  // KPI chips
  kpiRow: { paddingHorizontal: SPACING.md, gap: 8, paddingBottom: SPACING.md },
  kpiChip: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', gap: 2,
  },
  kpiLabel: { fontSize: 10, color: COLORS.textTertiary, fontWeight: '500' },
  kpiValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },

  // Filter row
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchPlaceholder: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: COLORS.cardBg, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  filterPillActive:     { backgroundColor: COLORS.activeBg, borderColor: COLORS.brandPrimary },
  filterPillText:       { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary },
  filterPillTextActive: { color: COLORS.brandPrimary },

  // Transaction list
  txnList: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderDefault },
  monthSep: {
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    backgroundColor: COLORS.pageBg,
  },
  monthSepText: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary },
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  txnDate:   { fontSize: 11, color: COLORS.textTertiary, width: 36 },
  txnInfo:   { flex: 1 },
  txnVoucher:{ fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txnType:   { fontSize: 11, color: COLORS.textTertiary, marginTop: 2 },
  txnAmounts:{ alignItems: 'flex-end' },
  txnAmt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  txnBalance:{ fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },

  // Share button
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: SPACING.md, backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.lg, paddingVertical: 14,
  },
  shareBtnText: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
