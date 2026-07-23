/**
 * Stock Adjustment preview — Tally Physical Stock voucher snapshot.
 * Route: /stocks/adjustment-preview?tdkRef=TDK-PHY-2026-0001
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
import { getStockAdjustmentPreview } from '../../src/services/api';
import { getSocket } from '../../src/services/socketService';

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function StockAdjustmentPreviewScreen() {
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
      const res: any = await getStockAdjustmentPreview(tdkRef, company.guid);
      if (res?.status && res?.data) {
        setDoc(res.data);
        setIsProvisional(res.data.isProvisional ?? false);
        setPostingTag(res.data.postingTag || 'Not Posted');
      } else {
        setError('Could not load adjustment preview.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load preview.');
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
    const adj = doc.stockAdjustment || {};
    const unit = adj.unit || 'pcs';
    try {
      await Share.share({
        message: [
          `Physical Stock — ${doc.documentNumber}`,
          `TDK Ref: ${doc.tdkRef}`,
          `Date: ${fmtDate(doc.documentDate)}`,
          `Item: ${adj.stockName || '—'}`,
          `Warehouse: ${adj.warehouse || '—'}`,
          `Reason: ${adj.adjustmentReason || '—'}`,
          `Before: ${adj.qtyBefore ?? '—'} ${unit}`,
          `${adj.isIncrease ? '+' : '−'}${adj.adjustmentQty ?? '—'} ${unit}`,
          `After: ${adj.qtyAfter ?? '—'} ${unit}`,
          doc.narration ? `Note: ${doc.narration}` : '',
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
          <Text style={s.hdrTitle}>Adjustment Preview</Text>
        </View>
        <View style={s.center}><Text style={s.err}>{error || 'Not found'}</Text></View>
      </SafeAreaView>
    );
  }

  const adj = doc.stockAdjustment || {};
  const unit = adj.unit || 'pcs';
  const directionLabel = adj.adjustmentReason === 'Correction'
    ? (adj.isIncrease ? 'Add stock' : 'Reduce stock')
    : (adj.isIncrease ? 'Add stock (auto)' : 'Reduce stock (auto)');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Adjustment Preview</Text>
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
              {doc.numberPending
                ? 'Posted — Tally series number pending sync'
                : 'Provisional — Tally voucher number pending sync'}
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.typeBadge}>{doc.tallyVoucherType || 'Physical Stock'}</Text>
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
        </View>

        <View style={s.card}>
          <Text style={s.secTitle}>Stock Item</Text>
          <Text style={s.itemName}>{adj.stockName || '—'}</Text>
          <View style={s.row}>
            <Text style={s.cardLbl}>Warehouse</Text>
            <Text style={s.cardValSm}>{adj.warehouse || '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cardLbl}>Reason</Text>
            <Text style={s.cardValSm}>{adj.adjustmentReason || '—'}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.cardLbl}>Direction</Text>
            <Text style={[s.cardValSm, { color: adj.isIncrease ? COLORS.positive : COLORS.negative }]}>
              {directionLabel}
            </Text>
          </View>
        </View>

        <View style={s.qtyCard}>
          <View style={s.qtyCol}>
            <Text style={s.qtyLbl}>Before</Text>
            <Text style={s.qtyVal}>{adj.qtyBefore ?? '—'}</Text>
            <Text style={s.qtyUnit}>{unit}</Text>
          </View>
          <View style={s.qtyArrow}>
            <Text style={[s.qtyDelta, { color: adj.isIncrease ? COLORS.positive : COLORS.negative }]}>
              {adj.isIncrease ? '+' : '−'}{adj.adjustmentQty ?? '—'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.textTertiary} />
          </View>
          <View style={s.qtyCol}>
            <Text style={s.qtyLbl}>After (Physical)</Text>
            <Text style={s.qtyVal}>{adj.qtyAfter ?? '—'}</Text>
            <Text style={s.qtyUnit}>{unit}</Text>
          </View>
        </View>

        {!!doc.narration && (
          <View style={s.card}>
            <Text style={s.secTitle}>Note</Text>
            <Text style={s.narr}>{doc.narration}</Text>
          </View>
        )}
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
  typeBadge: {
    alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', color: COLORS.brandPrimary,
    backgroundColor: COLORS.brandPrimary + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLbl: { fontSize: 11, color: COLORS.textTertiary, fontWeight: '600', textTransform: 'uppercase' },
  cardVal: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  cardValSm: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  refMono: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  div: { height: 1, backgroundColor: COLORS.borderDefault, marginVertical: 4 },
  secTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  itemName: { fontSize: TYPOGRAPHY.md, fontWeight: '800', color: COLORS.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  qtyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.md,
  },
  qtyCol: { flex: 1, alignItems: 'center', gap: 2 },
  qtyLbl: { fontSize: 10, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase' },
  qtyVal: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  qtyUnit: { fontSize: 11, color: COLORS.textTertiary },
  qtyArrow: { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  qtyDelta: { fontSize: TYPOGRAPHY.sm, fontWeight: '800' },
  narr: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, lineHeight: 20 },
});
