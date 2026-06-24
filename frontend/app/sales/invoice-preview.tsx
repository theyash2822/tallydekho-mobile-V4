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
import { SafeAreaView } from 'react-native-safe-area-context'; // used for loading/error states only
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getInvoicePreview } from '../../src/services/api';
import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { VoucherDocument } from '../../src/types/document';
import { getSocket } from '../../src/services/socketService';

// Map backend response to VoucherDocument
function mapToVoucherDocument(data: any): VoucherDocument {
  return {
    id: data.tdkRef || data.invoiceUuid || String(Date.now()),
    documentType: data.documentType || 'sales_invoice',
    documentTitle: `Invoice - ${data.documentNumber || data.tdkRef || ''}`,
    documentNumber: data.documentNumber || 'Pending from TallyPrime',
    date: data.documentDate || '',
    company: {
      name: data.company?.name || '',
      address: data.company?.address || '',
      gstin: data.company?.gstin || '',
      pan: data.company?.pan || '',
      phone: data.company?.phone || '',
      email: data.company?.email || '',
      state: data.company?.state || '',
    },
    party: {
      name: data.party?.name || '',
      address: data.party?.address || '',
      gstin: data.party?.gstin || '',
      pan: data.party?.pan || '',
      phone: data.party?.phone || '',
    },
    items: (data.items || []).map((item: any, idx: number) => ({
      id: item.id || String(idx),
      name: item.name || '',
      qty: parseFloat(item.qty) || 0,
      unit: item.unit || 'Nos',
      rate: parseFloat(item.rate) || 0,
      discount: parseFloat(item.discount) || 0,
      taxAmount: parseFloat(item.taxAmount) || 0,
      amount: parseFloat(item.amount) || 0,
    })),
    taxes: (data.taxLines || []).map((t: any) => ({
      description: t.description || 'Tax',
      rate: parseFloat(t.rate) || 0,
      taxableAmount: parseFloat(t.taxableAmount) || 0,
      total: parseFloat(t.total) || 0,
    })),
    totals: {
      subtotal: parseFloat(data.totals?.subtotal) || 0,
      taxTotal: parseFloat(data.totals?.taxTotal) || 0,
      total: parseFloat(data.totals?.grandTotal || data.totals?.total) || 0,
      roundOff: parseFloat(data.totals?.roundOff) || 0,
    },
    narration: data.narration || '',
    dispatchDetails: data.dispatchDetails || data.dispatch_details || undefined,
  };
}

export default function InvoicePreviewScreen() {
  const { tdkRef } = useLocalSearchParams<{ tdkRef: string }>();
  const { company } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<VoucherDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProvisional, setIsProvisional] = useState(false);
  const [postingTag, setPostingTag] = useState('Not Posted');

  const fetchPreview = useCallback(async () => {
    if (!tdkRef || !company?.guid) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getInvoicePreview(tdkRef, company.guid);
      if (res?.status && res?.data) {
        setDoc(mapToVoucherDocument(res.data));
        setIsProvisional(res.data.isProvisional ?? false);
        setPostingTag(res.data.postingTag || 'Not Posted');
      } else {
        setError('Could not load invoice preview.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  }, [tdkRef, company?.guid]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // WebSocket: auto-refresh when Tally posts the invoice
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !tdkRef) return;
    const handler = (payload: any) => {
      if (payload?.referenceNumber === tdkRef && payload?.postingTag === 'Posted') {
        fetchPreview();
      }
    };
    socket.on('invoice_posting_updated', handler);
    return () => { socket.off('invoice_posting_updated', handler); };
  }, [tdkRef, fetchPreview]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Invoice Preview</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>Loading invoice…</Text>
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
          <Text style={s.navTitle}>Invoice Preview</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
          <Text style={s.errorTxt}>{error || 'Invoice not found.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchPreview} activeOpacity={0.8}>
            <Text style={s.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // DocumentPreviewPage renders its own SafeAreaView(top,left,right)
  // so we use a plain View here to avoid double-applying the top inset
  return (
    <View style={s.safe}>
      {/* Status banner */}
      {isProvisional ? (
        <View style={s.provisionalBanner}>
          <Ionicons name="time-outline" size={15} color="#92400E" />
          <Text style={s.provisionalTxt}>
            Provisional — Pending Tally Posting. Auto-updates when synced.
          </Text>
        </View>
      ) : (
        <View style={s.postedBanner}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#166534" />
          <Text style={s.postedTxt}>Posted to TallyPrime</Text>
        </View>
      )}
      <DocumentPreviewPage
        document={doc}
        isProvisional={isProvisional}
      />
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
  provisionalBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8E1', paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F59E0B22',
  },
  provisionalTxt: { fontSize: 12, color: '#92400E', flex: 1 },
  postedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4', paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#22C55E22',
  },
  postedTxt: { fontSize: 12, color: '#166534' },
});
