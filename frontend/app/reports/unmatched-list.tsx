import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getUnmatchedInvoices } from '../../src/services/api';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { useSettings } from '../../src/context/SettingsContext';

const ERROR_CFG: Record<string, { badgeBg: string; dotColor: string; textColor: string }> = {
  'No GST entry':      { badgeBg: '#FEE2E2', dotColor: '#DC2626', textColor: '#DC2626' },
  'Missing GST type':  { badgeBg: '#FEF3C7', dotColor: '#D97706', textColor: '#D97706' },
  'Unregistered party':{ badgeBg: '#F3E8FF', dotColor: '#7C3AED', textColor: '#7C3AED' },
  'Incomplete GST':    { badgeBg: '#FFF7ED', dotColor: '#EA580C', textColor: '#EA580C' },
};
const DEFAULT_ERR = { badgeBg: '#FEE2E2', dotColor: '#DC2626', textColor: '#DC2626' };

// fmt is defined inside component to use settings-aware formatAmount
const isoToDisplay = (d: string) => {
  if (!d || !d.includes('-')) return d;
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
};

export default function UnmatchedListScreen() {
  const { formatAmount } = useSettings();
  const fmt = (n: number) => formatAmount(Math.round(n));
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const load = () => {
    if (!companyGuid) return;
    setIsLoading(true);
    setApiError(null);
    setPage(1);
    setHasMore(false);
    const fyParams = selectedFY ? { from: selectedFY.startDate, to: selectedFY.endDate } : {};
    getUnmatchedInvoices(companyGuid, { ...fyParams, limit: PAGE_SIZE, page: 1 })
      .then((res: any) => { const rows = res?.data ?? []; setItems(rows); setHasMore(rows.length === PAGE_SIZE); })
      .catch((err: any) => setApiError(err?.message || 'Failed to load'))
      .finally(() => setIsLoading(false));
  };

  const loadMore = () => {
    if (!companyGuid || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    const fyParams = selectedFY ? { from: selectedFY.startDate, to: selectedFY.endDate } : {};
    getUnmatchedInvoices(companyGuid, { ...fyParams, limit: PAGE_SIZE, page: nextPage })
      .then((res: any) => { const rows = res?.data ?? []; setItems(prev => [...prev, ...rows]); setHasMore(rows.length === PAGE_SIZE); setPage(nextPage); })
      .finally(() => setIsLoadingMore(false));
  };

  useEffect(() => { load(); }, [companyGuid, selectedFY?.startDate]);

  const salesCount    = items.filter(i => (i.voucher_type||'').toLowerCase().includes('sales')).length;
  const purchaseCount = items.filter(i => (i.voucher_type||'').toLowerCase().includes('purchase')).length;
  const totalAmt      = items.reduce((s, i) => s + parseFloat(i.amount||0), 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Unmatched Invoices</Text>
        <View style={{ width: 36 }} />
      </View>

      {apiError && <ErrorBanner message={apiError} onRetry={load} />}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.stat}><Text style={s.statVal}>{items.length}</Text><Text style={s.statLbl}>Total</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: COLORS.negative }]}>{salesCount}</Text><Text style={s.statLbl}>Sales</Text></View>
            <View style={s.stat}><Text style={[s.statVal, { color: COLORS.warning }]}>{purchaseCount}</Text><Text style={s.statLbl}>Purchase</Text></View>
            <View style={s.stat}><Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>{fmt(totalAmt)}</Text><Text style={s.statLbl}>Value</Text></View>
          </View>

          {items.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 48, gap: 12 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.positive} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>All invoices matched</Text>
              <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' }}>No GST issues found for this period</Text>
            </View>
          ) : (
            <>
            <View style={s.card}>
              {items.map((item, idx) => {
                const cfg = ERROR_CFG[item.issue] || DEFAULT_ERR;
                return (
                  <View key={item.guid || idx}>
                    <View style={s.row}>
                      <View style={[s.dot, { backgroundColor: cfg.dotColor }]} />
                      <View style={s.info}>
                        <View style={s.topRow}>
                          <View style={[s.badge, { backgroundColor: cfg.badgeBg }]}>
                            <Text style={[s.badgeTxt, { color: cfg.textColor }]}>{item.issue}</Text>
                          </View>
                          <Text style={s.voucherNo}>{item.voucher_number}</Text>
                        </View>
                        <Text style={s.party}>{item.party_name || '—'}</Text>
                        <Text style={s.date}>{isoToDisplay(item.date)} · {item.voucher_type}</Text>
                      </View>
                      <Text style={s.amount}>{fmt(parseFloat(item.amount||0))}</Text>
                    </View>
                    {idx < items.length - 1 && <View style={s.divider} />}
                  </View>
                );
              })}
            </View>
            {hasMore && (
              <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore} disabled={isLoadingMore} activeOpacity={0.8}>
                {isLoadingMore
                  ? <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  : <Text style={s.loadMoreTxt}>Load More</Text>
                }
              </TouchableOpacity>
            )}
            {!hasMore && items.length > 0 && (
              <Text style={s.endTxt}>All {items.length} entries loaded</Text>
            )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.pageBg },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle:{ flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  statsRow:   { flexDirection: 'row', gap: 8, margin: SPACING.md },
  stat:       { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  statVal:    { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statLbl:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  card:       { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: 10 },
  dot:        { width: 9, height: 9, borderRadius: 5, marginTop: 2 },
  info:       { flex: 1, gap: 3 },
  topRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.sm },
  badgeTxt:   { fontSize: 10, fontWeight: '600' },
  voucherNo:  { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  party:      { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  date:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  amount:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  divider:    { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 27 },
  loadMoreBtn:{ margin:16,padding:14,borderRadius:10,backgroundColor:COLORS.cardBg,borderWidth:1,borderColor:COLORS.borderDefault,alignItems:'center',justifyContent:'center' },
  loadMoreTxt:{ fontSize:14,fontWeight:'600',color:COLORS.brandPrimary },
  endTxt:     { textAlign:'center',fontSize:12,color:COLORS.textTertiary,padding:16 },
});
