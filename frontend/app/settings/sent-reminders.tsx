import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { LockedScreen } from '../../src/components/LockedOverlay';
import {
  View, Text, SectionList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { LoadingState, ErrorState, EmptyState } from '../../src/components/ApiStateViews';
import { getPaymentReminderLog } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useSettings } from '../../src/context/SettingsContext';

/**
 * Reminder History — every reminder the scheduler sent, failed to send, or stopped
 * (a receipt was recorded in the app), grouped by day of `sentAt`.
 */
type LogRow = {
  id: string;
  partyName: string;
  billName: string;
  amount: number | null;
  dueDate: string | null;
  /** 'app' for stopped rows */
  channel: 'whatsapp' | 'sms' | 'email' | 'app' | string;
  status: 'sent' | 'failed' | 'stopped' | string;
  error: string | null;
  sentAt: number | null;
  reminderName?: string | null;
  /** '3 days before due', 'On the due date', '7 days after due', 'Receipt recorded in the app' */
  stage?: string | null;
};

type DaySection = { key: string; title: string; data: LogRow[] };

const CHANNEL: Record<string, { label: string; labelKey?: string; icon: any }> = {
  whatsapp: { label: 'WhatsApp', icon: 'logo-whatsapp' },
  sms: { label: 'SMS', icon: 'chatbubble-outline' },
  email: { label: 'Email', labelKey: 'profile.email', icon: 'mail-outline' },
  app: { label: 'App', labelKey: 'screens.settingsSentReminders.channelApp', icon: 'phone-portrait-outline' },
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local-day key 'yyyy-mm-dd' of a unix-second timestamp. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SentRemindersScreenContent() {
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
    setRows(prev => {
      if (nextPage === 1) return data;
      // A row that moved between pages while loading must not appear twice.
      const seen = new Set(prev.map(r => r.id));
      return [...prev, ...data.filter(r => !seen.has(r.id))];
    });
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

  const hasMore = rows.length < total;

  // Group by local day of sentAt: Today, Yesterday, then 'Weekday, d Mon yyyy'.
  const sections = useMemo<DaySection[]>(() => {
    const now = new Date();
    const todayKey = dayKey(now);
    const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const byDay = new Map<string, DaySection>();
    const sorted = [...rows].sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
    for (const row of sorted) {
      const d = row.sentAt ? new Date(row.sentAt * 1000) : null;
      const key = d ? dayKey(d) : 'unknown';
      let section = byDay.get(key);
      if (!section) {
        const title = !d ? t('screens.settingsSentReminders.undated')
          : key === todayKey ? t('sales.today')
          : key === yesterdayKey ? t('screens.settingsSentReminders.yesterday')
          : `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        section = { key, title, data: [] };
        byDay.set(key, section);
      }
      section.data.push(row);
    }
    return Array.from(byDay.values());
  }, [rows, t]);

  const statusOf = (status: string) => {
    if (status === 'sent') return { label: t('screens.settingsSentReminders.sent'), color: COLORS.positive, bg: COLORS.positiveBg };
    if (status === 'stopped') return { label: t('screens.settingsSentReminders.stopped'), color: COLORS.textSecondary, bg: COLORS.pageBg };
    return { label: t('screens.settingsSentReminders.failed'), color: COLORS.negative, bg: COLORS.negativeBg };
  };

  const renderItem = ({ item }: { item: LogRow }) => {
    const ch = CHANNEL[item.channel] || { label: item.channel, icon: 'notifications-outline' };
    const st = statusOf(item.status);
    const when = item.sentAt ? new Date(item.sentAt * 1000) : null;
    const time = when ? when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
    const stageLine = [item.stage, item.reminderName].filter(Boolean).join(' · ');
    return (
      <View style={s.tile}>
        <View style={s.timeCol}>
          <Text style={s.time}>{time}</Text>
        </View>
        <View style={s.body}>
          <View style={s.row}>
            <Text style={s.party} numberOfLines={1}>{item.partyName}</Text>
            {item.amount != null && <Text style={s.amount}>{formatAmount(item.amount)}</Text>}
          </View>
          {!!(item.billName || item.dueDate) && (
            <Text style={s.meta} numberOfLines={1}>
              {item.billName}{item.dueDate ? t('screens.settingsSentReminders.dueOn', { date: formatDate(item.dueDate) }) : ''}
            </Text>
          )}
          {!!stageLine && <Text style={s.stage} numberOfLines={1}>{stageLine}</Text>}
          <View style={s.row}>
            <View style={s.channelRow}>
              <Ionicons name={ch.icon} size={13} color={COLORS.textTertiary} />
              <Text style={s.meta}>{ch.labelKey ? t(ch.labelKey) : ch.label}</Text>
            </View>
            <View style={[s.status, { backgroundColor: st.bg }]}>
              <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
            </View>
          </View>
          {item.status === 'failed' && !!item.error && <Text style={s.error} numberOfLines={2}>{item.error}</Text>}
        </View>
      </View>
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
        <SectionList
          sections={sections}
          keyExtractor={r => r.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => <Text style={s.sectionHdr}>{section.title}</Text>}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={rows.length ? s.list : s.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, 'refresh')} />}
          ListEmptyComponent={
            <EmptyState
              icon="paper-plane-outline"
              title={t('screens.settingsSentReminders.emptyTitle')}
              subtitle={t('screens.settingsSentReminders.emptySubtitle')}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.brandPrimary} />
            ) : hasMore ? (
              <TouchableOpacity style={s.moreBtn} onPress={() => load(page + 1, 'more')} activeOpacity={0.7}>
                <Text style={s.moreTxt}>{t('screens.settingsSentReminders.loadMore')}</Text>
                <Text style={s.moreCount}>{t('screens.settingsSentReminders.shownOf', { shown: rows.length, total })}</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  list: { paddingHorizontal: SPACING.md, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  sectionHdr: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  tile: {
    flexDirection: 'row', gap: 10,
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  timeCol: { width: 58 },
  time: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textSecondary, marginTop: 2 },
  body: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  party: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  meta: { flexShrink: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  stage: { fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, fontWeight: '500' },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  statusTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  error: { fontSize: TYPOGRAPHY.xs, color: COLORS.negative },
  moreBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg,
  },
  moreTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },
  moreCount: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
});

/** Payment reminders are seen and sent by the Owner or an Admin only (Owner decision, 29 Oct 2026). */
export default function SentRemindersScreen() {
  const { hasCapability } = useWorkspace();
  if (!hasCapability('reminders.manage')) return <LockedScreen titleKey="settings.paymentReminders" />;
  return <SentRemindersScreenContent />;
}
