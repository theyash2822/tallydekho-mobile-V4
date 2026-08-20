import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentType, VoucherDocument } from '../../src/types/document';

import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { getVoucherById } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { TX_TO_DOC_TYPE, DOC_TYPE_CONFIG, amountInWords } from '../../src/utils/documentHelpers';
import { fromTallyVoucher } from '../../src/utils/voucherDocumentAdapter';
import { COLORS } from '../../src/constants/colors';

// Convert ISO '2025-04-04' → '04 Apr 2025'
function isoToDocDate(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.padStart(2,'0')} ${months[parseInt(m)-1] || ''} ${y}`;
}

/** Tally's voucher type string → our DocumentType. */
function resolveTallyDocType(rawType: string): DocumentType {
  const exact = TX_TO_DOC_TYPE[rawType] as DocumentType | undefined;
  if (exact) return exact;
  const lower = rawType.toLowerCase();
  if (lower.includes('debit')) return 'debit_note';
  if (lower.includes('credit')) return 'credit_note';
  if (lower.includes('delivery')) return 'delivery_note';
  if (lower.includes('quotation')) return 'quotation';
  if (lower.includes('sales order')) return 'sales_order';
  if (lower.includes('purchase order')) return 'purchase_order';
  if (lower.includes('sales')) return 'sales_invoice';
  if (lower.includes('purchase')) return 'purchase_invoice';
  // "Receipt Note" is an inventory voucher, not money in — it has to be matched
  // before the plain "receipt" test or it prints as a Receipt Voucher.
  if (lower.includes('receipt note')) return 'receipt_note';
  if (lower.includes('receipt')) return 'receipt_voucher';
  if (lower.includes('payment')) return 'payment_voucher';
  if (lower.includes('journal')) return 'journal_voucher';
  if (lower.includes('contra')) return 'contra_voucher';
  if (lower.includes('stock')) return 'stock_journal';
  return 'sales_invoice';
}

function apiVoucherToDoc(data: any, companyName: string): VoucherDocument {
  const rawType = data.voucher?.voucher_type || 'Sales GST';
  const docType = resolveTallyDocType(rawType);
  return fromTallyVoucher(
    data,
    companyName,
    docType,
    DOC_TYPE_CONFIG[docType]?.label || rawType,
    isoToDocDate,
    amountInWords
  );
}

export default function DocumentPage() {
  const params = useLocalSearchParams<{ id: string; type?: string }>();
  const { company } = useAuth();
  const companyGuid = company?.guid;
  const companyName = company?.name || '';
  const router = useRouter();

  const [doc, setDoc] = useState<VoucherDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) { setLoading(false); setError('No document ID provided'); return; }
    if (!companyGuid) { setLoading(false); setError('Company not loaded — please wait'); return; }
    setLoading(true);
    setError(null);
    getVoucherById(companyGuid, params.id)
      .then((res: any) => {
        if (res?.data?.voucher) {
          try {
            setDoc(apiVoucherToDoc(res.data, companyName));
          } catch (e: any) {
            setError('Failed to parse document: ' + (e?.message || 'unknown error'));
          }
        } else {
          setError('Document not found');
        }
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load document');
      })
      .finally(() => setLoading(false));
  }, [params.id, companyGuid]);

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      </View>
    );
  }

  if (error || !doc) {
    return (
      <View style={s.loader}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.textTertiary} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' }}>
          {error || 'Document not found'}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.brandPrimary, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <DocumentPreviewPage document={doc} />;
}

const s = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
