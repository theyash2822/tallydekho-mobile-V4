import { DocumentType, VoucherDocument } from '../types/document';
import { renderTallyHTML } from './pdf/tallyLayout';

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


// ── Bank details HTML block (shared across all PDF formats) ──────────────────
function _bankBlock(bankInfo?: PDFBankInfo | null, align: 'left' | 'right' = 'right'): string {
  if (!bankInfo) return '';
  const { bankName, accountNo, ifsc, upiId } = bankInfo;
  if (!bankName && !accountNo && !ifsc && !upiId) return '';
  const ta = align === 'right' ? 'text-align:right;' : '';
  let rows = '';
  if (bankName) rows += `<div style="font-size:9px;color:#444;${ta}"><b>Bank:</b> ${bankName}</div>`;
  if (accountNo) rows += `<div style="font-size:9px;color:#444;${ta}"><b>A/C:</b> ${accountNo}</div>`;
  if (ifsc) rows += `<div style="font-size:9px;color:#444;${ta}"><b>IFSC:</b> ${ifsc}</div>`;
  if (upiId) rows += `<div style="font-size:9px;color:#444;${ta}"><b>UPI:</b> ${upiId}</div>`;
  return `<div style="margin-bottom:6px;">${rows}</div>`;
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
  stock_journal:    { label: 'Stock Journal',     color: '#558B2F', bg: '#F1F8E9' },
};

// ── PDF HTML Template Generator ──────────────────────────────────────────────
export interface PDFBankInfo { bankName?: string | null; accountNo?: string | null; ifsc?: string | null; upiId?: string | null; }

/**
 * `tally` replicates the Tally Prime print layout and is the default.
 * `modern_a` / `modern_b` are the two house styles, selectable in Settings.
 */
export type DocumentFormat = 'tally' | 'modern_a' | 'modern_b';

/** Older saved configs stored the format as 1/2/3. */
const LEGACY_FORMAT_MAP: Record<number, DocumentFormat> = { 1: 'tally', 2: 'modern_a', 3: 'modern_b' };

export function resolveDocumentFormat(format?: DocumentFormat | number | null): DocumentFormat {
  if (typeof format === 'number') return LEGACY_FORMAT_MAP[format] ?? 'tally';
  return format === 'modern_a' || format === 'modern_b' ? format : 'tally';
}

export function generateDocumentHTML(doc: VoucherDocument, logoUri?: string | null, format: DocumentFormat | 1 | 2 | 3 = 'tally', terms?: string[], qrImage?: string | null, bankInfo?: PDFBankInfo | null): string {
  const resolved = resolveDocumentFormat(format);
  if (resolved === 'modern_a') return _generateFormat2HTML(doc, logoUri, terms, qrImage, bankInfo);
  if (resolved === 'modern_b') return _generateFormat3HTML(doc, logoUri, terms, qrImage, bankInfo);
  return renderTallyHTML(doc, { logoUri, terms, qrImage, bankInfo });
}

// ── Format 2 — Modern layout ─────────────────────────────────────────────────
function _generateFormat2HTML(doc: VoucherDocument, logoUri?: string | null, terms?: string[], qrImage?: string | null, bankInfo?: PDFBankInfo | null): string {
  const cfg = DOC_TYPE_CONFIG[doc.documentType] || DOC_TYPE_CONFIG.sales_invoice;
  const t = doc.totals;
  const hasItems = !!(doc.items && doc.items.length > 0);
  const hasEntries = !!(doc.ledgerEntries && doc.ledgerEntries.length > 0);
  const isVoucher = ['payment_voucher','receipt_voucher','contra_voucher','journal_voucher'].includes(doc.documentType);
  const isProforma = doc.documentType === 'proforma_invoice';
  const footerKind = isVoucher ? 'Voucher' : (isProforma ? 'Proforma Invoice' : 'Invoice');
  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const itemRows = hasItems ? doc.items!.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'}">
      <td style="padding:8px 10px;font-size:10px;color:#999;border-bottom:1px solid #f0f0f0">${i+1}</td>
      <td style="padding:8px 10px;font-size:10px;border-bottom:1px solid #f0f0f0"><b>${item.name}</b></td>
      <td style="padding:8px 10px;font-size:10px;text-align:center;border-bottom:1px solid #f0f0f0">${item.hsn||''}</td>
      <td style="padding:8px 10px;font-size:10px;text-align:right;border-bottom:1px solid #f0f0f0">${item.qty} ${item.unit}</td>
      <td style="padding:8px 10px;font-size:10px;text-align:right;border-bottom:1px solid #f0f0f0">${item.rate.toFixed(2)}</td>
      <td style="padding:8px 10px;font-size:10px;text-align:right;border-bottom:1px solid #f0f0f0">${item.discount ? item.discount.toFixed(2)+'%' : '—'}</td>
      <td style="padding:8px 10px;font-size:10px;text-align:right;font-weight:600;border-bottom:1px solid #f0f0f0">${item.amount.toFixed(2)}</td>
    </tr>`).join('') : `<tr><td colspan="7" style="padding:40px;text-align:center;color:#ccc;font-size:11px">No items</td></tr>`;

  const entryRows = hasEntries ? doc.ledgerEntries!.map((e, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'}">
      <td style="padding:8px 10px;font-size:10px;border-bottom:1px solid #f0f0f0"><b>${e.particulars}</b>${e.narration ? `<br><span style="color:#888;font-size:9px">${e.narration}</span>` : ''}</td>
      <td style="padding:8px 10px;font-size:10px;text-align:right;border-bottom:1px solid #f0f0f0;color:#c0392b;font-weight:${e.debit?600:400}">${e.debit ? fmt(e.debit) : '—'}</td>
      <td style="padding:8px 10px;font-size:10px;text-align:right;border-bottom:1px solid #f0f0f0;color:#2d7d46;font-weight:${e.credit?600:400}">${e.credit ? fmt(e.credit) : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="3" style="padding:40px;text-align:center;color:#ccc">No entries</td></tr>`;

  const mainTable = isVoucher ? `
  <table style="border-radius:8px;overflow:hidden;border:1px solid #e8e8e8;margin-bottom:16px;">
    <thead><tr style="background:#1A1A1A;color:#fff">
      <th style="padding:10px;text-align:left;font-size:10px;font-weight:600">Particulars</th>
      <th style="padding:10px;text-align:right;font-size:10px;font-weight:600;width:120px">Debit (Dr)</th>
      <th style="padding:10px;text-align:right;font-size:10px;font-weight:600;width:120px">Credit (Cr)</th>
    </tr></thead>
    <tbody>${entryRows}</tbody>
    <tfoot><tr style="background:#f8f9fa">
      <td style="padding:10px;text-align:right;font-size:11px;font-weight:bold;border-top:2px solid #e0e0e0">Total</td>
      <td style="padding:10px;text-align:right;font-size:13px;font-weight:bold;color:#c0392b;border-top:2px solid #e0e0e0">${t.drTotal ? fmt(t.drTotal) : fmt(t.total)}</td>
      <td style="padding:10px;text-align:right;font-size:13px;font-weight:bold;color:#2d7d46;border-top:2px solid #e0e0e0">${t.crTotal ? fmt(t.crTotal) : fmt(t.total)}</td>
    </tr></tfoot>
  </table>` : `
  <table style="border-radius:8px;overflow:hidden;border:1px solid #e8e8e8;margin-bottom:16px;">
    <thead><tr style="background:#1A1A1A;color:#fff">
      <th style="padding:10px;text-align:center;font-size:10px;width:28px">#</th>
      <th style="padding:10px;text-align:left;font-size:10px">Item Description</th>
      <th style="padding:10px;text-align:center;font-size:10px;width:55px">HSN</th>
      <th style="padding:10px;text-align:right;font-size:10px;width:70px">Qty</th>
      <th style="padding:10px;text-align:right;font-size:10px;width:70px">Rate</th>
      <th style="padding:10px;text-align:right;font-size:10px;width:50px">Disc.</th>
      <th style="padding:10px;text-align:right;font-size:10px;width:90px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot><tr style="background:#f8f9fa">
      <td colspan="6" style="padding:10px;text-align:right;font-size:11px;font-weight:bold;border-top:2px solid #e0e0e0">Subtotal</td>
      <td style="padding:10px;text-align:right;font-size:13px;font-weight:bold;border-top:2px solid #e0e0e0">₹ ${t.total.toFixed(2)}</td>
    </tr></tfoot>
  </table>`;

  const totalsRows: string[] = [];
  if (t.subtotal !== undefined) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">Subtotal</td><td style="padding:5px 0;font-size:10px;text-align:right">₹ ${t.subtotal.toFixed(2)}</td></tr>`);
  if (t.discount) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">Discount</td><td style="padding:5px 0;font-size:10px;text-align:right;color:#c0392b">- ₹ ${t.discount.toFixed(2)}</td></tr>`);
  if (t.cgstTotal) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">CGST</td><td style="padding:5px 0;font-size:10px;text-align:right">₹ ${t.cgstTotal.toFixed(2)}</td></tr>`);
  if (t.sgstTotal) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">SGST</td><td style="padding:5px 0;font-size:10px;text-align:right">₹ ${t.sgstTotal.toFixed(2)}</td></tr>`);
  if (t.igstTotal) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">IGST</td><td style="padding:5px 0;font-size:10px;text-align:right">₹ ${t.igstTotal.toFixed(2)}</td></tr>`);
  if (t.taxTotal) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">Total Tax</td><td style="padding:5px 0;font-size:10px;text-align:right">₹ ${t.taxTotal.toFixed(2)}</td></tr>`);
  if (t.roundOff !== undefined && t.roundOff !== 0) totalsRows.push(`<tr><td style="padding:5px 0;font-size:10px;color:#666">Round Off</td><td style="padding:5px 0;font-size:10px;text-align:right">${t.roundOff > 0 ? '+' : '-'} ₹ ${Math.abs(t.roundOff).toFixed(2)}</td></tr>`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:12mm 14mm;}
  table{width:100%;border-collapse:collapse;}
</style>
</head><body>

<!-- DARK HEADER -->
<div style="background:#1A1A1A;color:#fff;padding:20px 24px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div style="flex:1;">
      ${logoUri
        ? `<img src="${logoUri}" style="max-height:56px;max-width:120px;object-fit:contain;display:block;margin-bottom:8px;" />`
        : `<div style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:6px;background:rgba(255,255,255,0.15);font-size:16px;font-weight:800;color:#fff;margin-bottom:8px">${(doc.company?.name||'CO').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()}</div>`
      }
      <div style="font-size:17px;font-weight:bold;line-height:1.2;">${doc.company?.name || ''}</div>
      <div style="font-size:9px;color:#aaa;margin-top:4px;line-height:1.5;">${doc.company?.address || ''}</div>
      ${doc.company?.gstin ? `<div style="font-size:9px;color:#ccc;margin-top:3px;">GSTIN: ${doc.company.gstin}</div>` : ''}
    </div>
    <div style="text-align:right;margin-left:20px;flex-shrink:0;">
      <div style="font-size:10px;font-weight:bold;color:#4CAF50;letter-spacing:1px;text-transform:uppercase;">${cfg.label}</div>
      <div style="font-size:18px;font-weight:bold;margin-top:4px;">${doc.documentNumber}</div>
      <div style="font-size:10px;color:#aaa;margin-top:4px;">${doc.date}</div>
    </div>
  </div>
</div>

<!-- BODY -->
<div style="padding:20px 0;background:#fff;">

  <!-- Two-column meta -->
  <div style="display:flex;gap:14px;margin-bottom:20px;">
    <div style="flex:1;background:#f8f9fa;border-radius:6px;padding:14px;border:1px solid #e8e8e8;">
      <div style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e0e0e0;">Document Info</div>
      <div style="margin-bottom:7px;"><div style="font-size:9px;color:#999;">Number</div><div style="font-size:11px;font-weight:700;">${doc.documentNumber}</div></div>
      <div style="margin-bottom:7px;"><div style="font-size:9px;color:#999;">Date</div><div style="font-size:11px;font-weight:700;">${doc.date}</div></div>
      ${doc.reference ? `<div style="margin-bottom:7px;"><div style="font-size:9px;color:#999;">Reference</div><div style="font-size:11px;">${doc.reference}</div></div>` : ''}
    </div>
    <div style="flex:1;background:#f8f9fa;border-radius:6px;padding:14px;border:1px solid #e8e8e8;">
      <div style="font-size:9px;font-weight:bold;color:#888;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e0e0e0;">Bill To</div>
      <div style="font-size:13px;font-weight:bold;margin-bottom:5px;color:#111;">${doc.party?.name || '—'}</div>
      ${doc.party?.address ? `<div style="font-size:9px;color:#555;line-height:1.6;margin-bottom:4px;">${doc.party.address}</div>` : ''}
      ${doc.party?.gstin ? `<div style="font-size:9px;color:#888;margin-top:4px;">GSTIN: <b style="color:#333;">${doc.party.gstin}</b></div>` : ''}
      ${doc.party?.phone ? `<div style="font-size:9px;color:#888;margin-top:3px;">Phone: ${doc.party.phone}</div>` : ''}
    </div>
  </div>

  <!-- Main table -->
  ${mainTable}

  <!-- Totals bottom-right -->
  <div style="display:flex;justify-content:flex-end;">
    <div style="width:300px;">
      ${totalsRows.length > 0 ? `<table style="width:100%;margin-bottom:8px;">${totalsRows.join('')}</table><hr style="border:none;border-top:1px solid #e0e0e0;margin:8px 0;"/>` : ''}
      <div style="border-top:3px solid #4CAF50;padding-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:bold;">Grand Total</span>
          <span style="font-size:15px;font-weight:bold;color:#4CAF50;">₹ ${t.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Amount in words -->
  <div style="margin-top:14px;padding:10px 14px;background:#f0f7f0;border-radius:6px;border-left:3px solid #4CAF50;">
    <div style="font-size:9px;color:#666;margin-bottom:2px;font-weight:bold;">AMOUNT IN WORDS</div>
    <div style="font-size:11px;font-weight:bold;font-style:italic;color:#222;">Indian Rupees ${amountInWords(t.total)}</div>
  </div>

  <!-- Terms & Conditions -->
  ${terms && terms.length > 0 ? `
  <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e8e8e8;">
    <div style="font-size:9px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Terms &amp; Conditions</div>
    <ol style="font-size:9px;color:#555;padding-left:16px;margin:0;line-height:1.7;">
      ${terms.map(term => `<li>${term}</li>`).join('')}
    </ol>
  </div>` : ''}

  <!-- Footer -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;padding-top:16px;border-top:1px solid #e8e8e8;">
    <div style="font-size:9px;color:#aaa;line-height:1.5;">
      This is a Computer Generated ${footerKind}
      ${doc.company?.gstin ? `<br/>PAN: ${doc.company.gstin.slice(2,12)}` : ''}
    </div>
    <div style="text-align:center;min-width:150px;">
      ${qrImage ? `<img src="${qrImage}" style="width:60px;height:60px;object-fit:contain;margin-bottom:4px;display:block;margin-left:auto;margin-right:auto" />` : '<div style="height:40px;"></div>'}
      ${_bankBlock(bankInfo, 'right')}
      <div style="border-top:1px solid #333;padding-top:6px;">
        <div style="font-size:10px;font-weight:bold;">for ${doc.company?.name || ''}</div>
        <div style="font-size:9px;color:#666;margin-top:2px;">Authorised Signatory</div>
      </div>
    </div>
  </div>

</div>
</body></html>`;
}

// ── Format 3 — Detailed layout ────────────────────────────────────────────────
function _generateFormat3HTML(doc: VoucherDocument, logoUri?: string | null, terms?: string[], qrImage?: string | null, bankInfo?: PDFBankInfo | null): string {
  const cfg = DOC_TYPE_CONFIG[doc.documentType] || DOC_TYPE_CONFIG.sales_invoice;
  const t = doc.totals;
  const hasItems = !!(doc.items && doc.items.length > 0);
  const hasEntries = !!(doc.ledgerEntries && doc.ledgerEntries.length > 0);
  const isVoucher = ['payment_voucher','receipt_voucher','contra_voucher','journal_voucher'].includes(doc.documentType);
  const isOrder = ['sales_order','purchase_order'].includes(doc.documentType);
  const isProforma = doc.documentType === 'proforma_invoice';
  const numberLabel = isProforma ? 'Proforma No.' : 'Invoice No.';
  const footerKind = isVoucher ? 'Voucher' : (isProforma ? 'Proforma Invoice' : 'Invoice');
  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cell = (label: string, value: string) =>
    `<td style="border:1px solid #ddd;padding:5px 8px;vertical-align:top;font-size:10px;width:50%"><span style="color:#888;font-size:8px;display:block;text-transform:uppercase;">${label}</span><b>${value || ''}</b></td>`;

  const itemRows = hasItems ? doc.items!.map((item, i) => `
    <tr>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:center;font-size:10px">${i+1}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;font-size:10px"><b>${item.name}</b></td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:center;font-size:10px">${item.hsn||''}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:right;font-size:10px">${item.qty} ${item.unit}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:right;font-size:10px">${item.rate.toFixed(2)}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:center;font-size:10px">${item.unit}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:right;font-size:10px">${item.discount ? item.discount.toFixed(2)+'%' : ''}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:right;font-size:10px;font-weight:600">${item.amount.toFixed(2)}</td>
    </tr>`).join('') : `<tr><td colspan="8" style="border:1px solid #ddd;padding:50px;text-align:center;color:#ccc"></td></tr>`;

  const entryRows = hasEntries ? doc.ledgerEntries!.map((e, i) => `
    <tr>
      <td style="border:1px solid #ddd;padding:5px 6px;font-size:10px"><b>${e.particulars}</b>${e.narration ? `<br><span style="color:#888;font-size:9px">${e.narration}</span>` : ''}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:right;font-size:10px;color:#c0392b;font-weight:${e.debit?600:400}">${e.debit ? fmt(e.debit) : '—'}</td>
      <td style="border:1px solid #ddd;padding:5px 6px;text-align:right;font-size:10px;color:#2d7d46;font-weight:${e.credit?600:400}">${e.credit ? fmt(e.credit) : '—'}</td>
    </tr>`).join('') : `<tr><td colspan="3" style="border:1px solid #ddd;padding:50px;text-align:center;color:#ccc"></td></tr>`;

  const metaRows = isVoucher ? `
    <tr>${cell('Voucher No.', doc.documentNumber)}${cell('Date', doc.date)}</tr>
    <tr>${cell('Mode of Payment', '')}${cell('Reference', doc.reference || '')}</tr>` :
  isOrder ? `
    <tr>${cell('Order No.', doc.documentNumber)}${cell('Dated', doc.date)}</tr>
    <tr>${cell('Reference No.', doc.reference || '')}${cell('Other References', '')}</tr>
    <tr>${cell("Buyer's Order No.", '')}${cell('Dated', '')}</tr>
    <tr>${cell('Terms of Delivery', '')}${cell('', '')}</tr>` : `
    <tr>${cell(numberLabel, doc.documentNumber)}${cell('Dated', doc.date)}</tr>
    <tr>${cell('Delivery Note', '')}${cell('Mode/Terms of Payment', '')}</tr>
    <tr>${cell('Reference No. & Date.', doc.reference || '')}${cell('Other References', '')}</tr>
    <tr>${cell("Buyer's Order No.", '')}${cell('Dated', '')}</tr>
    <tr>${cell('Dispatch Doc No.', '')}${cell('Delivery Note Date', '')}</tr>
    <tr>${cell('Dispatched through', '')}${cell('Destination', '')}</tr>
    <tr>${cell('Terms of Delivery', '')}${cell('', '')}</tr>`;

  const totalQty = hasItems ? doc.items!.reduce((s, i) => s + i.qty, 0) : 0;
  const unit0 = hasItems && doc.items![0] ? doc.items![0].unit : '';

  const mainTable = isVoucher ? `
  <table style="border-collapse:collapse;width:100%;">
    <thead><tr style="background:#f5f5f5">
      <th style="border:1px solid #ddd;padding:7px;text-align:left;font-size:10px">Particulars</th>
      <th style="border:1px solid #ddd;padding:7px;text-align:right;font-size:10px;width:120px">Debit (Dr)</th>
      <th style="border:1px solid #ddd;padding:7px;text-align:right;font-size:10px;width:120px">Credit (Cr)</th>
    </tr></thead>
    <tbody>${entryRows}</tbody>
    <tfoot><tr>
      <td style="border:1px solid #ddd;padding:7px;text-align:right;font-size:11px;font-weight:bold">Total</td>
      <td style="border:1px solid #ddd;padding:7px;text-align:right;font-size:13px;font-weight:bold;color:#c0392b">${t.drTotal ? fmt(t.drTotal) : fmt(t.total)}</td>
      <td style="border:1px solid #ddd;padding:7px;text-align:right;font-size:13px;font-weight:bold;color:#2d7d46">${t.crTotal ? fmt(t.crTotal) : fmt(t.total)}</td>
    </tr></tfoot>
  </table>` : `
  <table style="border-collapse:collapse;width:100%;">
    <thead><tr style="background:#f5f5f5">
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:28px">Sl</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:left;font-size:10px">Description of Goods</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:55px">HSN/SAC</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:65px">Quantity</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:60px">Rate</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:30px">per</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:45px">Disc.%</th>
      <th style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px;width:85px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="border:1px solid #ddd;padding:6px;text-align:right;font-size:10px;font-weight:bold">Total</td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right;font-size:10px;font-weight:bold">${hasItems ? totalQty + ' ' + unit0 : ''}</td>
        <td style="border:1px solid #ddd;padding:6px"></td>
        <td style="border:1px solid #ddd;padding:6px"></td>
        <td style="border:1px solid #ddd;padding:6px"></td>
        <td style="border:1px solid #ddd;padding:6px;text-align:right;font-size:13px;font-weight:bold">₹ ${t.total.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>`;

  const termsSection = terms && terms.length > 0 ? `
  <div style="margin-top:16px">
    <div style="font-weight:700;font-size:10px;margin-bottom:4px">Terms &amp; Conditions:</div>
    <ol style="font-size:9px;color:#444;padding-left:16px;margin:0">
      ${terms.map(term => `<li>${term}</li>`).join('')}
    </ol>
  </div>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:11px;color:#000;background:#fff;padding:12mm 14mm;}
  .page{width:100%;border:2px solid #333;}
  table{width:100%;border-collapse:collapse;}
</style>
</head><body>
<div class="page">

<!-- SPLIT HEADER: Company LEFT | Party RIGHT -->
<table>
  <tr>
    <td style="width:50%;border:1px solid #ccc;padding:10px 12px;vertical-align:top;border-right:2px solid #333;">
      ${logoUri
        ? `<img src="${logoUri}" style="max-height:60px;max-width:130px;object-fit:contain;display:block;margin-bottom:8px;" />`
        : `<div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:8px;background:#F0F0F0;font-size:16px;font-weight:800;color:#555;margin-bottom:8px">${(doc.company?.name||'CO').replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase()}</div>`
      }
      <div style="font-size:15px;font-weight:bold;margin-bottom:3px;">${doc.company?.name || ''}</div>
      <div style="font-size:9px;color:#444;line-height:1.5;margin-bottom:4px;">${(doc.company?.address || '').replace(/,/g, ', ')}</div>
      ${doc.company?.gstin ? `<div style="font-size:9px;margin-top:3px;"><b>GSTIN/UIN:</b> ${doc.company.gstin}</div>` : ''}
      ${(doc.company as any)?.state ? `<div style="font-size:9px;color:#444;">State: <b>${(doc.company as any).state}</b></div>` : ''}
      ${doc.company?.email ? `<div style="font-size:9px;color:#444;">Email: ${doc.company.email}</div>` : ''}
      ${doc.company?.phone ? `<div style="font-size:9px;color:#444;">Phone: ${doc.company.phone}</div>` : ''}
    </td>
    <td style="width:50%;border:1px solid #ccc;padding:10px 12px;vertical-align:top;">
      <div style="text-align:center;margin-bottom:10px;">
        <span style="font-size:14px;font-weight:bold;border:2px solid ${cfg.color};color:${cfg.color};padding:3px 14px;display:inline-block;border-radius:2px;">${cfg.label}</span>
      </div>
      <div style="font-size:9px;font-weight:bold;color:#888;margin-bottom:3px;text-transform:uppercase;">Bill To / Party</div>
      <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">${doc.party?.name || '—'}</div>
      ${doc.party?.address ? `<div style="font-size:9px;color:#444;line-height:1.5;margin-bottom:3px;">${doc.party.address}</div>` : ''}
      ${doc.party?.gstin ? `<div style="font-size:9px;"><b>GSTIN:</b> ${doc.party.gstin}</div>` : ''}
      ${doc.party?.phone ? `<div style="font-size:9px;color:#444;">Phone: ${doc.party.phone}</div>` : ''}
    </td>
  </tr>
</table>

<!-- FULL META DETAILS GRID -->
<table><tbody>${metaRows}</tbody></table>

<!-- MAIN TABLE (items/entries) -->
${mainTable}

<!-- BOTTOM SECTION: Amount + Terms + Signature -->
<table>
  <tr>
    <td style="width:60%;border:1px solid #ccc;padding:8px 10px;vertical-align:top;">
      <div style="font-size:9px;color:#777;text-transform:uppercase;margin-bottom:3px;">Amount Chargeable (in words)</div>
      <div style="font-size:11px;font-weight:bold;">Indian Rupees ${amountInWords(t.total)}</div>
      ${termsSection}
      <div style="margin-top:14px;">
        <div style="font-size:9px;color:#777;text-transform:uppercase;margin-bottom:2px;">Declaration</div>
        <div style="font-size:9px;color:#444;line-height:1.5;">We declare that this ${isVoucher ? 'voucher' : 'invoice'} shows the actual ${isVoucher ? 'transaction' : 'price of the goods described'} and that all particulars are true and correct.</div>
      </div>
    </td>
    <td style="width:40%;border:1px solid #ccc;padding:8px 10px;vertical-align:top;">
      ${t.subtotal !== undefined ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;"><span>Subtotal</span><span>${fmt(t.subtotal)}</span></div>` : ''}
      ${t.discount ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;color:#c0392b;"><span>Discount</span><span>- ${fmt(t.discount)}</span></div>` : ''}
      ${t.cgstTotal ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;"><span>CGST</span><span>${fmt(t.cgstTotal)}</span></div>` : ''}
      ${t.sgstTotal ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;"><span>SGST</span><span>${fmt(t.sgstTotal)}</span></div>` : ''}
      ${t.igstTotal ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;"><span>IGST</span><span>${fmt(t.igstTotal)}</span></div>` : ''}
      ${t.taxTotal ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;font-weight:bold;"><span>Total Tax</span><span>${fmt(t.taxTotal)}</span></div>` : ''}
      ${t.roundOff !== undefined && t.roundOff !== 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px solid #eee;"><span>Round Off</span><span>${t.roundOff > 0 ? '+' : '-'} ${fmt(Math.abs(t.roundOff))}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:bold;padding:6px 0;border-top:2px solid #333;margin-top:4px;">
        <span>Grand Total</span><span>₹ ${t.total.toFixed(2)}</span>
      </div>
      <div style="margin-top:24px;text-align:center;">
        <div style="font-size:10px;font-style:italic;color:#777;margin-bottom:8px;">for ${doc.company?.name || ''}</div>
        ${qrImage ? `<img src="${qrImage}" style="width:60px;height:60px;object-fit:contain;margin:0 auto 8px auto;display:block" />` : '<div style="width:60px;height:60px;border-radius:50%;border:1px dashed #aaa;margin:0 auto 8px auto;"></div>'}
        ${_bankBlock(bankInfo, 'right')}
        <div style="border-top:1px solid #333;padding-top:5px;font-size:10px;font-weight:bold;">Authorised Signatory</div>
      </div>
    </td>
  </tr>
</table>

<div style="text-align:center;font-size:9px;color:#666;padding:5px;border-top:1px solid #ccc;">This is a Computer Generated ${footerKind}</div>
</div>
</body></html>`;
}

// ── Map transaction type strings to DocumentType ──────────────────────────────
export const TX_TO_DOC_TYPE: Record<string, DocumentType> = {
  // Standard types
  'Sales Invoice':    'sales_invoice',
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
  // Tally-specific voucher type names
  'Sales GST':         'sales_invoice',
  'Sales':             'sales_invoice',
  'Purchase GST':      'purchase_invoice',
  'Purchase':          'purchase_invoice',
  'Debit Note GST':    'debit_note',
  'Credit Note GST':   'credit_note',
  'Sales Order GST':   'sales_order',
};
