// ── Document Type Enum ────────────────────────────────────────────────────────
export type DocumentType =
  | 'sales_invoice'  | 'proforma_invoice' | 'sales_order'
  | 'delivery_note'  | 'credit_note'  | 'debit_note'
  | 'purchase_invoice' | 'purchase_order' | 'receipt_note'
  | 'payment_voucher' | 'receipt_voucher' | 'contra_voucher'
  | 'journal_voucher' | 'stock_journal';

// ── Sub-interfaces ────────────────────────────────────────────────────────────
export interface CompanyInfo {
  name: string;
  address: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  state?: string;
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
  reference?: string;
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
  totalInWords?: string;
  balanceDue?: number;
  drTotal?: number;
  crTotal?: number;
}

export interface PaymentDetails {
  mode: string;
  /** Tally ledger name used for the payment (e.g. 'HDFC Bank', 'Cash') */
  ledgerName?: string;
  /** Payment amount collected at time of invoice */
  amount?: number;
  /** Payment reference / UTR / cheque number */
  reference?: string;
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
export interface DispatchDetails {
  /** Tally-synced vouchers use address/place; app-created vouchers use dispatch_from */
  dispatch_from?: string;
  dispatch_from_address?: string;
  dispatch_from_place?: string;
  dispatch_from_state?: string;
  dispatch_from_pincode?: string;
  /** Tally-synced vouchers use address/place; app-created vouchers use ship_to */
  ship_to?: string;
  ship_to_address?: string;
  ship_to_place?: string;
  ship_to_state?: string;
  transport_mode?: string;
  transport_mode_simple?: string;
  transporter_name?: string;
  transporter_id?: string;
  vehicle_number?: string;
  vehicle_type?: string;
  transport_doc_no?: string;
  transport_doc_date?: string;
  ship_to_destination?: string;
  document_type?: string;
}

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
  reference?: string;
  terms?: string;
  footerInfo?: FooterInfo;
  dispatchDetails?: DispatchDetails;
}
