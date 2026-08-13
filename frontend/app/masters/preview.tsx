/**
 * Master preview — ledger / bank / warehouse / stock item
 * Route: /masters/preview?queueId=250
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getMasterPreview } from '../../src/services/api';

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

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{String(value)}</Text>
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

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{data?.typeLabel || 'Master Preview'}</Text>
        <TouchableOpacity onPress={fetchPreview} style={s.backBtn} hitSlop={8}>
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
          <View style={s.titleBlock}>
            <Text style={s.name}>{data?.name || '—'}</Text>
            {!!data?.parent && <Text style={s.under}>Under: {data.parent}</Text>}
            <View style={s.badgeRow}>
              <View style={[
                s.badge,
                posted ? s.badgePosted : awaiting ? s.badgeAwait : s.badgePending,
              ]}>
                <Text style={[
                  s.badgeTxt,
                  { color: posted ? COLORS.positive : awaiting ? '#B45309' : COLORS.textSecondary },
                ]}>
                  {posted ? 'Posted' : awaiting ? 'Awaiting Sync' : (data?.postingTag || 'Not Posted')}
                </Text>
              </View>
              {!!data?.queueStatus && data.queueStatus !== 'success' && (
                <View style={[s.badge, s.badgePending]}>
                  <Text style={[s.badgeTxt, { color: COLORS.textSecondary }]}>
                    {String(data.queueStatus).replace(/_/g, ' ')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.section}>Details</Text>
            <Row label="Type" value={data?.typeLabel} />
            <Row label="Group / Parent" value={data?.parent} />
            <Row label="GSTIN" value={p.gstin} />
            <Row label="GST Reg. Type" value={p.gstRegType} />
            <Row label="PAN" value={p.pan} />
            <Row label="Phone" value={p.phone} />
            <Row label="Email" value={p.email} />
            <Row label="Address" value={p.address} />
            <Row label="State" value={p.state} />
            <Row label="Pincode" value={p.pincode} />
            {(p.openingBalance != null && Number(p.openingBalance) !== 0) && (
              <Row
                label="Opening Balance"
                value={`₹${Number(p.openingBalance).toLocaleString('en-IN')} ${p.isCr ? 'Cr' : 'Dr'}`}
              />
            )}
            <Row label="Duty Category" value={p.dutyCategory} />
            <Row label="Tax Type" value={p.taxType} />
            {p.percentage != null && Number(p.percentage) !== 0 && (
              <Row label="Rate %" value={`${p.percentage}%`} />
            )}
            <Row label="GST Applicable" value={p.gstApplicable} />
            <Row label="HSN" value={p.hsnCode} />
            {p.igstRate != null && Number(p.igstRate) !== 0 && (
              <Row label="GST Rate" value={`${p.igstRate}%`} />
            )}
            <Row label="Unit" value={p.unit} />
            {p.openingQty != null && Number(p.openingQty) !== 0 && (
              <Row label="Opening Qty" value={String(p.openingQty)} />
            )}
            {p.openingRate != null && Number(p.openingRate) !== 0 && (
              <Row label="Opening Rate" value={`₹${p.openingRate}`} />
            )}
            <Row label="Warehouse" value={p.warehouse} />
            <Row label="A/c Number" value={p.accountNumber || p.bankDetails?.accountNo} />
            <Row label="IFSC" value={p.ifsc || p.bankDetails?.ifsc} />
            <Row label="Account Type" value={p.accountType} />
            {!!data?.tallyGuid && (
              <Row label="Tally GUID" value={String(data.tallyGuid).slice(0, 28) + '…'} />
            )}
          </View>

          {!!data?.errorMessage && (
            <View style={[s.card, { borderColor: '#FECACA' }]}>
              <Text style={[s.section, { color: COLORS.negative }]}>Error</Text>
              <Text style={s.errorBody}>{data.errorMessage}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.sm, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  errorTxt: { fontSize: TYPOGRAPHY.base, color: COLORS.negative, textAlign: 'center' },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.brandPrimary,
  },
  retryTxt: { color: COLORS.brandPrimary, fontWeight: '700' },
  body: { padding: SPACING.md, paddingBottom: 40 },
  titleBlock: { marginBottom: SPACING.md },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  under: { marginTop: 4, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgePosted: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  badgeAwait: { backgroundColor: '#FFF7E6', borderColor: '#F4C77E' },
  badgePending: { backgroundColor: COLORS.pageBg, borderColor: COLORS.borderDefault },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderDefault,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  section: {
    fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderDefault,
  },
  rowLabel: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, flex: 1 },
  rowValue: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600', flex: 1.4, textAlign: 'right' },
  errorBody: { fontSize: TYPOGRAPHY.sm, color: COLORS.negative, lineHeight: 20 },
});
