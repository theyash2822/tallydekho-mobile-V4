/**
 * VoucherPreviewScreen.tsx
 *
 * The shared container behind every `?tdkRef=` preview route.
 *
 * Each voucher type used to ship its own screen: the four money vouchers had
 * hand-rolled ScrollViews that could only share plain text, and Credit/Debit/
 * Delivery Note rendered from URL query params with no backend call at all.
 * They all fetch the same snapshot endpoint, so they now share this container
 * and inherit `DocumentPreviewPage` plus the real PDF pipeline.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { getInvoicePreview } from '../../services/api';
import { getSocket, isEventForActiveWorkspace } from '../../services/socketService';
import { VoucherDocument, DocumentType } from '../../types/document';
import { toVoucherDocument } from '../../utils/voucherDocumentAdapter';
import DocumentPreviewPage from './DocumentPreviewPage';

export interface VoucherPreviewScreenProps {
  /** Nav bar title while loading or on error. */
  title: string;
  /** Forces the document type when the snapshot is ambiguous. */
  documentType?: DocumentType;
  /** Defaults to GET /tally/invoice/:tdkRef/preview. */
  fetcher?: (tdkRef: string, companyGuid: string) => Promise<any>;
  /** Extra bar under the preview, e.g. the Proforma convert action. */
  renderFooter?: (raw: any, doc: VoucherDocument) => React.ReactNode;
}

export default function VoucherPreviewScreen({
  title,
  documentType,
  fetcher = getInvoicePreview,
  renderFooter,
}: VoucherPreviewScreenProps) {
  const { tdkRef } = useLocalSearchParams<{ tdkRef: string }>();
  const { company } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<VoucherDocument | null>(null);
  const [raw, setRaw] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProvisional, setIsProvisional] = useState(false);

  const fetchPreview = useCallback(async () => {
    const ref = Array.isArray(tdkRef) ? tdkRef[0] : tdkRef;
    if (!ref) {
      setLoading(false);
      setError('Missing document reference');
      return;
    }
    if (!company?.guid) {
      // Company still hydrating — keep spinner; effect re-runs when guid arrives.
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res: any = await fetcher(String(ref), company.guid);
      if (res?.status && res?.data) {
        setRaw(res.data);
        setDoc(toVoucherDocument(res.data, documentType ? { documentType } : {}));
        setIsProvisional(res.data.isProvisional ?? false);
      } else {
        setError(`Could not load ${title.toLowerCase()}.`);
      }
    } catch (e: any) {
      setError(e?.message || `Failed to load ${title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [tdkRef, company?.guid, fetcher, documentType, title]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // Refresh once Tally assigns the real voucher number.
  useEffect(() => {
    const socket: any = getSocket();
    if (!socket || !tdkRef) return;
    const onSynced = (payload: any) => {
      if (!isEventForActiveWorkspace('voucher:tallySynced', payload)
        && !isEventForActiveWorkspace('invoice_posting_updated', payload)) return;
      const ref = payload?.tdkRef || payload?.tdk_ref || payload?.referenceNumber;
      if (ref === tdkRef) fetchPreview();
    };
    socket.on('voucher:tallySynced', onSynced);
    socket.on('invoice_posting_updated', onSynced);
    return () => {
      socket.off('voucher:tallySynced', onSynced);
      socket.off('invoice_posting_updated', onSynced);
    };
  }, [tdkRef, fetchPreview]);

  if (loading || error || !doc) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>{title}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color={COLORS.brandPrimary} />
              <Text style={s.loadingTxt}>Loading {title.toLowerCase()}…</Text>
            </>
          ) : (
            <>
              <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
              <Text style={s.errorTxt}>{error || 'Document not found.'}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={fetchPreview} activeOpacity={0.8}>
                <Text style={s.retryTxt}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // DocumentPreviewPage owns SafeAreaView(top) — anything placed above it lands
  // under the status bar and gets clipped.
  return (
    <View style={s.safe}>
      <View style={{ flex: 1 }}>
        <DocumentPreviewPage document={doc} isProvisional={isProvisional} />
      </View>
      {renderFooter?.(raw, doc)}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.pageBg },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
    backgroundColor: COLORS.white,
  },
  backBtn: { padding: 4 },
  navTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: SPACING.lg },
  loadingTxt: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
  errorTxt: { fontSize: 14, color: COLORS.negative, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.brandPrimary, borderRadius: RADIUS.md },
  retryTxt: { fontSize: 14, color: COLORS.white, fontWeight: '600' },
});
