/**
 * Transfer Details — real Stock Journal transfer by voucher_guid.
 * Mock DETAIL_MAP removed; history list remains source of truth for browsing.
 * Route: /stocks/transfer-details?id=<voucher_guid>
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getTransferHistory } from '../../src/services/api';
import { ErrorBanner, EmptyState } from '../../src/components/ApiStateViews';
import { ScreenHeader } from '../../src/components/ScreenHeader';

type TransferItem = {
  item: string;
  qty: number;
  value: number;
  from_warehouse: string;
  to_warehouse: string;
};

type TransferEntry = {
  voucher_guid: string;
  date: string;
  voucher_number: string;
  voucher_type: string;
  items: TransferItem[];
  item_count: number;
  total_value: number;
};

const fmtDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

export default function TransferDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = String(params.id || params.voucherGuid || '').trim();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const { formatAmount } = useSettings();

  const [entry, setEntry] = useState<TransferEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!companyGuid || !id) {
      setEntry(null);
      setLoading(false);
      setError(id ? null : 'Missing transfer id');
      return;
    }
    setLoading(true);
    setError(null);
    const fy = selectedFY ? fyInfoToParam(selectedFY) : undefined;
    // Page through until we find this voucher (or exhaust a few pages)
    const tryPage = async (page: number): Promise<TransferEntry | null> => {
      if (page > 20) return null;
      const res: any = await getTransferHistory(companyGuid, {
        page: String(page),
        limit: '50',
        ...(fy ? { fy } : {}),
      });
      const rows: TransferEntry[] = res?.data?.transfers ?? res?.data ?? [];
      const hit = rows.find(r => r.voucher_guid === id);
      if (hit) return hit;
      const total = Number(res?.meta?.total ?? res?.data?.total ?? 0);
      if (rows.length === 0 || page * 50 >= total) return null;
      return tryPage(page + 1);
    };
    tryPage(1)
      .then((found) => setEntry(found))
      .catch((e: any) => setError(e?.message || 'Failed to load transfer'))
      .finally(() => setLoading(false));
  }, [companyGuid, id, selectedFY]);

  useEffect(() => { load(); }, [load]);

  const routes = entry
    ? Array.from(
        new Map(
          entry.items.map(i => [
            `${i.from_warehouse}→${i.to_warehouse}`,
            { from: i.from_warehouse, to: i.to_warehouse },
          ]),
        ).values(),
      )
    : [];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="Transfer Details" onBack={() => router.back()} />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading && (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.brandPrimary} />
        </View>
      )}

      {!loading && !error && !entry && (
        <EmptyState
          title="Transfer not found"
          subtitle="Open Transfer History from Stocks reports to browse real stock journals"
          icon="swap-horizontal-outline"
        />
      )}

      {!loading && entry && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.idRow}>
            <Text style={s.voucher}>
              {entry.voucher_type}
              {entry.voucher_number ? ` #${entry.voucher_number}` : ''}
            </Text>
            <Text style={s.date}>{fmtDate(entry.date)}</Text>
          </View>

          {routes.map((r, i) => (
            <View key={i} style={s.routeCard}>
              <View style={s.routeCol}>
                <Text style={s.routeLabel}>From</Text>
                <Text style={s.routeVal}>{r.from || '—'}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={COLORS.textTertiary} />
              <View style={[s.routeCol, { alignItems: 'flex-end' }]}>
                <Text style={s.routeLabel}>To</Text>
                <Text style={s.routeVal}>{r.to || '—'}</Text>
              </View>
            </View>
          ))}

          <Text style={s.section}>
            Items ({entry.item_count}) · {formatAmount(Math.round(Number(entry.total_value) || 0))}
          </Text>

          {entry.items.map((it, idx) => (
            <View key={`${it.item}-${idx}`} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{it.item}</Text>
                <Text style={s.itemSub}>
                  {it.from_warehouse} → {it.to_warehouse}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.itemQty}>{it.qty}</Text>
                <Text style={s.itemVal}>{formatAmount(Math.round(Number(it.value) || 0))}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: SPACING.md, gap: 10 },
  idRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.cardBg, padding: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  voucher: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  date: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  routeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg, padding: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, gap: 12,
  },
  routeCol: { flex: 1 },
  routeLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 2 },
  routeVal: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  section: {
    marginTop: 8, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary,
  },
  itemRow: {
    flexDirection: 'row', backgroundColor: COLORS.cardBg, padding: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, gap: 8,
  },
  itemName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  itemSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  itemQty: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  itemVal: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
});
