/**
 * Settings → E-invoice / E-way bill for the company chosen in the header (spec 2026-11-04 §1, §4.3):
 *   First the question that decides whether the rule applies at all — e-invoice: has turnover crossed ₹5 Cr
 *   (and ₹10 Cr, the 30-day limit), with the estimate from the books; e-way bill: does the business move goods
 *   worth ₹50,000 or more. "No" leaves a short Not applicable state and nothing else.
 *   Otherwise: Generated in TallyPrime | Auditer (PeriOne with the company's portal API user: Configure / Test /
 *   Activate / Remove), Manual or Auto once active, then — e-invoice: what happens to invoices created in Auditer;
 *   e-way bill: the documents Auditer tracks and the limit inside the company's state.
 *   Every change is one partial save of the compliance config. Rates are not shown here (Owner decision 2026-11-03).
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
  saveComplianceConfig, getComplianceConfig, getComplianceTurnover, ApiError,
  type IntegrationCompanyRow, type WorkspaceIntegrationResponse, type ComplianceConfig, type ComplianceTurnover,
} from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { toastRbasError } from '../../utils/rbasErrors';
import { EWB_EXTRA_KINDS, recentTurnoverYears, withDocKind, type EwbExtraKind } from '../../utils/complianceRules';
import { LoadingState, ErrorState } from '../ApiStateViews';
import { BottomModalShell } from '../forms/BottomModalShell';
import FormField from '../forms/FormField';
import BrandSwitch from '../forms/BrandSwitch';
import { SheetFooter } from './ComplianceSheets';
import { StatusChip } from './ComplianceChips';
import { OptionRow, YesNo } from './SettingsOptions';

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

/** Generation settings per domain (same wording as the web portal's Integration pages). */
const GEN = {
  einvoice: {
    prefix: 'e_invoice',
    doc: 'e-invoice',
    modeTitle: 'IRN generation',
    modes: [{ key: 'manual', label: 'Manual' }, { key: 'auto', label: 'Auto after Tally sync' }],
    modeHelp: {
      manual: 'Invoices wait in Reports → E-Invoice → Ready until someone taps Register.',
      auto: 'Every new sales invoice is registered on sync, from today on. 2 credits each, refunded when the portal refuses; failures go to Needs attention.',
    } as Record<string, string>,
    tallyHelp: 'You generate IRNs in TallyPrime. After each sync Auditer shows them under Reports → E-Invoice → Generated, with the acknowledgement and the signed QR; nothing is registered or charged from here.',
    auditerHelp: 'Through PeriOne with this company\u2019s portal API user: save the credentials, activate once, then choose Manual or Auto.',
  },
  eway: {
    prefix: 'e_way_bill',
    doc: 'e-way bill',
    modeTitle: 'E-way bill generation',
    modes: [{ key: 'manual', label: 'Manual' }, { key: 'auto', label: 'Auto when details ready' }, { key: 'ask_after_irn', label: 'Ask after IRN' }],
    modeHelp: {
      manual: 'Invoices wait in Reports → E-Way Bill → Ready until someone taps Generate.',
      auto: 'Generated on sync when the invoice carries dispatch, ship-to and vehicle or transporter details, from today on. 2 credits each, refunded when the portal refuses.',
      ask_after_irn: 'Right after an IRN is registered you are asked whether to generate the e-way bill now.',
    } as Record<string, string>,
    tallyHelp: 'You generate e-way bills in TallyPrime. After each sync Auditer shows them under Reports → E-Way Bill → Generated; Part B, extensions and cancellations are done in Tally.',
    auditerHelp: 'Through PeriOne with this company\u2019s portal API user: save the credentials, activate once, then choose Manual or Auto.',
  },
} as const;

/** Invoices created in Auditer: the two choices of each source (spec §1.1, §2.3). */
const APP_INVOICE_CHOICES = { auditer: ['auto', 'follow_mode'], tally: ['auditer', 'tally'] } as const;

export default function IntegrationSettingsScreen({ domain, title, ns, portalUrl, portalLabel, howTo }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact } = useSettings();
  const { workspaceId, isOwnerOrAdmin: ownerOrAdmin, hasCapability } = useWorkspace();
  const { company: selectedCompany } = useAuth();
  const canConfigure = ownerOrAdmin || hasCapability('integrations.configure');
  const [data, setData] = useState<WorkspaceIntegrationResponse | null>(null);
  const [cfg, setCfg] = useState<ComplianceConfig | null>(null);
  const [turnover, setTurnover] = useState<ComplianceTurnover | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [configRow, setConfigRow] = useState<IntegrationCompanyRow | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [limitDraft, setLimitDraft] = useState<string | null>(null);
  const companyGuid = selectedCompany?.guid || '';

  const load = useCallback(() => {
    if (!workspaceId) return () => {};
    let cancelled = false;
    Promise.all([
      getWorkspaceIntegration(workspaceId, domain),
      companyGuid ? getComplianceConfig(companyGuid).catch(() => null) : Promise.resolve(null),
      companyGuid && domain === 'einvoice' ? getComplianceTurnover(companyGuid).catch(() => null) : Promise.resolve(null),
    ])
      .then(([res, cfgRes, turnoverRes]: any[]) => {
        if (cancelled) return;
        const d: WorkspaceIntegrationResponse = res?.data ?? res ?? {};
        setData(d);
        setCfg(cfgRes?.data ?? null);
        setTurnover(turnoverRes?.data ?? null);
        setLoadState('ready');
      })
      .catch(() => { if (!cancelled) setLoadState('error'); });
    return () => { cancelled = true; };
  }, [workspaceId, domain, companyGuid]);
  useEffect(() => load(), [load, reloadKey]);
  const refetch = () => setReloadKey((k) => k + 1);

  const gateway = data?.gateway || null;
  const sandbox = gateway?.env === 'sandbox';
  const allCompanies: IntegrationCompanyRow[] = Array.isArray(data?.companies) ? data!.companies! : [];
  // Only the company chosen in the header: settings, activation and credentials are per company.
  const companies = allCompanies.filter((c) => !!companyGuid && c.company_guid === companyGuid);

  const idOf = (c: IntegrationCompanyRow) => String(c.company_id);
  // The server computes status from the stored credentials (complianceCredentials.integrationStatus); `secretsSet`
  // is a per-key map, so its presence alone says nothing. Same rule as the web portal.
  const hasCreds = (c: IntegrationCompanyRow) => !!(c.useSandboxLogin || c.config_json?.useSandboxLogin) || String(c.status || 'NOT_CONFIGURED').toUpperCase() !== 'NOT_CONFIGURED';

  const gen = GEN[domain];
  const genOf = (c: IntegrationCompanyRow) => ({
    source: c.compliance?.source === 'tally' ? 'tally' : 'auditer',
    mode: c.compliance?.mode || null,
    autoSince: c.compliance?.auto_since || null,
  });
  /** The answer that decides whether the rule applies: 'yes', 'no' or unanswered (null). */
  const answer: 'yes' | 'no' | null = domain === 'einvoice'
    ? (cfg?.e_invoice_turnover === 'above_5cr' ? 'yes' : cfg?.e_invoice_turnover === 'below_5cr' ? 'no' : null)
    : (cfg?.e_way_bill_moves_goods === true ? 'yes' : cfg?.e_way_bill_moves_goods === false ? 'no' : null);
  // Unanswered keeps an earlier "Not applicable" (the switch the question replaced).
  const notApplicable = (c?: IntegrationCompanyRow) => answer === 'no'
    || (answer === null && (cfg?.[`${gen.prefix}_applicable`] ?? c?.compliance?.applicable) === 'not_applicable');

  // One key (or answer) at a time: partial save on the compliance config, then reload.
  const saveSetting = async (c: IntegrationCompanyRow, patch: Record<string, unknown>, okText?: string) => {
    if (!c.company_guid) return;
    setBusyId(idOf(c));
    try {
      const res: any = await saveComplianceConfig(c.company_guid, patch);
      if (res?.data) setCfg(res.data);
      Toast.show({ type: 'success', text1: t('common.saved'), text2: okText });
      refetch();
    } catch (e) {
      toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || t(`${ns}.settingNotSaved`, { defaultValue: 'Could not save this setting.' }));
    } finally {
      setBusyId(null);
    }
  };
  const setSource = (c: IntegrationCompanyRow, source: 'tally' | 'auditer') => {
    if (source === genOf(c).source) return;
    saveSetting(c, { [`${gen.prefix}_source`]: source }, source === 'tally'
      ? t(`${ns}.sourceTallySaved`, { defaultValue: 'Generated in TallyPrime; Auditer shows what Tally generates.' })
      : t(`${ns}.sourceAuditerSaved`, { defaultValue: 'Generated through Auditer. Save the API user and activate.' }));
  };
  const setMode = (c: IntegrationCompanyRow, mode: string) => {
    if (mode === genOf(c).mode) return;
    saveSetting(c, { [`${gen.prefix}_mode`]: mode }, `${t(`${ns}.modeTitle`, { defaultValue: gen.modeTitle })}: ${t(`${ns}.mode_${mode}`, { defaultValue: gen.modes.find((m) => m.key === mode)?.label || mode })}`);
  };
  const saveLimit = (c: IntegrationCompanyRow, value: number | null) => {
    setLimitDraft(null);
    saveSetting(c, { e_way_bill_intra_limit: value });
  };

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

  // ── The question that decides whether the rule applies ──────────────────────
  const questionCard = (c: IntegrationCompanyRow, busy: boolean) => {
    if (domain === 'eway') {
      return (
        <View style={s.card}>
          <Text style={s.blockTitle}>{t('screens.settingsEwb.movesGoodsQ')}</Text>
          <Text style={s.note}>{t('screens.settingsEwb.movesGoodsHelp')}</Text>
          <YesNo value={cfg?.e_way_bill_moves_goods ?? null} disabled={busy} onChange={(v) => saveSetting(c, { e_way_bill_moves_goods: v })} testID="ewb-moves-goods" />
          {answer === null && <Text style={s.hint}>{t('screens.settingsEinvoice.answerHint')}</Text>}
        </View>
      );
    }
    const years = recentTurnoverYears(turnover?.years);
    const advice = turnover?.advice && turnover.advice.code !== 'NONE' ? turnover.advice.message : null;
    return (
      <View style={s.card}>
        <Text style={s.blockTitle}>{t('screens.settingsEinvoice.requiredTitle')}</Text>
        <Text style={s.question}>{t('screens.settingsEinvoice.turnoverQ')}</Text>
        <YesNo
          value={cfg?.e_invoice_turnover === 'above_5cr' ? true : cfg?.e_invoice_turnover === 'below_5cr' ? false : null}
          disabled={busy}
          onChange={(v) => saveSetting(c, { e_invoice_turnover: v ? 'above_5cr' : 'below_5cr' })}
          testID="einv-turnover"
        />
        {answer === 'yes' && (
          <>
            <Text style={s.question}>{t('screens.settingsEinvoice.aatoQ')}</Text>
            <YesNo value={cfg?.e_invoice_aato_10cr ?? null} disabled={busy} onChange={(v) => saveSetting(c, { e_invoice_aato_10cr: v })} testID="einv-aato" />
            <Text style={s.note}>{t('screens.settingsEinvoice.aatoHelp')}</Text>
          </>
        )}
        {answer === null && <Text style={s.hint}>{t('screens.settingsEinvoice.answerHint')}</Text>}
        {years.length > 0 && (
          <View style={s.estimate} testID="einv-turnover-estimate">
            <Text style={s.estimateTitle}>{t('screens.settingsEinvoice.fromBooks')}</Text>
            {years.map((y) => (
              <View key={y.fy} style={s.estimateRow}>
                <Text style={s.estimateLabel}>{y.complete ? t('screens.settingsEinvoice.fyLabel', { fy: y.fy }) : t('screens.settingsEinvoice.fySoFar', { fy: y.fy })}</Text>
                <Text style={s.estimateValue}>{formatAmountCompact(Number(y.turnover) || 0)}</Text>
              </View>
            ))}
            {!!turnover?.pan && <Text style={s.estimateNote}>{t('screens.settingsEinvoice.panNote', { pan: turnover.pan })}</Text>}
          </View>
        )}
        {!!advice && (
          <View style={[s.warnBox, { marginTop: SPACING.sm }]}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
            <Text style={s.warnTxt}>{advice}</Text>
          </View>
        )}
      </View>
    );
  };

  const notApplicableCard = (
    <View style={s.card} testID="not-applicable-state">
      <View style={s.cardHdr}>
        <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.positive} />
        <Text style={s.cardTitle}>{t('screens.settingsEinvoice.notApplicableTitle')}</Text>
      </View>
      <Text style={[s.note, { marginBottom: 0 }]}>{t(domain === 'einvoice' ? 'screens.settingsEinvoice.notApplicableBody' : 'screens.settingsEwb.notApplicableBody')}</Text>
    </View>
  );

  // ── E-invoice: invoices created in Auditer ──────────────────────────────────
  const appInvoicesCard = (c: IntegrationCompanyRow, busy: boolean) => {
    const source = genOf(c).source as 'tally' | 'auditer';
    const current = cfg?.e_invoice_app_invoices_effective || (source === 'tally' ? 'tally' : 'follow_mode');
    return (
      <View style={s.card}>
        <Text style={s.blockTitle}>{t('screens.settingsEinvoice.appInvTitle')}</Text>
        <Text style={s.note}>{t('screens.settingsEinvoice.appInvSub')}</Text>
        {APP_INVOICE_CHOICES[source].map((key) => (
          <OptionRow
            key={key}
            selected={current === key}
            disabled={busy}
            title={t(`screens.settingsEinvoice.appInv_${key}`)}
            help={t(`screens.settingsEinvoice.appInv_${key}Help`)}
            onPress={() => saveSetting(c, { e_invoice_app_invoices: key })}
            testID={`app-invoices-${key}`}
          />
        ))}
      </View>
    );
  };

  // ── E-way bill: documents tracked and the limit inside the state ────────────
  const docKindsCard = (c: IntegrationCompanyRow, busy: boolean) => {
    const kinds = cfg?.e_way_bill_doc_kinds_effective || [];
    return (
      <View style={s.card}>
        <Text style={s.blockTitle}>{t('screens.settingsEwb.docsTitle')}</Text>
        <Text style={s.note}>{t('screens.settingsEwb.docsHelp')}</Text>
        {EWB_EXTRA_KINDS.map((kind: EwbExtraKind) => (
          <View key={kind} style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchLabel}>{t(`screens.reportsEwbList.kind_${kind}`)}</Text>
              {kind === 'stock_transfer' && <Text style={[s.note, { marginBottom: 0 }]}>{t('screens.settingsEwb.docsStockNote')}</Text>}
            </View>
            <BrandSwitch value={kinds.includes(kind)} disabled={busy} onValueChange={(on: boolean) => saveSetting(c, { e_way_bill_doc_kinds: withDocKind(kinds, kind, on) })} />
          </View>
        ))}
      </View>
    );
  };

  const limitCard = (c: IntegrationCompanyRow, busy: boolean) => {
    const rule = cfg?.e_way_bill_state_rule || null;
    const own = cfg?.e_way_bill_intra_limit != null;
    const effective = Number(cfg?.e_way_bill_intra_limit_effective ?? rule?.intra ?? 50000);
    const draftValid = limitDraft != null && /^\d+$/.test(limitDraft.trim());
    return (
      <View style={s.card}>
        <Text style={s.blockTitle}>{t('screens.settingsEwb.limitTitle', { state: rule?.state || t('screens.settingsEwb.limitStateFallback') })}</Text>
        <View style={s.limitRow}>
          <Text style={s.limitValue}>{formatAmount(effective)}</Text>
          <StatusChip label={own ? t('screens.settingsEwb.limitOwn') : t('screens.settingsEwb.limitDefault')} tone={own ? 'info' : 'muted'} />
        </View>
        {!!rule?.note && <Text style={s.note}>{rule.note}</Text>}
        <Text style={s.note}>{t('screens.settingsEwb.limitAcross', { amount: formatAmount(Number(rule?.inter ?? 50000)) })}</Text>
        {limitDraft == null ? (
          <View style={s.btnRow}>
            <TouchableOpacity style={s.outBtn} onPress={() => setLimitDraft(own ? String(cfg?.e_way_bill_intra_limit ?? '') : '')} disabled={busy} activeOpacity={0.7} testID="ewb-limit-change">
              <Text style={s.outTxt}>{t('screens.settingsEwb.limitChange')}</Text>
            </TouchableOpacity>
            {own && (
              <TouchableOpacity style={s.outBtn} onPress={() => saveLimit(c, null)} disabled={busy} activeOpacity={0.7} testID="ewb-limit-reset">
                <Text style={s.outTxt}>{t('screens.settingsEwb.limitUseDefault')}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <FormField
              label={t('screens.settingsEwb.limitAmount')}
              value={limitDraft}
              onChangeText={(v) => setLimitDraft(v.replace(/\D/g, '').slice(0, 8))}
              keyboardType="numeric"
              placeholder={String(rule?.intra ?? 50000)}
            />
            <View style={s.btnRow}>
              <TouchableOpacity style={s.outBtn} onPress={() => setLimitDraft(null)} activeOpacity={0.7}>
                <Text style={s.outTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.primaryBtn, !draftValid && { opacity: 0.5 }]} onPress={() => draftValid && saveLimit(c, Number(limitDraft))} disabled={busy || !draftValid} activeOpacity={0.8} testID="ewb-limit-save">
                <Text style={s.primaryTxt}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    );
  };

  const anyNotApplicable = companies.some((c) => notApplicable(c));

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
          {gateway && !anyNotApplicable && (
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
            const g = genOf(c);
            const active = st === 'ACTIVE' || !!c.activated_at;
            const ms = (sec: number | string | null | undefined) => (sec ? Number(sec) * (Number(sec) < 1e12 ? 1000 : 1) : NaN);
            return (
              <View key={id}>
                {questionCard(c, busy)}
                {notApplicable(c) ? notApplicableCard : (
                  <>
                    <View style={s.card}>
                      <View style={s.rowHead}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.coName}>{c.name}</Text>
                          <Text style={s.note}>{[g.source === 'auditer' ? (c.config_json?.gstin || c.gstin) : c.gstin, g.source === 'auditer' && c.activated_at ? `${t(`${ns}.activatedOn`, { defaultValue: 'Activated' })} ${new Date(ms(c.activated_at)).toLocaleDateString()}` : ''].filter(Boolean).join(' · ') || ' '}</Text>
                        </View>
                        {g.source === 'auditer' ? statusChip(c) : <StatusChip label={t(`${ns}.sourceTally`, { defaultValue: 'TallyPrime' })} tone="none" />}
                      </View>

                      {/* Generated in: TallyPrime | Auditer */}
                      <Text style={s.fieldLabel}>{t(`${ns}.generatedIn`, { defaultValue: 'Generated in' })}</Text>
                      <View style={s.chips}>
                        {([['tally', t(`${ns}.sourceTally`, { defaultValue: 'TallyPrime' })], ['auditer', t(`${ns}.sourceAuditer`, { defaultValue: 'Auditer' })]] as const).map(([key, label]) => (
                          <TouchableOpacity key={key} style={[s.chip, g.source === key && s.chipActive]} onPress={() => setSource(c, key)} disabled={busy} activeOpacity={0.7}>
                            <Text style={[s.chipTxt, g.source === key && s.chipTxtActive]}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={s.note}>{t(`${ns}.${g.source === 'tally' ? 'tallyHelp' : 'auditerHelp'}`, { defaultValue: g.source === 'tally' ? gen.tallyHelp : gen.auditerHelp })}</Text>

                      {g.source === 'auditer' && (
                        <>
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
                        </>
                      )}
                    </View>

                    {/* Manual / Auto — only once the company is active here. */}
                    {g.source === 'auditer' && active && (
                      <View style={s.card}>
                        <Text style={s.fieldLabel}>{t(`${ns}.modeTitle`, { defaultValue: gen.modeTitle })}</Text>
                        <View style={s.chips}>
                          {gen.modes.map((m) => (
                            <TouchableOpacity key={m.key} style={[s.chip, g.mode === m.key && s.chipActive]} onPress={() => setMode(c, m.key)} disabled={busy} activeOpacity={0.7}>
                              <Text style={[s.chipTxt, g.mode === m.key && s.chipTxtActive]}>{t(`${ns}.mode_${m.key}`, { defaultValue: m.label })}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {g.mode ? (
                          <Text style={s.note}>
                            {t(`${ns}.modeHelp_${g.mode}`, { defaultValue: gen.modeHelp[g.mode] || '' })}
                            {g.mode === 'auto' && g.autoSince ? ` ${t(`${ns}.autoSince`, { defaultValue: 'Auto since' })} ${g.autoSince}.` : ''}
                          </Text>
                        ) : (
                          <View style={s.warnBox}>
                            <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                            <Text style={s.warnTxt}>{t(`${ns}.chooseMode`, { doc: gen.doc, defaultValue: 'Choose how the {{doc}} is generated. Until you pick, nothing is generated on its own: invoices wait in Ready for a tap.' })}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {domain === 'einvoice' && appInvoicesCard(c, busy)}
                    {domain === 'eway' && docKindsCard(c, busy)}
                    {domain === 'eway' && limitCard(c, busy)}
                  </>
                )}
              </View>
            );
          })}

          {!anyNotApplicable && (
            <TouchableOpacity style={s.portalBtn} onPress={() => Linking.openURL(portalUrl)} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
              <Text style={s.portalTxt}>{portalLabel}</Text>
            </TouchableOpacity>
          )}
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
  blockTitle: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  question: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, marginTop: 6, marginBottom: 8, lineHeight: 20 },
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
  hint: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, fontWeight: '600', marginBottom: 4 },
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
  fieldLabel: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginTop: 4, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.borderDefault, backgroundColor: COLORS.cardBg },
  chipActive: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtActive: { color: COLORS.white },
  warnBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md, padding: 10 },
  warnTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
  estimate: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 10, marginTop: SPACING.sm, gap: 4 },
  estimateTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  estimateLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  estimateValue: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  estimateNote: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, lineHeight: 16, marginTop: 2 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  limitValue: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: COLORS.textPrimary },
});
