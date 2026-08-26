import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getWarehouseDetail, getStocks } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useSettings } from '../../src/context/SettingsContext';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useTranslation } from 'react-i18next';

// ─── Voucher icon map ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; dir: string }> = {
  'Sales':           { icon: 'arrow-up-outline',     color: COLORS.negative, bg: COLORS.negativeBg,  dir: 'outward' },
  'Sales Invoice':   { icon: 'arrow-up-outline',     color: COLORS.negative, bg: COLORS.negativeBg,  dir: 'outward' },
  'Purchase':        { icon: 'arrow-down-outline',   color: COLORS.positive, bg: COLORS.positiveBg,  dir: 'inward'  },
  'Purchase Invoice':{ icon: 'arrow-down-outline',   color: COLORS.positive, bg: COLORS.positiveBg,  dir: 'inward'  },
  'Stock Transfer':  { icon: 'swap-horizontal-outline', color: COLORS.info, bg: COLORS.infoBg,       dir: 'transfer'},
  'Stock adjustment':{ icon: 'options-outline',      color: '#A89060',       bg: '#FBF7EE',           dir: 'adjust'  },
  'default':         { icon: 'document-text-outline',color: COLORS.textSecondary, bg: COLORS.pageBg, dir: 'other'   },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG['default'];
}

export default function WarehouseDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const { company } = useAuth();
  const { formatAmountCompact } = useSettings();
  const companyGuid = company?.guid;

  const [wh, setWh]             = useState<any>(null);
  const [stocks, setStocks]     = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const warehouseName = wh?.name || decodeURIComponent(params.name || '');

  const load = useCallback(async () => {
    if (!companyGuid || !params.id) return;
    setIsLoading(true);
    setApiError(null);
    try {
      // Load warehouse detail (name, address, activity)
      const detailRes: any = await getWarehouseDetail(companyGuid, params.id);
      const detail = detailRes?.data;
      if (!detail) throw new Error('Warehouse not found');
      setWh(detail);

      // Load stocks for this warehouse using the warehouse name filter
      const stocksRes: any = await getStocks(companyGuid, { warehouse: detail.name, limit: '1000' });
      const items = stocksRes?.data?.items ?? [];
      setStocks(items);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load warehouse');
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, params.id]);

  useEffect(() => { load(); }, [load]);

  // ── Compute tile stats ──────────────────────────────────────────────────────
  const totalSkus  = stocks.length;
  const totalQty   = stocks.reduce((s, r) => s + parseFloat(r.closing_qty || 0), 0);
  const totalValue = stocks.reduce((s, r) => s + parseFloat(r.closing_value || 0), 0);

  const onHandItems = stocks.filter(r => parseFloat(r.closing_qty || 0) > 0);
  const onHandSkus  = onHandItems.length;
  const onHandQty   = onHandItems.reduce((s, r) => s + parseFloat(r.closing_qty || 0), 0);
  const onHandValue = onHandItems.reduce((s, r) => s + parseFloat(r.closing_value || 0), 0);

  const fmtQty   = (q: number) => Math.round(q).toLocaleString('en-IN');
  const fmtValue = (v: number) => v >= 1e5 ? `₹${(v / 1e5).toFixed(1)}L` : `₹${Math.round(v).toLocaleString('en-IN')}`;

  // All activity — infinite scroll via ScrollView
  const recentActivity = wh?.activity || [];

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {warehouseName || 'Warehouse Detail'}
          </Text>
          {wh?.address ? (
            <Text style={s.headerSub} numberOfLines={1}>{wh.address}</Text>
          ) : null}
        </View>
      </View>

      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 12 }}>
          <CardSkeleton height={160} />
          <CardSkeleton height={160} />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : !wh ? null : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── 2 Big Stock Tiles ── */}
          <View style={s.tilesRow}>

            {/* Total Stock tile */}
            <TouchableOpacity
              style={s.tile}
              activeOpacity={0.85}
              onPress={() => router.push(`/stocks/total-stock?warehouse=${encodeURIComponent(wh.name)}` as any)}
            >
              <View style={s.tileIconRow}>
                <View style={[s.tileIcon, { backgroundColor: '#E8F4FF' }]}>
                  <Ionicons name="cube-outline" size={20} color="#4A90D9" />
                </View>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
              </View>
              <Text style={s.tileBigNum}>{fmtQty(totalQty)}</Text>
              <Text style={s.tileName}>{t('stocks.totalStock')}</Text>
              <View style={s.tileStats}>
                <View style={s.tileStat}>
                  <Text style={s.tileStatVal}>{totalSkus}</Text>
                  <Text style={s.tileStatLabel}>SKUs</Text>
                </View>
                <View style={s.tileStatDivider} />
                <View style={s.tileStat}>
                  <Text style={s.tileStatVal}>{fmtValue(totalValue)}</Text>
                  <Text style={s.tileStatLabel}>Value</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* On Hand Stock tile */}
            <TouchableOpacity
              style={[s.tile, { borderColor: COLORS.positiveBg }]}
              activeOpacity={0.85}
              onPress={() => router.push(`/stocks/total-stock?warehouse=${encodeURIComponent(wh.name)}&onhand=true` as any)}
            >
              <View style={s.tileIconRow}>
                <View style={[s.tileIcon, { backgroundColor: COLORS.positiveBg }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.positive} />
                </View>
                <Ionicons name="chevron-forward" size={14} color={COLORS.textTertiary} />
              </View>
              <Text style={[s.tileBigNum, { color: COLORS.positive }]}>{fmtQty(onHandQty)}</Text>
              <Text style={s.tileName}>{t('stocks.onHand')}</Text>
              <View style={s.tileStats}>
                <View style={s.tileStat}>
                  <Text style={s.tileStatVal}>{onHandSkus}</Text>
                  <Text style={s.tileStatLabel}>SKUs</Text>
                </View>
                <View style={s.tileStatDivider} />
                <View style={s.tileStat}>
                  <Text style={s.tileStatVal}>{fmtValue(onHandValue)}</Text>
                  <Text style={s.tileStatLabel}>Value</Text>
                </View>
              </View>
            </TouchableOpacity>

          </View>

          {/* ── Recent Activity ── */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Activity</Text>
            <Text style={s.sectionCount}>{recentActivity.length} transactions</Text>
          </View>

          {recentActivity.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
              <Ionicons name="document-text-outline" size={40} color={COLORS.textTertiary} />
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>No activity yet</Text>
            </View>
          ) : (
            <View style={s.activityCard}>
              {recentActivity.map((a: any, idx: number) => {
                const cfg = getTypeConfig(a.type);
                return (
                  <View key={idx}>
                    <TouchableOpacity
                      style={s.actRow}
                      activeOpacity={0.7}
                      disabled={!a.guid}
                      onPress={() => a.guid ? router.push(`/document/${a.guid}` as any) : undefined}
                    >
                      <View style={[s.actIcon, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
                      </View>
                      <View style={s.actInfo}>
                        <Text style={s.actType}>{a.type}</Text>
                        {!!a.stock_name && (
                          <Text style={s.actStock} numberOfLines={1}>{a.stock_name}</Text>
                        )}
                        <Text style={s.actDate}>
                          {a.date ? a.date : ''}
                          {a.ref ? ` · ${a.ref}` : ''}
                        </Text>
                      </View>
                      <Text style={[s.actQty, { color: cfg.dir === 'inward' ? COLORS.positive : COLORS.negative }]}>
                        {cfg.dir === 'inward' ? '+' : cfg.dir === 'transfer' ? '' : '-'}{Math.abs(parseFloat(a.qty || 0)).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                    {idx < recentActivity.length - 1 && <View style={s.divider} />}
                  </View>
                );
              })}
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.pageBg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  headerSub:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  // Tiles
  tilesRow:       { flexDirection: 'row', gap: 10, margin: SPACING.md },
  tile:           { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, gap: 6 },
  tileIconRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  tileIcon:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tileBigNum:     { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
  tileName:       { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tileStats:      { flexDirection: 'row', alignItems: 'center', marginTop: 6, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingTop: 8 },
  tileStat:       { flex: 1, alignItems: 'center' },
  tileStatVal:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  tileStatLabel:  { fontSize: 9, color: COLORS.textTertiary, marginTop: 2 },
  tileStatDivider:{ width: 1, height: 28, backgroundColor: COLORS.borderDefault },

  // Activity
  sectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle:   { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  activityCard:   { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  actRow:         { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 12 },
  actIcon:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actInfo:        { flex: 1, gap: 2 },
  actType:        { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  actStock:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  actDate:        { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  actQty:         { fontSize: TYPOGRAPHY.base, fontWeight: '700', flexShrink: 0 },
  divider:        { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 62 },
});
