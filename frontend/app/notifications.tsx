import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ErrorBanner } from '../src/components/ApiStateViews';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../src/constants/colors';

import { useAuth } from '../src/context/AuthContext';
import { getNotifications } from '../src/services/api';
import { MOCK_NOTIFICATIONS } from '../src/data/mockData';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  warning: { icon: 'warning-outline',          color: COLORS.warning,  bg: COLORS.warningBg },
  urgent:  { icon: 'notifications-outline',    color: COLORS.negative, bg: COLORS.negativeBg },
  info:    { icon: 'information-circle-outline',color: COLORS.info,    bg: COLORS.infoBg },
  invoice: { icon: 'document-text-outline',    color: COLORS.positive, bg: COLORS.positiveBg },
  gst:     { icon: 'receipt-outline',           color: '#7C3AED',       bg: '#F5F3FF' },
  stock:   { icon: 'cube-outline',              color: COLORS.warning,  bg: COLORS.warningBg },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const [apiError, setApiError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState(
    MOCK_NOTIFICATIONS.map(n => ({ ...n, read: false }))
  );

  useEffect(() => {
    getNotifications(companyGuid).then((res: any) => {
      const data = res?.data ?? res;
      if (Array.isArray(data) && data.length > 0) {
        setNotifications(data.map((n: any) => ({ ...n, read: n.read ?? false })));
      }
    }).catch((err: any) => { console.error('[API Error]', err?.message); setApiError(err?.message || 'Failed to load notifications'); });
  }, [companyGuid]);

  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, read: true })));
  const markRead = (id: string) => setNotifications(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={s.headerMid}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <View style={s.badge}><Text style={s.badgeTxt}>{unreadCount}</Text></View>}
        </View>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={s.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {apiError && <ErrorBanner message={apiError} />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32, paddingTop: SPACING.sm }}>
        {notifications.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTertiary} />
            <Text style={s.emptyTitle}>All caught up!</Text>
            <Text style={s.emptySub}>No notifications right now.</Text>
          </View>
        ) : (
          notifications.map(notif => {
            const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
            return (
              <TouchableOpacity
                key={notif.id}
                style={[s.card, !notif.read && s.unreadCard]}
                onPress={() => markRead(notif.id)}
                activeOpacity={0.75}
              >
                <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                </View>
                <View style={s.content}>
                  <View style={s.titleRow}>
                    <Text style={s.title} numberOfLines={1}>{notif.title}</Text>
                    <Text style={s.time}>{notif.time}</Text>
                  </View>
                  <Text style={s.message} numberOfLines={2}>{notif.message}</Text>
                  {(notif as any).actionLabel && (
                    <TouchableOpacity style={s.actionBtn}>
                      <Text style={s.actionTxt}>{(notif as any).actionLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!notif.read && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          })
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
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.cardBg, marginHorizontal: SPACING.md, marginBottom: 8, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 12, borderWidth: 1, borderColor: COLORS.borderDefault },
  unreadCard: { borderLeftWidth: 3, borderLeftColor: COLORS.brandPrimary, backgroundColor: COLORS.pageBg },
  iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  time: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  message: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 18 },
  actionBtn: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: COLORS.brandPrimary + '18', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md },
  actionTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brandPrimary, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
  emptyTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: TYPOGRAPHY.base, color: COLORS.textSecondary },
});
