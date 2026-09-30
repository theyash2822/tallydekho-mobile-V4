import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      const timer = setInterval(load, 8000);
      return () => clearInterval(timer);
    }, [load])
  );

  if (!isOwnerOrAdmin) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('screens.settingsApprovals.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={s.empty}>{t('screens.settingsApprovals.ownerOnly')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('screens.settingsApprovals.title')}</Text>
        <TouchableOpacity onPress={load} style={s.backBtn}>
          <Ionicons name="refresh" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          <Text style={s.wsLabel}>{workspace?.name || t('screens.settingsApprovals.workspace')}</Text>

          <Text style={s.section}>{t('screens.settingsApprovals.hardSyncRequests')}</Text>
          {hardSync.length === 0 ? (
            <Text style={s.empty}>{t('screens.settingsApprovals.noHardSync')}</Text>
          ) : hardSync.map((r) => (
            <View key={r.id} style={s.card}>
              <Text style={s.cardTitle}>{r.operation || 'REBUILD'}</Text>
              <Text style={s.cardMeta}>{t('screens.settingsApprovals.device', { id: r.device_id || r.deviceId || '—' })}</Text>
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
                      Alert.alert(t('screens.settingsApprovals.rejectFailed'), e?.message || t('screens.settingsApprovals.tryAgain'));
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Text style={s.rejectTxt}>{t('screens.settingsApprovals.reject')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.approve]}
                  disabled={!!busy}
                  onPress={async () => {
                    setBusy(r.id);
                    try {
                      await approveHardSyncRequest(r.id);
                      Alert.alert(t('screens.settingsApprovals.approved'), t('screens.settingsApprovals.hardSyncApproved'));
                      await load();
                      await refreshContext();
                    } catch (e: any) {
                      const already = e?.code === 'HARD_SYNC_ALREADY_APPROVED' || /already approved/i.test(e?.message || '');
                      Alert.alert(
                        already ? t('screens.settingsApprovals.alreadyApproved') : t('screens.settingsApprovals.approveFailed'),
                        already ? t('screens.settingsApprovals.alreadyApprovedMsg') : (e?.message || e?.code || t('screens.settingsApprovals.tryAgain'))
                      );
                      if (already) await load();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  <Text style={s.approveTxt}>{t('screens.settingsApprovals.approve')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={s.section}>{t('screens.settingsApprovals.restoreSection')}</Text>
          {restoreRequests.length === 0 ? (
            <Text style={s.empty}>{t('screens.settingsApprovals.noRestore')}</Text>
          ) : (
            restoreRequests.map((r) => (
              <View key={r.id} style={s.card}>
                <Text style={s.cardTitle}>{t('screens.settingsApprovals.restoreRequest')}</Text>
                <Text style={s.cardMeta}>{t('screens.settingsApprovals.hint', { hint: r.request_code_hint || r.codeHint || '' })}</Text>
              </View>
            ))
          )}

          <Text style={s.label}>{t('screens.settingsApprovals.restoreCode')}</Text>
          <TextInput
            style={s.input}
            value={restoreCode}
            onChangeText={setRestoreCode}
            autoCapitalize="characters"
            placeholder={t('screens.settingsApprovals.codePlaceholder')}
            placeholderTextColor={COLORS.textTertiary}
          />
          <Text style={s.label}>{t('screens.settingsApprovals.backup')}</Text>
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
                  Alert.alert(t('screens.settingsApprovals.rejectFailed'), e?.message || t('screens.settingsApprovals.tryAgain'));
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Text style={s.rejectTxt}>{t('screens.settingsApprovals.reject')}</Text>
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
                  Alert.alert(t('screens.settingsApprovals.approved'), t('screens.settingsApprovals.restoreApproved'));
                  setRestoreCode('');
                  await load();
                  await refreshContext();
                } catch (e: any) {
                  Alert.alert(t('screens.settingsApprovals.approveFailed'), e?.message || t('screens.settingsApprovals.tryAgain'));
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Text style={s.approveTxt}>{t('screens.settingsApprovals.approveRestore')}</Text>
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
