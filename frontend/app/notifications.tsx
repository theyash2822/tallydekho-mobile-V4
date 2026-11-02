import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { ErrorBanner } from '../src/components/ApiStateViews';
import { LedgerRowSkeleton } from '../src/components/ShimmerPlaceholder';

import { useAuth } from '../src/context/AuthContext';
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

interface AppNotification {
  id: string;
  type: string;
  category?: string;
  title: string;
  message?: string;
  body?: string;
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
  const createdAt = n.created_at ? new Date(n.created_at) : new Date();
  return {
    id: n.id,
    type: n.type || 'info',
    category: n.category,
    title: n.title,
    message,
    body: message,
    time: n.time || createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    group: notificationGroup(n.created_at),
    route: n.route,
    target: n.target || null,
    actionLabel: n.actionLabel,
    read: n.read ?? false,
    created_at: n.created_at,
  };
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

  const [prevCompanyGuid, setPrevCompanyGuid] = useState(companyGuid);
  if (companyGuid !== prevCompanyGuid) {
    setPrevCompanyGuid(companyGuid);
    setIsLoading(true);
    setApiError(null);
  }

  useEffect(() => {
    getNotifications(companyGuid)
      .then((res: any) => {
        const data = res?.data ?? res;
        if (Array.isArray(data)) {
          setNotifications(data.map(normalizeNotification));
        }
      })
      .catch((err: any) => {
        console.error('[API Error]', err?.message);
        setApiError(err?.message || i18n.t('screens.notifications.loadFailed'));
      })
      .finally(() => { setIsLoading(false); setRefreshing(false); });
  }, [companyGuid, reloadKey]);

  const onRefresh = () => { setRefreshing(true); setReloadKey(k => k + 1); };

  const markRead = useCallback((id: string) => {
    // Optimistic: flip to read now; put it back to unread only if the server refused.
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationRead(id).catch(() => {
      setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: false } : n));
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    markAllNotificationsRead(companyGuid).catch(() => {});
  }, [companyGuid]);

  const unreadCount = notifications.filter(n => !n.read).length;

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

  const renderCard = (notif: AppNotification) => {
    const cfg = SEVERITY_COLORS[notificationSeverity(notif)];
    const icon = CATEGORY_ICON[notif.category || ''] || 'notifications-outline';
    const hasLink = !!notificationRoute(notif);
    return (
      <TouchableOpacity
        key={notif.id}
        testID={`notif-${notif.id}`}
        style={[s.card, !notif.read && s.unreadCard]}
        onPress={() => handlePress(notif)}
        activeOpacity={0.75}
      >
        <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={icon} size={19} color={cfg.color} />
        </View>
        <View style={s.content}>
          <View style={s.titleRow}>
            <Text style={[s.title, notif.read && s.titleRead]} numberOfLines={1}>{notif.title}</Text>
            <Text style={s.time}>{notif.time}</Text>
          </View>
          <Text style={s.message} numberOfLines={2}>{notif.message}</Text>
          {hasLink && (
            <View style={s.actionBtn}>
              <Text style={s.actionTxt}>{notif.actionLabel || t('common.open', { defaultValue: 'Open' })}</Text>
              <Ionicons name="chevron-forward" size={12} color={COLORS.brandPrimary} />
            </View>
          )}
        </View>
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>{t('notifications.title')}</Text>
          {unreadCount > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{unreadCount}</Text></View>}
        </View>
        <TouchableOpacity onPress={markAllRead} disabled={unreadCount === 0}>
          <Text style={[s.markAll, unreadCount === 0 && { color: COLORS.textTertiary }]}>{t('notifications.markAllRead')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="notif-settings"
          onPress={() => safePush(router, '/settings/notification-channels' as any)}
          style={s.settingsBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={t('notifications.settings', { defaultValue: 'Notification settings' })}
        >
          <Ionicons name="settings-outline" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {filters.map(f => {
            const active = activeFilter === f;
            const count = f === 'All'
              ? notifications.filter(n => !n.read).length
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
                    <Text style={[s.chipCountTxt, active && { color: COLORS.brandPrimary }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {apiError && <ErrorBanner message={apiError} />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, paddingTop: SPACING.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brandPrimary} />}
      >
        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            {[...Array(5)].map((_, i) => <LedgerRowSkeleton key={i} />)}
          </View>
        ) : visible.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTertiary} />
            <Text style={s.emptyTitle}>{t('notifications.allCaughtUp')}</Text>
            <Text style={s.emptySub}>{t('notifications.emptySub')}</Text>
          </View>
        ) : (
          <>
            {GROUPS.map(g => {
              const list = visible.filter(n => n.group === g);
              if (!list.length) return null;
              return (
                <React.Fragment key={g}>
                  <Text style={s.groupLabel}>{groupLabel(g)}</Text>
                  {list.map(renderCard)}
                </React.Fragment>
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
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  headerMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  headerTitle: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  badge: { backgroundColor: '#E53935', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  markAll: { fontSize: TYPOGRAPHY.sm, color: COLORS.brandPrimary, fontWeight: '600' },
  settingsBtn: { marginLeft: 14 },
  filterWrap: { backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  filterRow: { paddingHorizontal: SPACING.md, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.borderDefault, backgroundColor: COLORS.pageBg,
  },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white },
  chipCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.borderDefault },
  chipCountActive: { backgroundColor: COLORS.white },
  chipCountTxt: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary },
  groupLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: SPACING.md, marginTop: 12, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginBottom: 8, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 12, borderWidth: 1, borderColor: COLORS.borderDefault },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary },
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  titleRead: { fontWeight: '500', color: COLORS.textSecondary },
  time: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  message: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: 6, backgroundColor: COLORS.brandPrimary + '14', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.md },
  actionTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
});
