import { VoucherDocument, DocumentType, CompanyInfo } from '../types/document';

// ─── Shared seller / company letterhead (matches uploaded Tally PDFs) ─────────
const COMPANY: CompanyInfo = {
  name: 'Yash Ki Company',
  address: 'New Bus Stand, Rajgarh, Distt. Dhar, Madhya Pradesh \u2013 454116',
  gstin: '23ACLPP1226E1ZZ',
  pan: 'ACLPP1226E',
  phone: '+91-98765 43210',
  email: 'maheshwari.govind63@gmail.com',
};

// ══════════════════════════════════════════════════════════════════════════════
// FINANCIAL VOUCHERS (ledger-entry based)
// ══════════════════════════════════════════════════════════════════════════════

// ── Receipt Voucher (Receipt_23.pdf) ─────────────────────────────────────────
export const MOCK_RECEIPT_VOUCHER: VoucherDocument = {
  id: 'RV-23',
  documentType: 'receipt_voucher',
  documentTitle: 'Receipt Voucher',
  documentNumber: 'RV-23/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Bhagirath Ramaji Khalwala',
    address: 'Moyakheda, Madhya Pradesh',
  },
  ledgerEntries: [
    { id: '1', particulars: 'Cash A/c', narration: 'Amount received into Cash', debit: 30000 },
    {
      id: '2', particulars: 'Bhagirath Ramaji Khalwala Moyakheda',
      narration: 'Agst Ref 0155, 0192, 0239, 0442, 0603, 0639 (17-18) + Advance',
      credit: 30000,
    },
  ],
  totals: { drTotal: 30000, crTotal: 30000, total: 30000 },
  paymentDetails: { mode: 'Cash' },
  narration: 'this entry has been done by tally',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    receiverNote: "Receiver's Signature",
    systemNote: 'This is a Computer Generated Voucher.',
  },
};

// ── Contra Voucher (Contra_3.pdf) ─────────────────────────────────────────────
export const MOCK_CONTRA_VOUCHER: VoucherDocument = {
  id: 'CV-3',
  documentType: 'contra_voucher',
  documentTitle: 'Contra Voucher',
  documentNumber: 'CV-3/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  ledgerEntries: [
    { id: '1', particulars: 'HDFC Bank Rajgarh', narration: 'Cash deposited into bank', debit: 50000 },
    { id: '2', particulars: 'Cash A/c', narration: 'Cash withdrawn for deposit', credit: 50000 },
  ],
  totals: { drTotal: 50000, crTotal: 50000, total: 50000 },
  paymentDetails: { mode: 'Cash Deposit', bankName: 'HDFC Bank, Rajgarh' },
  narration: 'made by tally',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    systemNote: 'This is a Computer Generated Voucher.',
  },
};

// ── Payment Voucher (Payment_9.pdf) ───────────────────────────────────────────
export const MOCK_PAYMENT_VOUCHER: VoucherDocument = {
  id: 'PV-9',
  documentType: 'payment_voucher',
  documentTitle: 'Payment Voucher',
  documentNumber: 'PV-9/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Mahaveer Trading Company',
    address: 'Ratlam, Madhya Pradesh',
  },
  ledgerEntries: [
    {
      id: '1', particulars: 'Mahaveer Trading Company',
      narration: 'Agst Ref 508, 550, 2641, 662 + On Account 29,302',
      debit: 250000,
    },
    { id: '2', particulars: 'Cash A/c', narration: 'Paid through Cash', credit: 250000 },
  ],
  totals: { drTotal: 250000, crTotal: 250000, total: 250000 },
  paymentDetails: { mode: 'Cash' },
  narration: 'this entry done by tally',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    systemNote: 'This is a Computer Generated Voucher.',
  },
};

// ── Journal Voucher (journal.pdf) ─────────────────────────────────────────────
export const MOCK_JOURNAL_VOUCHER: VoucherDocument = {
  id: 'JV-2',
  documentType: 'journal_voucher',
  documentTitle: 'Journal Voucher',
  documentNumber: 'JV-2/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  ledgerEntries: [
    { id: '1', particulars: 'Shree Rajendra Suri Bank', narration: 'Adjustment entry', debit: 2000 },
    { id: '2', particulars: 'Bhanalal Uda Kanjrota', narration: 'Adjustment entry', credit: 2000 },
  ],
  totals: { drTotal: 2000, crTotal: 2000, total: 2000 },
  narration: 'done by tally',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    systemNote: 'This is a Computer Generated Voucher.',
  },
};

// ── Expense Voucher (standard Tally format) ───────────────────────────────────
export const MOCK_EXPENSE_VOUCHER: VoucherDocument = {
  id: 'EV-5',
  documentType: 'expense_voucher',
  documentTitle: 'Expense Voucher',
  documentNumber: 'EV-5/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  ledgerEntries: [
    { id: '1', particulars: 'Shop Rent A/c', narration: 'Rent for the month of Aug 2026', debit: 20000 },
    { id: '2', particulars: 'Electricity Charges A/c', narration: 'Electricity bill Aug 2026', debit: 5000 },
    { id: '3', particulars: 'Cash A/c', narration: 'Paid through Cash', credit: 25000 },
  ],
  totals: { drTotal: 25000, crTotal: 25000, total: 25000 },
  paymentDetails: { mode: 'Cash' },
  narration: 'Being shop rent and electricity charges paid for the month.',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    systemNote: 'This is a Computer Generated Voucher.',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// TRADE DOCUMENTS (item / goods based)
// ══════════════════════════════════════════════════════════════════════════════

// ── Purchase Order (PURCHASE ORDER.pdf) ───────────────────────────────────────
export const MOCK_PURCHASE_ORDER: VoucherDocument = {
  id: 'PO-2',
  documentType: 'purchase_order',
  documentTitle: 'Purchase Order',
  documentNumber: 'PO-2/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Malhar Drip Fertigation',
    address: 'Badwani, Madhya Pradesh',
    gstin: '23DXGPK5269D1ZI',
    stateCode: '23',
  },
  metadata: {
    placeOfSupply: 'Madhya Pradesh (23)',
    paymentTerms: '30 Days',
  },
  items: [
    { id: '1', name: 'Maize 3591 4kg', hsn: '10059000', qty: 500, unit: 'nos', rate: 50, discount: 50, discountAmount: 12500, taxPct: 18, amount: 12500 },
    { id: '2', name: 'Micromix 500ml', hsn: '3105', qty: 500, unit: 'nos', rate: 60, discount: 30, discountAmount: 9000, taxPct: 18, amount: 21000 },
    { id: '3', name: 'Packing Material Expenses', qty: 1, unit: 'lot', rate: 5000, amount: 5000 },
  ],
  taxes: [
    { description: 'Packing Material (18%)', rate: 18, taxableAmount: 5000, cgst: 450, sgst: 450, total: 900 },
  ],
  totals: {
    subtotal: 38500, cgstTotal: 450, sgstTotal: 450, taxTotal: 900, total: 39400,
  },
  narration: 'Purchase order raised for seasonal agri inputs.',
  terms: 'E. & O.E.\n1. Goods to be supplied in good condition.\n2. Subject to Sardarpur jurisdiction only.',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    systemNote: 'This is a Computer Generated Order.',
  },
};

// ── Purchase Invoice (PURCHASE INVOCE.pdf) ────────────────────────────────────
export const MOCK_PURCHASE_INVOICE: VoucherDocument = {
  id: 'PI-1',
  documentType: 'purchase_invoice',
  documentTitle: 'Purchase Invoice',
  documentNumber: 'PI-1/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Barrix Agro Sciences Pvt. Ltd.',
    address: '23, Classic Purnima Park, Near Bombay Hospital, Indore (M.P.)',
    gstin: '23AAECB4102F1ZG',
    stateCode: '23',
  },
  metadata: {
    invoiceRef: 'Supplier Inv. 123 dt. 20-Aug-26',
    placeOfSupply: 'Madhya Pradesh (23)',
  },
  items: [
    { id: '1', name: 'Maize White 2002 1 KG', hsn: '10059000', qty: 5000, unit: 'nos', rate: 50, discount: 25, discountAmount: 62500, taxPct: 18, amount: 187500 },
    { id: '2', name: 'Cyper 25% 1 Ltr', hsn: '3808', qty: 50000, unit: 'nos', rate: 50, discount: 25, discountAmount: 625000, taxPct: 18, amount: 1875000 },
    { id: '3', name: 'Packing Material Expenses', qty: 1, unit: 'lot', rate: 5000, amount: 5000 },
  ],
  taxes: [
    { description: 'Packing Material (18%)', rate: 18, taxableAmount: 5000, cgst: 450, sgst: 450, total: 900 },
  ],
  totals: {
    subtotal: 2067500, cgstTotal: 450, sgstTotal: 450, taxTotal: 900, roundOff: 600, total: 2069000,
  },
  narration: 'Purchase of agri inputs against supplier invoice 123.',
  terms: 'E. & O.E.',
  footerInfo: {
    authorizedSignatory: 'Barrix Agro Sciences Pvt. Ltd.',
    systemNote: 'This is a Computer Generated Invoice.',
  },
};

// ── Proforma Invoice (performa invoice.pdf) ───────────────────────────────────
export const MOCK_PROFORMA_INVOICE: VoucherDocument = {
  id: 'PF-0002',
  documentType: 'proforma_invoice',
  documentTitle: 'Proforma Invoice',
  documentNumber: '0002/17-18',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Pawan Sales Services',
    address: 'Flat No. 12, Ganesha Apartments, Gandhi Path West, Near Vaishali Nagar',
    gstin: '08EDTPH9776C1E',
    stateCode: '08',
  },
  shipping: {
    name: 'Pawan Sales Services',
    line1: 'Flat No. 12, Ganesha Apartments, Gandhi Path West',
    city: 'Jaipur',
    state: 'Rajasthan',
  },
  metadata: { placeOfSupply: 'Rajasthan (08)' },
  items: [
    { id: '1', name: 'Maize 3033 4kg', hsn: '10051000', qty: 50, unit: 'nos', rate: 1250, discount: 2, discountAmount: 1250, taxPct: 18, amount: 61250 },
    { id: '2', name: 'Green Gold 500ML', hsn: '3808', qty: 60, unit: 'nos', rate: 3000, discount: 3, discountAmount: 5400, taxPct: 18, amount: 174600 },
    { id: '3', name: 'Packing Material Expenses', qty: 1, unit: 'lot', rate: 5000, amount: 5000 },
  ],
  taxes: [
    { description: 'Green Gold 500ML (18%)', rate: 18, taxableAmount: 174600, cgst: 15714, sgst: 15714, total: 31428 },
  ],
  totals: {
    subtotal: 240850, cgstTotal: 15714, sgstTotal: 15714, taxTotal: 31428, total: 272278,
  },
  narration: 'Proforma invoice issued for buyer approval.',
  terms: 'E. & O.E.\nSubject to Sardarpur jurisdiction.',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    systemNote: 'This is a Computer Generated Proforma Invoice.',
  },
};

// ── Sales / Tax Invoice (sales invoice.pdf) ───────────────────────────────────
export const MOCK_SALES_INVOICE: VoucherDocument = {
  id: 'SI-000',
  documentType: 'sales_invoice',
  documentTitle: 'Tax Invoice',
  documentNumber: '000/17-18',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Bharti Computers Indore',
    address: 'Indore, Madhya Pradesh',
    gstin: '23AIGPK8030Q1ZZ',
    stateCode: '23',
  },
  billing: { name: 'Bharti Computers Indore', line1: 'Indore', state: 'Madhya Pradesh' },
  metadata: { placeOfSupply: 'Madhya Pradesh (23)' },
  items: [
    { id: '1', name: 'Manzo 100ML', hsn: '38089199', qty: 50, unit: 'nos', rate: 2500, discount: 5, discountAmount: 6250, taxPct: 18, amount: 118750 },
  ],
  taxes: [
    { description: 'Manzo 100ML (18%)', rate: 18, taxableAmount: 118750, cgst: 10687.5, sgst: 10687.5, total: 21375 },
  ],
  totals: {
    subtotal: 118750, cgstTotal: 10687.5, sgstTotal: 10687.5, taxTotal: 21375, total: 140125,
  },
  narration: 'Goods dispatched as per order.',
  terms: 'SUBJECT TO SARDARPUR JURISDICTION',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    receiverNote: "Receiver's Signature",
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    systemNote: 'This is a Computer Generated Invoice.',
  },
};

// ── Credit Note (standard Tally sales-return format) ──────────────────────────
export const MOCK_CREDIT_NOTE: VoucherDocument = {
  id: 'CN-1',
  documentType: 'credit_note',
  documentTitle: 'Credit Note',
  documentNumber: 'CN-1/2025-26',
  date: '22 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Bharti Computers Indore',
    address: 'Indore, Madhya Pradesh',
    gstin: '23AIGPK8030Q1ZZ',
    stateCode: '23',
  },
  billing: { name: 'Bharti Computers Indore', line1: 'Indore', state: 'Madhya Pradesh' },
  metadata: { invoiceRef: 'Against Inv. 000/17-18', placeOfSupply: 'Madhya Pradesh (23)' },
  items: [
    { id: '1', name: 'Manzo 100ML', hsn: '38089199', qty: 5, unit: 'nos', rate: 2500, taxPct: 18, amount: 12500 },
  ],
  taxes: [
    { description: 'Manzo 100ML (18%)', rate: 18, taxableAmount: 12500, cgst: 1125, sgst: 1125, total: 2250 },
  ],
  totals: {
    subtotal: 12500, cgstTotal: 1125, sgstTotal: 1125, taxTotal: 2250, total: 14750,
  },
  narration: 'Being goods returned against Invoice 000/17-18 dated 20-Aug-26.',
  terms: 'SUBJECT TO SARDARPUR JURISDICTION',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    declaration: 'Credit note issued towards sales return / rate difference.',
    systemNote: 'This is a Computer Generated Credit Note.',
  },
};

// ── Delivery Note (standard Tally dispatch challan format) ─────────────────────
export const MOCK_DELIVERY_NOTE: VoucherDocument = {
  id: 'DN-1',
  documentType: 'delivery_note',
  documentTitle: 'Delivery Note',
  documentNumber: 'DN-1/2025-26',
  date: '20 Aug 2026',
  company: COMPANY,
  party: {
    name: 'Bharti Computers Indore',
    address: 'Indore, Madhya Pradesh',
    gstin: '23AIGPK8030Q1ZZ',
    stateCode: '23',
  },
  shipping: {
    name: 'Bharti Computers Indore',
    line1: 'MG Road, Indore',
    city: 'Indore',
    state: 'Madhya Pradesh',
  },
  metadata: {
    orderRef: 'SO-118',
    placeOfSupply: 'Madhya Pradesh (23)',
    vehicleNo: 'MP-09-GH-1234',
    transportDetails: 'By Road',
    deliveryTerms: 'Door Delivery',
  },
  items: [
    { id: '1', name: 'Manzo 100ML', hsn: '38089199', qty: 50, unit: 'nos', rate: 2500, amount: 125000 },
  ],
  totals: { subtotal: 125000, total: 125000 },
  narration: 'Goods dispatched against Sales Order SO-118. Kindly acknowledge receipt.',
  terms: 'Received the above goods in good condition.',
  footerInfo: {
    authorizedSignatory: 'Yash Ki Company',
    receiverNote: "Receiver's Signature",
    systemNote: 'This is a Computer Generated Delivery Note.',
  },
};

// ── Document registry ─────────────────────────────────────────────────────────
const REGISTRY: Record<string, VoucherDocument> = {
  [MOCK_RECEIPT_VOUCHER.id]:   MOCK_RECEIPT_VOUCHER,
  [MOCK_CONTRA_VOUCHER.id]:    MOCK_CONTRA_VOUCHER,
  [MOCK_PAYMENT_VOUCHER.id]:   MOCK_PAYMENT_VOUCHER,
  [MOCK_JOURNAL_VOUCHER.id]:   MOCK_JOURNAL_VOUCHER,
  [MOCK_EXPENSE_VOUCHER.id]:   MOCK_EXPENSE_VOUCHER,
  [MOCK_PURCHASE_ORDER.id]:    MOCK_PURCHASE_ORDER,
  [MOCK_PURCHASE_INVOICE.id]:  MOCK_PURCHASE_INVOICE,
  [MOCK_PROFORMA_INVOICE.id]:  MOCK_PROFORMA_INVOICE,
  [MOCK_SALES_INVOICE.id]:     MOCK_SALES_INVOICE,
  [MOCK_CREDIT_NOTE.id]:       MOCK_CREDIT_NOTE,
  [MOCK_DELIVERY_NOTE.id]:     MOCK_DELIVERY_NOTE,
};

// Fallback template per document type (used when an id isn't registered)
const TYPE_TEMPLATES: Partial<Record<DocumentType, VoucherDocument>> = {
  receipt_voucher:  MOCK_RECEIPT_VOUCHER,
  contra_voucher:   MOCK_CONTRA_VOUCHER,
  payment_voucher:  MOCK_PAYMENT_VOUCHER,
  journal_voucher:  MOCK_JOURNAL_VOUCHER,
  expense_voucher:  MOCK_EXPENSE_VOUCHER,
  purchase_order:   MOCK_PURCHASE_ORDER,
  purchase_invoice: MOCK_PURCHASE_INVOICE,
  proforma_invoice: MOCK_PROFORMA_INVOICE,
  sales_invoice:    MOCK_SALES_INVOICE,
  sales_order:      MOCK_SALES_INVOICE,
  quotation:        MOCK_PROFORMA_INVOICE,
  credit_note:      MOCK_CREDIT_NOTE,
  debit_note:       MOCK_CREDIT_NOTE,
  delivery_note:    MOCK_DELIVERY_NOTE,
};

export function getDocument(id: string, type?: DocumentType): VoucherDocument {
  // Exact registered mock wins
  if (REGISTRY[id]) return REGISTRY[id];

  // Otherwise clone the best template for the requested type
  const template = (type && TYPE_TEMPLATES[type]) || MOCK_SALES_INVOICE;
  return {
    ...template,
    id,
    documentType: type || template.documentType,
    documentNumber: `${id}/2025-26`,
  };
}
