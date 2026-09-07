import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getStockFastSlow } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { shareStockRegisterPdf, companyFromAuth } from '../../src/utils/multiShare';

const { width: SW } = Dimensions.get('window');
const PAGE_SIZE = 20;

// ── Types ────────────────────────────────────────────────────────────────────
interface StockItem {
  id: string;
  name: string;
  displayName?: string;
  sku: string;
  group: string;
  unit: string;
  closing_qty: number;
  closing_value: number;
  total_outward_qty: number;
  total_inward_qty: number;
  outward_txn_count: number;
  avg_daily_outward: number;
  days_remaining: number | null;
  rank: number;
  tab: 'fast' | 'slow';
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function FastSlowMovingScreen() {
  const { t } = useTranslation();
  const { formatAmount } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const fyParam = fyInfoToParam(selectedFY);
  const companyGuid = company?.guid;

  // API state
  const [isLoading, setIsLoading]   = useState(false);
  const [apiError,  setApiError]    = useState<string | null>(null);
  const [fastItems, setFastItems]   = useState<StockItem[]>([]);
  const [slowItems, setSlowItems]   = useState<StockItem[]>([]);
  const [summary,   setSummary]     = useState<{ total: number; active: number; inactive: number; fy: string } | null>(null);

  // Chart interaction
  const [focusedBar, setFocusedBar] = useState<number | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'fast' | 'slow'>('fast');

  // Pagination
  const [page, setPage] = useState(1);

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isSharing,       setIsSharing]       = useState(false);

  const handleShareSelected = async () => {
    const pool = [...fastItems, ...slowItems];
    const items = pool.filter(i => selectedIds.has(i.id));
    if (!items.length || isSharing) return;
    setIsSharing(true);
    try {
      await shareStockRegisterPdf({
        company: companyFromAuth(company),
        title: 'Fast / Slow Moving',
        rows: items.map(item => ({
          date: '',
          particulars: item.displayName || item.name,
          vchType: item.group || item.tab,
          vchNo: item.sku,
          inwardsQty: String(item.total_inward_qty ?? ''),
          outwardsQty: String(item.total_outward_qty ?? ''),
        })),
      }, { onBeforeShare: () => setIsSharing(false) });
      cancelSelection();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not share PDF.');
    } finally {
      setIsSharing(false);
    }
  };

  const loadData = async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const params: any = {};
      if (fyParam) params.fy = fyParam;
      const res = await getStockFastSlow(companyGuid, params);
      const d = res?.data;
      setFastItems(d?.fast   ?? []);
      setSlowItems(d?.slow   ?? []);
      setSummary({
        total:    d?.total_items    ?? 0,
        active:   d?.active_items   ?? 0,
        inactive: d?.inactive_items ?? 0,
        fy:       d?.financial_year ?? '',
      });
    } catch (err: any) {
      setApiError(err?.message ?? 'Failed to load fast/slow data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [companyGuid, fyParam]);

  // Chart: top 7 fast items by total_outward_qty
  const chartItems = useMemo(() => fastItems.slice(0, 7), [fastItems]);

  const barData = useMemo(() =>
    chartItems.map((item, idx) => ({
      value:      Math.max(item.total_outward_qty, 1),
      label:      (item.displayName || item.name).slice(0, 6) + ((item.displayName || item.name).length > 6 ? '…' : ''),
      frontColor: focusedBar === idx ? '#7C5C3A' : '#A89060',
      onPress:    () => setFocusedBar(prev => prev === idx ? null : idx),
    })),
    [chartItems, focusedBar]
  );

  const dynamicMax = useMemo(() =>
    chartItems.reduce((m, it) => Math.max(m, it.total_outward_qty), 1),
    [chartItems]
  );

  const allVisible  = activeTab === 'fast' ? fastItems : slowItems;
  const visibleItems = allVisible.slice(0, page * PAGE_SIZE);
  const hasMore      = visibleItems.length < allVisible.length;

  const fmtVal = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000)     return `₹${(abs / 1000).toFixed(1)}K`;
    return `₹${abs.toFixed(0)}`;
  };

  const fmtQty = (q: number) => {
    if (Math.abs(q) >= 1000) return `${(q / 1000).toFixed(1)}K`;
    return q % 1 === 0 ? String(q) : q.toFixed(2);
  };

  // ── Selection handlers ────────────────────────────────────────────────────
  const loadMore = () => setPage(p => p + 1);

  const handleLongPress = (id: string) => { setIsSelectionMode(true); setSelectedIds(new Set([id])); };
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
  const selectAll       = () => { setSelectedIds(new Set(allVisible.map(i => i.id))); setIsSelectionMode(true); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      <ScreenHeader title="Fast / Slow Moving Items" onBack={() => router.back()} />

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {apiError && <ErrorBanner message={apiError} onRetry={loadData} />}

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
          <CardSkeleton height={80} />
          <CardSkeleton height={200} />
          <CardSkeleton height={52} />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* ── Summary Strip ─────────────────────────────────────────── */}
          {summary && (
            <View style={s.summaryCard}>
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{summary.total}</Text>
                <Text style={s.summaryLbl}>Total SKUs</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: COLORS.positive }]}>{fastItems.length}</Text>
                <Text style={s.summaryLbl}>{t('stocks.fastMoving')}</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: COLORS.warning }]}>{slowItems.length}</Text>
                <Text style={s.summaryLbl}>Slow Moving</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: COLORS.textSecondary }]}>{summary.inactive}</Text>
                <Text style={s.summaryLbl}>No Movement</Text>
              </View>
            </View>
          )}

          {/* ── Bar Chart: Top fast movers by outward qty ─────────────── */}
          {chartItems.length > 0 && (
            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Top Fast Movers — Outward Quantity ({summary?.fy ?? 'FY'})</Text>
              <View style={s.chartArea}>
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
              <Text style={s.chartHint}>Tap a bar for details</Text>

              {focusedBar !== null && chartItems[focusedBar] && (() => {
                const it = chartItems[focusedBar];
                return (
                  <View style={s.tooltip}>
                    <View style={s.tooltipHeader}>
                      <View style={s.tooltipDot} />
                      <Text style={s.tooltipTitle} numberOfLines={1}>{it.displayName || it.name}</Text>
                      <TouchableOpacity onPress={() => setFocusedBar(null)} activeOpacity={0.7}>
                        <Ionicons name="close" size={14} color={COLORS.textTertiary} />
                      </TouchableOpacity>
                    </View>
                    <View style={s.tooltipBody}>
                      <View style={s.tooltipCol}>
                        <Text style={s.tooltipLbl}>Outward Qty</Text>
                        <Text style={s.tooltipVal}>{fmtQty(it.total_outward_qty)}</Text>
                      </View>
                      <View style={s.tooltipDiv} />
                      <View style={s.tooltipCol}>
                        <Text style={s.tooltipLbl}>Txn Count</Text>
                        <Text style={s.tooltipVal}>{it.outward_txn_count}</Text>
                      </View>
                      <View style={s.tooltipDiv} />
                      <View style={s.tooltipCol}>
                        <Text style={s.tooltipLbl}>Closing Stock</Text>
                        <Text style={[s.tooltipVal, { color: COLORS.textPrimary }]}>{fmtVal(it.closing_value)}</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}

              <View style={s.legendRow}>
                <View style={s.legendItem}>
                  <View style={[s.legendSwatch, { backgroundColor: '#A89060' }]} />
                  <Text style={s.legendTxt}>Total Outward Quantity (FY)</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Fast / Slow Pill Toggle ─────────────────────────────────── */}
          <View style={s.pillToggle}>
            <TouchableOpacity
              style={[s.pillBtn, activeTab === 'fast' && s.pillBtnFast]}
              onPress={() => { setActiveTab('fast'); cancelSelection(); setPage(1); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash"
                size={14}
                color={activeTab === 'fast' ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[s.pillTxt, activeTab === 'fast' && s.pillTxtFastActive]}>
                Fast ({fastItems.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.pillBtn, activeTab === 'slow' && s.pillBtnSlow]}
              onPress={() => { setActiveTab('slow'); cancelSelection(); setPage(1); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="hourglass-outline"
                size={14}
                color={activeTab === 'slow' ? '#fff' : COLORS.textSecondary}
              />
              <Text style={[s.pillTxt, activeTab === 'slow' && s.pillTxtSlowActive]}>
                Slow ({slowItems.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Classification note ───────────────────────────────────── */}
          <View style={s.noteRow}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.textTertiary} />
            <Text style={s.noteTxt}>
              {activeTab === 'fast'
                ? 'Items with highest outward movement in the FY'
                : 'Items with low/no outward movement in the FY'}
            </Text>
          </View>

          {/* Long-press hint */}
          {!isSelectionMode && visibleItems.length > 0 && (
            <View style={s.hintRow}>
              <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
              <Text style={s.hintTxt}>Long press to select items</Text>
            </View>
          )}

          {/* ── Empty State ───────────────────────────────────────────── */}
          {visibleItems.length === 0 && !apiError && !isLoading && (
            <View style={s.empty}>
              <Ionicons name="bar-chart-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>No items in this category</Text>
            </View>
          )}

          {/* ── Item Cards ────────────────────────────────────────────── */}
          {visibleItems.map(item => {
            const isSel = selectedIds.has(item.id);
            const isFast = item.tab === 'fast';
            return (
              <EntityListTile
                key={item.id}
                name={item.displayName || item.name}
                subtitle={item.sku || undefined}
                meta={item.group}
                selected={isSel}
                alignTop
                borderRadius={RADIUS.lg}
                avatarBgColor={isSel ? undefined : (isFast ? COLORS.brandPrimary : COLORS.activeBg)}
                avatar={isSel ? undefined : (
                  <Text style={[s.avatarTxt, !isFast && { color: COLORS.textSecondary }]}>
                    {(item.displayName || item.name).charAt(0).toUpperCase()}
                  </Text>
                )}
                onPress={() => handleCardPress(item.id)}
                onLongPress={() => handleLongPress(item.id)}
                delayLongPress={350}
                style={{ marginBottom: SPACING.md }}
                headerExtra={(
                  <View style={[s.badge, { backgroundColor: isFast ? COLORS.activeBg : COLORS.warningBg }]}>
                    <Ionicons
                      name={isFast ? 'flash' : 'hourglass-outline'}
                      size={11}
                      color={isFast ? COLORS.textPrimary : COLORS.textSecondary}
                    />
                    <Text style={[s.badgeTxt, { color: isFast ? COLORS.textPrimary : COLORS.textSecondary }]}>
                      {isFast ? 'Fast' : 'Slow'} #{item.rank}
                    </Text>
                  </View>
                )}
                footer={(
                  <>
                    <View style={s.cardDivider} />
                    <View style={s.statsGrid}>
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>Outward Qty</Text>
                        <Text style={[s.statVal, { color: isFast ? COLORS.textPrimary : COLORS.textSecondary }]}>
                          {fmtQty(item.total_outward_qty)}{item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      </View>
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>Txn Count</Text>
                        <Text style={s.statVal}>{item.outward_txn_count}</Text>
                      </View>
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>Closing Stock</Text>
                        <Text style={[s.statVal, { color: item.closing_qty < 0 ? COLORS.negative : COLORS.textPrimary }]}>
                          {fmtQty(item.closing_qty)}{item.unit ? ` ${item.unit}` : ''}
                        </Text>
                      </View>
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>Stock Value</Text>
                        <Text style={s.statVal}>{fmtVal(item.closing_value)}</Text>
                      </View>
                    </View>
                    {item.avg_daily_outward > 0 && item.closing_qty > 0 && item.days_remaining != null && (
                      <View style={[s.daysRow, { backgroundColor: isFast ? COLORS.activeBg : COLORS.warningBg }]}>
                        <Ionicons name="time-outline" size={12} color={isFast ? COLORS.textPrimary : COLORS.textSecondary} />
                        <Text style={[s.daysTxt, { color: isFast ? COLORS.textPrimary : COLORS.textSecondary }]}>
                          ~{item.days_remaining} days stock remaining at current rate
                        </Text>
                      </View>
                    )}
                  </>
                )}
              />
            );
          })}

          {/* ── Load More ──────────────────────────────────────── */}
          {hasMore && (
            <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} activeOpacity={0.8}>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              <Text style={s.loadMoreTxt}>Load More ({allVisible.length - visibleItems.length} remaining)</Text>
            </TouchableOpacity>
          )}

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
          <TouchableOpacity
            style={[s.shareBtn, isSharing && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={handleShareSelected}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="share-social-outline" size={18} color="#fff" />
            }
            <Text style={s.shareTxt}>{isSharing ? 'Preparing…' : 'Share PDF'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  scroll: { padding: SPACING.md, gap: 12 },

  // Summary strip
  summaryCard: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    paddingVertical: 14, paddingHorizontal: SPACING.md,
  },
  summaryItem:    { flex: 1, alignItems: 'center', gap: 3 },
  summaryVal:     { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl:     { fontSize: 10, color: COLORS.textTertiary, fontWeight: '500', textAlign: 'center' },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: 4 },

  // Chart
  chartCard:  { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  chartTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  chartArea:  { flexDirection: 'row', alignItems: 'flex-start' },
  chartHint:  { fontSize: 10, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4 },

  tooltip:       { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginTop: 10 },
  tooltipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tooltipDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#A89060', flexShrink: 0 },
  tooltipTitle:  { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  tooltipBody:   { flexDirection: 'row', padding: SPACING.md },
  tooltipCol:    { flex: 1, gap: 4, alignItems: 'center' },
  tooltipLbl:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  tooltipVal:    { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: '#A89060' },
  tooltipDiv:    { width: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.sm },

  legendRow:    { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  legendItem:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendTxt:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },

  // Pill toggle
  pillToggle:    { flexDirection: 'row', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  pillBtn:       { flex: 1, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  pillBtnFast:   { backgroundColor: COLORS.brandPrimary },
  pillBtnSlow:   { backgroundColor: COLORS.brandPrimary },
  pillTxt:       { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  pillTxtFastActive: { color: '#fff', fontWeight: '700' },
  pillTxtSlowActive: { color: '#fff', fontWeight: '700' },

  // Note + hint
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteTxt: { fontSize: 11, color: COLORS.textTertiary, flex: 1 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hintTxt: { fontSize: 11, color: COLORS.textTertiary },

  // Empty
  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  // Item cards
  itemCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, gap: 0 },
  itemCardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },

  badge:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginBottom: 10 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },

  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarSel:{ backgroundColor: '#A89060' },
  avatarTxt:{ fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  cardMeta: { flex: 1 },
  cardName: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardGroup:{ fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  cardDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },

  statsGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  statItem: { width: '50%', gap: 3, paddingBottom: 10 },
  statLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  statVal:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: RADIUS.sm, marginTop: 4 },
  daysTxt: { fontSize: 11, fontWeight: '600' },

  // Share bar
  loadMoreBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingVertical: 14 },
  loadMoreTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },

  shareBar:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelTxt:    { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:        { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:        { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
