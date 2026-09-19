import React, { useState } from 'react';
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

const PROVIDERS: DropdownOption[] = [
  { label: 'NIC (Government)', value: 'nic' },
  { label: 'Cygnet', value: 'cygnet' },
  { label: 'Clear (formerly ClearTax)', value: 'clear' },
  { label: 'EY Tax Tech', value: 'ey' },
  { label: 'IRIS Business', value: 'iris' },
  { label: 'Masterindia', value: 'masterindia' },
];

export default function EInvoiceScreen() {
  const router = useRouter();
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
  const markDirty = () => setIsDirty(true);

  React.useEffect(() => {
    if (!workspaceId) return;
    getWorkspaceIntegration(workspaceId, 'einvoice')
      .then((res: any) => {
        const d = res?.data ?? res;
        setStatus(d?.status || 'NOT_CONFIGURED');
        const cfg = d?.config_json || d?.config || {};
        if (cfg.gstin) setGstin(cfg.gstin);
        if (cfg.username) setUsername(cfg.username);
        if (cfg.provider) setProvider(cfg.provider);
        if (cfg.client_id) setClientId(cfg.client_id);
      })
      .catch(() => {});
  }, [workspaceId]);

  if (!isOwnerOrAdmin) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.title}>E-Invoice (IRN)</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>
            Only the Workspace Owner or Admin can configure E-Invoice integration.
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
      Alert.alert('Saved', 'E-Invoice settings saved for this Workspace.');
    } catch (e) {
      toastRbasError(e) || Alert.alert('Error', 'Could not save.');
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
      Alert.alert('Activated', 'E-Invoice is active for this Workspace.');
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'BILLING_INSUFFICIENT_CREDITS' || e.code === 'INSUFFICIENT_CREDITS')) {
        Alert.alert(
          'Insufficient credits',
          'This Workspace does not have enough credits. Please ask the Workspace Owner to recharge from the Web Portal.'
        );
      } else {
        toastRbasError(e) || Alert.alert('Error', (e as any)?.message || 'Activation failed');
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
        <Text style={s.title}>E-Invoice (IRN)</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={[s.statusBanner, { backgroundColor: status === 'ACTIVE' ? COLORS.positiveBg : COLORS.warningBg }]}>
            <Text style={{ color: status === 'ACTIVE' ? COLORS.positive : COLORS.warning, fontWeight: '700' }}>
              Status: {status}
            </Text>
          </View>
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="server-outline" size={18} color={COLORS.info} />
              <Text style={s.cardTitle}>IRP Provider</Text>
            </View>
            <FormDropdown
              label="Provider"
              value={provider}
              options={PROVIDERS}
              onSelect={(o) => { setProvider(o.value); markDirty(); }}
              placeholder="Select IRP"
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="key-outline" size={18} color={'#7C3AED'} />
              <Text style={s.cardTitle}>Credentials</Text>
            </View>
            {[
              { l: 'GSTIN', v: gstin, set: (v: string) => setGstin(v.toUpperCase()), ph: '15-digit GSTIN', sec: false },
              { l: 'Username', v: username, set: setUsername, ph: 'Portal username', sec: false },
              { l: 'Password', v: password, set: setPassword, ph: 'Portal password', sec: true },
              { l: 'Client ID', v: clientId, set: setClientId, ph: 'API Client ID', sec: false },
              { l: 'Client Secret', v: secret, set: setSecret, ph: 'API Client Secret', sec: false },
            ].map((f) => (
              <View key={f.l} style={s.field}>
                <Text style={s.fLabel}>{f.l}</Text>
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
              <TouchableOpacity style={s.primaryBtn} onPress={save} disabled={busy} activeOpacity={0.8}>
                <Text style={s.primaryTxt}>Save</Text>
              </TouchableOpacity>
            )}
            {status !== 'ACTIVE' && (
              <TouchableOpacity style={s.outBtn} onPress={activate} disabled={busy} activeOpacity={0.7}>
                <Text style={[s.outTxt, { color: COLORS.info }]}>Activate</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={s.portalBtn} onPress={() => Linking.openURL('https://einvoice1.gst.gov.in')} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.portalTxt}>Open IRP Portal</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
