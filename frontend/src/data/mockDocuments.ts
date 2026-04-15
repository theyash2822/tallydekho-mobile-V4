import { VoucherDocument, DocumentType } from '../types/document';

// ── Sales Invoice Mock ────────────────────────────────────────────────────────
export const MOCK_SALES_INVOICE: VoucherDocument = {
  id: 'SI-30977',
  documentType: 'sales_invoice',
  documentTitle: 'Tax Invoice',
  documentNumber: 'SI-30977/2025-26',
  date: '03 May 2025',
  company: {
    name: 'XYZ Enterprises Pvt. Ltd.',
    address: 'Plot No. 45, RIICO Industrial Area, Bhiwadi, Rajasthan \u2013 301019',
    gstin: '08AABCX1234G1ZF',
    pan: 'AABCX1234G',
    phone: '+91-9876543210',
    email: 'accounts@xyzenterprises.com',
  },
  party: {
    name: 'Alliance Trading Co.',
    address: '12, MG Road, Jaipur, Rajasthan \u2013 302001',
    gstin: '08AAFCA1234F1ZX',
    phone: '+91-9812345678',
    email: 'purchase@alliance.com',
    stateCode: '08',
  },
  billing: {
    name: 'Alliance Trading Co.',
    line1: '12, MG Road, Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
  },
  shipping: {
    name: 'Alliance Trading Warehouse',
    line1: '22, Transport Nagar, Ajmer Road',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302006',
  },
  metadata: {
    orderRef: 'PO-2089',
    placeOfSupply: 'Rajasthan (08)',
    paymentTerms: 'Net 30 Days',
    dueDate: '02 Jun 2025',
  },
  items: [
    { id: '1', name: 'Electronic Component A', description: 'Grade A industrial capacitor',
      hsn: '8532', qty: 50, unit: 'Pcs', rate: 120, discount: 5, discountAmount: 300,
      taxPct: 18, taxAmount: 1026, amount: 6750 },
    { id: '2', name: 'Connector Module XL', description: '32-pin heavy duty connector',
      hsn: '8536', qty: 20, unit: 'Pcs', rate: 350, taxPct: 18, taxAmount: 1260, amount: 7000 },
    { id: '3', name: 'Cable Harness Set', description: '3-metre automotive cable set',
      hsn: '8544', qty: 10, unit: 'Set', rate: 480, taxPct: 12, taxAmount: 576, amount: 4800 },
  ],
  taxes: [
    { description: 'Electronics & Connectors (18%)', rate: 18, taxableAmount: 13750,
      cgst: 1237.50, sgst: 1237.50, total: 2475 },
    { description: 'Cable Harness (12%)', rate: 12, taxableAmount: 4800,
      cgst: 288, sgst: 288, total: 576 },
  ],
  totals: {
    subtotal: 18550, discount: 300, taxableAmount: 18550,
    cgstTotal: 1525.50, sgstTotal: 1525.50, taxTotal: 3051,
    roundOff: -0.50, total: 21301, balanceDue: 21301,
  },
  narration: 'Goods dispatched in good condition as per order. Kindly acknowledge receipt.',
  terms: '1. Payment due within 30 days of invoice date.\n2. Goods once sold will not be taken back.\n3. Subject to Jaipur jurisdiction only.',
  footerInfo: {
    authorizedSignatory: 'XYZ Enterprises Pvt. Ltd.',
    receiverNote: "Receiver's Signature",
    systemNote: 'Computer generated invoice. No signature required.',
    declaration: 'We declare that this invoice shows the actual price of goods described and that all particulars are true and correct.',
  },
};

// ── Payment Voucher Mock ──────────────────────────────────────────────────────
export const MOCK_PAYMENT_VOUCHER: VoucherDocument = {
  id: 'PV-2089',
  documentType: 'payment_voucher',
  documentTitle: 'Payment Voucher',
  documentNumber: 'PV-2089/2025-26',
  date: '10 May 2025',
  company: {
    name: 'XYZ Enterprises Pvt. Ltd.',
    address: 'Plot No. 45, RIICO Industrial Area, Bhiwadi, Rajasthan \u2013 301019',
    gstin: '08AABCX1234G1ZF',
    phone: '+91-9876543210',
    email: 'accounts@xyzenterprises.com',
  },
  party: {
    name: 'Indian Steel Traders',
    address: 'Sector 14, Industrial Area, Bhiwadi, Rajasthan',
    phone: '+91-9800001234',
  },
  ledgerEntries: [
    { id: '1', particulars: 'Indian Steel Traders', narration: 'Payment against Invoice INV-4521', debit: 20000 },
    { id: '2', particulars: 'HDFC Bank Current A/c', narration: 'Transfer via NEFT', credit: 20000 },
  ],
  totals: { drTotal: 20000, crTotal: 20000, total: 20000 },
  paymentDetails: {
    mode: 'NEFT',
    bankName: 'HDFC Bank',
    accountNo: 'XXXX1234',
    ifsc: 'HDFC0001234',
    transactionRef: 'NEFT-TXN-78934512',
    instrumentDate: '10 May 2025',
  },
  narration: 'Payment to Indian Steel Traders against Invoice INV-4521 dated 03 May 2025.',
  footerInfo: {
    authorizedSignatory: 'XYZ Enterprises Pvt. Ltd.',
    systemNote: 'Computer generated voucher.',
  },
};

// ── Document registry ─────────────────────────────────────────────────────────
const REGISTRY: Record<string, VoucherDocument> = {
  [MOCK_SALES_INVOICE.id]:    MOCK_SALES_INVOICE,
  [MOCK_PAYMENT_VOUCHER.id]:  MOCK_PAYMENT_VOUCHER,
};

export function getDocument(id: string, type?: DocumentType): VoucherDocument {
  // Try exact ID match first
  if (REGISTRY[id]) return REGISTRY[id];

  // Fallback: return voucher mock for voucher types, invoice mock for rest
  const voucherTypes: DocumentType[] = ['payment_voucher', 'receipt_voucher', 'contra_voucher', 'journal_voucher'];
  const base = type && voucherTypes.includes(type)
    ? { ...MOCK_PAYMENT_VOUCHER }
    : { ...MOCK_SALES_INVOICE };

  return {
    ...base,
    id,
    documentType: type || base.documentType,
    documentNumber: `${id}/2025-26`,
  };
}
