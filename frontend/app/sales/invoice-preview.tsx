/**
 * invoice-preview.tsx
 * Provisional / Final Invoice Preview Screen
 *
 * Route: /sales/invoice-preview?tdkRef=TDK-SAL-2026-0042
 *
 * - Immediately fetches invoice snapshot from backend (/tally/invoice/:tdkRef/preview)
 * - Shows DocumentPreviewPage with watermark if provisional
 * - Listens for invoice_posting_updated WebSocket event to auto-refresh to final
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context'; // used for loading/error states only
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { COLORS, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getInvoicePreview, getActiveWorkspaceId, getEinvoiceRecord, getVoucherById } from '../../src/services/api';
import { safePush } from '../../src/utils/safeNavigation';
import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { VoucherDocument } from '../../src/types/document';
import { subscribePostingEvents } from '../../src/services/socketService';
import { isPostingEventForDocument } from '../../src/services/workspaceEventScope';
import {
  buildProformaToInvoicePrefillFromPreview,
  proformaPrefillStorageKey,
} from '../../src/utils/proformaToInvoicePrefill';
import { toVoucherDocument } from '../../src/utils/voucherDocumentAdapter';
import { DocumentType } from '../../src/types/document';
import { resolveDocTypeFromParam } from '../../src/utils/documentHelpers';
import { isCommercialDocumentType } from '../../src/utils/commercial-print';

export default function InvoicePreviewScreen() {
  const { tdkRef, type } = useLocalSearchParams<{ tdkRef: string; type?: string }>();
  const { company } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const routeType = resolveDocTypeFromParam(type);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<VoucherDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProvisional, setIsProvisional] = useState(false);
  const [postingTag, setPostingTag] = useState('Not Posted');
  const [canConvertProforma, setCanConvertProforma] = useState(false);
  const [converting, setConverting] = useState(false);
  const [rawData, setRawData] = useState<any>(null);
  // Auto-IRN (spec 2026-11-03 §2.7): once Tally assigns the number, poll the e-invoice record and show the result.
  // 'idle' while polling (the bar shows "Registering…"), 'timeout' hides the bar after ~90 s without a result.
  const [autoIrnResult, setAutoIrnResult] = useState<{ state: 'idle' | 'done' | 'failed' | 'timeout'; irn?: string; message?: string; voucherGuid?: string }>({ state: 'idle' });

  const loadPreview = useCallback(() => {
    const guid = company?.guid;
    if (!tdkRef || !guid) return;
    getInvoicePreview(tdkRef, guid)
      .then((res) => {
        if (res?.status && res?.data) {
          const forcedType: DocumentType | undefined =
            routeType && isCommercialDocumentType(routeType) ? routeType : undefined;
          setDoc(toVoucherDocument(res.data, forcedType ? { documentType: forcedType } : {}));
          setRawData(res.data);
          setIsProvisional(res.data.isProvisional ?? false);
          setPostingTag(res.data.postingTag || 'Not Posted');
          setCanConvertProforma(!!res.data.canConvertProforma);
        } else {
          setError(i18n.t('screens.salesInvoicePreview.loadFailed'));
        }
      })
      .catch((e: any) => {
        setError(e?.message || i18n.t('screens.salesInvoicePreview.loadFailedShort'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tdkRef, company?.guid, routeType]);

  const fetchPreview = useCallback(() => {
    if (!tdkRef || !company?.guid) return;
    setLoading(true);
    setError(null);
    loadPreview();
  }, [tdkRef, company?.guid, loadPreview]);

  const previewDeps = [tdkRef, company?.guid, routeType];
  const [prevPreviewDeps, setPrevPreviewDeps] = useState(previewDeps);
  if (previewDeps.some((d, i) => d !== prevPreviewDeps[i])) {
    setPrevPreviewDeps(previewDeps);
    if (tdkRef && company?.guid) {
      setLoading(true);
      setError(null);
    }
  }

  const handleConvertProforma = useCallback(async () => {
    const guid = company?.guid;
    if (!tdkRef || !guid || !rawData) return;
    setConverting(true);
    try {
      const prefill = buildProformaToInvoicePrefillFromPreview(rawData, tdkRef);
      await AsyncStorage.setItem(proformaPrefillStorageKey(guid), JSON.stringify(prefill));
      router.replace('/sales/create-invoice');
    } catch (e: any) {
      Toast.show({ type: 'error', text1: i18n.t('screens.salesInvoicePreview.startFailed'), text2: e?.message || '' });
      setConverting(false);
    }
  }, [tdkRef, company?.guid, rawData, router]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  // The preview snapshot has no voucher guid; once the Tally number is final, /vouchers/:id resolves it by number.
  const [resolvedGuid, setResolvedGuid] = useState<{ number: string; guid: string } | null>(null);
  const tallyNumber: string | null = rawData && !isProvisional && !rawData.numberPending ? String(rawData.documentNumber || '') || null : null;
  const autoIrnDocType = rawData?.documentType || routeType;
  const autoIrnWanted = !!tallyNumber && autoIrnDocType === 'sales_invoice' && !rawData?.isCancelled && !rawData?.is_cancelled;
  useEffect(() => {
    if (!autoIrnWanted || !company?.guid || !tallyNumber) return;
    if (rawData?.tallyGuid || rawData?.tally_guid) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res: any = await getVoucherById(company.guid!, tallyNumber);
        const guid = res?.data?.voucher?.guid;
        if (cancelled) return;
        if (guid) { setResolvedGuid({ number: tallyNumber, guid: String(guid) }); return; }
      } catch {
        // The voucher row lands with the next Tally sync; keep trying for a while.
      }
      if (attempts < 12) timer = setTimeout(tick, 5000);
      else setAutoIrnResult({ state: 'timeout' });
    };
    timer = setTimeout(tick, 1000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [autoIrnWanted, tallyNumber, company?.guid, rawData?.tallyGuid, rawData?.tally_guid]);
  const autoIrnVoucherGuid: string | null = autoIrnWanted
    ? (String(rawData?.tallyGuid || rawData?.tally_guid || '') || (resolvedGuid && resolvedGuid.number === tallyNumber ? resolvedGuid.guid : '') || null)
    : null;
  const autoIrnApplies = autoIrnWanted;
  useEffect(() => {
    if (!autoIrnApplies || !company?.guid || !autoIrnVoucherGuid) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res: any = await getEinvoiceRecord(company.guid!, autoIrnVoucherGuid);
        const ein = res?.data?.einvoice ?? res?.einvoice ?? {};
        if (cancelled) return;
        if (ein.irn) { setAutoIrnResult({ state: 'done', irn: String(ein.irn), voucherGuid: autoIrnVoucherGuid }); return; }
        if (ein.error_message || String(ein.status || '').toLowerCase() === 'failed') {
          setAutoIrnResult({ state: 'failed', message: String(ein.error_message || ''), voucherGuid: autoIrnVoucherGuid });
          return;
        }
      } catch {
        // Not a compliance company / record not there yet: keep polling quietly.
      }
      if (attempts >= 18) { setAutoIrnResult({ state: 'timeout' }); return; }
      timer = setTimeout(tick, 5000);
    };
    timer = setTimeout(tick, 1500);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [autoIrnApplies, autoIrnVoucherGuid, company?.guid]);
  const autoIrn = autoIrnApplies && autoIrnResult.state !== 'timeout'
    ? { ...autoIrnResult, state: autoIrnResult.state === 'idle' ? 'waiting' as const : autoIrnResult.state, voucherGuid: autoIrnResult.voucherGuid || autoIrnVoucherGuid || undefined }
    : { state: 'none' as const, voucherGuid: undefined as string | undefined, irn: undefined as string | undefined, message: undefined as string | undefined };

  // WebSocket: auto-refresh when Tally posts the invoice
  useEffect(() => {
    if (!tdkRef) return;
    return subscribePostingEvents((event, payload) => {
      if (!isPostingEventForDocument(event, payload, {
        activeWorkspaceId: getActiveWorkspaceId(),
        companyGuid: company?.guid,
        ref: String(tdkRef),
      })) return;
      fetchPreview();
    });
  }, [tdkRef, company?.guid, fetchPreview]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>{t('screens.salesInvoicePreview.title')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>{t('screens.salesInvoicePreview.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !doc) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>{t('screens.salesInvoicePreview.title')}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
          <Text style={s.errorTxt}>{error || t('screens.salesInvoicePreview.notFound')}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchPreview} activeOpacity={0.8}>
            <Text style={s.retryTxt}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // DocumentPreviewPage owns SafeAreaView(top). Never place banners above it —
  // they sit under the device status bar and get clipped.
  return (
    <View style={s.safe}>
      <View style={{ flex: 1 }}>
        <DocumentPreviewPage
          document={doc}
          isProvisional={isProvisional}
        />
      </View>
      {autoIrn.state !== 'none' && (
        <TouchableOpacity
          style={s.irnBar}
          activeOpacity={0.8}
          disabled={!autoIrn.voucherGuid}
          onPress={() => autoIrn.voucherGuid && safePush(router, `/reports/compliance-detail?voucherGuid=${encodeURIComponent(autoIrn.voucherGuid)}&domain=einvoice` as any)}
        >
          {autoIrn.state === 'waiting' ? <ActivityIndicator size="small" color={COLORS.textSecondary} />
            : <Ionicons name={autoIrn.state === 'done' ? 'checkmark-circle' : 'alert-circle'} size={16} color={autoIrn.state === 'done' ? COLORS.positive : COLORS.negative} />}
          <Text style={[s.irnBarTxt, autoIrn.state === 'failed' && { color: COLORS.negative }]} numberOfLines={2}>
            {autoIrn.state === 'waiting' ? t('screens.salesInvoicePreview.irnWaiting', { defaultValue: 'Registering e-invoice…' })
              : autoIrn.state === 'done' ? `${t('screens.salesInvoicePreview.irnDone', { defaultValue: 'IRN generated' })} · ${String(autoIrn.irn).slice(0, 20)}…`
                : `${t('screens.salesInvoicePreview.irnFailed', { defaultValue: 'E-invoice not registered' })}${autoIrn.message ? ` · ${autoIrn.message}` : ''}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}
      {canConvertProforma && (
        <SafeAreaView edges={['bottom']} style={s.convertBar}>
          <TouchableOpacity
            style={[s.convertBtn, converting && { opacity: 0.7 }]}
            activeOpacity={0.85}
            disabled={converting}
            onPress={handleConvertProforma}
          >
            {converting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="repeat-outline" size={16} color={COLORS.white} />}
            <Text style={s.convertBtnTxt}>{converting ? t('screens.salesInvoicePreview.starting') : t('screens.salesInvoicePreview.convert')}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: COLORS.pageBg },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.white,
  },
  backBtn: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: SPACING.lg },
  loadingTxt: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
  errorTxt:   { fontSize: 14, color: COLORS.negative, textAlign: 'center' },
  retryBtn:   { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  retryTxt:   { fontSize: 14, color: COLORS.white, fontWeight: '600' },
  convertBar: { backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: 10 },
  convertBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  convertBtnTxt: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  irnBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault,
  },
  irnBarTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
});
