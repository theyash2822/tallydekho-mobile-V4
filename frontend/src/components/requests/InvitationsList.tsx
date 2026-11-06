/**
 * Settings → Requests, "For you": invitations to join another workspace, sent to the signed-in user
 * (GET /me/invitations, kept in WorkspaceContext). An accepted invitation stays on screen as a "Joined" card
 * with a button to switch to that workspace.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS } from '../../constants/colors';
import { useWorkspace } from '../../context/WorkspaceContext';
import { isOpenInvitation } from '../../hooks/usePendingRequests';
import { EmptyState } from '../ApiStateViews';
import { StatusPill } from '../settings/SettingsKit';
import { CardHead, DecisionButtons, Meta, expiryOf, rs, when, type Busy } from './RequestCardKit';

type Joined = { id: string; workspaceId: string; name: string; role: string };

export function InvitationsList() {
  const { t } = useTranslation();
  const { workspaceId, invitations, acceptInvite, declineInvite, switchWorkspace, refreshInvitations } = useWorkspace();
  const [busy, setBusy] = useState<Busy>(null);
  const [joined, setJoined] = useState<Joined[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const nameOf = (inv: any) => String(inv?.workspace_name || t('screens.settingsInvitations.workspaceFallback'));
  const roleOf = (inv: any) => String(inv?.role_display_name || t('screens.settingsInvitations.memberFallback'));

  const refresh = async () => {
    setRefreshing(true);
    const list = await refreshInvitations();
    setRefreshing(false);
    if (list === null) {
      Toast.show({
        type: 'error',
        text1: t('screens.settingsInvitations.loadFailed'),
        text2: t('screens.settingsInvitations.tryAgain'),
      });
    }
  };

  const accept = async (inv: any) => {
    const name = nameOf(inv);
    setBusy({ key: inv.id, action: 'approve' });
    try {
      const data = await acceptInvite(inv.id);
      const joinedId = String(data?.workspaceId || data?.workspace_id || data?.workspace?.id || inv.workspace_id || '');
      Toast.show({
        type: 'success',
        text1: t('screens.settingsInvitations.accepted'),
        text2: t('screens.settingsInvitations.acceptedSub', { name }),
      });
      if (joinedId) {
        setJoined((cur) => [
          { id: inv.id, workspaceId: joinedId, name, role: roleOf(inv) },
          ...cur.filter((j) => j.id !== inv.id),
        ]);
      }
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: t('screens.settingsInvitations.acceptFailed'),
        text2: e?.message || t('screens.settingsInvitations.tryAgain'),
      });
    } finally {
      setBusy(null);
    }
  };

  const decline = async (inv: any) => {
    setBusy({ key: inv.id, action: 'reject' });
    try {
      await declineInvite(inv.id);
      Toast.show({ type: 'success', text1: t('screens.settingsInvitations.declined') });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: t('screens.settingsInvitations.declineFailed'),
        text2: e?.message || t('screens.settingsInvitations.tryAgain'),
      });
    } finally {
      setBusy(null);
    }
  };

  const switchTo = async (j: Joined) => {
    setSwitching(j.id);
    try {
      await switchWorkspace(j.workspaceId);
      setJoined((cur) => cur.filter((x) => x.id !== j.id));
      Toast.show({ type: 'success', text1: t('screens.settingsInvitations.switchedTo', { name: j.name }) });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('common.somethingWentWrong'), text2: e?.message });
    } finally {
      setSwitching(null);
    }
  };

  const pending = invitations.filter((inv: any) => inv?.id && !joined.some((j) => j.id === inv.id));
  const empty = !pending.length && !joined.length;

  return (
    <ScrollView
      contentContainerStyle={[rs.content, empty && rs.contentEmpty]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.brandPrimary} />}
      testID="requests-invitations"
    >
      {empty ? (
        <EmptyState
          icon="mail-open-outline"
          title={t('screens.settingsInvitations.emptyTitle')}
          subtitle={t('screens.settingsInvitations.emptySub')}
        />
      ) : null}
      {joined.map((j) => (
        <View key={`joined-${j.id}`} style={rs.card} testID={`invitation-joined-${j.id}`}>
          <CardHead
            icon="checkmark-circle-outline"
            tone="positive"
            title={j.name}
            when={t('screens.settingsInvitations.joinedAs', { role: j.role })}
            pill={<StatusPill label={t('screens.settingsInvitations.joined')} tone="positive" />}
          />
          {j.workspaceId !== workspaceId ? (
            <TouchableOpacity
              style={[rs.btn, rs.approveBtn, s.switchBtn, !!switching && switching !== j.id && rs.btnDim]}
              disabled={!!switching}
              onPress={() => switchTo(j)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!switching, busy: switching === j.id }}
            >
              {switching === j.id
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={rs.approveTxt}>{t('screens.settingsInvitations.switchTo', { name: j.name })}</Text>}
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {pending.map((inv: any) => {
        const expiry = expiryOf(inv.expires_at, Number(inv.fetched_at) || 0, t);
        const sentAt = inv.created_at ? when(inv.created_at) : '';
        return (
          <View key={inv.id} style={rs.card} testID={`invitation-${inv.id}`}>
            <CardHead
              icon="mail-unread-outline"
              tone="info"
              title={nameOf(inv)}
              when={sentAt && sentAt !== '—' ? t('screens.settingsInvitations.invitedOn', { time: sentAt }) : null}
              pill={<StatusPill label={roleOf(inv)} tone="neutral" icon="person-outline" />}
            />
            {inv.invited_by_name || expiry ? (
              <View style={rs.metaRow}>
                {inv.invited_by_name ? (
                  <Meta
                    icon="person-circle-outline"
                    text={t('screens.settingsInvitations.invitedBy', { name: inv.invited_by_name })}
                  />
                ) : null}
                {expiry ? <Meta icon="time-outline" text={expiry.text} tone={expiry.tone} /> : null}
              </View>
            ) : null}
            <DecisionButtons
              busyKey={inv.id}
              busy={busy}
              rejectLabel={t('screens.settingsInvitations.decline')}
              approveLabel={t('screens.settingsInvitations.accept')}
              approveDisabled={!isOpenInvitation(inv)}
              onApprove={() => accept(inv)}
              onReject={() => decline(inv)}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  switchBtn: { flex: 0, marginTop: 14 },
});
