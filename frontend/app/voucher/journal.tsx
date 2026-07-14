import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getVouchers } from '../../src/services/api';
import { useSettings } from '../../src/context/SettingsContext';

export default function JournalVouchersScreen() {
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
        'journal',
        selectedFY?.startDate && selectedFY?.endDate
          ? { from: selectedFY.startDate, to: selectedFY.endDate, limit: '100' }
          : { limit: '100' },
      );
      const rows = res?.data ?? [];
      setLiveItems(rows.map((r: any) => {
        const posted = !!r.voucher_number;
        const tdkRef =
          (r.narration || '').match(/TDK-(?:OPT-)?JOR-\d{4}-\d+/i)?.[0]
          || (r.reference || '').match(/TDK-(?:OPT-)?JOR-\d{4}-\d+/i)?.[0]
          || null;
        const party = r.party_name || '—';
        return {
          id: r.guid || String(r.id),
          voucherNo: r.voucher_number || 'Pending',
          party,
          date: r.date || '',
          amount: Math.abs(+r.amount || 0),
          status: posted ? 'Posted' : 'Not Posted',
          narration: r.narration || '',
          tdkRef,
        };
      }));
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load journals');
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
      || (i.tdkRef || '').toLowerCase().includes(q)
      || (i.narration || '').toLowerCase().includes(q);
  });

  const totalAmt = filtered.reduce((s, i) => s + (i.amount || 0), 0);
  const postedCount = filtered.filter(i => i.status === 'Posted').length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Journal Vouchers</Text>
        <TouchableOpacity style={s.hdrAct} onPress={() => router.push('/voucher/create-journal' as any)} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={COLORS.brandPrimary} />
        </TouchableOpacity>
      </View>
      {apiError && <ErrorBanner message={apiError} />}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={s.search}>
          <Ionicons name="search" size={16} color={COLORS.textTertiary} />
          <TextInput
            style={s.searchIn}
            placeholder="Search ledger, voucher, ref..."
            placeholderTextColor={COLORS.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={s.statsRow}>
          {[
            { l: 'Total', v: formatAmount(Math.round(totalAmt)) },
            { l: 'Docs', v: String(filtered.length) },
            { l: 'Posted', v: String(postedCount) },
          ].map(st => (
            <View key={st.l} style={s.stat}>
              <Text style={s.statV} numberOfLines={1}>{st.v}</Text>
              <Text style={s.statL}>{st.l}</Text>
            </View>
          ))}
        </View>

        <View style={s.secHdr}><Text style={s.secT}>Journal Entries</Text></View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.brandPrimary} />
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="book-outline" size={36} color={COLORS.textTertiary} />
            <Text style={s.emptyTxt}>No journal vouchers yet</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/voucher/create-journal' as any)}>
              <Text style={s.emptyBtnTxt}>Create Journal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.card}>
            {filtered.map((item, idx) => (
              <View key={item.id}>
                <TouchableOpacity
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.tdkRef) {
                      router.push(`/voucher/journal-preview?tdkRef=${encodeURIComponent(item.tdkRef)}` as any);
                    }
                  }}
                >
                  <View style={[s.iconBox, { backgroundColor: COLORS.infoBg }]}>
                    <Ionicons name="book-outline" size={18} color={COLORS.info} />
                  </View>
                  <View style={s.rInfo}>
                    <View style={s.topR}>
                      <Text style={s.docId}>{item.voucherNo}</Text>
                      <View style={[s.chip, item.status === 'Posted' ? s.chipOk : s.chipPend]}>
                        <Text style={[s.chipTxt, item.status === 'Posted' ? s.chipOkTxt : s.chipPendTxt]}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={s.party} numberOfLines={1}>{item.party}</Text>
                    <Text style={s.meta}>
                      {item.date ? formatDate(item.date) : '—'}
                      {item.tdkRef ? ` · ${item.tdkRef}` : ''}
                    </Text>
                  </View>
                  <Text style={s.amt}>{formatAmount(item.amount)}</Text>
                </TouchableOpacity>
                {idx < filtered.length - 1 && <View style={s.div} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  hdrAct: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md, marginTop: SPACING.md, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  searchIn: { flex: 1, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: SPACING.md, marginTop: SPACING.md },
  stat: {
    flex: 1, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  statV: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  statL: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 3 },
  secHdr: { marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: SPACING.sm },
  secT: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  card: {
    backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 14, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rInfo: { flex: 1, gap: 3 },
  topR: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docId: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, fontWeight: '600' },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipOk: { backgroundColor: COLORS.positiveBg },
  chipPend: { backgroundColor: '#FEF3C7' },
  chipTxt: { fontSize: 10, fontWeight: '600' },
  chipOkTxt: { color: COLORS.positive },
  chipPendTxt: { color: '#B45309' },
  party: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  amt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginLeft: 68 },
  empty: { alignItems: 'center', marginTop: 48, gap: 10, paddingHorizontal: 24 },
  emptyTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  emptyBtn: {
    marginTop: 8, backgroundColor: COLORS.brandPrimary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  emptyBtnTxt: { color: COLORS.white, fontWeight: '700' },
});
