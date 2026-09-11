import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getVouchers } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';
import SearchBar from '../../src/components/SearchBar';

const METHOD_COLORS: Record<string, string> = {
  NEFT: '#2563EB', RTGS: '#7C3AED', Cash: COLORS.positive, Cheque: COLORS.warning,
  Bank: '#0EA5E9', UPI: '#DB2777',
};

function inferMethod(narration?: string): string {
  const n = (narration || '').toUpperCase();
  if (n.includes('NEFT')) return 'NEFT';
  if (n.includes('RTGS')) return 'RTGS';
  if (n.includes('UPI')) return 'UPI';
  if (n.includes('CHEQUE') || n.includes('CHQ')) return 'Cheque';
  if (n.includes('CASH')) return 'Cash';
  if (n.includes('BANK') || n.includes('TDK PAYMENT')) return 'Bank';
  return '—';
}

export default function PaymentVouchersScreen() {
  const { formatAmount, formatDate } = useSettings();
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const companyGuid = company?.guid;
  const [search, setSearch] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveItems, setLiveItems] = useState<any[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!companyGuid) return;
    if (isRefresh) setRefreshing(true); else setIsLoading(true);
    setApiError(null);
    try {
      const res: any = await getVouchers(
        companyGuid,
        'payment',
        selectedFY?.startDate && selectedFY?.endDate
          ? { from: selectedFY.startDate, to: selectedFY.endDate, limit: '100' }
          : { limit: '100' },
      );
      const rows = res?.data ?? [];
      setLiveItems(rows.map((r: any) => {
        const method = inferMethod(r.narration);
        const posted = !!r.voucher_number;
        return {
          id: r.guid || String(r.id),
          voucherNo: r.voucher_number || 'Pending',
          party: r.party_name || '—',
          date: r.date || '',
          amount: Math.abs(+r.amount || 0),
          method,
          status: posted ? 'Posted' : 'Not Posted',
          tdkRef: (r.narration || '').match(/TDK-PAY-\d{4}-\d+/i)?.[0]
            || (r.reference || '').match(/TDK-PAY-\d{4}-\d+/i)?.[0]
            || null,
        };
      }));
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load payments');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [companyGuid, selectedFY?.startDate, selectedFY?.endDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = liveItems.filter((i: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.party || '').toLowerCase().includes(q)
      || (i.voucherNo || '').toLowerCase().includes(q)
      || (i.tdkRef || '').toLowerCase().includes(q);
  });

  const totalAmt = filtered.reduce((s, i) => s + (i.amount || 0), 0);
  const postedCount = filtered.filter(i => i.status === 'Posted').length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Payment Vouchers</Text>
        <TouchableOpacity style={s.hdrAct} onPress={() => safePush(router, '/voucher/create-payment' as any)} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>
      {apiError && <ErrorBanner message={apiError} />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search party, voucher no..." />

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statV}>{formatAmount(Math.round(totalAmt))}</Text>
            <Text style={s.statL}>Total</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statV}>{String(filtered.length)}</Text>
            <Text style={s.statL}>Docs</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statV}>{String(postedCount)}</Text>
            <Text style={s.statL}>Posted</Text>
          </View>
        </View>

        <View style={s.secHdr}>
          <Text style={s.secT}>Payments</Text>
          {selectedFY?.label ? <Text style={s.secSub}>{selectedFY.label}</Text> : null}
        </View>

        {isLoading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.brandPrimary} />
          </View>
        )}

        {!isLoading && filtered.length === 0 && (
          <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
            <Ionicons name="send-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary }}>No payment vouchers</Text>
            <Text style={{ fontSize: 13, color: COLORS.textTertiary, textAlign: 'center' }}>
              Create a payment or sync Tally to see records
            </Text>
            <TouchableOpacity style={s.createBtn} onPress={() => safePush(router, '/voucher/create-payment' as any)}>
              <Text style={s.createBtnTxt}>Create Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && filtered.length > 0 && (
          <View style={s.card}>
            {filtered.map((item, idx) => {
              const methodColor = METHOD_COLORS[item.method] || COLORS.textTertiary;
              const isPosted = item.status === 'Posted';
              return (
                <View key={item.id}>
                  <TouchableOpacity
                    style={s.row}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.tdkRef) {
                        safePush(router, `/voucher/payment-preview?tdkRef=${encodeURIComponent(item.tdkRef)}` as any);
                      } else {
                        safePush(router, `/document/${item.id}?type=payment_voucher` as any);
                      }
                    }}
                  >
                    <View style={s.rowL}>
                      <View style={[s.dot, { backgroundColor: isPosted ? COLORS.positive : COLORS.warning }]} />
                      <View style={s.rInfo}>
                        <View style={s.topR}>
                          <Text style={[s.stLbl, { color: isPosted ? COLORS.positive : COLORS.warning }]}>
                            {item.status}
                          </Text>
                          <Text style={s.docId}>{item.voucherNo}</Text>
                          {item.method !== '—' && (
                            <View style={[s.methodChip, { backgroundColor: methodColor + '18' }]}>
                              <Text style={[s.methodTxt, { color: methodColor }]}>{item.method}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.party} numberOfLines={1}>{item.party}</Text>
                        <Text style={s.meta}>
                          {item.date ? formatDate(item.date) : '—'}
                          {item.tdkRef ? ` · ${item.tdkRef}` : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.amt}>{formatAmount(Math.round(item.amount))}</Text>
                  </TouchableOpacity>
                  {idx < filtered.length - 1 && <View style={s.div} />}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  hdrAct: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.md },
  stat: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderDefault },
  statV: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statL: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  secHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm },
  secT: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  secSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, fontWeight: '600' },
  card: { backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  rowL: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  rInfo: { flex: 1, gap: 3 },
  topR: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  stLbl: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
  docId: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  methodChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  methodTxt: { fontSize: 10, fontWeight: '600' },
  party: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  amt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.negative },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 16 },
  createBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary },
  createBtnTxt: { color: COLORS.white, fontWeight: '700', fontSize: TYPOGRAPHY.sm },
});
