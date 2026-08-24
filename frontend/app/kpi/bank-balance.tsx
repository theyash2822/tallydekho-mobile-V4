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
import { getKPIBankBalance } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import {
  resolvePeriodDates,
  type DashboardPeriod,
} from '../../src/utils/periodDates';

const { width: SW } = Dimensions.get('window');
const PERIOD_TABS = ['7D', '1M', '3M', '6M'] as const;

type BankTx = {
  guid?: string;
  voucher_number?: string;
  party_name?: string;
  date?: string;
  amount: number;
  type?: string;
};

type Bank = {
  name: string;
  balance: number;
  transactions: BankTx[];
};

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function BankBalanceScreen() {
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const { formatAmountCompact, formatAmount } = useSettings();
  const companyGuid = company?.guid;

  const [period, setPeriod] = useState<(typeof PERIOD_TABS)[number]>('7D');
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [kpiIdx, setKpiIdx] = useState(0);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    try {
      const { from, to } = resolvePeriodDates(period as DashboardPeriod, {
        from: selectedFY?.startDate,
        to: selectedFY?.endDate,
      });
      const res: any = await getKPIBankBalance(companyGuid, { from, to, period });
      setApiData(res?.data ?? res);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load bank balance');
      setApiData(null);
    } finally {
      setIsLoading(false);
    }
  }, [companyGuid, period, selectedFY?.startDate, selectedFY?.endDate, lastSyncAt]);

  useEffect(() => { load(); }, [load]);

  const banks: Bank[] = useMemo(() => {
    const rows = Array.isArray(apiData?.banks) ? apiData.banks : [];
    return rows.map((b: any) => ({
      name: b.name,
      balance: Math.abs(Number(b.balance) || 0),
      transactions: Array.isArray(b.transactions) ? b.transactions.map((t: any) => ({
        guid: t.guid,
        voucher_number: t.voucher_number,
        party_name: t.party_name,
        date: t.date,
        amount: Math.abs(Number(t.amount) || 0),
        type: t.type || 'Cr',
      })) : [],
    }));
  }, [apiData]);

  useEffect(() => {
    if (!selectedBank && banks.length) setSelectedBank(banks[0].name);
  }, [banks, selectedBank]);

  const activeBank = banks.find(b => b.name === selectedBank) || banks[0];
  const txs = activeBank?.transactions || [];

  const kpiCards = useMemo(() => {
    const total = Number(apiData?.total_balance) || banks.reduce((s, b) => s + b.balance, 0);
    const inflow = Number(apiData?.today_inflow) || 0;
    const outflow = Number(apiData?.today_outflow) || 0;
    return [
      { id: 'total', icon: 'wallet-outline', label: 'Total Balance', amount: formatAmountCompact(Math.round(total)) },
      { id: 'in', icon: 'arrow-down-circle-outline', label: 'Inflow Today', amount: formatAmountCompact(Math.round(inflow)) },
      { id: 'out', icon: 'arrow-up-circle-outline', label: 'Outflow Today', amount: formatAmountCompact(Math.round(outflow)) },
      { id: 'count', icon: 'business-outline', label: 'Bank Accounts', amount: String(banks.length) },
    ];
  }, [apiData, banks, formatAmountCompact]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Bank Balance</Text>
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

            {banks.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bankChips}>
                {banks.map(b => (
                  <TouchableOpacity
                    key={b.name}
                    style={[s.bankChip, selectedBank === b.name && s.bankChipActive]}
                    onPress={() => setSelectedBank(b.name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.bankChipTxt, selectedBank === b.name && s.bankChipTxtActive]} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={[s.bankChipAmt, selectedBank === b.name && s.bankChipTxtActive]}>
                      {formatAmountCompact(Math.round(b.balance))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={s.recentCard}>
              <View style={s.recentHeader}>
                <Text style={s.recentTitle} numberOfLines={1}>
                  {activeBank ? activeBank.name : 'Transactions'}
                </Text>
                <View style={s.periodRow}>
                  {PERIOD_TABS.map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[s.periodBtn, period === p && s.periodBtnActive]}
                      onPress={() => setPeriod(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.periodTxt, period === p && s.periodTxtActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {banks.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTxt}>No bank ledgers found</Text>
                </View>
              ) : txs.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTxt}>No transactions in this period</Text>
                </View>
              ) : txs.map((t, idx) => (
                <TouchableOpacity
                  key={t.guid || `${t.voucher_number}-${idx}`}
                  style={[s.txRow, idx < txs.length - 1 && s.txBorder]}
                  activeOpacity={0.7}
                  onPress={() => t.guid && router.push(`/document/${t.guid}` as any)}
                >
                  <View style={s.txIconBox}>
                    <Ionicons
                      name={t.type === 'Dr' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={17}
                      color={COLORS.textSecondary}
                    />
                  </View>
                  <View style={s.txInfo}>
                    <View style={s.txTopRow}>
                      <Text style={s.txMode}>{t.type === 'Dr' ? 'Credit' : 'Debit'}</Text>
                      <Text style={s.txRef}> · {t.voucher_number || '—'}</Text>
                    </View>
                    <Text style={s.txSub} numberOfLines={1}>
                      {t.party_name || '—'} · {fmtDate(t.date)}
                    </Text>
                  </View>
                  <Text style={s.txAmt}>{formatAmount(Math.round(t.amount))}</Text>
                </TouchableOpacity>
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

  bankChips: { paddingHorizontal: SPACING.md, gap: 8, paddingBottom: 12 },
  bankChip: { maxWidth: 180, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  bankChipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  bankChipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  bankChipAmt: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  bankChipTxtActive: { color: '#fff' },

  recentCard: { marginHorizontal: SPACING.md, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: 14, paddingBottom: 10, gap: 8 },
  recentTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  periodRow: { flexDirection: 'row', gap: 4 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  periodBtnActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  periodTxt: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: '#fff' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: SPACING.md, gap: 10 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txInfo: { flex: 1 },
  txTopRow: { flexDirection: 'row', alignItems: 'center' },
  txMode: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  txRef: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  txSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
