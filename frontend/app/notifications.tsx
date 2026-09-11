import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../src/utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';
import { ErrorBanner } from '../src/components/ApiStateViews';
import { LedgerRowSkeleton } from '../src/components/ShimmerPlaceholder';

import { useAuth } from '../src/context/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../src/services/api';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  stock:      { icon: 'cube-outline',    color: COLORS.warning,  bg: COLORS.warningBg },
  receivable: { icon: 'cash-outline',    color: COLORS.negative, bg: COLORS.negativeBg },
  gst:        { icon: 'receipt-outline', color: COLORS.info,     bg: COLORS.infoBg },
  invoice:    { icon: 'document-text-outline', color: COLORS.positive, bg: COLORS.positiveBg },
  warning:    { icon: 'warning-outline', color: COLORS.warning,  bg: COLORS.warningBg },
  info:       { icon: 'information-circle-outline', color: COLORS.info, bg: COLORS.infoBg },
};

const FILTERS = ['All', 'Stock', 'Receivables', 'Compliance', 'Invoices'] as const;
type Filter = typeof FILTERS[number];

interface AppNotification {
  id: string;
  type: string;
  category?: string;
  title: string;
  message?: string;
  body?: string;
  time?: string;
  group?: string;
  route?: string;
  actionLabel?: string;
  read: boolean;
  created_at?: string;
}

function normalizeNotification(n: any): AppNotification {
  const message = n.message || n.body || '';
  const createdAt = n.created_at ? new Date(n.created_at) : new Date();
  const isToday = createdAt.toDateString() === new Date().toDateString();
  return {
    id: n.id,
    type: n.type || 'info',
    category: n.category,
    title: n.title,
    message,
    body: message,
    time: n.time || createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    group: n.group || (isToday ? 'today' : 'earlier'),
    route: n.route,
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
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    setIsLoading(true);
    setApiError(null);
    getNotifications(companyGuid)
      .then((res: any) => {
        const data = res?.data ?? res;
        if (Array.isArray(data)) {
          setNotifications(data.map(normalizeNotification));
        }
      })
      .catch((err: any) => {
        console.error('[API Error]', err?.message);
        setApiError(err?.message || 'Failed to load notifications');
      })
      .finally(() => setIsLoading(false));
  }, [companyGuid]);

  const markRead = useCallback((id: string) => {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
    markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    markAllNotificationsRead(companyGuid).catch(() => {});
  }, [companyGuid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const visible = useMemo(
    () => filter === 'All' ? notifications : notifications.filter(n => n.category === filter),
    [notifications, filter]
  );
  const today = visible.filter(n => n.group === 'today');
  const earlier = visible.filter(n => n.group === 'earlier');

  const handlePress = (n: AppNotification) => {
    markRead(n.id);
    if (n.route) safePush(router, n.route as any);
  };

  const renderCard = (notif: AppNotification) => {
    const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
    return (
      <TouchableOpacity
        key={notif.id}
        testID={`notif-${notif.id}`}
        style={[s.card, !notif.read && s.unreadCard]}
        onPress={() => handlePress(notif)}
        activeOpacity={0.75}
      >
        <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={19} color={cfg.color} />
        </View>
        <View style={s.content}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={1}>{notif.title}</Text>
            <Text style={s.time}>{notif.time}</Text>
          </View>
          <Text style={s.message} numberOfLines={2}>{notif.message}</Text>
          {notif.actionLabel && (
            <View style={s.actionBtn}>
              <Text style={s.actionTxt}>{notif.actionLabel}</Text>
              <Ionicons name="chevron-forward" size={12} color={COLORS.brandPrimary} />
            </View>
          )}
        </View>
        {!notif.read && <View style={s.unreadDot} />}
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
      </View>

      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => {
            const filterLabel = f === 'All' ? t('notifications.all')
              : f === 'Stock' ? t('notifications.filterStock')
              : f === 'Receivables' ? t('notifications.filterReceivables')
              : f === 'Compliance' ? t('notifications.filterCompliance')
              : t('notifications.filterInvoices');
            const active = filter === f;
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
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>{filterLabel}</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, paddingTop: SPACING.sm }}>
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
            {today.length > 0 && (
              <>
                <Text style={s.groupLabel}>Today</Text>
                {today.map(renderCard)}
              </>
            )}
            {earlier.length > 0 && (
              <>
                <Text style={s.groupLabel}>Earlier</Text>
                {earlier.map(renderCard)}
              </>
            )}
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
  time: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  message: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: 6, backgroundColor: COLORS.brandPrimary + '14', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.md },
  actionTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
});
