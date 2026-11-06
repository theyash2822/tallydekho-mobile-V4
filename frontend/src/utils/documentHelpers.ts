import { DocumentType, VoucherDocument } from '../types/document';
import { renderTallyHTML } from './pdf/tallyLayout';
import { renderAccountingVoucherHtml, isAccountingVoucherType } from './voucher-print';
import { renderCommercialDocumentHtml, isCommercialDocumentType } from './commercial-print';

import { amountInWords, tallyWords } from './pdf/words';

export { amountInWords, tallyWords };
export { renderTallyStatementHTML } from './pdf/tallyLayout';
export type { StatementInput, StatementRow } from './pdf/tallyLayout';

// ── Currency formatter ────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return '\u20b9' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


// ── Document type config (label + brand color) ────────────────────────────────
export const DOC_TYPE_CONFIG: Record<DocumentType, { label: string; color: string; bg: string }> = {
  sales_invoice:    { label: 'Tax Invoice',       color: '#2D7D46', bg: '#E8F5E9' },
  proforma_invoice: { label: 'Proforma Invoice',  color: '#1A1A1A', bg: '#F5F4EF' },
  sales_order:      { label: 'Sales Order',       color: '#1565C0', bg: '#E3F2FD' },
  delivery_note:    { label: 'Delivery Note',     color: '#00838F', bg: '#E0F7FA' },
  credit_note:      { label: 'Credit Note',       color: '#EF6C00', bg: '#FFF3E0' },
  debit_note:       { label: 'Debit Note',        color: '#C62828', bg: '#FFEBEE' },
  purchase_invoice: { label: 'Purchase Invoice',  color: '#4527A0', bg: '#EDE7F6' },
  purchase_order:   { label: 'Purchase Order',    color: '#1B5E20', bg: '#E8F5E9' },
  receipt_note:     { label: 'Receipt Note',      color: '#004D40', bg: '#E0F2F1' },
  quotation:        { label: 'Quotation',         color: '#1565C0', bg: '#E3F2FD' },
  payment_voucher:  { label: 'Payment Voucher',   color: '#E65100', bg: '#FFF3E0' },
  receipt_voucher:  { label: 'Receipt Voucher',   color: '#2D7D46', bg: '#E8F5E9' },
  contra_voucher:   { label: 'Contra Voucher',    color: '#37474F', bg: '#ECEFF1' },
  journal_voucher:  { label: 'Journal Voucher',   color: '#4E342E', bg: '#EFEBE9' },
  expense_voucher:  { label: 'Expense Voucher',   color: '#B71C1C', bg: '#FFEBEE' },
  stock_journal:    { label: 'Stock Journal',     color: '#558B2F', bg: '#F1F8E9' },
};

// ── PDF HTML Template Generator ──────────────────────────────────────────────
export interface PDFBankInfo { bankName?: string | null; accountNo?: string | null; ifsc?: string | null; upiId?: string | null; }

/**
 * Legacy format keys (still accepted). Prefer VoucherTemplateId from
 * `voucher-print/templateIds` for accounting vouchers.
 * `tally` / `modern_a` / `modern_b` map → Classic / Thermal / Executive.
 * Former Ledger (`td_ledger_v1` / `modern_a`) normalizes to Thermal.
 */
export type DocumentFormat =
  | 'tally' | 'modern_a' | 'modern_b'
  | 'tally_classic_v1' | 'td_thermal_v1' | 'td_executive_v1'
  | 'td_ledger_v1'; // legacy — resolveDocumentFormat maps to td_thermal_v1

/** Older saved configs stored the format as 1/2/3. */
const LEGACY_FORMAT_MAP: Record<number, DocumentFormat> = {
  1: 'tally_classic_v1',
  2: 'td_thermal_v1',
  3: 'td_executive_v1',
};

export function resolveDocumentFormat(format?: DocumentFormat | number | null): DocumentFormat {
  if (typeof format === 'number') return LEGACY_FORMAT_MAP[format] ?? 'tally_classic_v1';
  if (format === 'modern_a' || format === 'td_ledger_v1' || format === 'td_thermal_v1') {
    return 'td_thermal_v1';
  }
  if (format === 'modern_b' || format === 'td_executive_v1') return 'td_executive_v1';
  if (format === 'tally' || format === 'tally_classic_v1') return 'tally_classic_v1';
  return 'tally_classic_v1';
}

export function generateDocumentHTML(
  doc: VoucherDocument,
  logoUri?: string | null,
  format: DocumentFormat | 1 | 2 | 3 = 'tally',
  terms?: string[],
  qrImage?: string | null,
  bankInfo?: PDFBankInfo | null,
  opts?: { thermalPaperWidth?: 80 | 58 }
): string {
  const resolved = resolveDocumentFormat(format);
  const paperWidth = opts?.thermalPaperWidth;

  // Accounting vouchers use the Spec 3-template engine.
  if (isAccountingVoucherType(doc.documentType)) {
    return renderAccountingVoucherHtml(doc, { templateId: resolved, paperWidth });
  }

  // Commercial docs use Spec commercial templates (Settings format maps 1:1).
  if (isCommercialDocumentType(doc.documentType)) {
    return renderCommercialDocumentHtml(doc, {
      templateId: resolved,
      logoUri,
      terms,
      qrImage,
      bankInfo,
      paperWidth,
    });
  }

  // Everything else (today: `stock_journal`) renders through the Tally replica,
  // which HTML-escapes every Tally-sourced string. The former Format 2/3 templates
  // interpolated names/addresses/GSTINs unescaped and were deleted (SEC-029).
  return renderTallyHTML(doc, { logoUri, terms, qrImage, bankInfo });
}

// ── Map transaction type strings to DocumentType ──────────────────────────────
export const TX_TO_DOC_TYPE: Record<string, DocumentType> = {
  // Standard display labels
  'Sales Invoice':    'sales_invoice',
  'Tax Invoice':      'sales_invoice',
  'Proforma Invoice': 'proforma_invoice',
  'Sales Order':      'sales_order',
  'Delivery Note':    'delivery_note',
  'Credit Note':      'credit_note',
  'Debit Note':       'debit_note',
  'Purchase Invoice': 'purchase_invoice',
  'Purchase Order':   'purchase_order',
  'Receipt Note':     'receipt_note',
  'Quotation':        'quotation',
  'Payment':          'payment_voucher',
  'Payment Voucher':  'payment_voucher',
  'Receipt':          'receipt_voucher',
  'Receipt Voucher':  'receipt_voucher',
  'Contra':           'contra_voucher',
  'Journal':          'journal_voucher',
  'Journal Voucher':  'journal_voucher',
  'Expense':          'expense_voucher',
  'Expense Voucher':  'expense_voucher',
  // Snake_case DocumentType ids (Sales/Purchase registers, KPI deep-links)
  'sales_invoice':    'sales_invoice',
  'proforma_invoice': 'proforma_invoice',
  'proforma':         'proforma_invoice',
  'sales_order':      'sales_order',
  'delivery_note':    'delivery_note',
  'credit_note':      'credit_note',
  'debit_note':       'debit_note',
  'purchase_invoice': 'purchase_invoice',
  'purchase_order':   'purchase_order',
  'receipt_note':     'receipt_note',
  'quotation':        'quotation',
  // Short / route query aliases (KPI, expenses list, ledger deep-links)
  'payment':          'payment_voucher',
  'payment_voucher':  'payment_voucher',
  'receipt':          'receipt_voucher',
  'receipt_voucher':  'receipt_voucher',
  'contra':           'contra_voucher',
  'contra_voucher':   'contra_voucher',
  'journal':          'journal_voucher',
  'journal_voucher':  'journal_voucher',
  'expense':          'expense_voucher',
  'expense_voucher':  'expense_voucher',
  // Tally-specific voucher type names
  'Sales GST':         'sales_invoice',
  'Sales':             'sales_invoice',
  'Purchase GST':      'purchase_invoice',
  'Purchase':          'purchase_invoice',
  'Debit Note GST':    'debit_note',
  'Credit Note GST':   'credit_note',
  'Sales Order GST':   'sales_order',
  'Purchase Order GST':'purchase_order',
};

/** Resolve DocumentType from a route `?type=` param or Tally voucher_type string. */
export function resolveDocTypeFromParam(type?: string | null): DocumentType | undefined {
  if (!type) return undefined;
  const exact = TX_TO_DOC_TYPE[type] as DocumentType | undefined;
  if (exact) return exact;
  const lower = String(type).toLowerCase().replace(/-/g, '_').trim();
  const aliased = TX_TO_DOC_TYPE[lower] as DocumentType | undefined;
  if (aliased) return aliased;
  return undefined;
}
