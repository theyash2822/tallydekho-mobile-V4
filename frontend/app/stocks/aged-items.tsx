import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { getAgedItems } from '../../src/services/api';

// ── Types ────────────────────────────────────────────────────────────────────
interface AgedItem {
  name: string; sku: string; category: string;
  closing_qty: number; closing_rate: number; total_value: number;
  last_sold_date: string | null; last_received_date: string | null;
  days_since_sold: number; days_since_received: number;
}

// ── Config ───────────────────────────────────────────────────────────────────
const BUCKET_TABS = [
  { key: '30',  label: '30 Day'  },
  { key: '60',  label: '60 Day'  },
  { key: '90',  label: '90 Day'  },
  { key: '120', label: '120+ Day'},
] as const;
type Bucket = '30' | '60' | '90' | '120';

const MODE_TABS = [
  { key: 'sold',     label: 'By Value'  },  // items not sold — sorted by value
  { key: 'received', label: 'By Age'    },  // items not received — sorted by days
] as const;
type Mode = 'sold' | 'received';

const AGE_CONFIG = (days: number) => {
  if (days >= 120) return { label: '120d+', color: '#DC2626', bg: '#FEF2F2' };
  if (days >= 90)  return { label: '90-120d', color: '#D97706', bg: '#FFFBEB' };
  if (days >= 60)  return { label: '60-90d', color: '#2563EB', bg: '#EFF6FF' };
  return               { label: '30-60d', color: '#6B7280', bg: '#F3F4F6' };
};

const fmtDate = (d: string | null) => {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

// ── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({
  item, mode, maxValue, formatAmount, formatAmountCompact,
}: {
  item: AgedItem; mode: Mode; maxValue: number;
  formatAmount: (n: number) => string; formatAmountCompact: (n: number) => string;
}) {
  const isNew = mode === 'received' && item.days_since_received < 30;
  const ageDays = mode === 'sold' ? item.days_since_sold : item.days_since_received;
  const ac = AGE_CONFIG(ageDays);
  const barPct = maxValue > 0 ? Math.min(item.total_value / maxValue, 1) : 0;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        {/* Left: name + meta */}
        <View style={s.cardLeft}>
          <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={s.itemMeta}>
            {item.sku ? `${item.sku} · ` : ''}{item.category || '—'}
          </Text>
          <Text style={s.itemDate}>
            {mode === 'sold'
              ? `Last sold: ${fmtDate(item.last_sold_date)}`
              : `Last received: ${fmtDate(item.last_received_date)}`}
          </Text>
        </View>
        {/* Right: value + age tag */}
        <View style={s.cardRight}>
          <Text style={s.itemValue}>{formatAmountCompact(item.total_value)}</Text>
          <Text style={s.itemRate}>₹{item.closing_rate.toLocaleString('en-IN')}/unit</Text>
          {isNew
            ? <View style={[s.ageTag, { backgroundColor: '#E7F9ED' }]}>
                <Text style={[s.ageTagTxt, { color: '#2D7D46' }]}>New</Text>
              </View>
            : <View style={[s.ageTag, { backgroundColor: ac.bg }]}>
                <Text style={[s.ageTagTxt, { color: ac.color }]}>{ac.label}</Text>
              </View>
          }
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${Math.round(barPct * 100)}%` as any }]} />
      </View>

      {/* Bottom: qty + days */}
      <View style={s.cardBottom}>
        <Text style={s.cardBottomTxt}>Qty: {item.closing_qty.toLocaleString('en-IN')}</Text>
        <Text style={s.cardBottomTxt}>
          {mode === 'sold'
            ? `${ageDays} days since last sale`
            : isNew
              ? `Received ${ageDays} days ago`
              : `${ageDays} days in inventory`}
        </Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AgedItemsScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { company } = useAuth();
  const { formatAmount, formatAmountCompact } = useSettings();
  const companyGuid = company?.guid;

  const [bucket,    setBucket]    = useState<Bucket>('30');
  const [mode,      setMode]      = useState<Mode>('sold');
  const [items,     setItems]     = useState<AgedItem[]>([]);
  const [summary,   setSummary]   = useState<{ total_skus: number; total_value: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);

  const load = useCallback(() => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    getAgedItems(companyGuid, { mode, days: bucket })
      .then((res: any) => {
        setItems(res?.data ?? []);
        setSummary(res?.summary ?? null);
      })
      .catch((e: any) => setApiError(e?.message || 'Failed to load aged items'))
      .finally(() => setIsLoading(false));
  }, [companyGuid, mode, bucket]);

  useEffect(() => { load(); }, [load]);

  const maxValue = items.length > 0 ? Math.max(...items.map(i => i.total_value)) : 1;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Aged Inventory</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Summary strip */}
      {summary && !isLoading && (
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{summary.total_skus}</Text>
            <Text style={s.summaryLbl}>SKUs Affected</Text>
          </View>
          <View style={s.summaryDiv} />
          <View style={s.summaryCard}>
            <Text style={s.summaryVal}>{formatAmountCompact(summary.total_value)}</Text>
            <Text style={s.summaryLbl}>Aged Stock Value</Text>
          </View>
        </View>
      )}

      {/* Top tabs: age buckets */}
      <View style={s.tabRow}>
        {BUCKET_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, bucket === t.key && s.tabActive]}
            onPress={() => setBucket(t.key as Bucket)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabTxt, bucket === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Secondary tabs: mode */}
      <View style={s.modeRow}>
        {MODE_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.modeTab, mode === t.key && s.modeTabActive]}
            onPress={() => setMode(t.key as Mode)}
            activeOpacity={0.7}
          >
            <Text style={[s.modeTabTxt, mode === t.key && s.modeTabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error */}
      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {/* Loading */}
      {isLoading ? (
        <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.sm }}>
          {[...Array(5)].map((_, i) => <LedgerRowSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.name}
          renderItem={({ item }) => (
            <ItemCard
              item={item} mode={mode} maxValue={maxValue}
              formatAmount={formatAmount} formatAmountCompact={formatAmountCompact}
            />
          )}
          contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="time-outline" size={48} color={COLORS.textTertiary} />
              </View>
              <Text style={s.emptyTitle}>No Aged Items</Text>
              <Text style={s.emptyDesc}>
                No items match the selected age bucket and mode.
              </Text>
            </View>
          }
        />
      )}
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

  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingVertical: SPACING.md,
  },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryDiv:  { width: 1, height: 32, backgroundColor: COLORS.borderDefault },
  summaryVal:  { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },

  // Top bucket tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, paddingBottom: 0,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingBottom: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.brandPrimary },
  tabTxt:    { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: COLORS.brandPrimary },

  // Secondary mode tabs
  modeRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  modeTab: {
    paddingHorizontal: SPACING.md, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg,
  },
  modeTabActive:  { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  modeTabTxt:     { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  modeTabTxtActive: { color: '#fff' },

  list: { paddingHorizontal: SPACING.md, paddingTop: SPACING.xs },

  // Item card
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  cardTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  cardLeft:   { flex: 1, marginRight: SPACING.sm },
  cardRight:  { alignItems: 'flex-end', gap: 4 },
  itemName:   { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  itemMeta:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginBottom: 2 },
  itemDate:   { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  itemValue:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemRate:   { fontSize: 10, color: COLORS.textTertiary },
  ageTag: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  ageTagTxt:  { fontSize: 10, fontWeight: '700' },
  progressBg: {
    height: 4, backgroundColor: COLORS.pageBg, borderRadius: 2, marginBottom: SPACING.sm,
  },
  progressFill: { height: 4, backgroundColor: COLORS.brandPrimary, borderRadius: 2 },
  cardBottom:   { flexDirection: 'row', justifyContent: 'space-between' },
  cardBottomTxt: { fontSize: 10, color: COLORS.textTertiary },

  // Empty
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: SPACING.xl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  emptyDesc:  { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
});
