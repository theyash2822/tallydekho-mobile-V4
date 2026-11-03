/**
 * Compliance record — INVOICE / E-INVOICE / E-WAY BILL / HISTORY (Owner's layout).
 * Route: /reports/compliance-detail?voucherGuid=…&domain=einvoice|ewaybill
 * Data: GET /einvoice/:voucherGuid or /ewaybills/:voucherGuid (same shape).
 * Every action from the lists is available here too, so the sales screens can
 * link straight to this record.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { safePush } from '../../src/utils/safeNavigation';
import { openVoucherPreview } from '../../src/utils/openVoucherPreview';
import { ErrorState, LoadingState } from '../../src/components/ApiStateViews';
import { useAuth } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useSettings } from '../../src/context/SettingsContext';
import {
  getEinvoiceRecord, getEwbRecord, fetchEinvoiceReadiness, fetchEwbReadiness,
  generateEinvoice, generateEwb, verifyEinvoice, refreshEinvoice, refreshEwb, cancelEInvoice, cancelEWayBill,
  updateEwbVehicle, updateEwbTransporter, extendEwb, type DispatchDetails, type ReadinessRow,
} from '../../src/services/api';
import { shareEinvoicePdf, shareEwbPdf, shareSignedJson } from '../../src/utils/complianceActions';
import { ActionSheet, CancelSheet, GenerateEwbSheet, GenerateIrnSheet, KV, VerifyResultSheet, type SheetAction } from '../../src/components/compliance/ComplianceSheets';
import { EwbExtendSheet, EwbTransporterSheet, EwbVehicleSheet } from '../../src/components/compliance/EwbForms';
import FixGapSheet from '../../src/components/compliance/FixGapSheet';
import { StatusChip } from '../../src/components/compliance/ComplianceChips';
import { CANCEL_REASONS, EWB_CANCEL_REASONS, complianceErrorText, eventDate, firstGap, rowAmount, rowDate, rowNumber, rowParty } from '../../src/components/compliance/complianceShared';

function Section({ title, status, onMenu, busy, children }: {
  title: string; status?: { label: string; tone: any } | null; onMenu?: () => void; busy?: boolean; children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={{ flex: 1 }} />
        {status ? <StatusChip label={status.label} tone={status.tone} /> : null}
        {onMenu && (
          <TouchableOpacity onPress={onMenu} style={s.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            {busy ? <ActivityIndicator size="small" color={COLORS.textSecondary} /> : <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />}
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

export default function ComplianceDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { formatAmount, formatDate } = useSettings();
  const { company } = useAuth();
  const { hasCapability } = useWorkspace();
  const companyGuid = company?.guid || '';
  const { voucherGuid: guidParam, domain: domainParam } = useLocalSearchParams<{ voucherGuid: string; domain?: string }>();
  const voucherGuid = String(guidParam || '');
  const domain: 'einvoice' | 'ewaybill' = domainParam === 'ewaybill' ? 'ewaybill' : 'einvoice';

  const [record, setRecord] = useState<any | null>(null);
  const [readyRow, setReadyRow] = useState<ReadinessRow | null>(null);
  const [attentionRow, setAttentionRow] = useState<ReadinessRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [menu, setMenu] = useState<'einvoice' | 'ewaybill' | null>(null);
  const [irnOpen, setIrnOpen] = useState(false);
  const [ewbOpen, setEwbOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [cancelKind, setCancelKind] = useState<'einvoice' | 'ewaybill' | null>(null);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [transporterOpen, setTransporterOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  const loadKey = `${companyGuid}|${voucherGuid}|${domain}|${reloadKey}`;
  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    if (companyGuid && voucherGuid) setLoading(true);
  }

  const load = useCallback(() => {
    if (!companyGuid || !voucherGuid) return () => {};
    let cancelled = false;
    const fetchRecord = domain === 'ewaybill' ? getEwbRecord : getEinvoiceRecord;
    fetchRecord(companyGuid, voucherGuid)
      .then(async (res: any) => {
        if (cancelled) return;
        const d = res?.data ?? res ?? null;
        setRecord(d);
        setError(null);
        // Pending documents: pull the readiness preview / gaps for this voucher so Generate / Fix work from here.
        const hasIrn = !!d?.einvoice?.irn;
        const hasEwb = !!(d?.ewaybill?.ewb_no || d?.ewaybill?.ewb_number);
        if (!hasIrn || !hasEwb) {
          const fetchReadiness = domain === 'ewaybill' || hasIrn ? fetchEwbReadiness : fetchEinvoiceReadiness;
          const r: any = await fetchReadiness(companyGuid, { voucherGuid }).catch(() => null);
          if (cancelled) return;
          const pick = (list: any[]) => (Array.isArray(list) ? list.find((x) => String(x.guid) === voucherGuid) : undefined) || null;
          setReadyRow(pick(r?.data?.ready));
          setAttentionRow(pick(r?.data?.attention));
        } else {
          setReadyRow(null);
          setAttentionRow(null);
        }
      })
      .catch((e: any) => { if (!cancelled) setError(e?.message || t('screens.reportsEinvoiceList.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyGuid, voucherGuid, domain, t]);
  useEffect(() => load(), [load, reloadKey]);
  const refetch = () => setReloadKey((k) => k + 1);

  const voucher = record?.voucher || {};
  const ein = record?.einvoice || {};
  const ewb = record?.ewaybill || {};
  const history: any[] = Array.isArray(record?.history) ? record.history : [];
  const irn = String(ein.irn || voucher.irn || '');
  const ewbNo = String(ewb.ewb_no || ewb.ewb_number || voucher.ewb_number || '');
  const einStatus = String(ein.status || (irn ? 'generated' : '')).toLowerCase();
  const ewbStatus = String(ewb.status || (ewbNo ? 'generated' : '')).toLowerCase();
  const ewbActive = !!ewbNo && ewbStatus !== 'cancelled' && ewbStatus !== 'expired';
  const canEinvoiceUpdate = hasCapability('einvoice.update');
  const canEwbUpdate = hasCapability('eway.update');

  /** The row shape the share helpers and sheets expect. */
  const rowLike = {
    guid: voucherGuid,
    voucher_number: rowNumber(voucher),
    voucher_type: voucher.voucher_type,
    date: rowDate(voucher),
    party_name: rowParty(voucher),
    party_gstin: voucher.party_gstin,
    amount: rowAmount(voucher),
    irn, ack_no: ein.ack_no, ack_date: ein.ack_date, qr_code: ein.qr_code,
    ewb_number: ewbNo, ewb_date: ewb.ewb_date, ewb_valid_till: ewb.valid_till, vehicle_no: ewb.vehicle_no, transporter_id: ewb.transporter_id,
    preview: readyRow?.preview,
  };

  const fail = (e: any) => Alert.alert(t('common.error'), complianceErrorText(e, t));
  const run = async (fn: () => Promise<any>, success?: string, close?: () => void) => {
    setSheetBusy(true);
    try {
      const res: any = await fn();
      if (res?.success === false) throw new Error(res?.error?.message || t('screens.reportsEinvoiceList.unknownError'));
      close?.();
      if (success) Toast.show({ type: 'success', text1: success });
      refetch();
      return res;
    } catch (e) {
      fail(e);
      return null;
    } finally {
      setSheetBusy(false);
    }
  };

  const einvoiceActions: SheetAction[] = [
    { key: 'share', label: t('pdf.sharePdf'), icon: 'share-outline' },
    ...(canEinvoiceUpdate ? [{ key: 'json', label: t('screens.reportsEinvoiceList.downloadJson', { defaultValue: 'Download signed JSON' }), icon: 'code-download-outline' }] : []),
    { key: 'verify', label: t('screens.reportsEinvoiceList.verify', { defaultValue: 'Verify signed data' }), icon: 'shield-checkmark-outline' },
    { key: 'refresh', label: t('screens.reportsEinvoiceList.refreshStatus', { defaultValue: 'Refresh status' }), icon: 'refresh-outline' },
    ...(einStatus !== 'cancelled' && canEinvoiceUpdate ? [{ key: 'cancel', label: t('screens.reportsEinvoiceList.cancelRegistration', { defaultValue: 'Cancel registration' }), icon: 'close-circle-outline', destructive: true, disabled: ewbActive }] : []),
  ];
  const ewbActions: SheetAction[] = [
    { key: 'share', label: t('pdf.sharePdf'), icon: 'share-outline' },
    ...(ewbActive && canEwbUpdate ? [
      { key: 'vehicle', label: ewb.vehicle_no ? t('screens.reportsEwbList.updateVehicle', { defaultValue: 'Update vehicle' }) : t('screens.reportsEwbList.completePartB', { defaultValue: 'Complete Part B' }), icon: 'car-outline' },
      { key: 'transporter', label: t('screens.reportsEwbList.updateTransporter', { defaultValue: 'Update transporter' }), icon: 'people-outline' },
      { key: 'extend', label: t('screens.reportsEwbList.extendValidity', { defaultValue: 'Extend validity' }), icon: 'hourglass-outline' },
    ] : []),
    { key: 'refresh', label: t('screens.reportsEinvoiceList.refreshStatus', { defaultValue: 'Refresh status' }), icon: 'refresh-outline' },
    ...(ewbActive && canEwbUpdate ? [{ key: 'cancel', label: t('screens.reportsEwbList.cancelBill', { defaultValue: 'Cancel e-way bill' }), icon: 'close-circle-outline', destructive: true }] : []),
  ];

  const onAction = async (kind: 'einvoice' | 'ewaybill', key: string) => {
    if (!companyGuid) return;
    if (key === 'share') {
      setBusy(true);
      if (kind === 'einvoice') await shareEinvoicePdf(companyGuid, rowLike, company, () => setBusy(false));
      else await shareEwbPdf(companyGuid, rowLike, company, () => setBusy(false));
      setBusy(false);
      return;
    }
    if (key === 'json') {
      setBusy(true);
      try { await shareSignedJson(companyGuid, voucherGuid, irn); } catch (e) { fail(e); } finally { setBusy(false); }
      return;
    }
    if (key === 'verify') {
      setVerifyResult(null);
      setVerifyOpen(true);
      try { const res: any = await verifyEinvoice(companyGuid, voucherGuid); setVerifyResult(res?.data ?? res ?? {}); }
      catch (e) { setVerifyOpen(false); fail(e); }
      return;
    }
    if (key === 'refresh') {
      setBusy(true);
      try {
        const res: any = kind === 'einvoice' ? await refreshEinvoice(companyGuid, voucherGuid) : await refreshEwb(companyGuid, voucherGuid);
        const d = res?.data ?? res ?? {};
        Toast.show({ type: 'success', text1: t('screens.reportsEinvoiceList.statusRefreshed', { defaultValue: 'Status refreshed' }), text2: d.status ? String(d.status) : undefined });
        refetch();
      } catch (e) { fail(e); } finally { setBusy(false); }
      return;
    }
    if (key === 'cancel') {
      if (kind === 'einvoice' && ewbActive) {
        Alert.alert(t('screens.reportsEinvoiceList.cancelRegistration', { defaultValue: 'Cancel registration' }), t('screens.reportsEinvoiceList.ewbActiveFirst', { defaultValue: 'Cancel the e-way bill first.' }));
        return;
      }
      setCancelKind(kind);
      return;
    }
    if (key === 'vehicle') setVehicleOpen(true);
    if (key === 'transporter') setTransporterOpen(true);
    if (key === 'extend') setExtendOpen(true);
  };

  const runGenerateIrn = async (opts: { alsoEwb: boolean; dispatchDetails?: DispatchDetails }) => {
    const res = await run(() => generateEinvoice({ companyGuid, voucherGuid, alsoEwb: opts.alsoEwb, dispatchDetails: opts.dispatchDetails }), undefined, () => setIrnOpen(false));
    if (res) {
      const d = res?.data ?? res ?? {};
      Alert.alert(t('screens.reportsEinvoiceList.irnGenerated'), [d.irn ? `IRN ${String(d.irn).slice(0, 24)}…` : '', d.ewbNo ? `EWB ${d.ewbNo}` : '', d.ewb?.ok === false ? `${t('screens.reportsEinvoiceList.ewbFailed', { defaultValue: 'E-way bill failed' })}: ${d.ewb.message || ''}` : ''].filter(Boolean).join('\n') || undefined);
    }
  };
  const runGenerateEwb = (dispatchDetails: DispatchDetails) =>
    run(() => generateEwb({ companyGuid, voucherGuid, dispatchDetails }), t('screens.reportsEwbList.generated', { defaultValue: 'E-way bill generated' }), () => setEwbOpen(false));

  const header = (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{t('screens.reportsEinvoiceList.recordTitle', { defaultValue: 'Compliance record' })}</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  if (loading && !record) {
    return <SafeAreaView style={s.safe}>{header}<LoadingState message={t('common.loading')} /></SafeAreaView>;
  }
  if (error || !record) {
    return <SafeAreaView style={s.safe}>{header}<ErrorState title={t('screens.reportsEinvoiceList.loadFailed')} message={error || ''} onRetry={refetch} /></SafeAreaView>;
  }

  const gap = attentionRow ? firstGap(attentionRow) : null;
  const einTone = einStatus === 'cancelled' ? 'cancelled' : einStatus === 'failed' ? 'failed' : irn ? 'generated' : 'pending';
  const ewbTone = ewbStatus === 'cancelled' ? 'cancelled' : ewbStatus === 'expired' ? 'expired' : ewbNo ? 'generated' : 'pending';

  return (
    <SafeAreaView style={s.safe}>
      {header}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}>
        {/* INVOICE */}
        <Section title={t('screens.reportsEinvoiceList.sectionInvoice', { defaultValue: 'Invoice' })}>
          <View style={s.invoiceRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.invoiceNo}>{rowNumber(voucher) || '—'}</Text>
              <Text style={s.meta}>{[rowParty(voucher), rowDate(voucher) ? formatDate(rowDate(voucher)) : ''].filter(Boolean).join(' · ')}</Text>
              {!!voucher.voucher_type && <Text style={s.meta}>{voucher.voucher_type}{voucher.is_cancelled ? ` · ${t('screens.componentsDocumentVoucherPreviewScreen.cancelled', 'Cancelled in Tally')}` : ''}</Text>}
            </View>
            <Text style={s.amount}>{formatAmount(rowAmount(voucher))}</Text>
          </View>
          <TouchableOpacity style={s.linkRow} onPress={() => openVoucherPreview(router, { guid: voucherGuid })} activeOpacity={0.7}>
            <Ionicons name="document-text-outline" size={15} color={COLORS.info} />
            <Text style={s.linkTxt}>{t('screens.reportsEinvoiceList.openInvoice', { defaultValue: 'Open invoice' })}</Text>
          </TouchableOpacity>
        </Section>

        {/* E-INVOICE */}
        <Section
          title={t('screens.reportsEinvoiceList.sectionEinvoice', { defaultValue: 'E-invoice' })}
          status={{ label: irn ? (einStatus === 'cancelled' ? t('screens.reportsEinvoiceList.statusCancelled') : t('screens.reportsEinvoiceList.statusGenerated')) : (einStatus === 'failed' ? t('screens.reportsEinvoiceList.statusError') : t('screens.reportsEinvoiceList.statusPending')), tone: einTone }}
          onMenu={irn ? () => setMenu('einvoice') : undefined}
          busy={busy}
        >
          {irn ? (
            <>
              <KV label="IRN" value={irn} mono />
              <KV label={t('screens.reportsEinvoiceList.ackNo', { defaultValue: 'Ack no' })} value={ein.ack_no} />
              <KV label={t('screens.reportsEinvoiceList.ackDate', { defaultValue: 'Ack date' })} value={ein.ack_date} />
              {!!ein.error_message && <Text style={s.errTxt}>{ein.error_message}</Text>}
            </>
          ) : (
            <>
              {!!ein.error_message && <Text style={s.errTxt}>{ein.error_message}</Text>}
              {gap && <Text style={s.gapTxt}>{gap.message}</Text>}
              <View style={s.btnRow}>
                {readyRow && hasCapability('einvoice.generate') && (
                  <TouchableOpacity style={s.primaryBtn} onPress={() => setIrnOpen(true)} activeOpacity={0.85}>
                    <Text style={s.primaryBtnTxt}>{t('screens.reportsEinvoiceList.registerTitle', { defaultValue: 'Register e-invoice' })}</Text>
                  </TouchableOpacity>
                )}
                {attentionRow && (
                  <TouchableOpacity style={s.outlineBtn} onPress={() => setFixOpen(true)} activeOpacity={0.85}>
                    <Text style={s.outlineBtnTxt}>{t('screens.reportsEinvoiceList.fix', { defaultValue: 'Fix' })}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </Section>

        {/* E-WAY BILL */}
        <Section
          title={t('screens.reportsEinvoiceList.sectionEwb', { defaultValue: 'E-way bill' })}
          status={{ label: ewbNo ? (ewbStatus === 'cancelled' ? t('screens.reportsEwbList.statusCancelled', { defaultValue: 'Cancelled' }) : ewbStatus === 'expired' ? t('screens.reportsEwbList.statusExpired', { defaultValue: 'Expired' }) : t('screens.reportsEwbList.statusActive', { defaultValue: 'Active' })) : t('screens.reportsEinvoiceList.statusPending'), tone: ewbTone }}
          onMenu={ewbNo ? () => setMenu('ewaybill') : undefined}
          busy={busy}
        >
          {ewbNo ? (
            <>
              <KV label={t('screens.reportsEinvoiceList.number', { defaultValue: 'Number' })} value={ewbNo} mono />
              <KV label={t('screens.reportsEwbList.vehicleNumber', { defaultValue: 'Vehicle number' })} value={ewb.vehicle_no} />
              <KV label={t('screens.reportsEwbList.transporterId', { defaultValue: 'Transporter ID' })} value={ewb.transporter_id} />
              <KV label={t('screens.reportsEwbList.validTill', { defaultValue: 'Valid till' })} value={ewb.valid_till ? formatDate(String(ewb.valid_till)) : undefined} />
            </>
          ) : (
            <View style={s.btnRow}>
              {hasCapability('eway.generate') && (
                <TouchableOpacity style={s.primaryBtn} onPress={() => setEwbOpen(true)} activeOpacity={0.85}>
                  <Text style={s.primaryBtnTxt}>{t('screens.reportsEwbList.generateTitle', { defaultValue: 'Generate e-way bill' })}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Section>

        {/* HISTORY */}
        <Section title={t('screens.reportsEinvoiceList.sectionHistory', { defaultValue: 'History' })}>
          {history.length === 0 ? (
            <Text style={s.meta}>{t('screens.reportsEinvoiceList.noHistory', { defaultValue: 'No events yet.' })}</Text>
          ) : history.slice(0, 5).map((ev, i) => (
            <View key={String(ev.id || i)} style={s.histRow}>
              <View style={[s.dot, { backgroundColor: ev.result === 'failed' ? COLORS.negative : COLORS.positive }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.histAction}>{String(ev.action || '').replace(/_/g, ' ')}{ev.domain ? ` · ${ev.domain === 'ewaybill' ? 'EWB' : 'IRN'}` : ''}</Text>
                <Text style={s.meta}>{[ev.actor_name || ev.actor, eventDate(ev.created_at)?.toLocaleString() || ''].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={s.linkRow} onPress={() => safePush(router, `/reports/compliance-history?voucherGuid=${encodeURIComponent(voucherGuid)}` as any)} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={15} color={COLORS.info} />
            <Text style={s.linkTxt}>{t('screens.reportsEinvoiceList.viewHistory', { defaultValue: 'View history' })}</Text>
          </TouchableOpacity>
        </Section>
        <View style={{ height: 32 }} />
      </ScrollView>

      <ActionSheet
        visible={!!menu}
        title={menu === 'ewaybill' ? `EWB ${ewbNo}` : rowNumber(voucher)}
        actions={menu === 'ewaybill' ? ewbActions : einvoiceActions}
        onClose={() => setMenu(null)}
        onSelect={(key) => { const k = menu; setMenu(null); if (k) onAction(k, key); }}
      />
      <GenerateIrnSheet visible={irnOpen} row={readyRow ? { ...readyRow, guid: voucherGuid } : rowLike} busy={sheetBusy} onClose={() => setIrnOpen(false)} onConfirm={runGenerateIrn} />
      <GenerateEwbSheet visible={ewbOpen} row={readyRow ? { ...readyRow, guid: voucherGuid } : rowLike} busy={sheetBusy} onClose={() => setEwbOpen(false)} onConfirm={runGenerateEwb} />
      <FixGapSheet visible={fixOpen} row={attentionRow} companyGuid={companyGuid} companyName={company?.name} onClose={() => setFixOpen(false)} onSaved={refetch} onRegisterEinvoiceFirst={() => setIrnOpen(true)} />
      <CancelSheet
        visible={!!cancelKind}
        title={cancelKind === 'ewaybill' ? t('screens.reportsEwbList.cancelBill', { defaultValue: 'Cancel e-way bill' }) : t('screens.reportsEinvoiceList.cancelRegistration', { defaultValue: 'Cancel registration' })}
        hint={t('screens.reportsEinvoiceList.cancelHint', { defaultValue: 'The portal allows cancellation within 24 hours of registration.' })}
        reasons={cancelKind === 'ewaybill' ? EWB_CANCEL_REASONS(t) : CANCEL_REASONS(t)}
        busy={sheetBusy}
        onClose={() => setCancelKind(null)}
        onConfirm={(reason, remarks) => run(
          () => (cancelKind === 'ewaybill'
            ? cancelEWayBill({ companyGuid, voucherGuid, cancelReason: Number(reason), cancelRemarks: remarks })
            : cancelEInvoice({ companyGuid, voucherGuid, cancelReason: Number(reason), cancelRemarks: remarks })),
          cancelKind === 'ewaybill' ? t('screens.reportsEwbList.cancelled', { defaultValue: 'E-way bill cancelled' }) : t('screens.reportsEinvoiceList.cancelled', { defaultValue: 'Registration cancelled' }),
          () => setCancelKind(null),
        )}
      />
      {vehicleOpen && (
        <EwbVehicleSheet visible record={{ ewb_no: ewbNo, vehicle_no: ewb.vehicle_no }} busy={sheetBusy} onClose={() => setVehicleOpen(false)}
          onSubmit={(body) => run(() => updateEwbVehicle(companyGuid, voucherGuid, body), t('screens.reportsEwbList.vehicleUpdated', { defaultValue: 'Vehicle updated' }), () => setVehicleOpen(false))} />
      )}
      {transporterOpen && (
        <EwbTransporterSheet visible current={ewb.transporter_id} busy={sheetBusy} onClose={() => setTransporterOpen(false)}
          onSubmit={(id) => run(() => updateEwbTransporter(companyGuid, voucherGuid, id), t('screens.reportsEwbList.transporterUpdated', { defaultValue: 'Transporter updated' }), () => setTransporterOpen(false))} />
      )}
      {extendOpen && (
        <EwbExtendSheet visible record={{ ewb_no: ewbNo, vehicle_no: ewb.vehicle_no }} busy={sheetBusy} onClose={() => setExtendOpen(false)}
          onSubmit={(body) => run(() => extendEwb(companyGuid, voucherGuid, body), t('screens.reportsEwbList.extended', { defaultValue: 'Validity extended' }), () => setExtendOpen(false))} />
      )}
      <VerifyResultSheet visible={verifyOpen} result={verifyResult} onClose={() => setVerifyOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  content: { padding: SPACING.md, gap: SPACING.sm },
  section: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6 },
  moreBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  invoiceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  invoiceNo: { fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.info },
  errTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.negative, marginTop: 4, lineHeight: 16 },
  gapTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, fontWeight: '600', lineHeight: 16, marginBottom: 6 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryBtn: { backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 14 },
  primaryBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 14 },
  outlineBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  histRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  histAction: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, textTransform: 'capitalize' },
});
