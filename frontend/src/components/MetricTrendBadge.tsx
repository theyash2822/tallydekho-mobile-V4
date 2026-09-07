import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS } from '../constants/colors';

export type MetricTrendBadgeProps = {
  /** Numeric trend from API (preferred). */
  trend_pct?: number | null;
  trend_positive?: boolean | null;
  /** Pre-formatted label (e.g. "+12%"). Used when trend_pct is absent. */
  trend?: string | null;
  /** Polarity when using `trend` string. */
  positive?: boolean | null;
  /** When false, hide badge entirely if there is no trend value. Default true (shows "—"). */
  alwaysShow?: boolean;
};

/** Home-dashboard-style KPI trend pill. */
export function MetricTrendBadge({
  trend_pct,
  trend_positive,
  trend,
  positive: positiveProp,
  alwaysShow = true,
}: MetricTrendBadgeProps) {
  const hasPct = trend_pct != null && Number.isFinite(Number(trend_pct));
  const hasString = !hasPct && typeof trend === 'string' && trend.length > 0;
  const hasTrend = hasPct || hasString;

  if (!hasTrend && !alwaysShow) return null;

  const isFlat = hasPct
    ? Number(trend_pct) === 0
    : hasString && (trend === '0%' || trend === '0');

  const positive = hasPct
    ? (trend_positive != null ? !!trend_positive : Number(trend_pct) >= 0)
    : hasString
      ? (positiveProp != null ? !!positiveProp : !String(trend).startsWith('-'))
      : false;

  const trendLabel = isFlat
    ? '0%'
    : hasPct
      ? `${Number(trend_pct) >= 0 ? '+' : ''}${Number(trend_pct)}%`
      : hasString
        ? String(trend)
        : '—';

  return (
    <View
      style={[
        s.badge,
        {
          backgroundColor: isFlat
            ? COLORS.activeBg
            : hasTrend
              ? (positive ? COLORS.positiveBg : COLORS.negativeBg)
              : COLORS.pageBg,
        },
      ]}
    >
      {hasTrend && !isFlat ? (
        <Ionicons
          name={positive ? 'trending-up' : 'trending-down'}
          size={11}
          color={positive ? COLORS.positive : COLORS.negative}
        />
      ) : null}
      <Text
        style={[
          s.txt,
          {
            color: isFlat
              ? COLORS.textPrimary
              : hasTrend
                ? (positive ? COLORS.positive : COLORS.negative)
                : COLORS.textTertiary,
          },
        ]}
      >
        {trendLabel}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  txt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
});
