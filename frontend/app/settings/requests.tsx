import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ApprovalsList } from '../../src/components/requests/ApprovalsList';
import { InvitationsList } from '../../src/components/requests/InvitationsList';
import { usePendingRequests, type RequestsTab } from '../../src/hooks/usePendingRequests';
import type { IconName } from '../../src/components/settings/SettingsKit';

const TABS: { id: RequestsTab; labelKey: string; icon: IconName }[] = [
  { id: 'approvals', labelKey: 'screens.settingsRequests.tabWorkspace', icon: 'shield-checkmark-outline' },
  { id: 'invitations', labelKey: 'screens.settingsRequests.tabYou', icon: 'mail-outline' },
];

/**
 * Settings → Requests: Hard Sync and restore approvals for this workspace (Owner / Admin /
 * tally.restore_replace only) and invitations for the signed-in user. With only invitations to show it is
 * that list alone, without tabs. `?tab=approvals|invitations` picks the tab it opens on.
 */
export default function RequestsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { canActOnApprovals, counts } = usePendingRequests();
  const [picked, setPicked] = useState<RequestsTab | null>(null);
  const requested: RequestsTab | null = params.tab === 'approvals' || params.tab === 'invitations' ? params.tab : null;
  const tab: RequestsTab = canActOnApprovals ? (picked ?? requested ?? 'approvals') : 'invitations';
  const countOf = (id: RequestsTab) => (id === 'approvals' ? counts.approvals : counts.invitations);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('screens.settingsRequests.title')} onBack={() => router.back()} />
      {canActOnApprovals ? (
        <View style={s.tabRow} accessibilityRole="tablist">
          {TABS.map(({ id, labelKey, icon }) => {
            const active = tab === id;
            const count = countOf(id);
            return (
              <TouchableOpacity
                key={id}
                style={[s.tabBtn, active && s.tabBtnActive]}
                onPress={() => setPicked(id)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                testID={`requests-tab-${id}`}
              >
                <Ionicons name={icon} size={15} color={active ? COLORS.white : COLORS.textSecondary} />
                <Text style={[s.tabTxt, active && s.tabTxtActive]} numberOfLines={1}>{t(labelKey)}</Text>
                <View style={[s.tabCount, active && s.tabCountActive]}>
                  <Text style={[s.tabCountTxt, active && s.tabCountTxtActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      {/* Both lists stay mounted, so switching tabs keeps restore choices and does not reload. */}
      {canActOnApprovals ? (
        <View style={[s.pane, tab !== 'approvals' && s.hidden]}>
          <ApprovalsList />
        </View>
      ) : null}
      <View style={[s.pane, tab !== 'invitations' && s.hidden]}>
        <InvitationsList />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.cardBg, padding: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault,
    backgroundColor: COLORS.pageBg,
  },
  tabBtnActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  tabTxt: { flexShrink: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTxtActive: { color: COLORS.white, fontWeight: '700' },
  tabCount: {
    minWidth: 20, height: 20, borderRadius: RADIUS.full, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.borderDefault,
  },
  tabCountActive: { backgroundColor: COLORS.white },
  tabCountTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textSecondary },
  tabCountTxtActive: { color: COLORS.textPrimary },
  pane: { flex: 1 },
  hidden: { display: 'none' },
});
