import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import {
  getWorkspaceApprovals,
  approveHardSyncRequest,
  rejectHardSyncRequest,
  approveWorkspaceRestoreByCode,
  rejectRestoreSession,
} from '../../src/services/api';

export default function ApprovalsScreen() {
  const router = useRouter();
  const { workspaceId, workspace, isOwnerOrAdmin, refreshContext } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [hardSync, setHardSync] = useState<any[]>([]);
  const [restoreRequests, setRestoreRequests] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [restoreCode, setRestoreCode] = useState('');
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !isOwnerOrAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res: any = await getWorkspaceApprovals(workspaceId);
      const d = res?.data ?? res;
      setHardSync(Array.isArray(d?.hardSync) ? d.hardSync : []);
      setRestoreRequests(Array.isArray(d?.restoreRequests) ? d.restoreRequests : []);
      setBackups(Array.isArray(d?.backups) ? d.backups : []);
      if (!selectedBackupId && d?.backups?.[0]?.id) setSelectedBackupId(d.backups[0].id);
    } catch {
      setHardSync([]);
      setRestoreRequests([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isOwnerOrAdmin, selectedBackupId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 8000);
      return () => clearInterval(t);
    }, [load])
  );

  if (!isOwnerOrAdmin) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Approvals</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={s.empty}>Only Owner or Admin can approve Hard Sync and Restore.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Approvals</Text>
        <TouchableOpacity onPress={load} style={s.backBtn}>
          <Ionicons name="refresh" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          <Text style={s.wsLabel}>{workspace?.name || 'Workspace'}</Text>

          <Text style={s.section}>Hard Sync requests</Text>
          {hardSync.length === 0 ? (
            <Text style={s.empty}>No pending Hard Sync requests.</Text>
          ) : hardSync.map((r) => (
            <View key={r.id} style={s.card}>
              <Text style={s.cardTitle}>{r.operation || 'REBUILD'}</Text>
              <Text style={s.cardMeta}>Device: {r.device_id || r.deviceId || '—'}</Text>
              <View style={s.row}>
                <TouchableOpacity
                  style={[s.btn, s.reject]}
                  disabled={!!busy}
                  onPress={async () => {
                    setBusy(r.id);
                    try {
                      await rejectHardSyncRequest(r.id);
                      await load();
                      await refreshContext();
                    } catch (e: any) {
                      Alert.alert('Reject failed', e?.message || 'Try again');
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Text style={s.rejectTxt}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.approve]}
                  disabled={!!busy}
                  onPress={async () => {
                    setBusy(r.id);
                    try {
                      await approveHardSyncRequest(r.id);
                      Alert.alert('Approved', 'Hard Sync request approved.');
                      await load();
                      await refreshContext();
                    } catch (e: any) {
                      const already = e?.code === 'HARD_SYNC_ALREADY_APPROVED' || /already approved/i.test(e?.message || '');
                      Alert.alert(
                        already ? 'Already approved' : 'Approve failed',
                        already ? 'This Hard Sync request has already been approved.' : (e?.message || e?.code || 'Try again')
                      );
                      if (already) await load();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Text style={s.approveTxt}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={s.section}>Restore / Replace Computer</Text>
          {restoreRequests.length === 0 ? (
            <Text style={s.empty}>No pending restore requests. Enter code from new Desktop below when one arrives.</Text>
          ) : (
            restoreRequests.map((r) => (
              <View key={r.id} style={s.card}>
                <Text style={s.cardTitle}>Restore request</Text>
                <Text style={s.cardMeta}>Hint: …{r.request_code_hint || r.codeHint || ''}</Text>
              </View>
            ))
          )}

          <Text style={s.label}>Restore code</Text>
          <TextInput
            style={s.input}
            value={restoreCode}
            onChangeText={setRestoreCode}
            autoCapitalize="characters"
            placeholder="CODE from Desktop"
            placeholderTextColor={COLORS.textTertiary}
          />
          <Text style={s.label}>Backup</Text>
          {backups.map((b) => (
            <TouchableOpacity
              key={b.id}
              style={[s.backupRow, selectedBackupId === b.id && s.backupSelected]}
              onPress={() => setSelectedBackupId(b.id)}
            >
              <Text style={s.cardMeta}>
                {b.completed_at || b.created_at
                  ? new Date(Number(b.completed_at || b.created_at) * 1000).toLocaleString()
                  : b.id}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={s.row}>
            <TouchableOpacity
              style={[s.btn, s.reject, { flex: 1 }]}
              disabled={!restoreRequests[0]?.id || !!busy}
              onPress={async () => {
                const sid = restoreRequests[0]?.id;
                if (!sid) return;
                setBusy(sid);
                try {
                  await rejectRestoreSession(sid);
                  await load();
                } catch (e: any) {
                  Alert.alert('Reject failed', e?.message || 'Try again');
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Text style={s.rejectTxt}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.approve, { flex: 1 }]}
              disabled={!restoreCode || !selectedBackupId || !!busy}
              onPress={async () => {
                setBusy('restore');
                try {
                  await approveWorkspaceRestoreByCode({
                    code: restoreCode.trim().toUpperCase(),
                    backupId: selectedBackupId!,
                  });
                  Alert.alert('Approved', 'Restore session approved. Desktop can continue.');
                  setRestoreCode('');
                  await load();
                  await refreshContext();
                } catch (e: any) {
                  Alert.alert('Approve failed', e?.message || 'Try again');
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Text style={s.approveTxt}>Approve Restore</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  wsLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: 12 },
  section: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 8, marginBottom: 8 },
  empty: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, marginBottom: 12, paddingHorizontal: SPACING.md, marginTop: 20 },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  reject: { backgroundColor: '#FEF2F2' },
  approve: { backgroundColor: COLORS.brandPrimary },
  rejectTxt: { fontWeight: '700', color: '#E53935' },
  approveTxt: { fontWeight: '700', color: '#fff' },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, fontWeight: '700',
    letterSpacing: 2, color: COLORS.textPrimary,
  },
  backupRow: {
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.cardBg, marginBottom: 6,
  },
  backupSelected: { borderColor: COLORS.brandPrimary, backgroundColor: '#F5F3FF' },
});
