import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ListTileShell } from '../../src/components/ListTileShell';
import { LoadingState, ErrorState, EmptyState } from '../../src/components/ApiStateViews';
import { getPaymentReminderLog } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';

type LogRow = {
  id: string;
  partyName: string;
  billName: string;
  amount: number | null;
  dueDate: string | null;
  channel: 'whatsapp' | 'sms' | 'email' | string;
  status: 'sent' | 'failed' | string;
  error: string | null;
  sentAt: number | null;
};

const CHANNEL: Record<string, { label: string; labelKey?: string; icon: any }> = {
  whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp' },
  sms: { label: 'SMS', icon: 'chatbubble-outline' },
  email: { label: 'Email', labelKey: 'profile.email', icon: 'mail-outline' },
};

export default function SentRemindersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { company } = useAuth();
  const { formatAmount, formatDate } = useSettings();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyGuid = company?.guid;

  const applyPage = (res: any, nextPage: number) => {
    const data: LogRow[] = Array.isArray(res?.data) ? res.data : [];
    setRows(prev => (nextPage === 1 ? data : [...prev, ...data]));
    setTotal(res?.meta?.total ?? data.length);
    setPage(nextPage);
    setError(null);
  };

  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    getPaymentReminderLog(companyGuid, 1)
      .then(res => { if (!cancelled) applyPage(res, 1); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || t('screens.settingsSentReminders.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyGuid]);

  const load = async (nextPage: number, mode: 'retry' | 'more' | 'refresh') => {
    if (!companyGuid) return;
    if (mode === 'more') setLoadingMore(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      applyPage(await getPaymentReminderLog(companyGuid, nextPage), nextPage);
    } catch (e: any) {
      if (nextPage === 1) setError(e?.message || t('screens.settingsSentReminders.loadFailed'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onEndReached = () => {
    if (!loadingMore && rows.length < total) load(page + 1, 'more');
  };

  const renderItem = ({ item }: { item: LogRow }) => {
    const ch = CHANNEL[item.channel] || { label: item.channel, icon: 'notifications-outline' };
    const failed = item.status !== 'sent';
    const when = item.sentAt ? new Date(item.sentAt * 1000) : null;
    return (
      <ListTileShell style={s.tile}>
        <View style={s.row}>
          <Text style={s.party} numberOfLines={1}>{item.partyName}</Text>
          {item.amount != null && <Text style={s.amount}>{formatAmount(item.amount)}</Text>}
        </View>
        <View style={s.row}>
          <Text style={s.meta} numberOfLines={1}>
            {item.billName}{item.dueDate ? t('screens.settingsSentReminders.dueOn', { date: formatDate(item.dueDate) }) : ''}
          </Text>
          <View style={[s.status, failed ? s.statusFailed : s.statusSent]}>
            <Text style={[s.statusTxt, { color: failed ? COLORS.negative : COLORS.positive }]}>
              {failed ? t('screens.settingsSentReminders.failed') : t('screens.settingsSentReminders.sent')}
            </Text>
          </View>
        </View>
        <View style={s.channelRow}>
          <Ionicons name={ch.icon} size={13} color={COLORS.textTertiary} />
          <Text style={s.meta}>
            {ch.labelKey ? t(ch.labelKey) : ch.label}{when ? ` · ${formatDate(when.toISOString().slice(0, 10))} ${when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </Text>
        </View>
        {failed && !!item.error && <Text style={s.error} numberOfLines={2}>{item.error}</Text>}
      </ListTileShell>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('screens.settingsSentReminders.title')} onBack={() => router.back()} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(1, 'retry')} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          contentContainerStyle={rows.length ? s.list : s.emptyList}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, 'refresh')} />}
          ListEmptyComponent={
            <EmptyState
              icon="paper-plane-outline"
              title={t('screens.settingsSentReminders.emptyTitle')}
              subtitle={t('screens.settingsSentReminders.emptySubtitle')}
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.brandPrimary} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  list: { padding: SPACING.md, gap: SPACING.sm },
  emptyList: { flexGrow: 1 },
  tile: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  party: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  meta: { flexShrink: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusSent: { backgroundColor: COLORS.positiveBg },
  statusFailed: { backgroundColor: COLORS.negativeBg },
  statusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  error: { fontSize: TYPOGRAPHY.xs, color: COLORS.negative },
});
