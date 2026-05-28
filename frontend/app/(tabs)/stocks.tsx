import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { KPICardSkeleton, CardSkeleton } from '../../src/components/ShimmerPlaceholder';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
// No mock data imports — real data only (V2 rule)
import { useAuth } from '../../src/context/AuthContext';
import { getStockDashboard, getWarehouses } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

const DARK = '#1A1A1A';

const ICON_COLOR = COLORS.textSecondary;  // #787774 — matches Home & Reports
const ICON_BG    = COLORS.pageBg;         // #F5F4EF — matches Home & Reports

const SHORTCUTS = [
  { id: 'report',   label: 'Report',         icon: 'bar-chart-outline', color: ICON_COLOR, bg: ICON_BG, route: '/stocks/reports'  },
  { id: 'settings', label: 'Stock Settings', icon: 'options-outline',   color: ICON_COLOR, bg: ICON_BG, route: '/stocks/settings' },
  { id: 'barcode',  label: 'Barcode',         icon: 'barcode-outline',   color: ICON_COLOR, bg: ICON_BG, route: '/stocks/barcodes' },
];

const WIDGET_TILES = [
  {
    id: 'total_stock', title: 'Total Stock',
    icon: 'cube-outline', iconColor: ICON_COLOR, iconBg: ICON_BG,
    route: '/stocks/total-stock',
    getValue: (d: any) => [
      { label: 'SKUs',  value: d?.totalQty  ?? '0' },
      { label: 'Value', value: d?.totalValue ?? '₹0' },
    ],
  },
  {
    id: 'warehouses', title: 'Warehouses',
    icon: 'business-outline', iconColor: ICON_COLOR, iconBg: ICON_BG,
    route: '/stocks/warehouses',
    getValue: (d: any) => [
      { label: 'Total', value: String(d?.warehouseCount ?? 0) },
    ],
  },
  {
    id: 'low_stock', title: 'Low-Stock Alerts',
    icon: 'alert-circle-outline', iconColor: '#DC2626', iconBg: '#FEF2F2',
    route: '/stocks/reorder-queue',
    getValue: (d: any) => [
      { label: 'Low Stock',   value: String(d?.lowStockCount ?? 0) },
      { label: 'Out of Stock', value: String(d?.outOfStock   ?? 0) },
    ],
  },
  {
    id: 'fast_moving', title: 'Fast / Slow Moving',
    icon: 'flash-outline', iconColor: ICON_COLOR, iconBg: ICON_BG,
    route: '/stocks/fast-slow',
    getValue: (_d: any) => [
      { label: 'View Analysis', value: '→' },
    ],
  },
  {
    id: 'negative', title: 'Negative Stock',
    icon: 'trending-down-outline', iconColor: '#DC2626', iconBg: '#FEF2F2',
    route: '/stocks/negative-stock',
    getValue: (_d: any) => [
      { label: 'View Items', value: '→' },
    ],
  },
];

export default function StocksDashboard() {
  const router = useRouter();
  const { company, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;
  const [stockSummary, setStockSummary] = useState<any>(null);
  const [apiError, setApiError]          = useState<string | null>(null);
  const [isLoading, setIsLoading]        = useState(true);

  const { formatAmount } = useSettings();

  const loadStock = async () => {
    if (!companyGuid) return;
    setApiError(null);
    setIsLoading(true);
    try {
      const [dashRes, whRes] = await Promise.all([
        getStockDashboard(companyGuid),
        getWarehouses(companyGuid),
      ]);
      const d = dashRes?.data;
      const warehouses = Array.isArray(whRes?.data) ? whRes.data : [];
      setStockSummary({
        totalValue:      d?.totalValue  != null ? formatAmount(Math.round(+d.totalValue)) : '₹0',
        totalQty:        String(d?.totalItems  ?? 0),
        lowStockCount:   d?.lowStock    ?? 0,
        outOfStock:      d?.outOfStock  ?? 0,
        warehouseCount:  warehouses.length,
      });
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadStock(); }, [companyGuid, lastSyncAt]);

  const data = stockSummary;

  return (
    <SafeAreaView style={styles.safe}>
      {apiError && <ErrorBanner message={apiError} onRetry={loadStock} />}
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stock Dashboard</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Shortcut Icons Row */}
        <View style={styles.shortcutRow}>
          {SHORTCUTS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.shortcutBtn}
              onPress={() => router.push(s.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon as any} size={22} color={s.color} />
              </View>
              <Text style={styles.shortcutLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Widget Tiles */}
        {isLoading ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
              <View style={{ flex: 1 }}><KPICardSkeleton /></View>
              <View style={{ flex: 1 }}><KPICardSkeleton /></View>
            </View>
            <CardSkeleton height={100} />
            <CardSkeleton height={100} />
            <CardSkeleton height={100} />
          </>
        ) : null}
        {!isLoading && WIDGET_TILES.map(tile => {
          const metrics = tile.getValue(data);
          return (
            <TouchableOpacity
              key={tile.id}
              style={styles.widgetTile}
              onPress={() => router.push(tile.route as any)}
              activeOpacity={0.8}
            >
              {/* Left: icon */}
              <View style={[styles.widgetIcon, { backgroundColor: tile.iconBg }]}>
                <Ionicons name={tile.icon as any} size={26} color={tile.iconColor} />
              </View>

              {/* Centre: title + metrics */}
              <View style={styles.widgetBody}>
                <Text style={styles.widgetTitle}>{tile.title}</Text>
                <View style={styles.metricsRow}>
                  {metrics.map((m, i) => (
                    <View key={i} style={styles.metricItem}>
                      <Text style={styles.metricLabel}>{m.label}:</Text>
                      <Text style={styles.metricValue}>{m.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Right: chevron */}
              <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  scroll:   { flex: 1 },
  content:  { padding: SPACING.md, gap: 10, paddingBottom: 110 },

  // Shortcut icons
  shortcutRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingVertical: 16, paddingHorizontal: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    marginBottom: 4,
  },
  shortcutBtn:   { alignItems: 'center', gap: 6 },
  shortcutIcon:  { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },

  // Widget tile
  widgetTile: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: 16, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  widgetIcon:  { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  widgetBody:  { flex: 1 },
  widgetTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  metricsRow:  { flexDirection: 'row', gap: 16 },
  metricItem:  { flexDirection: 'row', gap: 4, alignItems: 'center' },
  metricLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '500' },
  metricValue: { fontSize: TYPOGRAPHY.sm, color: DARK, fontWeight: '700' },
});
