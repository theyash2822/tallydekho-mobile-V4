/**
 * E-Invoice list — Ready / Needs attention / Generated from GET /einvoice/readiness
 * (spec 2026-11-03 §4). Coverage numbers live in the header KPIs; the old
 * coverage screen redirects here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { safePush } from '../../src/utils/safeNavigation';
import StatusOnlyChip from '../../src/components/StatusOnlyChip';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth, fyInfoToParam } from '../../src/context/AuthContext';
import { useWorkspace } from '../../src/context/WorkspaceContext';
import { useSettings } from '../../src/context/SettingsContext';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import {
  fetchEinvoiceReadiness, generateEinvoice, generateEinvoiceBulk, generateEwb, verifyEinvoice, refreshEinvoice, cancelEInvoice,
  type ReadinessRow, type DispatchDetails,
} from '../../src/services/api';
import { shareCompliancePdfsAsMultiPage, companyFromAuth } from '../../src/utils/multiShare';
import { shareEinvoicePdf, shareSignedJson } from '../../src/utils/complianceActions';
import {
  ActionSheet, CancelSheet, GenerateEwbSheet, GenerateIrnBulkSheet, GenerateIrnSheet, VerifyResultSheet, type SheetAction,
} from '../../src/components/compliance/ComplianceSheets';
import FixGapSheet from '../../src/components/compliance/FixGapSheet';
import { complianceErrorText, firstGap, isNotConfiguredError, rowAmount, rowDate, rowEwbNo, rowIrn, rowNumber, rowParty } from '../../src/components/compliance/complianceShared';

type Tab = 'ready' | 'attention' | 'generated';

export default function EInvoiceListScreen() {
  const { t } = useTranslation();
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const { hasCapability } = useWorkspace();
  const canGenerate = hasCapability('einvoice.generate');
  const canUpdate = hasCapability('einvoice.update');
  const canEwb = hasCapability('eway.generate');
  const companyGuid = company?.guid || '';
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  // Notification deep links still use ?status=pending|generated.
  const { status: statusParam } = useLocalSearchParams<{ status?: string }>();
  const [statusOnly, setStatusOnly] = useState<string | null>(statusParam ? String(statusParam).toLowerCase() : null);
  const initialTab = tabParam || (statusParam === 'generated' ? 'generated' : statusParam === 'pending' ? 'ready' : undefined);

  const [tab, setTab] = useState<Tab>(initialTab === 'generated' || initialTab === 'attention' ? initialTab : 'ready');
  const [data, setData] = useState<{ ready: ReadinessRow[]; attention: ReadinessRow[]; generated: ReadinessRow[] }>({ ready: [], attention: [], generated: [] });
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [fromDate, setFromDate] = useState(selectedFY?.startDate || '');
  const [toDate, setToDate] = useState(selectedFY?.endDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busyGuid, setBusyGuid] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Sheets
  const [genRow, setGenRow] = useState<ReadinessRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [fixRow, setFixRow] = useState<ReadinessRow | null>(null);
  const [actionRow, setActionRow] = useState<ReadinessRow | null>(null);
  const [cancelRow, setCancelRow] = useState<ReadinessRow | null>(null);
  const [ewbRow, setEwbRow] = useState<ReadinessRow | null>(null);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);

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

  const load = useCallback(() => {
    if (!companyGuid) return () => {};
    let cancelled = false;
    const fyParam = fyInfoToParam(selectedFY);
    const params = fromDate && toDate ? { from: fromDate, to: toDate } : (fyParam ? { fy: fyParam } : {});
    fetchEinvoiceReadiness(companyGuid, params)
      .then((res: any) => {
        if (cancelled) return;
        const d = res?.data || {};
        setData({ ready: d.ready || [], attention: d.attention || [], generated: d.generated || [] });
        setCounts(res?.counts || {});
        setLoadError(null);
      })
      .catch((e: any) => { if (!cancelled) setLoadError(e?.message || t('screens.reportsEinvoiceList.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyGuid, selectedFY, fromDate, toDate, t]);

  useEffect(() => load(), [load, reloadKey]);
  const refetch = () => setReloadKey((k) => k + 1);

  const rows = data[tab];
  const selectMode = selected.length > 0;
  const toggleSelect = (guid: string) => setSelected((p) => (p.includes(guid) ? p.filter((g) => g !== guid) : [...p, guid]));
  const switchTab = (next: Tab) => { setTab(next); setSelected([]); };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const generated = counts.generated ?? data.generated.length;
    const ready = counts.ready ?? data.ready.length;
    const attention = counts.attention ?? data.attention.length;
    const failed = counts.failed ?? 0;
    const covered = counts.value_covered ?? 0;
    const pending = counts.value_pending ?? 0;
    const required = generated + ready + attention;
    const coverage = required > 0 ? Math.round((generated / required) * 100) : 0;
    return [
      { key: 'generated', label: t('screens.reportsEinvoiceList.kpiGenerated', { defaultValue: 'Generated' }), value: String(generated), sub: covered ? formatAmountCompact(covered) : '', color: COLORS.positive },
      { key: 'ready', label: t('screens.reportsEinvoiceList.kpiReady', { defaultValue: 'Ready' }), value: String(ready), sub: pending ? formatAmountCompact(pending) : '', color: COLORS.info },
      { key: 'attention', label: t('screens.reportsEinvoiceList.kpiAttention', { defaultValue: 'Needs attention' }), value: String(attention), sub: '', color: COLORS.warning },
      { key: 'failed', label: t('screens.reportsEinvoiceList.kpiFailed', { defaultValue: 'Failed' }), value: String(failed), sub: '', color: COLORS.negative },
      { key: 'coverage', label: t('screens.reportsEinvoiceList.kpiCoverage', { defaultValue: 'Coverage' }), value: `${coverage}%`, sub: covered || pending ? `${formatAmountCompact(covered)} / ${formatAmountCompact(covered + pending)}` : '', color: COLORS.textPrimary },
    ];
  }, [counts, data, t, formatAmountCompact]);

  // ── Generate ──────────────────────────────────────────────────────────────
  const showGenerateError = (err: any) => {
    if (isNotConfiguredError(err)) {
      Alert.alert(
        t('screens.reportsEinvoiceList.notConfigured'),
        t('screens.reportsEinvoiceList.notConfiguredMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('screens.reportsEinvoiceList.goToSettings'), onPress: () => safePush(router, '/settings/einvoice' as any) },
        ],
      );
      return;
    }
    Alert.alert(t('screens.reportsEinvoiceList.irnFailed'), complianceErrorText(err, t));
  };

  const runGenerate = async (row: ReadinessRow, opts: { alsoEwb: boolean; dispatchDetails?: DispatchDetails }) => {
    if (!companyGuid) return;
    setSheetBusy(true);
    try {
      const res: any = await generateEinvoice({ companyGuid, voucherGuid: row.guid, alsoEwb: opts.alsoEwb, dispatchDetails: opts.dispatchDetails });
      const d = res?.data ?? res ?? {};
      if (res?.success === false) throw new Error(res?.error?.message || res?.message || t('screens.reportsEinvoiceList.unknownError'));
      setGenRow(null);
      const lines = [
        d.irn ? `IRN ${String(d.irn).slice(0, 24)}…` : '',
        d.ackNo ? `${t('screens.reportsEinvoiceList.ackNo', { defaultValue: 'Ack no' })} ${d.ackNo}` : '',
        d.ewbNo ? `${t('screens.reportsEinvoiceList.ewbNo', { defaultValue: 'EWB' })} ${d.ewbNo}` : '',
        d.ewb && d.ewb.ok === false ? `${t('screens.reportsEinvoiceList.ewbFailed', { defaultValue: 'E-way bill failed' })}: ${d.ewb.message || ''}` : '',
        d.credits?.charged != null ? t('screens.reportsEinvoiceList.creditsUsed', { count: d.credits.charged, defaultValue: '{{count}} credits used' }) : '',
      ].filter(Boolean);
      Alert.alert(t('screens.reportsEinvoiceList.irnGenerated'), lines.join('\n'));
      refetch();
    } catch (err: any) {
      showGenerateError(err);
    } finally {
      setSheetBusy(false);
    }
  };

  const runBulk = async (alsoEwb: boolean) => {
    if (!companyGuid || !selected.length) return;
    setSheetBusy(true);
    try {
      const res: any = await generateEinvoiceBulk({ companyGuid, voucherGuids: selected.slice(0, 50), alsoEwb });
      const d = res?.data ?? res ?? {};
      const results: any[] = Array.isArray(d.results) ? d.results : [];
      const ok = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      setBulkOpen(false);
      setSelected([]);
      Alert.alert(
        t('screens.reportsEinvoiceList.bulkDone', { ok, total: results.length, defaultValue: '{{ok}} of {{total}} registered' }),
        failed.slice(0, 6).map((r) => `${r.voucher_number || r.voucherGuid}: ${r.message || ''}`).join('\n') || undefined,
      );
      refetch();
    } catch (err: any) {
      showGenerateError(err);
    } finally {
      setSheetBusy(false);
    }
  };

  const runGenerateEwb = async (row: ReadinessRow, dispatchDetails: DispatchDetails) => {
    if (!companyGuid) return;
    setSheetBusy(true);
    try {
      const res: any = await generateEwb({ companyGuid, voucherGuid: row.guid, dispatchDetails });
      if (res?.success === false) throw new Error(res?.error?.message || t('screens.reportsEwbList.unknownError', { defaultValue: 'Unknown error' }));
      setEwbRow(null);
      Toast.show({ type: 'success', text1: t('screens.reportsEwbList.generated', { defaultValue: 'E-way bill generated' }), text2: String(res?.data?.ewbNo || '') });
      refetch();
    } catch (err: any) {
      Alert.alert(t('screens.reportsEwbList.generateFailed', { defaultValue: 'Could not generate' }), complianceErrorText(err, t));
    } finally {
      setSheetBusy(false);
    }
  };

  // ── ⋯ actions on generated rows ───────────────────────────────────────────
  const actionsFor = (row: ReadinessRow): SheetAction[] => {
    const cancelled = String(row.status || '').toLowerCase() === 'cancelled';
    const hasEwb = !!rowEwbNo(row);
    return [
      { key: 'view', label: t('common.view'), icon: 'document-text-outline' },
      { key: 'share', label: t('pdf.sharePdf'), icon: 'share-outline' },
      ...(canUpdate ? [{ key: 'json', label: t('screens.reportsEinvoiceList.downloadJson', { defaultValue: 'Download signed JSON' }), icon: 'code-download-outline' }] : []),
      { key: 'verify', label: t('screens.reportsEinvoiceList.verify', { defaultValue: 'Verify signed data' }), icon: 'shield-checkmark-outline' },
      { key: 'refresh', label: t('screens.reportsEinvoiceList.refreshStatus', { defaultValue: 'Refresh status' }), icon: 'refresh-outline' },
      ...(!hasEwb && !cancelled && canEwb ? [{ key: 'ewb', label: t('screens.reportsEinvoiceList.generateEwb', { defaultValue: 'Generate e-way bill' }), icon: 'car-outline' }] : []),
      ...(!cancelled && canUpdate ? [{ key: 'cancel', label: t('screens.reportsEinvoiceList.cancelRegistration', { defaultValue: 'Cancel registration' }), icon: 'close-circle-outline', destructive: true }] : []),
      { key: 'history', label: t('screens.reportsEinvoiceList.viewHistory', { defaultValue: 'View history' }), icon: 'time-outline' },
    ];
  };

  const onAction = async (row: ReadinessRow, key: string) => {
    if (!companyGuid) return;
    const guid = row.guid;
    switch (key) {
      case 'view':
        safePush(router, `/reports/compliance-detail?voucherGuid=${encodeURIComponent(guid)}&domain=einvoice` as any);
        return;
      case 'history':
        safePush(router, `/reports/compliance-history?voucherGuid=${encodeURIComponent(guid)}` as any);
        return;
      case 'share':
        setBusyGuid(guid);
        await shareEinvoicePdf(companyGuid, row, company, () => setBusyGuid(null));
        setBusyGuid(null);
        return;
      case 'json':
        setBusyGuid(guid);
        try { await shareSignedJson(companyGuid, guid, rowIrn(row)); }
        catch (e: any) { Alert.alert(t('common.error'), e?.message || t('screens.reportsEinvoiceList.unknownError')); }
        finally { setBusyGuid(null); }
        return;
      case 'verify':
        setVerifyResult(null);
        setVerifyOpen(true);
        try {
          const res: any = await verifyEinvoice(companyGuid, guid);
          setVerifyResult(res?.data ?? res ?? {});
        } catch (e: any) {
          setVerifyOpen(false);
          Alert.alert(t('common.error'), e?.message || t('screens.reportsEinvoiceList.unknownError'));
        }
        return;
      case 'refresh':
        setBusyGuid(guid);
        try {
          const res: any = await refreshEinvoice(companyGuid, guid);
          const d = res?.data ?? res ?? {};
          Toast.show({ type: 'success', text1: t('screens.reportsEinvoiceList.statusRefreshed', { defaultValue: 'Status refreshed' }), text2: d.status ? String(d.status) : undefined });
          if (d.changed) refetch();
        } catch (e: any) {
          Alert.alert(t('common.error'), e?.message || t('screens.reportsEinvoiceList.unknownError'));
        } finally { setBusyGuid(null); }
        return;
      case 'ewb':
        setEwbRow(row);
        return;
      case 'cancel':
        if (rowEwbNo(row)) {
          Alert.alert(t('screens.reportsEinvoiceList.cancelRegistration', { defaultValue: 'Cancel registration' }), t('screens.reportsEinvoiceList.ewbActiveFirst', { defaultValue: 'Cancel the e-way bill first.' }));
          return;
        }
        setCancelRow(row);
        return;
      default:
        return;
    }
  };

  const runCancel = async (reason: string, remarks: string) => {
    if (!companyGuid || !cancelRow) return;
    setSheetBusy(true);
    try {
      const res: any = await cancelEInvoice({ companyGuid, voucherGuid: cancelRow.guid, cancelReason: Number(reason), cancelRemarks: remarks });
      if (res?.success === false) throw new Error(res?.error?.message || t('screens.reportsEinvoiceList.unknownError'));
      setCancelRow(null);
      Toast.show({ type: 'success', text1: t('screens.reportsEinvoiceList.cancelled', { defaultValue: 'Registration cancelled' }) });
      refetch();
    } catch (err: any) {
      Alert.alert(t('common.error'), complianceErrorText(err, t));
    } finally {
      setSheetBusy(false);
    }
  };

  // ── Multi-select share (generated) ────────────────────────────────────────
  const handleShareSelected = async () => {
    const items = data.generated.filter((r) => selected.includes(r.guid) && !!rowIrn(r));
    if (!items.length) {
      Toast.show({ type: 'info', text1: t('screens.reportsEinvoiceList.nothingToShare'), text2: t('screens.reportsEinvoiceList.selectGenerated') });
      return;
    }
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { shared, failed } = await shareCompliancePdfsAsMultiPage(
        'einvoice',
        items.map((r) => ({
          irn: rowIrn(r), ackNo: r.ack_no || '', ackDate: r.ack_date || '', qrImage: r.qr_code || null,
          voucherNumber: rowNumber(r), voucherType: r.voucher_type || '', date: rowDate(r), partyName: rowParty(r), amount: rowAmount(r),
        })),
        companyFromAuth(company),
        { fileName: `E-Invoices (${items.length}).pdf`, onBeforeShare: () => setIsSharing(false) },
      );
      if (failed > 0) Toast.show({ type: 'info', text1: t('screens.reportsEinvoiceList.sharedOf', { shared, total: items.length }), text2: t('screens.reportsEinvoiceList.couldNotBeBuilt', { failed }) });
      setSelected([]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('screens.reportsEinvoiceList.couldNotSharePdfs'));
    } finally {
      setIsSharing(false);
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
          else safePush(router, `/reports/compliance-detail?voucherGuid=${encodeURIComponent(guid)}&domain=einvoice` as any);
        }}
        onLongPress={() => { if (tab !== 'attention') toggleSelect(guid); }}
        delayLongPress={400}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <Text style={s.invoiceNo}>{rowNumber(row)}</Text>
          <Text style={s.dateTxt}>{rowDate(row) ? formatDate(rowDate(row)) : ''}</Text>
          <View style={{ flex: 1 }} />
          {tab === 'generated' && (
            <View style={[s.badge, { backgroundColor: status === 'cancelled' ? COLORS.hoverBg : COLORS.positiveBg }]}>
              <Text style={[s.badgeTxt, { color: status === 'cancelled' ? COLORS.textSecondary : COLORS.positive }]}>
                {status === 'cancelled' ? t('screens.reportsEinvoiceList.statusCancelled') : t('screens.reportsEinvoiceList.statusGenerated')}
              </Text>
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
            {tab === 'ready' && !!(row.buyer_gstin || row.party_gstin) && <Text style={s.meta}>{row.buyer_gstin || row.party_gstin}</Text>}
            {tab === 'generated' && !!rowIrn(row) && <Text style={s.mono} numberOfLines={1}>{rowIrn(row)}</Text>}
            {tab === 'generated' && (!!row.ack_no || !!rowEwbNo(row)) && (
              <Text style={s.meta}>
                {row.ack_no ? `${t('screens.reportsEinvoiceList.ackNo', { defaultValue: 'Ack no' })} ${row.ack_no}` : ''}
                {row.ack_no && rowEwbNo(row) ? ' · ' : ''}
                {rowEwbNo(row) ? `EWB ${rowEwbNo(row)}` : ''}
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
          {tab === 'ready' && !!transportLabel && (
            <View style={s.transportChip}>
              <Ionicons name="car-outline" size={12} color={COLORS.textSecondary} />
              <Text style={s.transportTxt}>{transportLabel}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {tab === 'ready' && canGenerate && (
            <TouchableOpacity style={s.primaryBtn} onPress={() => setGenRow(row)} activeOpacity={0.85}>
              <Ionicons name="document-attach-outline" size={14} color={COLORS.white} />
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

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'ready', label: t('screens.reportsEinvoiceList.tabReady', { defaultValue: 'Ready' }), count: data.ready.length },
    { key: 'attention', label: t('screens.reportsEinvoiceList.tabAttention', { defaultValue: 'Needs attention' }), count: data.attention.length },
    { key: 'generated', label: t('screens.reportsEinvoiceList.tabGenerated', { defaultValue: 'Generated' }), count: data.generated.length },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('reports.einvoices')}</Text>
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
              <Text style={[s.tabTxt, tab === tb.key && s.tabActiveTxt]} numberOfLines={1}>{tb.label} ({tb.count})</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && rows.length === 0 && <ActivityIndicator color={COLORS.brandPrimary} style={{ marginTop: 32 }} />}
        {!loading && rows.length === 0 && !loadError && (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
            <Text style={s.emptyTitle}>
              {tab === 'ready' ? t('screens.reportsEinvoiceList.emptyReady', { defaultValue: 'Nothing ready to register' })
                : tab === 'attention' ? t('screens.reportsEinvoiceList.emptyAttention', { defaultValue: 'Nothing needs attention' })
                  : t('screens.reportsEinvoiceList.noEinvoices')}
            </Text>
            {tab === 'generated' && <Text style={s.emptySub}>{t('screens.reportsEinvoiceList.emptyHint')}</Text>}
          </View>
        )}
        {rows.map(renderRow)}
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
              <Ionicons name="document-attach-outline" size={16} color={COLORS.white} />
              <Text style={s.selectActionTxt}>{t('screens.reportsEinvoiceList.generateCount', { count: selected.length, defaultValue: 'Generate ({{count}})' })}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.selectAction, isSharing && { opacity: 0.6 }]} onPress={handleShareSelected} activeOpacity={0.85} disabled={isSharing}>
              {isSharing ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="share-outline" size={16} color={COLORS.white} />}
              <Text style={s.selectActionTxt}>{isSharing ? t('screens.reportsEinvoiceList.preparing') : t('pdf.sharePdf')}</Text>
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
        onApply={(f, to) => { setFromDate(f); setToDate(to); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />

      <GenerateIrnSheet visible={!!genRow} row={genRow} busy={sheetBusy} onClose={() => setGenRow(null)} onConfirm={(o) => genRow && runGenerate(genRow, o)} />
      <GenerateIrnBulkSheet visible={bulkOpen} rows={data.ready.filter((r) => selected.includes(r.guid))} busy={sheetBusy} onClose={() => setBulkOpen(false)} onConfirm={runBulk} />
      <GenerateEwbSheet visible={!!ewbRow} row={ewbRow} busy={sheetBusy} onClose={() => setEwbRow(null)} onConfirm={(d) => ewbRow && runGenerateEwb(ewbRow, d)} />
      <FixGapSheet visible={!!fixRow} row={fixRow} companyGuid={companyGuid} companyName={company?.name} onClose={() => setFixRow(null)} onSaved={refetch} />
      <ActionSheet
        visible={!!actionRow}
        title={actionRow ? `${rowNumber(actionRow)} · ${rowParty(actionRow)}` : ''}
        actions={actionRow ? actionsFor(actionRow) : []}
        onClose={() => setActionRow(null)}
        onSelect={(key) => { const r = actionRow; setActionRow(null); if (r) onAction(r, key); }}
      />
      <CancelSheet
        visible={!!cancelRow}
        title={t('screens.reportsEinvoiceList.cancelRegistration', { defaultValue: 'Cancel registration' })}
        hint={t('screens.reportsEinvoiceList.cancelHint', { defaultValue: 'The portal allows cancellation within 24 hours of registration.' })}
        busy={sheetBusy}
        onClose={() => setCancelRow(null)}
        onConfirm={runCancel}
      />
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

  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  emptySub: { fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' },

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
  mono: { fontSize: 10, color: COLORS.textTertiary, fontFamily: 'monospace' },
  gapTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, fontWeight: '600', lineHeight: 16 },
  amount: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 4 },
  transportChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.pageBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  transportTxt: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14 },
  primaryBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.white },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14 },
  outlineBtnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.brandPrimary },

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
