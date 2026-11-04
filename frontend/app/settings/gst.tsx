/**
 * Settings → GST for the company chosen in the header (spec 2026-11-04 §1.3, §3.2, §4.3).
 * Connection to the GST portal (username, the steps to switch on API access, OTP, "Keep connected for"
 * 1–30 days, Disconnect) and the behaviour choices: how Auditer handles returns, IMS decisions, GST
 * deposits and Tally (with the two ledgers), filing frequency. Every choice is one partial save.
 * Filing itself stays on the web. Server without GST credentials (503 GST_NOT_CONFIGURED or
 * configured_on_server false): one notice, controls disabled.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import {
  getGstConfig, saveGstConfig, requestGstConnectOtp, verifyGstConnectOtp, disconnectGst, getLedgers, getBankLedgers,
  isGstNotConfigured, type GstConfig,
} from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useSettings } from '../../src/context/SettingsContext';
import { toastRbasError } from '../../src/utils/rbasErrors';
import { LoadingState, ErrorState } from '../../src/components/ApiStateViews';
import { BottomModalShell } from '../../src/components/forms/BottomModalShell';
import FormField from '../../src/components/forms/FormField';
import BottomSheetSearch, { type BSSOption } from '../../src/components/forms/BottomSheetSearch';
import { SheetFooter } from '../../src/components/compliance/ComplianceSheets';
import { StatusChip } from '../../src/components/compliance/ComplianceChips';
import { ComplianceCallout } from '../../src/components/compliance/ComplianceCallouts';
import { OptionRow } from '../../src/components/compliance/SettingsOptions';
import { eventDate } from '../../src/components/compliance/complianceShared';
import { localIsoDay } from '../../src/utils/complianceRules';

const RETURNS_MODES = ['prepare', 'draft', 'file'] as const;
const IMS_MODES = ['decide', 'view'] as const;
const DEPOSIT_MODES = ['show', 'button', 'auto'] as const;
const FREQUENCIES = [['', 'freqPortal'], ['monthly', 'freqMonthly'], ['quarterly', 'freqQuarterly']] as const;

/** What the screen shows before the server answers (and while GST is not set up there). */
const DEFAULTS: GstConfig = {
  returns_mode: 'prepare', ims_mode: 'view', deposit_posting: 'show', deposit_debit_ledger: null, deposit_bank_ledger: null,
  filing_frequency: null, username: null, gstin: null, connection: { status: 'not_connected' },
};

export default function GstSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { formatDate } = useSettings();
  const { company } = useAuth();
  const { isOwnerOrAdmin, hasCapability } = useWorkspace();
  const canConfigure = isOwnerOrAdmin || hasCapability('integrations.configure');
  const companyGuid = company?.guid || '';
  const [cfg, setCfg] = useState<GstConfig>(DEFAULTS);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [notConfigured, setNotConfigured] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [ledgerOptions, setLedgerOptions] = useState<{ guid: string; debit: BSSOption[]; bank: BSSOption[] } | null>(null);

  useEffect(() => {
    if (!companyGuid || !canConfigure) return;
    let cancelled = false;
    getGstConfig(companyGuid)
      .then((res: any) => {
        if (cancelled) return;
        const d: GstConfig = { ...DEFAULTS, ...(res?.data ?? {}) };
        setCfg(d);
        setUsername(String(d.username || ''));
        setNotConfigured(d.configured_on_server === false);
        setLoadState('ready');
      })
      .catch((e) => {
        if (cancelled) return;
        if (isGstNotConfigured(e)) {
          setNotConfigured(true);
          setLoadState('ready');
        } else {
          setLoadState('error');
        }
      });
    return () => { cancelled = true; };
  }, [companyGuid, canConfigure, reloadKey]);
  const refetch = () => setReloadKey((k) => k + 1);

  // Ledger pickers only when deposits are posted to Tally.
  const posting = cfg.deposit_posting === 'button' || cfg.deposit_posting === 'auto';
  const ledgersLoaded = ledgerOptions?.guid === companyGuid;
  useEffect(() => {
    if (!posting || !companyGuid || ledgersLoaded) return;
    let cancelled = false;
    Promise.all([getLedgers(companyGuid, { limit: '2000' }).catch(() => null), getBankLedgers(companyGuid, 'bank').catch(() => null)])
      .then(([all, banks]: any[]) => {
        if (cancelled) return;
        const names = (res: any) => [...new Set<string>((res?.data ?? []).map((r: any) => String(r?.name || '')).filter(Boolean))];
        setLedgerOptions({
          guid: companyGuid,
          debit: names(all).map((n) => ({ label: n, value: n })),
          bank: names(banks).map((n) => ({ label: n, value: n })),
        });
      });
    return () => { cancelled = true; };
  }, [posting, companyGuid, ledgersLoaded]);

  const disabled = notConfigured || !!busyKey;

  const save = async (patch: Partial<GstConfig>, key: string) => {
    if (!companyGuid || notConfigured) return;
    setBusyKey(key);
    try {
      const res: any = await saveGstConfig(companyGuid, patch);
      setCfg((c) => ({ ...c, ...patch, ...(res?.data ?? {}) }));
      Toast.show({ type: 'success', text1: t('common.saved') });
    } catch (e) {
      if (isGstNotConfigured(e)) setNotConfigured(true);
      else toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t('screens.settingsGst.saveFailed'));
    } finally {
      setBusyKey(null);
    }
  };

  const sendOtp = async () => {
    if (!companyGuid || !username.trim()) return;
    setBusyKey('connect');
    try {
      await requestGstConnectOtp(companyGuid, username.trim());
      setOtpOpen(true);
      Toast.show({ type: 'success', text1: t('screens.settingsGst.otpSent') });
    } catch (e) {
      if (isGstNotConfigured(e)) setNotConfigured(true);
      else toastRbasError(e) || Alert.alert(t('screens.settingsGst.connectFailed'), (e as any)?.message || '');
    } finally {
      setBusyKey(null);
    }
  };

  const disconnect = () => {
    Alert.alert(t('screens.settingsGst.disconnectTitle'), t('screens.settingsGst.disconnectMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('screens.settingsGst.disconnect'),
        style: 'destructive',
        onPress: async () => {
          setBusyKey('disconnect');
          try {
            const res: any = await disconnectGst(companyGuid);
            setCfg((c) => ({ ...c, connection: res?.data?.connection ?? { status: 'not_connected' } }));
          } catch (e) {
            toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || '');
          } finally {
            setBusyKey(null);
          }
        },
      },
    ]);
  };

  const header = (
    <View style={s.hdr}>
      <TouchableOpacity onPress={() => router.back()} style={s.back}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={s.title}>{t('settings.gst')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!canConfigure || !companyGuid) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        {header}
        <View style={{ padding: 24 }}>
          <Text style={{ color: COLORS.textSecondary, lineHeight: 22 }}>{t(canConfigure ? 'screens.settingsGst.selectCompany' : 'common.ownerAdminOnly')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const conn = cfg.connection || { status: 'not_connected' };
  const connected = conn.status === 'connected';
  const until = eventDate(conn.expires_at);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {header}
      {loadState === 'loading' ? (
        <LoadingState />
      ) : loadState === 'error' ? (
        <ErrorState title={t('screens.settingsGst.loadFailed')} message={t('screens.settingsEinvoice.checkConnection')} onRetry={() => { setLoadState('loading'); refetch(); }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}>
          {notConfigured && (
            <View style={{ marginBottom: SPACING.md, marginTop: -SPACING.sm }}>
              <ComplianceCallout testID="gst-not-configured" icon="information-circle-outline" tone="info" text={t('screens.settingsGst.notConfigured')} />
            </View>
          )}
          {!notConfigured && cfg.read_only === true && (
            <View style={{ marginBottom: SPACING.md, marginTop: -SPACING.sm }}>
              <ComplianceCallout testID="gst-read-only" icon="eye-outline" tone="info" text={t('screens.settingsGst.readOnly')} />
            </View>
          )}

          {/* Connection to the GST portal */}
          <View style={s.card}>
            <View style={s.rowHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{t('screens.settingsGst.connection')}</Text>
                {!!(cfg.gstin || company?.gstin) && <Text style={s.note}>{t('company.gstin')} {cfg.gstin || company?.gstin}</Text>}
              </View>
              <StatusChip
                label={connected ? t('screens.settingsGst.statusConnected') : conn.status === 'expired' ? t('screens.settingsGst.statusExpired') : t('screens.settingsGst.statusNotConnected')}
                tone={connected ? 'generated' : conn.status === 'expired' ? 'failed' : 'none'}
                testID="gst-connection-status"
              />
            </View>
            {connected ? (
              <>
                {!!until && <Text style={s.note}>{t('screens.settingsGst.connectedUntil', { date: formatDate(localIsoDay(until)) })}</Text>}
                <TouchableOpacity style={s.outBtn} onPress={disconnect} disabled={disabled} activeOpacity={0.7} testID="gst-disconnect">
                  {busyKey === 'disconnect' ? <ActivityIndicator size="small" color={COLORS.negative} /> : <Text style={[s.outTxt, { color: COLORS.negative }]}>{t('screens.settingsGst.disconnect')}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.steps}>
                  <Text style={s.stepsTitle}>{t('screens.settingsGst.stepsTitle')}</Text>
                  {(['step1', 'step2', 'step3'] as const).map((k, i) => (
                    <View key={k} style={s.stepRow}>
                      <Text style={s.stepNo}>{i + 1}</Text>
                      <Text style={s.stepTxt}>{t(`screens.settingsGst.${k}`)}</Text>
                    </View>
                  ))}
                </View>
                <FormField
                  label={t('screens.settingsGst.username')}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!notConfigured}
                  placeholder={t('screens.settingsGst.usernamePh')}
                />
                <TouchableOpacity style={[s.primaryBtn, (disabled || !username.trim()) && { opacity: 0.5 }]} onPress={sendOtp} disabled={disabled || !username.trim()} activeOpacity={0.85} testID="gst-connect">
                  {busyKey === 'connect' ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={s.primaryTxt}>{t('screens.settingsGst.connect')}</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* How Auditer handles GST returns */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('screens.settingsGst.returnsTitle')}</Text>
            <Text style={s.note}>{t('screens.settingsGst.returnsSub')}</Text>
            {RETURNS_MODES.map((m) => (
              <OptionRow key={m} selected={cfg.returns_mode === m} disabled={disabled} title={t(`screens.settingsGst.returns_${m}`)} help={t(`screens.settingsGst.returns_${m}Help`)} onPress={() => save({ returns_mode: m }, 'returns')} testID={`gst-returns-${m}`} />
            ))}
          </View>

          {/* Supplier invoices (IMS) */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('screens.settingsGst.imsTitle')}</Text>
            {IMS_MODES.map((m) => (
              <OptionRow key={m} selected={cfg.ims_mode === m} disabled={disabled} title={t(`screens.settingsGst.ims_${m}`)} help={t(`screens.settingsGst.ims_${m}Help`)} onPress={() => save({ ims_mode: m }, 'ims')} testID={`gst-ims-${m}`} />
            ))}
          </View>

          {/* GST deposits and Tally */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('screens.settingsGst.depositsTitle')}</Text>
            {DEPOSIT_MODES.map((m) => (
              <OptionRow key={m} selected={cfg.deposit_posting === m} disabled={disabled} title={t(`screens.settingsGst.deposit_${m}`)} help={t(`screens.settingsGst.deposit_${m}Help`)} onPress={() => save({ deposit_posting: m }, 'deposits')} testID={`gst-deposit-${m}`} />
            ))}
            {posting && (
              <>
                <BottomSheetSearch
                  label={t('screens.settingsGst.debitLedger')}
                  required
                  value={cfg.deposit_debit_ledger || ''}
                  options={ledgersLoaded ? ledgerOptions!.debit : []}
                  onSelect={(o) => save({ deposit_debit_ledger: o.value }, 'debit')}
                  placeholder={t('screens.settingsGst.selectLedger')}
                  sheetTitle={t('screens.settingsGst.debitLedger')}
                  disabled={disabled}
                />
                <BottomSheetSearch
                  label={t('screens.settingsGst.bankLedger')}
                  required
                  value={cfg.deposit_bank_ledger || ''}
                  options={ledgersLoaded ? ledgerOptions!.bank : []}
                  onSelect={(o) => save({ deposit_bank_ledger: o.value }, 'bank')}
                  placeholder={t('screens.settingsGst.selectLedger')}
                  sheetTitle={t('screens.settingsGst.bankLedger')}
                  disabled={disabled}
                />
                {(!cfg.deposit_debit_ledger || !cfg.deposit_bank_ledger) && <Text style={s.warnLine}>{t('screens.settingsGst.ledgersNeeded')}</Text>}
              </>
            )}
          </View>

          {/* Filing frequency */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('screens.settingsGst.frequencyTitle')}</Text>
            <View style={s.chips}>
              {FREQUENCIES.map(([value, key]) => {
                const on = (cfg.filing_frequency || '') === value;
                return (
                  <TouchableOpacity key={key} style={[s.chip, on && s.chipActive]} onPress={() => { if (!on) save({ filing_frequency: (value || null) as GstConfig['filing_frequency'] }, 'frequency'); }} disabled={disabled} activeOpacity={0.7} testID={`gst-frequency-${value || 'portal'}`}>
                    <Text style={[s.chipTxt, on && s.chipTxtActive]}>{t(`screens.settingsGst.${key}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!cfg.filing_frequency && !!cfg.filing_frequency_effective && (
              <Text style={s.note}>{t('screens.settingsGst.portalSays', { frequency: t(cfg.filing_frequency_effective === 'quarterly' ? 'screens.settingsGst.freqQuarterly' : 'screens.settingsGst.freqMonthly') })}</Text>
            )}
          </View>

          <Text style={s.footNote}>{t('screens.settingsGst.fileOnWeb')}</Text>
        </ScrollView>
      )}

      <OtpSheet
        visible={otpOpen}
        onClose={() => setOtpOpen(false)}
        onResend={sendOtp}
        onVerify={async (otp, days) => {
          try {
            const res: any = await verifyGstConnectOtp(companyGuid, otp, days, username.trim() || undefined);
            setCfg((c) => ({ ...c, username: username.trim(), connection: res?.data?.connection ?? { status: 'connected' } }));
            setOtpOpen(false);
            Toast.show({ type: 'success', text1: t('screens.settingsGst.connected') });
          } catch (e) {
            toastRbasError(e) || Alert.alert(t('screens.settingsGst.connectFailed'), (e as any)?.message || '');
          }
        }}
      />
    </SafeAreaView>
  );
}

/** OTP from the GST portal's registered mobile / email, and how long the connection stays on (1–30 days). */
function OtpSheet({ visible, onClose, onResend, onVerify }: {
  visible: boolean; onClose: () => void; onResend: () => void; onVerify: (otp: string, days: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) setOtp('');
  }
  const valid = /^\d{6}$/.test(otp);
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.settingsGst.otpTitle')}
      footer={<SheetFooter onCancel={onClose} busy={busy} disabled={!valid} confirmLabel={t('screens.settingsGst.connect')} onConfirm={async () => {
        setBusy(true);
        try { await onVerify(otp, days); } finally { setBusy(false); }
      }} />}
    >
      <Text style={s.note}>{t('screens.settingsGst.otpHelp')}</Text>
      <FormField label={t('screens.settingsGst.otp')} required value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} />
      <Text style={s.fieldLabel}>{t('screens.settingsGst.keepConnected')}</Text>
      <View style={s.stepper}>
        <TouchableOpacity style={[s.stepBtn, days <= 1 && { opacity: 0.4 }]} onPress={() => setDays((d) => Math.max(1, d - 1))} disabled={days <= 1} activeOpacity={0.7}>
          <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.stepVal}>{days === 1 ? t('screens.settingsGst.day') : t('screens.settingsGst.days', { count: days })}</Text>
        <TouchableOpacity style={[s.stepBtn, days >= 30 && { opacity: 0.4 }]} onPress={() => setDays((d) => Math.min(30, d + 1))} disabled={days >= 30} activeOpacity={0.7}>
          <Ionicons name="add" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={s.note}>{t('screens.settingsGst.keepConnectedHelp')}</Text>
      <TouchableOpacity onPress={onResend} activeOpacity={0.7} style={{ paddingVertical: 6 }}>
        <Text style={s.link}>{t('screens.settingsGst.resendOtp')}</Text>
      </TouchableOpacity>
    </BottomModalShell>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  scroll: { padding: SPACING.md, paddingBottom: 32 },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  cardTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
  warnLine: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, fontWeight: '600' },
  footNote: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 17, paddingHorizontal: SPACING.md },
  steps: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 10, marginBottom: SPACING.md, gap: 6 },
  stepsTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  stepNo: { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.brandPrimary, color: COLORS.white, fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 18, overflow: 'hidden' },
  stepTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 19 },
  outBtn: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.negative, minWidth: 44, alignItems: 'center' },
  outTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  primaryBtn: { paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  primaryTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
  fieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  stepVal: { minWidth: 90, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  link: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.info },
});
