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
  const hasEntries = !!(doc.ledgerEntries && doc.ledgerEntries.length > 0);
  const t = doc.totals;
  const isVoucher = ['payment_voucher','receipt_voucher','contra_voucher','journal_voucher'].includes(doc.documentType);
  const isOrder = ['sales_order','purchase_order','quotation'].includes(doc.documentType);
  const isDelivery = doc.documentType === 'delivery_note';

  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cell = (label: string, value: string, colspan = 1) =>
    `<td colspan="${colspan}" style="border:1px solid #999;padding:4px 6px;vertical-align:top;font-size:10px"><span style="color:#666;font-size:8px;display:block">${label}</span><b>${value || ''}</b></td>`;

  // Meta fields grid
  const metaRows = isVoucher ? `
    <tr>${cell('Voucher No.', doc.documentNumber)}${cell('Date', doc.date)}</tr>
    <tr>${cell('Mode of Payment', '')}${cell('Reference', doc.reference || '')}</tr>` :
  isOrder ? `
    <tr>${cell('Order No.', doc.documentNumber)}${cell('Dated', doc.date)}</tr>
    <tr>${cell('Reference No.', doc.reference || '')}${cell('Other References', '')}</tr>
    <tr>${cell("Buyer's Order No.", '')}${cell('Dated', '')}</tr>
    <tr>${cell('Terms of Delivery', '', 2)}</tr>` : `
    <tr>${cell('Invoice No.', doc.documentNumber)}${cell('Dated', doc.date)}</tr>
    <tr>${cell('Delivery Note', '')}${cell('Mode/Terms of Payment', '')}</tr>
    <tr>${cell('Reference No. & Date.', doc.reference || '')}${cell('Other References', '')}</tr>
    <tr>${cell("Buyer's Order No.", '')}${cell('Dated', '')}</tr>
    <tr>${cell('Dispatch Doc No.', '')}${cell('Delivery Note Date', '')}</tr>
    <tr>${cell('Dispatched through', '')}${cell('Destination', '')}</tr>
    <tr>${cell('Terms of Delivery', '', 2)}</tr>`;

  // Items rows for invoice/order
  const itemRows = hasItems ? doc.items!.map((item, i) => `
    <tr>
      <td style="border:1px solid #999;padding:5px 6px;text-align:center;font-size:10px">${i+1}</td>
      <td style="border:1px solid #999;padding:5px 6px;font-size:10px"><b>${item.name}</b></td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:center;font-size:10px">${item.hsn||''}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:right;font-size:10px">${item.qty} ${item.unit}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:right;font-size:10px">${item.rate.toFixed(2)}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:center;font-size:10px">${item.unit}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:right;font-size:10px">${item.discount ? item.discount.toFixed(2)+'%' : ''}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:right;font-size:10px;font-weight:600">${item.amount.toFixed(2)}</td>
    </tr>`).join('') :
    `<tr><td colspan="8" style="border:1px solid #999;padding:60px;text-align:center;color:#ccc"></td></tr>`;

  // Ledger entries for vouchers
  const entryRows = hasEntries ? doc.ledgerEntries!.map((e, i) => `
    <tr>
      <td style="border:1px solid #999;padding:5px 6px;font-size:10px"><b>${e.particulars}</b>${e.narration ? `<br><span style="color:#888;font-size:9px">${e.narration}</span>` : ''}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:right;font-size:10px;color:#c0392b;font-weight:${e.debit?600:400}">${e.debit ? fmt(e.debit) : '—'}</td>
      <td style="border:1px solid #999;padding:5px 6px;text-align:right;font-size:10px;color:#2d7d46;font-weight:${e.credit?600:400}">${e.credit ? fmt(e.credit) : '—'}</td>
    </tr>`).join('') :
    `<tr><td colspan="3" style="border:1px solid #999;padding:60px;text-align:center;color:#ccc"></td></tr>`;

  const totalQty = hasItems ? doc.items!.reduce((s,i) => s + i.qty, 0) : 0;
  const unit0 = hasItems && doc.items![0] ? doc.items![0].unit : '';

  // HSN/SAC tax summary (for invoices with items)
  const hsnMap: Record<string, number> = {};
  if (hasItems) {
    doc.items!.forEach(item => {
      const hsn = item.hsn || 'N/A';
      hsnMap[hsn] = (hsnMap[hsn] || 0) + item.amount;
    });
  }
  const hsnRows = Object.entries(hsnMap).map(([hsn, amt]) =>
    `<tr><td style="border:1px solid #999;padding:4px 6px;font-size:10px">${hsn}</td><td style="border:1px solid #999;padding:4px 6px;text-align:right;font-size:10px">${amt.toFixed(2)}</td></tr>`
  ).join('');

  const mainTable = isVoucher ? `
  <table>
    <thead><tr style="background:#f0f0f0">
      <th style="border:1px solid #999;padding:6px;text-align:left;font-size:10px">Particulars</th>
      <th style="border:1px solid #999;padding:6px;text-align:right;font-size:10px;width:110px">Debit (Dr)</th>
      <th style="border:1px solid #999;padding:6px;text-align:right;font-size:10px;width:110px">Credit (Cr)</th>
    </tr></thead>
    <tbody>${entryRows}${!hasEntries && doc.narration ? `<tr><td style="border:1px solid #999;padding:8px;font-size:10px">${doc.narration}</td><td style="border:1px solid #999"></td><td style="border:1px solid #999"></td></tr>` : ''}</tbody>
    <tfoot><tr>
      <td style="border:1px solid #999;padding:6px;text-align:right;font-size:11px;font-weight:bold">Total</td>
      <td style="border:1px solid #999;padding:6px;text-align:right;font-size:13px;font-weight:bold;color:#c0392b">${t.drTotal ? fmt(t.drTotal) : fmt(t.total)}</td>
      <td style="border:1px solid #999;padding:6px;text-align:right;font-size:13px;font-weight:bold;color:#2d7d46">${t.crTotal ? fmt(t.crTotal) : fmt(t.total)}</td>
    </tr></tfoot>
  </table>` : `
  <table>
    <thead><tr style="background:#f0f0f0">
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:28px">Sl<br>No</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px">Description of Goods</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:55px">HSN/SAC</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:65px">Quantity</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:60px">Rate</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:30px">per</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:45px">Disc.<br>%</th>
      <th style="border:1px solid #999;padding:6px;text-align:center;font-size:10px;width:85px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}${!hasItems && doc.narration ? `<tr><td colspan="7" style="border:1px solid #999;padding:8px;font-size:10px">${doc.narration}</td><td style="border:1px solid #999;padding:8px;text-align:right;font-size:13px;font-weight:bold">${fmt(t.total)}</td></tr>` : ''}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="border:1px solid #999;padding:6px;text-align:right;font-size:10px;font-weight:bold">Total</td>
        <td style="border:1px solid #999;padding:6px;text-align:right;font-size:10px;font-weight:bold">${hasItems ? totalQty + ' ' + unit0 : ''}</td>
        <td style="border:1px solid #999;padding:6px"></td><td style="border:1px solid #999;padding:6px"></td><td style="border:1px solid #999;padding:6px"></td>
        <td style="border:1px solid #999;padding:6px;text-align:right;font-size:13px;font-weight:bold">₹ ${t.total.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:18px;background:#fff;}
  .page{max-width:750px;margin:0 auto;border:2px solid #000;}
  table{width:100%;border-collapse:collapse;}
</style>
</head><body>
<div class="page">

<!-- HEADER: Company + Doc Type + Meta -->
<table>
  <tr>
    <td style="width:50%;border:1px solid #999;padding:8px 10px;vertical-align:top">
      <div style="font-size:14px;font-weight:bold">${doc.company?.name || ''}</div>
      <div style="font-size:9px;color:#444;margin-top:3px">${(doc.company?.address || '').replace(/,/g,',\n')}</div>
      ${doc.company?.gstin ? `<div style="font-size:9px;margin-top:4px"><b>GSTIN/UIN:</b> ${doc.company.gstin}</div>` : ''}
    </td>
    <td style="width:50%;border:1px solid #999;padding:8px;vertical-align:top">
      <div style="text-align:center;margin-bottom:8px">
        <span style="font-size:15px;font-weight:bold;border:2px solid #C62828;padding:3px 16px;display:inline-block">${cfg.label}</span>
      </div>
      <table style="width:100%">${metaRows}</table>
    </td>
  </tr>
</table>

<!-- PARTIES -->
<table>
  <tr>
    <td style="width:50%;border:1px solid #999;padding:6px 10px;vertical-align:top">
      ${isVoucher ? `
        <div style="font-size:8px;color:#777;text-transform:uppercase;margin-bottom:2px">Account</div>
        <div style="font-size:12px;font-weight:bold">${doc.party?.name||'—'}</div>
        ${doc.party?.phone ? `<div style="font-size:9px">Ph: ${doc.party.phone}</div>` : ''}
      ` : `
        <div style="font-size:8px;color:#777;text-transform:uppercase;margin-bottom:2px">Consignee (Ship to)</div>
        <div style="font-size:12px;font-weight:bold">${doc.party?.name||'—'}</div>
        ${doc.party?.address ? `<div style="font-size:9px;color:#444">${doc.party.address}</div>` : ''}
        ${doc.party?.gstin ? `<div style="font-size:9px"><b>GSTIN:</b> ${doc.party.gstin}</div>` : ''}
      `}
      <br/>
    </td>
    <td style="width:50%;border:1px solid #999;padding:6px 10px;vertical-align:top">
      ${isVoucher ? `
        <div style="font-size:8px;color:#777;text-transform:uppercase;margin-bottom:2px">Narration</div>
        <div style="font-size:10px;font-style:italic">${doc.narration||'—'}</div>
      ` : `
        <div style="font-size:8px;color:#777;text-transform:uppercase;margin-bottom:2px">Buyer (Bill to)</div>
        <div style="font-size:12px;font-weight:bold">${doc.party?.name||'—'}</div>
        ${doc.party?.address ? `<div style="font-size:9px;color:#444">${doc.party.address}</div>` : ''}
        ${doc.party?.phone ? `<div style="font-size:9px">Ph: ${doc.party.phone}</div>` : ''}
        ${doc.party?.gstin ? `<div style="font-size:9px"><b>GSTIN:</b> ${doc.party.gstin}</div>` : ''}
      `}
      <br/>
    </td>
  </tr>
</table>

<!-- MAIN TABLE -->
${mainTable}

<!-- AMOUNT IN WORDS + SIGNATURE -->
<table>
  <tr>
    <td style="width:60%;border:1px solid #999;padding:6px 10px;vertical-align:top">
      <div style="font-size:9px;color:#777;text-transform:uppercase;margin-bottom:3px">Amount Chargeable (in words)</div>
      <div style="font-size:11px;font-weight:bold">Indian Rupees ${amountInWords(t.total)}</div>
      <br/>
      ${hasItems && Object.keys(hsnMap).length > 0 ? `
      <div style="font-size:9px;color:#777;text-transform:uppercase;margin-top:8px;margin-bottom:4px">HSN/SAC Tax Summary</div>
      <table style="width:auto">
        <thead><tr style="background:#f0f0f0">
          <th style="border:1px solid #999;padding:4px 8px;font-size:9px">HSN/SAC</th>
          <th style="border:1px solid #999;padding:4px 8px;font-size:9px;text-align:right">Taxable Value</th>
        </tr></thead>
        <tbody>${hsnRows}</tbody>
        <tfoot><tr>
          <td style="border:1px solid #999;padding:4px 8px;font-size:9px;font-weight:bold">Total</td>
          <td style="border:1px solid #999;padding:4px 8px;font-size:9px;font-weight:bold;text-align:right">${t.total.toFixed(2)}</td>
        </tr></tfoot>
      </table>
      <div style="font-size:9px;margin-top:6px">Tax Amount (in words): <b>NIL</b></div>
      ` : ''}
    </td>
    <td style="width:40%;border:1px solid #999;padding:6px 10px;vertical-align:top">
      <div style="font-size:9px;text-align:right;color:#777">E. &amp; O.E</div>
      <br/><br/><br/>
      <div style="text-align:right">
        <div style="font-size:11px">for <b>${doc.company?.name||''}</b></div>
        <br/><br/>
        <div style="border-top:1px solid #000;padding-top:4px;font-size:10px;display:inline-block;min-width:140px;text-align:center">Authorised Signatory</div>
      </div>
    </td>
  </tr>
</table>

<!-- DECLARATION + FOOTER -->
<table>
  <tr>
    <td style="border:1px solid #999;padding:6px 10px;vertical-align:top">
      <b style="font-size:10px">Company's PAN${doc.company?.gstin ? ' : ' + doc.company.gstin.slice(2,12) : ''}</b>
      <div style="font-size:9px;color:#777;text-transform:uppercase;margin-top:6px;margin-bottom:2px">Declaration</div>
      <div style="font-size:9px;color:#444;line-height:1.5">We declare that this ${isVoucher ? 'voucher' : 'invoice'} shows the actual ${isVoucher ? 'transaction' : 'price of the goods described'} and that all particulars are true and correct.</div>
    </td>
  </tr>
</table>

<div style="text-align:center;font-size:9px;color:#555;padding:6px;border-top:1px solid #999">This is a Computer Generated ${isVoucher ? 'Voucher' : 'Invoice'}</div>
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
