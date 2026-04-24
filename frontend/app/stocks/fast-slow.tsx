import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';

const { width: SW } = Dimensions.get('window');

// ── Mock Data ────────────────────────────────────────────────────────────────────
const WAREHOUSES_LIST = [
  'WH-001 Echo Depot', 'WH-002 Sierra Storage',
  'WH-003 Delta Hub', 'WH-004 Zulu Center', 'WH-005 North Terminal',
];
const CATEGORIES = ['Electronics', 'Peripherals', 'Accessories', 'Audio & Video', 'Food & Beverage'];

const CHART_MAX = 25000;

// 7-SKU Pareto curve  
const CHART_SKUS = [
  { label: 'SKU-A', salesValue: 2000,  cumPct: 8   },
  { label: 'SKU-B', salesValue: 5000,  cumPct: 20  },
  { label: 'SKU-C', salesValue: 21000, cumPct: 42  },
  { label: 'SKU-D', salesValue: 14000, cumPct: 62  },
  { label: 'SKU-E', salesValue: 3000,  cumPct: 72  },
  { label: 'SKU-F', salesValue: 3500,  cumPct: 80  },
  { label: 'SKU-G', salesValue: 22000, cumPct: 100 },
];

interface StockItem {
  id: string; item: string; code: string;
  unitsSold: number; avgDays: number;
  sales: string; onHand: string; turnover: string;
  tab: 'fast' | 'slow';
}

const ALL_ITEMS: StockItem[] = [
  // ── Fast moving ──────────────────────────────────────────────────────────
  { id: 'f1', item: 'Black JBL',        code: 'PRD-1002-ABC', unitsSold: 3643, avgDays: 36,  sales: '\u20b95,000',  onHand: '63pcs',  turnover: '3.2x', tab: 'fast' },
  { id: 'f2', item: 'Red Headset',      code: 'PRD-1003-DEF', unitsSold: 2980, avgDays: 28,  sales: '\u20b94,200',  onHand: '45pcs',  turnover: '4.1x', tab: 'fast' },
  { id: 'f3', item: 'Blue Speaker',     code: 'PRD-1004-GHI', unitsSold: 2450, avgDays: 22,  sales: '\u20b98,900',  onHand: '32pcs',  turnover: '5.8x', tab: 'fast' },
  { id: 'f4', item: 'Silver Earphones', code: 'PRD-1005-JKL', unitsSold: 1890, avgDays: 31,  sales: '\u20b93,100',  onHand: '89pcs',  turnover: '2.9x', tab: 'fast' },
  { id: 'f5', item: 'Gold Mic Stand',   code: 'PRD-1006-MNO', unitsSold: 1560, avgDays: 18,  sales: '\u20b96,700',  onHand: '27pcs',  turnover: '6.2x', tab: 'fast' },
  // ── Slow moving ──────────────────────────────────────────────────────────
  { id: 's1', item: 'Old Model Phone',  code: 'PRD-2001-XYZ', unitsSold: 156,  avgDays: 180, sales: '\u20b9800',    onHand: '120pcs', turnover: '0.3x', tab: 'slow' },
  { id: 's2', item: 'Outdated Laptop',  code: 'PRD-2002-ABC', unitsSold: 89,   avgDays: 210, sales: '\u20b91,200',  onHand: '85pcs',  turnover: '0.2x', tab: 'slow' },
  { id: 's3', item: 'Legacy Tablet',    code: 'PRD-2003-DEF', unitsSold: 120,  avgDays: 165, sales: '\u20b9950',    onHand: '75pcs',  turnover: '0.4x', tab: 'slow' },
  { id: 's4', item: 'Old Keyboard',     code: 'PRD-2004-GHI', unitsSold: 67,   avgDays: 240, sales: '\u20b9450',    onHand: '95pcs',  turnover: '0.15x',tab: 'slow' },
];

// ── Screen ───────────────────────────────────────────────────────────────────────
export default function FastSlowMovingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Chart interaction
  const [focusedBar, setFocusedBar] = useState<number | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'fast' | 'slow'>('fast');

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Applied filters
  const [activePeriod,  setActivePeriod]  = useState<'30D' | '90D' | 'Custom'>('30D');
  const [customDay,     setCustomDay]     = useState('');
  const [selWH,         setSelWH]         = useState<Set<string>>(new Set());
  const [selCategory,   setSelCategory]   = useState('');

  // Filter modal state
  const [showFilter,     setShowFilter]     = useState(false);
  const [draftPeriod,    setDraftPeriod]    = useState<'30D' | '90D' | 'Custom'>('30D');
  const [draftCustomDay, setDraftCustomDay] = useState('');
  const [draftWH,        setDraftWH]        = useState<Set<string>>(new Set());
  const [draftWHSearch,  setDraftWHSearch]  = useState('');
  const [draftCategory,  setDraftCategory]  = useState('');

  const activeFilterCount = selWH.size + (selCategory ? 1 : 0) + (activePeriod !== '30D' ? 1 : 0);

  // Chart data
  const barData = CHART_SKUS.map((item, idx) => ({
    value:       item.salesValue,
    label:       item.label,
    frontColor:  focusedBar === idx ? '#7C5C3A' : '#A89060',
    onPress:     () => setFocusedBar(prev => prev === idx ? null : idx),
  }));

  // Cumulative % line scaled to bar chart range (100% = CHART_MAX)
  const lineData = CHART_SKUS.map(item => ({
    value: Math.round((item.cumPct / 100) * CHART_MAX),
  }));

  const focusedSku  = focusedBar !== null ? CHART_SKUS[focusedBar] : null;
  const visibleItems = useMemo(() => ALL_ITEMS.filter(i => i.tab === activeTab), [activeTab]);

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

  // ── Filter handlers ──────────────────────────────────────────────────────
  const openFilter = () => {
    setDraftPeriod(activePeriod); setDraftCustomDay(customDay);
    setDraftWH(new Set(selWH)); setDraftWHSearch(''); setDraftCategory(selCategory);
    setShowFilter(true);
  };
  const applyFilters = () => {
    setActivePeriod(draftPeriod); setCustomDay(draftCustomDay);
    setSelWH(new Set(draftWH)); setSelCategory(draftCategory);
    setShowFilter(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Fast Vs Slow Moving Analysis</Text>
        <TouchableOpacity style={s.headerBtn} onPress={openFilter} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={COLORS.textPrimary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}><Text style={s.filterBadgeTxt}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Combo Chart ──────────────────────────────────────────────── */}
        <View style={s.chartCard}>

          {/* Axis title row */}
          <View style={s.axisRow}>
            <Text style={s.axisLabelLeft}>Sales Value</Text>
            <View style={{ flex: 1 }} />
            <Text style={s.axisLabelRight}>Cumulative % of Sales</Text>
          </View>

          {/* Chart with side Y-axis labels */}
          <View style={s.chartArea}>

            {/* Left Y labels */}
            <View style={s.leftY}>
              {['30k','25k','20k','15k','10k','5k','0'].map(v => (
                <Text key={v} style={s.yTick}>{v}</Text>
              ))}
            </View>

            {/* BarChart */}
            <View style={{ flex: 1 }}>
              <BarChart
                data={barData}
                lineData={lineData}
                lineConfig={{
                  color: COLORS.textPrimary,
                  thickness: 2.5,
                  dataPointsColor: COLORS.textPrimary,
                  dataPointsRadius: 4,
                  curved: true,
                  isAnimated: true,
                }}
                width={SW - 130}
                height={180}
                maxValue={CHART_MAX}
                noOfSections={6}
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

            {/* Right Y labels (Cumulative %) */}
            <View style={s.rightY}>
              {['100','80','60','40','20','0'].map(v => (
                <Text key={v} style={s.yTick}>{v}</Text>
              ))}
            </View>
          </View>

          {/* Tap hint */}
          <Text style={s.chartHint}>Tap a bar to see details</Text>

          {/* Tooltip — appears on bar tap */}
          {focusedSku && (
            <View style={s.tooltip}>
              <View style={s.tooltipHeader}>
                <View style={s.tooltipDotAmber} />
                <Text style={s.tooltipTitle}>{focusedSku.label}</Text>
                <TouchableOpacity onPress={() => setFocusedBar(null)} activeOpacity={0.7}>
                  <Ionicons name="close" size={14} color={COLORS.textTertiary} />
                </TouchableOpacity>
              </View>
              <View style={s.tooltipBody}>
                <View style={s.tooltipItem}>
                  <Text style={s.tooltipLbl}>Sales Value</Text>
                  <Text style={s.tooltipVal}>₹{focusedSku.salesValue.toLocaleString()}</Text>
                </View>
                <View style={s.tooltipDivider} />
                <View style={s.tooltipItem}>
                  <Text style={s.tooltipLbl}>Cumulative %</Text>
                  <Text style={[s.tooltipVal, { color: COLORS.textPrimary }]}>{focusedSku.cumPct}%</Text>
                </View>
              </View>
            </View>
          )}

          {/* Legend */}
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendSwatch, { backgroundColor: '#A89060' }]} />
              <Text style={s.legendTxt}>Sales Value</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendLine, { backgroundColor: COLORS.textPrimary }]} />
              <Text style={s.legendTxt}>Cumulative %</Text>
            </View>
          </View>
        </View>

        {/* ── Fast / Slow Pill Toggle ─────────────────────────────────────── */}
        <View style={s.pillToggle}>
          <TouchableOpacity
            style={[s.pillBtn, activeTab === 'fast' && s.pillBtnActive]}
            onPress={() => { setActiveTab('fast'); cancelSelection(); }}
            activeOpacity={0.8}
          >
            <Text style={[s.pillTxt, activeTab === 'fast' && s.pillTxtActive]}>Fast</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.pillBtn, activeTab === 'slow' && s.pillBtnActive]}
            onPress={() => { setActiveTab('slow'); cancelSelection(); }}
            activeOpacity={0.8}
          >
            <Text style={[s.pillTxt, activeTab === 'slow' && s.pillTxtActive]}>Slow</Text>
          </TouchableOpacity>
        </View>

        {/* Long-press hint */}
        {!isSelectionMode && (
          <View style={s.hintRow}>
            <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
            <Text style={s.hintTxt}>Long press to select items</Text>
          </View>
        )}

        {/* ── Item Cards ──────────────────────────────────────────────────────── */}
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
              {/* Avatar + name */}
              <View style={s.cardTop}>
                <View style={[s.avatar, isSel && s.avatarSel]}>
                  {isSel
                    ? <Ionicons name="checkmark" size={20} color="#fff" />
                    : <Text style={s.avatarTxt}>{item.item.charAt(0).toUpperCase()}</Text>
                  }
                </View>
                <View style={s.cardMeta}>
                  <Text style={s.cardName}>{item.item}</Text>
                  <Text style={s.cardCode}>{item.code}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={s.cardDivider} />

              {/* Stats — 2-column grid matching screenshot */}
              <View style={s.statsRow}>
                <View style={s.statCol}>
                  <Text style={s.statLbl}>Units Sold</Text>
                  <Text style={s.statVal}>{item.unitsSold.toLocaleString()}</Text>
                </View>
                <View style={s.statCol}>
                  <Text style={s.statLbl}>Average Days to Sell</Text>
                  <Text style={s.statVal}>{item.avgDays}D</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <View style={s.statCol}>
                  <Text style={s.statLbl}>Sales</Text>
                  <Text style={s.statVal}>{item.sales}</Text>
                </View>
                <View style={s.statCol}>
                  <Text style={s.statLbl}>Current On-Hand</Text>
                  <Text style={s.statVal}>{item.onHand}</Text>
                </View>
              </View>
              <View style={[s.statsRow, { marginBottom: 0 }]}>
                <View style={s.statCol}>
                  <Text style={s.statLbl}>Turnover Ratio</Text>
                  <Text style={[
                    s.statVal,
                    { color: item.tab === 'fast' ? COLORS.positive : COLORS.negative },
                  ]}>{item.turnover}</Text>
                </View>
                <View style={s.statCol} />
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

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

      {/* ── Filter Modal (inlined) ────────────────────────────────────────── */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={s.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowFilter(false)} activeOpacity={1} />
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Period selector */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Period selector</Text>
                <View style={s.periodSegment}>
                  {(['30D', '90D', 'Custom'] as const).map((p, idx) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        s.periodBtn,
                        draftPeriod === p && s.periodBtnActive,
                        idx === 0 && { borderTopLeftRadius: RADIUS.md, borderBottomLeftRadius: RADIUS.md },
                        idx === 2 && { borderTopRightRadius: RADIUS.md, borderBottomRightRadius: RADIUS.md },
                      ]}
                      onPress={() => setDraftPeriod(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.periodTxt, draftPeriod === p && s.periodTxtActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {draftPeriod === 'Custom' && (
                  <TextInput
                    style={s.customDayInput}
                    placeholder="Custom day (e.g. 45)"
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftCustomDay}
                    onChangeText={setDraftCustomDay}
                    keyboardType="numeric"
                  />
                )}
              </View>

              {/* Warehouse */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Warehouse</Text>
                {draftWH.size > 0 && (
                  <View style={s.chipWrap}>
                    {[...draftWH].map(w => (
                      <TouchableOpacity
                        key={w} style={s.chip}
                        onPress={() => setDraftWH(prev => { const n = new Set(prev); n.delete(w); return n; })}
                        activeOpacity={0.7}
                      >
                        <Text style={s.chipTxt}>{w.replace(/^WH-\d+ /, '')}</Text>
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={[s.searchRow, { marginTop: draftWH.size > 0 ? 8 : 0 }]}>
                  <Ionicons name="search-outline" size={15} color={COLORS.textTertiary} />
                  <TextInput
                    style={s.searchTxt}
                    placeholder="Search warehouse..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={draftWHSearch}
                    onChangeText={setDraftWHSearch}
                  />
                  {draftWHSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setDraftWHSearch('')} activeOpacity={0.7}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
                {draftWHSearch.length > 0 && (
                  <View style={s.whList}>
                    {WAREHOUSES_LIST.filter(w => w.toLowerCase().includes(draftWHSearch.toLowerCase()))
                      .map((w, idx, arr) => {
                        const checked = draftWH.has(w);
                        return (
                          <TouchableOpacity
                            key={w}
                            style={[s.whRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}
                            onPress={() => {
                              setDraftWH(prev => { const n = new Set(prev); checked ? n.delete(w) : n.add(w); return n; });
                              if (!checked) setDraftWHSearch('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="business-outline" size={15} color={COLORS.textSecondary} />
                            <Text style={s.whRowTxt}>{w}</Text>
                            <View style={[s.checkbox, checked && s.checkboxActive]}>
                              {checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                  </View>
                )}
              </View>

              {/* Category */}
              <View style={s.filterSection}>
                <Text style={s.filterSectionTitle}>Category</Text>
                <View style={s.optionList}>
                  <TouchableOpacity style={s.optionRow} onPress={() => setDraftCategory('')} activeOpacity={0.7}>
                    <Text style={[s.optionTxt, !draftCategory && s.optionTxtActive]}>All Categories</Text>
                    <View style={[s.radio, !draftCategory && s.radioActive]}>
                      {!draftCategory && <View style={s.radioInner} />}
                    </View>
                  </TouchableOpacity>
                  {CATEGORIES.map((c, idx) => {
                    const active = draftCategory === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[s.optionRow, idx === CATEGORIES.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => setDraftCategory(c)}
                        activeOpacity={0.7}
                      >
                        <Text style={[s.optionTxt, active && s.optionTxtActive]}>{c}</Text>
                        <View style={[s.radio, active && s.radioActive]}>
                          {active && <View style={s.radioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowFilter(false)} activeOpacity={0.7}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={s.applyTxt}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.pageBg },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  filterBadge:    { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  filterBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Selection banner
  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  scroll: { padding: SPACING.md, gap: 12 },

  // Chart
  chartCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  axisRow:      { flexDirection: 'row', marginBottom: 4 },
  axisLabelLeft:  { fontSize: 9, color: COLORS.textTertiary, fontWeight: '600' },
  axisLabelRight: { fontSize: 9, color: COLORS.textTertiary, fontWeight: '600' },
  chartArea:    { flexDirection: 'row', alignItems: 'flex-start' },
  leftY:        { width: 30, justifyContent: 'space-between', height: 180, paddingBottom: 16 },
  rightY:       { width: 28, justifyContent: 'space-between', height: 168, paddingBottom: 4, marginTop: 6 },
  yTick:        { fontSize: 9, color: COLORS.textTertiary, textAlign: 'right' },
  chartHint:    { fontSize: 10, color: COLORS.textTertiary, textAlign: 'center', marginTop: 4 },

  // Tooltip
  tooltip:        { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, marginTop: 10 },
  tooltipHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  tooltipDotAmber:{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#A89060', flexShrink: 0 },
  tooltipTitle:   { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  tooltipBody:    { flexDirection: 'row', padding: SPACING.md },
  tooltipItem:    { flex: 1, gap: 4 },
  tooltipLbl:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  tooltipVal:     { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: '#A89060' },
  tooltipDivider: { width: 1, backgroundColor: COLORS.borderDefault, marginHorizontal: SPACING.md },

  // Legend
  legendRow:   { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch:{ width: 12, height: 12, borderRadius: 3 },
  legendLine:  { width: 16, height: 3, borderRadius: 2 },
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

  // Stats grid — 2-col layout
  statsRow: { flexDirection: 'row', marginBottom: 8 },
  statCol:  { flex: 1, gap: 3 },
  statLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  statVal:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  // Share bar
  shareBar:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelTxt:     { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:    { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:         { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:         { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },

  // Modal
  modalOverlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:         { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', paddingHorizontal: SPACING.md },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, marginBottom: 8 },
  modalTitle:         { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  filterSection:      { marginBottom: 20 },
  filterSectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  // Period segment
  periodSegment: { flexDirection: 'row', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  periodBtn:     { flex: 1, paddingVertical: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  periodBtnActive: { backgroundColor: COLORS.textPrimary },
  periodTxt:     { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: '#fff', fontWeight: '700' },
  customDayInput: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, backgroundColor: COLORS.pageBg },

  // Warehouse
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.textPrimary },
  chipTxt:      { fontSize: TYPOGRAPHY.sm, color: '#fff', fontWeight: '600' },
  searchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg },
  searchTxt:    { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, padding: 0 },
  whList:       { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden', marginTop: 8 },
  whRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  whRowTxt:     { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
  checkbox:     { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },

  // Category radio
  optionList:      { borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  optionRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  optionTxt:       { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary, flex: 1 },
  optionTxtActive: { color: COLORS.textPrimary, fontWeight: '700' },
  radio:           { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  radioActive:     { borderColor: COLORS.brandPrimary },
  radioInner:      { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brandPrimary },

  modalFooter: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  cancelBtn:   { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.pageBg, alignItems: 'center' },
  cancelTxt:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  applyBtn:    { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, backgroundColor: COLORS.textPrimary, alignItems: 'center' },
  applyTxt:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
