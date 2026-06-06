import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, {
  Path, Defs, LinearGradient, Stop,
  Line, Circle, Text as SvgText,
} from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { getMovementAnalytics, getMovementChart } from '../../src/services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const CHART_H   = 200;
const Y_AXIS_W  = 54;
const PAD       = { top: 24, right: 16, bottom: 36 };
const DAY_W     = 44;
const CHART_OUT = '#C9A227';   // gold  — sold / outward
const CHART_IN  = '#27A96C';   // green — purchased / inward

// ── Types ─────────────────────────────────────────────────────────────────────
interface MovItem {
  name: string; sku: string; category: string;
  closing_qty: number; closing_rate: number; total_value: number;
  outward_qty: number; outward_value: number; tr: number; dsi: number | null;
  sold_out?: boolean;
}
interface ChartDay {
  date: string;
  value: number;         // outward value (sold)
  qty: number;           // outward qty
  inward_value: number;  // inward value (purchased/received)
  inward_qty: number;    // inward qty
}

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

// ── Two-line Chart (gold = sold/outward, green = purchased/inward) ─────────────
function LineChart({
  data, onPointPress, activeIdx,
}: {
  data: ChartDay[];
  onPointPress: (idx: number) => void;
  activeIdx: number | null;
}) {
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const maxV   = Math.max(...data.map(d => Math.max(d.value, d.inward_value)), 1);

  const yLabels = [0, 1, 2, 3].map(i => ({
    v: maxV * (i / 3),
    y: PAD.top + innerH - innerH * (i / 3),
  }));

  const outPts = data.map((d, i) => ({
    x: i * DAY_W + DAY_W / 2,
    y: PAD.top + innerH - innerH * (d.value / maxV),
    d,
  }));
  const inPts = data.map((d, i) => ({
    x: i * DAY_W + DAY_W / 2,
    y: PAD.top + innerH - innerH * (d.inward_value / maxV),
    d,
  }));

  const scrollW  = DAY_W * data.length + PAD.right;
  const outPath  = outPts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const inPath   = inPts.map((p,  i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaPath = [
    `M${outPts[0].x},${PAD.top + innerH}`,
    ...outPts.map(p => `L${p.x},${p.y}`),
    `L${outPts[outPts.length - 1].x},${PAD.top + innerH}`, 'Z',
  ].join(' ');

  return (
    <View style={{ flexDirection: 'row', height: CHART_H }}>

      {/* ── Pinned Y-axis ── */}
      <Svg width={Y_AXIS_W} height={CHART_H}>
        {yLabels.map((yl, i) => (
          <Line key={i}
            x1={Y_AXIS_W - 4} y1={yl.y}
            x2={Y_AXIS_W}     y2={yl.y}
            stroke={COLORS.borderDefault} strokeWidth="1"
          />
        ))}
        {yLabels.map((yl, i) => (
          <SvgText key={i}
            x={Y_AXIS_W - 6} y={yl.y + 4}
            fontSize={9} fill={COLORS.textTertiary} textAnchor="end"
          >
            {compactAmt(yl.v)}
          </SvgText>
        ))}
        <Line
          x1={Y_AXIS_W} y1={PAD.top}
          x2={Y_AXIS_W} y2={PAD.top + innerH}
          stroke={COLORS.borderDefault} strokeWidth="1"
        />
      </Svg>

      {/* ── Scrollable chart ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View>
          <Svg width={scrollW} height={CHART_H}>
            <Defs>
              <LinearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={CHART_OUT} stopOpacity="0.25" />
                <Stop offset="1" stopColor={CHART_OUT} stopOpacity="0"    />
              </LinearGradient>
            </Defs>

            {/* Grid lines */}
            {yLabels.map((yl, i) => (
              <Line key={i}
                x1={0} y1={yl.y} x2={scrollW} y2={yl.y}
                stroke={COLORS.borderDefault} strokeWidth="1"
              />
            ))}

            {/* Outward area fill */}
            <Path d={areaPath} fill="url(#gradOut)" />

            {/* Outward line — gold (sold) */}
            <Path d={outPath} stroke={CHART_OUT} strokeWidth="2.5"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* Inward line — green (purchased/received) */}
            <Path d={inPath} stroke={CHART_IN} strokeWidth="2.5"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* X-axis date labels (every 5 entries + last) */}
            {outPts.map((p, i) => {
              if (i % 5 !== 0 && i !== outPts.length - 1) return null;
              return (
                <SvgText key={i}
                  x={p.x} y={CHART_H - 8}
                  fontSize={9} fill={COLORS.textTertiary} textAnchor="middle"
                >
                  {fmtShortDate(p.d.date)}
                </SvgText>
              );
            })}

            {/* Active vertical guideline */}
            {activeIdx !== null && outPts[activeIdx] && (
              <Line
                x1={outPts[activeIdx].x} y1={PAD.top}
                x2={outPts[activeIdx].x} y2={PAD.top + innerH}
                stroke={COLORS.textTertiary} strokeWidth="1.5" strokeDasharray="4,3"
              />
            )}
            {/* Active dot — outward (gold) */}
            {activeIdx !== null && outPts[activeIdx] && data[activeIdx].value > 0 && (
              <Circle
                cx={outPts[activeIdx].x} cy={outPts[activeIdx].y}
                r="5.5" fill={CHART_OUT} stroke="#fff" strokeWidth="2"
              />
            )}
            {/* Active dot — inward (green) */}
            {activeIdx !== null && inPts[activeIdx] && data[activeIdx].inward_value > 0 && (
              <Circle
                cx={inPts[activeIdx].x} cy={inPts[activeIdx].y}
                r="5.5" fill={CHART_IN} stroke="#fff" strokeWidth="2"
              />
            )}
          </Svg>

          {/* Transparent tap overlay */}
          <View style={[
            StyleSheet.absoluteFill,
            { flexDirection: 'row', top: PAD.top, bottom: PAD.bottom },
          ]}>
            {data.map((_, i) => (
              <TouchableOpacity
                key={i} style={{ width: DAY_W }}
                onPress={() => onPointPress(i)}
                activeOpacity={1}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({
  item, selected, onPress, formatAmountCompact,
}: {
  item: MovItem; selected: boolean; onPress: () => void;
  formatAmountCompact: (n: number) => string;
}) {
  const trDisplay  = item.sold_out ? '∞' : item.tr > 0 ? `${item.tr.toFixed(1)}x` : '—';
  const dsiDisplay = item.sold_out ? '0d' : item.dsi != null ? `${item.dsi}d` : '—';
  const trColor    = (item.sold_out || item.tr > 0) ? CHART_OUT : COLORS.textPrimary;

  return (
    <TouchableOpacity
      style={[s.itemRow, selected && s.itemRowSel]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.itemLeft}>
        <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
        <View style={s.itemSubRow}>
          {item.sku ? <Text style={s.itemSku}>{item.sku}</Text> : null}
          {item.sold_out && (
            <View style={s.soldBadge}>
              <Text style={s.soldBadgeTxt}>SOLD OUT</Text>
            </View>
          )}
        </View>
      </View>
      <View style={s.itemMetrics}>
        <View style={s.metric}>
          <Text style={[s.metricVal, { color: trColor }]}>{trDisplay}</Text>
          <Text style={s.metricLbl}>TR</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricVal}>{dsiDisplay}</Text>
          <Text style={s.metricLbl}>DSI</Text>
        </View>
        <View style={s.metric}>
          <Text style={s.metricVal}>
            {item.sold_out ? '₹0' : formatAmountCompact(item.total_value)}
          </Text>
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

  const [items,        setItems]        = useState<MovItem[]>([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [apiError,     setApiError]     = useState<string | null>(null);
  const [search,       setSearch]       = useState('');

  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [chartData,    setChartData]    = useState<ChartDay[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [activeIdx,    setActiveIdx]    = useState<number | null>(null);

  // Load all items
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
        if (data.length > 0 && !selectedItem) setSelectedItem(data[0].name);
      })
      .catch((e: any) => setApiError(e?.message || 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, fyParam]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Load chart for selected item
  useEffect(() => {
    if (!selectedItem || !companyGuid) return;
    setChartLoading(true);
    setActiveIdx(null);
    getMovementChart(companyGuid, { item: selectedItem })
      .then((res: any) => {
        const raw = res?.data ?? [];
        // Normalise — ensure inward fields always exist (backward compat)
        const normalised: ChartDay[] = raw.map((d: any) => ({
          date:         d.date,
          value:        parseFloat(d.value        ?? d.outward_value ?? 0),
          qty:          parseFloat(d.qty          ?? d.outward_qty   ?? 0),
          inward_value: parseFloat(d.inward_value ?? 0),
          inward_qty:   parseFloat(d.inward_qty   ?? 0),
        }));
        setChartData(normalised);
      })
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [selectedItem, companyGuid]);

  const filtered = search.trim()
    ? items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.sku && i.sku.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  const activePoint      = activeIdx !== null ? chartData[activeIdx] : null;
  const selectedItemData = items.find(i => i.name === selectedItem);
  const hasChartData     = chartData.some(d => d.value > 0 || d.inward_value > 0);

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

      {apiError && <ErrorBanner message={apiError} onRetry={loadItems} />}

      <FlatList
        data={isLoading ? [] : filtered}
        keyExtractor={item => item.name}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        ListHeaderComponent={
          <View>
            {/* ── Chart card ── */}
            <View style={s.chartCard}>

              {/* Item info + active point tooltip */}
              <View style={s.chartInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={s.chartItemName} numberOfLines={1}>
                    {selectedItemData?.name ?? '—'}
                  </Text>
                  <Text style={s.chartSub}>
                    {selectedItemData
                      ? selectedItemData.sold_out
                        ? 'Sold out · Last 30 entries'
                        : selectedItemData.tr > 0
                          ? `TR ${selectedItemData.tr.toFixed(1)}x${selectedItemData.dsi != null ? `  ·  DSI ${selectedItemData.dsi}d` : ''}  ·  Last 30 entries`
                          : 'No sales in selected FY · Last 30 entries'
                      : '—'}
                  </Text>
                </View>
                {activePoint && (activePoint.value > 0 || activePoint.inward_value > 0) ? (
                  <View style={s.activeBox}>
                    {activePoint.value > 0 && (
                      <Text style={[s.activeVal, { color: CHART_OUT }]}>
                        Sold {compactAmt(activePoint.value)}
                      </Text>
                    )}
                    {activePoint.inward_value > 0 && (
                      <Text style={[s.activeVal, { color: CHART_IN }]}>
                        Bought {compactAmt(activePoint.inward_value)}
                      </Text>
                    )}
                    <Text style={s.activeDate}>{fmtShortDate(activePoint.date)}</Text>
                  </View>
                ) : (
                  <Text style={s.chartHint}>Tap chart to inspect</Text>
                )}
              </View>

              {/* Legend */}
              <View style={s.chartLegend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: CHART_OUT }]} />
                  <Text style={s.legendTxt}>Sold</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: CHART_IN }]} />
                  <Text style={s.legendTxt}>Purchased</Text>
                </View>
              </View>

              {/* Chart */}
              {chartLoading ? (
                <View style={s.chartLoading}>
                  <Text style={s.chartLoadingTxt}>Loading…</Text>
                </View>
              ) : hasChartData ? (
                <LineChart
                  data={chartData}
                  onPointPress={setActiveIdx}
                  activeIdx={activeIdx}
                />
              ) : (
                <View style={s.chartEmpty}>
                  <Text style={s.chartEmptyTxt}>No stock movements found</Text>
                </View>
              )}
            </View>

            {/* ── Search bar ── */}
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={COLORS.textTertiary} />
              <TextInput
                style={s.searchInput}
                placeholder="Search stock by name or SKU…"
                placeholderTextColor={COLORS.textTertiary}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Section header */}
            <View style={s.sectionHdr}>
              <Text style={s.sectionTitle}>All Stocks by Turnover Ratio</Text>
              <Text style={s.sectionSub}>{filtered.length} items · {selectedFY?.label ?? 'Current FY'}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            selected={item.name === selectedItem}
            onPress={() => { setSelectedItem(item.name); setActiveIdx(null); }}
            formatAmountCompact={formatAmountCompact}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingHorizontal: SPACING.md }}>
              {[...Array(6)].map((_, i) => <LedgerRowSkeleton key={i} />)}
            </View>
          ) : !apiError ? (
            <View style={s.empty}>
              <Ionicons name="analytics-outline" size={48} color={COLORS.textTertiary} />
              <Text style={s.emptyTxt}>
                {search.trim() ? 'No items match your search' : 'No stock data available'}
              </Text>
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
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
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
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.xs,
  },
  chartItemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  chartSub:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  chartHint:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  activeBox:     { alignItems: 'flex-end', gap: 2 },
  activeVal:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  activeDate:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  chartLoading:  { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  chartLoadingTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  chartEmpty:    { height: CHART_H, alignItems: 'center', justifyContent: 'center' },
  chartEmptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },

  // Legend
  chartLegend: {
    flexDirection: 'row', gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: 9, color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, paddingVertical: 0,
  },

  // Section header
  sectionHdr: {
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
  itemRowSel:  { borderColor: CHART_OUT, borderWidth: 2 },
  itemLeft:    { flex: 1, marginRight: SPACING.sm },
  itemName:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSubRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  itemSku:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  soldBadge:   {
    backgroundColor: '#E53935', borderRadius: 3,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  soldBadgeTxt: { fontSize: 8, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },
  itemMetrics: { flexDirection: 'row', gap: SPACING.md },
  metric:      { alignItems: 'center', minWidth: 40 },
  metricVal:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  metricLbl:   { fontSize: 9, color: COLORS.textTertiary, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Empty
  empty:    { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
