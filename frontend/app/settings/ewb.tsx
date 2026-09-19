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
import { toastRbasError } from '../../src/utils/rbasErrors';

export default function EWBIntegrationScreen() {
  const router = useRouter();
  const { workspaceId, isOwnerOrAdmin } = useWorkspace();
  const [status, setStatus] = useState('NOT_CONFIGURED');
  const [gstin, setGstin] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const markDirty = () => setIsDirty(true);

  React.useEffect(() => {
    if (!workspaceId) return;
    getWorkspaceIntegration(workspaceId, 'eway')
      .then((res: any) => {
        const d = res?.data ?? res;
        setStatus(d?.status || 'NOT_CONFIGURED');
        const cfg = d?.config_json || d?.config || {};
        if (cfg.gstin) setGstin(cfg.gstin);
        if (cfg.username) setUsername(cfg.username);
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
          <Text style={s.title}>E-Way Bill Integration</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>
            Only the Workspace Owner or Admin can configure E-Way Bill integration.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const save = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await saveWorkspaceIntegration(workspaceId, 'eway', {
        gstin, username, password, client_id: clientId, client_secret: secret,
      });
      setStatus('CONFIGURED');
      setIsDirty(false);
      Alert.alert('Saved', 'E-Way Bill settings saved for this Workspace.');
    } catch (e) {
      toastRbasError(e) || Alert.alert('Error', 'Could not save credentials.');
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
      Alert.alert('Activated', 'E-Way Bill is active for this Workspace.');
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'BILLING_INSUFFICIENT_CREDITS' || e.code === 'INSUFFICIENT_CREDITS' || e.code === 'MIXED_FUNDING_PRIORITY_UNDEFINED' || e.code === 'SPLIT_FUNDING_RULE_UNDEFINED')) {
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

  const Field = ({
    label, value, set, secure, placeholder,
  }: { label: string; value: string; set: (v: string) => void; secure?: boolean; placeholder: string }) => (
    <View style={s.field}>
      <Text style={s.fLabel}>{label}</Text>
      <View style={s.fRow}>
        <TextInput
          style={s.fInput}
          value={value}
          onChangeText={(v) => { set(v); markDirty(); }}
          placeholder={placeholder}
          secureTextEntry={secure && !showPass}
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPass((p) => !p)} style={s.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.title}>E-Way Bill Integration</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={[s.statusBanner, { backgroundColor: status === 'ACTIVE' ? COLORS.positiveBg : COLORS.negativeBg }]}>
            <View style={[s.statusDot, { backgroundColor: status === 'ACTIVE' ? COLORS.positive : COLORS.negative }]} />
            <Text style={[s.statusTxt, { color: status === 'ACTIVE' ? COLORS.positive : COLORS.negative }]}>
              {status === 'ACTIVE' ? 'Active for Workspace' : `Status: ${status}`}
            </Text>
          </View>
          <View style={s.card}>
            <View style={s.cardHdr}>
              <Ionicons name="key-outline" size={18} color={COLORS.info} />
              <Text style={s.cardTitle}>Credentials</Text>
            </View>
            <Text style={s.portalRow}>Portal: ewaybillgst.gov.in</Text>
            <Field label="GSTIN" value={gstin} set={(v) => setGstin(v.toUpperCase())} placeholder="15-digit GSTIN" />
            <Field label="Username" value={username} set={setUsername} placeholder="Portal username" />
            <Field label="Password" value={password} set={setPassword} secure placeholder="Portal password" />
            <Field label="Client ID" value={clientId} set={setClientId} placeholder="API Client ID" />
            <Field label="Client Secret" value={secret} set={setSecret} secure placeholder="API Client Secret" />
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
          <TouchableOpacity style={s.portalBtn} onPress={() => Linking.openURL('https://ewaybillgst.gov.in')} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.portalTxt}>Open E-Way Bill Portal</Text>
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
