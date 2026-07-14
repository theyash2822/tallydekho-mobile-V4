/**
 * contra-preview.tsx (2026-07-14)
 * Route: /voucher/contra-preview?tdkRef=TDK-CON-2026-0001
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getContraPreview } from '../../src/services/api';
import { getSocket } from '../../src/services/socketService';

const fmtINR = (n: any) => `₹${Math.round(parseFloat(n) || 0).toLocaleString('en-IN')}`;
const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const kindLabel = (k?: string | null) => {
  switch (k) {
    case 'cash_deposit': return 'Cash → Bank (Deposit)';
    case 'cash_withdrawal': return 'Bank → Cash (Withdrawal)';
    case 'bank_transfer': return 'Bank → Bank (Transfer)';
    case 'cash_transfer': return 'Cash → Cash';
    default: return null;
  }
};

export default function ContraPreviewScreen() {
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
      const res: any = await getContraPreview(tdkRef, company.guid);
      if (res?.status && res?.data) {
        setDoc(res.data);
        setIsProvisional(res.data.isProvisional ?? false);
        setPostingTag(res.data.postingTag || 'Not Posted');
      } else {
        setError('Could not load contra preview.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load contra.');
    } finally {
      setLoading(false);
    }
  }, [tdkRef, company?.guid]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

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
      const c = doc.contra || {};
      await Share.share({
        message: [
          `Contra Voucher — ${doc.documentNumber}`,
          `TDK Ref: ${doc.tdkRef}`,
          `Date: ${fmtDate(doc.documentDate)}`,
          `From (Cr): ${c.fromLedger || '—'}`,
          `To (Dr): ${c.toLedger || '—'}`,
          `Amount: ${fmtINR(doc.totals?.grandTotal)}`,
          doc.narration ? `Narration: ${doc.narration}` : '',
        ].filter(Boolean).join('\n'),
      });
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.brandPrimary} /></View>
      </SafeAreaView>
    );
  }

  if (error || !doc) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.hdrTitle}>Contra Preview</Text>
        </View>
        <View style={s.center}><Text style={s.err}>{error || 'Not found'}</Text></View>
      </SafeAreaView>
    );
  }

  const c = doc.contra || {};
  const kind = kindLabel(c.contraKind);
  const inst = c.instrumentDetails;
  const cash = c.cashCount;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Contra Preview</Text>
        <View style={[s.pill, postingTag === 'Posted' ? s.pillGreen : s.pillYellow]}>
          <Text style={[s.pillTxt, postingTag === 'Posted' ? s.pillGreenTxt : s.pillYellowTxt]}>{postingTag}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={s.back}>
          <Ionicons name="share-outline" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {isProvisional && (
          <View style={s.provBanner}>
            <Ionicons name="hourglass-outline" size={14} color="#B45309" />
            <Text style={s.provTxt}>
              {doc.numberPending || (postingTag === 'Posted' && !doc?.documentNumber?.match(/^\d/))
                ? 'Posted — Tally series number pending sync'
                : 'Provisional — Tally voucher number pending sync'}
            </Text>
          </View>
        )}

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
          {!!doc.tdkRef && (
            <>
              <View style={s.div} />
              <Text style={s.cardLbl}>TDK Reference</Text>
              <Text style={s.refMono}>{doc.tdkRef}</Text>
            </>
          )}
          {!!kind && (
            <>
              <View style={s.div} />
              <Text style={s.cardLbl}>Type</Text>
              <Text style={s.cardVal}>{kind}</Text>
            </>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.secTitle}>Entries</Text>
          <View style={s.legRow}>
            <View style={[s.legTag, { backgroundColor: COLORS.positiveBg }]}>
              <Text style={[s.legTagTxt, { color: COLORS.positive }]}>Cr</Text>
            </View>
            <Text style={s.legName} numberOfLines={2}>{c.fromLedger || '—'}</Text>
            <Text style={[s.legAmt, { color: COLORS.positive }]}>{fmtINR(c.amount)}</Text>
          </View>
          <View style={s.div} />
          <View style={s.legRow}>
            <View style={[s.legTag, { backgroundColor: COLORS.negativeBg }]}>
              <Text style={[s.legTagTxt, { color: COLORS.negative }]}>Dr</Text>
            </View>
            <Text style={s.legName} numberOfLines={2}>{c.toLedger || '—'}</Text>
            <Text style={[s.legAmt, { color: COLORS.negative }]}>{fmtINR(c.amount)}</Text>
          </View>
        </View>

        {inst && (inst.instrumentNo || inst.transactionType) && (
          <View style={s.card}>
            <Text style={s.secTitle}>Instrument</Text>
            {!!inst.transactionType && <Text style={s.meta}>Type: {inst.transactionType}</Text>}
            {!!inst.instrumentNo && <Text style={s.meta}>No: {inst.instrumentNo}</Text>}
            {!!inst.instrumentDate && <Text style={s.meta}>Date: {fmtDate(inst.instrumentDate)}</Text>}
          </View>
        )}

        {cash?.used && cash?.matched && (
          <View style={s.card}>
            <Text style={s.secTitle}>Cash Count</Text>
            <Text style={s.meta}>Matched · {fmtINR(cash.counted)}</Text>
            {!!c.cashDenomStr && <Text style={s.meta}>Tally: {c.cashDenomStr}</Text>}
          </View>
        )}

        {!!doc.narration && (
          <View style={s.card}>
            <Text style={s.secTitle}>Narration</Text>
            <Text style={s.narr}>{doc.narration}</Text>
          </View>
        )}

        <View style={s.totalCard}>
          <Text style={s.totalLbl}>Amount</Text>
          <Text style={s.totalVal}>{fmtINR(doc.totals?.grandTotal)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  err: { color: COLORS.negative, textAlign: 'center' },
  hdr: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.md, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.pageBg, alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: '700', color: COLORS.textPrimary },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillGreen: { backgroundColor: COLORS.positiveBg },
  pillYellow: { backgroundColor: '#FEF3C7' },
  pillTxt: { fontSize: 11, fontWeight: '700' },
  pillGreenTxt: { color: COLORS.positive },
  pillYellowTxt: { color: '#B45309' },
  scroll: { padding: SPACING.md, gap: 12, paddingBottom: 40 },
  provBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.md, padding: 12,
  },
  provTxt: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '600' },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.borderDefault, padding: SPACING.md, gap: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLbl: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  cardVal: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  refMono: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 4 },
  secTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  legTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  legTagTxt: { fontSize: 10, fontWeight: '800' },
  legName: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  legAmt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  meta: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, lineHeight: 20 },
  narr: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
  totalCard: {
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.lg, padding: SPACING.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLbl: { color: 'rgba(255,255,255,0.85)', fontSize: TYPOGRAPHY.sm, fontWeight: '600' },
  totalVal: { color: COLORS.white, fontSize: TYPOGRAPHY.lg, fontWeight: '800' },
});
