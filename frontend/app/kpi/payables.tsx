import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { getKPIPayables } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';

const { width: SW } = Dimensions.get('window');

type PartyRow = { id: string; name: string; amount: number; days: number };
type BillRow = { id: string; party: string; ref: string; date: string; amount: number };

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function PayablesScreen() {
  const router = useRouter();
  const { company, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [kpiIdx, setKpiIdx] = useState(0);
  const [tab, setTab] = useState<'parties' | 'bills'>('parties');

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const res: any = await getKPIPayables(companyGuid);
      setApiData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load payables');
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, lastSyncAt]);

  useEffect(() => { load(); }, [load]);

  const aging = useMemo(() => {
    const rows = Array.isArray(apiData?.aging) ? apiData.aging : [];
    const total = Number(apiData?.total) || 0;
    return [
      { id: 'total', icon: 'documents-outline', label: 'Total Due', amount: formatAmountCompact(Math.round(total)) },
      ...rows.map((a: any) => ({
        id: a.bucket,
        icon: 'calendar-outline',
        label: a.bucket,
        amount: formatAmountCompact(Math.round(Number(a.amount) || 0)),
      })),
    ];
  }, [apiData, formatAmountCompact]);

  const parties = useMemo<PartyRow[]>(() => {
    const rows = Array.isArray(apiData?.parties) ? apiData.parties : [];
    return rows.map((p: any, i: number) => ({
      id: `${p.name}-${i}`,
      name: p.name,
      amount: Math.abs(Number(p.amount) || 0),
      days: Number(p.days_overdue) || 0,
    }));
  }, [apiData]);

  const bills = useMemo<BillRow[]>(() => {
    const rows = Array.isArray(apiData?.bills) ? apiData.bills : [];
    return rows.map((b: any, i: number) => ({
      id: `${b.ref}-${i}`,
      party: b.party,
      ref: b.ref,
      date: b.date,
      amount: Math.abs(Number(b.amount) || 0),
    }));
  }, [apiData]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Payables</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {apiError && <ErrorBanner message={apiError} onRetry={load} />}

        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={100} />
            {[0, 1, 2, 3].map(i => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            <View style={s.kpiSection}>
              <FlatList
                horizontal
                pagingEnabled
                data={aging}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
                onMomentumScrollEnd={(e) => setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
                renderItem={({ item }) => (
                  <View style={s.kpiItem}>
                    <View style={s.kpiCard}>
                      <View style={s.kpiIconBox}>
                        <Ionicons name={item.icon as any} size={20} color={COLORS.textSecondary} />
                      </View>
                      <View style={s.kpiTextWrap}>
                        <Text style={s.kpiLabel}>{item.label}</Text>
                        <Text style={s.kpiAmount} numberOfLines={1} adjustsFontSizeToFit>{item.amount}</Text>
                      </View>
                    </View>
                  </View>
                )}
              />
              <View style={s.dots}>
                {aging.map((_, i) => <View key={i} style={[s.dot, i === kpiIdx && s.dotActive]} />)}
              </View>
            </View>

            <View style={s.recentCard}>
              <View style={s.tabRow}>
                {(['parties', 'bills'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tabBtn, tab === t && s.tabBtnActive]}
                    onPress={() => setTab(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                      {t === 'parties' ? 'Parties' : 'Bills'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tab === 'parties' ? (
                parties.length === 0 ? (
                  <View style={s.empty}><Text style={s.emptyTxt}>No payables</Text></View>
                ) : parties.map((p: PartyRow, idx: number) => (
                  <View key={p.id} style={[s.txRow, idx < parties.length - 1 && s.txBorder]}>
                    <View style={s.txIconBox}>
                      <Ionicons name="person-outline" size={17} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.txInfo}>
                      <Text style={s.txMode} numberOfLines={1}>{p.name}</Text>
                      <Text style={s.txSub}>{p.days > 0 ? `${p.days}d overdue` : 'Current'}</Text>
                    </View>
                    <Text style={s.txAmt}>{formatAmount(Math.round(p.amount))}</Text>
                  </View>
                ))
              ) : (
                bills.length === 0 ? (
                  <View style={s.empty}><Text style={s.emptyTxt}>No outstanding bills</Text></View>
                ) : bills.map((b: BillRow, idx: number) => (
                  <View key={b.id} style={[s.txRow, idx < bills.length - 1 && s.txBorder]}>
                    <View style={s.txIconBox}>
                      <Ionicons name="document-text-outline" size={17} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.txInfo}>
                      <View style={s.txTopRow}>
                        <Text style={s.txMode} numberOfLines={1}>{b.party}</Text>
                        <Text style={s.txRef}> · {b.ref || '—'}</Text>
                      </View>
                      <Text style={s.txSub}>{fmtDate(b.date)}</Text>
                    </View>
                    <Text style={s.txAmt}>{formatAmount(Math.round(b.amount))}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  scroll: { paddingTop: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  kpiSection: { marginBottom: SPACING.md },
  kpiItem: { width: SW },
  kpiCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  kpiIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  kpiTextWrap: { flex: 1, gap: 2 },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  recentCard: { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg },
  tabBtnActive: { backgroundColor: COLORS.textPrimary },
  tabTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: '#fff' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SPACING.md, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txTopRow: { flexDirection: 'row', alignItems: 'center' },
  txMode: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  txRef: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  txSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
