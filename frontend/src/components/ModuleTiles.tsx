import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import ShimmerPlaceholder from './ShimmerPlaceholder';

// ── Compact large amounts so they never clip in the narrow tile ──────────────
const compactAmount = (raw: string): string => {
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!isFinite(num) || num === 0) return raw;
  if (num >= 1_00_00_000) return `₹${(num / 1_00_00_000).toFixed(2)}Cr`;
  if (num >= 1_00_000)    return `₹${(num / 1_00_000).toFixed(2)}L`;
  return raw; // small enough to show in full
};

// ── Per-module minimalistic color identity ──────────────────────────────────
const IDENTITY: Record<string, { accent: string; tint: string }> = {
  sales:     { accent: COLORS.positive, tint: COLORS.positiveBg },
  purchases: { accent: COLORS.info,     tint: COLORS.infoBg },
  expenses:  { accent: COLORS.negative, tint: COLORS.negativeBg },
};

interface Metric {
  id: string;
  label: string;
  amount: string;
  change: number;
  positive: boolean;
  icon: string;
  route?: string;
}

interface Props {
  metrics: Metric[];
  isLoading?: boolean;
}

export default function ModuleTiles({ metrics, isLoading }: Props) {
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={s.row}>
        {[0, 1, 2].map(i => (
          <View key={i} style={s.tile}>
            <ShimmerPlaceholder width={30} height={30} borderRadius={8} />
            <ShimmerPlaceholder width="70%" height={10} borderRadius={5} />
            <ShimmerPlaceholder width="85%" height={16} borderRadius={6} />
            <ShimmerPlaceholder width="45%" height={12} borderRadius={6} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={s.row}>
      {metrics.map(item => {
        const id = IDENTITY[item.id] || { accent: COLORS.textSecondary, tint: COLORS.pageBg };
        const trendColor = item.positive ? COLORS.positive : COLORS.negative;
        return (
          <TouchableOpacity
            key={item.id}
            testID={`module-tile-${item.id}`}
            style={s.tile}
            activeOpacity={0.75}
            onPress={() => item.route && router.push(item.route as any)}
          >
            {/* thin colored accent line for identity */}
            <View style={[s.accent, { backgroundColor: id.accent }]} />

            {/* icon chip */}
            <View style={[s.iconChip, { backgroundColor: id.tint }]}>
              <Ionicons name={item.icon as any} size={16} color={id.accent} />
            </View>

            <Text style={s.label} numberOfLines={1}>{item.label}</Text>
            <Text
              style={s.amount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {compactAmount(item.amount)}
            </Text>

            <View style={s.trendRow}>
              <Ionicons
                name={item.positive ? 'arrow-up' : 'arrow-down'}
                size={11}
                color={trendColor}
              />
              <Text style={[s.trendTxt, { color: trendColor }]}>{item.change}%</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  tile: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  iconChip: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  amount: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
  },
});
