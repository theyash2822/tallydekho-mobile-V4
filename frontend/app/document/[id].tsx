import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { DocumentType, VoucherDocument } from '../../src/types/document';
import { getDocument } from '../../src/data/mockDocuments';
import DocumentPreviewPage from '../../src/components/document/DocumentPreviewPage';
import { getVoucherById } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { TX_TO_DOC_TYPE } from '../../src/utils/documentHelpers';
import { amountInWords } from '../../src/utils/documentHelpers';
import { COLORS } from '../../src/constants/colors';

function apiVoucherToDoc(data: any, companyName: string): VoucherDocument {
  const v = data.voucher;
  const items = data.items || [];
  const gst = data.gst || null;
  const party = data.party || null;
  const co = data.company || null;

  const voucherType = v.voucher_type || 'Sales GST';
  const docType: DocumentType = (TX_TO_DOC_TYPE[voucherType] as DocumentType) || 'sales_invoice';

  const totalAmount = parseFloat(v.amount || 0);

  // Map inventory items
  const mappedItems = items.map((item: any, i: number) => ({
    id: String(item.id || i),
    name: item.stock_item_name || '—',
    hsn: item.hsn || undefined,
    qty: parseFloat(item.actual_qty || item.billed_qty || 0),
    unit: item.unit || 'Nos',
    rate: parseFloat(item.rate || 0),
    taxPct: undefined,
    taxAmount: undefined,
    amount: parseFloat(item.amount || 0),
  }));

  // Tax lines from GST details
  const taxes = gst && (parseFloat(gst.taxable_amount) > 0 || parseFloat(gst.cgst_amount) > 0) ? [{
    description: gst.gst_reg_type || 'GST',
    rate: 0,
    taxableAmount: parseFloat(gst.taxable_amount || 0),
    cgst: parseFloat(gst.cgst_amount || 0) || undefined,
    sgst: parseFloat(gst.sgst_amount || 0) || undefined,
    igst: parseFloat(gst.igst_amount || 0) || undefined,
    total: (parseFloat(gst.cgst_amount || 0) + parseFloat(gst.sgst_amount || 0) + parseFloat(gst.igst_amount || 0)),
  }] : [];

  return {
    id: v.guid || v.id,
    documentType: docType,
    number: String(v.voucher_number || '—'),
    date: v.date || '',
    status: v.is_cancelled ? 'cancelled' : 'confirmed',
    company: {
      name: companyName || co?.name || 'Company',
      address: '',
      gstin: co?.gstin || undefined,
    },
    party: {
      name: v.party_name || '—',
      gstin: party?.gstin || gst?.party_name || undefined,
      address: party?.address || undefined,
      phone: party?.phone || undefined,
    },
    narration: v.narration || undefined,
    reference: v.reference || undefined,
    items: mappedItems.length > 0 ? mappedItems : undefined,
    ledgerEntries: undefined,
    taxes: taxes.length > 0 ? taxes : undefined,
    totals: {
      subtotal: parseFloat(gst?.taxable_amount || 0) || totalAmount,
      taxTotal: taxes.reduce((s: number, t: any) => s + t.total, 0) || undefined,
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

  const [doc, setDoc] = useState<VoucherDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) {
      setDoc(getDocument(params.id, params.type as DocumentType | undefined));
      setLoading(false);
      return;
    }
    setLoading(true);
    getVoucherById(companyGuid, params.id)
      .then((res: any) => {
        if (res?.data?.voucher) {
          setDoc(apiVoucherToDoc(res.data, companyName));
        } else {
          // Fallback to mock
          setDoc(getDocument(params.id, params.type as DocumentType | undefined));
        }
      })
      .catch(() => {
        setDoc(getDocument(params.id, params.type as DocumentType | undefined));
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

  return <DocumentPreviewPage document={doc || getDocument(params.id, params.type as DocumentType | undefined)} />;
}

const s = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
