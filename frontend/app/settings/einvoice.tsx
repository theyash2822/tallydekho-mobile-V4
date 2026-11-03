import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, StyleSheet, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

export default function EInvoiceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaceId, isOwnerOrAdmin: ownerOrAdmin, hasCapability } = useWorkspace();
  const isOwnerOrAdmin = ownerOrAdmin || hasCapability('integrations.configure');
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState('NOT_CONFIGURED');
  const [gstin, setGstin] = useState('');
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
    getWorkspaceIntegration(workspaceId, 'einvoice')
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
          <Text style={s.title}>{t('settings.eInvoice')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>
            {t('screens.settingsEinvoice.onlyOwnerAdmin')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await saveWorkspaceIntegration(workspaceId, 'einvoice', { provider: 'perione', gstin, username, password });
      setStatus('CONFIGURED');
      setUsesSandboxLogin(false);
      setIsDirty(false);
      Alert.alert(t('common.saved'), t('screens.settingsEinvoice.savedMsg'));
    } catch (e) {
      toastRbasError(e) || Alert.alert(t('common.error'), t('screens.settingsEinvoice.couldNotSave'));
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await activateWorkspaceIntegration(workspaceId, 'einvoice');
      setStatus('ACTIVE');
      Alert.alert(t('screens.settingsEinvoice.activated'), t('screens.settingsEinvoice.activatedMsg'));
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'BILLING_INSUFFICIENT_CREDITS' || e.code === 'INSUFFICIENT_CREDITS')) {
        Alert.alert(
          t('screens.settingsEinvoice.insufficientCredits'),
          t('screens.settingsEinvoice.insufficientCreditsMsg')
        );
      } else {
        toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t('screens.settingsEinvoice.activationFailed'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Signs in at the IRP with what is typed (or saved) and generates nothing.
  const testLogin = async () => {
    if (!workspaceId) return;
    setBusy(true);
    setTestResult(null);
    try {
      const res: any = await testWorkspaceIntegration(workspaceId, 'einvoice', { gstin, username, password });
      const d = res?.data ?? res ?? {};
      setTestResult({ ok: true, text: `${t('screens.settingsEinvoice.signedInAs', { defaultValue: 'Signed in as' })} ${d.username} · ${d.gstin}${d.usingSandboxLogin ? ` (${t('screens.settingsEinvoice.sandboxLogin', { defaultValue: 'sandbox test login' })})` : ''}` });
    } catch (e) {
      setTestResult({ ok: false, text: (e as any)?.message || t('screens.settingsEinvoice.loginRejected', { defaultValue: 'The portal did not accept this login' }) });
    } finally {
      setBusy(false);
    }
  };

  const useSandboxLogin = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await saveWorkspaceIntegration(workspaceId, 'einvoice', { provider: 'perione', useSandboxLogin: true });
      setStatus('CONFIGURED');
      setUsesSandboxLogin(true);
      setIsDirty(false);
    } catch (e) {
      toastRbasError(e) || Alert.alert(t('common.error'), t('screens.settingsEinvoice.couldNotSave'));
    } finally {
      setBusy(false);
    }
  };
  const sandbox = gateway?.env === 'sandbox';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>{t('settings.eInvoice')}</Text>
        <View style={{ width: 40 }} />
      </View>
      {loadState === 'loading' ? (
        <LoadingState message={t('screens.settingsEinvoice.loadingSettings')} />
      ) : loadState === 'error' ? (
        <ErrorState
          title={t('screens.settingsEinvoice.loadSettingsFailed')}
          message={t('screens.settingsEinvoice.checkConnection')}
          onRetry={() => { setLoadState('loading'); setReloadKey(k => k + 1); }}
        />
      ) : (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={[s.statusBanner, { backgroundColor: status === 'ACTIVE' ? COLORS.positiveBg : COLORS.warningBg }]}>
            <Text style={{ color: status === 'ACTIVE' ? COLORS.positive : COLORS.warning, fontWeight: '700' }}>
              {t('screens.settingsEinvoice.statusLabel', { status })}
            </Text>
          </View>
          {gateway && (
            <View style={s.card}>
              <View style={s.cardHdr}>
                <Ionicons name="server-outline" size={18} color={COLORS.info} />
                <Text style={s.cardTitle}>{t('screens.settingsEinvoice.gateway', { defaultValue: 'Gateway' })}</Text>
              </View>
              <Text style={s.note}>
                {gateway.provider} · {t(!gateway.configured ? 'screens.settingsEinvoice.gatewayMissing' : sandbox ? 'screens.settingsEinvoice.gatewaySandbox' : 'screens.settingsEinvoice.gatewayLive', { defaultValue: !gateway.configured ? 'not configured on the server' : sandbox ? 'Sandbox' : 'Live' })}
              </Text>
              {sandbox && (
                <Text style={s.note}>
                  {t('screens.settingsEinvoice.sandboxNote', { defaultValue: 'Nothing reaches the real portal; only PeriOne\u2019s test GSTINs are accepted.' })}
                  {gateway.sandboxLogin ? ` ${t('screens.settingsEinvoice.testLogin', { defaultValue: 'Test login' })}: ${gateway.sandboxLogin.username} · ${gateway.sandboxLogin.gstin}.` : ''}
                </Text>
              )}
              {sandbox && gateway.sandboxLogin && (usesSandboxLogin ? (
                <Text style={[s.note, { color: COLORS.positive }]}>{t('screens.settingsEinvoice.usesSandboxLogin', { defaultValue: 'This workspace uses the sandbox test login.' })}</Text>
              ) : (
                <TouchableOpacity onPress={useSandboxLogin} disabled={busy} activeOpacity={0.7}>
                  <Text style={[s.note, { color: COLORS.info, fontWeight: '700' }]}>{t('screens.settingsEinvoice.useSandboxLogin', { defaultValue: 'Use the test login for this workspace' })}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="key-outline" size={18} color={'#7C3AED'} />
              <Text style={s.cardTitle}>{t('screens.settingsEinvoice.credentials')}</Text>
            </View>
            <Text style={s.note}>{t('screens.settingsEinvoice.howTo', { defaultValue: 'On the e-Invoice portal go to API Registration → User Credentials → Create API User, choose "Through GSP", select PeriOne, then enter that API user here.' })}</Text>
            {[
              { l: 'GSTIN', label: t('company.gstin'), v: gstin, set: (v: string) => setGstin(v.toUpperCase()), ph: t('screens.settingsEinvoice.gstinPh'), sec: false },
              { l: 'Username', label: t('screens.settingsEinvoice.username'), v: username, set: setUsername, ph: t('screens.settingsEinvoice.usernamePh'), sec: false },
              { l: 'Password', label: t('screens.settingsEinvoice.password'), v: password, set: setPassword, ph: t('screens.settingsEinvoice.passwordPh'), sec: true },
            ].map((f) => (
              <View key={f.l} style={s.field}>
                <Text style={s.fLabel}>{f.label}</Text>
                <View style={s.fRow}>
                  <TextInput
                    style={s.fInput}
                    value={f.v}
                    onChangeText={(v) => { f.set(v); markDirty(); }}
                    placeholder={f.ph}
                    secureTextEntry={f.sec && !showPass}
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="none"
                  />
                  {f.sec && (
                    <TouchableOpacity onPress={() => setShowPass((p) => !p)} style={s.eyeBtn}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            {testResult && (
              <Text style={[s.note, { color: testResult.ok ? COLORS.positive : COLORS.negative, marginBottom: 0 }]}>{testResult.text}</Text>
            )}
          </View>
          <View style={s.btnRow}>
            <TouchableOpacity style={s.outBtn} onPress={testLogin} disabled={busy || !gateway?.configured} activeOpacity={0.7}>
              <Text style={[s.outTxt, { color: COLORS.info }]}>{t('screens.settingsEinvoice.testLoginBtn', { defaultValue: 'Test login' })}</Text>
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
                <Text style={[s.outTxt, { color: COLORS.info }]}>{t('screens.settingsEinvoice.activate')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={s.portalBtn} onPress={() => Linking.openURL('https://einvoice1.gst.gov.in')} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.portalTxt}>{t('screens.settingsEinvoice.openIrpPortal')}</Text>
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
  statusBanner: { borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
  field: { marginBottom: SPACING.md },
  fLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  fRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  fInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: SPACING.sm },
  outBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.info },
  outTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  primaryBtn: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  portalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  portalTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
});
