import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

/** Rotating gradients for bank cards (matches pre-cleanup design language). */
const CARD_GRADIENTS: readonly [string, string][] = [
  ['#1B5E40', '#0D3B2E'],
  ['#1B3A5E', '#0D2040'],
  ['#3D1A5E', '#200D40'],
  ['#5E3A1B', '#3B240D'],
  ['#1B5E5E', '#0D3B3B'],
  ['#4A1B5E', '#2A0D3B'],
];

type BankTx = {
  guid?: string;
  voucher_number?: string;
  party_name?: string;
  date?: string;
  amount: number;
  type?: string;
};

type BankCardData = {
  id: string;
  name: string;
  /** Secondary label — masked A/c from Tally when present, else parent/OD */
  accountLabel: string;
  ifsc: string;
  balance: number;
  /** Latest txn date for this ledger in the selected period, else empty */
  lastFeed: string;
  gradient: readonly [string, string];
  parent?: string;
  transactions: BankTx[];
};

function fmtDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function maskAccountNo(raw?: string) {
  const digits = String(raw || '').replace(/\s+/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return digits;
  return `••••${digits.slice(-4)}`;
}

function accountLabelFromTally(b: {
  name?: string;
  parent?: string;
  account_number?: string;
}) {
  const masked = maskAccountNo(b.account_number);
  if (masked) return masked;
  const p = String(b.parent || '').trim();
  const name = String(b.name || '');
  if (/OD|Overdraft/i.test(p) || /OD|Overdraft/i.test(name)) return 'OD / Overdraft';
  if (/Bank Account/i.test(p)) return 'Bank A/c';
  if (p) return p.length > 18 ? `${p.slice(0, 16)}…` : p;
  return 'Ledger';
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
  const [bankIdx, setBankIdx] = useState(0);
  const kpiRef = useRef<FlatList>(null);

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

  const banks: BankCardData[] = useMemo(() => {
    const rows = Array.isArray(apiData?.banks) ? apiData.banks : [];
    return rows.map((b: any, i: number) => {
      const txs: BankTx[] = Array.isArray(b.transactions)
        ? b.transactions.map((t: any) => ({
            guid: t.guid,
            voucher_number: t.voucher_number,
            party_name: t.party_name,
            date: t.date,
            amount: Math.abs(Number(t.amount) || 0),
            type: t.type || 'Cr',
          }))
        : [];
      const latest = txs[0]?.date;
      return {
        id: b.name || `bank-${i}`,
        name: b.name || 'Bank',
        accountLabel: accountLabelFromTally(b),
        ifsc: String(b.ifsc || '').trim(),
        balance: Math.abs(Number(b.balance) || 0),
        lastFeed: latest ? fmtDate(latest) : '',
        gradient: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
        parent: b.parent,
        transactions: txs,
      };
    });
  }, [apiData]);

  useEffect(() => {
    if (bankIdx >= banks.length) setBankIdx(0);
  }, [banks.length, bankIdx]);

  const activeBank = banks[bankIdx] || banks[0];
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
            <CardSkeleton height={160} />
            {[0, 1, 2].map(i => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            {/* ── KPI Carousel ── */}
            <View style={s.kpiSection}>
              <FlatList
                ref={kpiRef}
                horizontal
                pagingEnabled
                data={kpiCards}
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setKpiIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                }}
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

            {/* ── Bank Cards Carousel (live Tally balances) ── */}
            {banks.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyTxt}>No bank ledgers found in Tally</Text>
              </View>
            ) : (
              <View style={s.bankSection}>
                <FlatList
                  horizontal
                  pagingEnabled
                  data={banks}
                  keyExtractor={b => b.id}
                  showsHorizontalScrollIndicator={false}
                  getItemLayout={(_, index) => ({ length: SW, offset: SW * index, index })}
                  onScrollToIndexFailed={() => {}}
                  onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    setBankIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                  }}
                  renderItem={({ item: bank }) => (
                    <View style={s.bankItem}>
                      <LinearGradient
                        colors={[...bank.gradient]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.bankCard}
                      >
                        <View style={s.bankTopRow}>
                          <Text style={s.bankName} numberOfLines={1}>{bank.name}</Text>
                          <View style={s.bankDotSep} />
                          <Text style={s.bankAcct} numberOfLines={1}>{bank.accountLabel}</Text>
                        </View>

                        <View style={s.bankBottomRow}>
                          <View>
                            <Text style={s.bankBalLabel}>Balance</Text>
                            <Text style={s.bankBal} numberOfLines={1} adjustsFontSizeToFit>
                              {formatAmount(Math.round(bank.balance))}
                            </Text>
                          </View>
                          <View style={s.bankMetaCol}>
                            {!!bank.ifsc && (
                              <Text style={s.bankIfsc} numberOfLines={1}>{bank.ifsc}</Text>
                            )}
                            <Text style={s.bankFeed}>
                              {bank.lastFeed ? `Last txn ${bank.lastFeed}` : 'No txns in period'}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </View>
                  )}
                />
                <View style={s.dots}>
                  {banks.map((_, i) => (
                    <View key={i} style={[s.dot, i === bankIdx && s.dotActive]} />
                  ))}
                </View>
              </View>
            )}

            {/* ── Period + Recent Transactions for active card ── */}
            <View style={s.txSection}>
              <View style={s.txHeader}>
                <Text style={s.txHeading} numberOfLines={1}>
                  {activeBank ? activeBank.name : 'Recent Transactions'}
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
              ) : txs.map((t, idx) => {
                // Bank ledger: Dr = inflow (money in), Cr = outflow (money out) — matches API today_in/out.
                const isInflow = t.type === 'Dr';
                return (
                  <TouchableOpacity
                    key={t.guid || `${t.voucher_number}-${idx}`}
                    style={[s.txRow, idx < txs.length - 1 && s.txBorder]}
                    activeOpacity={0.7}
                    onPress={() => t.guid && router.push(`/document/${t.guid}` as any)}
                  >
                    <View style={s.txIconBox}>
                      <Ionicons name="card-outline" size={18} color={COLORS.textSecondary} />
                    </View>
                    <View style={s.txInfo}>
                      <Text style={s.txId} numberOfLines={1}>
                        {t.voucher_number || t.party_name || 'Voucher'}
                      </Text>
                      <Text style={s.txDate}>
                        {[t.party_name, fmtDate(t.date)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[s.txAmt, { color: isInflow ? COLORS.positive : COLORS.negative }]}>
                      {formatAmount(Math.round(t.amount))} {t.type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  headerBtn: { width: 40 },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  kpiSection: { marginBottom: SPACING.md },
  kpiItem: { width: SW },
  kpiCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  kpiIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  kpiTextWrap: { flex: 1, gap: 2 },
  kpiLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  kpiAmount: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },

  dots: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 5, marginTop: 10,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.borderDefault },
  dotActive: { width: 16, height: 5, borderRadius: 3, backgroundColor: COLORS.textPrimary },

  bankSection: { marginBottom: SPACING.md },
  bankItem: { width: SW },
  bankCard: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 24,
    minHeight: 150,
  },
  bankTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bankName: { flexShrink: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: '#FFFFFF' },
  bankDotSep: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  bankAcct: { flexShrink: 0, fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.8)' },
  bankBottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  bankBalLabel: { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  bankBal: { fontSize: TYPOGRAPHY.xxl, fontWeight: '800', color: '#FFFFFF', maxWidth: SW - 160 },
  bankMetaCol: { flexShrink: 1, alignItems: 'flex-end', gap: 2, maxWidth: SW * 0.42 },
  bankIfsc: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  bankFeed: { fontSize: TYPOGRAPHY.xs, color: 'rgba(255,255,255,0.65)', textAlign: 'right' },

  emptyCard: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    padding: 24, borderRadius: RADIUS.lg, backgroundColor: COLORS.cardBg,
    borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center',
  },

  txSection: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: 4,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  txHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginBottom: 10,
  },
  txHeading: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  periodRow: { flexDirection: 'row', gap: 4 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderDefault },
  periodBtnActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  periodTxt: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  periodTxtActive: { color: '#fff' },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  txBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  txIconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  txInfo: { flex: 1 },
  txId: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  txDate: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  txAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', flexShrink: 0 },
  empty: { padding: 24, alignItems: 'center' },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});
