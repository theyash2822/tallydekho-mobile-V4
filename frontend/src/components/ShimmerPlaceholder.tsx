/**
 * ShimmerPlaceholder — reusable animated shimmer skeleton.
 *
 * Uses expo-linear-gradient + react-native-reanimated for a smooth
 * left-to-right light sweep that signals "loading" to the user.
 *
 * Usage:
 *   <ShimmerPlaceholder width={200} height={20} borderRadius={6} />
 *   <ShimmerPlaceholder width="100%" height={48} borderRadius={12} style={{ marginBottom: 8 }} />
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withTiming, useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_W = Dimensions.get('window').width;

interface ShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function ShimmerPlaceholder({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: ShimmerProps) {
  // Resolve numeric width for animation distance; fall back to screen width
  const numericW = typeof width === 'number' ? width : SCREEN_W;

  const translateX = useSharedValue(-numericW);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(numericW, {
        duration: 1100,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [numericW]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: '#E0DFDA', overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ── Pre-built skeleton shapes for common use cases ───────────────────────────

/** A single ledger/list row skeleton */
export function LedgerRowSkeleton() {
  return (
    <View style={sk.row}>
      <ShimmerPlaceholder width={36} height={36} borderRadius={18} />
      <View style={sk.rowBody}>
        <ShimmerPlaceholder width="60%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
        <ShimmerPlaceholder width="40%" height={11} borderRadius={5} />
      </View>
      <ShimmerPlaceholder width={64} height={14} borderRadius={6} />
    </View>
  );
}

/** KPI carousel skeleton — matches KPICarouselCard horizontal layout. */
export function KPICarouselSkeleton() {
  return (
    <View style={sk.carouselCard}>
      <ShimmerPlaceholder width={40} height={40} borderRadius={20} />
      <View style={sk.carouselBody}>
        <ShimmerPlaceholder width="55%" height={11} borderRadius={5} style={{ marginBottom: 6 }} />
        <ShimmerPlaceholder width="75%" height={16} borderRadius={6} />
      </View>
      <ShimmerPlaceholder width={48} height={22} borderRadius={11} />
    </View>
  );
}

/** @deprecated Use KPICarouselSkeleton — kept for backward compatibility */
export function KPICardSkeleton() {
  return <KPICarouselSkeleton />;
}

/** Metric card skeleton (2-column grid cards on home screen) */
export function MetricCardSkeleton() {
  return (
    <View style={sk.metricCard}>
      <ShimmerPlaceholder width={32} height={32} borderRadius={16} style={{ marginBottom: 8 }} />
      <ShimmerPlaceholder width="55%" height={11} borderRadius={5} style={{ marginBottom: 5 }} />
      <ShimmerPlaceholder width="75%" height={16} borderRadius={6} />
    </View>
  );
}

/** Recent-activity row skeleton */
export function ActivityRowSkeleton() {
  return (
    <View style={sk.actRow}>
      <ShimmerPlaceholder width={36} height={36} borderRadius={10} />
      <View style={sk.actBody}>
        <ShimmerPlaceholder width="50%" height={13} borderRadius={5} style={{ marginBottom: 5 }} />
        <ShimmerPlaceholder width="35%" height={10} borderRadius={5} />
      </View>
      <ShimmerPlaceholder width={56} height={13} borderRadius={5} />
    </View>
  );
}

/** Generic card block skeleton */
export function CardSkeleton({ height: h = 120 }: { height?: number }) {
  return (
    <ShimmerPlaceholder
      width="100%"
      height={h}
      borderRadius={12}
      style={{ marginBottom: 12 }}
    />
  );
}

const sk = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rowBody: { flex: 1 },
  carouselCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  carouselBody: { flex: 1 },
  kpiCard: {
    width: 140, height: 110,
    backgroundColor: '#fff', borderRadius: 14,
    padding: 12, marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
    alignItems: 'flex-start',
  },
  metricCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14,
    padding: 14, margin: 4,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  actRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  actBody: { flex: 1 },
});
