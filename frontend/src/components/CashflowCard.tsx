import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useSettings } from '../context/SettingsContext';

const SEG_COUNT = 20;
const SEG_GAP = 3;
const BAR_H = 11;
const ANIM_MS = 950;

function SegmentedBar({ value, maxValue, color, delay = 0 }: {
  value: number; maxValue: number; color: string; delay?: number;
}) {
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const target = Math.round(pct * SEG_COUNT);
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') { setFilled(target); return; }
    setFilled(0);
    if (target === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < target; i++) {
      timers.push(setTimeout(() => setFilled(i + 1), delay + Math.round((i / target) * ANIM_MS)));
    }
    return () => timers.forEach(clearTimeout);
  }, [target, delay]);

  return (
    <View style={b.row}>
      {Array.from({ length: SEG_COUNT }, (_, i) => (
        <View key={i} style={[b.seg, { backgroundColor: i < filled ? color : COLORS.borderDefault }]} />
      ))}
    </View>
  );
}

const b = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: SEG_GAP, height: BAR_H, alignItems: 'stretch' },
  seg: { flex: 1, height: BAR_H, borderRadius: 0 },
});

interface CashflowCardProps {
  netCash?: number;
  grossCash?: number;
  netRealisableBalance?: number;
  grossProfit?: number;
  netProfit?: number;
  incomePercentage?: number;
  updatedAt?: string;
  totalIncome?: number;
  totalExpense?: number;
}

export default function CashflowCard({
  netCash = 0,
  grossProfit = 0,
  netProfit = 0,
  incomePercentage = 0,
  updatedAt = 'just now',
  totalIncome,
  totalExpense,
}: CashflowCardProps) {
  const router = useRouter();
  const { formatAmountCompact } = useSettings();
  const fmt = (val: number) => formatAmountCompact(Math.round(val));
  const incomeVal = totalIncome ?? 0;
  const expenseVal = totalExpense ?? 0;
  const maxVal = Math.max(incomeVal, expenseVal, 1);
  const isHealthy = netCash >= 0;

  return (
    <View testID="cashflow-card" style={s.card}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.iconCircle}>
            <Ionicons name="analytics-outline" size={14} color={COLORS.textSecondary} />
          </View>
          <Text style={s.title}>Cashflow</Text>
          <Text style={s.updated}>· {updatedAt || 'just now'}</Text>
        </View>
        <TouchableOpacity
          testID="cashflow-expand-btn"
          style={s.expandBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/cashflow-report' as any)}
        >
          <Ionicons name="expand-outline" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={s.netRow}>
        <View>
          <Text style={s.netLabel}>Net Cash</Text>
          <Text style={s.netValue}>₹{Number(netCash || 0).toLocaleString('en-IN')}</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: isHealthy ? COLORS.positiveBg : COLORS.negativeBg }]}>
          <Ionicons
            name={isHealthy ? 'trending-up-outline' : 'trending-down-outline'}
            size={13}
            color={isHealthy ? COLORS.positive : COLORS.negative}
          />
          <Text style={[s.statusTxt, { color: isHealthy ? COLORS.positive : COLORS.negative }]}>
            {isHealthy ? '+' : ''}{incomePercentage}%{'  '}
            {isHealthy ? 'Healthy' : 'Watch'}
          </Text>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.barRow}>
        <View style={s.barMeta}>
          <Ionicons name="arrow-up-circle-outline" size={15} color={COLORS.positive} />
          <Text style={s.barLabel}>Income</Text>
        </View>
        <SegmentedBar value={incomeVal} maxValue={maxVal} color={COLORS.positive} delay={80} />
        <View style={s.barRight}>
          <Text style={s.barAmt}>{fmt(incomeVal)}</Text>
          <View style={s.pctChip}>
            <Text style={s.pctTxt}>{incomePercentage}%</Text>
          </View>
        </View>
      </View>

      <View style={[s.barRow, { marginTop: 12 }]}>
        <View style={s.barMeta}>
          <Ionicons name="arrow-down-circle-outline" size={15} color={COLORS.negative} />
          <Text style={s.barLabel}>Expense</Text>
        </View>
        <SegmentedBar value={expenseVal} maxValue={maxVal} color={COLORS.negative} delay={360} />
        <View style={s.barRight}>
          <Text style={s.barAmt}>{fmt(expenseVal)}</Text>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.bottomRow}>
        <View style={s.bottomCell}>
          <Text style={s.bottomLabel}>Gross Profit</Text>
          <Text style={s.bottomVal}>{fmt(grossProfit)}</Text>
        </View>
        <View style={s.bottomSep} />
        <View style={[s.bottomCell, s.bottomCellRight]}>
          <Text style={s.bottomLabel}>Net Profit</Text>
          <Text style={[s.bottomVal, { color: COLORS.positive }]}>{fmt(netProfit)}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm + 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.1 },
  updated: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  expandBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm + 2 },
  netLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 3, fontWeight: '500' },
  netValue: { fontSize: TYPOGRAPHY.xl, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full },
  statusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', letterSpacing: 0.1 },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm + 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 74 },
  barLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 82, justifyContent: 'flex-end' },
  barAmt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  pctChip: { backgroundColor: COLORS.positiveBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.positive + '30' },
  pctTxt: { fontSize: 10, fontWeight: '800', color: COLORS.positive },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  bottomCell: { flex: 1 },
  bottomCellRight: { alignItems: 'flex-end' },
  bottomSep: { width: 1, height: 30, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.sm },
  bottomLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 3, fontWeight: '500' },
  bottomVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
