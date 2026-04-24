import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

interface ReportItem {
  id: string;
  label: string;
  desc: string;
  icon: string;
  route: string;
}

const REPORTS: ReportItem[] = [
  {
    id: 'stock-ledger',
    label: 'Stock Ledger',
    desc: 'Item-wise inward & outward log',
    icon: 'book-outline',
    route: '/stocks/stock-ledger',
  },
  {
    id: 'valuation',
    label: 'Valuation Summary',
    desc: 'Total stock value by category',
    icon: 'document-text-outline',
    route: '/stocks/valuation-summary',
  },
  {
    id: 'expiry',
    label: 'Expiry Schedule',
    desc: 'Items expiring by date',
    icon: 'timer-outline',
    route: '/stocks/expiry-schedule',
  },
  {
    id: 'fast-slow',
    label: 'Fast- vs Slow-Moving Analysis',
    desc: 'Velocity analysis of all SKUs',
    icon: 'swap-horizontal-outline',
    route: '/stocks/fast-slow',
  },
  {
    id: 'transfer',
    label: 'Transfer History',
    desc: 'Inter-warehouse stock transfers',
    icon: 'repeat-outline',
    route: '/stocks/transfer-history',
  },
  {
    id: 'snapshot',
    label: 'Stock Snapshot (as-of date)',
    desc: 'Point-in-time stock position',
    icon: 'camera-outline',
    route: '/stocks/stock-snapshot',
  },
  {
    id: 'negative',
    label: 'Negative Stock Exceptions',
    desc: 'Items with below-zero quantities',
    icon: 'alert-circle-outline',
    route: '/stocks/negative-stock',
  },
];

export default function StockReportsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Stock Reports</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Section Header */}
        <Text style={s.sectionLabel}>Report manager</Text>

        {/* Report List */}
        <View style={s.listCard}>
          {REPORTS.map((item, idx) => (
            <View key={item.id}>
              <TouchableOpacity
                style={s.row}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                {/* Icon box */}
                <View style={s.iconBox}>
                  <Ionicons name={item.icon as any} size={22} color={COLORS.brandPrimary} />
                </View>

                {/* Labels */}
                <View style={s.rowInfo}>
                  <Text style={s.rowLabel}>{item.label}</Text>
                  <Text style={s.rowDesc}>{item.desc}</Text>
                </View>

                {/* Chevron */}
                <Ionicons name="chevron-forward" size={18} color={COLORS.textTertiary} />
              </TouchableOpacity>

              {/* Divider (skip after last item) */}
              {idx < REPORTS.length - 1 && (
                <View style={s.divider} />
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:   { width: 40 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
  },

  scroll: { paddingTop: SPACING.md, paddingHorizontal: SPACING.md },

  sectionLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '600',
    color: COLORS.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 10, paddingLeft: 4,
  },

  listCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 16, gap: 14,
  },

  iconBox: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  rowInfo:  { flex: 1, gap: 2 },
  rowLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  rowDesc:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },

  divider: {
    height: 1, backgroundColor: COLORS.borderDefault,
    marginLeft: SPACING.md + 48 + 14,   // indent past icon
  },
});
