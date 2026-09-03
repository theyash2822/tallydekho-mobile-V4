import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getExpenses, getExpensesHomeMetrics } from '../../src/services/api';
import { CardSkeleton, LedgerRowSkeleton } from '../../src/components/ShimmerPlaceholder';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useSettings } from '../../src/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { VoucherListTile, ExpenseTypeBadge } from '../../src/components/VoucherListTile';
import { openLedgerDetail } from '../../src/utils/openLedger';
import { buildHomeMetricCards } from '../../src/utils/homeMetricCards';
import { KPICarouselCard, KPICarouselPage, KPICarouselDots } from '../../src/components/KPICarouselCard';
import { EntityListTile } from '../../src/components/EntityListTile';
import { ListTileShell } from '../../src/components/ListTileShell';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ViewAllButton } from '../../src/components/ViewAllButton';

const { width: SW } = Dimensions.get('window');

type ExpenseRow = {
  id: string;
  guid?: string;
  voucher?: string;
  party: string;
  date: string;
  time: string;
  amount: string;
  status: string;
  expenseGroup?: string;
  expenseType?: string;
};

function mapExpenseRow(r: any, formatAmount: (n: number) => string, i = 0): ExpenseRow {
  const amt = Math.abs(parseFloat(r.expense_amount ?? r.amount) || 0);
  return {
    id: r.guid || `exp-${r.voucher_number || 'x'}-${r.id ?? i}`,
    guid: r.guid,
    voucher: r.voucher_number || '',
    party: r.expense_ledger || r.party_name || r.narration || 'Expense',
    date: r.date || '',
    time: '',
    amount: formatAmount(amt),
    status: 'paid',
    expenseGroup: r.expense_group || '',
    expenseType: r.expense_type || '',
  };
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function ExpenseScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact } = useSettings();
  const router = useRouter();
  const { company, selectedFY, lastSyncAt } = useAuth();
  const companyGuid = company?.guid;

  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [liveExpenses, setLiveExpenses] = useState<ExpenseRow[]>([]);
  const [liveCategories, setLiveCategories] = useState<any[]>([]);
  const [homeMetrics, setHomeMetrics] = useState<any>(null);

  const fyFrom = selectedFY?.startDate ?? '';
  const fyTo   = selectedFY?.endDate   ?? '';

  const [tab, setTab] = useState<'recent' | 'categories'>('recent');

  const metricRef = useRef<FlatList>(null);
  const [metricIdx, setMetricIdx] = useState(0);

  const loadData = useCallback(() => {
    if (!companyGuid) {
      setLiveExpenses([]);
      setLiveCategories([]);
      setHomeMetrics(null);
      setIsLoading(false);
      return;
    }

    const rangeParams = fyFrom && fyTo ? { from: fyFrom, to: fyTo } : {};

    setIsLoading(true);
    setApiError(null);

    Promise.allSettled([
      getExpenses(companyGuid, { ...rangeParams, limit: '100', page: '1' } as any),
      getExpensesHomeMetrics(companyGuid, rangeParams),
    ])
      .then(([expSettled, metricsSettled]) => {
        if (expSettled.status === 'fulfilled') {
          const res: any = expSettled.value;
          const rows = res?.data ?? [];
          setLiveExpenses(rows.map((r: any, i: number) => mapExpenseRow(r, formatAmount, i)));
          setLiveCategories((res?.categories ?? []).slice(0, 5).map((c: any, i: number) => ({
            id: c.id || `cat${i}`,
            name: c.name || 'Expense',
            amount: formatAmount(Math.round(c.amount_raw || 0)),
          })));
        } else {
          setLiveExpenses([]);
          setLiveCategories([]);
        }

        if (metricsSettled.status === 'fulfilled') {
          const metricsRes: any = metricsSettled.value;
          setHomeMetrics(metricsRes?.data ?? metricsRes ?? null);
        } else {
          setHomeMetrics(null);
        }

        if (expSettled.status === 'rejected' && metricsSettled.status === 'rejected') {
          const err = expSettled.reason;
          setApiError(err?.message || t('expenses.loadFailed'));
        } else if (expSettled.status === 'rejected' || metricsSettled.status === 'rejected') {
          setApiError(t('home.partialUpdate', "Some data couldn't be updated"));
        } else {
          setApiError(null);
        }
      })
      .catch((err: any) => {
        setApiError(err?.message || t('expenses.loadFailed'));
        setLiveExpenses([]);
        setLiveCategories([]);
        setHomeMetrics(null);
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid, fyFrom, fyTo, formatAmount, t]);

  useEffect(() => {
    loadData();
  }, [loadData, lastSyncAt]);

  const metricCards = useMemo(() => buildHomeMetricCards(homeMetrics, [
    { id: 'mtd', label: t('purchase.mtd'), icon: 'calendar-number-outline' },
    { id: 'ytd', label: t('purchase.ytd'), icon: 'ribbon-outline' },
    { id: 'today', label: t('purchase.today'), icon: 'calendar-outline' },
  ], formatAmountCompact), [homeMetrics, formatAmountCompact, t]);

  useEffect(() => {
    if (metricCards.length <= 1) return;
    const t = setInterval(() => {
      setMetricIdx(prev => {
        const next = (prev + 1) % metricCards.length;
        metricRef.current?.scrollToOffset({ offset: next * SW, animated: true });
        return next;
      });
    }, 3000);
    return () => clearInterval(t);
  }, [metricCards.length]);

  const recent = liveExpenses.slice(0, 5);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {apiError && <ErrorBanner message={apiError} onRetry={loadData} />}

      <ScreenHeader title={t('expenses.title')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {isLoading ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <CardSkeleton height={80} />
            {[...Array(4)].map((_, i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : (
          <>
            <View style={s.carouselWrap}>
              <FlatList
                ref={metricRef}
                data={metricCards}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={c => c.id}
                getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
                onScrollToIndexFailed={() => {}}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  setMetricIdx(Math.round(e.nativeEvent.contentOffset.x / SW));
                }}
                renderItem={({ item: c }) => (
                  <KPICarouselPage>
                    <KPICarouselCard
                      icon={c.icon}
                      label={c.label}
                      amount={c.amount}
                      trend_pct={c.trend_pct}
                      trend_positive={c.trend_positive}
                    />
                  </KPICarouselPage>
                )}
              />
              <KPICarouselDots count={metricCards.length} activeIndex={metricIdx} />
            </View>

            <View style={s.tabRow}>
              {(['recent', 'categories'] as const).map(tabKey => (
                <TouchableOpacity
                  key={tabKey}
                  style={[s.tabBtn, tab === tabKey && s.tabActive]}
                  onPress={() => setTab(tabKey)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabTxt, tab === tabKey && s.tabActiveTxt]}>
                    {tabKey === 'recent' ? t('expenses.recent') : t('expenses.categories')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'recent' && (
              <View style={s.listSection}>
                {recent.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="receipt-outline" size={28} color={COLORS.textTertiary} />
                    <Text style={s.emptyTxt}>{t('expenses.noExpenses')}</Text>
                  </View>
                ) : (
                  recent.map((exp, index) => (
                    <ListTileShell
                      key={exp.guid || `expense-${index}`}
                      onPress={() => router.push(`/document/${exp.guid || exp.id}?type=expense` as any)}
                    >
                      <VoucherListTile
                        party={exp.party}
                        voucherNo={exp.voucher || exp.id}
                        date={exp.date}
                        amount={exp.amount}
                        status={exp.status}
                        typeBadge={<ExpenseTypeBadge type={exp.expenseType || 'indirect'} />}
                      />
                    </ListTileShell>
                  ))
                )}
                <ViewAllButton
                  label={t('expenses.viewAll')}
                  onPress={() => router.push('/expenses/register' as any)}
                />
              </View>
            )}

            {tab === 'categories' && (
              <View style={s.listSection}>
                {liveCategories.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Ionicons name="pie-chart-outline" size={28} color={COLORS.textTertiary} />
                    <Text style={s.emptyTxt}>{t('expenses.noExpenses')}</Text>
                  </View>
                ) : (
                  liveCategories.map((cat, index) => (
                    <EntityListTile
                      key={`${cat.id}-${index}`}
                      name={cat.name}
                      amount={cat.amount}
                      onPress={() => openLedgerDetail(router, companyGuid, { name: cat.name, group: cat.name })}
                    />
                  ))
                )}
                <ViewAllButton
                  label={t('expenses.viewAll')}
                  onPress={() => router.push('/ledger' as any)}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },

  carouselWrap: { paddingTop: SPACING.md },

  tabRow: { flexDirection: 'row', marginHorizontal: SPACING.md, marginTop: SPACING.md, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  listSection: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 8 },

  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, paddingVertical: 12, paddingHorizontal: 32, borderWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'center', marginTop: 4, minWidth: 150 },
  viewAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTxt:   { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
