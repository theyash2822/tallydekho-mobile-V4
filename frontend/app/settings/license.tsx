/**
 * License & Credits — informational only on Mobile.
 * Per Universal / Mobile handoff: no checkout, no seat purchase, no fake Free plan.
 * Recharge / seats / additional Workspace are Web Portal (Owner) only.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useWorkspace } from '../../src/context/WorkspaceContext';

const WEB_PORTAL = 'https://app.tallydekho.com';

export default function LicenseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspace, isOwner, access } = useWorkspace();
  const roleLabel =
    access?.membershipType === 'OWNER'
      ? t('screens.settingsLicense.owner')
      : access?.role?.displayName || access?.role?.systemKey || t('screens.settingsLicense.member');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('settings.license')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.label}>{t('screens.settingsLicense.workspace')}</Text>
          <Text style={s.value}>{workspace?.name || '—'}</Text>
          <View style={s.divider} />
          <Text style={s.label}>{t('screens.settingsLicense.yourAccess')}</Text>
          <Text style={s.value}>{roleLabel}</Text>
          <TouchableOpacity
            style={{ marginTop: 10 }}
            onPress={() => router.push('/settings/my-access' as any)}
            activeOpacity={0.75}
          >
            <Text style={{ color: COLORS.brandPrimary, fontWeight: '700', fontSize: TYPOGRAPHY.sm }}>
              {t('screens.settingsLicense.viewMyAccess')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.title}>{t('screens.settingsLicense.billingOnWeb')}</Text>
          <Text style={s.body}>
            {t('screens.settingsLicense.billingBody')}
          </Text>
          {!isOwner ? (
            <Text style={[s.body, { marginTop: 10 }]}>
              {t('screens.settingsLicense.askOwner')}
            </Text>
          ) : (
            <TouchableOpacity
              style={s.linkBtn}
              onPress={() => Linking.openURL(WEB_PORTAL).catch(() => {})}
              activeOpacity={0.85}
            >
              <Text style={s.linkBtnTxt}>{t('screens.settingsLicense.openWebPortal')}</Text>
              <Ionicons name="open-outline" size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.footnote}>
          {t('screens.settingsLicense.footnote')}
        </Text>
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
  content: { padding: SPACING.md },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  label: { fontSize: 12, color: COLORS.textTertiary, fontWeight: '600' },
  value: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 },
  divider: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 12 },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  body: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  linkBtn: {
    marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brandPrimary, borderRadius: 12, paddingVertical: 14,
  },
  linkBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  footnote: { fontSize: 11, color: COLORS.textTertiary, lineHeight: 16, marginTop: 8, marginHorizontal: 4 },
});
