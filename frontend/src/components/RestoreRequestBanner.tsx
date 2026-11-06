import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { safePush } from '../utils/safeNavigation';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/colors';
import { useWorkspace } from '../context/WorkspaceContext';
import { HOME_POLL_MS, requestsHref, usePendingRequests } from '../hooks/usePendingRequests';

const K = 'screens.componentsRestoreRequestBanner.';

function BannerRow({ title, detail, onPress, testID }: {
  title: string; detail: string; onPress: () => void; testID: string;
}) {
  return (
    <TouchableOpacity
      style={s.banner}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      testID={testID}
    >
      <View style={s.dot} />
      <View style={s.body}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub} numberOfLines={2}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={COLORS.warning} />
    </TouchableOpacity>
  );
}

/**
 * Home: what waits in Settings → Requests for this workspace. Restore requests (a PC verified with the Owner's
 * code) for the Workspace Owner; Desktop's Hard Sync requests for the Owner and Admins. Polled (shared with the
 * bell) as well as event-driven, because a request made while the app was closed or offline sends no event.
 */
export const RestoreRequestBanner: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { isOwner } = useWorkspace();
  const { hardSync, restores: approvable } = usePendingRequests({ pollMs: HOME_POLL_MS });
  const restores = isOwner ? approvable : [];
  if (!restores.length && !hardSync.length) return null;

  const open = () => safePush(router, requestsHref('approvals'));
  const first = restores[0];

  return (
    <>
      {first ? (
        <BannerRow
          testID="restore-request-banner"
          title={restores.length === 1
            ? t(`${K}restoreWaiting`, 'Restore request waiting')
            : t(`${K}restoreWaitingMany`, { count: restores.length, defaultValue: '{{count}} restore requests waiting' })}
          detail={t(`${K}restoreDetail`, {
            device: first.device_name || t(`${K}desktop`, 'Desktop'),
            contact: first.requester_contact || '—',
            defaultValue: '{{device}} · verified with {{contact}} · tap to review',
          })}
          onPress={open}
        />
      ) : null}
      {hardSync.length > 0 ? (
        <BannerRow
          testID="hard-sync-request-banner"
          title={hardSync.length === 1
            ? t(`${K}hardSyncWaiting`, 'Hard Sync approval needed')
            : t(`${K}hardSyncWaitingMany`, { count: hardSync.length, defaultValue: '{{count}} Hard Sync approvals needed' })}
          detail={t(`${K}hardSyncDetail`, 'Desktop is waiting to rebuild the synced data · tap to review')}
          onPress={open}
        />
      ) : null}
    </>
  );
};

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: 6,
    marginBottom: 2,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: COLORS.warning + '47',
    gap: SPACING.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  body: { flex: 1 },
  title: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
  },
  sub: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.xs,
    marginTop: 2,
  },
});

export default RestoreRequestBanner;
