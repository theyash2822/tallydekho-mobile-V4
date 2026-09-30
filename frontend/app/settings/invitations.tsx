import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../../src/context/WorkspaceContext';

export default function InvitationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { invitations, acceptInvite, declineInvite, switchWorkspace, refreshInvitations } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('screens.settingsInvitations.title')}</Text>
        <TouchableOpacity onPress={() => refreshInvitations()} style={s.backBtn}>
          <Ionicons name="refresh" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
        {invitations.length === 0 ? (
          <Text style={s.empty}>{t('screens.settingsInvitations.noPending')}</Text>
        ) : (
          invitations.map((inv: any) => {
            const id = String(inv?.id || '');
            if (!id) return null;
            const wsName = String(inv.workspace_name || inv.workspaceName || inv.workspace?.name || t('screens.settingsInvitations.workspaceFallback'));
            const roleName = String(
              inv.role_display_name || inv.role_name || inv.roleName
              || inv.role?.display_name || inv.role?.displayName || t('screens.settingsInvitations.memberFallback')
            );
            return (
              <View key={id} style={s.card}>
                <Text style={s.title}>{t('screens.settingsInvitations.invitedYou', { name: wsName })}</Text>
                <Text style={s.meta}>{t('screens.settingsInvitations.role', { role: roleName })}</Text>
                <View style={s.row}>
                  <TouchableOpacity
                    style={[s.btn, s.decline]}
                    disabled={!!busy}
                    onPress={async () => {
                      setBusy(id);
                      try {
                        await declineInvite(id);
                      } catch (e: any) {
                        Alert.alert(t('screens.settingsInvitations.declineFailed'), e?.message || t('screens.settingsInvitations.tryAgain'));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === id ? <ActivityIndicator color="#E53935" /> : <Text style={s.declineTxt}>{t('screens.settingsInvitations.decline')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.accept]}
                    disabled={!!busy}
                    onPress={async () => {
                      setBusy(id);
                      try {
                        const data = await acceptInvite(id);
                        const newWsId = data?.workspaceId || data?.workspace_id || data?.workspace?.id;
                        Alert.alert(
                          t('screens.settingsInvitations.accepted'),
                          newWsId ? t('screens.settingsInvitations.switchToQ', { name: wsName }) : t('screens.settingsInvitations.acceptedShort'),
                          newWsId
                            ? [
                                { text: t('screens.settingsInvitations.stay'), style: 'cancel' },
                                {
                                  text: t('screens.settingsInvitations.switchTo', { name: wsName }),
                                  onPress: () => switchWorkspace(String(newWsId)),
                                },
                              ]
                            : [{ text: t('common.ok') }]
                        );
                      } catch (e: any) {
                        Alert.alert(t('screens.settingsInvitations.acceptFailed'), e?.message || t('screens.settingsInvitations.tryAgain'));
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === id ? <ActivityIndicator color="#fff" /> : <Text style={s.acceptTxt}>{t('screens.settingsInvitations.accept')}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  empty: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary, marginTop: 24, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginTop: 6 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  decline: { backgroundColor: '#FEF2F2' },
  accept: { backgroundColor: COLORS.brandPrimary },
  declineTxt: { fontWeight: '700', color: '#E53935' },
  acceptTxt: { fontWeight: '700', color: '#fff' },
});
