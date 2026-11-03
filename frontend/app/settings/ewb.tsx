import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import {
  getWorkspaceIntegration,
  saveWorkspaceIntegration,
  activateWorkspaceIntegration,
  testWorkspaceIntegration,
  ApiError,
} from '../../src/services/api';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { toastRbasError } from '../../src/utils/rbasErrors';
import { LoadingState, ErrorState } from '../../src/components/ApiStateViews';

function Field({
  label, value, set, secure, placeholder, showPass, onToggleShowPass, onEdited,
}: {
  label: string; value: string; set: (v: string) => void; secure?: boolean; placeholder: string;
  showPass: boolean; onToggleShowPass: () => void; onEdited: () => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fLabel}>{label}</Text>
      <View style={s.fRow}>
        <TextInput
          style={s.fInput}
          value={value}
          onChangeText={(v) => { set(v); onEdited(); }}
          placeholder={placeholder}
          secureTextEntry={secure && !showPass}
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
        />
        {secure && (
          <TouchableOpacity onPress={onToggleShowPass} style={s.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function EWBIntegrationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaceId, isOwnerOrAdmin: ownerOrAdmin, hasCapability } = useWorkspace();
  const isOwnerOrAdmin = ownerOrAdmin || hasCapability('integrations.configure');
  const [status, setStatus] = useState('NOT_CONFIGURED');
  const [gstin, setGstin] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [gateway, setGateway] = useState<{ provider: string; env: string; configured: boolean; sandboxLogin: { gstin: string; username: string } | null } | null>(null);
  const [usesSandboxLogin, setUsesSandboxLogin] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const markDirty = () => setIsDirty(true);

  React.useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    getWorkspaceIntegration(workspaceId, 'eway')
      .then((res: any) => {
        if (cancelled) return;
        const d = res?.data ?? res;
        setStatus(d?.status || 'NOT_CONFIGURED');
        const cfg = d?.config_json || d?.config || {};
        if (cfg.gstin) setGstin(cfg.gstin);
        if (cfg.username) setUsername(cfg.username);
        setUsesSandboxLogin(!!cfg.useSandboxLogin);
        setGateway(d?.gateway || null);
        setLoadState('ready');
      })
      .catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; };
  }, [workspaceId, reloadKey]);

  if (!isOwnerOrAdmin) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>{t('settings.ewayBill')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>
            {t('screens.settingsEwb.ownerOnly')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await saveWorkspaceIntegration(workspaceId, 'eway', { provider: 'perione', gstin, username, password });
      setStatus('CONFIGURED');
      setUsesSandboxLogin(false);
      setIsDirty(false);
      Alert.alert(t('common.saved'), t('screens.settingsEwb.savedMsg'));
    } catch (e) {
      toastRbasError(e) || Alert.alert(t('common.error'), t('screens.settingsEwb.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await activateWorkspaceIntegration(workspaceId, 'eway');
      setStatus('ACTIVE');
      Alert.alert(t('screens.settingsEwb.activated'), t('screens.settingsEwb.activatedMsg'));
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'BILLING_INSUFFICIENT_CREDITS' || e.code === 'INSUFFICIENT_CREDITS')) {
        Alert.alert(
          t('screens.settingsEwb.insufficientCredits'),
          t('screens.settingsEwb.insufficientCreditsMsg')
        );
      } else {
        toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t('screens.settingsEwb.activationFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Signs in at the portal with what is typed (or saved) and generates nothing.
  const testLogin = async () => {
    if (!workspaceId) return;
    setBusy(true);
    setTestResult(null);
    try {
      const res: any = await testWorkspaceIntegration(workspaceId, 'eway', { gstin, username, password });
      const d = res?.data ?? res ?? {};
      setTestResult({ ok: true, text: `${t('screens.settingsEwb.signedInAs', { defaultValue: 'Signed in as' })} ${d.username} · ${d.gstin}${d.usingSandboxLogin ? ` (${t('screens.settingsEwb.sandboxLogin', { defaultValue: 'sandbox test login' })})` : ''}` });
    } catch (e) {
      setTestResult({ ok: false, text: (e as any)?.message || t('screens.settingsEwb.loginRejected', { defaultValue: 'The portal did not accept this login' }) });
    } finally {
      setBusy(false);
    }
  };

  const useSandboxLogin = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await saveWorkspaceIntegration(workspaceId, 'eway', { provider: 'perione', useSandboxLogin: true });
      setStatus('CONFIGURED');
      setUsesSandboxLogin(true);
      setIsDirty(false);
    } catch (e) {
      toastRbasError(e) || Alert.alert(t('common.error'), t('screens.settingsEwb.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sandbox = gateway?.env === 'sandbox';
  const fieldProps = {
    showPass,
    onToggleShowPass: () => setShowPass((p) => !p),
    onEdited: markDirty,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>{t('settings.ewayBill')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {loadState === 'loading' ? (
        <LoadingState message={t('screens.settingsEwb.loadingSettings')} />
      ) : loadState === 'error' ? (
        <ErrorState
          title={t('screens.settingsEwb.loadFailedTitle')}
          message={t('screens.settingsEwb.loadFailedMsg')}
          onRetry={() => { setLoadState('loading'); setReloadKey(k => k + 1); }}
        />
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={[s.statusBanner, { backgroundColor: status === 'ACTIVE' ? COLORS.positiveBg : COLORS.negativeBg }]}>
            <View style={[s.statusDot, { backgroundColor: status === 'ACTIVE' ? COLORS.positive : COLORS.negative }]} />
            <Text style={[s.statusTxt, { color: status === 'ACTIVE' ? COLORS.positive : COLORS.negative }]}>
              {status === 'ACTIVE' ? t('screens.settingsEwb.activeForWorkspace') : t('screens.settingsEwb.statusLabel', { status })}
            </Text>
          </View>
          {gateway && (
            <View style={s.card}>
              <View style={s.cardHdr}>
                <Ionicons name="server-outline" size={18} color={COLORS.info} />
                <Text style={s.cardTitle}>{t('screens.settingsEwb.gateway', { defaultValue: 'Gateway' })}</Text>
              </View>
              <Text style={s.portalRow}>
                {gateway.provider} · {t(!gateway.configured ? 'screens.settingsEwb.gatewayMissing' : sandbox ? 'screens.settingsEwb.gatewaySandbox' : 'screens.settingsEwb.gatewayLive', { defaultValue: !gateway.configured ? 'not configured on the server' : sandbox ? 'Sandbox' : 'Live' })}
              </Text>
              {sandbox && (
                <Text style={s.portalRow}>
                  {t('screens.settingsEwb.sandboxNote', { defaultValue: 'Nothing reaches the real portal; only PeriOne\u2019s test GSTINs are accepted.' })}
                  {gateway.sandboxLogin ? ` ${t('screens.settingsEwb.testLogin', { defaultValue: 'Test login' })}: ${gateway.sandboxLogin.username} · ${gateway.sandboxLogin.gstin}.` : ''}
                </Text>
              )}
              {sandbox && gateway.sandboxLogin && (usesSandboxLogin ? (
                <Text style={[s.portalRow, { color: COLORS.positive }]}>{t('screens.settingsEwb.usesSandboxLogin', { defaultValue: 'This workspace uses the sandbox test login.' })}</Text>
              ) : (
                <TouchableOpacity onPress={useSandboxLogin} disabled={busy} activeOpacity={0.7}>
                  <Text style={[s.portalRow, { color: COLORS.info, fontWeight: '700' }]}>{t('screens.settingsEwb.useSandboxLogin', { defaultValue: 'Use the test login for this workspace' })}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="key-outline" size={18} color={COLORS.info} />
              <Text style={s.cardTitle}>{t('screens.settingsEwb.credentials')}</Text>
            </View>
            <Text style={s.portalRow}>{t('screens.settingsEwb.howTo', { defaultValue: 'On the E-Way Bill portal go to Registration → For GSP, select PeriOne and create the API user, then enter it here.' })}</Text>
            <Field {...fieldProps} label="GSTIN" value={gstin} set={(v) => setGstin(v.toUpperCase())} placeholder={t('screens.settingsEwb.gstinPh')} />
            <Field {...fieldProps} label={t('screens.settingsEwb.username')} value={username} set={setUsername} placeholder={t('screens.settingsEwb.usernamePh')} />
            <Field {...fieldProps} label={t('screens.settingsEwb.password')} value={password} set={setPassword} secure placeholder={t('screens.settingsEwb.passwordPh')} />
            {testResult && (
              <Text style={[s.portalRow, { color: testResult.ok ? COLORS.positive : COLORS.negative, marginBottom: 0 }]}>{testResult.text}</Text>
            )}
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.outBtn} onPress={testLogin} disabled={busy || !gateway?.configured} activeOpacity={0.7}>
              <Text style={[s.outTxt, { color: COLORS.info }]}>{t('screens.settingsEwb.testLoginBtn', { defaultValue: 'Test login' })}</Text>
            </TouchableOpacity>
          </View>
          <View style={s.btnRow}>
            {isDirty && (
              <TouchableOpacity style={s.primaryBtn} onPress={save} disabled={busy || loadState !== 'ready'} activeOpacity={0.8}>
                <Text style={s.primaryTxt}>{t('common.save')}</Text>
              </TouchableOpacity>
            )}
            {status !== 'ACTIVE' && (
              <TouchableOpacity style={s.outBtn} onPress={activate} disabled={busy} activeOpacity={0.7}>
                <Text style={[s.outTxt, { color: COLORS.info }]}>{t('screens.settingsEwb.activate')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={s.portalBtn} onPress={() => Linking.openURL('https://ewaybillgst.gov.in')} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.portalTxt}>{t('screens.settingsEwb.openPortal')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: 32 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  portalRow: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  field: { marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  fInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.sm },
  outBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.info },
  outTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  primaryBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  portalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  portalTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
});
