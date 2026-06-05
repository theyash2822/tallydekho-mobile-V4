import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PieChart } from 'react-native-gifted-charts';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getStocks } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import ShimmerPlaceholder, { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';

const SLICE_COLORS = ['#A89060', '#3A3A3A', '#7C5C3A', '#1A1A1A', '#5A7A5A', '#5A5A9A', '#9A5A5A', '#5A8A9A'];

interface GroupSummary {
  id:    string;
  name:  string;
  value: number;
  skus:  number;
  color: string;
}

export default function ValuationSummaryScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const fyParam = fyInfoToParam(selectedFY);

  const [isLoading,     setIsLoading]     = useState(false);
  const [apiError,      setApiError]      = useState<string | null>(null);
  const [groups,        setGroups]        = useState<GroupSummary[]>([]);
  const [totalValue,    setTotalValue]    = useState(0);

  const [selectedSlice, setSelectedSlice] = useState<number | null>(null);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [isSelMode,     setIsSelMode]     = useState(false);

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getStocks(companyGuid, { limit: '500', ...(fyParam ? { fy: fyParam } : {}) })
      .then((res: any) => {
        const rows: any[] = res?.data?.items ?? [];
        // Group by group_name
        const map = new Map<string, { value: number; skus: number }>();
        let tot = 0;
        for (const r of rows) {
          const grp = r.group_name ?? 'Ungrouped';
          const val = Number(r.closing_value ?? 0);
          if (!map.has(grp)) map.set(grp, { value: 0, skus: 0 });
          const entry = map.get(grp)!;
          entry.value += val;
          entry.skus  += 1;
          tot          += val;
        }
        const sorted: GroupSummary[] = Array.from(map.entries())
          .sort((a, b) => b[1].value - a[1].value)
          .slice(0, 8) // top 8 groups for chart readability
          .map(([name, data], idx) => ({
            id:    String(idx),
            name,
            value: data.value,
            skus:  data.skus,
            color: SLICE_COLORS[idx % SLICE_COLORS.length],
          }));
        setGroups(sorted);
        setTotalValue(tot);
      })
      .catch((err: any) => setApiError(err?.message ?? 'Failed to load stock data'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, selectedFY]);

  const pieData = useMemo(() =>
    groups.map(g => ({ value: g.value, color: g.color, label: g.name })),
    [groups]
  );

  const fmtValue = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000)   return `₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000)     return `₹${(abs / 1000).toFixed(1)}K`;
    return `₹${abs.toFixed(0)}`;
  };

  const handleLongPress = (id: string) => { setIsSelMode(true); setSelectedIds(new Set([id])); };
  const handleCardPress = (id: string) => {
    if (!isSelMode) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (next.size === 0) setIsSelMode(false); }
      else next.add(id);
      return next;
    });
  };
  const cancelSelection = () => { setSelectedIds(new Set()); setIsSelMode(false); };
  const selectAll = () => { setSelectedIds(new Set(groups.map(g => g.id))); setIsSelMode(true); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Valuation Summary</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Error */}
      {apiError && <ErrorBanner message={apiError} />}

      {/* Selection Banner */}
      {isSelMode && (
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

      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <CardSkeleton height={80} />
          <CardSkeleton height={220} />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Total Value Summary Card */}
          <View style={s.totalCard}>
            <Text style={s.totalLbl}>Total Stock Value</Text>
            <Text style={s.totalVal}>{fmtValue(totalValue)}</Text>
            <Text style={s.totalSub}>{groups.reduce((sum, g) => sum + g.skus, 0)} SKUs · {groups.length} groups</Text>
          </View>

          {/* Donut Chart */}
          {pieData.length > 0 && (
            <View style={s.chartCard}>
              <PieChart
                donut
                data={pieData}
                radius={100}
                innerRadius={64}
                focusOnPress
                selectedIndex={selectedSlice ?? undefined}
                onPress={(_item: any, index: number) => {
                  setSelectedSlice(prev => (prev === index ? null : index));
                }}
                centerLabelComponent={() => {
                  const slice = selectedSlice !== null ? groups[selectedSlice] : null;
                  if (slice) {
                    return (
                      <View style={s.chartCenter}>
                        <Text style={[s.chartCenterName, { color: slice.color }]} numberOfLines={2}>
                          {slice.name}
                        </Text>
                        <Text style={s.chartCenterVal}>{fmtValue(slice.value)}</Text>
                      </View>
                    );
                  }
                  return (
                    <View style={s.chartCenter}>
                      <Ionicons name="layers-outline" size={20} color={COLORS.textSecondary} />
                      <Text style={s.chartCenterTxt}>By Group</Text>
                    </View>
                  );
                }}
              />
              <Text style={s.chartHint}>Tap a segment to see details</Text>
              <View style={s.legend}>
                {pieData.map((d, idx) => (
                  <TouchableOpacity
                    key={d.label}
                    style={[s.legendRow, selectedSlice === idx && s.legendRowActive]}
                    onPress={() => setSelectedSlice(prev => (prev === idx ? null : idx))}
                    activeOpacity={0.7}
                  >
                    <View style={[s.legendDot, { backgroundColor: d.color }, selectedSlice === idx && { width: 16, height: 16, borderRadius: 8 }]} />
                    <Text style={[s.legendLabel, selectedSlice === idx && { fontWeight: '700', color: COLORS.textPrimary }]}>{d.label}</Text>
                    <Text style={[s.legendVal, selectedSlice === idx && { color: d.color }]}>{fmtValue(d.value)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Group Breakdown Cards */}
          {groups.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Group Breakdown</Text>
              {!isSelMode && (
                <View style={s.hintRow}>
                  <Ionicons name="hand-left-outline" size={13} color={COLORS.textTertiary} />
                  <Text style={s.hintTxt}>Long press a card to select</Text>
                </View>
              )}
              {groups.map((g, idx) => {
                const isSel = selectedIds.has(g.id);
                const pct   = totalValue > 0 ? ((g.value / totalValue) * 100).toFixed(1) : '0';
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[s.whCard, isSel && s.whCardSel]}
                    onPress={() => handleCardPress(g.id)}
                    onLongPress={() => handleLongPress(g.id)}
                    delayLongPress={350}
                    activeOpacity={0.8}
                  >
                    <View style={s.whCardTop}>
                      <View style={[s.avatar, { backgroundColor: isSel ? '#A89060' : SLICE_COLORS[idx % SLICE_COLORS.length] }]}>
                        {isSel
                          ? <Ionicons name="checkmark" size={20} color="#fff" />
                          : <Text style={s.avatarTxt}>{g.name.charAt(0).toUpperCase()}</Text>
                        }
                      </View>
                      <View style={s.whCardInfo}>
                        <Text style={s.whName}>{g.name}</Text>
                        <Text style={s.whSub}>{g.skus} SKUs</Text>
                      </View>
                    </View>
                    <View style={s.whDivider} />
                    <View style={s.whStats}>
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>Stock Value</Text>
                        <Text style={s.statVal}>{fmtValue(g.value)}</Text>
                      </View>
                      <View style={s.statDivider} />
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>SKUs</Text>
                        <Text style={s.statVal}>{g.skus.toLocaleString()}</Text>
                      </View>
                      <View style={s.statDivider} />
                      <View style={s.statItem}>
                        <Text style={s.statLbl}>% of Total</Text>
                        <Text style={s.statVal}>{pct}%</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Empty state */}
          {groups.length === 0 && !apiError && (
            <View style={s.empty}>
              <Ionicons name="layers-outline" size={48} color={COLORS.borderDefault} />
              <Text style={s.emptyTxt}>No stock data available</Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Share Bar */}
      {isSelMode && selectedIds.size > 0 && (
        <View style={[s.shareBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity style={s.cancelSelFooter} onPress={cancelSelection} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            <Text style={s.cancelSelFooterTxt}>Deselect</Text>
          </TouchableOpacity>
          <Text style={s.shareBarCount}>{selectedIds.size} group{selectedIds.size !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn:   { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },

  selBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 10, backgroundColor: COLORS.activeBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  selBannerBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selBannerCancel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  selBannerCount:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selBannerAll:    { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.brandPrimary },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },

  scroll: { padding: SPACING.md, gap: 12 },

  totalCard: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, alignItems: 'center', gap: 4,
  },
  totalLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  totalVal:  { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  totalSub:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },

  chartCard:       { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, alignItems: 'center' },
  chartCenter:     { alignItems: 'center', gap: 3, width: 110 },
  chartCenterTxt:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  chartCenterName: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', textAlign: 'center' },
  chartCenterVal:  { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  chartHint:       { fontSize: 10, color: COLORS.textTertiary, marginTop: 6, marginBottom: 2 },
  legend:          { width: '100%', marginTop: SPACING.sm, gap: 8 },
  legendRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 4, borderRadius: RADIUS.sm },
  legendRowActive: { backgroundColor: COLORS.pageBg },
  legendDot:       { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  legendLabel:     { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '500' },
  legendVal:       { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, paddingLeft: 4, marginTop: 4 },
  hintRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5 },
  hintTxt:      { fontSize: 11, color: COLORS.textTertiary },

  whCard:    { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  whCardSel: { borderColor: COLORS.brandPrimary, backgroundColor: COLORS.activeBg },
  whCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
  whCardInfo:{ flex: 1 },
  whName:    { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  whSub:     { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  whDivider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: SPACING.sm },
  whStats:   { flexDirection: 'row', alignItems: 'center' },
  statItem:  { flex: 1, alignItems: 'center', gap: 3 },
  statLbl:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  statVal:   { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.borderDefault },

  empty:    { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textSecondary },

  shareBar:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: 12, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12 },
  cancelSelFooter:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cancelSelFooterTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  shareBarCount:      { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  shareBtn:           { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareTxt:           { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#fff' },
});
