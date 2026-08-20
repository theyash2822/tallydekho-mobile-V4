import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { MOCK_STOCK_DASHBOARD } from '../../src/data/mockData';

// ── Format helper ───────────────────────────────────────────────────────────
const fmt = (v: number): string => {
  if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)}Cr`;
  if (v >= 1_00_000)    return `₹${(v / 1_00_000).toFixed(2)}L`;
  if (v >= 1_000)       return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

// ── Segmented utilisation bar (matches Cashflow bar language) ─────────────────
const SEG_COUNT = 20;
function SegmentedBar({ pct, color }: { pct: number; color: string }) {
  const target = Math.round((Math.min(pct, 100) / 100) * SEG_COUNT);
  const [filled, setFilled] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') { setFilled(target); return; }
    setFilled(0);
    if (target === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < target; i++) {
      timers.push(setTimeout(() => setFilled(i + 1), Math.round((i / target) * 800)));
    }
    return () => timers.forEach(clearTimeout);
  }, [target]);
  return (
    <View style={bar.row}>
      {Array.from({ length: SEG_COUNT }, (_, i) => (
        <View key={i} style={[bar.seg, { backgroundColor: i < filled ? color : COLORS.borderDefault }]} />
      ))}
    </View>
  );
}
const bar = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3, height: 12, alignItems: 'stretch' },
  seg: { flex: 1, height: 12, borderRadius: 0 },
});

// ── Animated horizontal category bar ──────────────────────────────────────────
function CategoryBar({ value, maxVal, color, delay = 0 }: {
  value: number; maxVal: number; color: string; delay?: number;
}) {
  const w = useRef(new Animated.Value(0)).current;
  const pct = maxVal > 0 ? Math.min(value / maxVal, 1) : 0;
  useEffect(() => {
    w.setValue(0);
    const anim = Animated.timing(w, {
      toValue: pct * 100,
      duration: 600,
      delay,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [pct, delay]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={cat.track}>
      <Animated.View style={[cat.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

export default function StocksDashboard() {
  const router = useRouter();
  const d = MOCK_STOCK_DASHBOARD;

  const SECONDARY_ACTIONS = [
    { id: 'settings', icon: 'options-outline', route: '/stocks/settings' },
    { id: 'barcode',  icon: 'barcode-outline', route: '/stocks/barcodes' },
  ];

  // Neutral palette — matches older stock look; red reserved for alerts only
  const NEUTRAL = COLORS.textSecondary;
  const NEUTRAL_BG = COLORS.pageBg;
  const STAT_TILES = [
    { id: 'movement',   label: 'Movements',   value: String(d.recentMovements), sub: 'Last 7 days',       icon: 'swap-vertical-outline', accent: NEUTRAL,         tint: NEUTRAL_BG,        route: '/stocks/fast-slow' },
    { id: 'low',        label: 'Low-Stock',   value: String(d.lowStockCount),    sub: 'Items below reorder',       icon: 'alert-circle-outline', accent: COLORS.negative, tint: COLORS.negativeBg, route: '/stocks/reorder-queue' },
    { id: 'fast',       label: 'Fast-Moving', value: String(d.fastMovingCount),  sub: 'Active SKUs',               icon: 'flash-outline',        accent: NEUTRAL,         tint: NEUTRAL_BG,        route: '/stocks/movement-analytics' },
    { id: 'aged',       label: 'Aged Stock',  value: d.agedInventory.value,      sub: `${d.agedInventory.days} days old`, icon: 'time-outline',  accent: NEUTRAL,         tint: NEUTRAL_BG,        route: '/stocks/aged-items' },
  ];

  const maxCat = Math.max(...d.categories.map(c => c.value), 1);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header with title + action icons */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Stock</Text>
          <Text style={s.headerSub}>Inventory overview</Text>
        </View>
        <View style={s.headerActions}>
          {SECONDARY_ACTIONS.map(a => (
            <TouchableOpacity
              key={a.id}
              style={s.actionBtn}
              activeOpacity={0.7}
              onPress={() => router.push(a.route as any)}
            >
              <Ionicons name={a.icon as any} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>

        {/* ── Hero: Total Stock Value ── */}
        <TouchableOpacity
          style={s.hero}
          activeOpacity={0.85}
          onPress={() => router.push('/stocks/total-stock' as any)}
        >
          <View style={s.heroTopRow}>
            <View style={s.heroIcon}>
              <Ionicons name="cube-outline" size={18} color={COLORS.white} />
            </View>
            <View style={[s.trendPill, { backgroundColor: d.valueTrendPositive ? COLORS.positiveBg : COLORS.negativeBg }]}>
              <Ionicons
                name={d.valueTrendPositive ? 'trending-up' : 'trending-down'}
                size={13}
                color={d.valueTrendPositive ? COLORS.positive : COLORS.negative}
              />
              <Text style={[s.trendTxt, { color: d.valueTrendPositive ? COLORS.positive : COLORS.negative }]}>
                {d.valueTrendPositive ? '+' : ''}{d.valueTrend}%
              </Text>
            </View>
          </View>
          <Text style={s.heroLabel}>Total Stock Value</Text>
          <Text style={s.heroValue}>{d.totalValue}</Text>
          <View style={s.heroMetaRow}>
            <Ionicons name="layers-outline" size={13} color={COLORS.textTertiary} />
            <Text style={s.heroMeta}>{d.totalQty} units · {d.warehouses.total} warehouses</Text>
          </View>
        </TouchableOpacity>

        {/* ── 2×2 Stat Tiles ── */}
        <View style={s.grid}>
          {STAT_TILES.map(t => (
            <TouchableOpacity
              key={t.id}
              style={s.tile}
              activeOpacity={0.8}
              onPress={() => router.push(t.route as any)}
            >
              <View style={[s.tileIcon, { backgroundColor: t.tint }]}>
                <Ionicons name={t.icon as any} size={16} color={t.accent} />
              </View>
              <Text style={s.tileLabel}>{t.label}</Text>
              <Text style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.value}</Text>
              <Text style={s.tileSub} numberOfLines={1}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stock Health (tap → on-hand stock) ── */}
        <TouchableOpacity
          style={s.card}
          activeOpacity={0.85}
          onPress={() => router.push('/stocks/on-hand-stock' as any)}
        >
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Stock Health</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </View>
          <SegmentedBar pct={d.stockHealthPct} color={COLORS.positive} />
          <View style={s.utilRow}>
            <Text style={s.utilPct}>{d.stockHealthPct}% healthy</Text>
            <Text style={s.utilFree}>{d.lowStockCount} low · {d.outOfStockCount} out</Text>
          </View>
        </TouchableOpacity>

        {/* ── Reorder Action Strip ── */}
        <TouchableOpacity
          style={s.reorder}
          activeOpacity={0.85}
          onPress={() => router.push('/stocks/reorder-queue' as any)}
        >
          <View style={s.reorderIcon}>
            <Ionicons name="repeat" size={18} color={COLORS.negative} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.reorderTitle}>Reorder Queue</Text>
            <Text style={s.reorderSub}>{d.reorderQueueCount} items need restocking · {d.reorderValue}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.negative} />
        </TouchableOpacity>

        {/* ── Reports & Analytics quick links ── */}
        <TouchableOpacity
          style={s.linkRow}
          activeOpacity={0.85}
          onPress={() => router.push('/stocks/reports' as any)}
        >
          <View style={s.linkIcon}>
            <Ionicons name="bar-chart-outline" size={17} color={COLORS.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.linkTitle}>Stock Reports</Text>
            <Text style={s.linkSub}>Valuation, ageing & summaries</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={s.linkRow}
          activeOpacity={0.85}
          onPress={() => router.push('/stocks/warehouses' as any)}
        >
          <View style={s.linkIcon}>
            <Ionicons name="business-outline" size={17} color={COLORS.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.linkTitle}>Warehouses</Text>
            <Text style={s.linkSub}>{d.warehouses.total} storage locations</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={COLORS.textTertiary} />
        </TouchableOpacity>

        {/* ── Stock Value by Category ── */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Stock Value by Category</Text>
            <TouchableOpacity onPress={() => router.push('/stocks/valuation-summary' as any)} activeOpacity={0.7}>
              <Text style={s.cardLink}>Report</Text>
            </TouchableOpacity>
          </View>
          {d.categories.map((c, i) => (
            <View key={c.label} style={s.catRow}>
              <Text style={s.catLabel} numberOfLines={1}>{c.label}</Text>
              <CategoryBar value={c.value} maxVal={maxCat} color={COLORS.brandPrimary} delay={i * 90} />
              <Text style={s.catValue}>{fmt(c.value)}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const cat = StyleSheet.create({
  track: { flex: 1, height: 10, backgroundColor: COLORS.borderDefault, borderRadius: 0, overflow: 'hidden' },
  fill:  { height: 10, borderRadius: 0 },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  headerSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2, fontWeight: '500' },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 110 },

  // Hero
  hero: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heroIcon: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center',
  },
  trendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  trendTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  heroLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  heroValue: { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -1, marginTop: 3 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  heroMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Grid tiles
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm + 2 },
  tile: {
    width: '48%', flexGrow: 1,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: 14, paddingVertical: 14, gap: 6, overflow: 'hidden',
  },
  tileIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  tileValue: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  tileSub:   { fontSize: 10, color: COLORS.textTertiary, fontWeight: '500' },

  // Generic card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm + 4 },
  cardTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: 0.1 },
  cardHint:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  cardLink:  { fontSize: TYPOGRAPHY.xs, color: COLORS.brandPrimary, fontWeight: '700' },

  // Utilisation
  utilRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  utilPct:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  utilFree: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },

  // Reorder strip
  reorder: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.negativeBg, borderRadius: RADIUS.lg,
    padding: 14, borderWidth: 1, borderColor: COLORS.negative + '30',
  },
  reorderIcon: {
    width: 38, height: 38, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.negative + '30',
  },
  reorderTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  reorderSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },

  // Quick link rows
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  linkIcon: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  linkTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  linkSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2, fontWeight: '500' },

  // Category bars
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  catLabel: { width: 78, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  catValue: { width: 62, textAlign: 'right', fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
});
