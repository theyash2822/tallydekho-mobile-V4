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
  ApiError,
} from '../../src/services/api';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import FormDropdown, { DropdownOption } from '../../src/components/forms/FormDropdown';
import { toastRbasError } from '../../src/utils/rbasErrors';
import { LoadingState, ErrorState } from '../../src/components/ApiStateViews';

const PROVIDERS: (DropdownOption & { labelKey?: string })[] = [
  { label: 'NIC (Government)', labelKey: 'screens.settingsEinvoice.providerNic', value: 'nic' },
  { label: 'Cygnet', value: 'cygnet' },
  { label: 'Clear (formerly ClearTax)', labelKey: 'screens.settingsEinvoice.providerClear', value: 'clear' },
  { label: 'EY Tax Tech', value: 'ey' },
  { label: 'IRIS Business', value: 'iris' },
  { label: 'Masterindia', value: 'masterindia' },
];

export default function EInvoiceScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaceId, isOwnerOrAdmin } = useWorkspace();
  const [provider, setProvider] = useState('nic');
  const [isDirty, setIsDirty] = useState(false);
  const [status, setStatus] = useState('NOT_CONFIGURED');
  const [gstin, setGstin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
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
        if (cfg.provider) setProvider(cfg.provider);
        if (cfg.client_id) setClientId(cfg.client_id);
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
      await saveWorkspaceIntegration(workspaceId, 'einvoice', {
        gstin, username, password, client_id: clientId, client_secret: secret, provider,
      });
      setStatus('CONFIGURED');
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
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="server-outline" size={18} color={COLORS.info} />
              <Text style={s.cardTitle}>{t('screens.settingsEinvoice.irpProvider')}</Text>
            </View>
            <FormDropdown
              label={t('screens.settingsEinvoice.provider')}
              value={provider}
              options={PROVIDERS.map(p => (p.labelKey ? { label: t(p.labelKey), value: p.value } : p))}
              onSelect={(o) => { setProvider(o.value); markDirty(); }}
              placeholder={t('screens.settingsEinvoice.selectIrp')}
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="key-outline" size={18} color={'#7C3AED'} />
              <Text style={s.cardTitle}>{t('screens.settingsEinvoice.credentials')}</Text>
            </View>
            {[
              { l: 'GSTIN', label: t('company.gstin'), v: gstin, set: (v: string) => setGstin(v.toUpperCase()), ph: t('screens.settingsEinvoice.gstinPh'), sec: false },
              { l: 'Username', label: t('screens.settingsEinvoice.username'), v: username, set: setUsername, ph: t('screens.settingsEinvoice.usernamePh'), sec: false },
              { l: 'Password', label: t('screens.settingsEinvoice.password'), v: password, set: setPassword, ph: t('screens.settingsEinvoice.passwordPh'), sec: true },
              { l: 'Client ID', label: t('screens.settingsEinvoice.clientId'), v: clientId, set: setClientId, ph: t('screens.settingsEinvoice.clientIdPh'), sec: false },
              { l: 'Client Secret', label: t('screens.settingsEinvoice.clientSecret'), v: secret, set: setSecret, ph: t('screens.settingsEinvoice.clientSecretPh'), sec: false },
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
