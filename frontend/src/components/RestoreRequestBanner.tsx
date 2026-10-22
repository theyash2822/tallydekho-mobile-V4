import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { safePush } from '../utils/safeNavigation';
import { COLORS, RADIUS, SPACING } from '../constants/colors';
import { useWorkspace } from '../context/WorkspaceContext';
import { getWorkspaceApprovals } from '../services/api';

const REFRESH_MS = 30_000;

/**
 * Home, Workspace Owner only: a PC verified with the Owner's code and waits for restore approval.
 * The backup and companies are chosen in Settings → Approvals. Polled as well as event-driven,
 * because a request made while the app was closed or offline sends no event to replay.
 */
export const RestoreRequestBanner: React.FC = () => {
  const router = useRouter();
  const { workspaceId, isOwner, restoreSignal } = useWorkspace();
  const [loaded, setLoaded] = useState<{ workspaceId: string | null; rows: any[] }>({ workspaceId: null, rows: [] });

  const load = useCallback(async () => {
    if (!workspaceId || !isOwner) return;
    try {
      const res: any = await getWorkspaceApprovals(workspaceId);
      const d = res?.data ?? res;
      setLoaded({
        workspaceId,
        rows: d?.canApproveRestore && Array.isArray(d?.restoreRequests) ? d.restoreRequests : [],
      });
    } catch {
      // The next focus, event or refresh tries again.
    }
  }, [workspaceId, isOwner]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, REFRESH_MS);
      return () => clearInterval(timer);
    }, [load])
  );
  useEffect(() => {
    if (restoreSignal) load();
  }, [restoreSignal, load]);

  // A reply for the workspace the user just left is never shown on the new one.
  const rows = isOwner && loaded.workspaceId === workspaceId ? loaded.rows : [];
  if (!rows.length) return null;
  const first = rows[0];

  return (
    <TouchableOpacity
      style={s.banner}
      onPress={() => safePush(router, '/settings/approvals' as any)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Restore request waiting. Tap to review"
    >
      <View style={s.dot} />
      <View style={s.body}>
        <Text style={s.title}>
          {rows.length === 1 ? 'Restore request waiting' : `${rows.length} restore requests waiting`}
        </Text>
        <Text style={s.sub} numberOfLines={2}>
          {first.device_name || 'Desktop'} · verified with {first.requester_contact || '—'} · tap to review
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={COLORS.warning} />
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: 6,
    marginBottom: 2,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.28)',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  body: { flex: 1 },
  title: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
  },
  sub: {
    color: '#92400E',
    fontSize: 12,
    marginTop: 2,
  },
});

export default RestoreRequestBanner;
