import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { safePush } from '../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { ScreenHeader } from '../src/components/ScreenHeader';
import { EmptyState, ErrorBanner, ErrorState } from '../src/components/ApiStateViews';
import ShimmerPlaceholder from '../src/components/ShimmerPlaceholder';
import { HeaderActions, HeaderIconButton } from '../src/components/settings/SettingsKit';

import { useAuth } from '../src/context/AuthContext';
import { requestsHref, usePendingRequests } from '../src/hooks/usePendingRequests';
import { useTranslation } from 'react-i18next';
import i18n from '../src/i18n';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../src/services/api';
import {
  notificationRoute, notificationGroup, notificationSeverity, type NotificationGroup,
} from '../src/utils/notificationLinks';

/** Icon per category; colour follows severity so critical alerts stand out the same way as on the web. */
const CATEGORY_ICON: Record<string, any> = {
  Stock: 'cube-outline',
  Receivables: 'cash-outline',
  Compliance: 'receipt-outline',
  Invoices: 'document-text-outline',
  Payments: 'arrow-down-outline',
  System: 'sync-outline',
};
const SEVERITY_COLORS = {
  critical: { color: COLORS.negative, bg: COLORS.negativeBg },
  attention: { color: COLORS.warning, bg: COLORS.warningBg },
  info: { color: COLORS.textSecondary, bg: COLORS.pageBg },
};
const CATEGORIES = ['Stock', 'Receivables', 'Compliance', 'Invoices', 'Payments', 'System'] as const;
const GROUPS: NotificationGroup[] = ['Today', 'Yesterday', 'Earlier'];
const SKELETON_ROWS = [0, 1, 2, 3];

interface AppNotification {
  id: string;
  type: string;
  category?: string;
  title: string;
  message?: string;
  body?: string;
  /** Time of day; the date for 'Earlier' alerts. */
  time?: string;
  group: NotificationGroup;
  route?: string;
  target?: { kind?: string; guid?: string | null; name?: string; page?: string; filter?: string } | null;
  actionLabel?: string;
  read: boolean;
  created_at?: string;
}

function normalizeNotification(n: any): AppNotification {
  const message = n.message || n.body || '';
  const group = notificationGroup(n.created_at);
  const createdAt = n.created_at ? new Date(n.created_at) : null;
  const dated = !!createdAt && !Number.isNaN(createdAt.getTime());
  let time: string = n.time || (dated ? createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
  if (group === 'Earlier' && dated) {
    const sameYear = createdAt.getFullYear() === new Date().getFullYear();
    time = createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
  }
  return {
    id: n.id,
    type: n.type || 'info',
    category: n.category,
    title: n.title,
    message,
    body: message,
    time,
    group,
    route: n.route,
    target: n.target || null,
    actionLabel: n.actionLabel,
    read: n.read ?? false,
    created_at: n.created_at,
  };
}

/** One day card in the shape of the loaded list. */
function NotificationsSkeleton() {
  return (
    <View testID="notifications-skeleton">
      <ShimmerPlaceholder width={72} height={10} borderRadius={RADIUS.sm} style={s.skelLabel} />
      <View style={s.card}>
        {SKELETON_ROWS.map((i) => (
          <View key={i}>
            <View style={s.row}>
              <ShimmerPlaceholder width={36} height={36} borderRadius={RADIUS.md} />
              <View style={s.body}>
                <ShimmerPlaceholder width="55%" height={13} borderRadius={RADIUS.sm} />
                <ShimmerPlaceholder width="90%" height={11} borderRadius={RADIUS.sm} style={s.skelLine} />
              </View>
            </View>
            {i < SKELETON_ROWS.length - 1 ? <View style={s.sep} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { counts: pending, firstTab: pendingTab } = usePendingRequests();

  const [prevCompanyGuid, setPrevCompanyGuid] = useState(companyGuid);
  if (companyGuid !== prevCompanyGuid) {
    setPrevCompanyGuid(companyGuid);
    setIsLoading(true);
    setApiError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getNotifications(companyGuid)
      .then((res: any) => {
        if (cancelled) return;
        const data = res?.data ?? res;
        setNotifications(Array.isArray(data) ? data.map(normalizeNotification) : []);
        setApiError(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error('[API Error]', err?.message);
        setApiError(err?.message || i18n.t('screens.notifications.loadFailed'));
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
        setRefreshing(false);
      });
    return () => { cancelled = true; };
  }, [companyGuid, reloadKey]);

  const onRefresh = () => { setRefreshing(true); setReloadKey(k => k + 1); };
  const retry = () => { setIsLoading(true); setApiError(null); setReloadKey(k => k + 1); };

  const markRead = useCallback((id: string) => {
    // Optimistic: flip to read now; put it back to unread only if the server refused.
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationRead(id).catch(() => {
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: false } : n));
    });
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const wereUnread = new Set(notifications.filter(n => !n.read).map(n => n.id));
    if (!wereUnread.size) return;
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    markAllNotificationsRead(companyGuid).catch(() => {
      setNotifications(ns => ns.map(n => (wereUnread.has(n.id) ? { ...n, read: false } : n)));
      Toast.show({
        type: 'error',
        text1: t('screens.notifications.markAllFailed', 'Could not mark all as read'),
        text2: t('common.tryAgain'),
      });
    });
  };

  // Only categories that have alerts get a chip, as on the web.
  const filters = useMemo(
    () => ['All', ...CATEGORIES.filter(c => notifications.some(n => n.category === c))],
    [notifications]
  );
  const activeFilter = filters.includes(filter) ? filter : 'All';
  const visible = useMemo(
    () => activeFilter === 'All' ? notifications : notifications.filter(n => n.category === activeFilter),
    [notifications, activeFilter]
  );

  const handlePress = (n: AppNotification) => {
    markRead(n.id);
    const route = notificationRoute(n);
    if (route) safePush(router, route as any);
  };

  const filterLabel = (f: string) => f === 'All' ? t('notifications.all')
    : f === 'Stock' ? t('notifications.filterStock')
    : f === 'Receivables' ? t('notifications.filterReceivables')
    : f === 'Compliance' ? t('notifications.filterCompliance')
    : f === 'Invoices' ? t('notifications.filterInvoices')
    : t(`notifications.filter${f}`, { defaultValue: f });

  const groupLabel = (g: NotificationGroup) => g === 'Today' ? t('sales.today')
    : g === 'Yesterday' ? t('screens.notifications.yesterday', { defaultValue: 'Yesterday' })
    : t('screens.notifications.earlier');

  const renderRow = (notif: AppNotification) => {
    const cfg = SEVERITY_COLORS[notificationSeverity(notif)];
    const icon = CATEGORY_ICON[notif.category || ''] || 'notifications-outline';
    const hasLink = !!notificationRoute(notif);
    return (
      <TouchableOpacity
        testID={`notif-${notif.id}`}
        style={s.row}
        onPress={() => handlePress(notif)}
        activeOpacity={0.7}
      >
        <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={icon} size={18} color={cfg.color} />
        </View>
        <View style={s.body}>
          <View style={s.titleRow}>
            <Text style={[s.title, notif.read && s.titleRead]} numberOfLines={1}>{notif.title}</Text>
            {!notif.read && (
              <TouchableOpacity
                testID={`notif-read-${notif.id}`}
                onPress={() => markRead(notif.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={t('notifications.markRead', { defaultValue: 'Mark read' })}
              >
                <View style={s.unreadDot} />
              </TouchableOpacity>
            )}
            {!!notif.time && <Text style={s.time}>{notif.time}</Text>}
          </View>
          {!!notif.message && <Text style={s.message} numberOfLines={2}>{notif.message}</Text>}
        </View>
        {hasLink ? <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} style={s.chevron} /> : null}
      </TouchableOpacity>
    );
  };

  const showError = !isLoading && !!apiError && notifications.length === 0;
  const showEmpty = !isLoading && !showError && visible.length === 0;

  // Pinned above the alerts: requests that wait for this user, e.g. "1 Hard Sync approval · 1 workspace invitation".
  const pendingSummary = [
    pending.hardSync ? t('screens.notifications.pendingHardSync', { count: pending.hardSync }) : '',
    pending.restores ? t('screens.notifications.pendingRestore', { count: pending.restores }) : '',
    pending.invitations ? t('screens.notifications.pendingInvitation', { count: pending.invitations }) : '',
  ].filter(Boolean).join(' · ');
  const needsAction = pending.total > 0 ? (
    <TouchableOpacity
      testID="notif-needs-action"
      style={s.actionCard}
      onPress={() => safePush(router, requestsHref(pendingTab))}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${t('screens.notifications.needsAction')}. ${pendingSummary}`}
    >
      <View style={s.actionIcon}>
        <Ionicons name="hand-left-outline" size={18} color={COLORS.warning} />
      </View>
      <View style={s.body}>
        <Text style={s.actionTitle}>{t('screens.notifications.needsAction')}</Text>
        <Text style={s.message} numberOfLines={2}>{pendingSummary}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.warning} style={s.chevron} />
    </TouchableOpacity>
  ) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader
        title={t('notifications.title')}
        onBack={() => router.back()}
        right={(
          <HeaderActions>
            <HeaderIconButton
              icon="checkmark-done-outline"
              label={t('notifications.markAllRead')}
              onPress={markAllRead}
              disabled={unreadCount === 0}
              testID="notif-mark-all"
            />
            <HeaderIconButton
              icon="settings-outline"
              label={t('notifications.settings', { defaultValue: 'Notification settings' })}
              onPress={() => safePush(router, '/settings/notification-channels' as any)}
              testID="notif-settings"
            />
          </HeaderActions>
        )}
      />

      {filters.length > 1 && (
        <View style={s.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {filters.map(f => {
              const active = activeFilter === f;
              const count = f === 'All'
                ? unreadCount
                : notifications.filter(n => n.category === f && !n.read).length;
              return (
                <TouchableOpacity
                  key={f}
                  testID={`filter-${f}`}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => setFilter(f)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>{filterLabel(f)}</Text>
                  {count > 0 && (
                    <View style={[s.chipCount, active && s.chipCountActive]}>
                      <Text style={[s.chipCountTxt, active && s.chipCountTxtActive]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!isLoading && !showError && apiError ? (
        <View style={s.bannerWrap}>
          <ErrorBanner message={apiError} onRetry={onRefresh} />
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, (showError || showEmpty) && s.contentFill]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {needsAction}
        {isLoading ? (
          <NotificationsSkeleton />
        ) : showError ? (
          <ErrorState title={t('screens.notifications.loadFailed')} message={apiError ?? undefined} onRetry={retry} />
        ) : showEmpty ? (
          <EmptyState
            icon="notifications-off-outline"
            title={needsAction ? t('notifications.empty') : t('notifications.allCaughtUp')}
            subtitle={t('notifications.emptySub')}
          />
        ) : (
          <>
            {GROUPS.map(g => {
              const list = visible.filter(n => n.group === g);
              if (!list.length) return null;
              return (
                <View key={g}>
                  <Text style={s.groupLabel}>{groupLabel(g)}</Text>
                  <View style={s.card}>
                    {list.map((n, i) => (
                      <React.Fragment key={n.id}>
                        {renderRow(n)}
                        {i < list.length - 1 ? <View style={s.sep} /> : null}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  filterWrap: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterRow: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white },
  chipCount: {
    minWidth: 20, height: 20, borderRadius: RADIUS.full, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.borderDefault,
  },
  chipCountActive: { backgroundColor: COLORS.white },
  chipCountTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textSecondary },
  chipCountTxtActive: { color: COLORS.brandPrimary },
  bannerWrap: { paddingTop: SPACING.sm },
  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },
  contentFill: { flexGrow: 1 },
  groupLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderDefault, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: SPACING.md, paddingVertical: 13 },
  // Inset past the icon box, as in Recent Activity.
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderStrong, marginLeft: SPACING.md + 36 + 12 },
  iconBox: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  titleRead: { fontWeight: '500' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary },
  time: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  message: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 18 },
  chevron: { alignSelf: 'center' },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.md, paddingVertical: 13, marginTop: SPACING.sm, marginBottom: SPACING.sm,
    backgroundColor: COLORS.warningBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.warning + '47',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.cardBg,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  skelLabel: { marginTop: SPACING.sm, marginBottom: SPACING.sm },
  skelLine: { marginTop: SPACING.sm },
});
