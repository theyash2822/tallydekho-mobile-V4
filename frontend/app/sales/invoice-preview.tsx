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
  View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context'; // used for loading/error states only
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { getInvoicePreview, convertProformaInvoice } from '../../src/services/api';
import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { VoucherDocument } from '../../src/types/document';
import { getSocket } from '../../src/services/socketService';

// Map backend response to VoucherDocument
function mapToVoucherDocument(data: any): VoucherDocument {
  const isProforma = data.documentType === 'proforma_invoice';
  const converted = data.conversionStatus === 'converted' || data.currentEntryType === 'regular';
  const titleKind = isProforma && !converted ? 'Proforma Invoice' : 'Invoice';
  return {
    id: data.tdkRef || data.invoiceUuid || String(Date.now()),
    documentType: data.documentType || 'sales_invoice',
    documentTitle: `${titleKind} - ${data.documentNumber || data.tdkRef || ''}`,
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
  const [canConvertProforma, setCanConvertProforma] = useState(false);
  const [converting, setConverting] = useState(false);

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
        setCanConvertProforma(!!res.data.canConvertProforma);
      } else {
        setError('Could not load invoice preview.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  }, [tdkRef, company?.guid]);

  const handleConvertProforma = useCallback(async () => {
    if (!tdkRef || !company?.guid) return;
    Alert.alert(
      'Convert to Invoice',
      'This will post the same Tally voucher as a regular Sales Invoice (no longer optional).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            setConverting(true);
            try {
              const res: any = await convertProformaInvoice({
                companyGuid: company.guid,
                companyName: company.name,
                tdkRef,
              });
              if (!res?.status) throw new Error(res?.message || 'Convert failed');
              Toast.show({ type: 'success', text1: 'Converted', text2: res.message || 'Now a Sales Invoice' });
              await fetchPreview();
            } catch (e: any) {
              Toast.show({ type: 'error', text1: 'Convert failed', text2: e?.message || 'Try again after sync.' });
            } finally {
              setConverting(false);
            }
          },
        },
      ]
    );
  }, [tdkRef, company?.guid, company?.name, fetchPreview]);

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

  // DocumentPreviewPage owns SafeAreaView(top). Never place banners above it —
  // they sit under the device status bar and get clipped.
  return (
    <View style={s.safe}>
      <View style={{ flex: 1 }}>
        <DocumentPreviewPage
          document={doc}
          isProvisional={isProvisional}
        />
      </View>
      {canConvertProforma && (
        <SafeAreaView edges={['bottom']} style={s.convertBar}>
          <TouchableOpacity
            style={[s.convertBtn, converting && { opacity: 0.7 }]}
            activeOpacity={0.85}
            disabled={converting}
            onPress={handleConvertProforma}
          >
            {converting
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Ionicons name="repeat-outline" size={16} color={COLORS.white} />}
            <Text style={s.convertBtnTxt}>{converting ? 'Converting…' : 'Convert to Sales Invoice'}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
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
  convertBar: { backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderTopColor: COLORS.borderDefault, paddingHorizontal: SPACING.md, paddingTop: 10 },
  convertBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  convertBtnTxt: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
