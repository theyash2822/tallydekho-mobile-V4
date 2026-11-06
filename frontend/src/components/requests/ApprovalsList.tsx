/**
 * Settings → Requests, "For this workspace": Hard Sync and restore requests from the desktop Agent that the
 * Owner or an Admin decides. Its data is the shared pending-requests store, so the tab count, the bell and
 * Settings change the moment a request is decided here.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/colors';
import { useWorkspace } from '../../context/WorkspaceContext';
import { usePendingRequests, toMs } from '../../hooks/usePendingRequests';
import { EmptyState, ErrorState } from '../ApiStateViews';
import { CardSkeleton } from '../ShimmerPlaceholder';
import { Callout, SectionLabel, StatusPill } from '../settings/SettingsKit';
import {
  CardHead, DecisionButtons, Meta, expiryOf, rs, when, type Busy, type Translate,
} from './RequestCardKit';
import {
  approveHardSyncRequest,
  rejectHardSyncRequest,
  approveRestoreRequest,
  rejectRestoreSession,
} from '../../services/api';

/** While this list is on screen the approvals are asked for this often (the Home bell asks every 30 s). */
const LIST_POLL_MS = 8000;

type RestorePick = { backupId?: string; folders?: string[] };
type RestoreChoice = { backupId: string; companyFolders: string[] | null };
type Item = { kind: 'hardSync' | 'restore'; at: number; row: any };

export function ApprovalsList() {
  const { t } = useTranslation();
  const { workspace, refreshContext } = useWorkspace();
  const {
    canActOnApprovals, approvals, approvalsLoaded, approvalsError, approvalsFetchedAt, reloadApprovals, retryApprovals,
  } = usePendingRequests({ pollMs: LIST_POLL_MS });
  const [picks, setPicks] = useState<Record<string, RestorePick>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { hardSync, restoreRequests, backups, canApproveRestore, activeDesktop } = approvals;

  const refresh = async () => {
    const hadList = approvalsLoaded;
    setRefreshing(true);
    const ok = await reloadApprovals().then(() => true, () => false);
    setRefreshing(false);
    if (!ok && hadList) {
      Toast.show({
        type: 'error',
        text1: t('screens.settingsApprovals.loadFailed', 'Could not load approvals'),
        text2: t('screens.settingsApprovals.tryAgain'),
      });
    }
  };

  const decided = async (text1: string, text2: string | undefined, contextChanged: boolean) => {
    Toast.show({ type: 'success', text1, text2 });
    await reloadApprovals().catch(() => {});
    if (contextChanged) refreshContext().catch(() => {});
  };

  const failed = (approve: boolean, e: any) => {
    Toast.show({
      type: 'error',
      text1: approve ? t('screens.settingsApprovals.approveFailed') : t('screens.settingsApprovals.rejectFailed'),
      text2: e?.message || e?.code || t('screens.settingsApprovals.tryAgain'),
    });
  };

  const decideHardSync = async (r: any, approve: boolean) => {
    setBusy({ key: `hs-${r.id}`, action: approve ? 'approve' : 'reject' });
    try {
      if (approve) {
        await approveHardSyncRequest(r.id);
        await decided(t('screens.settingsApprovals.approved'), t('screens.settingsApprovals.hardSyncApproved'), true);
      } else {
        await rejectHardSyncRequest(r.id);
        await decided(t('screens.settingsApprovals.hardSyncRejected', 'Hard Sync request rejected.'), undefined, true);
      }
    } catch (e: any) {
      const already = approve && (e?.code === 'HARD_SYNC_ALREADY_APPROVED' || /already approved/i.test(e?.message || ''));
      if (already) {
        Toast.show({
          type: 'info',
          text1: t('screens.settingsApprovals.alreadyApproved'),
          text2: t('screens.settingsApprovals.alreadyApprovedMsg'),
        });
        await reloadApprovals().catch(() => {});
      } else {
        failed(approve, e);
      }
    } finally {
      setBusy(null);
    }
  };

  const approveRestore = async (r: any, choice: RestoreChoice) => {
    setBusy({ key: `rs-${r.id}`, action: 'approve' });
    try {
      await approveRestoreRequest(r.id, choice);
      await decided(t('screens.settingsApprovals.approved'), t('screens.settingsApprovals.restoreApproved'), true);
    } catch (e: any) {
      failed(true, e);
    } finally {
      setBusy(null);
    }
  };

  const rejectRestore = async (r: any) => {
    setBusy({ key: `rs-${r.id}`, action: 'reject' });
    try {
      await rejectRestoreSession(r.id);
      await decided(t('screens.settingsApprovals.restoreRejected'), undefined, false);
    } catch (e: any) {
      failed(false, e);
    } finally {
      setBusy(null);
    }
  };

  if (!canActOnApprovals) {
    return <EmptyState icon="lock-closed-outline" title={t('screens.settingsApprovals.ownerOnly')} />;
  }
  // The skeleton covers the first answer for this workspace only; the 8-second refresh updates in place.
  if (!approvalsLoaded && approvalsError === null) {
    return (
      <View style={rs.content}>
        <CardSkeleton height={170} />
        <CardSkeleton height={170} />
      </View>
    );
  }
  if (!approvalsLoaded) {
    return (
      <ErrorState
        title={t('screens.settingsApprovals.loadFailed', 'Could not load approvals')}
        message={approvalsError || t('screens.settingsApprovals.loadFailed', 'Could not load approvals')}
        onRetry={() => { retryApprovals().catch(() => {}); }}
      />
    );
  }

  const items: Item[] = [
    ...hardSync.map((row) => ({ kind: 'hardSync' as const, at: toMs(row.created_at), row })),
    ...(canApproveRestore ? restoreRequests : []).map((row) => ({ kind: 'restore' as const, at: toMs(row.created_at), row })),
  ].sort((a, b) => b.at - a.at);

  return (
    <ScrollView
      contentContainerStyle={[rs.content, !items.length && rs.contentEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.brandPrimary} />}
      testID="requests-approvals"
    >
      {items.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title={t('screens.settingsApprovals.emptyTitle', 'Nothing to approve')}
          subtitle={t('screens.settingsApprovals.emptySub', 'Hard Sync and restore requests from Desktop appear here.')}
        />
      ) : (
        <>
          <SectionLabel title={workspace?.name || t('screens.settingsApprovals.workspace')} style={s.wsLabel} />
          {items.map((item) => (item.kind === 'hardSync' ? (
            <HardSyncCard
              key={`hs-${item.row.id}`}
              r={item.row}
              fetchedAt={approvalsFetchedAt}
              busy={busy}
              onDecide={(approve) => decideHardSync(item.row, approve)}
            />
          ) : (
            <RestoreCard
              key={`rs-${item.row.id}`}
              r={item.row}
              fetchedAt={approvalsFetchedAt}
              busy={busy}
              backups={backups}
              activeDesktop={activeDesktop}
              pick={picks[item.row.id] || {}}
              onPick={(next) => setPicks((cur) => ({ ...cur, [item.row.id]: { ...cur[item.row.id], ...next } }))}
              onApprove={(choice) => approveRestore(item.row, choice)}
              onReject={() => rejectRestore(item.row)}
            />
          )))}
        </>
      )}
      {!canApproveRestore ? (
        <Text style={s.footnote}>{t('screens.settingsApprovals.restoreOwnerOnly', 'Only the Workspace Owner can approve a restore.')}</Text>
      ) : null}
    </ScrollView>
  );
}

function HardSyncCard({ r, fetchedAt, busy, onDecide }: {
  r: any; fetchedAt: number; busy: Busy; onDecide: (approve: boolean) => void;
}) {
  const { t } = useTranslation();
  const companies: any[] = Array.isArray(r.scope?.companies) ? r.scope.companies : [];
  const replacement = r.scope?.replacement;
  const device = String(r.device_id || r.deviceId || '').slice(0, 8);
  const expiry = expiryOf(r.expires_at ?? r.expiresAt, fetchedAt, t);
  return (
    <View style={rs.card} testID={`approval-hard-sync-${r.id}`}>
      <CardHead
        icon="sync-outline"
        tone="warning"
        title={hardSyncTitle(r.operation, t)}
        when={when(r.created_at)}
        pill={<StatusPill label={t('screens.settingsApprovals.typeHardSync')} tone="warning" />}
      />
      {companies.length > 0 ? (
        <View style={s.companies}>
          {companies.map((c: any, i: number) => (
            <View key={c.guid || i} style={s.company}>
              <Ionicons name="business-outline" size={15} color={COLORS.textSecondary} style={s.companyIcon} />
              <View style={rs.grow}>
                <Text style={s.companyName} numberOfLines={2}>{c.name || shortGuid(c.guid)}</Text>
                {Array.isArray(c.years) && c.years.length > 0 ? (
                  <Text style={s.companyMeta}>{t('screens.settingsApprovals.years', 'Years')}: {c.years.join(', ')}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {replacement ? (
        <Callout
          tone="warning"
          icon="swap-horizontal-outline"
          style={s.callout}
          text={`${t('screens.settingsApprovals.replacesIdentity', 'Replaces company identity')}: ${replacement.oldName || '—'} (${shortGuid(replacement.oldGuid)}) → ${replacement.newName || '—'} (${shortGuid(replacement.newGuid)})`}
        />
      ) : null}
      {device || expiry ? (
        <View style={rs.metaRow}>
          {device ? <Meta icon="hardware-chip-outline" text={t('screens.settingsApprovals.device', { id: device })} /> : null}
          {expiry ? <Meta icon="time-outline" text={expiry.text} tone={expiry.tone} /> : null}
        </View>
      ) : null}
      <DecisionButtons
        busyKey={`hs-${r.id}`}
        busy={busy}
        approveLabel={t('screens.settingsApprovals.approve')}
        onApprove={() => onDecide(true)}
        onReject={() => onDecide(false)}
      />
    </View>
  );
}

function RestoreCard({ r, fetchedAt, busy, backups, activeDesktop, pick, onPick, onApprove, onReject }: {
  r: any;
  fetchedAt: number;
  busy: Busy;
  backups: any[];
  activeDesktop: { name: string } | null;
  pick: RestorePick;
  onPick: (next: RestorePick) => void;
  onApprove: (choice: RestoreChoice) => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const backup = backups.find((b) => b.id === pick.backupId) || backups[0];
  const backupId: string | null = backup?.id || null;
  const companies = manifestOf(backup);
  const allFolders = companies.map((c) => c.folder);
  // The Owner picks by company name; the Tally data folder is what the server checks against the backup.
  const chosen = pick.folders ? pick.folders.filter((f) => allFolders.includes(f)) : allFolders;
  const expiry = expiryOf(r.expires_at, fetchedAt, t);
  // Choosing companies pins the backup they came from, so a newer backup arriving does not swap it.
  const toggle = (folder: string) => onPick({
    backupId: backupId || undefined,
    folders: chosen.includes(folder) ? chosen.filter((f) => f !== folder) : [...chosen, folder],
  });
  return (
    <View style={rs.card} testID={`approval-restore-${r.id}`}>
      <CardHead
        icon="desktop-outline"
        tone="info"
        title={r.device_name || t('screens.settingsApprovals.restoreRequest')}
        when={when(r.created_at)}
        pill={<StatusPill label={t('screens.settingsApprovals.typeRestore')} tone="info" />}
      />
      <View style={rs.metaRow}>
        <Meta icon="person-circle-outline" text={t('screens.settingsApprovals.verifiedWith', { contact: r.requester_contact || '—' })} />
        {expiry ? <Meta icon="time-outline" text={expiry.text} tone={expiry.tone} /> : null}
      </View>
      <Callout
        tone={activeDesktop ? 'warning' : 'info'}
        icon="desktop-outline"
        style={s.callout}
        text={activeDesktop
          ? t('screens.settingsApprovals.replacesDesktop', { name: activeDesktop.name })
          : t('screens.settingsApprovals.noDesktop')}
      />
      {backups.length === 0 ? (
        <Text style={s.note}>{t('screens.settingsApprovals.noBackups')}</Text>
      ) : (
        <>
          <Text style={s.pickLabel}>{t('screens.settingsApprovals.backup')}</Text>
          {backups.map((b) => {
            const selected = backupId === b.id;
            const count = manifestOf(b).length;
            return (
              <TouchableOpacity
                key={b.id}
                style={s.choice}
                onPress={() => onPick({ backupId: b.id, folders: undefined })}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? COLORS.brandPrimary : COLORS.textTertiary}
                />
                <View style={rs.grow}>
                  <Text style={s.choiceTitle}>{when(b.completed_at || b.created_at)}</Text>
                  {count > 0 ? <Text style={s.choiceSub}>{t('screens.settingsApprovals.companiesCount', { count })}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
          {companies.length > 0 ? <Text style={s.pickLabel}>{t('screens.settingsApprovals.companies')}</Text> : null}
          {companies.map((c) => {
            const on = chosen.includes(c.folder);
            return (
              <TouchableOpacity
                key={c.folder}
                style={s.choice}
                onPress={() => toggle(c.folder)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={on ? COLORS.brandPrimary : COLORS.textTertiary}
                />
                <Text style={[s.choiceTitle, rs.grow]} numberOfLines={2}>{c.name || c.folder}</Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}
      <DecisionButtons
        busyKey={`rs-${r.id}`}
        busy={busy}
        approveLabel={t('screens.settingsApprovals.approveRestore')}
        approveDisabled={!backupId || !chosen.length}
        onApprove={() => {
          if (!backupId) return;
          onApprove({
            backupId,
            companyFolders: chosen.length && chosen.length < allFolders.length ? chosen : null,
          });
        }}
        onReject={onReject}
      />
    </View>
  );
}

const shortGuid = (g?: string) => (g ? `${String(g).slice(0, 8)}…` : '—');

/** What Desktop asks to do, in words; an operation the app does not know is spelled out from its code. */
function hardSyncTitle(operation: unknown, t: Translate): string {
  const op = String(operation || 'REBUILD').trim().toUpperCase();
  if (op === 'REBUILD') return t('screens.settingsApprovals.opRebuild', { defaultValue: 'Rebuild synced data from Tally' });
  const words = op.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Companies in a backup: `folder` is the Tally data folder sent on approve, `name` is what the Owner reads. */
function manifestOf(backup: any): { folder: string; name: string }[] {
  let manifest = backup?.company_manifest_json;
  if (typeof manifest === 'string') {
    try { manifest = JSON.parse(manifest); } catch { manifest = []; }
  }
  if (!Array.isArray(manifest)) return [];
  return manifest
    .map((c: any) => ({ folder: String(c?.folder || c?.folder_name || '').trim(), name: String(c?.name || '').trim() }))
    .filter((c) => c.folder);
}

const s = StyleSheet.create({
  wsLabel: { marginTop: 0 },
  companies: { marginTop: 12, gap: SPACING.sm },
  company: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  companyIcon: { marginTop: 1 },
  companyName: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  companyMeta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  callout: { marginTop: 12 },
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 19, marginTop: 12 },
  pickLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.9, marginTop: SPACING.md, marginBottom: SPACING.xs,
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: SPACING.sm },
  choiceTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '500', color: COLORS.textPrimary },
  choiceSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  footnote: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 17,
    marginTop: SPACING.sm, paddingHorizontal: SPACING.md,
  },
});
