import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { getHsnValidation } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import SearchBar from '../../src/components/SearchBar';
import { safePush } from '../../src/utils/safeNavigation';

type Filter = 'all' | 'missing' | 'bad_format' | 'unknown';

const STATUS_LABEL: Record<string, string> = {
  missing: 'Missing',
  bad_format: 'Bad format',
  unknown: 'Not in list',
};

export default function HsnValidationScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState({ missing: 0, bad_format: 0, unknown: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setLoading(true);
    setError(null);
    try {
      const res: any = await getHsnValidation(companyGuid);
      const data = res?.data;
      setEnabled(data?.enabled !== false);
      setItems(data?.items || []);
      setCounts(data?.counts || { missing: 0, bad_format: 0, unknown: 0, total: 0 });
    } catch (e: any) {
      setError(e?.message || 'Failed to load HSN validation');
    } finally {
      setLoading(false);
    }
  }, [companyGuid]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'all' && it.status !== filter) return false;
      if (!q) return true;
      return (
        (it.name || '').toLowerCase().includes(q) ||
        (it.displayName || '').toLowerCase().includes(q) ||
        (it.hsn || '').toLowerCase().includes(q) ||
        (it.sku || '').toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'missing', label: 'Missing', count: counts.missing },
    { id: 'unknown', label: 'Not in list', count: counts.unknown },
    { id: 'bad_format', label: 'Format', count: counts.bad_format },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>HSN Validation</Text>
        <View style={{ width: 40 }} />
      </View>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {!enabled ? (
        <View style={s.empty}>
          <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.textTertiary} />
          <Text style={s.emptyTitle}>Verification is off</Text>
          <Text style={s.emptySub}>Turn on HSN Code Verification in Stock Settings to see items that need attention.</Text>
          <TouchableOpacity
            style={s.cta}
            onPress={() => safePush(router, '/stocks/settings' as any)}
            activeOpacity={0.8}
          >
            <Text style={s.ctaTxt}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: 10 }}>
          <CardSkeleton height={72} />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
          <LedgerRowSkeleton />
        </ScrollView>
      ) : (
        <>
          <View style={s.summary}>
            <Text style={s.summaryNum}>{counts.total}</Text>
            <Text style={s.summaryLbl}>items need attention</Text>
          </View>

          <View style={s.chipRow}>
            {chips.map((c) => {
              const active = filter === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setFilter(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>
                    {c.label} {c.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ paddingHorizontal: SPACING.md, marginBottom: 8 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search item or HSN" />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: 40 }}>
            {filtered.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkmark-circle-outline" size={40} color={COLORS.positive} />
                <Text style={s.emptyTitle}>All clear</Text>
                <Text style={s.emptySub}>No items match this filter.</Text>
              </View>
            ) : (
              filtered.map((it) => (
                <TouchableOpacity
                  key={it.id}
                  style={s.row}
                  activeOpacity={0.8}
                  onPress={() => safePush(router, `/stocks/item-detail?id=${it.id}&name=${encodeURIComponent(it.name)}` as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName} numberOfLines={1}>{it.displayName || it.name}</Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {it.hsn ? `HSN ${it.hsn}` : 'No HSN'}
                      {it.group ? ` · ${it.group}` : ''}
                    </Text>
                    <Text style={s.rowMsg}>{it.message}</Text>
                  </View>
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>{STATUS_LABEL[it.status] || it.status}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 40 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary,
  },
  summary: {
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  summaryNum: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary },
  summaryLbl: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: COLORS.borderStrong, backgroundColor: COLORS.cardBg,
  },
  chipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '500' },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  rowName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  rowMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  rowMsg: { fontSize: 11, color: '#92400E', marginTop: 4 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: RADIUS.sm, backgroundColor: '#FFFBEB',
  },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: 12, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.md,
  },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: TYPOGRAPHY.sm },
});
