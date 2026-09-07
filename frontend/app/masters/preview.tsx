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
  const { queueId } = useLocalSearchParams<{ queueId: string }>();
  const { company } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewData | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!queueId || !company?.guid) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getMasterPreview(queueId, company.guid);
      if (res?.status && res?.data) setData(res.data);
      else setError('Could not load preview.');
    } catch (e: any) {
      setError(e?.message || 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  }, [queueId, company?.guid]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  const p = data?.payload || {};
  const posted = data?.booksImpactStatus === 'posted' || data?.syncConfirmed;
  const awaiting = !posted && (data?.queueStatus === 'success' || data?.postingTag === 'Awaiting Sync');
  const statusLabel = posted ? 'Posted' : awaiting ? 'Awaiting Sync' : (data?.postingTag || 'Not Posted');

  const ribbon = (data?.typeLabel || 'MASTER').toUpperCase();
  const companyName = company?.name || '';
  const companyGstin = (company as any)?.gstin || '';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.navBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.navTitle} numberOfLines={1}>{data?.typeLabel || 'Master Preview'}</Text>
        <TouchableOpacity onPress={fetchPreview} style={s.navBack} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.brandPrimary} />
          <Text style={s.muted}>Loading preview…</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.negative} />
          <Text style={s.errorTxt}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchPreview}>
            <Text style={s.retryTxt}>Retry</Text>
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
              {!!companyGstin && <Text style={s.companyMeta}>GSTIN: {companyGstin}</Text>}
            </View>

            <View style={s.nameBlock}>
              <Text style={s.name}>{data?.name || '—'}</Text>
              {!!data?.parent && <Text style={s.under}>Under: {data.parent}</Text>}
              <Text style={s.status}>{statusLabel}</Text>
            </View>

            <View style={s.fields}>
              <Field label="Type" value={data?.typeLabel} />
              <Field label="Group / Parent" value={data?.parent} />
              <Field label="GSTIN" value={p.gstin} />
              <Field label="GST Reg. Type" value={p.gstRegType} />
              <Field label="PAN" value={p.pan} />
              <Field label="Phone" value={p.phone} />
              <Field label="Email" value={p.email} />
              <Field label="Address" value={p.address} />
              <Field label="State" value={p.state} />
              <Field label="Pincode" value={p.pincode} />
              {(p.openingBalance != null && Number(p.openingBalance) !== 0) && (
                <Field
                  label="Opening Balance"
                  value={`₹${Number(p.openingBalance).toLocaleString('en-IN')} ${p.isCr ? 'Cr' : 'Dr'}`}
                />
              )}
              <Field label="Duty Category" value={p.dutyCategory} />
              <Field label="Tax Type" value={p.taxType} />
              {p.percentage != null && Number(p.percentage) !== 0 && (
                <Field label="Rate %" value={`${p.percentage}%`} />
              )}
              <Field label="GST Applicable" value={p.gstApplicable} />
              <Field label="HSN" value={p.hsnCode} />
              {p.igstRate != null && Number(p.igstRate) !== 0 && (
                <Field label="GST Rate" value={`${p.igstRate}%`} />
              )}
              <Field label="Unit" value={p.unit} />
              {p.openingQty != null && Number(p.openingQty) !== 0 && (
                <Field label="Opening Qty" value={String(p.openingQty)} />
              )}
              {p.openingRate != null && Number(p.openingRate) !== 0 && (
                <Field label="Opening Rate" value={`₹${p.openingRate}`} />
              )}
              <Field label="Warehouse" value={p.warehouse} />
              <Field label="A/c Number" value={p.accountNumber || p.bankDetails?.accountNo} />
              <Field label="IFSC" value={p.ifsc || p.bankDetails?.ifsc} />
              <Field label="Account Type" value={p.accountType} />
              {!!data?.tallyGuid && (
                <Field label="Tally GUID" value={String(data.tallyGuid).slice(0, 28) + '…'} />
              )}
            </View>

            {!!data?.errorMessage && (
              <View style={s.errorBlock}>
                <Text style={s.errorTitle}>Error</Text>
                <Text style={s.errorBody}>{data.errorMessage}</Text>
              </View>
            )}

            <View style={s.hintBar}>
              <Text style={s.hint}>Preview only — PDF sharing not available</Text>
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
