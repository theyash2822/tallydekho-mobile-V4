import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, {
  Path, Defs, LinearGradient, Stop, Rect,
  Line, Circle, Text as SvgText,
} from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { getMovementAnalytics, getMovementChart } from '../../src/services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const SW          = Dimensions.get('window').width;
const CHART_H     = 190;
const PAD         = { top: 28, right: 16, bottom: 36, left: 56 };
const DAY_W       = 44;               // px per day column
const CHART_LINE  = '#C9A227';        // gold line colour
const CHART_FILL  = '#C9A22720';      // translucent fill

// ── Types ─────────────────────────────────────────────────────────────────────
interface MovItem {
  name: string; sku: string; category: string;
  closing_qty: number; closing_rate: number; total_value: number;
  outward_qty: number; outward_value: number; tr: number; dsi: number | null;
}
interface ChartDay { date: string; value: number; qty: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const compactAmt = (n: number) => {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};
const fmtShortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

// ── Line Chart ─────────────────────────────────────────────────────────────────
function LineChart({ data, onPointPress, activeIdx }: {
  data: ChartDay[];
  onPointPress: (idx: number) => void;
  activeIdx: number | null;
}) {
  if (!data.length) return null;

  const innerW = DAY_W * data.length;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const maxV   = Math.max(...data.map(d => d.value), 1);
  const minV   = 0;

  // Y axis labels (4 evenly spaced)
  const yLabels = [0, 1, 2, 3].map(i => {
    const v = minV + (maxV - minV) * (i / 3);
    return { v, y: PAD.top + innerH - (innerH * (i / 3)) };
  });

  // Build SVG path
  const pts = data.map((d, i) => {
    const x = PAD.left + i * DAY_W + DAY_W / 2;
    const y = PAD.top + innerH - (innerH * ((d.value - minV) / (maxV - minV || 1)));
    return { x, y, d };
  });

  const linePath = pts
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join(' ');

  const areaPath = [
    `M${pts[0].x},${PAD.top + innerH}`,
    ...pts.map(p => `L${p.x},${p.y}`),
    `L${pts[pts.length - 1].x},${PAD.top + innerH}`,
    'Z',
  ].join(' ');

  const totalW = PAD.left + innerW + PAD.right;

  return (
    <View style={{ width: totalW }}>
      <Svg width={totalW} height={CHART_H}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={CHART_LINE} stopOpacity="0.3" />
            <Stop offset="1"   stopColor={CHART_LINE} stopOpacity="0"   />
          </LinearGradient>
        </Defs>

        {/* Y grid lines + labels */}
        {yLabels.map((yl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD.left} y1={yl.y}
              x2={totalW - PAD.right} y2={yl.y}
              stroke={COLORS.borderDefault} strokeWidth="1"
            />
            <SvgText
              x={PAD.left - 6} y={yl.y + 4}
              fontSize={9} fill={COLORS.textTertiary}
              textAnchor="end"
            >
              {compactAmt(yl.v)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#fill)" />

        {/* Line */}
        <Path d={linePath} stroke={CHART_LINE} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* X-axis date labels (every 5 days) */}
        {pts.map((p, i) => {
          if (i % 5 !== 0 && i !== pts.length - 1) return null;
          return (
            <SvgText
              key={i}
              x={p.x} y={CHART_H - 6}
              fontSize={9} fill={COLORS.textTertiary}
              textAnchor="middle"
            >
              {fmtShortDate(p.d.date)}
            </SvgText>
          );
        })}

        {/* Active point */}
        {activeIdx !== null && pts[activeIdx] && (
          <>
            <Line
              x1={pts[activeIdx].x} y1={PAD.top}
              x2={pts[activeIdx].x} y2={PAD.top + innerH}
              stroke={CHART_LINE} strokeWidth="1" strokeDasharray="4,3"
            />
            <Circle
              cx={pts[activeIdx].x} cy={pts[activeIdx].y}
              r="5" fill={CHART_LINE} stroke="#fff" strokeWidth="2"
            />
          </>
        )}
      </Svg>

      {/* Tap overlay — one pressable per day */}
      <View style={[StyleSheet.absoluteFill, { left: PAD.left, right: PAD.right, top: PAD.top, bottom: PAD.bottom, flexDirection: 'row' }]}>
        {data.map((_, i) => (
          <TouchableOpacity
            key={i}
            style={{ width: DAY_W, height: '100%' }}
            onPress={() => onPointPress(i)}
            activeOpacity={1}
          />
        ))}
      </View>
    </View>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({
  item, selected, onPress, formatAmountCompact,
}: {
  item: MovItem; selected: boolean; onPress: () => void; formatAmountCompact: (n: number) => string;
}) {
  return (
    <TouchableOpacity
      style={[s.itemRow, selected && s.itemRowSel]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.itemLeft}>
        <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
        {item.sku ? <Text style={s.itemSku}>{item.sku}</Text> : null}
      </View>
      <View style={s.itemMetrics}>
        <View style={s.metric}>
          <Text style={s.metricVal}>{item.tr.toFixed(1)}x</Text>
          <Text style={s.metricLbl}>TR</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricVal}>{item.dsi != null ? `${item.dsi}d` : '—'}</Text>
          <Text style={s.metricLbl}>DSI</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricVal}>{formatAmountCompact(item.total_value)}</Text>
          <Text style={s.metricLbl}>Value</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MovementAnalyticsScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const { formatAmountCompact } = useSettings();
  const companyGuid = company?.guid;
  const fyParam     = fyInfoToParam(selectedFY);

  // Items list
  const [items,      setItems]      = useState<MovItem[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [apiError,   setApiError]   = useState<string | null>(null);

  // Chart
  const [selectedItem, setSelectedItem]   = useState<string | null>(null);
  const [chartData,    setChartData]      = useState<ChartDay[]>([]);
  const [chartLoading, setChartLoading]   = useState(false);
  const [activeIdx,    setActiveIdx]      = useState<number | null>(null);
  const chartScrollRef = useRef<ScrollView>(null);

  // Load items
  const loadItems = useCallback(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    const params: Record<string, string> = {};
    if (fyParam) params.fy = fyParam;
    getMovementAnalytics(companyGuid, params)
      .then((res: any) => {
        const data: MovItem[] = res?.data ?? [];
        setItems(data);
        // Auto-select first item
        if (data.length > 0 && !selectedItem) {
          setSelectedItem(data[0].name);
        }
      })
      .catch((e: any) => setApiError(e?.message || 'Failed to load movement analytics'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, fyParam]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Load chart data when selected item changes
  useEffect(() => {
    if (!selectedItem || !companyGuid) return;
    setChartLoading(true);
    setActiveIdx(null);
    getMovementChart(companyGuid, { item: selectedItem })
      .then((res: any) => {
        setChartData(res?.data ?? []);
        // Scroll chart to end (most recent date)
        setTimeout(() => chartScrollRef.current?.scrollToEnd({ animated: false }), 100);
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [selectedItem, companyGuid]);

  const activePoint = activeIdx !== null ? chartData[activeIdx] : null;
  const selectedItemData = items.find(i => i.name === selectedItem);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Movement Analytics</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Error */}
      {apiError && <ErrorBanner message={apiError} onRetry={loadItems} />}

      <FlatList
        data={isLoading ? [] : items}
        keyExtractor={item => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={
          <View>
            {/* Chart card */}
            <View style={s.chartCard}>
              {/* Selected item + active point info */}
              <View style={s.chartInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.chartItemName} numberOfLines={1}>
                    {selectedItemData?.name ?? 'Select an item'}
                  </Text>
                  {selectedItemData && (
                    <Text style={s.chartSubtitle}>
                      TR {selectedItemData.tr.toFixed(1)}x
                      {selectedItemData.dsi != null ? `  ·  DSI ${selectedItemData.dsi}d` : ''}
                    </Text>
                  )}
                </View>
                {activePoint && activePoint.value > 0 ? (
                  <View style={s.activePoint}>
                    <Text style={s.activeVal}>{compactAmt(activePoint.value)}</Text>
                    <Text style={s.activeDate}>{fmtShortDate(activePoint.date)}</Text>
                  </View>
                ) : (
                  <Text style={s.chartHint}>Tap chart to inspect</Text>
                )}
              </View>

              {/* Chart */}
              {chartLoading ? (
                <View style={s.chartLoading}>
                  <ActivityIndicator size="small" color={CHART_LINE} />
                </View>
              ) : chartData.length > 0 && chartData.some(d => d.value > 0) ? (
                <ScrollView
                  ref={chartScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.chartScroll}
                >
                  <LineChart
                    data={chartData}
                    onPointPress={setActiveIdx}
                    activeIdx={activeIdx}
                  />
                </ScrollView>
              ) : (
                <View style={s.chartEmpty}>
                  <Text style={s.chartEmptyTxt}>No sales in last 30 days</Text>
                </View>
              )}
            </View>

            {/* Section label */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Items by Turnover Ratio</Text>
              <Text style={s.sectionSub}>{items.length} items · {selectedFY?.label ?? 'Current FY'}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            selected={item.name === selectedItem}
            onPress={() => setSelectedItem(item.name)}
            formatAmountCompact={formatAmountCompact}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: SPACING.md }}>
              {[...Array(5)].map((_, i) => <LedgerRowSkeleton key={i} />)}
            </View>
          ) : !apiError ? (
            <View style={s.empty}>
              <Ionicons name="analytics-outline" size={48} color={COLORS.textTertiary} />
              <Text style={s.emptyTxt}>No movement data for this FY</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 12,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },

  // Chart card
  chartCard: {
    margin: SPACING.md, backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden',
  },
  chartInfo: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  chartItemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chartSubtitle: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  chartHint:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  activePoint:   { alignItems: 'flex-end' },
  activeVal:     { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: CHART_LINE },
  activeDate:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  chartScroll:   { },
  chartLoading:  { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  chartEmpty:    { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  chartEmptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // Section header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs,
  },
  sectionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  sectionSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  // Item row
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md,
  },
  itemRowSel: { borderColor: CHART_LINE, borderWidth: 1.5 },
  itemLeft:   { flex: 1, marginRight: SPACING.sm },
  itemName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSku:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },

  itemMetrics: { flexDirection: 'row', gap: SPACING.md },
  metric:      { alignItems: 'center' },
  metricVal:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  metricLbl:   { fontSize: 9, color: COLORS.textTertiary, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Empty
  empty:    { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
