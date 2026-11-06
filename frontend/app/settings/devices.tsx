/**
 * Settings → Signed-in devices: every place the account is signed in (the app and the web portal), this device
 * first, and Log out of all devices — keeping this one signed in or not.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ErrorState } from '../../src/components/ApiStateViews';
import { CardSkeleton } from '../../src/components/ShimmerPlaceholder';
import { BottomModalShell } from '../../src/components/forms/BottomModalShell';
import { Callout, HeaderIconButton, ListRow, SettingsCard, StatusPill } from '../../src/components/settings/SettingsKit';
import { getAuthSessions, logoutAllSessions, type AuthSessionRow } from '../../src/services/api';
import { refreshPushRegistration } from '../../src/services/pushNotifications';
import { formatWhen } from '../../src/utils/complianceRules';

type Loaded = { sessions: AuthSessionRow[]; error: string | null } | null;

export default function SignedInDevicesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [data, setData] = useState<Loaded>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'keep' | 'everywhere' | null>(null);

  /** Resolves false when the request failed. */
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await getAuthSessions();
      const list = res?.data?.sessions;
      setData({ sessions: Array.isArray(list) ? list : [], error: null });
      return true;
    } catch (e: any) {
      // A failed refresh keeps the list on screen; only a first load with nothing to show is an error.
      const message = e?.message || t('screens.settingsDevices.loadFailed');
      setData((cur) => (cur && !cur.error ? cur : { sessions: [], error: message }));
      return false;
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    const hadList = !!data && !data.error;
    setRefreshing(true);
    const ok = await load();
    setRefreshing(false);
    if (!ok && hadList) Toast.show({ type: 'error', text1: t('screens.settingsDevices.loadFailed') });
  };

  const retry = () => {
    setData(null);
    load();
  };

  const logoutAll = async (keepCurrent: boolean) => {
    setBusy(keepCurrent ? 'keep' : 'everywhere');
    try {
      const res = await logoutAllSessions(keepCurrent);
      setConfirming(false);
      if (!keepCurrent) {
        // This session ended with the others: only this device is left to clear.
        await signOut({ server: false, notice: 'signed_out_everywhere' });
        return;
      }
      const revoked = Number(res?.data?.revoked) || 0;
      Toast.show({
        type: 'success',
        text1: revoked > 0 ? t('auth.otherDevicesSignedOut', { count: revoked }) : t('screens.settingsDevices.noOtherDevices'),
      });
      // Ending the other sessions dropped every push token not tied to this one.
      refreshPushRegistration();
      await load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: t('screens.settingsDevices.logoutAllFailed'), text2: e?.message || undefined });
    } finally {
      setBusy(null);
    }
  };

  const lastActive = (row: AuthSessionRow): string | null => {
    if (row.current) return t('screens.settingsDevices.activeNow');
    const at = Number(row.last_used_at ?? row.created_at);
    return at > 0 ? t('screens.settingsDevices.lastActive', { time: formatWhen(new Date(at * 1000)) }) : null;
  };

  const sessions = data?.sessions || [];
  const others = sessions.filter((row) => !row.current).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader
        title={t('screens.settingsDevices.title')}
        onBack={() => router.back()}
        right={(
          <HeaderIconButton
            icon="refresh"
            label={t('common.refresh')}
            onPress={refresh}
            busy={refreshing}
            testID="devices-refresh"
          />
        )}
      />
      {!data ? (
        <View style={s.content}>
          <CardSkeleton height={64} />
          <CardSkeleton height={64} />
        </View>
      ) : data.error ? (
        <ErrorState title={t('screens.settingsDevices.loadFailed')} message={data.error} onRetry={retry} />
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.brandPrimary} />}
        >
          <SettingsCard testID="devices-list">
            {sessions.map((row, i) => {
              const web = row.client_type === 'web';
              const kind = row.client_type === 'app' || web
                ? <StatusPill label={web ? t('screens.settingsDevices.web') : t('screens.settingsDevices.app')} tone={web ? 'info' : 'neutral'} />
                : null;
              return (
                <ListRow
                  key={row.id}
                  icon={web ? 'globe-outline' : 'phone-portrait-outline'}
                  tone={row.current ? 'positive' : undefined}
                  title={row.device_label || t('screens.settingsDevices.unknownDevice')}
                  subtitle={lastActive(row)}
                  right={(
                    <View style={s.pills}>
                      {row.current ? <StatusPill label={t('screens.settingsDevices.thisDevice')} tone="positive" /> : null}
                      {kind}
                    </View>
                  )}
                  last={i === sessions.length - 1}
                  testID={`device-${row.current ? 'current' : row.id}`}
                />
              );
            })}
          </SettingsCard>
          {others === 0 ? <Callout tone="info" text={t('screens.settingsDevices.onlyThisDevice')} style={s.callout} /> : null}
          <TouchableOpacity
            style={s.logoutAllBtn}
            onPress={() => setConfirming(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            testID="devices-logout-all"
          >
            <Ionicons name="log-out-outline" size={18} color={COLORS.negative} />
            <Text style={s.logoutAllTxt}>{t('screens.settingsDevices.logoutAll')}</Text>
          </TouchableOpacity>
          <Text style={s.footnote}>{t('screens.settingsDevices.logoutAllHint')}</Text>
        </ScrollView>
      )}

      <BottomModalShell
        visible={confirming}
        onClose={() => { if (!busy) setConfirming(false); }}
        title={t('screens.settingsDevices.logoutAllTitle')}
        keyboardAvoiding={false}
      >
        <Text style={s.sheetMsg}>{t('screens.settingsDevices.logoutAllMsg')}</Text>
        <TouchableOpacity
          style={[s.btn, s.keepBtn, busy === 'everywhere' && s.btnDim]}
          onPress={() => logoutAll(true)}
          disabled={!!busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!busy, busy: busy === 'keep' }}
          testID="devices-logout-keep"
        >
          {busy === 'keep'
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={s.keepTxt}>{t('screens.settingsDevices.keepThisDevice')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.btn, s.everywhereBtn, busy === 'keep' && s.btnDim]}
          onPress={() => logoutAll(false)}
          disabled={!!busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!busy, busy: busy === 'everywhere' }}
          testID="devices-logout-everywhere"
        >
          {busy === 'everywhere'
            ? <ActivityIndicator size="small" color={COLORS.negative} />
            : <Text style={s.everywhereTxt}>{t('screens.settingsDevices.signOutEverywhere')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => setConfirming(false)}
          disabled={!!busy}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={s.cancelTxt}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </BottomModalShell>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  pills: { alignItems: 'flex-end', gap: 4 },
  callout: { marginBottom: SPACING.md },
  logoutAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    minHeight: 48, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.negative, backgroundColor: COLORS.cardBg,
  },
  logoutAllTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative },
  footnote: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 17,
    marginTop: SPACING.sm, paddingHorizontal: SPACING.md,
  },
  sheetMsg: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.md },
  btn: {
    minHeight: 48, borderRadius: RADIUS.md, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  btnDim: { opacity: 0.5 },
  keepBtn: { backgroundColor: COLORS.brandPrimary },
  keepTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  everywhereBtn: { backgroundColor: COLORS.negativeBg },
  everywhereTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
});
