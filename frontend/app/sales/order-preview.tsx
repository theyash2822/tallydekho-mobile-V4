/**
 * order-preview.tsx
 * Sales Order Preview Screen
 *
 * Route: /sales/order-preview?tdkRef=TDK-SOR-2026-0042
 *
 * - Fetches the order snapshot from the same backend preview endpoint used by
 *   invoices (backend serves the app_vouchers payload keyed by tdkRef,
 *   regardless of voucher type).
 * - Shows DocumentPreviewPage with watermark if provisional.
 * - Listens for invoice_posting_updated WebSocket event to auto-refresh to final.
 * - Extra action: Convert to Sales Invoice — writes an AsyncStorage prefill key
 *   (best-effort from the preview snapshot) and hands off to create-invoice.tsx.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ActivityIndicator, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { currentTenantKey, prefillFeature } from '../../src/utils/tenantStorage';
import { getOrderPreview } from '../../src/services/api';
import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { VoucherDocument } from '../../src/types/document';
import { toVoucherDocument } from '../../src/utils/voucherDocumentAdapter';
import { getSocket, isEventForActiveWorkspace } from '../../src/services/socketService';

/** Format ISO YYYY-MM-DD → DD/MM/YY (matches create-order.tsx's date fields) */
function isoToDMY(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length < 3) return '';
  const [y, m, d] = parts;
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`;
}

export default function OrderPreviewScreen() {
  const { tdkRef } = useLocalSearchParams<{ tdkRef: string }>();
  const { company } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<VoucherDocument | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProvisional, setIsProvisional] = useState(false);
  const [converting, setConverting] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!tdkRef || !company?.guid) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getOrderPreview(tdkRef, company.guid);
      if (res?.status && res?.data) {
        // documentType is forced: a stray voucher_type would otherwise fall
        // through to the sales_invoice default and print the wrong title block.
        setDoc(toVoucherDocument(res.data, { documentType: 'sales_order' }));
        setRawData(res.data);
        setIsProvisional(res.data.isProvisional ?? false);
      } else {
        setError('Could not load sales order preview.');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  }, [tdkRef, company?.guid]);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  // WebSocket: auto-refresh when Tally posts the order (same event as invoices)
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !tdkRef) return;
    const handler = (payload: any) => {
      if (!isEventForActiveWorkspace('invoice_posting_updated', payload)) return;
      if (payload?.referenceNumber === tdkRef && payload?.postingTag === 'Posted') {
        fetchPreview();
      }
    };
    socket.on('invoice_posting_updated', handler);
    return () => { socket.off('invoice_posting_updated', handler); };
  }, [tdkRef, fetchPreview]);

  // ── Convert to Sales Invoice — prefer full rawPayload from app_vouchers.
  const handleConvertToInvoice = useCallback(async () => {
    if (!company?.guid || !doc) return;
    setConverting(true);
    try {
      const rawPayload = rawData?.rawPayload || {};
      const orderNo =
        (rawData?.againstOrderNo && !String(rawData.againstOrderNo).startsWith('TDK-'))
          ? rawData.againstOrderNo
          : (doc.documentNumber && doc.documentNumber !== 'Pending from TallyPrime'
            ? doc.documentNumber
            : undefined);

      const mapApiItems = (apiItems: any[]) => apiItems.map((it: any) => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        warehouse: it.godown || it.warehouse || '',
        product: it.itemName || it.product || it.name || '',
        qty: String(it.billedQty ?? it.actualQty ?? it.qty ?? 1),
        unit: it.unit || 'pcs',
        rate: String(it.rate || 0),
        discountType: (it.discountType === 'flat' ? 'flat' : '%') as '%' | 'flat',
        discount: String(it.discount ?? 0),
        taxEntries: Array.isArray(it.taxEntries) ? it.taxEntries : [],
      }));

      const mapApiLogistics = (logs: any[]) => (logs || []).map((lg: any) => ({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        ledgerName: lg.ledgerName || '',
        amount: String(lg.amount ?? ''),
        addTaxes: Array.isArray(lg.taxes) && lg.taxes.length > 0,
        taxEntries: (lg.taxes || []).map((t: any) => ({
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          ledgerName: t.ledgerName || '',
          taxRate: String(t.taxRate ?? ''),
          taxAmount: String(t.taxAmount ?? ''),
        })),
      }));

      let items;
      if (Array.isArray(rawPayload.items) && rawPayload.items.length) {
        items = mapApiItems(rawPayload.items);
        // Attach voucher-level taxes to first line when per-item taxEntries absent
        if (items[0] && (!items[0].taxEntries || items[0].taxEntries.length === 0)
            && Array.isArray(rawPayload.taxes) && rawPayload.taxes.length) {
          items[0] = {
            ...items[0],
            taxEntries: rawPayload.taxes.map((t: any) => ({
              id: Date.now().toString() + Math.random().toString(36).slice(2),
              ledgerName: t.ledgerName || '',
              taxRate: String(t.taxRate ?? ''),
              taxAmount: String(t.taxAmount ?? ''),
            })),
          };
        }
      } else {
        items = (doc.items || []).map(it => ({
          id: it.id || Date.now().toString() + Math.random().toString(36).slice(2),
          warehouse: '', product: it.name, qty: String(it.qty), unit: it.unit || 'pcs',
          rate: String(it.rate), discountType: '%' as const, discount: '0', taxEntries: [],
        }));
      }

      const prefill = {
        party: rawPayload.partyLedger || doc.party?.name || '',
        ledger: rawPayload.salesLedger || '',
        date: rawPayload.date ? isoToDMY(rawPayload.date) : isoToDMY(doc.date),
        refNo: rawPayload.reference || doc.reference || '',
        narration: rawPayload.narration || doc.narration || '',
        termsText: rawPayload.termsText || 'Goods once sold will not be taken back.',
        items,
        logEntries: mapApiLogistics(rawPayload.logistics || []),
        roundOffLedger: '',
        roundOffAmount: doc.totals?.roundOff ? String(doc.totals.roundOff) : '',
        againstOrderNo: orderNo,
        sourceTdkRef: tdkRef || '',
        dueDate: rawPayload.dueDate ? isoToDMY(rawPayload.dueDate) : '',
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(currentTenantKey(company.guid, prefillFeature('tdso')), JSON.stringify(prefill));
      router.replace('/sales/create-invoice');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Could not start invoice', text2: err?.message || '' });
    } finally {
      setConverting(false);
    }
  }, [company?.guid, doc, rawData, tdkRef, router]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Sales Order</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.brandPrimary} />
          <Text style={s.loadingTxt}>Loading order…</Text>
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
          <Text style={s.navTitle}>Sales Order</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.center}>
          <Ionicons name="warning-outline" size={40} color={COLORS.warning} />
          <Text style={s.errorTxt}>{error || 'Sales order not found.'}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchPreview} activeOpacity={0.8}>
            <Text style={s.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // DocumentPreviewPage owns SafeAreaView(top). Never place banners above it —
  // they sit under the device status bar and get clipped. It's a self-contained
  // flex column (nav + scroll + its own action bar), so wrapping it in `flex:1`
  // alongside our own bottom bar lets it size down naturally without overlap.
  return (
    <View style={s.safe}>
      <View style={{ flex: 1 }}>
        <DocumentPreviewPage
          document={doc}
          isProvisional={isProvisional}
        />
      </View>
      {/* Convert to Sales Invoice — persistent bottom bar below the document's own action bar */}
      <SafeAreaView edges={['bottom']} style={s.convertBar}>
        <TouchableOpacity
          style={[s.convertBtn, converting && { opacity: 0.7 }]}
          activeOpacity={0.85}
          disabled={converting}
          onPress={handleConvertToInvoice}
        >
          {converting
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Ionicons name="repeat-outline" size={16} color={COLORS.white} />}
          <Text style={s.convertBtnTxt}>{converting ? 'Starting invoice...' : 'Convert to Invoice'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
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
    backgroundColor: COLORS.info, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  convertBtnTxt: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.white },
});
