import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (val: number): string => {
  if (val >= 10_00_000) return `₹${(val / 10_00_000).toFixed(2)}Cr`;
  if (val >= 1_00_000)  return `₹${(val / 1_00_000).toFixed(2)}L`;
  if (val >= 1_000)     return `₹${(val / 1_000).toFixed(1)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
};

// ── Bar Track Constants ────────────────────────────────────────────────────────
const BAR_H    = 9;
const GLOW_R   = 7;   // outer glow radius
const DOT_R    = 4;   // inner dot radius

// ── Animated Progress Bar ─────────────────────────────────────────────────────
interface BarProps {
  value: number;
  maxValue: number;
  color: string;
  glowColor: string;
  delay?: number;
}

function AnimatedBar({ value, maxValue, color, glowColor, delay = 0 }: BarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;

  useEffect(() => {
    if (trackWidth === 0) return;
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(pct, { duration: 950, easing: Easing.out(Easing.cubic) }),
    );
  }, [pct, trackWidth]);

  // Use direct width in Reanimated — most reliable on web + native
  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidth,
  }));

  // Glow dot rides the right edge of the fill
  const glowStyle = useAnimatedStyle(() => {
    const pos = progress.value * trackWidth;
    return {
      transform: [{ translateX: pos - GLOW_R }],
      opacity: progress.value > 0.02 ? 0.85 : 0,
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setTrackWidth(w);
  };

  return (
    <View style={bar.wrapper} onLayout={onLayout}>
      {/* Background track */}
      <View style={bar.track} />

      {/* Animated fill — scaleX from center, so shift left by (1-scale)/2 * width */}
      <View style={[bar.clipper, { width: trackWidth }]}>
        <Animated.View
          style={[bar.fill, { backgroundColor: color, width: trackWidth }, fillStyle]}
        />
      </View>

      {/* Glow dot at bar tip */}
      <Animated.View
        pointerEvents="none"
        style={[bar.glowOuter, { backgroundColor: glowColor }, glowStyle]}
      >
        <View style={[bar.glowInner, { backgroundColor: color }]} />
      </Animated.View>
    </View>
  );
}

const bar = StyleSheet.create({
  wrapper: {
    flex: 1,
    height: GLOW_R * 2,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 0, right: 0,
    height: BAR_H,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.borderDefault,
  },
  clipper: {
    position: 'absolute',
    left: 0,
    top: (GLOW_R * 2 - BAR_H) / 2,
    height: BAR_H,
    overflow: 'hidden',
    borderRadius: RADIUS.full,
  },
  fill: {
    height: BAR_H,
    borderRadius: RADIUS.full,
  },
  glowOuter: {
    position: 'absolute',
    top: 0,
    width:  GLOW_R * 2,
    height: GLOW_R * 2,
    borderRadius: GLOW_R,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowInner: {
    width:  DOT_R * 2,
    height: DOT_R * 2,
    borderRadius: DOT_R,
  },
});

// ── Main CashflowCard ─────────────────────────────────────────────────────────
interface CashflowCardProps {
  netCash?:              number;
  grossCash?:            number;
  netRealisableBalance?: number;
  grossProfit?:          number;
  netProfit?:            number;
  incomePercentage?:     number;
  updatedAt?:            string;
  totalIncome?:          number;
  totalExpense?:         number;
}

export default function CashflowCard({
  netCash           = 20830,
  grossProfit       = 470999,
  netProfit         = 130999,
  incomePercentage  = 68,
  updatedAt         = '5 mins ago',
  totalIncome,
  totalExpense,
}: CashflowCardProps) {
  const incomeVal  = totalIncome  ?? Math.round(netCash * 1.8);
  const expenseVal = totalExpense ?? Math.round(netCash * 0.8);
  const maxVal     = Math.max(incomeVal, expenseVal, 1);
  const isHealthy  = netCash >= 0;

  return (
    <View testID="cashflow-card" style={s.card}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.iconCircle}>
            <Ionicons name="analytics-outline" size={14} color={COLORS.textSecondary} />
          </View>
          <Text style={s.title}>Cashflow</Text>
          <Text style={s.updated}>· {updatedAt}</Text>
        </View>
        <TouchableOpacity style={s.fullBtn} activeOpacity={0.7}>
          <Text style={s.fullBtnTxt}>Full Report</Text>
          <Ionicons name="arrow-forward" size={11} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Net Cash Row ── */}
      <View style={s.netRow}>
        <View>
          <Text style={s.netLabel}>Net Cash</Text>
          <Text style={s.netValue}>
            ₹{netCash.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={[
          s.statusPill,
          { backgroundColor: isHealthy ? COLORS.positiveBg : COLORS.negativeBg },
        ]}>
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

      {/* ── Income Bar ── */}
      <View style={s.barRow}>
        <View style={s.barMeta}>
          <Ionicons name="arrow-up-circle-outline" size={15} color={COLORS.positive} />
          <Text style={s.barLabel}>Income</Text>
        </View>
        <AnimatedBar
          value={incomeVal}
          maxValue={maxVal}
          color={COLORS.positive}
          glowColor={COLORS.positive + '35'}
          delay={100}
        />
        <View style={s.barRight}>
          <Text style={s.barAmt}>{fmt(incomeVal)}</Text>
          <View style={s.pctChip}>
            <Text style={s.pctTxt}>{incomePercentage}%</Text>
          </View>
        </View>
      </View>

      {/* ── Expense Bar ── */}
      <View style={[s.barRow, { marginTop: 12 }]}>
        <View style={s.barMeta}>
          <Ionicons name="arrow-down-circle-outline" size={15} color={COLORS.negative} />
          <Text style={s.barLabel}>Expense</Text>
        </View>
        <AnimatedBar
          value={expenseVal}
          maxValue={maxVal}
          color={COLORS.negative}
          glowColor={COLORS.negative + '35'}
          delay={350}
        />
        <View style={s.barRight}>
          <Text style={s.barAmt}>{fmt(expenseVal)}</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* ── Bottom Metrics ── */}
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

// ── Styles ─────────────────────────────────────────────────────────────────────
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm + 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconCircle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },
  updated: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
  },
  fullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  fullBtnTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // Net Cash
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm + 2,
  },
  netLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
    marginBottom: 3,
    fontWeight: '500',
  },
  netValue: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  statusTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.borderDefault,
    marginVertical: SPACING.sm + 2,
  },

  // Bars
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 74,
  },
  barLabel: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 82,
    justifyContent: 'flex-end',
  },
  barAmt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pctChip: {
    backgroundColor: COLORS.positiveBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.positive + '30',
  },
  pctTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.positive,
  },

  // Bottom
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomCell: {
    flex: 1,
  },
  bottomCellRight: {
    alignItems: 'flex-end',
  },
  bottomSep: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.borderDefault,
    marginHorizontal: SPACING.sm,
  },
  bottomLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
    marginBottom: 3,
    fontWeight: '500',
  },
  bottomVal: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
