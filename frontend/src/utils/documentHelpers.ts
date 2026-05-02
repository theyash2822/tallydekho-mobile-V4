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
};

// ── PDF HTML Template Generator ──────────────────────────────────────────────
export function generateDocumentHTML(doc: VoucherDocument): string {
  const cfg = DOC_TYPE_CONFIG[doc.documentType];
  const hasItems = !!(doc.items && doc.items.length > 0);
  const t = doc.totals;
  const isVoucher = ['payment_voucher','receipt_voucher','contra_voucher','journal_voucher'].includes(doc.documentType);

  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cell = (label: string, value: string, style = '') =>
    `<td style="border:1px solid #ccc;padding:4px 6px;vertical-align:top;font-size:11px;${style}"><span style="color:#777;font-size:9px;display:block">${label}</span><span style="font-weight:600;color:#000">${value || ''}</span></td>`;

  const itemRows = hasItems ? doc.items!.map((item, i) => `
    <tr>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center;font-size:11px">${i + 1}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;font-size:11px"><b>${item.name}</b>${item.hsn ? `<br><span style="color:#888;font-size:9px">HSN: ${item.hsn}</span>` : ''}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:11px">${item.qty} ${item.unit}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:11px">${item.rate.toFixed(2)}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center;font-size:11px">${item.unit}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:11px;font-weight:600">${item.amount.toFixed(2)}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="border:1px solid #ccc;padding:12px;text-align:center;color:#888;font-size:11px">No items</td></tr>`;

  const totalQty = hasItems ? doc.items!.reduce((s, i) => s + i.qty, 0) : 0;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 20px; background: #fff; }
  .page { max-width: 750px; margin: 0 auto; border: 1px solid #000; }
  .header-box { border-bottom: 2px solid #000; padding: 8px 12px; text-align: center; }
  .doc-type { font-size: 18px; font-weight: bold; border: 2px solid #C62828; display: inline-block; padding: 2px 16px; color: #000; }
  .doc-sub { font-size: 10px; color: #555; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  .company-name { font-size: 14px; font-weight: bold; }
  .company-addr { font-size: 10px; color: #444; }
  .section-label { font-size: 9px; color: #777; text-transform: uppercase; margin-bottom: 2px; }
  .party-name { font-size: 12px; font-weight: bold; }
  .footer-note { font-size: 10px; text-align: center; color: #555; padding: 6px; border-top: 1px solid #ccc; }
  .amount-words { font-size: 11px; font-style: italic; }
  .declaration { font-size: 9px; color: #444; }
  .sign-box { text-align: right; font-size: 11px; padding: 8px; border-top: 1px solid #ccc; }
</style>
</head>
<body>
<div class="page">

  <!-- TOP: Company + Doc type -->
  <table>
    <tr>
      <td style="width:50%;border:1px solid #ccc;padding:8px 10px;vertical-align:top">
        <div class="company-name">${doc.company?.name || 'Company'}</div>
        <div class="company-addr">${doc.company?.address || ''}</div>
        ${doc.company?.gstin ? `<div style="font-size:10px;margin-top:4px">GSTIN: <b>${doc.company.gstin}</b></div>` : ''}
      </td>
      <td style="width:50%;border:1px solid #ccc;padding:8px;vertical-align:top">
        <div style="text-align:center;margin-bottom:6px">
          <span class="doc-type">${cfg.label}</span>
          ${doc.documentType === 'credit_note' ? '<div class="doc-sub">Credit Sales</div>' : ''}
        </div>
        <table style="width:100%">
          <tr>
            ${cell('Invoice No.', doc.documentNumber)}
            ${cell('Dated', doc.date)}
          </tr>
          <tr>
            ${cell('Delivery Note', '')}
            ${cell('Mode/Terms of Payment', '')}
          </tr>
          <tr>
            ${cell('Reference No. & Date', doc.reference || '')}
            ${cell('Other References', '')}
          </tr>
          <tr>
            ${cell("Buyer's Order No.", '')}
            ${cell('Dated', '')}
          </tr>
          <tr>
            ${cell('Dispatch Doc No.', '')}
            ${cell('Delivery Note Date', '')}
          </tr>
          <tr>
            ${cell('Dispatched through', '')}
            ${cell('Destination', '')}
          </tr>
          <tr>
            <td colspan="2" style="border:1px solid #ccc;padding:4px 6px;font-size:11px">
              <span style="color:#777;font-size:9px;display:block">Terms of Delivery</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- PARTIES: Consignee + Buyer -->
  <table>
    <tr>
      <td style="width:50%;border:1px solid #ccc;padding:6px 10px;vertical-align:top">
        <div class="section-label">Consignee (Ship to)</div>
        ${doc.party?.name ? `<div class="party-name">${doc.party.name}</div>` : ''}
        ${doc.party?.address ? `<div style="font-size:10px;color:#444">${doc.party.address}</div>` : ''}
        ${doc.party?.gstin ? `<div style="font-size:10px">GSTIN: ${doc.party.gstin}</div>` : ''}
        &nbsp;
      </td>
      <td style="width:50%;border:1px solid #ccc;padding:6px 10px;vertical-align:top">
        <div class="section-label">Buyer (Bill to)</div>
        ${doc.party?.name ? `<div class="party-name">${doc.party.name}</div>` : ''}
        ${doc.party?.address ? `<div style="font-size:10px;color:#444">${doc.party.address}</div>` : ''}
        ${doc.party?.phone ? `<div style="font-size:10px">Ph: ${doc.party.phone}</div>` : ''}
        ${doc.party?.gstin ? `<div style="font-size:10px">GSTIN: ${doc.party.gstin}</div>` : ''}
        &nbsp;
      </td>
    </tr>
  </table>

  <!-- ITEMS TABLE -->
  <table>
    <thead>
      <tr style="background:#f0f0f0">
        <th style="border:1px solid #ccc;padding:6px;text-align:center;font-size:11px;width:30px">Sl<br>No</th>
        <th style="border:1px solid #ccc;padding:6px;text-align:center;font-size:11px">Description of Goods</th>
        <th style="border:1px solid #ccc;padding:6px;text-align:center;font-size:11px;width:70px">Quantity</th>
        <th style="border:1px solid #ccc;padding:6px;text-align:center;font-size:11px;width:60px">Rate</th>
        <th style="border:1px solid #ccc;padding:6px;text-align:center;font-size:11px;width:35px">per</th>
        <th style="border:1px solid #ccc;padding:6px;text-align:center;font-size:11px;width:80px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${!hasItems && doc.narration ? `<tr><td colspan="5" style="border:1px solid #ccc;padding:6px;font-size:11px">${doc.narration}</td><td style="border:1px solid #ccc;padding:6px;text-align:right;font-size:13px;font-weight:bold">${fmt(t.total)}</td></tr>` : ''}
    </tbody>
    <tfoot>
      <tr>
        <td style="border:1px solid #ccc;padding:6px;text-align:right;font-size:11px;font-weight:bold" colspan="2">Total</td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right;font-size:11px;font-weight:bold">${hasItems ? totalQty + ' ' + (doc.items![0]?.unit || 'Nos') : ''}</td>
        <td style="border:1px solid #ccc;padding:6px"></td>
        <td style="border:1px solid #ccc;padding:6px"></td>
        <td style="border:1px solid #ccc;padding:6px;text-align:right;font-size:13px;font-weight:bold">${fmt(t.total)}</td>
      </tr>
      ${t.taxTotal && t.taxTotal > 0 ? `
      <tr>
        <td colspan="5" style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:10px;color:#555">CGST @ ${t.cgstTotal ? (t.cgstTotal / (t.subtotal||1) * 100).toFixed(1) + '%' : '—'}</td>
        <td style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:10px">${t.cgstTotal ? fmt(t.cgstTotal) : '—'}</td>
      </tr>
      <tr>
        <td colspan="5" style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:10px;color:#555">SGST</td>
        <td style="border:1px solid #ccc;padding:4px 6px;text-align:right;font-size:10px">${t.sgstTotal ? fmt(t.sgstTotal) : '—'}</td>
      </tr>` : ''}
    </tfoot>
  </table>

  <!-- AMOUNT IN WORDS + DECLARATION -->
  <table>
    <tr>
      <td style="width:60%;border:1px solid #ccc;padding:6px 10px;vertical-align:top">
        <div class="section-label">Amount Chargeable (in words)</div>
        <div class="amount-words">INR ${amountInWords(t.total)}</div>
        <br/>
        <div class="section-label" style="margin-top:8px">Declaration</div>
        <div class="declaration">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</div>
      </td>
      <td style="width:40%;border:1px solid #ccc;padding:6px 10px;vertical-align:top">
        <div style="font-size:9px;color:#777">E. &amp; O.E</div>
        <br/><br/><br/>
        <div class="sign-box">
          <div>for <b>${doc.company?.name || ''}</b></div>
          <br/><br/>
          <div style="border-top:1px solid #000;padding-top:4px;font-size:10px">Authorised Signatory</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="footer-note">This is a Computer Generated Invoice</div>
</div>
</body></html>`;
}


// ── Map transaction type strings to DocumentType ──────────────────────────────
export const TX_TO_DOC_TYPE: Record<string, DocumentType> = {
  // Standard types
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
  // Tally-specific voucher type names
  'Sales GST':         'sales_invoice',
  'Sales':             'sales_invoice',
  'Purchase GST':      'purchase_invoice',
  'Purchase':          'purchase_invoice',
  'Debit Note GST':    'debit_note',
  'Credit Note GST':   'credit_note',
  'Sales Order GST':   'sales_order',
};
