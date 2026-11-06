/**
 * GST on PeriOne for Reports → GST (spec 2026-11-04 §3.2, §4.3): an Overview card (portal connection, the
 * due dates with their status, the compliance score) and two sheets — supplier invoices in IMS, every section
 * with a chip per section (Accept / Reject / Keep pending when Settings → GST lets Auditer decide), and GST
 * deposits with their posting state (Post to Tally, or Post again after a failed posting). Two entries open the
 * invoices as the portal holds them, matched to the books (app/reports/gst-portal.tsx). Filing GSTR-1 /
 * GSTR-3B stays on the web. A server without GST credentials (503 GST_NOT_CONFIGURED) leaves one line.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import {
  getGstOverview, getGstIms, saveGstImsActions, getGstDeposits, postGstDeposit, isGstNotConfigured,
  type GstOverview, type GstImsRow, type GstImsAction, type GstDeposit,
} from '../../services/api';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSettings } from '../../context/SettingsContext';
import { safePush } from '../../utils/safeNavigation';
import { toastRbasError } from '../../utils/rbasErrors';
import {
  calendarChip, cashBalanceTotal, depositPostStatus, depositStatusAfterPost, gstPeriodLabel, gstPeriodOf, imsSections, localIsoDay,
  pickCalendarRows, previousGstPeriod, shiftGstPeriod, type ImsSection,
} from '../../utils/complianceRules';
import { gstPortalRoute, type GstPortalKind } from '../../utils/gstPortal';
import { BottomModalShell } from '../forms/BottomModalShell';
import { StatusChip } from './ComplianceChips';
import { eventDate } from './complianceShared';

export function GstOverviewSection({ companyGuid, initialSheet, fyRange, onOverview }: {
  companyGuid: string;
  /** Deep link (`?tab=ims|deposits`): open that sheet once. */
  initialSheet?: string;
  fyRange: { from?: string; to?: string };
  /** The overview once it loaded; null while loading, when GST is not set up on the server, or after a failure. */
  onOverview?: (overview: GstOverview | null) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { formatAmount, formatDate } = useSettings();
  const { isOwnerOrAdmin, hasCapability } = useWorkspace();
  const canConfigure = isOwnerOrAdmin || hasCapability('integrations.configure');
  const [overview, setOverview] = useState<GstOverview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_configured' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [showParts, setShowParts] = useState(false);
  const [sheet, setSheet] = useState<'ims' | 'deposits' | null>(initialSheet === 'ims' || initialSheet === 'deposits' ? initialSheet : null);

  useEffect(() => {
    if (!companyGuid) return;
    let cancelled = false;
    getGstOverview(companyGuid)
      .then((res: any) => {
        if (cancelled) return;
        setOverview(res?.data ?? {});
        setState('ready');
      })
      .catch((e) => { if (!cancelled) setState(isGstNotConfigured(e) ? 'not_configured' : 'error'); });
    return () => { cancelled = true; };
  }, [companyGuid, reloadKey]);

  useEffect(() => {
    onOverview?.(state === 'ready' ? overview : null);
  }, [state, overview, onOverview]);

  const openPortal = (kind: GstPortalKind) => safePush(router, gstPortalRoute(kind, { frequency: overview?.frequency }) as any);

  if (state === 'not_configured') {
    return (
      <View style={st.slimCard} testID="gst-overview-not-configured">
        <Ionicons name="information-circle-outline" size={16} color={COLORS.textTertiary} />
        <Text style={st.slimTxt}>{t('screens.reportsGst.notConfigured')}</Text>
      </View>
    );
  }
  if (state === 'error') {
    return (
      <TouchableOpacity style={st.slimCard} onPress={() => { setState('loading'); setReloadKey((k) => k + 1); }} activeOpacity={0.7}>
        <Ionicons name="refresh-outline" size={16} color={COLORS.negative} />
        <Text style={[st.slimTxt, { color: COLORS.negative }]}>{t('screens.reportsGst.overviewFailed')}</Text>
      </TouchableOpacity>
    );
  }

  const conn = overview?.connection || null;
  const connected = conn?.status === 'connected';
  const until = eventDate(conn?.expires_at);
  const calendar = pickCalendarRows(overview?.calendar);
  const score = overview?.score?.score;
  const parts = (overview?.score?.parts || []).filter((p) => p.value != null);
  const cash = cashBalanceTotal(overview?.cash_balance);
  const lastDeposit = overview?.last_deposit && typeof overview.last_deposit === 'object' ? overview.last_deposit : null;

  return (
    <View style={st.card} testID="gst-overview">
      <View style={st.rowHead}>
        <Text style={st.title}>{t('screens.reportsGst.overviewTitle')}</Text>
        {state === 'loading' ? <ActivityIndicator size="small" color={COLORS.textTertiary} /> : (
          <StatusChip
            label={connected ? t('screens.settingsGst.statusConnected') : conn?.status === 'expired' ? t('screens.settingsGst.statusExpired') : t('screens.settingsGst.statusNotConnected')}
            tone={connected ? 'generated' : conn?.status === 'expired' ? 'failed' : 'none'}
          />
        )}
      </View>
      {overview?.configured_on_server === false && <Text style={st.meta}>{t('screens.reportsGst.notConfigured')}</Text>}
      {overview?.read_only === true && overview?.configured_on_server !== false && <Text style={st.meta} testID="gst-read-only">{t('screens.settingsGst.readOnly')}</Text>}
      {connected && !!until && <Text style={st.meta}>{t('screens.settingsGst.connectedUntil', { date: formatDate(localIsoDay(until)) })}</Text>}
      {state === 'ready' && !connected && canConfigure && overview?.configured_on_server !== false && (
        <TouchableOpacity onPress={() => safePush(router, '/settings/gst' as any)} activeOpacity={0.7} testID="gst-connect-link">
          <Text style={st.link}>{t('screens.reportsGst.connectInSettings')}</Text>
        </TouchableOpacity>
      )}

      {calendar.length > 0 && (
        <>
          <Text style={st.section}>{t('screens.reportsGst.dueDates')}</Text>
          {calendar.map((r) => {
            const chip = calendarChip(r);
            return (
              <View key={`${r.form}-${r.period}`} style={st.dueRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.dueForm}>{[r.form, r.period_label || gstPeriodLabel(String(r.period || ''))].filter(Boolean).join(' · ')}</Text>
                  <Text style={st.meta}>{r.status === 'filed' && r.filed_on ? t('screens.reportsGst.filedOn', { date: formatDate(String(r.filed_on)) }) : t('screens.reportsGst.dueOn', { date: formatDate(String(r.due_date || '')) })}</Text>
                </View>
                <StatusChip label={t(`screens.reportsGst.status_${chip.label}`)} tone={chip.tone} />
              </View>
            );
          })}
        </>
      )}

      {score != null && (
        <TouchableOpacity style={st.scoreRow} onPress={() => setShowParts((v) => !v)} activeOpacity={0.75} disabled={!parts.length} testID="gst-score">
          <Text style={st.scoreLabel}>{t('screens.reportsGst.score')}</Text>
          <Text style={st.scoreVal}>{t('screens.reportsGst.scoreOutOf', { score: Math.round(Number(score)) })}</Text>
          {parts.length > 0 && <Ionicons name={showParts ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textSecondary} />}
        </TouchableOpacity>
      )}
      {showParts && parts.map((p) => (
        <View key={p.key} style={st.partRow}>
          <Text style={st.partLabel}>{p.label}</Text>
          <Text style={st.partVal}>{Math.round(Number(p.value) * 100)}%</Text>
        </View>
      ))}

      <TouchableOpacity style={st.navRow} onPress={() => setSheet('ims')} activeOpacity={0.7} testID="gst-open-ims">
        <Ionicons name="file-tray-full-outline" size={17} color={COLORS.textSecondary} />
        <Text style={st.navTxt}>{t('screens.settingsGst.imsTitle')}</Text>
        <Ionicons name="chevron-forward" size={15} color={COLORS.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity style={st.navRow} onPress={() => setSheet('deposits')} activeOpacity={0.7} testID="gst-open-deposits">
        <Ionicons name="wallet-outline" size={17} color={COLORS.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={st.navTxt}>{t('screens.reportsGst.deposits')}</Text>
          {cash != null && <Text style={st.meta}>{t('screens.reportsGst.cashBalance', { amount: formatAmount(cash) })}</Text>}
          {!!lastDeposit?.amount && <Text style={st.meta}>{t('screens.reportsGst.lastDeposit', { amount: formatAmount(Number(lastDeposit.amount) || 0), date: formatDate(String(lastDeposit.date || '')) })}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={15} color={COLORS.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity style={st.navRow} onPress={() => openPortal('sales')} activeOpacity={0.7} testID="gst-open-portal-sales">
        <Ionicons name="cloud-upload-outline" size={17} color={COLORS.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={st.navTxt}>{t('screens.gstPortal.salesEntry')}</Text>
          <Text style={st.meta}>{t('screens.gstPortal.entrySub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={COLORS.textTertiary} />
      </TouchableOpacity>
      <TouchableOpacity style={st.navRow} onPress={() => openPortal('purchases')} activeOpacity={0.7} testID="gst-open-portal-purchases">
        <Ionicons name="cloud-download-outline" size={17} color={COLORS.textSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={st.navTxt}>{t('screens.gstPortal.purchasesEntry')}</Text>
          <Text style={st.meta}>{t('screens.gstPortal.entrySub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color={COLORS.textTertiary} />
      </TouchableOpacity>
      <Text style={st.foot}>{t('screens.settingsGst.fileOnWeb')}</Text>

      <ImsSheet visible={sheet === 'ims'} companyGuid={companyGuid} onClose={() => setSheet(null)} />
      <DepositsSheet visible={sheet === 'deposits'} companyGuid={companyGuid} fyRange={fyRange} onClose={() => setSheet(null)} />
    </View>
  );
}

const IMS_TONE: Record<string, 'generated' | 'failed' | 'pending' | 'muted'> = { accepted: 'generated', rejected: 'failed', pending: 'pending', none: 'muted' };
const IMS_ACTIONS: { action: GstImsAction; key: string }[] = [
  { action: 'accepted', key: 'imsAccept' },
  { action: 'rejected', key: 'imsReject' },
  { action: 'pending', key: 'imsPending' },
];

function ImsSheet({ visible, companyGuid, onClose }: { visible: boolean; companyGuid: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { formatAmount, formatDate } = useSettings();
  const { hasCapability } = useWorkspace();
  const [period, setPeriod] = useState(() => previousGstPeriod());
  const [data, setData] = useState<{ mode: string; sections: ImsSection[]; rows: GstImsRow[] } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'not_configured' | 'error'>('idle');
  const [busyId, setBusyId] = useState<string | null>(null);
  // null = All. The list holds every section; a chip only filters it.
  const [section, setSection] = useState<string | null>(null);
  const loadKey = visible && companyGuid ? `${companyGuid}|${period}` : '';
  const [prevKey, setPrevKey] = useState('');
  if (prevKey !== loadKey) {
    setPrevKey(loadKey);
    if (loadKey) setState('loading');
  }

  useEffect(() => {
    if (!visible || !companyGuid) return;
    let cancelled = false;
    getGstIms(companyGuid, period)
      .then((res: any) => {
        if (cancelled) return;
        const d = res?.data ?? {};
        setData({ mode: String(d.mode || 'view'), sections: imsSections(d.sections), rows: Array.isArray(d.rows) ? d.rows : [] });
        setState('ready');
      })
      .catch((e) => { if (!cancelled) setState(isGstNotConfigured(e) ? 'not_configured' : 'error'); });
    return () => { cancelled = true; };
  }, [visible, companyGuid, period]);

  const sections = data?.sections || [];
  const sameSection = (a?: string | null, b?: string | null) => String(a || '').toUpperCase() === String(b || '').toUpperCase();
  // A chip from another period that this one does not have falls back to All.
  const activeSection = section && sections.some((s) => sameSection(s.key, section)) ? section : null;
  const sectionLabel = (key?: string) => sections.find((s) => sameSection(s.key, key))?.label || key || '';
  const shown = (data?.rows || []).filter((r) => !activeSection || sameSection(r.section, activeSection));

  const canDecide = data?.mode === 'decide' && hasCapability('gst.return.submit');
  const decide = async (row: GstImsRow, action: GstImsAction) => {
    setBusyId(row.id);
    try {
      await saveGstImsActions(companyGuid, period, [{ id: row.id, action }]);
      setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === row.id ? { ...r, action } : r)) } : d));
    } catch (e) {
      toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || '');
    } finally {
      setBusyId(null);
    }
  };
  const choose = (row: GstImsRow, action: GstImsAction) => {
    if (action !== 'rejected') { decide(row, action); return; }
    Alert.alert(
      t('screens.reportsGst.imsRejectTitle'),
      t('screens.reportsGst.imsRejectMsg', { doc: row.doc_no || '', supplier: row.supplier_name || row.supplier_gstin || '' }),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t('screens.reportsGst.imsReject'), style: 'destructive', onPress: () => decide(row, action) }],
    );
  };

  return (
    <BottomModalShell visible={visible} onClose={onClose} title={t('screens.settingsGst.imsTitle')}>
      <View style={st.periodRow}>
        <TouchableOpacity onPress={() => setPeriod((p) => shiftGstPeriod(p, -1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={st.periodTxt}>{gstPeriodLabel(period)}</Text>
        <TouchableOpacity onPress={() => setPeriod((p) => shiftGstPeriod(p, 1))} disabled={period === gstPeriodOf(new Date())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={18} color={period === gstPeriodOf(new Date()) ? COLORS.textTertiary : COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      {state === 'loading' && <ActivityIndicator color={COLORS.brandPrimary} style={{ marginVertical: 24 }} />}
      {state === 'not_configured' && <Text style={st.note}>{t('screens.reportsGst.notConfigured')}</Text>}
      {state === 'error' && <Text style={[st.note, { color: COLORS.negative }]}>{t('screens.reportsGst.imsFailed')}</Text>}
      {state === 'ready' && data && (
        <>
          {data.mode !== 'decide' && <Text style={st.note}>{t('screens.reportsGst.imsViewOnly')}</Text>}
          {sections.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipWrap} contentContainerStyle={st.chipRow}>
              {[{ key: null, label: t('common.all'), count: data.rows.length }, ...sections].map((s) => {
                const on = s.key ? sameSection(s.key, activeSection) : !activeSection;
                return (
                  <TouchableOpacity key={s.key || 'all'} style={[st.chip, on && st.chipOn]} onPress={() => setSection(s.key)} activeOpacity={0.7} testID={`ims-section-${s.key || 'all'}`}>
                    <Text style={[st.chipTxt, on && st.chipTxtOn]}>{`${s.label} (${s.count})`}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {shown.length === 0 && <Text style={st.note}>{t('screens.reportsGst.imsEmpty')}</Text>}
          {shown.map((r) => {
            const action = String(r.action || 'none');
            return (
              <View key={r.id} style={st.listRow}>
                <View style={st.rowHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowTitle} numberOfLines={1}>{r.supplier_name || r.supplier_gstin}</Text>
                    <Text style={st.meta}>{[sectionLabel(r.section), r.supplier_gstin, r.doc_no, r.doc_date ? formatDate(String(r.doc_date)) : ''].filter(Boolean).join(' · ')}</Text>
                    <Text style={[st.meta, { color: r.in_books ? COLORS.positive : COLORS.warning }]}>{r.in_books ? t('screens.reportsGst.inBooks') : t('screens.reportsGst.notInBooks')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={st.amount}>{formatAmount(Number(r.taxable || 0) + Number(r.tax || 0))}</Text>
                    <StatusChip label={t(`screens.reportsGst.ims_${IMS_TONE[action] ? action : 'none'}`)} tone={IMS_TONE[action] || 'muted'} />
                  </View>
                </View>
                {canDecide && (
                  <View style={st.actions}>
                    {busyId === r.id ? <ActivityIndicator size="small" color={COLORS.brandPrimary} /> : IMS_ACTIONS.filter((a) => a.action !== action).map((a) => (
                      <TouchableOpacity key={a.action} style={[st.smallBtn, a.action === 'rejected' && { borderColor: COLORS.negative }]} onPress={() => choose(r, a.action)} activeOpacity={0.8} testID={`ims-${a.action}-${r.id}`}>
                        <Text style={[st.smallBtnTxt, a.action === 'rejected' && { color: COLORS.negative }]}>{t(`screens.reportsGst.${a.key}`)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </BottomModalShell>
  );
}

function DepositsSheet({ visible, companyGuid, fyRange, onClose }: {
  visible: boolean; companyGuid: string; fyRange: { from?: string; to?: string }; onClose: () => void;
}) {
  const { t } = useTranslation();
  const { formatAmount, formatDate } = useSettings();
  const { hasCapability } = useWorkspace();
  const [data, setData] = useState<{ mode: string; rows: GstDeposit[]; postCredits: number | null } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'not_configured' | 'error'>('idle');
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadKey = visible && companyGuid ? `${companyGuid}|${fyRange.from || ''}|${fyRange.to || ''}` : '';
  const [prevKey, setPrevKey] = useState('');
  if (prevKey !== loadKey) {
    setPrevKey(loadKey);
    if (loadKey) setState('loading');
  }

  useEffect(() => {
    if (!visible || !companyGuid) return;
    let cancelled = false;
    getGstDeposits(companyGuid, { from: fyRange.from, to: fyRange.to })
      .then((res: any) => {
        if (cancelled) return;
        const d = res?.data ?? {};
        const credits = Number(d.post_credits);
        setData({ mode: String(d.mode || 'show'), rows: Array.isArray(d.rows) ? d.rows : [], postCredits: Number.isFinite(credits) && credits > 0 ? credits : null });
        setState('ready');
      })
      .catch((e) => { if (!cancelled) setState(isGstNotConfigured(e) ? 'not_configured' : 'error'); });
    return () => { cancelled = true; };
  }, [visible, companyGuid, fyRange.from, fyRange.to]);

  const canSubmit = hasCapability('gst.return.submit');
  const patchRow = (id: string, patch: Partial<GstDeposit>) =>
    setData((d) => (d ? { ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : d));
  const post = async (row: GstDeposit) => {
    setBusyId(row.id);
    try {
      const res = await postGstDeposit(companyGuid, row.id);
      const status = depositStatusAfterPost(res?.data?.status);
      patchRow(row.id, { post_status: status, post_error: null, can_post: false });
      if (status === 'unknown') Toast.show({ type: 'info', text1: t('screens.reportsGst.postUnknown') });
      else Toast.show({ type: 'success', text1: t(status === 'posted' ? 'screens.reportsGst.posted' : 'screens.reportsGst.sentToTally') });
    } catch (e) {
      const code = (e as any)?.code;
      // Tally refused it, or it never reached Tally: the server let go of the deposit, so it can be posted again.
      if (code === 'TALLY_REFUSED' || code === 'TALLY_POST_FAILED') patchRow(row.id, { post_status: 'failed', post_error: (e as any)?.message || null, can_post: true });
      toastRbasError(e) || Alert.alert(t('common.error'), (e as any)?.message || '');
    } finally {
      setBusyId(null);
    }
  };
  const confirmPost = (row: GstDeposit, again: boolean) => {
    Alert.alert(
      t('screens.reportsGst.postConfirmTitle'),
      // Charged like any entry posted to Tally; the server sends the rate with the list.
      t('screens.reportsGst.postConfirmMsg', { amount: formatAmount(Number(row.amount) || 0), date: formatDate(String(row.date || '')) })
        + (data?.postCredits != null ? `\n${data.postCredits} ${t('screens.settingsLicense.credits')}` : ''),
      [{ text: t('common.cancel'), style: 'cancel' }, { text: t(again ? 'screens.reportsGst.postAgain' : 'screens.reportsGst.postToTally'), onPress: () => post(row) }],
    );
  };

  return (
    <BottomModalShell visible={visible} onClose={onClose} title={t('screens.reportsGst.deposits')}>
      {state === 'loading' && <ActivityIndicator color={COLORS.brandPrimary} style={{ marginVertical: 24 }} />}
      {state === 'not_configured' && <Text style={st.note}>{t('screens.reportsGst.notConfigured')}</Text>}
      {state === 'error' && <Text style={[st.note, { color: COLORS.negative }]}>{t('screens.reportsGst.depositsFailed')}</Text>}
      {state === 'ready' && data && (
        <>
          {data.mode === 'show' && <Text style={st.note}>{t('screens.reportsGst.depositsShowNote')}</Text>}
          {data.mode === 'auto' && <Text style={st.note}>{t('screens.reportsGst.depositsAutoNote')}</Text>}
          {data.rows.length === 0 && <Text style={st.note}>{t('screens.reportsGst.depositsEmpty')}</Text>}
          {data.rows.map((r) => {
            const heads = [['IGST', r.igst], ['CGST', r.cgst], ['SGST', r.sgst], ['Cess', r.cess]]
              .filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k} ${formatAmount(Number(v))}`).join(' · ');
            const status = depositPostStatus(r);
            const showPost = canSubmit && r.can_post === true && status !== 'unknown';
            return (
              <View key={r.id} style={st.listRow}>
                <View style={st.rowHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.rowTitle}>{formatDate(String(r.date || ''))}</Text>
                    {!!(r.reference || r.description) && <Text style={st.meta} numberOfLines={1}>{r.reference || r.description}</Text>}
                    {!!heads && <Text style={st.meta}>{heads}</Text>}
                  </View>
                  <Text style={st.amount}>{formatAmount(Number(r.amount) || 0)}</Text>
                </View>
                {(status === 'posted' || status === 'queued') && (
                  <Text style={[st.meta, { color: COLORS.positive, marginTop: 6 }]} testID={`deposit-status-${r.id}`}>
                    {status === 'posted' ? (r.voucher_number ? t('screens.reportsGst.postedVoucher', { number: r.voucher_number }) : t('screens.reportsGst.posted')) : t('screens.reportsGst.sentToTally')}
                  </Text>
                )}
                {status === 'failed' && (
                  <View style={{ marginTop: 6 }} testID={`deposit-status-${r.id}`}>
                    <Text style={[st.meta, { color: COLORS.negative, fontWeight: '600' }]}>{t('screens.reportsGst.postFailed')}</Text>
                    {!!r.post_error && <Text style={st.meta}>{r.post_error}</Text>}
                  </View>
                )}
                {status === 'unknown' && (
                  <Text style={[st.meta, { color: COLORS.warning, fontWeight: '600', marginTop: 6 }]} testID={`deposit-status-${r.id}`}>{t('screens.reportsGst.postUnknown')}</Text>
                )}
                {showPost && (
                  <View style={st.actions}>
                    <TouchableOpacity style={st.primaryBtn} onPress={() => confirmPost(r, status === 'failed')} disabled={busyId === r.id} activeOpacity={0.85} testID={`deposit-post-${r.id}`}>
                      {busyId === r.id ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={st.primaryTxt}>{t(status === 'failed' ? 'screens.reportsGst.postAgain' : 'screens.reportsGst.postToTally')}</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </BottomModalShell>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: SPACING.md },
  slimCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingVertical: 12, marginBottom: SPACING.md },
  slimTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17 },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17 },
  link: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.info, marginTop: 4 },
  section: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: 4 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  dueForm: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: SPACING.md, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md },
  scoreLabel: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
  scoreVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  partRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 4 },
  partLabel: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  partVal: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, marginTop: SPACING.sm },
  navTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  foot: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 6 },
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: SPACING.sm },
  periodTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, minWidth: 90, textAlign: 'center' },
  chipWrap: { marginBottom: SPACING.sm, flexGrow: 0 },
  chipRow: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  chipOn: { backgroundColor: COLORS.cardBg, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtOn: { color: COLORS.brandPrimary, fontWeight: '700' },
  listRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  rowTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  amount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'flex-end' },
  smallBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong },
  smallBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  primaryBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, minWidth: 110, alignItems: 'center' },
  primaryTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
});
