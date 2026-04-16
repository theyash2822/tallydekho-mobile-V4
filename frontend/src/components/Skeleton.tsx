/**
 * Shared Shimmer Skeleton System
 * Brand beige tones: #F5F4EF → #E9E8E3 → #E0DED6
 * Usage: import { ShimmerBox, HomeScreenSkeleton, LedgerListSkeleton, ... } from './Skeleton'
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../constants/colors';

const W = Dimensions.get('window').width;

// ── Base shimmer animation hook ────────────────────────────────────────────────
function useShimmer(): Animated.Value {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
        easing: Easing.linear,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return anim;
}

// ── Base ShimmerBox ────────────────────────────────────────────────────────────
interface BoxProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}

export function ShimmerBox({ width = '100%', height, borderRadius = RADIUS.sm, style }: BoxProps) {
  const anim = useShimmer();
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-W, W],
  });
  return (
    <View style={[{ width: width as any, height, borderRadius, backgroundColor: '#E9E8E3', overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen-specific Skeletons — mirror exact real layouts
// ─────────────────────────────────────────────────────────────────────────────

// ── Home Screen ────────────────────────────────────────────────────────────────
export function HomeScreenSkeleton() {
  return (
    <View style={sk.container}>
      {/* Search bar */}
      <View style={sk.searchRow}>
        <ShimmerBox height={44} borderRadius={22} style={{ flex: 1 }} />
        <ShimmerBox width={44} height={44} borderRadius={22} />
      </View>

      {/* Period filter chips */}
      <View style={sk.chipRow}>
        {[52, 44, 52, 52].map((w, i) => (
          <ShimmerBox key={i} width={w} height={28} borderRadius={14} />
        ))}
      </View>

      {/* KPI strip — 4 metric cards */}
      <View style={sk.kpiStrip}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={sk.kpiCard}>
            <ShimmerBox height={10} width="55%" borderRadius={5} />
            <ShimmerBox height={18} width="75%" borderRadius={5} style={{ marginTop: 6 }} />
            <ShimmerBox height={8} width="45%" borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* Cashflow card */}
      <View style={sk.card}>
        <View style={sk.cardHeader}>
          <ShimmerBox height={14} width={90} borderRadius={6} />
          <ShimmerBox height={14} width={60} borderRadius={6} />
        </View>
        {/* Donut placeholder */}
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <ShimmerBox width={130} height={130} borderRadius={65} />
        </View>
        {/* Legend rows */}
        {[1, 2, 3].map(i => (
          <View key={i} style={sk.legendRow}>
            <ShimmerBox width={10} height={10} borderRadius={5} />
            <ShimmerBox height={10} width="35%" borderRadius={5} />
            <ShimmerBox height={12} width="25%" borderRadius={5} style={{ marginLeft: 'auto' as any }} />
          </View>
        ))}
      </View>

      {/* Recent activity */}
      <View style={sk.card}>
        <ShimmerBox height={14} width={130} borderRadius={6} style={{ marginBottom: 14 }} />
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={sk.listRow}>
            <ShimmerBox width={38} height={38} borderRadius={19} />
            <View style={sk.listBody}>
              <ShimmerBox height={12} width="65%" borderRadius={5} />
              <ShimmerBox height={9} width="40%" borderRadius={4} style={{ marginTop: 6 }} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <ShimmerBox height={12} width={60} borderRadius={5} />
              <ShimmerBox height={9} width={40} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Ledger List ────────────────────────────────────────────────────────────────
export function LedgerListSkeleton() {
  return (
    <View style={sk.container}>
      {/* Search bar */}
      <View style={[sk.searchRow, { marginBottom: 0, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg }]}>
        <ShimmerBox height={40} borderRadius={20} style={{ flex: 1 }} />
        <ShimmerBox width={40} height={40} borderRadius={20} />
      </View>
      {/* Group header */}
      <ShimmerBox height={10} width={80} borderRadius={5} style={{ margin: SPACING.md }} />
      {/* List rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={[sk.listRow, sk.ledgerRow]}>
          <ShimmerBox width={40} height={40} borderRadius={20} />
          <View style={sk.listBody}>
            <ShimmerBox height={13} width="60%" borderRadius={5} />
            <ShimmerBox height={9} width="40%" borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <ShimmerBox height={13} width={70} borderRadius={5} />
            <ShimmerBox height={9} width={40} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Ledger Transaction List (inside ledger detail) ─────────────────────────────
export function LedgerTransactionSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      {/* Balance summary bar */}
      <View style={[sk.balanceBar]}>
        {[1, 2, 3].map(i => (
          <View key={i} style={sk.balanceItem}>
            <ShimmerBox height={9} width={60} borderRadius={4} />
            <ShimmerBox height={14} width={75} borderRadius={5} style={{ marginTop: 5 }} />
          </View>
        ))}
      </View>
      {/* Date filter strip */}
      <View style={sk.dateStrip}>
        <ShimmerBox height={12} width={160} borderRadius={5} />
        <ShimmerBox height={28} width={28} borderRadius={14} />
      </View>
      {/* Transaction rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={[sk.listRow, sk.txnRow]}>
          <View style={sk.listBody}>
            <ShimmerBox height={12} width="65%" borderRadius={5} />
            <ShimmerBox height={9} width="45%" borderRadius={4} style={{ marginTop: 5 }} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <ShimmerBox height={13} width={70} borderRadius={5} />
            <ShimmerBox height={9} width={55} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Sales Register ─────────────────────────────────────────────────────────────
export function SalesRegisterSkeleton() {
  return (
    <View style={sk.container}>
      {/* Stat cards row */}
      <View style={sk.statRow}>
        {[1, 2, 3].map(i => (
          <View key={i} style={sk.statCard}>
            <ShimmerBox height={22} width="50%" borderRadius={5} />
            <ShimmerBox height={9} width="65%" borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      {/* Filter chips */}
      <View style={[sk.chipRow, { paddingHorizontal: SPACING.md, marginTop: 4 }]}>
        {[36, 90, 100].map((w, i) => (
          <ShimmerBox key={i} width={w} height={30} borderRadius={15} />
        ))}
      </View>
      {/* Invoice cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={sk.invoiceCard}>
          <View style={sk.invoiceTop}>
            <ShimmerBox height={13} width="40%" borderRadius={5} />
            <ShimmerBox height={22} width={90} borderRadius={11} />
          </View>
          <ShimmerBox height={13} width="70%" borderRadius={5} style={{ marginVertical: 6 }} />
          <View style={sk.invoiceFooter}>
            <ShimmerBox height={10} width={80} borderRadius={4} />
            <ShimmerBox height={10} width={80} borderRadius={4} />
            <ShimmerBox height={13} width={60} borderRadius={5} style={{ marginLeft: 'auto' as any }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Financial Chart (InteractiveLineChart area) ────────────────────────────────
export function FinancialChartSkeleton() {
  const chartW = W - SPACING.md * 4;
  return (
    <View style={{ paddingVertical: 8 }}>
      {/* Y-axis + chart area */}
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {/* Y-axis labels */}
        <View style={{ justifyContent: 'space-between', paddingVertical: 4, width: 38 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <ShimmerBox key={i} height={8} width={34} borderRadius={4} />
          ))}
        </View>
        {/* Chart area */}
        <View style={{ flex: 1 }}>
          <ShimmerBox height={146} borderRadius={6} />
        </View>
      </View>
      {/* X-axis month labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 44, marginTop: 6 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBox key={i} width={20} height={8} borderRadius={4} />
        ))}
      </View>
    </View>
  );
}

// ── Tally Sync (large center spinner replacement) ──────────────────────────────
export function TallySyncSkeleton() {
  return (
    <View style={sk.centerBlock}>
      <ShimmerBox width={64} height={64} borderRadius={32} />
      <ShimmerBox height={16} width={180} borderRadius={6} style={{ marginTop: 16 }} />
      <ShimmerBox height={11} width={240} borderRadius={5} style={{ marginTop: 8 }} />
      <ShimmerBox height={11} width={200} borderRadius={5} style={{ marginTop: 5 }} />
      <ShimmerBox height={44} width={200} borderRadius={22} style={{ marginTop: 20 }} />
    </View>
  );
}

// ── License Check ─────────────────────────────────────────────────────────────
export function LicenseSkeleton() {
  return (
    <View style={sk.centerBlock}>
      <ShimmerBox width={72} height={72} borderRadius={36} />
      <ShimmerBox height={18} width={160} borderRadius={6} style={{ marginTop: 16 }} />
      <ShimmerBox height={11} width={220} borderRadius={5} style={{ marginTop: 10 }} />
      <ShimmerBox height={11} width={180} borderRadius={5} style={{ marginTop: 5 }} />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        <ShimmerBox height={44} width={120} borderRadius={22} />
        <ShimmerBox height={44} width={120} borderRadius={22} />
      </View>
    </View>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const sk = StyleSheet.create({
  container: { flex: 1 },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  kpiStrip: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
  },
  kpiCard: {
    flex: 1, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md, padding: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },

  card: {
    marginHorizontal: SPACING.md, marginBottom: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },

  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listBody: { flex: 1, gap: 0 },

  ledgerRow: {
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },

  balanceBar: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 14, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  balanceItem: { alignItems: 'center' },

  dateStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },

  txnRow: {
    paddingHorizontal: SPACING.md, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },

  statRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.pageBg,
    borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center',
  },

  invoiceCard: {
    marginHorizontal: SPACING.md, marginTop: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
  },
  invoiceTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  invoiceFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },

  centerBlock: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
});
