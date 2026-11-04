/**
 * E-Way Bill list — Ready / Needs attention / Generated / Incoming from
 * GET /ewaybills/readiness and /ewaybills/incoming (spec 2026-11-03 §4).
 * Generated tab: ⋯ actions (Part B, transporter, extend, refresh, cancel…),
 * multi-select → Consolidate, and the list of consolidated bills.
 * Spec 2026-11-04 §4.3: document kind tag, notice when Tally stopped syncing, Share report
 * (CSV), generate extras (delivery-note reason, receiving godown, distance worked out from
 * the PIN codes, Check vehicle) and Incoming from the stored list with "Reject by".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { safePush } from '../../src/utils/safeNavigation';
import StatusOnlyChip from '../../src/components/StatusOnlyChip';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import DatePickerModal, { formatDMY } from '../../src/components/forms/DatePickerModal';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useSettings } from '../../src/context/SettingsContext';
import {
  fetchEwbReadiness, generateEwb, generateEwbBulk, generateEinvoice, cancelEWayBill, updateEwbVehicle, updateEwbTransporter, extendEwb, refreshEwb,
  createConsolidatedEwb, listConsolidatedEwbs, listIncomingEwbs, listStoredIncomingEwbs, acceptIncomingEwb, rejectIncomingEwb,
  type ReadinessRow, type ReadinessResponse, type DispatchDetails, type StoredIncomingEwb,
} from '../../src/services/api';
import { shareCompliancePdfsAsMultiPage, companyFromAuth } from '../../src/utils/multiShare';
import { shareComplianceReport, shareEwbPdf, dmyToDdMmYyyy } from '../../src/utils/complianceActions';
import { canRejectIncoming, formatDayTime, formatWhen, rejectDeadline } from '../../src/utils/complianceRules';
import { ActionSheet, CancelSheet, GenerateEwbSheet, GenerateIrnSheet, type EwbGenerateExtra, type SheetAction } from '../../src/components/compliance/ComplianceSheets';
import { DocKindTag } from '../../src/components/compliance/ComplianceChips';
import { StaleDesktopBanner } from '../../src/components/compliance/ComplianceCallouts';
import { ConsolidateSheet, EwbExtendSheet, EwbTransporterSheet, EwbVehicleSheet } from '../../src/components/compliance/EwbForms';
import FixGapSheet from '../../src/components/compliance/FixGapSheet';
import { EWB_CANCEL_REASONS, complianceErrorText, firstGap, isNotConfiguredError, rowAmount, rowDate, rowEwbNo, rowNumber, rowParty } from '../../src/components/compliance/complianceShared';

type Tab = 'ready' | 'attention' | 'generated' | 'incoming';

export default function EWBListScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const { hasCapability } = useWorkspace();
  const canGenerate = hasCapability('eway.generate');
  const canUpdate = hasCapability('eway.update');
  const companyGuid = company?.guid || '';
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  // Notification deep links still use ?status=pending|generated.
  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const [statusOnly, setStatusOnly] = useState<string | null>(statusParam ? String(statusParam).toLowerCase() : null);
  const initialTab = tabParam || (statusParam === 'generated' ? 'generated' : statusParam === 'pending' ? 'ready' : undefined);

  const [tab, setTab] = useState<Tab>(initialTab === 'generated' || initialTab === 'attention' || initialTab === 'incoming' ? initialTab : 'ready');
  const [data, setData] = useState<{ ready: ReadinessRow[]; attention: ReadinessRow[]; generated: ReadinessRow[] }>({ ready: [], attention: [], generated: [] });
  const [counts, setCounts] = useState<Record<string, number>>({});
  // TallyPrime mode: e-way bills are made in Tally; the Ready rows are "Pending in Tally".
  const [integration, setIntegration] = useState<ReadinessResponse['integration']>(null);
  const tallyMode = integration?.source === 'tally';
  const [consolidated, setConsolidated] = useState<any[]>([]);
  const [loadedAt, setLoadedAt] = useState(0);
  const [incoming, setIncoming] = useState<any[]>([]);
  // Incoming reads the bills fetched twice a day (last 3 days); picking a date asks the portal for that day.
  const [incomingMode, setIncomingMode] = useState<'stored' | 'date'>('stored');
  const [stored, setStored] = useState<{ lastCheckedAt: number | null; rows: StoredIncomingEwb[] }>({ lastCheckedAt: null, rows: [] });
  // When the incoming list arrived: the reject deadlines on screen are measured against it (and again on the tap).
  const [incomingAt, setIncomingAt] = useState(0);
  const [incomingDate, setIncomingDate] = useState(formatDMY(new Date()));
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [showIncomingDate, setShowIncomingDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fromDate, setFromDate] = useState(selectedFY?.startDate || '');
  const [toDate, setToDate] = useState(selectedFY?.endDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busyGuid, setBusyGuid] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);

  // Sheets
  const [genRow, setGenRow] = useState<ReadinessRow | null>(null);
  const [irnRow, setIrnRow] = useState<ReadinessRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [fixRow, setFixRow] = useState<ReadinessRow | null>(null);
  const [actionRow, setActionRow] = useState<ReadinessRow | null>(null);
  const [cancelRow, setCancelRow] = useState<ReadinessRow | null>(null);
  const [vehicleRow, setVehicleRow] = useState<ReadinessRow | null>(null);
  const [transporterRow, setTransporterRow] = useState<ReadinessRow | null>(null);
  const [extendRow, setExtendRow] = useState<ReadinessRow | null>(null);
  const [consolidateOpen, setConsolidateOpen] = useState(false);

  const [prevFy, setPrevFy] = useState<string>('');
  const fyKey = `${selectedFY?.startDate}|${selectedFY?.endDate}`;
  if (prevFy !== fyKey) {
    setPrevFy(fyKey);
    if (selectedFY?.startDate) {
      setFromDate(selectedFY.startDate);
      setToDate(selectedFY.endDate || new Date().toISOString().split('T')[0]);
    }
  }

  // Loading flips in render when the inputs change (the lint rule forbids setState inside effects).
  const loadKey = `${companyGuid}|${fyInfoToParam(selectedFY) || ''}|${fromDate}|${toDate}|${reloadKey}`;
  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    if (companyGuid) setLoading(true);
  }
  const incomingKey = tab === 'incoming' && companyGuid ? `${companyGuid}|${incomingMode}|${incomingDate}|${reloadKey}` : '';
  const [prevIncomingKey, setPrevIncomingKey] = useState<string>('');
  if (prevIncomingKey !== incomingKey) {
    setPrevIncomingKey(incomingKey);
    if (incomingKey) setIncomingLoading(true);
  }

  const load = useCallback(() => {
    if (!companyGuid) return () => {};
    let cancelled = false;
    const fyParam = fyInfoToParam(selectedFY);
    const params = fromDate && toDate ? { from: fromDate, to: toDate } : (fyParam ? { fy: fyParam } : {});
    Promise.all([
      fetchEwbReadiness(companyGuid, params),
      listConsolidatedEwbs(companyGuid).catch(() => null),
    ])
      .then(([res, cons]: any[]) => {
        if (cancelled) return;
        const d = res?.data || {};
        setData({ ready: d.ready || [], attention: d.attention || [], generated: d.generated || [] });
        setCounts(res?.counts || {});
        setIntegration(res?.integration || null);
        setConsolidated(Array.isArray(cons?.data) ? cons.data : []);
        setLoadedAt(Date.now());
        setLoadError(null);
      })
      .catch((e: any) => { if (!cancelled) setLoadError(e?.message || t('screens.reportsEwbList.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyGuid, selectedFY, fromDate, toDate, t]);

  useEffect(() => load(), [load, reloadKey]);
  const refetch = () => setReloadKey((k) => k + 1);

  // Incoming (bills others generated on this GSTIN): the stored list by default, or the portal for one date.
  useEffect(() => {
    if (tab !== 'incoming' || !companyGuid) return;
    let cancelled = false;
    const request = incomingMode === 'stored'
      ? listStoredIncomingEwbs(companyGuid).then((res: any) => {
        if (cancelled) return;
        const d = res?.data || {};
        setStored({ lastCheckedAt: d.last_checked_at ?? null, rows: Array.isArray(d.rows) ? d.rows : [] });
      })
      : listIncomingEwbs(companyGuid, dmyToDdMmYyyy(incomingDate)).then((res: any) => {
        if (!cancelled) setIncoming(Array.isArray(res?.data) ? res.data : []);
      });
    request
      .then(() => { if (!cancelled) { setIncomingError(null); setIncomingAt(Date.now()); } })
      .catch((e: any) => { if (!cancelled) setIncomingError(e?.message || t('screens.reportsEwbList.loadFailed')); })
      .finally(() => { if (!cancelled) setIncomingLoading(false); });
    return () => { cancelled = true; };
  }, [tab, companyGuid, incomingMode, incomingDate, reloadKey, t]);
  const incomingRows: any[] = incomingMode === 'stored' ? stored.rows : incoming;

  const rows = tab === 'incoming' ? [] : data[tab];
  const selectMode = selected.length > 0;
  const toggleSelect = (guid: string) => setSelected((p) => (p.includes(guid) ? p.filter((g) => g !== guid) : [...p, guid]));
  const switchTab = (next: Tab) => { setTab(next); setSelected([]); };

  const kpis = useMemo(() => {
    const generated = counts.generated ?? data.generated.length;
    const ready = counts.ready ?? data.ready.length;
    const attention = counts.attention ?? data.attention.length;
    const expiring = counts.expiring ?? data.generated.filter((r) => {
      const till = r.ewb_valid_till || r.valid_till;
      if (!till) return false;
      const ms = new Date(till).getTime() - loadedAt;
      return ms > 0 && ms < 24 * 3600 * 1000;
    }).length;
    const covered = counts.value_covered ?? 0;
    const pending = counts.value_pending ?? 0;
    const required = generated + ready + attention;
    const coverage = required > 0 ? Math.round((generated / required) * 100) : 0;
    return [
      { key: 'generated', label: t('screens.reportsEwbList.kpiGenerated', { defaultValue: 'Generated' }), value: String(generated), sub: covered ? formatAmountCompact(covered) : '', color: COLORS.positive },
      { key: 'ready', label: t('screens.reportsEwbList.kpiReady', { defaultValue: 'Ready' }), value: String(ready), sub: pending ? formatAmountCompact(pending) : '', color: COLORS.info },
      { key: 'attention', label: t('screens.reportsEwbList.kpiAttention', { defaultValue: 'Needs attention' }), value: String(attention), sub: '', color: COLORS.warning },
      { key: 'expiring', label: t('screens.reportsEwbList.kpiExpiring', { defaultValue: 'Expiring (24 h)' }), value: String(expiring), sub: '', color: COLORS.negative },
      { key: 'coverage', label: t('screens.reportsEwbList.kpiCoverage', { defaultValue: 'Coverage' }), value: `${coverage}%`, sub: '', color: COLORS.textPrimary },
    ];
  }, [counts, data, loadedAt, t, formatAmountCompact]);

  // ── Generate ──────────────────────────────────────────────────────────────
  const showError = (title: string, err: any) => {
    if (isNotConfiguredError(err)) {
      Alert.alert(title, t('screens.reportsEwbList.notConfiguredMsg', { defaultValue: 'E-way bill credentials are not set up for this company. Go to Settings → E-way bill.' }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('screens.reportsEinvoiceList.goToSettings'), onPress: () => safePush(router, '/settings/ewb' as any) },
      ]);
      return;
    }
    Alert.alert(title, complianceErrorText(err, t));
  };

  const runGenerate = async (row: ReadinessRow, dispatchDetails: DispatchDetails, extra: EwbGenerateExtra = {}) => {
    if (!companyGuid) return;
    setSheetBusy(true);
    try {
      const res: any = await generateEwb({ companyGuid, voucherGuid: row.guid, dispatchDetails, ...extra });
      if (res?.success === false) throw new Error(res?.error?.message || t('screens.reportsEwbList.unknownError', { defaultValue: 'Unknown error' }));
      setGenRow(null);
      const d = res?.data ?? {};
      const km = d.distance_km != null && d.distance_km !== '' ? Number(d.distance_km) : null;
      Alert.alert(
        t('screens.reportsEwbList.generated', { defaultValue: 'E-way bill generated' }),
        [
          d.ewbNo ? `EWB ${d.ewbNo}` : '',
          d.validUpto || d.ewbValidUpto ? `${t('screens.reportsEwbList.validTill', { defaultValue: 'Valid till' })} ${d.validUpto || d.ewbValidUpto}` : '',
          km != null && Number.isFinite(km) ? t(dispatchDetails.distance ? 'screens.reportsEwbList.distanceResult' : 'screens.reportsEwbList.distanceWorkedOut', { km }) : '',
        ].filter(Boolean).join('\n') || undefined,
      );
      refetch();
    } catch (err: any) {
      showError(t('screens.reportsEwbList.generateFailed', { defaultValue: 'Could not generate' }), err);
    } finally {
      setSheetBusy(false);
    }
  };

  const runBulk = async (dispatchDetails: DispatchDetails) => {
    if (!companyGuid || !selected.length) return;
    setSheetBusy(true);
    try {
      const res: any = await generateEwbBulk({ companyGuid, voucherGuids: selected.slice(0, 50), dispatchDetails });
      const d = res?.data ?? res ?? {};
      const results: any[] = Array.isArray(d.results) ? d.results : [];
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      setBulkOpen(false);
      setSelected([]);
      Alert.alert(
        t('screens.reportsEwbList.bulkDone', { ok, total: results.length, defaultValue: '{{ok}} of {{total}} generated' }),
        failed.slice(0, 6).map((r) => `${r.voucher_number || r.voucherGuid}: ${r.message || ''}`).join('\n') || undefined,
      );
      refetch();
    } catch (err: any) {
      showError(t('screens.reportsEwbList.generateFailed', { defaultValue: 'Could not generate' }), err);
    } finally {
      setSheetBusy(false);
    }
  };

  /** `IRN_REQUIRED` gap: register the e-invoice first (with the e-way bill in the same call). */
  const runGenerateIrn = async (row: ReadinessRow, opts: { alsoEwb: boolean; dispatchDetails?: DispatchDetails }) => {
    if (!companyGuid) return;
    setSheetBusy(true);
    try {
      const res: any = await generateEinvoice({ companyGuid, voucherGuid: row.guid, alsoEwb: opts.alsoEwb, dispatchDetails: opts.dispatchDetails });
      if (res?.success === false) throw new Error(res?.error?.message || t('screens.reportsEinvoiceList.unknownError'));
      setIrnRow(null);
      Toast.show({ type: 'success', text1: t('screens.reportsEinvoiceList.irnGenerated'), text2: res?.data?.ewbNo ? `EWB ${res.data.ewbNo}` : undefined });
      refetch();
    } catch (err: any) {
      showError(t('screens.reportsEinvoiceList.irnFailed'), err);
    } finally {
      setSheetBusy(false);
    }
  };

  // ── ⋯ actions on generated rows ───────────────────────────────────────────
  const actionsFor = (row: ReadinessRow): SheetAction[] => {
    const status = String(row.status || '').toLowerCase();
    // A bill generated in TallyPrime is shown, not managed: Part B, extensions and cancellation happen in Tally.
    const active = status !== 'cancelled' && status !== 'expired' && row.source !== 'tally';
    const partB = !row.vehicle_no;
    return [
      { key: 'view', label: t('common.view'), icon: 'document-text-outline' },
      { key: 'share', label: t('pdf.sharePdf'), icon: 'share-outline' },
      ...(active && canUpdate ? [
        { key: 'vehicle', label: partB ? t('screens.reportsEwbList.completePartB', { defaultValue: 'Complete Part B' }) : t('screens.reportsEwbList.updateVehicle', { defaultValue: 'Update vehicle' }), icon: 'car-outline' },
        { key: 'transporter', label: t('screens.reportsEwbList.updateTransporter', { defaultValue: 'Update transporter' }), icon: 'people-outline' },
        { key: 'extend', label: t('screens.reportsEwbList.extendValidity', { defaultValue: 'Extend validity' }), icon: 'hourglass-outline' },
      ] : []),
      ...(row.source !== 'tally' ? [{ key: 'refresh', label: t('screens.reportsEinvoiceList.refreshStatus', { defaultValue: 'Refresh status' }), icon: 'refresh-outline' }] : []),
      ...(active && canUpdate ? [{ key: 'cancel', label: t('screens.reportsEwbList.cancelBill', { defaultValue: 'Cancel e-way bill' }), icon: 'close-circle-outline', destructive: true }] : []),
      { key: 'history', label: t('screens.reportsEinvoiceList.viewHistory', { defaultValue: 'View history' }), icon: 'time-outline' },
    ];
  };

  const onAction = async (row: ReadinessRow, key: string) => {
    if (!companyGuid) return;
    const guid = row.guid;
    switch (key) {
      case 'view':
        safePush(router, `/reports/compliance-detail?voucherGuid=${encodeURIComponent(guid)}&domain=ewaybill` as any);
        return;
      case 'history':
        safePush(router, `/reports/compliance-history?voucherGuid=${encodeURIComponent(guid)}` as any);
        return;
      case 'share':
        setBusyGuid(guid);
        await shareEwbPdf(companyGuid, row, company, () => setBusyGuid(null));
        setBusyGuid(null);
        return;
      case 'vehicle': setVehicleRow(row); return;
      case 'transporter': setTransporterRow(row); return;
      case 'extend': setExtendRow(row); return;
      case 'cancel': setCancelRow(row); return;
      case 'refresh':
        setBusyGuid(guid);
        try {
          const res: any = await refreshEwb(companyGuid, guid);
          const d = res?.data ?? res ?? {};
          Toast.show({ type: 'success', text1: t('screens.reportsEinvoiceList.statusRefreshed', { defaultValue: 'Status refreshed' }), text2: d.status ? String(d.status) : undefined });
          if (d.changed !== false) refetch();
        } catch (e: any) {
          Alert.alert(t('common.error'), complianceErrorText(e, t));
        } finally { setBusyGuid(null); }
        return;
      default: return;
    }
  };

  const wrap = async (fn: () => Promise<any>, successText: string, close: () => void) => {
    setSheetBusy(true);
    try {
      const res: any = await fn();
      if (res?.success === false) throw new Error(res?.error?.message || t('screens.reportsEwbList.unknownError', { defaultValue: 'Unknown error' }));
      close();
      Toast.show({ type: 'success', text1: successText });
      refetch();
    } catch (err: any) {
      Alert.alert(t('common.error'), complianceErrorText(err, t));
    } finally {
      setSheetBusy(false);
    }
  };

  // ── Multi-select share / consolidate ──────────────────────────────────────
  const handleShareSelected = async () => {
    const items = data.generated.filter((r) => selected.includes(r.guid) && !!rowEwbNo(r));
    if (!items.length) {
      Toast.show({ type: 'info', text1: t('screens.reportsEwbList.nothingToShare'), text2: t('screens.reportsEwbList.nothingToShareSub') });
      return;
    }
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { shared, failed } = await shareCompliancePdfsAsMultiPage(
        'ewaybill',
        items.map((r) => ({
          ewbNo: rowEwbNo(r), ewbDate: r.ewb_date || rowDate(r), validTill: r.ewb_valid_till || r.valid_till || '', vehicleNo: r.vehicle_no || '',
          transporterId: r.transporter_id || '', voucherNumber: rowNumber(r), voucherType: r.voucher_type || '', date: rowDate(r), partyName: rowParty(r), amount: rowAmount(r),
        })),
        companyFromAuth(company),
        { fileName: `E-Way-Bills (${items.length}).pdf`, onBeforeShare: () => setIsSharing(false) },
      );
      if (failed > 0) Toast.show({ type: 'info', text1: t('screens.reportsEwbList.sharedOf', { shared, total: items.length }), text2: t('screens.reportsEwbList.failedBuild', { failed }) });
      setSelected([]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('screens.reportsEwbList.shareFailed'));
    } finally {
      setIsSharing(false);
    }
  };

  const selectedActiveEwbNos = data.generated
    .filter((r) => selected.includes(r.guid) && !!rowEwbNo(r) && !['cancelled', 'expired'].includes(String(r.status || '').toLowerCase()))
    .map((r) => rowEwbNo(r));

  const runConsolidate = (body: { fromPlace: string; fromState: string; vehicleNo: string; transMode: string; transDocNo?: string; transDocDate?: string }) =>
    wrap(
      () => createConsolidatedEwb({ companyGuid, ewbNos: selectedActiveEwbNos, ...body }),
      t('screens.reportsEwbList.consolidated', { defaultValue: 'Consolidated e-way bill created' }),
      () => { setConsolidateOpen(false); setSelected([]); },
    );

  // ── Incoming accept / reject ──────────────────────────────────────────────
  const decideIncoming = (ewbNo: string, decision: 'accept' | 'reject', rejectBy?: number | null) => {
    const go = async () => {
      setBusyGuid(ewbNo);
      try {
        if (decision === 'accept') await acceptIncomingEwb(companyGuid, ewbNo);
        else await rejectIncomingEwb(companyGuid, ewbNo);
        const mark = (b: any) => (String(b.ewbNo || b.ewb_no) === ewbNo ? { ...b, decision: decision === 'accept' ? 'accepted' : 'rejected' } : b);
        setIncoming((prev) => prev.map(mark));
        setStored((prev) => ({ ...prev, rows: prev.rows.map(mark) }));
      } catch (e: any) {
        Alert.alert(t('common.error'), complianceErrorText(e, t));
      } finally {
        setBusyGuid(null);
      }
    };
    if (decision === 'reject') {
      if (!canRejectIncoming(rejectBy)) {
        Alert.alert(t('screens.reportsEwbList.rejectClosed'));
        refetch();
        return;
      }
      Alert.alert(
        t('screens.reportsEwbList.rejectTitle', { defaultValue: 'Reject this e-way bill?' }),
        t('screens.reportsEwbList.rejectMsg', { defaultValue: 'The rejection is sent to the portal and cannot be undone.' }),
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('screens.reportsEwbList.reject', { defaultValue: 'Reject' }), style: 'destructive', onPress: go }],
      );
    } else go();
  };

  // ── Share report (CSV of the open tab and period) ─────────────────────────
  const handleShareReport = async () => {
    if (!companyGuid || sharingReport || tab === 'incoming') return;
    setSharingReport(true);
    try {
      await shareComplianceReport('ewaybill', companyGuid, company?.name, { tab, ...(fromDate && toDate ? { from: fromDate, to: toDate } : {}) });
    } catch (err: any) {
      Alert.alert(t('screens.reportsEinvoiceList.reportFailed'), err?.message || t('screens.reportsEwbList.unknownError', { defaultValue: 'Unknown error' }));
    } finally {
      setSharingReport(false);
    }
  };

  // ── Rows ──────────────────────────────────────────────────────────────────
  const renderRow = (row: ReadinessRow) => {
    const guid = row.guid;
    const isSelected = selected.includes(guid);
    const busy = busyGuid === guid;
    const gap = tab === 'attention' ? firstGap(row) : null;
    const moreGaps = tab === 'attention' && Array.isArray(row.gaps) ? row.gaps.length - 1 : 0;
    const status = String(row.status || 'generated').toLowerCase();
    const badge = status === 'cancelled' ? { bg: COLORS.hoverBg, fg: COLORS.textSecondary, label: t('screens.reportsEwbList.statusCancelled', { defaultValue: 'Cancelled' }) }
      : status === 'expired' ? { bg: COLORS.negativeBg, fg: COLORS.negative, label: t('screens.reportsEwbList.statusExpired', { defaultValue: 'Expired' }) }
        : { bg: COLORS.positiveBg, fg: COLORS.positive, label: t('screens.reportsEwbList.statusActive', { defaultValue: 'Active' }) };
    const validTill = row.ewb_valid_till || row.valid_till;
    const transport = row.preview?.transport;
    const transportLabel = transport?.has
      ? (transport.vehicle ? `${t('screens.reportsEwbList.vehicle', { defaultValue: 'Vehicle' })} ${transport.vehicle}` : t('screens.reportsEwbList.transporter', { defaultValue: 'Transporter' }))
      : '';
    return (
      <TouchableOpacity
        key={guid}
        style={[s.card, isSelected && s.cardSelected]}
        onPress={() => {
          if (selectMode) toggleSelect(guid);
          else safePush(router, `/reports/compliance-detail?voucherGuid=${encodeURIComponent(guid)}&domain=ewaybill` as any);
        }}
        onLongPress={() => { if (tab !== 'attention') toggleSelect(guid); }}
        delayLongPress={400}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <Text style={s.invoiceNo}>{rowNumber(row)}</Text>
          <Text style={s.dateTxt}>{rowDate(row) ? formatDate(rowDate(row)) : ''}</Text>
          <View style={{ flex: 1 }} />
          {tab === 'generated' && row.source === 'tally' && (
            <View style={[s.badge, { backgroundColor: COLORS.hoverBg, marginRight: 6 }]}>
              <Text style={[s.badgeTxt, { color: COLORS.textSecondary }]}>{t('screens.reportsEinvoiceList.fromTally', { defaultValue: 'From Tally' })}</Text>
            </View>
          )}
          {tab === 'generated' && (
            <View style={[s.badge, { backgroundColor: badge.bg }]}>
              <Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.label}</Text>
            </View>
          )}
          {tab === 'generated' && (
            <TouchableOpacity style={s.moreBtn} onPress={() => setActionRow(row)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              {busy ? <ActivityIndicator size="small" color={COLORS.textSecondary} /> : <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSecondary} />}
            </TouchableOpacity>
          )}
        </View>
        <View style={s.cardBody}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.party} numberOfLines={1}>{rowParty(row) || t('screens.reportsEinvoiceList.unknown')}</Text>
            {tab === 'generated' && !!rowEwbNo(row) && (
              <Text style={s.meta}>
                EWB {rowEwbNo(row)}
                {row.vehicle_no ? ` · ${row.vehicle_no}` : ''}
                {validTill ? ` · ${t('screens.reportsEwbList.validTill', { defaultValue: 'Valid till' })} ${formatDate(String(validTill))}` : ''}
              </Text>
            )}
            {tab === 'attention' && !!gap && (
              <Text style={s.gapTxt} numberOfLines={2}>
                {gap.message}{moreGaps > 0 ? ` ${t('screens.reportsEinvoiceList.moreGaps', { count: moreGaps, defaultValue: '+{{count}} more' })}` : ''}
              </Text>
            )}
          </View>
          <Text style={s.amount}>{formatAmount(rowAmount(row))}</Text>
        </View>
        <View style={s.cardFoot}>
          <DocKindTag kind={row.doc_kind} />
          {tab === 'ready' && !!transportLabel && (
            <View style={s.transportChip}>
              <Ionicons name="car-outline" size={12} color={COLORS.textSecondary} />
              <Text style={s.transportTxt}>{transportLabel}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {tab === 'ready' && (tallyMode || row.pending_in_tally) && (
            <View style={[s.badge, { backgroundColor: COLORS.hoverBg }]}>
              <Text style={[s.badgeTxt, { color: COLORS.textSecondary }]}>{t('screens.reportsEinvoiceList.pendingInTally', { defaultValue: 'Pending in Tally' })}</Text>
            </View>
          )}
          {tab === 'ready' && canGenerate && !tallyMode && !row.pending_in_tally && (
            <TouchableOpacity style={s.primaryBtn} onPress={() => setGenRow(row)} activeOpacity={0.85}>
              <Ionicons name="flash-outline" size={14} color={COLORS.white} />
              <Text style={s.primaryBtnTxt}>{t('screens.reportsEinvoiceList.generate', { defaultValue: 'Generate' })}</Text>
            </TouchableOpacity>
          )}
          {tab === 'attention' && (
            <TouchableOpacity style={s.outlineBtn} onPress={() => setFixRow(row)} activeOpacity={0.85}>
              <Ionicons name="build-outline" size={14} color={COLORS.brandPrimary} />
              <Text style={s.outlineBtnTxt}>{t('screens.reportsEinvoiceList.fix', { defaultValue: 'Fix' })}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderIncoming = (b: any, idx: number) => {
    const ewbNo = String(b.ewbNo || b.ewb_no || '');
    const decision = String(b.decision || '').toLowerCase();
    const busy = busyGuid === ewbNo;
    // Stored and by-date rows carry reject_by: the portal takes a rejection until 72 hours after generation.
    const rejectBy = !decision ? rejectDeadline(b.reject_by) : null;
    const rejectClosed = !!rejectBy && !canRejectIncoming(b.reject_by, incomingAt);
    return (
      <View key={ewbNo || String(idx)} style={s.card}>
        <View style={s.cardTop}>
          <Text style={s.invoiceNo}>EWB {ewbNo}</Text>
          <Text style={s.dateTxt}>{String(b.ewbDate || b.ewb_date || '')}</Text>
          <View style={{ flex: 1 }} />
          {!!decision && (
            <View style={[s.badge, { backgroundColor: decision === 'accepted' ? COLORS.positiveBg : COLORS.negativeBg }]}>
              <Text style={[s.badgeTxt, { color: decision === 'accepted' ? COLORS.positive : COLORS.negative }]}>
                {decision === 'accepted' ? t('screens.reportsEwbList.accepted', { defaultValue: 'Accepted' }) : t('screens.reportsEwbList.rejected', { defaultValue: 'Rejected' })}
              </Text>
            </View>
          )}
        </View>
        <View style={s.cardBody}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.party} numberOfLines={1}>{String(b.fromTrdName || b.from_name || b.userGstin || b.fromGstin || '')}</Text>
            <Text style={s.meta}>{[b.fromGstin || b.from_gstin, b.docNo || b.doc_no, b.vehicleNo || b.vehicle_no].filter(Boolean).join(' · ')}</Text>
            {!!rejectBy && (
              <Text style={[s.meta, { color: rejectClosed ? COLORS.textTertiary : COLORS.warning, fontWeight: '600' }]}>
                {rejectClosed ? t('screens.reportsEwbList.rejectClosed') : t('screens.reportsEwbList.rejectBy', { when: formatDayTime(rejectBy) })}
              </Text>
            )}
          </View>
          <Text style={s.amount}>{formatAmount(Number(b.totInvValue || b.totalInvoiceValue || b.amount || b.value || 0))}</Text>
        </View>
        {!decision && (
          <View style={s.cardFoot}>
            <View style={{ flex: 1 }} />
            {busy ? <ActivityIndicator size="small" color={COLORS.brandPrimary} /> : (
              <>
                {!rejectClosed && (
                  <TouchableOpacity style={s.outlineBtn} onPress={() => decideIncoming(ewbNo, 'reject', b.reject_by)} activeOpacity={0.85}>
                    <Text style={[s.outlineBtnTxt, { color: COLORS.negative }]}>{t('screens.reportsEwbList.reject', { defaultValue: 'Reject' })}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.primaryBtn} onPress={() => decideIncoming(ewbNo, 'accept')} activeOpacity={0.85}>
                  <Text style={s.primaryBtnTxt}>{t('screens.reportsEwbList.accept', { defaultValue: 'Accept' })}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'ready', label: tallyMode ? t('screens.reportsEinvoiceList.tabPendingInTally', { defaultValue: 'Pending in Tally' }) : t('screens.reportsEwbList.tabReady', { defaultValue: 'Ready' }), count: data.ready.length },
    { key: 'attention', label: t('screens.reportsEwbList.tabAttention', { defaultValue: 'Attention' }), count: data.attention.length },
    { key: 'generated', label: t('screens.reportsEwbList.tabGenerated', { defaultValue: 'Generated' }), count: data.generated.length },
    { key: 'incoming', label: t('screens.reportsEwbList.tabIncoming', { defaultValue: 'Incoming' }) },
  ];

  const actionRecord = (row: ReadinessRow | null) => (row ? { ewb_no: rowEwbNo(row), vehicle_no: row.vehicle_no, transporter_id: row.transporter_id } : null);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('reports.ewayBills')}</Text>
        {tab !== 'incoming' && (
          <TouchableOpacity style={s.backBtn} onPress={handleShareReport} disabled={sharingReport} activeOpacity={0.7} accessibilityLabel={t('screens.reportsEinvoiceList.shareReport')} testID="ewb-share-report">
            {sharingReport ? <ActivityIndicator size="small" color={COLORS.textSecondary} /> : <Ionicons name="download-outline" size={20} color={COLORS.textSecondary} />}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.backBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20} color={fromDate ? COLORS.brandPrimary : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={refetch} />}
      >
        {loadError && <ErrorBanner message={loadError} onRetry={refetch} />}
        <StaleDesktopBanner desktop={integration?.desktop} />
        {statusOnly ? (
          <View style={{ paddingTop: SPACING.sm }}>
            <StatusOnlyChip status={statusOnly} onClear={() => { setStatusOnly(null); switchTab('ready'); }} />
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.kpiRow}>
          {kpis.map((k) => (
            <View key={k.key} style={s.kpiCard}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
              {!!k.sub && <Text style={s.kpiSub}>{k.sub}</Text>}
            </View>
          ))}
        </ScrollView>

        <View style={s.tabRow}>
          {tabs.map((tb) => (
            <TouchableOpacity key={tb.key} style={[s.tabBtn, tab === tb.key && s.tabActive]} onPress={() => switchTab(tb.key)} activeOpacity={0.7}>
              <Text style={[s.tabTxt, tab === tb.key && s.tabActiveTxt]} numberOfLines={1}>{tb.label}{tb.count != null ? ` (${tb.count})` : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'generated' && (
          <View style={s.toolbar}>
            <Text style={s.toolbarHint}>{t('screens.reportsEwbList.consolidateHint', { defaultValue: 'Long-press active bills to consolidate or share.' })}</Text>
            {selectedActiveEwbNos.length > 0 && canUpdate && (
              <TouchableOpacity style={s.toolbarBtn} onPress={() => setConsolidateOpen(true)} activeOpacity={0.8}>
                <Ionicons name="layers-outline" size={14} color={COLORS.brandPrimary} />
                <Text style={s.toolbarBtnTxt}>{t('screens.reportsEwbList.consolidateCount', { count: selectedActiveEwbNos.length, defaultValue: 'Consolidate ({{count}})' })}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {tab === 'incoming' && (
          <TouchableOpacity style={s.datePill} onPress={() => setShowIncomingDate(true)} activeOpacity={0.7} testID="incoming-date-pill">
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
            <Text style={s.dateTxtPill}>{incomingMode === 'stored' ? t('screens.reportsEwbList.last3Days') : incomingDate}</Text>
            {incomingMode === 'date' ? (
              <TouchableOpacity onPress={() => setIncomingMode('stored')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={16} color={COLORS.brandPrimary} />
              </TouchableOpacity>
            ) : <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />}
          </TouchableOpacity>
        )}
        {tab === 'incoming' && incomingMode === 'stored' && !!stored.lastCheckedAt && (
          <Text style={[s.toolbarHint, { marginBottom: SPACING.sm }]}>
            {t('screens.reportsEwbList.lastChecked', { when: formatWhen(new Date(Number(stored.lastCheckedAt) * (Number(stored.lastCheckedAt) < 1e12 ? 1000 : 1)), incomingAt) })}
          </Text>
        )}

        {tab === 'incoming' ? (
          <>
            {incomingError && <ErrorBanner message={incomingError} onRetry={refetch} />}
            {incomingLoading && <ActivityIndicator color={COLORS.brandPrimary} style={{ marginTop: 32 }} />}
            {!incomingLoading && incomingRows.length === 0 && !incomingError && (
              <View style={s.empty}>
                <Ionicons name="download-outline" size={40} color={COLORS.textTertiary} />
                <Text style={s.emptyTitle}>
                  {incomingMode === 'stored'
                    ? t('screens.reportsEwbList.emptyIncomingStored')
                    : t('screens.reportsEwbList.emptyIncoming', { defaultValue: 'No e-way bills were generated on your GSTIN that day' })}
                </Text>
              </View>
            )}
            {!incomingLoading && incomingRows.map(renderIncoming)}
          </>
        ) : (
          <>
            {loading && rows.length === 0 && <ActivityIndicator color={COLORS.brandPrimary} style={{ marginTop: 32 }} />}
            {!loading && rows.length === 0 && !loadError && (
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={40} color={COLORS.textTertiary} />
                <Text style={s.emptyTitle}>
                  {tab === 'ready' ? t('screens.reportsEwbList.emptyReady', { defaultValue: 'Nothing ready to generate' })
                    : tab === 'attention' ? t('screens.reportsEwbList.emptyAttention', { defaultValue: 'Nothing needs attention' })
                      : t('screens.reportsEwbList.emptyTitle')}
                </Text>
              </View>
            )}
            {rows.map(renderRow)}
          </>
        )}

        {tab === 'generated' && consolidated.length > 0 && (
          <View style={s.consBox}>
            <Text style={s.consTitle}>{t('screens.reportsEwbList.consolidatedBills', { defaultValue: 'Consolidated bills' })}</Text>
            {consolidated.map((c, i) => (
              <View key={String(c.cewb_no || c.id || i)} style={s.consRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.consNo}>{String(c.cewb_no || '')}</Text>
                  <Text style={s.meta}>{[c.vehicle_no, c.cewb_date].filter(Boolean).join(' · ')}</Text>
                </View>
                <Text style={s.meta}>{t('screens.reportsEwbList.billsCount', { count: Array.isArray(c.ewb_nos) ? c.ewb_nos.length : 0, defaultValue: '{{count}} bills' })}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: selectMode ? 90 : 40 }} />
      </ScrollView>

      {selectMode && (
        <View style={[s.selectBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.selectLeft}>
            <Text style={s.selectCount}>{t('common.selected', { count: selected.length })}</Text>
            <TouchableOpacity onPress={() => setSelected(rows.map((r) => r.guid))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.selectLink}>{t('ledger.selectAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected([])} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.selectLink}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          {tab === 'ready' ? (
            <TouchableOpacity style={s.selectAction} onPress={() => setBulkOpen(true)} activeOpacity={0.85} disabled={!canGenerate}>
              <Ionicons name="flash-outline" size={16} color={COLORS.white} />
              <Text style={s.selectActionTxt}>{t('screens.reportsEinvoiceList.generateCount', { count: selected.length, defaultValue: 'Generate ({{count}})' })}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.selectAction, isSharing && { opacity: 0.6 }]} onPress={handleShareSelected} activeOpacity={0.85} disabled={isSharing}>
              {isSharing ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="share-outline" size={16} color={COLORS.white} />}
              <Text style={s.selectActionTxt}>{isSharing ? t('screens.reportsEwbList.preparing') : t('pdf.sharePdf')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate || selectedFY?.startDate || ''}
        toDate={toDate || selectedFY?.endDate || ''}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
        onApply={(from, to) => { setFromDate(from); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
      <DatePickerModal
        visible={showIncomingDate}
        value={incomingDate}
        title={t('screens.reportsEwbList.incomingDate', { defaultValue: 'Bills generated on' })}
        maxDate={new Date().toISOString().slice(0, 10)}
        onSelect={(d) => { setIncomingDate(d); setIncomingMode('date'); setShowIncomingDate(false); }}
        onClose={() => setShowIncomingDate(false)}
      />

      <GenerateEwbSheet visible={!!genRow} row={genRow} busy={sheetBusy} onClose={() => setGenRow(null)} onConfirm={(d, extra) => genRow && runGenerate(genRow, d, extra)} />
      <GenerateEwbSheet visible={bulkOpen} row={null} bulkCount={selected.length} busy={sheetBusy} onClose={() => setBulkOpen(false)} onConfirm={runBulk} />
      <GenerateIrnSheet visible={!!irnRow} row={irnRow} busy={sheetBusy} onClose={() => setIrnRow(null)} onConfirm={(o) => irnRow && runGenerateIrn(irnRow, o)} />
      <FixGapSheet visible={!!fixRow} row={fixRow} companyGuid={companyGuid} companyName={company?.name} onClose={() => setFixRow(null)} onSaved={refetch} onRegisterEinvoiceFirst={(r) => setIrnRow(r)} />
      <ActionSheet
        visible={!!actionRow}
        title={actionRow ? `${rowNumber(actionRow)} · ${rowParty(actionRow)}` : ''}
        actions={actionRow ? actionsFor(actionRow) : []}
        onClose={() => setActionRow(null)}
        onSelect={(key) => { const r = actionRow; setActionRow(null); if (r) onAction(r, key); }}
      />
      <CancelSheet
        visible={!!cancelRow}
        title={t('screens.reportsEwbList.cancelBill', { defaultValue: 'Cancel e-way bill' })}
        hint={t('screens.reportsEwbList.cancelHint', { defaultValue: 'The portal allows cancellation within 24 hours of generation.' })}
        reasons={EWB_CANCEL_REASONS(t)}
        busy={sheetBusy}
        onClose={() => setCancelRow(null)}
        onConfirm={(reason, remarks) => cancelRow && wrap(
          () => cancelEWayBill({ companyGuid, voucherGuid: cancelRow.guid, cancelReason: Number(reason), cancelRemarks: remarks }),
          t('screens.reportsEwbList.cancelled', { defaultValue: 'E-way bill cancelled' }),
          () => setCancelRow(null),
        )}
      />
      {vehicleRow && (
        <EwbVehicleSheet
          visible
          record={actionRecord(vehicleRow)}
          busy={sheetBusy}
          onClose={() => setVehicleRow(null)}
          onSubmit={(body) => wrap(() => updateEwbVehicle(companyGuid, vehicleRow.guid, body), t('screens.reportsEwbList.vehicleUpdated', { defaultValue: 'Vehicle updated' }), () => setVehicleRow(null))}
        />
      )}
      {transporterRow && (
        <EwbTransporterSheet
          visible
          current={transporterRow.transporter_id}
          busy={sheetBusy}
          onClose={() => setTransporterRow(null)}
          onSubmit={(id) => wrap(() => updateEwbTransporter(companyGuid, transporterRow.guid, id), t('screens.reportsEwbList.transporterUpdated', { defaultValue: 'Transporter updated' }), () => setTransporterRow(null))}
        />
      )}
      {extendRow && (
        <EwbExtendSheet
          visible
          record={actionRecord(extendRow)}
          busy={sheetBusy}
          onClose={() => setExtendRow(null)}
          onSubmit={(body) => wrap(() => extendEwb(companyGuid, extendRow.guid, body), t('screens.reportsEwbList.extended', { defaultValue: 'Validity extended' }), () => setExtendRow(null))}
        />
      )}
      {consolidateOpen && (
        <ConsolidateSheet visible ewbNos={selectedActiveEwbNos} busy={sheetBusy} onClose={() => setConsolidateOpen(false)} onSubmit={runConsolidate} />
      )}
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
  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },

  kpiRow: { gap: 8, paddingVertical: SPACING.sm },
  kpiCard: { minWidth: 104, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, paddingHorizontal: 12, paddingVertical: 10 },
  kpiLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  kpiValue: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', marginTop: 2 },
  kpiSub: { fontSize: 10, color: COLORS.textTertiary, marginTop: 2 },

  tabRow: { flexDirection: 'row', backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, padding: 3, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: SPACING.sm },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  tabActiveTxt: { color: COLORS.textPrimary },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  toolbarHint: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 7, paddingHorizontal: 12 },
  toolbarBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.cardBg, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.borderDefault, marginBottom: SPACING.sm },
  dateTxtPill: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },

  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },

  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginBottom: SPACING.sm, gap: 8 },
  cardSelected: { borderColor: COLORS.brandPrimary, borderWidth: 2, backgroundColor: COLORS.brandPrimary + '06' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  invoiceNo: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  dateTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  moreBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  party: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  gapTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, fontWeight: '600', lineHeight: 16 },
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 4 },
  transportChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  transportTxt: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14 },
  primaryBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14 },
  outlineBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },

  consBox: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md, marginTop: SPACING.sm },
  consTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  consRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  consNo: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },

  selectBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14, backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  selectLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  selectCount: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  selectLink: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  selectAction: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: COLORS.brandPrimary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md },
  selectActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
