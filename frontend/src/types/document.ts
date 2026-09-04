// ── Document Type Enum ────────────────────────────────────────────────────────
export type DocumentType =
  | 'sales_invoice'  | 'sales_order'  | 'quotation'
  | 'delivery_note'  | 'credit_note'  | 'debit_note'
  | 'purchase_invoice' | 'purchase_order' | 'receipt_note'
  | 'payment_voucher' | 'receipt_voucher' | 'contra_voucher'
  | 'journal_voucher' | 'stock_journal'
  | 'proforma_invoice' | 'expense_voucher';

// ── Sub-interfaces ────────────────────────────────────────────────────────────
export interface CompanyInfo {
  name: string;
  address: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
}

export interface PartyInfo {
  name: string;
  address?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  stateCode?: string;
}

export interface AddressInfo {
  name?: string;
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface ItemLine {
  id: string;
  name: string;
  description?: string;
  hsn?: string;
  qty: number;
  unit: string;
  rate: number;
  discount?: number;
  discountAmount?: number;
  taxPct?: number;
  taxAmount?: number;
  amount: number;
}

export interface LedgerEntry {
  id: string;
  particulars: string;
  narration?: string;
  debit?: number;
  credit?: number;
}

export interface TaxLine {
  description: string;
  rate: number;
  taxableAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total: number;
}

export interface Totals {
  subtotal?: number;
  discount?: number;
  taxableAmount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  taxTotal?: number;
  roundOff?: number;
  total: number;
  balanceDue?: number;
  drTotal?: number;
  crTotal?: number;
}

export interface PaymentDetails {
  mode: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  upi?: string;
  chequeNo?: string;
  transactionRef?: string;
  instrumentDate?: string;
}

export interface DocMetadata {
  orderRef?: string;
  invoiceRef?: string;
  deliveryTerms?: string;
  transportDetails?: string;
  vehicleNo?: string;
  warehouse?: string;
  paymentTerms?: string;
  dueDate?: string;
  costCentre?: string;
  placeOfSupply?: string;
  eway?: string;
}

export interface FooterInfo {
  authorizedSignatory?: string;
  receiverNote?: string;
  systemNote?: string;
  declaration?: string;
}

// ── Master Document Model ─────────────────────────────────────────────────────
export interface VoucherDocument {
  id: string;
  documentType: DocumentType;
  documentTitle: string;
  documentNumber: string;
  date: string;
  company: CompanyInfo;
  party?: PartyInfo;
  billing?: AddressInfo;
  shipping?: AddressInfo;
  metadata?: DocMetadata;
  items?: ItemLine[];
  ledgerEntries?: LedgerEntry[];
  taxes?: TaxLine[];
  totals: Totals;
  paymentDetails?: PaymentDetails;
  narration?: string;
  terms?: string;
  footerInfo?: FooterInfo;
}
