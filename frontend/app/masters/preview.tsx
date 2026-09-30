/**
 * Master preview — ledger / bank / warehouse / stock item
 * Cream printable sheet. Preview only — no Share PDF (product lock).
 * Route: /masters/preview?queueId=250
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getMasterPreview } from '../../src/services/api';
import { useTranslation } from 'react-i18next';

const PAPER = '#FEFDFB';
const INK = '#1A1A1A';
const INK_SOFT = '#55524C';
const INK_FAINT = '#98938A';
const SHADE = '#F4F1E9';
const RULE = '#CFCABE';
const RULE_SOFT = '#E5E1D6';
const EDGE = '#B8B3A6';

type PreviewData = {
  typeLabel?: string;
  name?: string;
  parent?: string | null;
  postingTag?: string;
  syncConfirmed?: boolean;
  tallyGuid?: string | null;
  queueStatus?: string;
  booksImpactStatus?: string;
  masterType?: string;
  ledgerType?: string | null;
  payload?: Record<string, any>;
  errorMessage?: string | null;
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{String(value)}</Text>
    </View>
  );
}

export default function MasterPreviewScreen() {
  const { t } = useTranslation();
  const { queueId } = useLocalSearchParams<{ queueId: string }>();
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewData | null>(null);

  const companyGuid = company?.guid;

  const loadPreview = useCallback(() => {
    if (!queueId || !companyGuid) return;
    getMasterPreview(queueId, companyGuid)
      .then((res) => {
        if (res?.status && res?.data) setData(res.data);
        else setError(t('screens.mastersPreview.couldNotLoad'));
      })
      .catch((e: any) => {
        setError(e?.message || t('screens.mastersPreview.loadFailed'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [queueId, companyGuid, t]);

  const fetchPreview = useCallback(() => {
    if (!queueId || !companyGuid) return;
    setLoading(true);
    setError(null);
    loadPreview();
  }, [queueId, companyGuid, loadPreview]);

  const [loadDeps, setLoadDeps] = useState<unknown[] | null>(null);
  if (!loadDeps || loadDeps[0] !== queueId || loadDeps[1] !== companyGuid) {
    setLoadDeps([queueId, companyGuid]);
    if (queueId && companyGuid) {
      setLoading(true);
      setError(null);
    }
  }

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const p = data?.payload || {};
  const posted = data?.booksImpactStatus === 'posted' || data?.syncConfirmed;
  const awaiting = !posted && (data?.queueStatus === 'success' || data?.postingTag === 'Awaiting Sync');
  const statusLabel = posted ? t('screens.mastersPreview.posted') : awaiting ? t('screens.mastersPreview.awaitingSync') : (data?.postingTag || t('screens.mastersPreview.notPosted'));

  const ribbon = (data?.typeLabel || t('screens.mastersPreview.master')).toUpperCase();
  const companyName = company?.name || '';
  const companyGstin = (company as any)?.gstin || '';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.navBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.navTitle} numberOfLines={1}>{data?.typeLabel || t('screens.mastersPreview.title')}</Text>
        <TouchableOpacity onPress={fetchPreview} style={s.navBack} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.brandPrimary} />
          <Text style={s.muted}>{t('screens.mastersPreview.loading')}</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.negative} />
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchPreview}>
            <Text style={s.retryTxt}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={s.sheet}>
            <View style={s.titleBar}>
              <Text style={s.titleText}>{ribbon}</Text>
            </View>

            <View style={s.companyBlock}>
              {!!companyName && <Text style={s.companyName}>{companyName}</Text>}
              {!!companyGstin && <Text style={s.companyMeta}>{t('screens.mastersPreview.gstinValue', { gstin: companyGstin })}</Text>}
            </View>

            <View style={s.nameBlock}>
              <Text style={s.name}>{data?.name || '—'}</Text>
              {!!data?.parent && <Text style={s.under}>{t('screens.mastersPreview.underValue', { parent: data.parent })}</Text>}
              <Text style={s.status}>{statusLabel}</Text>
            </View>

            <View style={s.fields}>
              <Field label={t('screens.mastersPreview.type')} value={data?.typeLabel} />
              <Field label={t('screens.mastersPreview.groupParent')} value={data?.parent} />
              <Field label={t('company.gstin')} value={p.gstin} />
              <Field label={t('screens.mastersPreview.gstRegType')} value={p.gstRegType} />
              <Field label={t('company.pan')} value={p.pan} />
              <Field label={t('company.phone')} value={p.phone} />
              <Field label={t('company.email')} value={p.email} />
              <Field label={t('screens.mastersPreview.address')} value={p.address} />
              <Field label={t('company.state')} value={p.state} />
              <Field label={t('screens.mastersPreview.pincode')} value={p.pincode} />
              {(p.openingBalance != null && Number(p.openingBalance) !== 0) && (
                <Field
                  label={t('ledger.opening')}
                  value={`₹${Number(p.openingBalance).toLocaleString('en-IN')} ${p.isCr ? 'Cr' : 'Dr'}`}
                />
              )}
              <Field label={t('screens.mastersPreview.dutyCategory')} value={p.dutyCategory} />
              <Field label={t('screens.mastersPreview.taxType')} value={p.taxType} />
              {p.percentage != null && Number(p.percentage) !== 0 && (
                <Field label={t('screens.mastersPreview.ratePercent')} value={`${p.percentage}%`} />
              )}
              <Field label={t('screens.mastersPreview.gstApplicable')} value={p.gstApplicable} />
              <Field label={t('pdf.hsn')} value={p.hsnCode} />
              {p.igstRate != null && Number(p.igstRate) !== 0 && (
                <Field label={t('screens.mastersPreview.gstRate')} value={`${p.igstRate}%`} />
              )}
              <Field label={t('screens.mastersPreview.unit')} value={p.unit} />
              {p.openingQty != null && Number(p.openingQty) !== 0 && (
                <Field label={t('screens.mastersPreview.openingQty')} value={String(p.openingQty)} />
              )}
              {p.openingRate != null && Number(p.openingRate) !== 0 && (
                <Field label={t('screens.mastersPreview.openingRate')} value={`₹${p.openingRate}`} />
              )}
              <Field label={t('screens.mastersPreview.warehouse')} value={p.warehouse} />
              <Field label={t('screens.mastersPreview.acNumber')} value={p.accountNumber || p.bankDetails?.accountNo} />
              <Field label={t('screens.mastersPreview.ifsc')} value={p.ifsc || p.bankDetails?.ifsc} />
              <Field label={t('screens.mastersPreview.accountType')} value={p.accountType} />
              {!!data?.tallyGuid && (
                <Field label={t('screens.mastersPreview.tallyGuid')} value={String(data.tallyGuid).slice(0, 28) + '…'} />
              )}
            </View>

            {!!data?.errorMessage && (
              <View style={s.errorBlock}>
                <Text style={s.errorTitle}>{t('common.error')}</Text>
                <Text style={s.errorBody}>{data.errorMessage}</Text>
              </View>
            )}

            <View style={s.hintBar}>
              <Text style={s.hint}>{t('screens.mastersPreview.previewOnly')}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cardBg },
  navBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  navBack: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { fontSize: TYPOGRAPHY.sm, color: COLORS.textTertiary },
  errorTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.negative, textAlign: 'center' },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 8, backgroundColor: COLORS.brandPrimary,
  },
  retryTxt: { color: COLORS.white, fontWeight: '700' },

  body: { padding: SPACING.md, paddingTop: SPACING.lg, paddingBottom: 32 },
  sheet: {
    backgroundColor: PAPER,
    borderWidth: 1, borderColor: EDGE,
    borderRadius: 6, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  titleBar: {
    alignItems: 'center', paddingVertical: 10,
    backgroundColor: SHADE, borderBottomWidth: 1, borderBottomColor: RULE,
  },
  titleText: {
    fontSize: 12, fontWeight: '700', letterSpacing: 2,
    color: INK_SOFT, textTransform: 'uppercase',
  },
  companyBlock: {
    alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  companyName: {
    fontSize: TYPOGRAPHY.md, fontWeight: '700', color: INK, textAlign: 'center',
  },
  companyMeta: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: INK_SOFT, marginTop: 4 },
  nameBlock: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  name: { fontSize: TYPOGRAPHY.lg, fontWeight: '800', color: INK, textAlign: 'center' },
  under: { fontSize: TYPOGRAPHY.sm, color: INK_SOFT, marginTop: 4 },
  status: {
    marginTop: 8, fontSize: 10, fontWeight: '700', color: INK_FAINT,
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  fields: { paddingHorizontal: 4 },
  field: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: RULE_SOFT,
  },
  fieldLabel: {
    fontSize: 10, fontWeight: '600', color: INK_FAINT,
    letterSpacing: 0.4, textTransform: 'uppercase', width: 120,
  },
  fieldValue: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: INK, textAlign: 'right' },
  errorBlock: {
    padding: 12, borderTopWidth: 1, borderTopColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  errorTitle: { fontSize: 11, fontWeight: '700', color: COLORS.negative, marginBottom: 4 },
  errorBody: { fontSize: TYPOGRAPHY.sm, color: COLORS.negative },
  hintBar: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: RULE, backgroundColor: SHADE,
  },
  hint: { fontSize: 10, color: INK_FAINT, textAlign: 'center', fontStyle: 'italic' },
});
