// ── Document Type Enum ────────────────────────────────────────────────────────
// `quotation` and `receipt_note` are display-only: the app has no create screen
// or write path for them, but Tally companies do sync them and they must print
// with their own title rather than falling back to a Tax Invoice.
export type DocumentType =
  | 'sales_invoice'  | 'proforma_invoice' | 'sales_order'
  | 'delivery_note'  | 'credit_note'  | 'debit_note'
  | 'purchase_invoice' | 'purchase_order' | 'receipt_note'
  | 'payment_voucher' | 'receipt_voucher' | 'contra_voucher'
  | 'journal_voucher' | 'expense_voucher' | 'stock_journal' | 'quotation';

// ── Sub-interfaces ────────────────────────────────────────────────────────────
export interface CompanyInfo {
  name: string;
  address: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  /** Print-only, from the company print profile. */
  jurisdiction?: string;
  declarationText?: string;
  bank?: BankInfo | null;
}

export interface PartyInfo {
  name: string;
  address?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
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
  /** '%' or '' — Tally prints the discount column as a percentage. */
  discountType?: string;
  discountAmount?: number;
  taxPct?: number;
  taxAmount?: number;
  taxableAmount?: number;
  amount: number;
  godown?: string;
  batch?: string;
  /** Sales / purchase ledger this line is posted to (Tally accounting allocation). */
  ledgerName?: string;
  /** Stock Journal only: 'out' is Source (Consumption), 'in' is Destination. */
  direction?: 'in' | 'out';
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
  /** 'cgst' | 'sgst' | 'igst' | 'cess' | 'other' */
  kind?: string;
  rate: number;
  taxableAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  total: number;
}

export interface Totals {
  subtotal?: number;
  discount?: number;
  taxableAmount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  cessTotal?: number;
  chargeTotal?: number;
  taxTotal?: number;
  roundOff?: number;
  /** Ledger name Tally used for round-off (e.g. "Rounded Off"). */
  roundOffLabel?: string;
  total: number;
  totalQty?: number;
  totalInWords?: string;
  taxAmountInWords?: string;
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

/**
 * The full right-hand metadata grid of the Tally invoice layout.
 * Every label is always present because Tally prints the label even when blank
 * (see tallydekho-brain/PDF_LAYOUT_SPEC.md section 2.5).
 */
export interface TallyMetadata {
  referenceNo?: string;
  referenceDate?: string;
  buyersOrderNo?: string;
  buyersOrderDate?: string;
  otherReferences?: string;
  supplierInvoiceNo?: string;
  supplierInvoiceDate?: string;
  originalInvoiceNo?: string;
  originalInvoiceDate?: string;
  deliveryNoteNo?: string;
  deliveryNoteDate?: string;
  dispatchDocNo?: string;
  dispatchDocDate?: string;
  dispatchedThrough?: string;
  destination?: string;
  billOfLadingNo?: string;
  billOfLadingDate?: string;
  motorVehicleNo?: string;
  transportMode?: string;
  termsOfDelivery?: string;
  paymentTerms?: string;
  dueDate?: string;
  placeOfSupply?: string;
  ewayBillNo?: string;
  ewayBillDate?: string;
  ewayBillValidTill?: string;
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  // Stock family
  sourceGodown?: string;
  destinationGodown?: string;
  warehouse?: string;
  adjustmentReason?: string;
}

/** Presentation flags the backend derives per document type. */
export interface DocumentLayout {
  family: 'invoice' | 'voucher' | 'stock';
  title: string;
  /** Voucher family: which amount columns to print. */
  columns?: ('amount' | 'debit' | 'credit')[];
  showThrough?: boolean;
  showGstin?: boolean;
  partyRole?: 'buyer' | 'supplier';
  partyLabel?: string;
  showHsnSummary?: boolean;
  showDeclaration?: boolean;
  showReceivedInGoodCondition?: boolean;
  showJurisdiction?: boolean;
  computerGeneratedText?: string;
  showSignatory?: boolean;
}

export interface HsnSummaryRow {
  hsn: string;
  taxableAmount: number;
  taxPct?: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
}

export interface ChargeLine {
  description: string;
  amount: number;
  taxes?: { description: string; kind?: string; rate: number; amount: number }[];
}

export interface BankInfo {
  name: string;
  accountNo?: string;
  ifsc?: string;
  branch?: string;
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

  // ── Tally-layout extensions (populated by voucherDocumentAdapter) ───────────
  /** Presentation flags per document type, derived by the backend. */
  layout?: DocumentLayout;
  /** Full Tally header grid; `metadata` stays for the existing card UI. */
  tallyMeta?: TallyMetadata;
  hsnSummary?: HsnSummaryRow[];
  additionalCharges?: ChargeLine[];
  /** The Tally voucher type name, e.g. 'Credit Note', 'Purchase Order'. */
  tallyVoucherType?: string;
  tdkRef?: string;
  postingTag?: string;
  isProvisional?: boolean;
  watermarkText?: string | null;
}
