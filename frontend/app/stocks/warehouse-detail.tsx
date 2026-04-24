import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';

// ─── MOCK DATA ──────────────────────────────────────────────────────────────

type StockTile = { total: number; skus: number; qty: number; value: string };
type Activity  = { id: string; type: string; ref: string; date: string; icon: string; iconColor: string; iconBg: string; delta: string };
type WHDetail  = { name: string; location: string; racks: number; manager: string; phone: string; totalStock: StockTile; onHandStock: StockTile; activity: Activity[] };

const WH_DETAILS: Record<string, WHDetail> = {
  WH01: {
    name: 'Mumbai Central', location: 'Mumbai, MH', racks: 24,
    manager: 'Ramesh K.',  phone: '+91 98765 43210',
    totalStock:  { total: 4820, skus: 124, qty: 4820, value: '₹28,50,000' },
    onHandStock: { total: 4200, skus: 118, qty: 4200, value: '₹25,80,000' },
    activity: [
      { id: 'A1', type: 'Stock Transfer',    ref: 'SI-1024', date: '23 Jun', icon: 'swap-horizontal-outline', iconColor: COLORS.info,     iconBg: COLORS.infoBg,     delta: '-120' },
      { id: 'A2', type: 'Sales Invoice',     ref: 'INV-172', date: '19 Jun', icon: 'arrow-up-outline',        iconColor: COLORS.negative, iconBg: COLORS.negativeBg, delta: '-45'  },
      { id: 'A3', type: 'Stock Adjustment',  ref: 'ADJ-089', date: '14 Jun', icon: 'construct-outline',       iconColor: COLORS.warning,  iconBg: COLORS.warningBg,  delta: '+8'   },
      { id: 'A4', type: 'Purchase Invoice',  ref: 'PI-456',  date: '10 Jun', icon: 'arrow-down-outline',      iconColor: COLORS.positive, iconBg: COLORS.positiveBg, delta: '+200' },
    ],
  },
  WH02: {
    name: 'Delhi Hub', location: 'New Delhi, DL', racks: 18,
    manager: 'Sunita P.', phone: '+91 87654 32109',
    totalStock:  { total: 3600, skus: 89, qty: 3600, value: '₹19,20,000' },
    onHandStock: { total: 3200, skus: 84, qty: 3200, value: '₹17,10,000' },
    activity: [
      { id: 'B1', type: 'Purchase Invoice',  ref: 'PI-820',  date: '22 Jun', icon: 'arrow-down-outline',      iconColor: COLORS.positive, iconBg: COLORS.positiveBg, delta: '+300' },
      { id: 'B2', type: 'Sales Invoice',     ref: 'INV-241', date: '18 Jun', icon: 'arrow-up-outline',        iconColor: COLORS.negative, iconBg: COLORS.negativeBg, delta: '-60'  },
      { id: 'B3', type: 'Stock Transfer',    ref: 'TRF-044', date: '15 Jun', icon: 'swap-horizontal-outline', iconColor: COLORS.info,     iconBg: COLORS.infoBg,     delta: '-80'  },
      { id: 'B4', type: 'Stock Adjustment',  ref: 'ADJ-110', date: '12 Jun', icon: 'construct-outline',       iconColor: COLORS.warning,  iconBg: COLORS.warningBg,  delta: '+15'  },
    ],
  },
  WH03: {
    name: 'Bangalore South', location: 'Bengaluru, KA', racks: 16,
    manager: 'Arjun S.', phone: '+91 76543 21098',
    totalStock:  { total: 2485, skus: 67, qty: 2485, value: '₹14,80,000' },
    onHandStock: { total: 2200, skus: 63, qty: 2200, value: '₹13,10,000' },
    activity: [
      { id: 'C1', type: 'Sales Invoice',     ref: 'INV-098', date: '21 Jun', icon: 'arrow-up-outline',        iconColor: COLORS.negative, iconBg: COLORS.negativeBg, delta: '-30'  },
      { id: 'C2', type: 'Purchase Invoice',  ref: 'PI-302',  date: '17 Jun', icon: 'arrow-down-outline',      iconColor: COLORS.positive, iconBg: COLORS.positiveBg, delta: '+120' },
      { id: 'C3', type: 'Stock Transfer',    ref: 'TRF-021', date: '13 Jun', icon: 'swap-horizontal-outline', iconColor: COLORS.info,     iconBg: COLORS.infoBg,     delta: '+50'  },
    ],
  },
};

const DEFAULT_WH = WH_DETAILS.WH01;

// ─── ACTIVITY ITEM (outside main screen) ────────────────────────────────────────

function ActivityRow({ item }: { item: Activity }) {
  const isPos = item.delta.startsWith('+');
  return (
    <View style={as.row}>
      <View style={[as.iconBox, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon as any} size={15} color={item.iconColor} />
      </View>
      <View style={as.info}>
        <Text style={as.type}>{item.type}</Text>
        <Text style={as.ref}>{item.ref}</Text>
      </View>
      <View style={as.right}>
        <Text style={[as.delta, { color: isPos ? COLORS.positive : COLORS.negative }]}>{item.delta}</Text>
        <Text style={as.date}>{item.date}</Text>
      </View>
    </View>
  );
}
const as = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  iconBox:{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  info:   { flex: 1 },
  type:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  ref:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
  right:  { alignItems: 'flex-end' },
  delta:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  date:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 1 },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function WarehouseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const whId   = params.id || 'WH01';
  const wh     = WH_DETAILS[whId] || DEFAULT_WH;

  const [calOpen, setCalOpen]   = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const dateLabel = dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : 'All Time';

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Warehouse Detail</Text>
        <TouchableOpacity style={s.shareBtn} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Warehouse info card */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <View style={s.whIcon}>
              <Ionicons name="business-outline" size={24} color={COLORS.white} />
            </View>
            <View style={s.infoText}>
              <Text style={s.whName}>{wh.name}</Text>
              <View style={s.locRow}>
                <Ionicons name="location-outline" size={12} color={COLORS.textTertiary} />
                <Text style={s.locTxt}>{wh.location}</Text>
              </View>
              <View style={s.rackRow}>
                <View style={s.rackBadge}>
                  <Ionicons name="grid-outline" size={10} color={COLORS.textSecondary} />
                  <Text style={s.rackTxt}>{wh.racks} Racks</Text>
                </View>
                <View style={s.rackBadge}>
                  <Ionicons name="person-outline" size={10} color={COLORS.textSecondary} />
                  <Text style={s.rackTxt}>{wh.manager}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Total Stock tile */}
        <TouchableOpacity
          style={s.metricTile}
          activeOpacity={0.85}
          onPress={() => router.push(`/stocks/total-stock?whId=${whId}` as any)}
        >
          <View style={s.tileHeader}>
            <View style={s.tileIconWrap}>
              <Ionicons name="layers-outline" size={18} color={'#A89060'} />
            </View>
            <Text style={s.tileLabel}>Total Stock</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </View>
          <Text style={s.tileNumber}>{wh.totalStock.total.toLocaleString('en-IN')}</Text>
          <View style={s.subMetricRow}>
            <View style={s.subMetric}>
              <Text style={s.subVal}>{wh.totalStock.skus}</Text>
              <Text style={s.subLbl}>No. of SKUs</Text>
            </View>
            <View style={s.subDivider} />
            <View style={s.subMetric}>
              <Text style={s.subVal}>{wh.totalStock.qty.toLocaleString('en-IN')}</Text>
              <Text style={s.subLbl}>Quantity</Text>
            </View>
            <View style={s.subDivider} />
            <View style={s.subMetric}>
              <Text style={s.subVal}>{wh.totalStock.value}</Text>
              <Text style={s.subLbl}>Value (INR)</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* On Hand Stock tile */}
        <TouchableOpacity
          style={[s.metricTile, s.onHandTile]}
          activeOpacity={0.85}
          onPress={() => router.push(`/stocks/on-hand-stock?whId=${whId}` as any)}
        >
          <View style={s.tileHeader}>
            <View style={[s.tileIconWrap, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.info} />
            </View>
            <Text style={s.tileLabel}>On Hand Stock</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
          </View>
          <Text style={s.tileNumber}>{wh.onHandStock.total.toLocaleString('en-IN')}</Text>
          <View style={s.subMetricRow}>
            <View style={s.subMetric}>
              <Text style={s.subVal}>{wh.onHandStock.skus}</Text>
              <Text style={s.subLbl}>No. of SKUs</Text>
            </View>
            <View style={s.subDivider} />
            <View style={s.subMetric}>
              <Text style={s.subVal}>{wh.onHandStock.qty.toLocaleString('en-IN')}</Text>
              <Text style={s.subLbl}>Quantity</Text>
            </View>
            <View style={s.subDivider} />
            <View style={s.subMetric}>
              <Text style={s.subVal}>{wh.onHandStock.value}</Text>
              <Text style={s.subLbl}>Value (INR)</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Recent Activity */}
        <View style={s.activityCard}>
          <View style={s.activityHeader}>
            <Text style={s.activityTitle}>Recent Activity</Text>
            <TouchableOpacity
              style={s.calBtn}
              onPress={() => setCalOpen(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={15} color={COLORS.brandPrimary} />
              <Text style={s.calBtnTxt}>{dateLabel}</Text>
            </TouchableOpacity>
          </View>
          {wh.activity.map((act, idx) => (
            <ActivityRow key={act.id} item={act} />
          ))}
        </View>

        {/* Action row */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push('/stocks/create-transfer' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.brandPrimary} />
            <Text style={s.actionTxt}>Transfer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push('/stocks/create-adjustment' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="construct-outline" size={16} color={COLORS.brandPrimary} />
            <Text style={s.actionTxt}>Adjust</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={16} color={COLORS.white} />
            <Text style={[s.actionTxt, { color: COLORS.white }]}>Export</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DateRangePickerModal
        visible={calOpen}
        onClose={() => setCalOpen(false)}
        onApply={(from, to) => { setDateFrom(from); setDateTo(to); }}
      />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:    { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 12 },

  // Info card
  infoCard:  { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  infoRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  whIcon:    { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  infoText:  { flex: 1, gap: 5 },
  whName:    { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  locRow:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locTxt:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  rackRow:   { flexDirection: 'row', gap: 8, marginTop: 2 },
  rackBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.pageBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderDefault },
  rackTxt:   { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },

  // Metric tiles
  metricTile: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  onHandTile: { borderColor: `${COLORS.info}30` },
  tileHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tileIconWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(168,144,96,0.12)', alignItems: 'center', justifyContent: 'center' },
  tileLabel:  { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tileNumber: { fontSize: TYPOGRAPHY.xxxl, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12 },
  subMetricRow: { flexDirection: 'row', alignItems: 'center' },
  subMetric:  { flex: 1, alignItems: 'center' },
  subDivider: { width: 1, height: 28, backgroundColor: COLORS.borderDefault },
  subVal:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  subLbl:     { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },

  // Activity
  activityCard:   { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  activityTitle:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  calBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.pageBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: COLORS.borderDefault },
  calBtnTxt:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '600' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  actionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
});
