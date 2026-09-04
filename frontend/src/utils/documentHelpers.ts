import { DocumentType, VoucherDocument } from '../types/document';

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
  proforma_invoice: { label: 'Proforma Invoice',  color: '#6A1B9A', bg: '#F3E5F5' },
  expense_voucher:  { label: 'Expense Voucher',   color: '#B71C1C', bg: '#FFEBEE' },
};

// ── PDF HTML Template Generator ──────────────────────────────────────────────
export function generateDocumentHTML(doc: VoucherDocument): string {
  const cfg = DOC_TYPE_CONFIG[doc.documentType];
  const hasItems = !!(doc.items && doc.items.length > 0);
  const hasEntries = !!(doc.ledgerEntries && doc.ledgerEntries.length > 0);
  const t = doc.totals;

  const itemRows = hasItems ? doc.items!.map((item, i) => `
    <tr style="background:${i%2===0?'#fff':'#f9f9f7'}">
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;color:#888;font-size:12px">${i+1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;font-size:12px"><strong>${item.name}</strong>${item.description?`<br><span style="color:#999;font-size:11px">${item.description}</span>`:''}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;font-size:12px">${item.hsn||'—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:12px">${item.qty} ${item.unit}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:12px">${formatCurrency(item.rate)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:12px">${item.taxPct?`${item.taxPct}%`:'—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-weight:600;font-size:12px">${formatCurrency(item.amount)}</td>
    </tr>`).join('') : '';

  const entryRows = hasEntries ? doc.ledgerEntries!.map((e, i) => `
    <tr style="background:${i%2===0?'#fff':'#f9f9f7'}">
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;font-size:12px"><strong>${e.particulars}</strong>${e.narration?`<br><span style="color:#999;font-size:11px">${e.narration}</span>`:''}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:12px;color:#c0392b;font-weight:${e.debit?600:400}">${e.debit?formatCurrency(e.debit):'—'}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:12px;color:#2d7d46;font-weight:${e.credit?600:400}">${e.credit?formatCurrency(e.credit):'—'}</td>
    </tr>`).join('') : '';

  const taxRows = (doc.taxes||[]).map((tax, i) => `
    <tr style="background:${i%2===0?'#fff':'#f9f9f7'}">
      <td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;font-size:11px">${tax.description}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;text-align:center;font-size:11px">${tax.rate}%</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:11px">${formatCurrency(tax.taxableAmount)}</td>
      ${tax.cgst!==undefined?`<td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:11px">${tax.cgst?formatCurrency(tax.cgst):'—'}</td><td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:11px">${tax.sgst?formatCurrency(tax.sgst):'—'}</td>`:''}
      ${tax.igst!==undefined?`<td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:11px">${tax.igst?formatCurrency(tax.igst):'—'}</td>`:''}
      <td style="padding:7px 10px;border-bottom:1px solid #e9e8e3;text-align:right;font-size:11px;font-weight:600">${formatCurrency(tax.total)}</td>
    </tr>`).join('');

  const hasCGST = (doc.taxes||[]).some(tx => tx.cgst !== undefined);
  const hasIGST = (doc.taxes||[]).some(tx => tx.igst !== undefined);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size:13px; color:#1a1a1a; background:#fff; padding:32px; }
    .page { max-width:800px; margin:0 auto; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:10px; font-weight:800; letter-spacing:1.2px; background:${cfg.bg}; color:${cfg.color}; margin-bottom:12px; }
    .company-name { font-size:22px; font-weight:800; margin-bottom:4px; }
    .company-addr { font-size:12px; color:#666; margin-bottom:8px; }
    .chip { display:inline-block; padding:3px 10px; border:1px solid #e0e0e0; border-radius:6px; font-size:10px; font-weight:700; margin-right:6px; margin-bottom:6px; }
    .chip span { color:#999; margin-right:3px; }
    .contact { font-size:11px; color:#888; margin-top:4px; }
    .hr { border:none; border-top:1px solid #e9e8e3; margin:16px 0; }
    .doc-meta { display:flex; justify-content:space-between; align-items:flex-start; }
    .meta-label { font-size:10px; font-weight:700; color:#999; letter-spacing:0.8px; margin-bottom:3px; }
    .doc-number { font-size:16px; font-weight:800; }
    .doc-date { font-size:13px; font-weight:700; text-align:right; }
    .section { margin-top:20px; }
    .section-title { font-size:10px; font-weight:800; color:#999; letter-spacing:1.2px; text-transform:uppercase; margin-bottom:12px; padding-left:10px; border-left:3px solid #1a1a1a; }
    .party-grid { display:flex; gap:24px; }
    .party-col { flex:1; }
    .party-col-label { font-size:10px; font-weight:800; color:#999; letter-spacing:1px; margin-bottom:6px; }
    .party-name { font-size:13px; font-weight:700; margin-bottom:3px; }
    .party-addr { font-size:11px; color:#666; line-height:1.5; }
    .party-gstin { font-size:11px; color:#666; margin-top:4px; font-weight:600; }
    .meta-grid { display:flex; flex-wrap:wrap; gap:0; border:1px solid #e9e8e3; border-radius:8px; overflow:hidden; }
    .meta-cell { width:50%; padding:8px 12px; border-bottom:1px solid #e9e8e3; }
    .meta-cell:last-child, .meta-cell:nth-last-child(2):nth-child(odd) { border-bottom:none; }
    .meta-cell-label { font-size:10px; color:#999; font-weight:600; margin-bottom:2px; }
    .meta-cell-val { font-size:12px; font-weight:600; }
    table { width:100%; border-collapse:collapse; border:1px solid #e9e8e3; border-radius:8px; overflow:hidden; }
    th { background:#f5f4ef; padding:9px 10px; text-align:left; font-size:10px; font-weight:800; color:#999; letter-spacing:0.5px; border-bottom:1.5px solid #ccc; }
    th.right { text-align:right; }
    .sum-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:13px; }
    .sum-row:last-child { border-bottom:none; }
    .sum-label { color:#666; }
    .sum-value { font-weight:600; }
    .grand-total { display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; color:#fff; padding:14px 16px; border-radius:8px; margin-top:12px; }
    .grand-label { font-size:13px; font-weight:800; letter-spacing:0.8px; }
    .grand-value { font-size:18px; font-weight:800; }
    .amt-words { background:#f9f9f7; border:1px solid #e9e8e3; border-radius:6px; padding:10px 12px; margin-top:12px; }
    .amt-words-label { font-size:10px; font-weight:700; color:#999; margin-bottom:3px; }
    .amt-words-text { font-size:12px; font-style:italic; }
    .narration-box { background:#f9f9f7; border-radius:6px; padding:12px; font-size:12px; font-style:italic; color:#444; }
    .sig-row { display:flex; justify-content:space-between; margin-top:20px; }
    .sig-box { flex:1; padding-top:48px; border-top:1.5px solid #333; }
    .sig-box.right { text-align:right; }
    .sig-name { font-size:12px; font-weight:700; }
    .sig-sub { font-size:10px; color:#999; margin-top:2px; }
    .system-note { text-align:center; font-size:10px; color:#bbb; margin-top:16px; font-style:italic; }
    .declaration { font-size:11px; color:#888; font-style:italic; text-align:center; margin-bottom:16px; }
  </style></head><body><div class="page">
  <!-- Company Header -->
  <div class="badge">${cfg.label.toUpperCase()}</div>
  <div class="company-name">${doc.company.name}</div>
  <div class="company-addr">${doc.company.address}</div>
  ${doc.company.gstin ? `<span class="chip"><span>GSTIN</span>${doc.company.gstin}</span>` : ''}
  ${doc.company.pan ? `<span class="chip"><span>PAN</span>${doc.company.pan}</span>` : ''}
  ${(doc.company.phone||doc.company.email) ? `<div class="contact">${[doc.company.phone, doc.company.email].filter(Boolean).join('  ·  ')}</div>` : ''}
  <hr class="hr"/>
  <div class="doc-meta">
    <div><div class="meta-label">DOCUMENT NO.</div><div class="doc-number">${doc.documentNumber}</div></div>
    <div><div class="meta-label" style="text-align:right">DATE</div><div class="doc-date">${doc.date}</div></div>
  </div>

  <!-- Party -->
  ${(doc.party || doc.billing) ? `
  <div class="section">
    <div class="party-grid">
      <div class="party-col">
        <div class="party-col-label">BILL TO</div>
        <div class="party-name">${doc.party?.name || doc.billing?.name || ''}</div>
        ${doc.billing?.line1 ? `<div class="party-addr">${doc.billing.line1}</div>` : ''}
        ${(doc.billing?.city||doc.billing?.state) ? `<div class="party-addr">${[doc.billing?.city, doc.billing?.state, doc.billing?.pincode].filter(Boolean).join(', ')}</div>` : ''}
        ${doc.party?.gstin ? `<div class="party-gstin">GSTIN: ${doc.party.gstin}</div>` : ''}
        ${doc.party?.phone ? `<div class="party-addr">${doc.party.phone}</div>` : ''}
      </div>
      ${doc.shipping?.line1 ? `
      <div class="party-col">
        <div class="party-col-label">SHIP TO</div>
        ${doc.shipping?.name ? `<div class="party-name">${doc.shipping.name}</div>` : ''}
        <div class="party-addr">${doc.shipping.line1}</div>
        ${(doc.shipping?.city||doc.shipping?.state) ? `<div class="party-addr">${[doc.shipping?.city, doc.shipping?.state].filter(Boolean).join(', ')}</div>` : ''}
      </div>` : ''}
    </div>
  </div>` : ''}

  <!-- Items Table -->
  ${hasItems ? `
  <div class="section">
    <div class="section-title">ITEMS</div>
    <table>
      <thead><tr>
        <th style="width:30px">#</th>
        <th>ITEM</th>
        <th style="width:70px">HSN</th>
        <th class="right" style="width:70px">QTY</th>
        <th class="right" style="width:90px">RATE</th>
        <th class="right" style="width:60px">TAX%</th>
        <th class="right" style="width:100px">AMOUNT</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Ledger Entries -->
  ${hasEntries ? `
  <div class="section">
    <div class="section-title">LEDGER ENTRIES</div>
    <table>
      <thead><tr>
        <th>PARTICULARS</th>
        <th class="right" style="width:120px">DEBIT (₹)</th>
        <th class="right" style="width:120px">CREDIT (₹)</th>
      </tr></thead>
      <tbody>${entryRows}
        <tr style="background:#f5f4ef">
          <td style="padding:9px 10px;font-size:12px;font-weight:800">TOTAL</td>
          <td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:800;color:#c0392b">${t.drTotal?formatCurrency(t.drTotal):'—'}</td>
          <td style="padding:9px 10px;text-align:right;font-size:12px;font-weight:800;color:#2d7d46">${t.crTotal?formatCurrency(t.crTotal):'—'}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ''}

  <!-- Tax Summary -->
  ${doc.taxes && doc.taxes.length > 0 ? `
  <div class="section">
    <div class="section-title">TAX SUMMARY</div>
    <table>
      <thead><tr>
        <th>TAX TYPE</th>
        <th class="right" style="width:50px">RATE</th>
        <th class="right" style="width:110px">TAXABLE</th>
        ${hasCGST ? `<th class="right" style="width:100px">CGST</th><th class="right" style="width:100px">SGST</th>` : ''}
        ${hasIGST ? `<th class="right" style="width:100px">IGST</th>` : ''}
        <th class="right" style="width:100px">TAX TOTAL</th>
      </tr></thead>
      <tbody>${taxRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Amount Summary -->
  <div class="section" style="max-width:340px;margin-left:auto">
    <div class="section-title">AMOUNT SUMMARY</div>
    ${t.subtotal !== undefined ? `<div class="sum-row"><span class="sum-label">Subtotal</span><span class="sum-value">${formatCurrency(t.subtotal)}</span></div>` : ''}
    ${t.discount ? `<div class="sum-row"><span class="sum-label">Discount (−)</span><span class="sum-value" style="color:#c0392b">−${formatCurrency(t.discount)}</span></div>` : ''}
    ${t.cgstTotal ? `<div class="sum-row"><span class="sum-label">CGST (+)</span><span class="sum-value">${formatCurrency(t.cgstTotal)}</span></div>` : ''}
    ${t.sgstTotal ? `<div class="sum-row"><span class="sum-label">SGST (+)</span><span class="sum-value">${formatCurrency(t.sgstTotal)}</span></div>` : ''}
    ${t.igstTotal ? `<div class="sum-row"><span class="sum-label">IGST (+)</span><span class="sum-value">${formatCurrency(t.igstTotal)}</span></div>` : ''}
    ${t.taxTotal ? `<div class="sum-row"><span class="sum-label">Total Tax</span><span class="sum-value" style="font-weight:700">${formatCurrency(t.taxTotal)}</span></div>` : ''}
    ${(t.roundOff !== undefined && t.roundOff !== 0) ? `<div class="sum-row"><span class="sum-label">Round Off</span><span class="sum-value">${t.roundOff>0?'+':'−'}${formatCurrency(Math.abs(t.roundOff))}</span></div>` : ''}
    <div class="grand-total">
      <span class="grand-label">GRAND TOTAL</span>
      <span class="grand-value">${formatCurrency(t.total)}</span>
    </div>
    <div class="amt-words">
      <div class="amt-words-label">Amount in Words</div>
      <div class="amt-words-text">${amountInWords(t.total)}</div>
    </div>
  </div>

  <!-- Narration -->
  ${doc.narration ? `
  <div class="section">
    <div class="section-title">NARRATION</div>
    <div class="narration-box">${doc.narration}</div>
  </div>` : ''}

  <!-- Terms -->
  ${doc.terms ? `
  <div class="section">
    <div class="section-title">TERMS &amp; CONDITIONS</div>
    <div style="font-size:11px;color:#666;line-height:1.6">${doc.terms}</div>
  </div>` : ''}

  <!-- Footer -->
  ${doc.footerInfo ? `
  ${doc.footerInfo.declaration ? `<div class="declaration" style="margin-top:24px">${doc.footerInfo.declaration}</div>` : ''}
  <div class="sig-row">
    ${doc.footerInfo.receiverNote ? `<div class="sig-box"><div class="sig-name">${doc.footerInfo.receiverNote}</div></div>` : ''}
    ${doc.footerInfo.authorizedSignatory ? `<div class="sig-box right"><div class="sig-name">${doc.footerInfo.authorizedSignatory}</div><div class="sig-sub">Authorized Signatory</div></div>` : ''}
  </div>
  ${doc.footerInfo.systemNote ? `<div class="system-note">${doc.footerInfo.systemNote}</div>` : ''}` : ''}

</div></body></html>`;
}

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
  'Proforma':         'proforma_invoice',
  'Proforma Invoice': 'proforma_invoice',
  'Expense':          'expense_voucher',
  'Expense Voucher':  'expense_voucher',
};
