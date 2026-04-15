import { DocumentType } from '../types/document';

// ── Currency formatter ────────────────────────────────────────────────────────
export function formatCurrency(amount: number): string {
  return '\u20b9' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Amount in words (Indian system) ──────────────────────────────────────────
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
}

function chunk(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigit(n);
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigit(n % 100) : '');
}

export function amountInWords(amount: number): string {
  if (!amount) return 'Zero Rupees Only';
  const n = Math.floor(Math.abs(amount));
  const paisa = Math.round((Math.abs(amount) - n) * 100);
  const parts: string[] = [];
  let rem = n;

  if (rem >= 10000000) { parts.push(chunk(Math.floor(rem / 10000000)) + ' Crore'); rem %= 10000000; }
  if (rem >= 100000)   { parts.push(chunk(Math.floor(rem / 100000)) + ' Lakh');  rem %= 100000;   }
  if (rem >= 1000)     { parts.push(chunk(Math.floor(rem / 1000)) + ' Thousand'); rem %= 1000;    }
  if (rem > 0)         { parts.push(chunk(rem)); }

  let result = parts.join(' ') + ' Rupees';
  if (paisa > 0) result += ' and ' + twoDigit(paisa) + ' Paise';
  return result + ' Only';
}

// ── Document type config (label + brand color) ────────────────────────────────
export const DOC_TYPE_CONFIG: Record<DocumentType, { label: string; color: string; bg: string }> = {
  sales_invoice:    { label: 'Tax Invoice',       color: '#2D7D46', bg: '#E8F5E9' },
  sales_order:      { label: 'Sales Order',       color: '#1565C0', bg: '#E3F2FD' },
  quotation:        { label: 'Quotation',         color: '#6A1B9A', bg: '#F3E5F5' },
  delivery_note:    { label: 'Delivery Note',     color: '#00838F', bg: '#E0F7FA' },
  credit_note:      { label: 'Credit Note',       color: '#EF6C00', bg: '#FFF3E0' },
  debit_note:       { label: 'Debit Note',        color: '#C62828', bg: '#FFEBEE' },
  purchase_invoice: { label: 'Purchase Invoice',  color: '#4527A0', bg: '#EDE7F6' },
  purchase_order:   { label: 'Purchase Order',    color: '#1B5E20', bg: '#E8F5E9' },
  receipt_note:     { label: 'Receipt Note',      color: '#004D40', bg: '#E0F2F1' },
  payment_voucher:  { label: 'Payment Voucher',   color: '#E65100', bg: '#FFF3E0' },
  receipt_voucher:  { label: 'Receipt Voucher',   color: '#2D7D46', bg: '#E8F5E9' },
  contra_voucher:   { label: 'Contra Voucher',    color: '#37474F', bg: '#ECEFF1' },
  journal_voucher:  { label: 'Journal Voucher',   color: '#4E342E', bg: '#EFEBE9' },
  stock_journal:    { label: 'Stock Journal',     color: '#558B2F', bg: '#F1F8E9' },
};

// ── Map transaction type strings to DocumentType ──────────────────────────────
export const TX_TO_DOC_TYPE: Record<string, DocumentType> = {
  'Sales Invoice':    'sales_invoice',
  'Sales Order':      'sales_order',
  'Quotation':        'quotation',
  'Delivery Note':    'delivery_note',
  'Credit Note':      'credit_note',
  'Debit Note':       'debit_note',
  'Purchase Invoice': 'purchase_invoice',
  'Purchase Order':   'purchase_order',
  'Receipt Note':     'receipt_note',
  'Payment':          'payment_voucher',
  'Payment Voucher':  'payment_voucher',
  'Receipt':          'receipt_voucher',
  'Receipt Voucher':  'receipt_voucher',
  'Contra':           'contra_voucher',
  'Journal':          'journal_voucher',
};
