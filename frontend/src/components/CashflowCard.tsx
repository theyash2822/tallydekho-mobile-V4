import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { Ionicons } from '@expo/vector-icons';

interface CashflowCardProps {
  netCash?: number;
  grossCash?: number;
  netRealisableBalance?: number;
  grossProfit?: number;
  netProfit?: number;
  incomePercentage?: number;
  updatedAt?: string;
}

const RADIUS_SIZE = 80;
const STROKE_W = 18;
const SIZE = (RADIUS_SIZE + STROKE_W) * 2 + 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS_SIZE;
const CENTER = SIZE / 2;

const formatAmount = (val: number): string => {
  if (val >= 1_00_000) return `₹${(val / 1_00_000).toFixed(2)}L`;
  if (val >= 1000) return `₹${val.toLocaleString('en-IN')}`;
  return `₹${val.toFixed(2)}`;
};

const CashflowCard: React.FC<CashflowCardProps> = ({
  netCash = 20830,
  grossCash = 606.21,
  netRealisableBalance = 20021,
  grossProfit = 470999,
  netProfit = 130999,
  incomePercentage = 68,
  updatedAt = '5 mins. ago',
}) => {
  const incomeArc = (incomePercentage / 100) * CIRCUMFERENCE;

  return (
    <View testID="cashflow-card" style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="eye-outline" size={16} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.title}>Cashflow</Text>
      </View>

      {/* Ring Chart */}
      <View style={styles.chartWrap}>
        <View style={styles.svgContainer}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {/* Background track */}
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS_SIZE}
              fill="none"
              stroke={COLORS.borderDefault}
              strokeWidth={STROKE_W}
            />
            {/* Income arc */}
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS_SIZE}
              fill="none"
              stroke={COLORS.positive}
              strokeWidth={STROKE_W}
              strokeDasharray={`${incomeArc} ${CIRCUMFERENCE}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          </Svg>

          {/* Center Label — absolutely fills the SVG container */}
          <View style={styles.centerLabel}>
            <Text style={styles.netCashLabel}>Net Cash</Text>
            <Text style={styles.netCashValue}>₹{netCash.toLocaleString('en-IN')}</Text>
            <Text style={styles.updatedText}>Updated {updatedAt}</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: COLORS.borderStrong }]} />
          <Text style={styles.legendText}>Outcome</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: COLORS.positive }]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* 2x2 Metrics */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCell, styles.metricBorderRight]}>
          <Text style={styles.metricLabel}>Gross Cash</Text>
          <Text style={styles.metricValue}>₹{grossCash.toFixed(2)}</Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>Net Realisable Balance</Text>
          <Text style={styles.metricValue}>₹{netRealisableBalance.toLocaleString('en-IN')}</Text>
        </View>
        <View style={[styles.metricCell, styles.metricBorderTop, styles.metricBorderRight]}>
          <Text style={styles.metricLabel}>Gross Profit</Text>
          <Text style={styles.metricValue}>{formatAmount(grossProfit)}</Text>
        </View>
        <View style={[styles.metricCell, styles.metricBorderTop]}>
          <Text style={styles.metricLabel}>Net Profit</Text>
          <Text style={styles.metricValue}>{formatAmount(netProfit)}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  chartWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  svgContainer: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
  },
  centerLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netCashLabel: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  netCashValue: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  updatedText: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderDefault,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    width: '50%',
    padding: 10,
  },
  metricBorderRight: {
    borderRightWidth: 1,
    borderRightColor: COLORS.borderDefault,
  },
  metricBorderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDefault,
  },
  metricLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textTertiary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

export default CashflowCard;
