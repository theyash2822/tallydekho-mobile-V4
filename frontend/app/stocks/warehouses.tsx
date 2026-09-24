import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getWarehouses } from '../../src/services/api';
import SearchBar from '../../src/components/SearchBar';
import { useAuth } from '../../src/context/AuthContext';
import { CardSkeleton } from '../../src/components/ShimmerPlaceholder';
import { useTranslation } from 'react-i18next';

// ─── RING CHART (outside screen component) ───────────────────────────────────────

function RingChart({ pct, label, size = 82 }: { pct: number; label: string; size?: number }) {
  const cx   = size / 2;
  const cy   = size / 2;
  const r    = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ * (1 - Math.min(pct, 100) / 100);
  const arc  = pct >= 85 ? COLORS.negative : '#A89060';
  // Adaptive font size so large numbers (e.g. 125) fit inside the ring
  const fontSize = label.length <= 2 ? 17 : label.length === 3 ? 14 : 11;

  return (
    <Svg width={size} height={size}>
      {/* Track */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={COLORS.borderDefault} strokeWidth={11}
      />
      {/* Progress arc (fill based on qty %) */}
      <Circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={arc}
        strokeWidth={11}
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90, ${cx}, ${cy})`}
      />
      {/* SKU count — no percentage */}
      <SvgText
        x={cx} y={cy + 4}
        textAnchor="middle" fontSize={String(fontSize)} fontWeight="800"
        fill={COLORS.textPrimary}
      >
        {label}
      </SvgText>
      <SvgText
        x={cx} y={cy + 15}
        textAnchor="middle" fontSize="7"
        fill={COLORS.textTertiary}
      >
        items
      </SvgText>
    </Svg>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function WarehousesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [query, setQuery] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setError(null);
    getWarehouses(companyGuid)
      .then((res: any) => {
        const rows = res?.data ?? (Array.isArray(res) ? res : []);
        setWarehouses(rows.map((r: any) => ({
          id: r.id || r.guid || r.name,
          name: r.name,
          location: r.address || r.parent || '',
          parent: r.parent || '',
          code: r.code || r.alias || '',
          total_qty: parseFloat(r.total_qty || 0),
          skus: parseInt(r.skus || 0),
          // utilization not available without capacity data — computed as 0
          utilization: 0,
        })));
      })
      .catch((err: any) => {
        console.error('[Warehouses]', err?.message);
        setError(err?.message || 'Failed to load warehouses');
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid]);

  const q = query.toLowerCase();
  const filtered = warehouses.filter(
    w =>
      w.name.toLowerCase().includes(q) ||
      w.location.toLowerCase().includes(q) ||
      (w.code || '').toLowerCase().includes(q),
  );

  // Compute total qty across all warehouses for relative ring fill
  const grandTotalQty = warehouses.reduce((s, w) => s + (w.total_qty || 0), 0);
  const avgUtil = warehouses.length > 0
    ? Math.round(warehouses.reduce((s, w) => s + (w.utilization || 0), 0) / warehouses.length)
    : 0;
  const utilColor = avgUtil >= 85 ? COLORS.negative : '#A89060';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('stocks.warehouses')}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => safePush(router, '/stocks/create-warehouse' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryRow}>
        {[
          { label: 'Warehouses',      value: `${warehouses.length}`,  clr: COLORS.textPrimary },
          { label: 'Avg Utilization', value: `${avgUtil}%`,           clr: utilColor          },
          { label: 'Locations',       value: `${warehouses.length}`,  clr: COLORS.textPrimary },
        ].map((s, i) => (
          <View key={i} style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: s.clr }]}>{s.value}</Text>
            <Text style={styles.summaryLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search warehouses..." />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {isLoading ? (
          <View style={{ gap: 12 }}>
            <CardSkeleton height={110} />
            <CardSkeleton height={110} />
            <CardSkeleton height={110} />
            <CardSkeleton height={110} />
          </View>
        ) : error ? (
          <View style={styles.centerBox}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.negative} />
            <Text style={styles.centerTxt}>{error}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerBox}>
            <Ionicons name="business-outline" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No warehouses found</Text>
            <Text style={styles.emptySubtitle}>
              {warehouses.length === 0
                ? 'Sync your Tally data to see godowns here'
                : 'No results match your search'}
            </Text>
          </View>
        ) : (
          filtered.map(wh => (
            <TouchableOpacity
              key={wh.id}
              style={styles.whCard}
              activeOpacity={0.8}
              onPress={() => safePush(router, `/stocks/warehouse-detail?id=${wh.id}&name=${encodeURIComponent(wh.name)}` as any)}
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
                  {wh.code ? (
                    <Text style={styles.codeTxt}>{wh.code}</Text>
                  ) : null}
                  {wh.location ? (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={11} color={COLORS.textTertiary} />
                      <Text style={styles.locationTxt}>{wh.location}</Text>
                    </View>
                  ) : null}
                  {wh.parent ? (
                    <View style={styles.badgeRow}>
                      <View style={styles.badge}>
                        <Ionicons name="git-branch-outline" size={9} color={COLORS.textSecondary} />
                        <Text style={styles.badgeTxt}>{wh.parent}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* Ring fill = % of total company qty, inner = SKU count */}
                <RingChart
                  pct={grandTotalQty > 0 ? Math.round((wh.total_qty / grandTotalQty) * 100) : 0}
                  label={String(wh.skus)}
                />
              </View>

              {/* Footer */}
              <View style={styles.cardFooter}>
                <Ionicons name="cube-outline" size={11} color={COLORS.textTertiary} />
                <Text style={styles.managerTxt}>
                  {wh.skus} items · qty {Math.round(wh.total_qty).toLocaleString('en-IN')}
                </Text>
                <View style={{ flex: 1 }} />
                <Ionicons name="chevron-forward" size={13} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

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

  scroll:  { flex: 1 },
  content: { padding: SPACING.md, gap: 10 },

  centerBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  centerTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center' },
  emptyTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 24 },

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
  codeTxt:     { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.3 },
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
