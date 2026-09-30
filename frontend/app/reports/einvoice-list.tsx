import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../../src/utils/safeNavigation';
import { openVoucherPreview } from '../../src/utils/openVoucherPreview';
import { ErrorBanner } from '../../src/components/ApiStateViews';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { fyInfoToParam } from '../../src/context/AuthContext';
import { getEInvoiceGenerated, getEInvoicePending, generateEInvoice } from '../../src/services/api';
import DateRangePickerModal from '../../src/components/DateRangePickerModal';
import { useSettings } from '../../src/context/SettingsContext';
import { shareCompliancePdfSafely } from '../../src/utils/voucherPdf';
import { shareCompliancePdfsAsMultiPage, companyFromAuth } from '../../src/utils/multiShare';

// Data loaded from API

const STATUS_CFG: Record<string, { bg: string; text: string; icon: string }> = {
  Generated: { bg: '#F0FBF4', text: '#2D7D46', icon: 'checkmark-circle' },
  Pending:   { bg: '#FEF3C7', text: '#D97706', icon: 'time'             },
  Error:     { bg: '#FEF2F2', text: '#DC2626', icon: 'warning'          },
  Cancelled: { bg: '#F3F4F6', text: '#6B7280', icon: 'close-circle'     },
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  Generated: 'screens.reportsEinvoiceList.statusGenerated',
  Pending:   'screens.reportsEinvoiceList.statusPending',
  Error:     'screens.reportsEinvoiceList.statusError',
  Cancelled: 'screens.reportsEinvoiceList.statusCancelled',
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EInvoiceListScreen() {
  const { formatAmount, formatAmountCompact, formatDate } = useSettings();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, selectedFY } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [invoiceData,    setInvoiceData]    = useState<any[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [selected,       setSelected]       = useState<string[]>([]);
  const [fromDate,       setFromDate]       = useState(selectedFY?.startDate || '');
  const [toDate,         setToDate]         = useState(selectedFY?.endDate   || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [generatingIds,  setGeneratingIds]  = useState<string[]>([]);
  const [sharingId,      setSharingId]      = useState<string | null>(null);
  const [isSharing,      setIsSharing]      = useState(false);

  // Always sync dates when selectedFY changes (user may switch FY from home screen)
  const [prevFyRange, setPrevFyRange] = useState<unknown[] | null>(null);
  if (!prevFyRange || prevFyRange[0] !== selectedFY?.startDate || prevFyRange[1] !== selectedFY?.endDate) {
    setPrevFyRange([selectedFY?.startDate, selectedFY?.endDate]);
    if (selectedFY?.startDate) {
      setFromDate(selectedFY.startDate);
      setToDate(selectedFY.endDate || new Date().toISOString().split('T')[0]);
    }
  }
  const selectMode = selected.length > 0;

  const companyGuid = company?.guid;
  const [loadDeps, setLoadDeps] = useState<unknown[]>([]);
  if (
    loadDeps[0] !== companyGuid || loadDeps[1] !== selectedFY || loadDeps[2] !== fromDate ||
    loadDeps[3] !== toDate || loadDeps[4] !== reloadKey
  ) {
    setLoadDeps([companyGuid, selectedFY, fromDate, toDate, reloadKey]);
    if (companyGuid) setLoading(true);
  }

  useEffect(() => {
    if (!company?.guid) return;
    let cancelled = false;
    const fyParam = fyInfoToParam(selectedFY);
    const dateParams = fromDate && toDate ? { from: fromDate, to: toDate } : (fyParam ? { fy: fyParam } : {});
    // Load both generated + pending and combine
    Promise.all([
      getEInvoiceGenerated(company.guid, dateParams).catch(() => null),
      getEInvoicePending(company.guid, dateParams).catch(() => null),
    ]).then(([genRes, pendRes]: any[]) => {
      if (cancelled) return;
      setLoadError(genRes && pendRes ? null : t('screens.reportsEinvoiceList.loadFailed'));
        const mapRow = (i: any, idx: number, status: string) => ({
          id: i.guid?.toString() || i.id?.toString() || `${status[0]}${idx}`,
          guid: i.guid ? String(i.guid) : '',
          irn: i.irn || '',
          invoiceNo: i.voucher_number || i.voucher_no || `INV-${idx}`,
          party: i.party_name || t('screens.reportsEinvoiceList.unknown'),
          date: i.date || '',
          amount: Math.abs(+i.amount || 0).toLocaleString('en-IN'),
          status,
          // Kept raw for the acknowledgement sheet PDF.
          voucherType: i.voucher_type || '',
          amountValue: Math.abs(+i.amount || 0),
          ackNo: i.ack_no || '',
          ackDate: i.ack_date || '',
          qrCode: i.qr_code || null,
        });
        const generated = (genRes?.data  || []).map((i: any, idx: number) => mapRow(i, idx, 'Generated'));
        const pending   = (pendRes?.data || []).map((i: any, idx: number) => mapRow(i, idx, 'Pending'));
        // Sort combined by date desc
        const combined  = [...generated, ...pending].sort((a, b) => b.date.localeCompare(a.date));
        setInvoiceData(combined);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [company?.guid, selectedFY, fromDate, toDate, reloadKey]);

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

  const cancelSelect = () => setSelected([]);

  // ── Generate IRN handler ───────────────────────────────────────────────────
  const handleGenerateIRN = async (item: any) => {
    if (!company?.guid || !item.guid) {
      openVoucherPreview(router, {});
      return;
    }
    setGeneratingIds(prev => [...prev, item.id]);
    try {
      const result = await generateEInvoice({
        companyGuid: company.guid,
        voucherGuid: item.guid,
        voucherNumber: item.invoiceNo,
      });
      if (result?.success) {
        Toast.show({
          type: 'success',
          text1: t('screens.reportsEinvoiceList.irnGenerated'),
          text2: result.data?.irn ? result.data.irn.slice(0, 30) + '...' : t('screens.reportsEinvoiceList.irnCreated'),
        });
        // Refresh row in list
        setInvoiceData(prev =>
          prev.map(i =>
            i.id === item.id
              ? { ...i, status: 'Generated', irn: result.data?.irn || '' }
              : i
          )
        );
      } else if (result?.locked) {
        Alert.alert(t('screens.reportsEinvoiceList.irnLocked'), result?.error?.message || t('screens.reportsEinvoiceList.prereqNotMet'));
      } else {
        Toast.show({ type: 'error', text1: t('screens.reportsEinvoiceList.generationFailed'), text2: result?.error?.message || t('screens.reportsEinvoiceList.unknownError') });
      }
    } catch (err: any) {
      const rawMsg = err?.message || '';
      const msg = rawMsg || t('screens.reportsEinvoiceList.failedGenerateIrn');
      if (rawMsg.includes('not yet provisioned') || rawMsg.includes('not configured') || rawMsg.includes('IRP credentials')) {
        Alert.alert(
          t('screens.reportsEinvoiceList.notConfigured'),
          t('screens.reportsEinvoiceList.notConfiguredMsg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('screens.reportsEinvoiceList.goToSettings'), onPress: () => safePush(router, '/settings/einvoice' as any) },
          ]
        );
      } else {
        Toast.show({ type: 'error', text1: t('screens.reportsEinvoiceList.irnFailed'), text2: msg });
      }
    } finally {
      setGeneratingIds(prev => prev.filter(id => id !== item.id));
    }
  };

  const handleSharePdf = async (item: any) => {
    setSharingId(item.id);
    await shareCompliancePdfSafely('einvoice', {
      irn: item.irn,
      ackNo: item.ackNo,
      ackDate: item.ackDate,
      qrImage: item.qrCode,
      voucherNumber: item.invoiceNo,
      voucherType: item.voucherType,
      date: item.date,
      partyName: item.party,
      amount: item.amountValue,
    }, {
      name: company?.name,
      address: (company as any)?.address,
      gstin: (company as any)?.gstin,
    }, { onBeforeShare: () => setSharingId(null) });
    setSharingId(null);
  };

  const handleShare = async () => {
    const items = invoiceData.filter(i => selected.includes(i.id) && i.status === 'Generated' && !!i.irn);
    if (!items.length) {
      Toast.show({ type: 'info', text1: t('screens.reportsEinvoiceList.nothingToShare'), text2: t('screens.reportsEinvoiceList.selectGenerated') });
      return;
    }
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { shared, failed } = await shareCompliancePdfsAsMultiPage(
        'einvoice',
        items.map(item => ({
          irn: item.irn,
          ackNo: item.ackNo,
          ackDate: item.ackDate,
          qrImage: item.qrCode,
          voucherNumber: item.invoiceNo,
          voucherType: item.voucherType,
          date: item.date,
          partyName: item.party,
          amount: item.amountValue,
        })),
        companyFromAuth(company),
        {
          fileName: `E-Invoices (${items.length}).pdf`,
          onBeforeShare: () => setIsSharing(false),
        }
      );
      if (failed > 0) {
        Toast.show({ type: 'info', text1: t('screens.reportsEinvoiceList.sharedOf', { shared, total: items.length }), text2: t('screens.reportsEinvoiceList.couldNotBeBuilt', { failed }) });
      }
      cancelSelect();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('screens.reportsEinvoiceList.couldNotSharePdfs'));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>

      {/* Header — title stays fixed; multi-select lives in footer */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('reports.einvoices')}</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={20}
            color={fromDate ? COLORS.brandPrimary : COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadKey(k => k + 1)} />}
        {invoiceData.length === 0 && !loading && !loadError && (
          <View style={{ alignItems: 'center', padding: 48, gap: 12 }}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textTertiary} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.textSecondary }}>{t('screens.reportsEinvoiceList.noEinvoices')}</Text>
            <Text style={{ fontSize: 12, color: COLORS.textTertiary, textAlign: 'center' }}>{t('screens.reportsEinvoiceList.emptyHint')}</Text>
          </View>
        )}
        {invoiceData.map((item) => {
          const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.Generated;
          const isSelected = selected.includes(item.id);
          const isGenerating = generatingIds.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[s.card, isSelected && s.cardSelected]}
              onPress={() => {
                if (selectMode) { toggleSelect(item.id); }
                else { openVoucherPreview(router, { guid: item.guid }); }
              }}
              onLongPress={() => toggleSelect(item.id)}
              delayLongPress={500}
              activeOpacity={0.8}
            >
              {/* Top row: Invoice No + status badge */}
              <View style={s.cardTopRow}>
                <Text style={s.invoiceNo}>{item.invoiceNo}</Text>
                <Text style={s.sep}> • </Text>
                <Text style={s.irnTxt} numberOfLines={1}>{item.irn}</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusTxt, { color: cfg.text }]}>{STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}</Text>
                </View>
              </View>

              {/* Body: icon + party + amount */}
              <View style={s.cardBody}>
                <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon as any} size={22} color={cfg.text} />
                </View>
                <View style={s.partyBlock}>
                  <Text style={s.partyName}>{item.party}</Text>
                  <Text style={s.dateStr}>{item.date}</Text>
                </View>
                <Text style={s.amount}>{'\u20b9'}{item.amount}</Text>
              </View>

              {/* Acknowledgement sheet — only once an IRN exists */}
              {item.status === 'Generated' && !!item.irn && (
                <TouchableOpacity
                  style={el.shareBtn}
                  onPress={() => handleSharePdf(item)}
                  activeOpacity={0.85}
                  disabled={sharingId === item.id}
                >
                  {sharingId === item.id ? (
                    <ActivityIndicator size="small" color={COLORS.brandPrimary} />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={14} color={COLORS.brandPrimary} />
                      <Text style={el.shareBtnTxt}>{t('pdf.sharePdf')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Generate IRN button — only for Pending rows */}
              {item.status === 'Pending' && (
                <TouchableOpacity
                  style={el.generateBtn}
                  onPress={() => handleGenerateIRN(item)}
                  activeOpacity={0.85}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="document-attach-outline" size={14} color={COLORS.white} />
                      <Text style={el.generateBtnTxt}>{t('screens.reportsEinvoiceList.generateIrn')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: selectMode ? 90 : 40 }} />
      </ScrollView>

      {/* Share bar */}
      {selectMode && (
        <View style={[s.shareBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.shareLeft}>
            <Text style={s.shareCount}>{t('common.selected', { count: selected.length })}</Text>
            <TouchableOpacity onPress={() => setSelected(invoiceData.map(i => i.id))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>{t('ledger.selectAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelSelect} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={s.shareCancelTxt}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.shareActionBtn, isSharing && { opacity: 0.6 }]}
            onPress={handleShare}
            activeOpacity={0.85}
            disabled={isSharing}
          >
            {isSharing
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="share-outline" size={16} color={COLORS.white} />
            }
            <Text style={s.shareActionTxt}>{isSharing ? t('screens.reportsEinvoiceList.preparing') : t('pdf.sharePdf')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <DateRangePickerModal
        visible={showDatePicker}
        fromDate={fromDate || selectedFY?.startDate || ''}
        toDate={toDate || selectedFY?.endDate || ''}
        minDate={selectedFY?.startDate}
        maxDate={selectedFY?.endDate}
        onApply={(f, t) => { setFromDate(f); setToDate(t); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

// ── Generate IRN button styles ────────────────────────────────────────────────
const el = StyleSheet.create({
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
    minWidth: 44,
    justifyContent: 'center',
  },
  generateBtnTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.brandPrimary,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
    minWidth: 44,
    justifyContent: 'center',
  },
  shareBtnTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.brandPrimary,
  },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xs, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn:          { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle:      { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.lg, fontWeight: '700', color: COLORS.textPrimary },
  headerTextBtn:    { width: 76, alignItems: 'flex-end', paddingRight: 8 },
  headerTextBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.brandPrimary },

  listContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: 10,
  },
  cardSelected: { borderColor: COLORS.brandPrimary, borderWidth: 2, backgroundColor: COLORS.brandPrimary + '06' },

  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  invoiceNo: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textPrimary },
  sep:       { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary },
  irnTxt:    { fontSize: 10, color: COLORS.textTertiary, flex: 1, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusTxt:   { fontSize: 11, fontWeight: '700' },

  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  partyBlock: { flex: 1, gap: 3 },
  partyName:  { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  dateStr:    { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  amount:     { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },

  shareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderTopColor: COLORS.borderDefault, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },
  shareLeft:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareCount:     { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  shareCancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textSecondary },
  shareActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: COLORS.brandPrimary,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
  },
  shareActionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
