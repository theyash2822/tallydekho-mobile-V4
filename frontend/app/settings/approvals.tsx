import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
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
  approveRestoreRequest,
  rejectRestoreSession,
} from '../../src/services/api';

type ApprovalsData = {
  workspaceId: string | null;
  hardSync: any[];
  restoreRequests: any[];
  backups: any[];
  canApproveRestore: boolean;
  activeDesktop: { name: string } | null;
};
const NO_APPROVALS: ApprovalsData = {
  workspaceId: null, hardSync: [], restoreRequests: [], backups: [], canApproveRestore: false, activeDesktop: null,
};

export default function ApprovalsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaceId, workspace, isOwnerOrAdmin: ownerOrAdmin, hasCapability, refreshContext } = useWorkspace();
  // Hard Sync approval is the tally.restore_replace permission (Owner, and Admins by default).
  const isOwnerOrAdmin = ownerOrAdmin || hasCapability('tally.restore_replace');
  const [data, setData] = useState<ApprovalsData>(NO_APPROVALS);
  const [picks, setPicks] = useState<Record<string, RestorePick>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggleOpen = (id: string) => setOpen((cur) => ({ ...cur, [id]: !cur[id] }));
  const activeWorkspaceRef = useRef(workspaceId);
  useLayoutEffect(() => {
    activeWorkspaceRef.current = workspaceId;
  });

  const foldersFor = (backup: any): string[] => {
    let manifest = backup?.company_manifest_json;
    if (typeof manifest === 'string') {
      try { manifest = JSON.parse(manifest); } catch { manifest = []; }
    }
    if (!Array.isArray(manifest)) return [];
    return manifest
      .map((c) => String(c?.folder || c?.folder_name || '').trim())
      .filter(Boolean);
  };

  const load = useCallback(async () => {
    if (!workspaceId || !isOwnerOrAdmin) return;
    try {
      const res: any = await getWorkspaceApprovals(workspaceId);
      if (activeWorkspaceRef.current !== workspaceId) return;
      const d = res?.data ?? res;
      setData({
        workspaceId,
        hardSync: Array.isArray(d?.hardSync) ? d.hardSync : [],
        restoreRequests: Array.isArray(d?.restoreRequests) ? d.restoreRequests : [],
        backups: Array.isArray(d?.backups) ? d.backups : [],
        canApproveRestore: !!d?.canApproveRestore,
        activeDesktop: d?.activeDesktop || null,
      });
    } catch {
      // A failed refresh keeps the list on screen; only a first load with nothing to show ends empty.
      if (activeWorkspaceRef.current !== workspaceId) return;
      setData((cur) => (cur.workspaceId === workspaceId ? cur : { ...NO_APPROVALS, workspaceId }));
    }
  }, [workspaceId, isOwnerOrAdmin]);

  // The spinner covers the first answer for this workspace only; the 8-second refresh updates in place.
  const ready = !workspaceId || data.workspaceId === workspaceId;
  const { hardSync, restoreRequests, backups, canApproveRestore, activeDesktop } =
    workspaceId && data.workspaceId === workspaceId ? data : NO_APPROVALS;

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

      {!ready ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.brandPrimary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          <Text style={s.wsLabel}>{workspace?.name || t('screens.settingsApprovals.workspace')}</Text>

          {/* ── Hard Sync ─────────────────────────────────────────────── */}
          <Text style={s.section}>{t('screens.settingsApprovals.hardSyncRequests')}</Text>
          {hardSync.length === 0 ? (
            <Text style={s.empty}>{t('screens.settingsApprovals.noHardSync')}</Text>
          ) : hardSync.map((r) => {
            const companies: any[] = Array.isArray(r.scope?.companies) ? r.scope.companies : [];
            const replacement = r.scope?.replacement;
            const hasDetails = companies.length > 0 || !!replacement;
            const expanded = !!open[r.id];
            return (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.typeChip, s.typeHardSync]}>
                    <Text style={[s.typeTxt, { color: COLORS.warning }]}>{t('screens.settingsApprovals.typeHardSync')}</Text>
                  </View>
                  <Text style={s.cardWhen}>{when(r.created_at)}</Text>
                </View>
                <Text style={s.cardTitle}>{r.operation || 'REBUILD'}</Text>
                <Text style={s.cardMeta}>
                  {t('screens.settingsApprovals.device', { id: r.device_id || r.deviceId || '—' })}
                  {companies.length > 0 ? ` · ${t('screens.settingsApprovals.companiesCount', { count: companies.length })}` : ''}
                </Text>
                {hasDetails && (
                  <TouchableOpacity style={s.detailsBtn} onPress={() => toggleOpen(r.id)} activeOpacity={0.7}>
                    <Text style={s.detailsTxt}>{expanded ? t('screens.settingsApprovals.hideDetails') : t('screens.settingsApprovals.showDetails')}</Text>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.brandPrimary} />
                  </TouchableOpacity>
                )}
                {expanded && (
                  <View style={s.details}>
                    {companies.map((c: any) => (
                      <Text key={c.guid} style={s.scopeLine}>
                        {c.name || shortGuid(c.guid)}
                        {Array.isArray(c.years) && c.years.length > 0
                          ? ` · ${t('screens.settingsApprovals.years', 'Years')}: ${c.years.join(', ')}`
                          : ''}
                      </Text>
                    ))}
                    {replacement ? (
                      <Text style={s.replacementLine}>
                        {t('screens.settingsApprovals.replacesIdentity', 'Replaces company identity')}:{' '}
                        {replacement.oldName || '—'} ({shortGuid(replacement.oldGuid)}) →{' '}
                        {replacement.newName || '—'} ({shortGuid(replacement.newGuid)})
                      </Text>
                    ) : null}
                  </View>
                )}
                <View style={s.row}>
                  <TouchableOpacity
                    style={[s.btn, s.reject, busy === r.id && s.btnBusy]}
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
                    style={[s.btn, s.approve, busy === r.id && s.btnBusy]}
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
            );
          })}

          {/* ── Restore / Replace Computer ────────────────────────────── */}
          <Text style={s.section}>{t('screens.settingsApprovals.restoreSection')}</Text>
          {!canApproveRestore ? (
            <Text style={s.empty}>{t('screens.settingsApprovals.restoreOwnerOnly', 'Only the Workspace Owner can approve a restore.')}</Text>
          ) : restoreRequests.length === 0 ? (
            <Text style={s.empty}>{t('screens.settingsApprovals.noRestore')}</Text>
          ) : restoreRequests.map((r) => {
            const pick = picks[r.id] || {};
            const backupId = pick.backupId || backups[0]?.id || null;
            const allFolders = foldersFor(backups.find((b) => b.id === backupId) || {});
            const chosen = pick.folders || allFolders;
            const setPick = (next: RestorePick) => setPicks((cur) => ({ ...cur, [r.id]: { ...cur[r.id], ...next } }));
            // The backup / company picker is the "details" of a restore request; it opens by default
            // because the Owner has to choose a backup before approving.
            const expanded = open[r.id] !== false;
            return (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.typeChip, s.typeRestore]}>
                    <Text style={[s.typeTxt, { color: COLORS.brandPrimary }]}>{t('screens.settingsApprovals.typeRestore')}</Text>
                  </View>
                  <Text style={s.cardWhen}>{when(r.created_at)}</Text>
                </View>
                <Text style={s.cardTitle}>{r.device_name || t('screens.settingsApprovals.restoreRequest')}</Text>
                <Text style={s.cardMeta}>
                  {t('screens.settingsApprovals.verifiedWith', { contact: r.requester_contact || '—' })} · {t('screens.settingsApprovals.expiresAt', { time: when(r.expires_at) })}
                </Text>
                <Text style={s.replacementLine}>
                  {activeDesktop
                    ? t('screens.settingsApprovals.replacesDesktop', { name: activeDesktop.name })
                    : t('screens.settingsApprovals.noDesktop')}
                </Text>
                <TouchableOpacity style={s.detailsBtn} onPress={() => setOpen((cur) => ({ ...cur, [r.id]: !expanded }))} activeOpacity={0.7}>
                  <Text style={s.detailsTxt}>{expanded ? t('screens.settingsApprovals.hideDetails') : t('screens.settingsApprovals.showDetails')}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.brandPrimary} />
                </TouchableOpacity>
                {expanded && (
                  backups.length === 0 ? (
                    <Text style={s.cardMeta}>{t('screens.settingsApprovals.noBackups')}</Text>
                  ) : (
                    <View style={s.details}>
                      <Text style={s.label}>{t('screens.settingsApprovals.backup')}</Text>
                      {backups.map((b) => (
                        <TouchableOpacity
                          key={b.id}
                          style={[s.backupRow, backupId === b.id && s.backupSelected]}
                          onPress={() => setPick({ backupId: b.id, folders: undefined })}
                        >
                          <Text style={s.cardMeta}>{when(b.completed_at || b.created_at)}</Text>
                        </TouchableOpacity>
                      ))}
                      {allFolders.length > 0 && <Text style={s.label}>{t('screens.settingsApprovals.companies')}</Text>}
                      {allFolders.map((folder) => {
                        const on = chosen.includes(folder);
                        return (
                          <TouchableOpacity
                            key={folder}
                            onPress={() => setPick({ folders: on ? chosen.filter((f) => f !== folder) : [...chosen, folder] })}
                          >
                            <Text style={s.cardMeta}>{on ? '☑' : '☐'} {folder}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                )}
                <View style={s.row}>
                  <TouchableOpacity
                    style={[s.btn, s.reject, busy === r.id && s.btnBusy]}
                    disabled={!!busy}
                    onPress={async () => {
                      setBusy(r.id);
                      try {
                        await rejectRestoreSession(r.id);
                        Alert.alert(t('screens.settingsApprovals.restoreRejected'));
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
                    style={[s.btn, s.approve, (!backupId || !chosen.length || busy === r.id) && s.btnBusy]}
                    disabled={!backupId || !chosen.length || !!busy}
                    onPress={async () => {
                      setBusy(r.id);
                      try {
                        await approveRestoreRequest(r.id, {
                          backupId: backupId!,
                          companyFolders: chosen.length && chosen.length < allFolders.length ? chosen : null,
                        });
                        Alert.alert(t('screens.settingsApprovals.approved'), t('screens.settingsApprovals.restoreApproved'));
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
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const shortGuid = (g?: string) => (g ? `${String(g).slice(0, 8)}…` : '—');
const when = (sec?: number | string) => (sec ? new Date(Number(sec) * 1000).toLocaleString() : '—');

type RestorePick = { backupId?: string; folders?: string[] };

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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  typeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  typeHardSync: { backgroundColor: COLORS.warningBg },
  typeRestore: { backgroundColor: COLORS.brandPrimary + '14' },
  typeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  cardWhen: { fontSize: 11, color: COLORS.textTertiary },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  detailsTxt: { fontSize: 12, fontWeight: '700', color: COLORS.brandPrimary },
  details: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  scopeLine: { fontSize: 12, color: COLORS.textPrimary, marginTop: 4 },
  replacementLine: { fontSize: 12, color: COLORS.warning, marginTop: 6, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnBusy: { opacity: 0.6 },
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
