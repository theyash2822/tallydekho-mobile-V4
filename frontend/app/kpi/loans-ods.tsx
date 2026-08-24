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
import { getKPILoansODs } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';

const { width: SW } = Dimensions.get('window');

type LoanRow = { id: string; name: string; balance: number };

export default function LoansODsScreen() {
  const router = useRouter();
  const { company, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [kpiIdx, setKpiIdx] = useState(0);

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const res: any = await getKPILoansODs(companyGuid);
      setApiData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load loans & ODs');
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, lastSyncAt]);

  useEffect(() => { load(); }, [load]);

  const loans = useMemo<LoanRow[]>(() => {
    const rows = Array.isArray(apiData?.loans) ? apiData.loans : [];
    return rows.map((l: any, i: number) => ({
      id: `${l.name}-${i}`,
      name: l.name,
      balance: Math.abs(Number(l.balance) || 0),
    }));
  }, [apiData]);

  const kpiCards = useMemo(() => {
    const total = Number(apiData?.total) || loans.reduce((s: number, l: LoanRow) => s + l.balance, 0);
    const od = loans.filter((l: LoanRow) => /od|overdraft/i.test(l.name)).reduce((s: number, l: LoanRow) => s + l.balance, 0);
    const term = total - od;
    return [
      { id: 'total', icon: 'cash-outline', label: 'Total Outstanding', amount: formatAmountCompact(Math.round(total)) },
      { id: 'term', icon: 'business-outline', label: 'Loans', amount: formatAmountCompact(Math.round(term)) },
      { id: 'od', icon: 'swap-horizontal-outline', label: 'ODs / Overdraft', amount: formatAmountCompact(Math.round(od)) },
      { id: 'count', icon: 'list-outline', label: 'Accounts', amount: String(loans.length) },
    ];
  }, [apiData, loans, formatAmountCompact]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Loans & ODs</Text>
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
                data={kpiCards}
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
                {kpiCards.map((_, i) => <View key={i} style={[s.dot, i === kpiIdx && s.dotActive]} />)}
              </View>
            </View>

            <View style={s.recentCard}>
              <View style={s.recentHeader}>
                <Text style={s.recentTitle}>Loan & OD Ledgers</Text>
              </View>

              {loans.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTxt}>No loan or OD ledgers found</Text>
                </View>
              ) : loans.map((l: LoanRow, idx: number) => (
                <View key={l.id} style={[s.txRow, idx < loans.length - 1 && s.txBorder]}>
                  <View style={s.txIconBox}>
                    <Ionicons
                      name={/od|overdraft/i.test(l.name) ? 'swap-horizontal-outline' : 'business-outline'}
                      size={17}
                      color={COLORS.textSecondary}
                    />
                  </View>
                  <View style={s.txInfo}>
                    <Text style={s.txMode} numberOfLines={1}>{l.name}</Text>
                    <Text style={s.txSub}>
                      {/od|overdraft/i.test(l.name) ? 'Overdraft' : 'Loan'}
                    </Text>
                  </View>
                  <Text style={s.txAmt}>{formatAmount(Math.round(l.balance))}</Text>
                </View>
              ))}
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
  recentHeader: { paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10 },
  recentTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SPACING.md, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txMode: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
