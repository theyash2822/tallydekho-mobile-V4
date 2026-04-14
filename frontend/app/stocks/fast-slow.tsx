import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Rect, Text as SvgText, Circle } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const W = Dimensions.get('window').width;
const CARD_W = W - SPACING.md * 2;

const FAST_MOVING = [
  { rank: 1, name: 'JBL Speaker – BT50', sku: 'JBL-BT50', sold: 142, velocity: 4.7, trend: 'up', color: '#2D7D46' },
  { rank: 2, name: 'Sony WH-1000XM5', sku: 'SNY-001', sold: 118, velocity: 3.9, trend: 'up', color: '#2D7D46' },
  { rank: 3, name: 'USB Type-C Cable 2m', sku: 'USB-C-2M', sold: 96, velocity: 3.2, trend: 'stable', color: '#D97706' },
  { rank: 4, name: 'Wireless Mouse Logitech', sku: 'LGT-MS01', sold: 87, velocity: 2.9, trend: 'up', color: '#2D7D46' },
  { rank: 5, name: 'HDMI Cable 3m', sku: 'HDMI-3M', sold: 74, velocity: 2.5, trend: 'down', color: '#DC2626' },
];

const SLOW_MOVING = [
  { rank: 1, name: 'VGA Adapter Dongle', sku: 'VGA-DNG', sold: 3, daysInStock: 180, value: '₹2,400', color: '#DC2626' },
  { rank: 2, name: 'CD-ROM External Drive', sku: 'CDR-EXT', sold: 1, daysInStock: 240, value: '₹3,200', color: '#DC2626' },
  { rank: 3, name: 'Ethernet Hub 8-Port', sku: 'ETH-H8', sold: 4, daysInStock: 150, value: '₹6,800', color: '#D97706' },
  { rank: 4, name: 'PS/2 Keyboard Old', sku: 'PS2-KB', sold: 2, daysInStock: 200, value: '₹1,600', color: '#DC2626' },
  { rank: 5, name: 'VGA Monitor Cable', sku: 'VGA-MC', sold: 5, daysInStock: 120, value: '₹3,750', color: '#D97706' },
];

const BAR_DATA = [
  { cat: 'Electronics', fast: 68, slow: 12 },
  { cat: 'Cables', fast: 45, slow: 28 },
  { cat: 'Audio', fast: 72, slow: 8 },
  { cat: 'Peripherals', fast: 38, slow: 22 },
];

const maxBar = 100;

function ClassificationChart() {
  const svgW = CARD_W - SPACING.md * 2;
  const svgH = 100;
  const bW = 20;
  const gap = 6;
  const groupW = bW * 2 + gap + 20;
  return (
    <Svg width={svgW} height={svgH + 24}>
      {BAR_DATA.map((d, i) => {
        const x = 8 + i * groupW;
        const fH = (d.fast / maxBar) * svgH;
        const sH = (d.slow / maxBar) * svgH;
        const lx = x + bW + gap / 2;
        return (
          <React.Fragment key={d.cat}>
            <Rect x={x} y={svgH - fH} width={bW} height={fH} rx={4} fill="#2D7D46" opacity={0.85} />
            <Rect x={x + bW + gap} y={svgH - sH} width={bW} height={sH} rx={4} fill="#DC2626" opacity={0.85} />
            <SvgText x={lx} y={svgH + 14} textAnchor="middle" fontSize={8} fill={COLORS.textTertiary}>{d.cat}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function FastSlowMovingScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'fast' | 'slow'>('fast');
  const [activePeriod, setActivePeriod] = useState('1M');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Fast vs Slow Moving</Text>
        <TouchableOpacity style={s.exportBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Period Filters */}
      <View style={s.periodRow}>
        {['7D', '1M', '3M', '6M'].map(p => (
          <TouchableOpacity key={p} style={[s.periodBtn, activePeriod === p && s.periodActive]} onPress={() => setActivePeriod(p)} activeOpacity={0.7}>
            <Text style={[s.periodTxt, activePeriod === p && s.periodActiveTxt]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary Badges */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderTopColor: '#2D7D46', borderTopWidth: 3 }]}>
            <Text style={[s.summaryVal, { color: '#2D7D46' }]}>62%</Text>
            <Text style={s.summaryLbl}>Fast Moving</Text>
            <Text style={s.summaryCount}>234 SKUs</Text>
          </View>
          <View style={[s.summaryCard, { borderTopColor: '#DC2626', borderTopWidth: 3 }]}>
            <Text style={[s.summaryVal, { color: '#DC2626' }]}>38%</Text>
            <Text style={s.summaryLbl}>Slow Moving</Text>
            <Text style={s.summaryCount}>143 SKUs</Text>
          </View>
        </View>

        {/* Classification Chart */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>By Category</Text>
            <View style={s.legend}>
              <View style={s.legendRow}><View style={[s.dot, { backgroundColor: '#2D7D46' }]} /><Text style={s.legendTxt}>Fast</Text></View>
              <View style={s.legendRow}><View style={[s.dot, { backgroundColor: '#DC2626' }]} /><Text style={s.legendTxt}>Slow</Text></View>
            </View>
          </View>
          <ClassificationChart />
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TouchableOpacity style={[s.tab, activeTab === 'fast' && s.tabActive]} onPress={() => setActiveTab('fast')} activeOpacity={0.7}>
            <Text style={[s.tabTxt, activeTab === 'fast' && s.tabTxtActive]}>⚡ Fast Moving Top 5</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tab, activeTab === 'slow' && s.tabActive]} onPress={() => setActiveTab('slow')} activeOpacity={0.7}>
            <Text style={[s.tabTxt, activeTab === 'slow' && s.tabTxtActive]}>🐢 Slow Moving Top 5</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'fast' && (
          <View style={s.card}>
            {FAST_MOVING.map((item, i) => (
              <View key={item.rank} style={[s.itemRow, i < FAST_MOVING.length - 1 && s.rowBorder]}>
                <View style={[s.rankBadge, { backgroundColor: item.rank <= 3 ? '#FFFBEB' : COLORS.pageBg }]}>
                  <Text style={[s.rankTxt, { color: item.rank <= 3 ? '#D97706' : COLORS.textTertiary }]}>#{item.rank}</Text>
                </View>
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemSku}>{item.sku}</Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={s.itemSold}>{item.sold} sold</Text>
                  <View style={s.velocityRow}>
                    <Ionicons name={item.trend === 'up' ? 'trending-up' : item.trend === 'down' ? 'trending-down' : 'remove'} size={12} color={item.color} />
                    <Text style={[s.velocityTxt, { color: item.color }]}>{item.velocity}/day</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'slow' && (
          <View style={s.card}>
            {SLOW_MOVING.map((item, i) => (
              <View key={item.rank} style={[s.itemRow, i < SLOW_MOVING.length - 1 && s.rowBorder]}>
                <View style={[s.rankBadge, { backgroundColor: '#FDECEA' }]}>
                  <Text style={[s.rankTxt, { color: '#DC2626' }]}>#{item.rank}</Text>
                </View>
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{item.name}</Text>
                  <Text style={s.itemSku}>{item.sku}</Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={[s.itemSold, { color: '#DC2626' }]}>{item.sold} sold</Text>
                  <Text style={s.daysInStock}>{item.daysInStock}d in stock</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  exportBtn: { width: 40, alignItems: 'flex-end' },
  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  periodActive: { backgroundColor: COLORS.brandPrimary },
  periodTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodActiveTxt: { color: COLORS.white },
  summaryRow: { flexDirection: 'row', gap: 10, padding: SPACING.md },
  summaryCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center' },
  summaryVal: { fontSize: TYPOGRAPHY.xxl, fontWeight: '800' },
  summaryLbl: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
  summaryCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  legend: { flexDirection: 'row', gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  tabs: { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: SPACING.md },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.brandPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '500', color: COLORS.textSecondary },
  tabTxtActive: { fontWeight: '700', color: COLORS.textPrimary },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  rankBadge: { width: 36, height: 36, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  rankTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  itemRight: { alignItems: 'flex-end' },
  itemSold: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  velocityRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  velocityTxt: { fontSize: 10, fontWeight: '700' },
  daysInStock: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },
});
