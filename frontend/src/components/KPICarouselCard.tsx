/**
 * Locked KPI carousel card — same shell as Home dashboard.
 * Use with FlatList paging (page width = screen width).
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { MetricTrendBadge, MetricTrendBadgeProps } from './MetricTrendBadge';

const { width: SW } = Dimensions.get('window');

export type KPICarouselCardProps = {
  icon: string;
  label: string;
  amount: string;
  trend_pct?: number | null;
  trend_positive?: boolean | null;
  trend?: string | null;
  positive?: boolean | null;
  /** Default true — show "—" when no prior. Set false for KPI detail screens. */
  alwaysShowTrend?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: ViewStyle;
};

/** Full-width page wrapper for horizontal paging FlatLists. */
export function KPICarouselPage({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.page, style]}>{children}</View>;
}

export function KPICarouselCard({
  icon,
  label,
  amount,
  trend_pct,
  trend_positive,
  trend,
  positive,
  alwaysShowTrend = true,
  onPress,
  testID,
  style,
}: KPICarouselCardProps) {
  const trendProps: MetricTrendBadgeProps = {
    trend_pct,
    trend_positive,
    trend,
    positive,
    alwaysShow: alwaysShowTrend,
  };

  const body = (
    <View style={[s.card, style]} testID={testID}>
      <View style={s.iconBox}>
        <Ionicons name={icon as any} size={22} color={COLORS.textSecondary} />
      </View>
      <View style={s.textWrap}>
        <Text style={s.label} numberOfLines={1}>{label}</Text>
        <Text style={s.amount} numberOfLines={1} adjustsFontSizeToFit>{amount}</Text>
      </View>
      <MetricTrendBadge {...trendProps} />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

export function KPICarouselDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  if (count <= 0) return null;
  return (
    <View style={s.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.dot, i === activeIndex && s.dotActive]} />
      ))}
    </View>
  );
}

/** Screen width for FlatList getItemLayout / snap. */
export const KPI_CAROUSEL_PAGE_WIDTH = SW;

const s = StyleSheet.create({
  page: { width: SW },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: { flex: 1, gap: 2, minWidth: 0 },
  label: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  amount: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    marginBottom: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.brandPrimary },
});
