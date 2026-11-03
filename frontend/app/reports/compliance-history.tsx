/**
 * Compliance history — every e-invoice / e-way bill event for a voucher
 * (GET /compliance/history?voucherGuid=), newest first with the actor.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { getComplianceHistory } from '../../src/services/api';
import { eventDate } from '../../src/components/compliance/complianceShared';

const ACTION_LABEL: Record<string, string> = {
  generate: 'Generated', generate_auto: 'Generated automatically', cancel: 'Cancelled', refresh: 'Status refreshed', verify: 'Signed data verified',
  download_pdf: 'PDF downloaded', download_json: 'Signed JSON downloaded', share: 'Shared', print: 'Printed',
  ewb_part_b: 'Part B updated', ewb_transporter: 'Transporter updated', ewb_extend: 'Validity extended', ewb_consolidated: 'Consolidated',
  ewb_reject_incoming: 'Incoming bill rejected', ewb_accept_incoming: 'Incoming bill accepted', gap_fix: 'Gap fixed',
  credentials_saved: 'Credentials saved', credentials_removed: 'Credentials removed', activated: 'Activated',
};

export default function ComplianceHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid || '';
  const { voucherGuid: guidParam } = useLocalSearchParams<{ voucherGuid: string }>();
  const voucherGuid = String(guidParam || '');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadKey = `${companyGuid}|${voucherGuid}|${reloadKey}`;
  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    if (companyGuid && voucherGuid) setLoading(true);
  }

  const load = useCallback(() => {
    if (!companyGuid || !voucherGuid) return () => {};
    let cancelled = false;
    getComplianceHistory(companyGuid, voucherGuid)
      .then((res: any) => { if (!cancelled) { setEvents(Array.isArray(res?.data) ? res.data : []); setError(null); } })
      .catch((e: any) => { if (!cancelled) setError(e?.message || t('screens.reportsEinvoiceList.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyGuid, voucherGuid, t]);
  useEffect(() => load(), [load, reloadKey]);

  const label = (action: string) => t(`screens.reportsEinvoiceList.event_${action}`, { defaultValue: ACTION_LABEL[action] || action.replace(/_/g, ' ') });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('screens.reportsEinvoiceList.historyTitle', { defaultValue: 'History' })}</Text>
        <View style={{ width: 44 }} />
      </View>
      {loading && events.length === 0 ? <LoadingState message={t('common.loading')} />
        : error ? <ErrorState title={t('screens.reportsEinvoiceList.loadFailed')} message={error} onRetry={() => setReloadKey((k) => k + 1)} />
          : events.length === 0 ? <EmptyState title={t('screens.reportsEinvoiceList.noHistory', { defaultValue: 'No events yet.' })} />
            : (
              <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setReloadKey((k) => k + 1)} />}>
                {events.map((ev, i) => {
                  const failed = ev.result === 'failed';
                  const when = eventDate(ev.created_at)?.toLocaleString() || '';
                  const detail = ev.detail && typeof ev.detail === 'object' ? (ev.detail.message || ev.detail.error || ev.detail.status || '') : '';
                  return (
                    <View key={String(ev.id || i)} style={s.row}>
                      <View style={[s.dot, { backgroundColor: failed ? COLORS.negative : COLORS.positive }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.action}>{label(String(ev.action || ''))}{ev.domain ? ` · ${ev.domain === 'ewaybill' ? 'EWB' : 'IRN'}` : ''}</Text>
                        <Text style={s.meta}>{[ev.actor_name || ev.actor || t('screens.reportsEinvoiceList.system', { defaultValue: 'System' }), when].filter(Boolean).join(' · ')}</Text>
                        {!!detail && <Text style={[s.detail, failed && { color: COLORS.negative }]}>{String(detail)}</Text>}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  content: { padding: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.sm, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  action: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  detail: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 4, lineHeight: 16 },
});
