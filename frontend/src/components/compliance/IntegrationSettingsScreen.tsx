/**
 * Settings → E-invoice / E-way bill: one row per company in the workspace with
 * Configure / Activate / Remove / Test (spec 2026-11-03 §2.1, §4).
 * Credentials and the one-time activation are per company; the screen shows the company
 * chosen in the header. Rates are not shown here (Owner decision 2026-11-03).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import {
  getWorkspaceIntegration, saveWorkspaceIntegration, activateWorkspaceIntegration, testWorkspaceIntegration, removeWorkspaceIntegration,
  ApiError, type IntegrationCompanyRow, type WorkspaceIntegrationResponse,
} from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { toastRbasError } from '../../utils/rbasErrors';
import { LoadingState, ErrorState } from '../ApiStateViews';
import { BottomModalShell } from '../forms/BottomModalShell';
import FormField from '../forms/FormField';
import BrandSwitch from '../forms/BrandSwitch';
import { SheetFooter } from './ComplianceSheets';
import { StatusChip } from './ComplianceChips';

type Props = {
  /** Server domain key: 'einvoice' | 'eway'. */
  domain: 'einvoice' | 'eway';
  title: string;
  /** i18n namespace: screens.settingsEinvoice | screens.settingsEwb */
  ns: 'screens.settingsEinvoice' | 'screens.settingsEwb';
  portalUrl: string;
  portalLabel: string;
  howTo: string;
};

export default function IntegrationSettingsScreen({ domain, title, ns, portalUrl, portalLabel, howTo }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { workspaceId, isOwnerOrAdmin: ownerOrAdmin, hasCapability } = useWorkspace();
  const { company: selectedCompany } = useAuth();
  const canConfigure = ownerOrAdmin || hasCapability('integrations.configure');
  const [data, setData] = useState<WorkspaceIntegrationResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [configRow, setConfigRow] = useState<IntegrationCompanyRow | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  const load = useCallback(() => {
    if (!workspaceId) return () => {};
    let cancelled = false;
    getWorkspaceIntegration(workspaceId, domain)
      .then((res: any) => {
        if (cancelled) return;
        const d: WorkspaceIntegrationResponse = res?.data ?? res ?? {};
        setData(d);
        setLoadState('ready');
      })
      .catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; };
  }, [workspaceId, domain]);
  useEffect(() => load(), [load, reloadKey]);
  const refetch = () => setReloadKey((k) => k + 1);

  const gateway = data?.gateway || null;
  const sandbox = gateway?.env === 'sandbox';
  const allCompanies: IntegrationCompanyRow[] = Array.isArray(data?.companies) ? data!.companies! : [];
  // Only the company chosen in the header: settings, activation and credentials are per company.
  const companies = allCompanies.filter((c) => !!selectedCompany?.guid && c.company_guid === selectedCompany.guid);

  const idOf = (c: IntegrationCompanyRow) => String(c.company_id);
  // The server computes status from the stored credentials (complianceCredentials.integrationStatus); `secretsSet`
  // is a per-key map, so its presence alone says nothing. Same rule as the web portal.
  const hasCreds = (c: IntegrationCompanyRow) => !!(c.useSandboxLogin || c.config_json?.useSandboxLogin) || String(c.status || 'NOT_CONFIGURED').toUpperCase() !== 'NOT_CONFIGURED';

  const activate = (c: IntegrationCompanyRow) => {
    if (!workspaceId) return;
    Alert.alert(
      t(`${ns}.activate`),
      t(`${ns}.activateConfirmPlain`, { company: c.name, defaultValue: 'The activation fee is charged once from the workspace credits for {{company}}; each generation is charged as it happens.' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(`${ns}.activate`),
          onPress: async () => {
            setBusyId(idOf(c));
            try {
              await activateWorkspaceIntegration(workspaceId, domain, c.company_id);
              Toast.show({ type: 'success', text1: t(`${ns}.activated`), text2: t(`${ns}.activatedFor`, { company: c.name, defaultValue: 'Active for {{company}}.' }) });
              refetch();
            } catch (e) {
              if (e instanceof ApiError && (e.code === 'BILLING_INSUFFICIENT_CREDITS' || e.code === 'INSUFFICIENT_CREDITS' || e.status === 402)) {
                Alert.alert(t(`${ns}.insufficientCredits`), t(`${ns}.insufficientCreditsMsg`));
              } else if (e instanceof ApiError && e.status === 409) {
                Alert.alert(t(`${ns}.activationFailed`), t(`${ns}.configureFirst`, { defaultValue: 'Save the credentials for this company first.' }));
              } else {
                toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t(`${ns}.activationFailed`));
              }
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const remove = (c: IntegrationCompanyRow) => {
    if (!workspaceId) return;
    Alert.alert(
      t(`${ns}.removeTitle`, { defaultValue: 'Remove configuration' }),
      t(`${ns}.removeConfirm`, { defaultValue: 'Credentials are removed; the activation stays paid. Generation stops until new credentials are saved.' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            setBusyId(idOf(c));
            try {
              const res: any = await removeWorkspaceIntegration(workspaceId, domain, c.company_id);
              Toast.show({ type: 'success', text1: t(`${ns}.removed`, { defaultValue: 'Credentials removed' }), text2: res?.message || res?.data?.message || undefined });
              refetch();
            } catch (e) {
              toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t(`${ns}.couldNotRemove`, { defaultValue: 'Could not remove the credentials.' }));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  // Signs in at the portal with the saved credentials and generates nothing.
  const testLogin = async (c: IntegrationCompanyRow) => {
    if (!workspaceId) return;
    setBusyId(idOf(c));
    try {
      const res: any = await testWorkspaceIntegration(workspaceId, domain, { companyId: c.company_id });
      const d = res?.data ?? res ?? {};
      setTestResult((p) => ({ ...p, [idOf(c)]: { ok: true, text: `${t(`${ns}.signedInAs`, { defaultValue: 'Signed in as' })} ${d.username || ''} · ${d.gstin || ''}${d.usingSandboxLogin ? ` (${t(`${ns}.sandboxLogin`, { defaultValue: 'sandbox test login' })})` : ''}` } }));
    } catch (e) {
      setTestResult((p) => ({ ...p, [idOf(c)]: { ok: false, text: (e as any)?.message || t(`${ns}.loginRejected`, { defaultValue: 'The portal did not accept this login' }) } }));
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <View style={s.hdr}>
      <TouchableOpacity onPress={() => router.back()} style={s.back}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={s.title}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!canConfigure) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {header}
        <View style={{ padding: 24 }}>
          <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>{t(ns === 'screens.settingsEinvoice' ? 'screens.settingsEinvoice.onlyOwnerAdmin' : 'screens.settingsEwb.ownerOnly')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusChip = (c: IntegrationCompanyRow) => {
    const st = String(c.status || 'NOT_CONFIGURED').toUpperCase();
    if (st === 'ACTIVE') return <StatusChip label={t(`${ns}.statusActive`, { defaultValue: 'Active' })} tone="generated" />;
    if (st === 'CONFIGURED') return <StatusChip label={t(`${ns}.statusConfigured`, { defaultValue: 'Configured' })} tone="pending" />;
    return <StatusChip label={t(`${ns}.statusNotConfigured`, { defaultValue: 'Not configured' })} tone="none" />;
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {header}
      {loadState === 'loading' ? (
        <LoadingState message={t(`${ns}.loadingSettings`)} />
      ) : loadState === 'error' ? (
        <ErrorState
          title={t(ns === 'screens.settingsEinvoice' ? 'screens.settingsEinvoice.loadSettingsFailed' : 'screens.settingsEwb.loadFailedTitle')}
          message={t(ns === 'screens.settingsEinvoice' ? 'screens.settingsEinvoice.checkConnection' : 'screens.settingsEwb.loadFailedMsg')}
          onRetry={() => { setLoadState('loading'); refetch(); }}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
          {gateway && (
            <View style={s.card}>
              <View style={s.cardHdr}>
                <Ionicons name="server-outline" size={18} color={COLORS.info} />
                <Text style={s.cardTitle}>{t(`${ns}.gateway`, { defaultValue: 'Gateway' })}</Text>
              </View>
              <Text style={s.note}>
                {gateway.provider} · {t(!gateway.configured ? `${ns}.gatewayMissing` : sandbox ? `${ns}.gatewaySandbox` : `${ns}.gatewayLive`, { defaultValue: !gateway.configured ? 'not configured on the server' : sandbox ? 'Sandbox' : 'Live' })}
              </Text>
              {sandbox && (
                <Text style={s.note}>
                  {t(`${ns}.sandboxNote`, { defaultValue: 'Nothing reaches the real portal; only PeriOne\u2019s test GSTINs are accepted.' })}
                  {gateway.sandboxLogin ? ` ${t(`${ns}.testLogin`, { defaultValue: 'Test login' })}: ${gateway.sandboxLogin.username} · ${gateway.sandboxLogin.gstin}.` : ''}
                </Text>
              )}
            </View>
          )}

          <Text style={s.sectionLabel}>{t(`${ns}.thisCompany`, { defaultValue: 'This company' })}</Text>
          {companies.length === 0 && (
            <View style={s.card}><Text style={s.note}>{t(`${ns}.selectCompany`, { defaultValue: 'Select a company from the header; its settings are kept per company.' })}</Text></View>
          )}
          {companies.map((c) => {
            const id = idOf(c);
            const busy = busyId === id;
            const st = String(c.status || 'NOT_CONFIGURED').toUpperCase();
            const creds = hasCreds(c);
            const tr = testResult[id];
            return (
              <View key={id} style={s.card}>
                <View style={s.rowHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.coName}>{c.name}</Text>
                    <Text style={s.note}>{[c.config_json?.gstin || c.gstin, c.activated_at ? `${t(`${ns}.activatedOn`, { defaultValue: 'Activated' })} ${new Date(Number(c.activated_at) || c.activated_at).toLocaleDateString()}` : ''].filter(Boolean).join(' · ') || ' '}</Text>
                  </View>
                  {statusChip(c)}
                </View>
                {!!tr && <Text style={[s.note, { color: tr.ok ? COLORS.positive : COLORS.negative }]}>{tr.text}</Text>}
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.outBtn} onPress={() => setConfigRow(c)} disabled={busy} activeOpacity={0.7}>
                    <Text style={s.outTxt}>{t(`${ns}.configure`, { defaultValue: 'Configure' })}</Text>
                  </TouchableOpacity>
                  {creds && (
                    <TouchableOpacity style={s.outBtn} onPress={() => testLogin(c)} disabled={busy || !gateway?.configured} activeOpacity={0.7}>
                      {busy ? <ActivityIndicator size="small" color={COLORS.info} /> : <Text style={s.outTxt}>{t(`${ns}.testLoginBtn`, { defaultValue: 'Test login' })}</Text>}
                    </TouchableOpacity>
                  )}
                  {st !== 'ACTIVE' && !c.activated_at && creds && (
                    <TouchableOpacity style={s.primaryBtn} onPress={() => activate(c)} disabled={busy} activeOpacity={0.8}>
                      <Text style={s.primaryTxt}>{t(`${ns}.activate`)}</Text>
                    </TouchableOpacity>
                  )}
                  {creds && (
                    <TouchableOpacity style={s.iconBtn} onPress={() => remove(c)} disabled={busy} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.negative} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={s.portalBtn} onPress={() => Linking.openURL(portalUrl)} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
            <Text style={s.portalTxt}>{portalLabel}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {configRow && workspaceId && (
        <ConfigureSheet
          ns={ns}
          row={configRow}
          howTo={howTo}
          sandboxAvailable={!!(sandbox && gateway?.sandboxLogin)}
          onClose={() => setConfigRow(null)}
          onSave={async (body) => {
            try {
              await saveWorkspaceIntegration(workspaceId, domain, { companyId: configRow.company_id, provider: 'perione', ...body });
              Toast.show({ type: 'success', text1: t('common.saved'), text2: t(`${ns}.savedFor`, { company: configRow.name, defaultValue: 'Credentials saved for {{company}}.' }) });
              setConfigRow(null);
              refetch();
            } catch (e) {
              toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t(ns === 'screens.settingsEinvoice' ? 'screens.settingsEinvoice.couldNotSave' : 'screens.settingsEwb.saveFailed'));
            }
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ConfigureSheet({ ns, row, howTo, sandboxAvailable, onClose, onSave }: {
  ns: Props['ns']; row: IntegrationCompanyRow; howTo: string; sandboxAvailable: boolean; onClose: () => void;
  onSave: (body: { gstin?: string; username?: string; password?: string; useSandboxLogin?: boolean }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [gstin, setGstin] = useState(String(row.config_json?.gstin || row.gstin || ''));
  const [username, setUsername] = useState(String(row.config_json?.username || ''));
  const [password, setPassword] = useState('');
  const [useSandbox, setUseSandbox] = useState(!!(row.useSandboxLogin || row.config_json?.useSandboxLogin));
  const [busy, setBusy] = useState(false);
  const valid = useSandbox || (gstin.trim().length === 15 && username.trim() && password);
  return (
    <BottomModalShell
      visible
      onClose={onClose}
      title={t(`${ns}.configureTitle`, { company: row.name, defaultValue: 'Configure {{company}}' })}
      footer={<SheetFooter onCancel={onClose} busy={busy} disabled={!valid} confirmLabel={t('common.save')} onConfirm={async () => {
        setBusy(true);
        try {
          await onSave(useSandbox ? { useSandboxLogin: true } : { gstin: gstin.trim().toUpperCase(), username: username.trim(), password, useSandboxLogin: false });
        } finally { setBusy(false); }
      }} />}
    >
      <Text style={s.note}>{howTo}</Text>
      {sandboxAvailable && (
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.switchLabel}>{t(`${ns}.useTestLogin`, { defaultValue: 'Use test login' })}</Text>
            <Text style={s.note}>{t(`${ns}.useTestLoginSub`, { defaultValue: 'Sandbox only: PeriOne\u2019s test GSTIN signs in instead of yours.' })}</Text>
          </View>
          <BrandSwitch value={useSandbox} onValueChange={setUseSandbox} />
        </View>
      )}
      {!useSandbox && (
        <>
          <FormField label={t('company.gstin')} required value={gstin} onChangeText={(v) => setGstin(v.toUpperCase())} placeholder={t(`${ns}.gstinPh`)} autoCapitalize="characters" maxLength={15} />
          <FormField label={t(`${ns}.apiUsername`, { defaultValue: 'API username' })} required value={username} onChangeText={setUsername} placeholder={t(`${ns}.usernamePh`)} autoCapitalize="none" />
          <FormField label={t(`${ns}.password`)} required value={password} onChangeText={setPassword} placeholder={t(`${ns}.passwordPh`)} secureTextEntry autoCapitalize="none" />
        </>
      )}
    </BottomModalShell>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: 32 },
  sectionLabel: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm, marginLeft: 4 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  coName: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  outBtn: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.info, alignItems: 'center', justifyContent: 'center', minWidth: 44 },
  outTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  primaryBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  portalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault },
  portalTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, marginBottom: SPACING.sm },
  switchLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 2 },
});
