import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getStocks } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';

const { width: SW } = Dimensions.get('window');
const CHART_MAX = 100;

// ── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
  id: string;
  item: string;
  group: string;
  qty: number;
  value: number;
  tab: 'fast' | 'slow';
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function FastSlowMovingScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  // API state
  const [isLoading, setIsLoading] = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const [allItems,  setAllItems]  = useState<StockItem[]>([]);

  // Chart interaction
  const [focusedBar, setFocusedBar] = useState<number | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'fast' | 'slow'>('fast');

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Filter modal state
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getStocks(companyGuid, { limit: '100' })
      .then((res: any) => {
        const rows: any[] = res?.data ?? [];
        if (!rows.length) { setAllItems([]); return; }

        // Sort by closing_qty descending
        const sorted = [...rows].sort((a, b) => Number(b.closing_qty ?? 0) - Number(a.closing_qty ?? 0));
        const halfIdx = Math.ceil(sorted.length / 2);

        const mapped: StockItem[] = sorted.map((r: any, idx: number) => ({
          id:    String(r.id ?? idx),
          item:  r.name ?? 'Unknown',
          group: r.group_name ?? '—',
          qty:   Number(r.closing_qty ?? 0),
          value: Number(r.closing_qty ?? 0) * Number(r.rate ?? 0),
          tab:   idx < halfIdx ? 'fast' : 'slow',
        }));
        setAllItems(mapped);
      })
      .catch((err: any) => setApiError(err?.message ?? 'Failed to load stock data'))
      .finally(() => setIsLoading(false));
  }, [companyGuid]);

  // Chart: top 7 items by value
  const chartItems = useMemo(() => {
    const sorted = [...allItems].sort((a, b) => b.value - a.value).slice(0, 7);
    return sorted;
  }, [allItems]);

  const barData = useMemo(() =>
    chartItems.map((item, idx) => ({
      value:      Math.max(item.qty, 1),
      label:      item.item.length > 6 ? item.item.slice(0, 6) + '…' : item.item,
      frontColor: focusedBar === idx ? '#7C5C3A' : '#A89060',
      onPress:    () => setFocusedBar(prev => prev === idx ? null : idx),
    })),
    [chartItems, focusedBar]
  );

  const dynamicMax = useMemo(() =>
    chartItems.reduce((m, it) => Math.max(m, it.qty), 1),
    [chartItems]
  );

  const visibleItems = useMemo(() => allItems.filter(i => i.tab === activeTab), [allItems, activeTab]);

  const fmtValue = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000)     return `₹${(abs / 1000).toFixed(1)}K`;
    return `₹${abs.toFixed(0)}`;
  };

  // ── Selection handlers ────────────────────────────────────────────────────
  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([id]));
  };
  const handleCardPress = (id: string) => {
    if (!isSelectionMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (next.size === 0) setIsSelectionMode(false); }
      else              { next.add(id); }
      return next;
    });
  };
  const cancelSelection = () => { setSelectedIds(new Set()); setIsSelectionMode(false); };
  const selectAll       = () => { setSelectedIds(new Set(visibleItems.map(i => i.id))); setIsSelectionMode(true); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Fast Vs Slow Moving Analysis</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {apiError && <ErrorBanner message={apiError} />}

      {/* ── Selection Banner ────────────────────────────────────────────── */}
      {isSelectionMode && (
        <View style={s.selBanner}>
          <TouchableOpacity onPress={cancelSelection} activeOpacity={0.7} style={s.selBannerBtn}>
            <Ionicons name="close" size={18} color={COLORS.textPrimary} />
            <Text style={s.selBannerCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.selBannerCount}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={selectAll} activeOpacity={0.7} style={s.selBannerBtn}>
            <Text style={s.selBannerAll}>All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <CardSkeleton height={60} />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Bar Chart (top 7 items by qty) ───────────────────────────── */}
          {chartItems.length > 0 && (
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Top Items by Stock Quantity</Text>
              <View style={s.chartArea}>
                <View style={{ flex: 1 }}>
                  <BarChart
                    data={barData}
                    width={SW - 80}
                    height={180}
                    maxValue={dynamicMax}
                    noOfSections={5}
                    barWidth={26}
                    spacing={12}
                    hideRules={false}
                    rulesColor={COLORS.borderDefault}
                    rulesType="dashed"
                    yAxisThickness={0}
                    hideYAxisText
                    xAxisThickness={1}
                    xAxisColor={COLORS.borderDefault}
                    xAxisLabelTextStyle={{ fontSize: 9, color: COLORS.textTertiary }}
                    isAnimated
                    animationDuration={600}
                  />
                </View>
              </View>
              <Text style={s.chartHint}>Tap a bar to see details</Text>
              {focusedBar !== null && chartItems[focusedBar] && (
                <View style={s.tooltip}>
                  <View style={s.tooltipHeader}>
                    <View style={s.tooltipDotAmber} />
                    <Text style={s.tooltipTitle}>{chartItems[focusedBar].item}</Text>
                    <TouchableOpacity onPress={() => setFocusedBar(null)} activeOpacity={0.7}>
                      <Ionicons name="close" size={14} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  <View style={s.tooltipBody}>
                    <View style={s.tooltipItem}>
                      <Text style={s.tooltipLbl}>Qty</Text>
                      <Text style={s.tooltipVal}>{chartItems[focusedBar].qty.toLocaleString()}</Text>
                    </View>
                    <View style={s.tooltipDivider} />
                    <View style={s.tooltipItem}>
                      <Text style={s.tooltipLbl}>Value</Text>
                      <Text style={[s.tooltipVal, { color: COLORS.textPrimary }]}>{fmtValue(chartItems[focusedBar].value)}</Text>
                    </View>
                  </View>
                </View>
              )}
              <View style={s.legendRow}>
                <View style={s.legendItem}>
                  <View style={[s.legendSwatch, { backgroundColor: '#A89060' }]} />
                  <Text style={s.legendTxt}>Stock Quantity</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Fast / Slow Pill Toggle ─────────────────────────────────────── */}
          <View style={s.pillToggle}>
            <TouchableOpacity
              style={[s.pillBtn, activeTab === 'fast' && s.pillBtnActive]}
              onPress={() => { setActiveTab('fast'); cancelSelection(); }}
              activeOpacity={0.8}
            >
              <Text style={[s.pillTxt, activeTab === 'fast' && s.pillTxtActive]}>
                Fast ({allItems.filter(i => i.tab === 'fast').length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.pillBtn, activeTab === 'slow' && s.pillBtnActive]}
              onPress={() => { setActiveTab('slow'); cancelSelection(); }}
              activeOpacity={0.8}
            >
              <Text style={[s.pillTxt, activeTab === 'slow' && s.pillTxtActive]}>
                Slow ({allItems.filter(i => i.tab === 'slow').length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Long-press hint */}
          {!isSelectionMode && visibleItems.length > 0 && (
            <View style={s.hintRow}>
              <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
              <Text style={s.hintTxt}>Long press to select items</Text>
            </View>
          )}

          {/* ── Empty State ───────────────────────────────────────────────── */}
          {visibleItems.length === 0 && !apiError && (
            <View style={s.empty}>
              <Ionicons name="bar-chart-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>No stock items found</Text>
            </View>
          )}

          {/* ── Item Cards ──────────────────────────────────────────────────── */}
          {visibleItems.map(item => {
            const isSel = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.itemCard, isSel && s.itemCardSel]}
                onPress={() => handleCardPress(item.id)}
                onLongPress={() => handleLongPress(item.id)}
                delayLongPress={350}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={[s.avatar, isSel && s.avatarSel]}>
                    {isSel
                      ? <Ionicons name="checkmark" size={20} color="#fff" />
                      : <Text style={s.avatarTxt}>{item.item.charAt(0).toUpperCase()}</Text>
                    }
                  </View>
                  <View style={s.cardMeta}>
                    <Text style={s.cardName}>{item.item}</Text>
                    <Text style={s.cardCode}>{item.group}</Text>
                  </View>
                </View>
                <View style={s.cardDivider} />
                <View style={s.statsRow}>
                  <View style={s.statCol}>
                    <Text style={s.statLbl}>Closing Qty</Text>
                    <Text style={[s.statVal, { color: item.qty < 0 ? COLORS.negative : COLORS.textPrimary }]}>
                      {item.qty.toLocaleString()}
                    </Text>
                  </View>
                  <View style={s.statCol}>
                    <Text style={s.statLbl}>Estimated Value</Text>
                    <Text style={[s.statVal, { color: item.tab === 'fast' ? COLORS.positive : COLORS.textSecondary }]}>
                      {fmtValue(item.value)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* ── Conditional Share Bar ────────────────────────────────────────── */}
      {isSelectionMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  scroll: { padding: SPACING.md, gap: 12 },

  // Chart
  chartCard:  { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  chartTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  chartArea:  { flexDirection: 'row', alignItems: 'flex-start' },
  chartHint:  { fontSize: 10, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4 },

  // Tooltip
  tooltip:         { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginTop: 10 },
  tooltipHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tooltipDotAmber: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#A89060', flexShrink: 0 },
  tooltipTitle:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  tooltipBody:     { flexDirection: 'row', padding: SPACING.md },
  tooltipItem:     { flex: 1, gap: 4 },
  tooltipLbl:      { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  tooltipVal:      { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: '#A89060' },
  tooltipDivider:  { width: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },

  legendRow:   { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch:{ width: 12, height: 12, borderRadius: 3 },
  legendTxt:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Pill toggle
  pillToggle:    { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  pillBtn:       { flex: 1, paddingVertical: 14, alignItems: 'center' },
  pillBtnActive: { backgroundColor: COLORS.textPrimary },
  pillTxt:       { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textSecondary },
  pillTxtActive: { color: '#fff', fontWeight: '700' },

  // Hint
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  // Empty
  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  // Item cards
  itemCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  itemCardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },

  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSel:   { backgroundColor: '#A89060' },
  avatarTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  cardMeta:    { flex: 1 },
  cardName:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardCode:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  statsRow: { flexDirection: 'row', marginBottom: 8 },
  statCol:  { flex: 1, gap: 3 },
  statLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  statVal:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // Share bar
  shareBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelTxt:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:        { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:        { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
