import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DocumentType, VoucherDocument } from '../../src/types/document';

import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { getVoucherById } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { TX_TO_DOC_TYPE, DOC_TYPE_CONFIG, amountInWords } from '../../src/utils/documentHelpers';
import { COLORS } from '../../src/constants/colors';

// Convert ISO '2025-04-04' → '04 Apr 2025'
function isoToDocDate(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.padStart(2,'0')} ${months[parseInt(m)-1] || ''} ${y}`;
}

function apiVoucherToDoc(data: any, companyName: string): VoucherDocument {
  const v = data.voucher;
  const apiItems = data.items || [];
  const gst = data.gst || null;
  const partyLedger = data.party || null;
  const co = data.company || null;

  // Map voucher type to document type
  const rawType = v.voucher_type || 'Sales GST';
  // Try exact match first, then partial
  let docType: DocumentType = (TX_TO_DOC_TYPE[rawType] as DocumentType);
  if (!docType) {
    const lower = rawType.toLowerCase();
    if (lower.includes('sales')) docType = 'sales_invoice';
    else if (lower.includes('purchase')) docType = 'purchase_invoice';
    else if (lower.includes('receipt')) docType = 'receipt_voucher';
    else if (lower.includes('payment')) docType = 'payment_voucher';
    else if (lower.includes('journal')) docType = 'journal_voucher';
    else if (lower.includes('contra')) docType = 'contra_voucher';
    else if (lower.includes('debit')) docType = 'debit_note';
    else if (lower.includes('credit')) docType = 'credit_note';
    else docType = 'sales_invoice';
  }

  const documentTitle = DOC_TYPE_CONFIG[docType]?.label || rawType;
  // Use party_amount (per-party ledger entry) when available — v.amount can be wrong when Tally has multiple parties
  const totalAmount = parseFloat((v.party_amount ?? v.amount) || '0');

  // Map inventory items
  const items = apiItems.length > 0 ? apiItems.map((item: any, i: number) => ({
    id: String(item.id || i),
    name: item.stock_item_name || '—',
    hsn: item.hsn || undefined,
    qty: parseFloat(item.actual_qty || item.billed_qty || '0'),
    unit: item.unit || 'Nos',
    rate: parseFloat(item.rate || '0'),
    discount: parseFloat(item.discount || '0') || undefined,
    taxPct: undefined,
    amount: parseFloat(item.amount || '0'),
  })) : undefined;

  // GST tax lines — show whenever a gst_voucher_details record exists for this voucher
  // (even if amounts are 0 — GST-exempt goods still need the section to show reg type/place of supply)
  const hasTax = !!gst;
  const taxes = hasTax ? [{
    description: gst.gst_reg_type ? `GST (${gst.gst_reg_type})` : 'GST',
    rate: 0,
    taxableAmount: parseFloat(gst.taxable_amount || '0'),
    cgst: parseFloat(gst.cgst_amount) > 0 ? parseFloat(gst.cgst_amount) : undefined,
    sgst: parseFloat(gst.sgst_amount) > 0 ? parseFloat(gst.sgst_amount) : undefined,
    igst: parseFloat(gst.igst_amount) > 0 ? parseFloat(gst.igst_amount) : undefined,
    total: parseFloat(gst.cgst_amount||'0') + parseFloat(gst.sgst_amount||'0') + parseFloat(gst.igst_amount||'0'),
  }] : undefined;

  // Totals
  const taxTotal = taxes ? taxes.reduce((s: number, t: any) => s + t.total, 0) : 0;
  const subtotal = parseFloat(gst?.taxable_amount || '0') || (totalAmount - taxTotal);

  return {
    id: v.guid || String(v.id),
    documentType: docType,
    documentTitle,
    documentNumber: String(v.voucher_number || '—'),
    date: isoToDocDate(v.date || ''),
    company: {
      name: companyName || co?.name || 'Company',
      address: [co?.address, co?.state, co?.country].filter(Boolean).join(', ') || '',
      gstin: co?.gstin || undefined,
      state: co?.state || undefined,
      email: co?.email || undefined,
    },
    party: v.party_name ? {
      name: v.party_name,
      gstin: partyLedger?.gstin || gst?.party_name || undefined,
      address: partyLedger?.address || undefined,
      phone: partyLedger?.phone || undefined,
    } : undefined,
    narration: v.narration || undefined,
    reference: v.reference || undefined,
    items,
    taxes,
    totals: {
      subtotal: subtotal > 0 ? subtotal : totalAmount,
      taxTotal: taxTotal > 0 ? taxTotal : undefined,
      cgstTotal: taxes?.[0]?.cgst,
      sgstTotal: taxes?.[0]?.sgst,
      igstTotal: taxes?.[0]?.igst,
      total: totalAmount,
      totalInWords: amountInWords(totalAmount),
    },
  };
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
