/**
 * payment-preview.tsx  (2026-07-13)
 * Route: /voucher/payment-preview?tdkRef=TDK-PAY-2026-0001
 * Mirrors receipt-preview; preview endpoint branches on voucher_type='payment'.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity,
  Share, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getPaymentPreview } from '../../src/services/api';
import { getSocket } from '../../src/services/socketService';

const fmtINR = (n: any) => `₹${Math.round(parseFloat(n) || 0).toLocaleString('en-IN')}`;
const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function PaymentPreviewScreen() {
  const { tdkRef } = useLocalSearchParams<{ tdkRef: string }>();
  const { company } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProvisional, setIsProvisional] = useState(false);
  const [postingTag, setPostingTag] = useState('Not Posted');

  const fetchPreview = useCallback(async () => {
    if (!tdkRef || !company?.guid) return;
    try {
      setLoading(true);
      setError(null);
      const res: any = await getPaymentPreview(tdkRef, company.guid);
      if (res?.status && res?.data) {
        setDoc(res.data);
        setIsProvisional(res.data.isProvisional ?? false);
        setPostingTag(res.data.postingTag || 'Not Posted');
      } else {
        setError('Could not load payment preview.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load payment.');
    } finally {
      setLoading(false);
    }
  }, [tdkRef, company?.guid]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // Live refresh when Tally assigns a real voucher number
  useEffect(() => {
    const sock: any = getSocket();
    if (!sock || !tdkRef) return;
    const onSynced = (payload: any) => {
      if (payload?.tdkRef === tdkRef || payload?.tdk_ref === tdkRef) fetchPreview();
    };
    sock.on('voucher:tallySynced', onSynced);
    sock.on('invoice_posting_updated', onSynced);
    return () => {
      sock.off('voucher:tallySynced', onSynced);
      sock.off('invoice_posting_updated', onSynced);
    };
  }, [tdkRef, fetchPreview]);

  const handleShare = async () => {
    if (!doc) return;
    try {
      const lines = [
        `Payment Voucher — ${doc.documentNumber}`,
        `TDK Ref: ${doc.tdkRef}`,
        `Date: ${fmtDate(doc.documentDate)}`,
        '',
        `To: ${doc.party?.name || '—'}`,
        `Amount: ${fmtINR(doc.totals?.grandTotal)}`,
        `Method: ${doc.payment?.paymentMethod || 'Cash'}`,
        `Via: ${doc.payment?.ledgerAccount || '—'}`,
        '',
        'Bill Allocations:',
        ...((doc.payment?.billAllocations || []).map((b: any) =>
          `  • ${b.billType}${b.billRefName ? ' → ' + b.billRefName : ''}: ${fmtINR(b.amount)}`
        )),
        doc.narration ? `\nNarration: ${doc.narration}` : '',
      ].filter(Boolean);
      await Share.share({ message: lines.join('\n') });
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Unknown error');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
          <Text style={s.hdrTitle}>Payment Preview</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>Loading payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !doc) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
          <Text style={s.hdrTitle}>Payment Preview</Text>
        </View>
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.negative} />
          <Text style={s.errTxt}>{error || 'Payment not found'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchPreview}><Text style={s.retryTxt}>Retry</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const bills = doc.payment?.billAllocations || [];
  const instrument = doc.payment?.instrument;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={s.hdrTitle}>Payment Preview</Text>
        <View style={[s.pill, postingTag === 'Posted' ? s.pillGreen : s.pillYellow]}>
          <Text style={[s.pillTxt, postingTag === 'Posted' ? s.pillGreenTxt : s.pillYellowTxt]}>{postingTag}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isProvisional && (
          <View style={s.provBanner}>
            <Ionicons name="hourglass-outline" size={14} color="#B45309" />
            <Text style={s.provTxt}>Provisional — Tally voucher number pending sync</Text>
          </View>
        )}

        {/* Header card */}
        <View style={s.card}>
          <View style={s.cardHead}>
            <View>
              <Text style={s.cardLbl}>Voucher Number</Text>
              <Text style={s.cardVal}>{doc.documentNumber}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.cardLbl}>Date</Text>
              <Text style={s.cardVal}>{fmtDate(doc.documentDate)}</Text>
            </View>
          </View>
          <View style={s.cardDiv} />
          <View style={{ gap: 4 }}>
            <Text style={s.cardLbl}>TDK Reference</Text>
            <Text style={s.cardValSm}>{doc.tdkRef}</Text>
          </View>
        </View>

        {/* From / Amount */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Paid To</Text>
          <Text style={s.partyName}>{doc.party?.name || '—'}</Text>
          {!!doc.party?.gstin && <Text style={s.partyMeta}>GSTIN: {doc.party.gstin}</Text>}
          <View style={s.cardDiv} />
          <View style={s.row}>
            <Text style={s.cardLbl}>Received Amount</Text>
            <Text style={s.amountBig}>{fmtINR(doc.totals?.grandTotal)}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Payment</Text>
          <View style={s.row}>
            <Text style={s.cardLbl}>Method</Text>
            <Text style={s.cardValSm}>{doc.payment?.paymentMethod || 'Cash'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cardLbl}>Ledger</Text>
            <Text style={s.cardValSm}>{doc.payment?.ledgerAccount || '—'}</Text>
          </View>
          {instrument && (
            <>
              <View style={s.cardDiv} />
              {!!instrument.instrumentNo && <View style={s.row}><Text style={s.cardLbl}>Instrument No.</Text><Text style={s.cardValSm}>{instrument.instrumentNo}</Text></View>}
              {!!instrument.instrumentDate && <View style={s.row}><Text style={s.cardLbl}>Instrument Date</Text><Text style={s.cardValSm}>{fmtDate(instrument.instrumentDate)}</Text></View>}
              {!!instrument.bankName && <View style={s.row}><Text style={s.cardLbl}>Bank</Text><Text style={s.cardValSm}>{instrument.bankName}</Text></View>}
            </>
          )}
        </View>

        {/* Bill allocations */}
        {bills.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Bill Allocation</Text>
            {bills.map((b: any, i: number) => (
              <View key={i} style={[s.row, i > 0 && { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.billType}>{b.billType}</Text>
                  {!!b.billRefName && <Text style={s.billRef}>{b.billRefName}</Text>}
                </View>
                <Text style={s.cardValSm}>{fmtINR(b.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Narration */}
        {!!doc.narration && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Narration</Text>
            <Text style={s.narrTxt}>{doc.narration}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={s.actionBar}>
        <TouchableOpacity style={s.actionBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={COLORS.brandPrimary} />
          <Text style={s.actionTxt}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.actionPrimary]} onPress={() => router.replace('/voucher/payment' as any)} activeOpacity={0.85}>
          <Text style={[s.actionTxt, { color: COLORS.white }]}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cardBg, paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  scroll: { padding: SPACING.md, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg, gap: 12 },
  loadingTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
  errTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  retryTxt: { color: COLORS.white, fontWeight: '700' },
  provBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderColor: '#F59E0B44', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md },
  provTxt: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  cardLbl: { fontSize: 11, fontWeight: '600', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.3 },
  cardVal: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  cardValSm: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  cardDiv: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 2 },
  partyName: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  partyMeta: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountBig: { fontSize: 22, fontWeight: '800', color: COLORS.positive },
  billType: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  billRef: { fontSize: 11, color: COLORS.textTertiary, marginTop: 1 },
  narrTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  pillGreen: { backgroundColor: '#DCFCE7', borderColor: '#16A34A55' },
  pillYellow: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B44' },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  pillGreenTxt: { color: '#166534' },
  pillYellowTxt: { color: '#92400E' },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, padding: SPACING.md, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 12 },
  actionPrimary: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  actionTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '800', color: COLORS.brandPrimary },
});
