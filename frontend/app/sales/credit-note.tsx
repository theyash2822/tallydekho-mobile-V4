import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '../../src/components/ApiStateViews';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';
import { useApiData } from '../../src/hooks/useApiData';
import { getCreditNotes } from '../../src/services/api';
import SearchBar from '../../src/components/SearchBar';

type CreditNoteRow = {
  id: string;
  voucherNumber: string;
  party: string;
  date: string;
  amount: number;
  status: 'posted' | 'optional' | 'cancelled' | 'synced';
  reference: string;
};

const statusLabel: Record<CreditNoteRow['status'], string> = {
  posted: 'Posted',
  optional: 'Optional',
  cancelled: 'Cancelled',
  synced: 'Synced',
};

const statusColor: Record<CreditNoteRow['status'], string> = {
  posted: COLORS.positive,
  optional: COLORS.warning,
  cancelled: COLORS.negative,
  synced: COLORS.info,
};

function normalizeRows(raw: any): CreditNoteRow[] {
  const rows = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.creditNotes) ? raw.creditNotes : Array.isArray(raw) ? raw : [];
  return rows.map((row: any) => {
    const isOptional = row.is_optional === true || row.current_entry_type === 'optional' || row.original_entry_type === 'optional';
    const isPosted = row.books_impact_status === 'posted' || row.tally_sync_status === 'synced';
    return {
      id: String(row.guid || row.voucher_guid || row.id || ''),
      voucherNumber: String(row.voucher_number || row.tally_voucher_no || row.tdk_reference_no || 'Pending from TallyPrime'),
      party: String(row.party_name || row.party_ledger || ''),
      date: String(row.date || ''),
      amount: Math.abs(Number(row.party_amount ?? row.amount ?? row.total_amount) || 0),
      status: row.is_cancelled ? 'cancelled' : isOptional ? 'optional' : isPosted ? 'posted' : 'synced',
      reference: String(row.reference || row.tdk_reference_no || ''),
    };
  }).filter((row: CreditNoteRow) => !!row.id);
}

export default function CreditNotesScreen() {
  const router = useRouter();
  const { company, selectedFY } = useAuth();
  const { formatAmount, formatDate } = useSettings();
  const [search, setSearch] = useState('');

  const notesState = useApiData<CreditNoteRow[]>(
    () => getCreditNotes(company!.guid, {
      from: selectedFY?.startDate,
      to: selectedFY?.endDate,
      limit: '500',
    }),
    [company?.guid, selectedFY?.startDate, selectedFY?.endDate],
    {
      enabled: !!company?.guid,
      transform: normalizeRows,
      emptyCheck: rows => rows.length === 0,
    },
  );

  const filtered = useMemo(() => (notesState.data || []).filter(note => {
    const needle = search.trim().toLowerCase();
    return !needle
      || note.party.toLowerCase().includes(needle)
      || note.voucherNumber.toLowerCase().includes(needle)
      || note.reference.toLowerCase().includes(needle);
  }), [notesState.data, search]);

  const total = (notesState.data || []).reduce((sum, note) => sum + note.amount, 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>Credit Notes</Text>
      </View>

      {notesState.loading ? (
        <LoadingState message="Loading credit notes..." />
      ) : notesState.error ? (
        <ErrorState message={notesState.error} onRetry={notesState.reload} />
      ) : notesState.isEmpty ? (
        <EmptyState title="No credit notes" subtitle="No Sales Returns were found in the selected financial year." icon="return-up-back-outline" />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search voucher, party or reference..." />

          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statValue}>{notesState.data?.length || 0}</Text><Text style={s.statLabel}>Documents</Text></View>
            <View style={s.stat}><Text style={s.statValue}>{formatAmount(total)}</Text><Text style={s.statLabel}>Credit value</Text></View>
          </View>

          {filtered.length === 0 ? (
            <View style={s.noResults}><Text style={s.noResultsText}>No matching credit notes.</Text></View>
          ) : (
            <View style={s.card}>
              {filtered.map((note, index) => (
                <View key={note.id}>
                  <TouchableOpacity
                    style={s.row}
                    activeOpacity={0.75}
                    onPress={() => safePush(router, `/document/${encodeURIComponent(note.id)}?type=credit_note` as any)}
                  >
                    <View style={[s.dot, { backgroundColor: statusColor[note.status] }]} />
                    <View style={{ flex: 1 }}>
                      <View style={s.rowTop}>
                        <Text style={[s.status, { color: statusColor[note.status] }]}>{statusLabel[note.status]}</Text>
                        <Text style={s.number}>{note.voucherNumber}</Text>
                      </View>
                      <Text style={s.party}>{note.party || 'Party unavailable'}</Text>
                      <Text style={s.meta}>
                        {formatDate(note.date)}
                        {note.reference ? ` · Ref ${note.reference}` : ''}
                      </Text>
                    </View>
                    <View style={s.amountWrap}>
                      <Text style={s.amount}>{formatAmount(note.amount)}</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                    </View>
                  </TouchableOpacity>
                  {index < filtered.length - 1 && <View style={s.divider} />}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.pageBg },
  title: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  scroll: { padding: SPACING.md, paddingBottom: 32, gap: 12 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  statValue: { fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { marginTop: 3, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: SPACING.md },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontSize: TYPOGRAPHY.xs, fontWeight: '800' },
  number: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  party: { marginTop: 4, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  meta: { marginTop: 3, fontSize: 11, color: COLORS.textTertiary },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  amount: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.textPrimary },
  divider: { height: 1, marginLeft: 35, backgroundColor: COLORS.borderDefault },
  noResults: { padding: 28, alignItems: 'center' },
  noResultsText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
});
