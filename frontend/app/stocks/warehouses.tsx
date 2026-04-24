import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

// ─── DATA ───────────────────────────────────────────────────────────────

export const WAREHOUSES = [
  { id: 'WH01', name: 'Mumbai Central',  location: 'Mumbai, MH',    racks: 24, rackLabel: '24C', utilization: 82, skus: 124, value: '₹28,50,000', manager: 'Ramesh K.',  qty: 4820 },
  { id: 'WH02', name: 'Delhi Hub',       location: 'New Delhi, DL', racks: 18, rackLabel: '18C', utilization: 64, skus: 89,  value: '₹19,20,000', manager: 'Sunita P.',  qty: 3600 },
  { id: 'WH03', name: 'Bangalore South', location: 'Bengaluru, KA', racks: 16, rackLabel: '16C', utilization: 71, skus: 67,  value: '₹14,80,000', manager: 'Arjun S.',   qty: 2485 },
  { id: 'WH04', name: 'Chennai Port',    location: 'Chennai, TN',   racks: 12, rackLabel: '12C', utilization: 45, skus: 42,  value: '₹9,60,000',  manager: 'Meena R.',   qty: 1900 },
  { id: 'WH05', name: 'Kolkata East',    location: 'Kolkata, WB',   racks: 20, rackLabel: '20C', utilization: 58, skus: 55,  value: '₹11,40,000', manager: 'Dipesh G.',  qty: 2320 },
];

// ─── RING CHART (outside screen component) ───────────────────────────────────────

function RingChart({ pct, size = 72 }: { pct: number; size?: number }) {
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ * (1 - pct / 100);
  const arc  = pct >= 85 ? COLORS.negative : '#A89060';

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={COLORS.borderDefault} strokeWidth={11}
      />
      {/* Progress arc */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={arc}
        strokeWidth={11}
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={off}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cy}`}
      />
      {/* Center label */}
      <SvgText
        x={cx} y={cy - 3}
        textAnchor="middle" fontSize="12" fontWeight="700"
        fill={COLORS.textPrimary}
      >
        {pct}%
      </SvgText>
      <SvgText
        x={cx} y={cy + 10}
        textAnchor="middle" fontSize="8"
        fill={COLORS.textTertiary}
      >
        util
      </SvgText>
    </Svg>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function WarehousesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = WAREHOUSES.filter(
    w =>
      w.name.toLowerCase().includes(query.toLowerCase()) ||
      w.location.toLowerCase().includes(query.toLowerCase()),
  );

  const totalSkus = WAREHOUSES.reduce((s, w) => s + w.skus, 0);
  const avgUtil   = Math.round(
    WAREHOUSES.reduce((s, w) => s + w.utilization, 0) / WAREHOUSES.length,
  );
  const utilColor = avgUtil >= 85 ? COLORS.negative : '#A89060';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Warehouses</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/stocks/create-warehouse' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Warehouses',      value: `${WAREHOUSES.length}`,  clr: COLORS.textPrimary },
          { label: 'Avg Utilization', value: `${avgUtil}%`,           clr: utilColor          },
          { label: 'Total SKUs',      value: `${totalSkus}`,          clr: COLORS.textPrimary },
        ].map((s, i) => (
          <View key={i} style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: s.clr }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search warehouses..."
          placeholderTextColor={COLORS.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {filtered.map(wh => (
          <TouchableOpacity
            key={wh.id}
            style={styles.whCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/stocks/warehouse-detail?id=${wh.id}` as any)}
          >
            {/* Main row */}
            <View style={styles.cardMain}>
              {/* Icon */}
              <View style={styles.whIcon}>
                <Ionicons name="business-outline" size={20} color={COLORS.white} />
              </View>

              {/* Info */}
              <View style={styles.whInfo}>
                <Text style={styles.whName}>{wh.name}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={11} color={COLORS.textTertiary} />
                  <Text style={styles.locationTxt}>{wh.location}</Text>
                </View>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Ionicons name="grid-outline" size={9} color={COLORS.textSecondary} />
                    <Text style={styles.badgeTxt}>#Racks · {wh.rackLabel}</Text>
                  </View>
                  <View style={styles.badge}>
                    <Ionicons name="cube-outline" size={9} color={COLORS.textSecondary} />
                    <Text style={styles.badgeTxt}>{wh.skus} SKUs</Text>
                  </View>
                </View>
              </View>

              {/* Ring chart */}
              <RingChart pct={wh.utilization} />
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <Ionicons name="person-outline" size={11} color={COLORS.textTertiary} />
              <Text style={styles.managerTxt}>{wh.manager}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.valueTxt}>{wh.value}</Text>
              <Ionicons name="chevron-forward" size={13} color={COLORS.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:     { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700',
    color: COLORS.textPrimary, textAlign: 'center',
  },
  addBtn: { width: 40, alignItems: 'flex-end' },

  summaryRow:  {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingVertical: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal:  { fontSize: TYPOGRAPHY.xl, fontWeight: '800' },
  summaryLabel:{ fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: SPACING.md, marginTop: 12, marginBottom: 4,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0,
  },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 10 },

  whCard:   {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 12 },
  whIcon:   {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center',
  },
  whInfo:      { flex: 1, gap: 4 },
  whName:      { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  badgeRow:    { flexDirection: 'row', gap: 6, marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.pageBg, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  badgeTxt: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  managerTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  valueTxt:   { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
});
