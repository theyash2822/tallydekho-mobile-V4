// Tally Prime print replica.
// Spec: tallydekho-brain/PDF_LAYOUT_SPEC.md — three layout families:
//   A invoice grid, B accounting voucher, C statement.
// Monochrome, ruled, no brand colour. Every metadata label renders even when the
// value is blank, because Tally never collapses those cells.

import { DocumentType, VoucherDocument, ItemLine, LedgerEntry } from '../../types/document';
import { tallyWords } from './words';

export interface TallyRenderOptions {
  logoUri?: string | null;
  terms?: string[];
  qrImage?: string | null;
  bankInfo?: { bankName?: string | null; accountNo?: string | null; ifsc?: string | null; upiId?: string | null } | null;
}

/** Tally's stock declaration, used when the company has not set its own. */
export const DEFAULT_DECLARATION =
  'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';

const ACCOUNTING_VOUCHERS: DocumentType[] = ['receipt_voucher', 'payment_voucher', 'journal_voucher', 'contra_voucher'];
const STATEMENT_DOCS: DocumentType[] = ['stock_journal'];

const TITLE: Partial<Record<DocumentType, string>> = {
  sales_invoice: 'TAX INVOICE',
  proforma_invoice: 'PROFORMA INVOICE',
  purchase_invoice: 'TAX INVOICE',
  credit_note: 'Tax Invoice',
  debit_note: 'Debit Note',
  delivery_note: 'DELIVERY NOTE',
  sales_order: 'SALES ORDER',
  purchase_order: 'PURCHASE ORDER',
  receipt_note: 'RECEIPT NOTE',
  quotation: 'QUOTATION',
  receipt_voucher: 'Receipt Voucher',
  payment_voucher: 'Payment Voucher',
  journal_voucher: 'Journal Voucher',
  contra_voucher: 'Contra Voucher',
  stock_journal: 'Stock Journal',
};

const PURCHASE_SIDE: DocumentType[] = ['purchase_invoice', 'purchase_order', 'debit_note', 'receipt_note'];
const HSN_SUMMARY_DOCS: DocumentType[] = ['sales_invoice', 'purchase_invoice', 'proforma_invoice'];

// ── primitives ───────────────────────────────────────────────────────────────

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Indian grouping, 2 decimals, no symbol — Tally's number style. */
const num = (n?: number | null): string =>
  Math.abs(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const rupees = (n?: number | null): string => '\u20b9 ' + num(n);

/** Trailing zeros trimmed, used for quantities: `1000`, `2.5`. */
const qtyText = (n?: number | null): string => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(3)));
};

const pctText = (n?: number | null): string => {
  const v = Number(n);
  if (!v) return '';
  return `${Number.isInteger(v) ? v : parseFloat(v.toFixed(2))} %`;
};

const lines = (value?: string | null): string =>
  esc(value || '')
    .split(/\s*,\s*|\n/)
    .filter(Boolean)
    .map(l => `<div>${l}</div>`)
    .join('');

/** `State Name : Gujarat, Code : 24` */
const stateLine = (state?: string | null, code?: string | null): string => {
  if (!state && !code) return '';
  const parts = [state ? `State Name : ${esc(state)}` : ''];
  if (code) parts.push(`Code : ${esc(code)}`);
  return `<div>${parts.filter(Boolean).join(', ')}</div>`;
};

// ── Family A: invoice grid ───────────────────────────────────────────────────

/** Metadata cell labels per document type, in Tally's printed order. */
function metaLabels(type: DocumentType): string[] {
  switch (type) {
    case 'credit_note':
      return ['Credit Note No.', 'Original Invoice No. & Date.', 'Dated', "Buyer's Order No.",
        'Mode/Terms of Payment', 'Other References', 'Dispatch Doc No.', 'Dated',
        'Dispatched through', 'Destination', 'Terms of Delivery'];
    case 'debit_note':
      return ['Debit Note No.', 'Original Invoice No. & Date.', 'Dated', "Buyer's Order No.",
        'Mode/Terms of Payment', 'Other References', 'Dispatch Doc No.', 'Dated',
        'Dispatched through', 'Destination', 'Terms of Delivery'];
    case 'delivery_note':
      return ['Delivery Note No.', 'Reference No. & Date.', 'Dated', "Buyer's Order No.",
        'Mode/Terms of Payment', 'Other References', 'Dispatch Doc No.', 'Dated',
        'Dispatched through', 'Destination', 'Terms of Delivery'];
    case 'sales_order':
    case 'quotation':
      return ['Order No.', 'Dated', 'Mode/Terms of Payment', 'Reference No. & Date.',
        'Other References', 'Despatch through', 'Destination', 'Terms of Delivery'];
    case 'purchase_order':
      return ['Invoice No.', 'Supplier Invoice No. & Date.', 'Dated', 'Other References'];
    case 'purchase_invoice':
      return ['Invoice No.', 'Supplier Invoice No. & Date.', 'Dated', 'Delivery Note',
        'Mode/Terms of Payment', 'Reference No. & Date.', 'Other References',
        "Buyer's Order No.", 'Dated', 'Dispatch Doc No.', 'Delivery Note Date',
        'Dispatched through', 'Destination', 'Terms of Delivery'];
    default:
      return ['Invoice No.', 'e-Way Bill No.', 'Dated', 'Delivery Note',
        'Mode/Terms of Payment', 'Reference No. & Date.', 'Other References',
        "Buyer's Order No.", 'Dated', 'Dispatch Doc No.', 'Delivery Note Date',
        'Dispatched through', 'Destination', 'Bill of Lading/LR-RR No.',
        'Motor Vehicle No.', 'Terms of Delivery'];
  }
}

/**
 * Resolve a metadata label to a value. Labels repeat (`Dated` appears twice, once
 * for the document and once for the buyer's order), so position decides meaning.
 */
function metaValues(doc: VoucherDocument, labels: string[]): Array<{ label: string; value: string }> {
  const meta = (doc.tallyMeta || {}) as Record<string, any>;
  const legacy = (doc.metadata || {}) as Record<string, any>;
  const dispatch = (doc.dispatchDetails || {}) as Record<string, any>;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = meta[k] ?? legacy[k] ?? dispatch[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
  };

  let datedSeen = 0;
  return labels.map(label => {
    let value = '';
    switch (label) {
      case 'Invoice No.':
      case 'Credit Note No.':
      case 'Debit Note No.':
      case 'Delivery Note No.':
      case 'Order No.':
        value = doc.documentNumber || '';
        break;
      case 'Dated':
        // First occurrence is the document date; later ones belong to the order ref.
        value = datedSeen++ === 0 ? (doc.date || '') : pick('buyerOrderDate', 'orderDate');
        break;
      case 'e-Way Bill No.':
        value = pick('ewayBillNo', 'ewbNo', 'eway');
        break;
      case 'Delivery Note':
        value = pick('deliveryNote', 'deliveryNoteNo');
        break;
      case 'Delivery Note Date':
        value = pick('deliveryNoteDate');
        break;
      case 'Mode/Terms of Payment':
        value = pick('paymentTerms', 'modeOfPayment', 'paymentMode');
        break;
      case 'Reference No. & Date.':
      case 'Original Invoice No. & Date.':
      case 'Supplier Invoice No. & Date.':
        value = pick('reference', 'referenceNo', 'originalInvoiceNo', 'supplierInvoiceNo') || (doc.reference || '');
        break;
      case 'Other References':
        value = pick('otherReferences', 'otherRef');
        break;
      case "Buyer's Order No.":
        value = pick('buyerOrderNo', 'orderRef', 'againstOrderNo');
        break;
      case 'Dispatch Doc No.':
        value = pick('dispatchDocNo', 'transportDocNo', 'lrNo');
        break;
      case 'Dispatched through':
      case 'Despatch through':
        value = pick('dispatchedThrough', 'transporterName', 'carrier');
        break;
      case 'Destination':
        value = pick('destination');
        break;
      case 'Bill of Lading/LR-RR No.':
        value = pick('billOfLading', 'lrNo', 'transportDocNo');
        break;
      case 'Motor Vehicle No.':
        value = pick('vehicleNo', 'motorVehicleNo');
        break;
      case 'Terms of Delivery':
        value = pick('termsOfDelivery', 'deliveryTerms');
        break;
      default:
        value = '';
    }
    return { label, value };
  });
}

function metaGridHtml(doc: VoucherDocument): string {
  const cells = metaValues(doc, metaLabels(doc.documentType));
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const pair = cells.slice(i, i + 2);
    const tds = pair.map(c =>
      `<td style="border:1px solid #000;padding:3px 5px;vertical-align:top;width:50%">
         <div style="font-size:8.5px">${esc(c.label)}</div>
         <div style="font-size:9.5px;font-weight:bold;min-height:12px">${esc(c.value)}</div>
       </td>`).join('');
    const filler = pair.length === 1 ? '<td style="border:1px solid #000"></td>' : '';
    rows.push(`<tr>${tds}${filler}</tr>`);
  }
  return `<table style="width:100%;border-collapse:collapse">${rows.join('')}</table>`;
}

function addressBlock(label: string, party: any, opts: { showGstin?: boolean } = {}): string {
  const showGstin = opts.showGstin !== false;
  return `<div style="padding:4px 6px;border-top:1px solid #000">
    <div style="font-size:8.5px">${esc(label)}</div>
    <div style="font-size:11px;font-weight:bold">${esc(party?.name || '')}</div>
    <div style="font-size:9px">${lines(party?.address)}</div>
    ${showGstin && party?.gstin ? `<div style="font-size:9px">GSTIN/UIN : ${esc(party.gstin)}</div>` : ''}
    <div style="font-size:9px">${stateLine(party?.state, party?.stateCode)}</div>
  </div>`;
}

/** Items, then tax ledgers, then charge ledgers — all inside one ruled table. */
function itemTableHtml(doc: VoucherDocument): string {
  const items: ItemLine[] = doc.items || [];
  const taxes = doc.taxes || [];
  const charges = doc.additionalCharges || [];
  const t = doc.totals || ({} as any);

  const itemRows = items.map((item, i) => `
    <tr>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;vertical-align:top">${i + 1}</td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9.5px;vertical-align:top">
        <b>${esc(item.name)}</b>
        ${item.description ? `<div style="padding-left:8px;font-size:9px">${esc(item.description)}</div>` : ''}
        ${item.batch ? `<div style="padding-left:8px;font-size:9px">Batch : ${esc(item.batch)}</div>` : ''}
        ${item.godown ? `<div style="padding-left:8px;font-size:9px">${esc(item.godown)}</div>` : ''}
      </td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;vertical-align:top">${esc(item.hsn || '')}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-size:9px;vertical-align:top">${qtyText(item.qty)} ${esc(item.unit || '')}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-size:9px;vertical-align:top">${num(item.rate)}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:center;font-size:9px;vertical-align:top">${esc(item.unit || '')}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-size:9px;vertical-align:top">${pctText(item.discount)}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-size:9.5px;vertical-align:top">${num(item.taxableAmount ?? item.amount)}</td>
    </tr>`).join('');

  // Tax and charge ledgers print as description rows with the rate in the Disc. % column.
  const ledgerRow = (name: string, amount: number, pct?: number | null) => `
    <tr>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9.5px;text-align:right">${esc(name)}</td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-size:9px">${pctText(pct)}</td>
      <td style="border:1px solid #000;padding:3px 4px;text-align:right;font-size:9.5px">${num(amount)}</td>
    </tr>`;

  const taxRows = taxes.map(tx => ledgerRow(tx.description, tx.total, tx.rate)).join('');
  // A charge can carry its own tax ledgers (e.g. freight + GST on freight).
  const chargeRows = charges.map(c =>
    ledgerRow(c.description, c.amount, null) +
    (c.taxes || []).map(ct => ledgerRow(ct.description, ct.amount, ct.rate)).join('')
  ).join('');

  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const unit = items.find(i => i.unit)?.unit || '';
  const grand = t.total ?? 0;

  // Tally keeps a fixed body height so the ruled grid reaches the totals row.
  const filler = items.length + taxes.length + charges.length < 8
    ? `<tr><td style="border:1px solid #000;height:${Math.max(40, (8 - items.length - taxes.length - charges.length) * 16)}px"></td>
        ${'<td style="border:1px solid #000"></td>'.repeat(7)}</tr>`
    : '';

  return `<table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:26px">Sl<br/>No.</th>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px">Description of Goods</th>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:56px">HSN/SAC</th>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:68px">Quantity</th>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:62px">Rate</th>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:34px">per</th>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:46px">Disc. %</th>
      <th style="border:1px solid #000;padding:4px 3px;font-size:9px;width:86px">Amount</th>
    </tr></thead>
    <tbody>${itemRows}${taxRows}${chargeRows}${filler}</tbody>
    <tfoot><tr>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000;padding:4px 5px;text-align:right;font-size:10px;font-weight:bold">Total</td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000;padding:4px 3px;text-align:right;font-size:9.5px;font-weight:bold">${totalQty ? qtyText(totalQty) + ' ' + esc(unit) : ''}</td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000"></td>
      <td style="border:1px solid #000;padding:4px 3px;text-align:right;font-size:10.5px;font-weight:bold">${rupees(grand)}</td>
    </tr></tfoot>
  </table>`;
}

function hsnSummaryHtml(doc: VoucherDocument): string {
  if (!HSN_SUMMARY_DOCS.includes(doc.documentType)) return '';
  const rows = doc.hsnSummary || [];
  if (!rows.length) return '';

  const hasCgst = rows.some(r => (r.cgst || 0) !== 0);
  const hasIgst = rows.some(r => (r.igst || 0) !== 0);
  // Tally prints one rate column per tax head; CGST and SGST each carry half of taxPct.
  const halfRate = (r: typeof rows[number]) => (r.taxPct ? r.taxPct / 2 : 0);

  const head = `<tr>
    <th rowspan="2" style="border:1px solid #000;padding:3px 5px;font-size:9px">HSN/SAC</th>
    <th rowspan="2" style="border:1px solid #000;padding:3px 5px;font-size:9px">Taxable<br/>Value</th>
    ${hasCgst ? `<th colspan="2" style="border:1px solid #000;padding:3px 5px;font-size:9px">Central Tax</th>
                 <th colspan="2" style="border:1px solid #000;padding:3px 5px;font-size:9px">State Tax</th>` : ''}
    ${hasIgst ? `<th colspan="2" style="border:1px solid #000;padding:3px 5px;font-size:9px">Integrated Tax</th>` : ''}
    <th rowspan="2" style="border:1px solid #000;padding:3px 5px;font-size:9px">Total<br/>Tax Amount</th>
  </tr>
  <tr>
    ${hasCgst ? `<th style="border:1px solid #000;padding:2px 4px;font-size:8.5px">Rate</th><th style="border:1px solid #000;padding:2px 4px;font-size:8.5px">Amount</th>
                 <th style="border:1px solid #000;padding:2px 4px;font-size:8.5px">Rate</th><th style="border:1px solid #000;padding:2px 4px;font-size:8.5px">Amount</th>` : ''}
    ${hasIgst ? `<th style="border:1px solid #000;padding:2px 4px;font-size:8.5px">Rate</th><th style="border:1px solid #000;padding:2px 4px;font-size:8.5px">Amount</th>` : ''}
  </tr>`;

  const body = rows.map(r => `<tr>
    <td style="border:1px solid #000;padding:3px 5px;font-size:9px">${esc(r.hsn || '')}</td>
    <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${num(r.taxableAmount)}</td>
    ${hasCgst ? `<td style="border:1px solid #000;padding:3px 4px;font-size:9px;text-align:center">${pctText(halfRate(r))}</td>
                 <td style="border:1px solid #000;padding:3px 4px;font-size:9px;text-align:right">${num(r.cgst)}</td>
                 <td style="border:1px solid #000;padding:3px 4px;font-size:9px;text-align:center">${pctText(halfRate(r))}</td>
                 <td style="border:1px solid #000;padding:3px 4px;font-size:9px;text-align:right">${num(r.sgst)}</td>` : ''}
    ${hasIgst ? `<td style="border:1px solid #000;padding:3px 4px;font-size:9px;text-align:center">${pctText(r.taxPct)}</td>
                 <td style="border:1px solid #000;padding:3px 4px;font-size:9px;text-align:right">${num(r.igst)}</td>` : ''}
    <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${num(r.totalTax)}</td>
  </tr>`).join('');

  const cols = 3 + (hasCgst ? 4 : 0) + (hasIgst ? 2 : 0);
  const taxableTotal = rows.reduce((s, r) => s + (Number(r.taxableAmount) || 0), 0);
  const taxTotal = rows.reduce((s, r) => s + (Number(r.totalTax) || 0), 0);
  const foot = `<tr>
    <td style="border:1px solid #000;padding:3px 5px;font-size:9px;font-weight:bold;text-align:right">Total</td>
    <td style="border:1px solid #000;padding:3px 5px;font-size:9px;font-weight:bold;text-align:right">${num(taxableTotal)}</td>
    ${'<td style="border:1px solid #000"></td>'.repeat(cols - 3)}
    <td style="border:1px solid #000;padding:3px 5px;font-size:9px;font-weight:bold;text-align:right">${num(taxTotal)}</td>
  </tr>`;

  const words = (doc.totals as any)?.taxAmountInWords || (taxTotal ? tallyWords(taxTotal) : 'NIL');

  return `<div style="border-top:1px solid #000;padding:4px 6px">
    <table style="width:100%;border-collapse:collapse">${head}${body}${foot}</table>
    <div style="font-size:9px;margin-top:4px">Tax Amount (in words) : <b>${esc(words)}</b></div>
  </div>`;
}

function renderInvoiceGrid(doc: VoucherDocument, opts: TallyRenderOptions): string {
  const t = doc.totals || ({} as any);
  const company: any = doc.company || {};
  const isPurchaseSide = PURCHASE_SIDE.includes(doc.documentType);
  const buyerLabel = isPurchaseSide ? 'Supplier (Bill from)' : 'Buyer (Bill to)';
  const title = TITLE[doc.documentType] || 'TAX INVOICE';
  const words = t.totalInWords || tallyWords(t.total ?? 0);
  const shipTo = doc.shipping || (doc.dispatchDetails as any)?.shipTo || null;
  const signatoryName = doc.documentType === 'purchase_order' ? (doc.party?.name || company.name) : company.name;

  return `
<div style="border:1px solid #000">
  <div style="text-align:center;font-size:13px;font-weight:bold;padding:4px;border-bottom:1px solid #000;letter-spacing:0.5px">${esc(title)}</div>

  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="width:52%;border-right:1px solid #000;vertical-align:top;padding:0">
        <div style="padding:5px 6px">
          ${opts.logoUri ? `<img src="${opts.logoUri}" style="max-height:44px;max-width:130px;object-fit:contain;display:block;margin-bottom:4px" />` : ''}
          <div style="font-size:12px;font-weight:bold">${esc(company.name || '')}</div>
          <div style="font-size:9px">${lines(company.address)}</div>
          ${company.gstin ? `<div style="font-size:9px">GSTIN/UIN: ${esc(company.gstin)}</div>` : ''}
          <div style="font-size:9px">${stateLine(company.state, company.stateCode)}</div>
          ${company.email ? `<div style="font-size:9px">E-Mail : ${esc(company.email)}</div>` : ''}
        </div>
        ${addressBlock('Consignee (Ship to)', shipTo || doc.party)}
        ${addressBlock(buyerLabel, doc.billing || doc.party)}
      </td>
      <td style="width:48%;vertical-align:top;padding:0">${metaGridHtml(doc)}</td>
    </tr>
  </table>

  ${irnBandHtml(doc)}
  ${itemTableHtml(doc)}

  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:4px 6px;border-top:1px solid #000;border-right:1px solid #000;vertical-align:top">
        <div style="font-size:9px">Amount Chargeable (in words)</div>
        <div style="font-size:10px;font-weight:bold;margin-top:2px">${esc(words)}</div>
      </td>
      <td style="width:90px;padding:4px 6px;border-top:1px solid #000;text-align:right;font-size:9px;vertical-align:top">E. &amp; O.E</td>
    </tr>
  </table>

  ${hsnSummaryHtml(doc)}

  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:4px 6px;border-top:1px solid #000;vertical-align:top">
        ${doc.documentType === 'purchase_order'
          ? `${doc.party?.gstin ? `<div style="font-size:9px">Company's GSTIN/UIN : <b>${esc(doc.party.gstin)}</b></div>` : ''}
             ${company.pan ? `<div style="font-size:9px">Buyer's PAN : <b>${esc(company.pan)}</b></div>` : ''}`
          : company.pan ? `<div style="font-size:9px">Company's PAN : <b>${esc(company.pan)}</b></div>` : ''}
        ${doc.narration ? `<div style="font-size:9px;margin-top:4px">On Account of : ${esc(doc.narration)}</div>` : ''}
        ${doc.documentType === 'sales_invoice' || doc.documentType === 'proforma_invoice' ? `
          <div style="font-size:9px;margin-top:6px;text-decoration:underline">Declaration</div>
          <div style="font-size:9px">${esc(company.declarationText || DEFAULT_DECLARATION)}</div>` : ''}
        ${opts.terms && opts.terms.length ? `<div style="font-size:9px;margin-top:6px;text-decoration:underline">Terms &amp; Conditions</div>
          <ol style="font-size:9px;padding-left:14px;margin:2px 0 0">${opts.terms.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
        ${doc.documentType === 'delivery_note' ? `<div style="font-size:9px;margin-top:10px">Recd. in Good Condition</div>` : ''}
        ${bankBlockHtml(opts.bankInfo, company)}
      </td>
      <td style="width:38%;padding:4px 6px;border-top:1px solid #000;border-left:1px solid #000;text-align:right;vertical-align:top">
        ${opts.qrImage ? `<img src="${opts.qrImage}" style="width:64px;height:64px;object-fit:contain;margin-bottom:4px" />` : ''}
        <div style="font-size:9.5px">for <b>${esc(signatoryName || '')}</b></div>
        <div style="height:38px"></div>
        <div style="font-size:9px">Authorised Signatory</div>
      </td>
    </tr>
  </table>
</div>
${company.jurisdiction && (doc.documentType === 'sales_invoice' || doc.documentType === 'proforma_invoice')
  ? `<div style="text-align:center;font-size:9px;margin-top:3px">SUBJECT TO ${esc(String(company.jurisdiction).toUpperCase())} JURISDICTION</div>` : ''}
<div style="text-align:center;font-size:9px;margin-top:2px">This is a Computer Generated ${
  ['credit_note', 'debit_note', 'delivery_note'].includes(doc.documentType) ? 'Document' : 'Invoice'}</div>
<div style="text-align:center;font-size:9px;margin-top:2px">-- 1 of 1 --</div>`;
}

/**
 * IRN band. Tally prints the IRP acknowledgement above the item grid on an
 * e-invoice, so a printed copy proves the invoice was reported.
 */
function irnBandHtml(doc: VoucherDocument): string {
  const meta = (doc.tallyMeta || {}) as Record<string, any>;
  const irn = meta.irn || (doc.metadata as any)?.irn || '';
  if (!irn) return '';
  const cell = (label: string, value: string) =>
    value ? `<td style="border-top:1px solid #000;padding:3px 6px;font-size:9px">${esc(label)} : <b>${esc(value)}</b></td>` : '';
  return `<table style="width:100%;border-collapse:collapse">
    <tr><td colspan="2" style="border-top:1px solid #000;padding:3px 6px;font-size:9px">IRN : <b>${esc(irn)}</b></td></tr>
    <tr>${cell('Ack No.', meta.ackNo || '')}${cell('Ack Date', meta.ackDate || '')}</tr>
  </table>`;
}

function bankBlockHtml(bank: TallyRenderOptions['bankInfo'], company: any): string {
  const b = bank || company?.bank;
  if (!b) return '';
  const rows = [
    b.bankName ? `Bank : ${esc(b.bankName)}` : '',
    b.accountNo ? `A/c No. : ${esc(b.accountNo)}` : '',
    b.ifsc ? `IFSC : ${esc(b.ifsc)}` : '',
    b.upiId ? `UPI : ${esc(b.upiId)}` : '',
    b.branch ? `Branch : ${esc(b.branch)}` : '',
  ].filter(Boolean);
  if (!rows.length) return '';
  return `<div style="font-size:9px;margin-top:6px">
    <div style="text-decoration:underline">Company's Bank Details</div>
    ${rows.map(r => `<div>${r}</div>`).join('')}
  </div>`;
}

// ── Family B: accounting voucher ────────────────────────────────────────────

function renderAccountingVoucher(doc: VoucherDocument, opts: TallyRenderOptions): string {
  const company: any = doc.company || {};
  const t = doc.totals || ({} as any);
  const entries: LedgerEntry[] = doc.ledgerEntries || [];
  const dualColumn = doc.documentType === 'journal_voucher' || doc.documentType === 'contra_voucher';
  const title = TITLE[doc.documentType] || 'Voucher';
  // Contra moves money between own accounts, so Tally suppresses GSTIN.
  const showGstin = doc.documentType !== 'contra_voucher';
  const labelRow = (label: string, cols: number) =>
    `<tr><td style="border:1px solid #000;padding:3px 6px;font-size:9.5px">${esc(label)} :</td>
         ${'<td style="border:1px solid #000"></td>'.repeat(cols)}</tr>`;

  let body = '';
  if (dualColumn) {
    // Tally prefixes the credit-side ledger with "To ".
    body = entries.map((e, idx) => `
      <tr>
        <td style="border:1px solid #000;padding:3px 6px;font-size:9.5px">
          ${idx > 0 && e.credit ? 'To ' : ''}${esc(e.particulars)}
          ${e.narration ? `<div style="padding-left:10px;font-size:9px">${esc(e.narration)}</div>` : ''}
        </td>
        <td style="border:1px solid #000;padding:3px 6px;text-align:right;font-size:9.5px">${e.debit ? num(e.debit) : ''}</td>
        <td style="border:1px solid #000;padding:3px 6px;text-align:right;font-size:9.5px">${e.credit ? num(e.credit) : ''}</td>
      </tr>`).join('');
  } else {
    // Receipt / Payment: "Account :" then the party ledger with its bill
    // allocations indented, then "Through :" and the bank or cash ledger.
    // `reference` carries the grouping, set by voucherDocumentAdapter.
    body = entries.map(e => {
      const amount = e.debit || e.credit || 0;
      const side = e.debit ? 'Dr' : 'Cr';
      const isAllocation = e.reference === 'allocation';
      const group = e.reference === 'Account' || e.reference === 'Through' ? labelRow(e.reference, 1) : '';
      return `${group}
      <tr>
        <td style="border:1px solid #000;padding:${isAllocation ? '2px 6px 2px 22px' : '3px 6px'};font-size:${isAllocation ? '9px' : '9.5px'}">${esc(e.particulars)}</td>
        <td style="border:1px solid #000;padding:3px 6px;text-align:right;font-size:${isAllocation ? '9px' : '9.5px'}">${amount ? `${num(amount)} ${side}` : ''}</td>
      </tr>`;
    }).join('');
  }

  const words = t.totalInWords || tallyWords(t.total ?? t.drTotal ?? 0);

  return `
<div style="border:1px solid #000">
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:5px 6px;vertical-align:top">
        <div style="font-size:12px;font-weight:bold">${esc(company.name || '')}</div>
        <div style="font-size:9px">${lines(company.address)}</div>
        ${showGstin && company.gstin ? `<div style="font-size:9px">GSTIN/UIN: ${esc(company.gstin)}</div>` : ''}
        <div style="font-size:9px">${stateLine(company.state, company.stateCode)}</div>
        ${company.email ? `<div style="font-size:9px">E-Mail : ${esc(company.email)}</div>` : ''}
      </td>
      <td style="padding:5px 6px;text-align:right;vertical-align:top;font-size:12px;font-weight:bold">${esc(title)}</td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;border-top:1px solid #000">
    <tr>
      <td style="padding:3px 6px;font-size:9.5px">No. : <b>${esc(doc.documentNumber || '')}</b></td>
      <td style="padding:3px 6px;font-size:9.5px;text-align:right">Dated : <b>${esc(doc.date || '')}</b></td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;text-align:left">Particulars</th>
      ${dualColumn
        ? `<th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:110px">Debit</th>
           <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:110px">Credit</th>`
        : `<th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:140px">Amount</th>`}
    </tr></thead>
    <tbody>${body}
      <tr><td style="border:1px solid #000;height:40px"></td>${'<td style="border:1px solid #000"></td>'.repeat(dualColumn ? 2 : 1)}</tr>
    </tbody>
    <tfoot><tr>
      <td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10px;font-weight:bold">Total</td>
      ${dualColumn
        ? `<td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10.5px;font-weight:bold">${rupees(t.drTotal ?? t.total)}</td>
           <td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10.5px;font-weight:bold">${rupees(t.crTotal ?? t.total)}</td>`
        : `<td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10.5px;font-weight:bold">${rupees(t.total)}</td>`}
    </tr></tfoot>
  </table>

  <div style="border-top:1px solid #000;padding:4px 6px">
    <div style="font-size:9px">On Account of :</div>
    <div style="font-size:9.5px">${esc(doc.narration || '')}</div>
    <div style="font-size:9px;margin-top:5px">Amount (in words) :</div>
    <div style="font-size:9.5px;font-weight:bold">${esc(words)}</div>
  </div>

  <div style="border-top:1px solid #000;padding:4px 6px;text-align:right">
    ${bankBlockHtml(opts.bankInfo, company)}
    <div style="height:34px"></div>
    <div style="font-size:9px">Authorised Signatory</div>
  </div>
</div>
<div style="text-align:center;font-size:9px;margin-top:3px">-- 1 of 1 --</div>`;
}

// ── Family C: statement ─────────────────────────────────────────────────────

export interface StatementRow {
  date?: string;
  particulars?: string;
  vchType?: string;
  vchNo?: string;
  debit?: number | null;
  credit?: number | null;
  indent?: boolean;
}

export interface StatementInput {
  company: any;
  title: string;
  partyName?: string;
  partyAddress?: string;
  period?: string;
  openingLabel?: string;
  openingAmount?: number;
  openingSide?: 'Dr' | 'Cr';
  rows: StatementRow[];
  closingLabel?: string;
  closingAmount?: number;
  closingSide?: 'Dr' | 'Cr';
}

/** Ledger Account / stock statements — Family C. */
export function renderTallyStatementHTML(input: StatementInput): string {
  const company = input.company || {};
  const debitTotal = input.rows.reduce((s, r) => s + (Number(r.debit) || 0), 0);
  const creditTotal = input.rows.reduce((s, r) => s + (Number(r.credit) || 0), 0);
  const openingIsDebit = (input.openingSide || 'Dr') === 'Dr';
  const closingIsDebit = (input.closingSide || 'Cr') === 'Dr';

  const bodyRows = input.rows.map((r, i, all) => {
    const showDate = i === 0 || r.date !== all[i - 1].date;
    return `<tr>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9px;vertical-align:top">${showDate ? esc(r.date || '') : ''}</td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9px;vertical-align:top${r.indent ? ';padding-left:18px' : ''}">${esc(r.particulars || '')}</td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9px;vertical-align:top">${esc(r.vchType || '')}</td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9px;vertical-align:top">${esc(r.vchNo || '')}</td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right;vertical-align:top">${r.debit ? num(r.debit) : ''}</td>
      <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right;vertical-align:top">${r.credit ? num(r.credit) : ''}</td>
    </tr>`;
  }).join('');

  const grandDebit = debitTotal + (openingIsDebit ? (input.openingAmount || 0) : 0) + (closingIsDebit ? (input.closingAmount || 0) : 0);
  const grandCredit = creditTotal + (!openingIsDebit ? (input.openingAmount || 0) : 0) + (!closingIsDebit ? (input.closingAmount || 0) : 0);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:10mm}
  table{width:100%;border-collapse:collapse}
</style></head><body>
<div style="border:1px solid #000">
  <table>
    <tr>
      <td style="padding:5px 6px;vertical-align:top;width:50%">
        <div style="font-size:12px;font-weight:bold">${esc(company.name || '')}</div>
        <div style="font-size:9px">${lines(company.address)}</div>
        ${company.gstin ? `<div style="font-size:9px">GSTIN/UIN: ${esc(company.gstin)}</div>` : ''}
      </td>
      <td style="padding:5px 6px;vertical-align:top;text-align:right">
        <div style="font-size:11px;font-weight:bold">${esc(input.partyName || '')}</div>
        <div style="font-size:11px;font-weight:bold">${esc(input.title)}</div>
        <div style="font-size:9px">${lines(input.partyAddress)}</div>
      </td>
    </tr>
  </table>
  <table style="border-top:1px solid #000">
    <tr>
      <td style="padding:3px 6px;font-size:9.5px">${esc(input.period || '')}</td>
      <td style="padding:3px 6px;font-size:9.5px;text-align:right">Page 1</td>
    </tr>
  </table>
  <table>
    <thead><tr>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:70px">Date</th>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px;text-align:left">Particulars</th>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:90px">Vch Type</th>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:70px">Vch No.</th>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:90px">Debit</th>
      <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:90px">Credit</th>
    </tr></thead>
    <tbody>
      ${input.openingAmount !== undefined ? `<tr>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px">${openingIsDebit ? 'To' : 'By'} ${esc(input.openingLabel || 'Opening Balance')}</td>
        <td style="border:1px solid #000"></td><td style="border:1px solid #000"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${openingIsDebit ? num(input.openingAmount) : ''}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${openingIsDebit ? '' : num(input.openingAmount)}</td>
      </tr>` : ''}
      ${bodyRows}
    </tbody>
    <tfoot>
      <tr>
        <td style="border:1px solid #000"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;font-weight:bold;text-align:right">Total</td>
        <td style="border:1px solid #000"></td><td style="border:1px solid #000"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;font-weight:bold;text-align:right">${num(debitTotal)}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;font-weight:bold;text-align:right">${num(creditTotal)}</td>
      </tr>
      ${input.closingAmount !== undefined ? `<tr>
        <td style="border:1px solid #000"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px">${closingIsDebit ? 'To' : 'By'} ${esc(input.closingLabel || 'Closing Balance')}</td>
        <td style="border:1px solid #000"></td><td style="border:1px solid #000"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${closingIsDebit ? num(input.closingAmount) : ''}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${closingIsDebit ? '' : num(input.closingAmount)}</td>
      </tr>
      <tr>
        <td style="border:1px solid #000"></td><td style="border:1px solid #000"></td>
        <td style="border:1px solid #000"></td><td style="border:1px solid #000"></td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9.5px;font-weight:bold;text-align:right">${num(grandDebit)}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9.5px;font-weight:bold;text-align:right">${num(grandCredit)}</td>
      </tr>` : ''}
    </tfoot>
  </table>
</div>
<div style="text-align:center;font-size:9px;margin-top:3px">-- 1 of 1 --</div>
</body></html>`;
}

// ── Stock journal / physical stock (Family C variant) ────────────────────────

function renderStockDocument(doc: VoucherDocument, _opts: TallyRenderOptions): string {
  const company: any = doc.company || {};
  const source = (doc as any).sourceItems || doc.items?.filter((i: any) => i.direction === 'out') || [];
  const dest = (doc as any).destinationItems || doc.items?.filter((i: any) => i.direction === 'in') || [];
  const isTransfer = source.length > 0 || dest.length > 0;

  const stockTable = (label: string, rows: any[]) => `
    <div style="border-top:1px solid #000;padding:3px 6px;font-size:9.5px;font-weight:bold">${esc(label)}</div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="border:1px solid #000;padding:4px 5px;font-size:9px;text-align:left">Description of Goods</th>
        <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:110px">Godown</th>
        <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:80px">Quantity</th>
        <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:80px">Rate</th>
        <th style="border:1px solid #000;padding:4px 5px;font-size:9px;width:90px">Amount</th>
      </tr></thead>
      <tbody>${rows.length ? rows.map((r: any) => `<tr>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px">${esc(r.name || r.item || '')}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px">${esc(r.godown || r.warehouse || '')}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${qtyText(r.qty)} ${esc(r.unit || '')}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${r.rate ? num(r.rate) : ''}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px;text-align:right">${r.amount ? num(r.amount) : ''}</td>
      </tr>`).join('') : `<tr><td colspan="5" style="border:1px solid #000;height:36px"></td></tr>`}</tbody>
    </table>`;

  return `
<div style="border:1px solid #000">
  <div style="text-align:center;font-size:13px;font-weight:bold;padding:4px;border-bottom:1px solid #000">${esc(doc.tallyVoucherType || doc.layout?.title || TITLE[doc.documentType] || 'Stock Journal')}</div>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="padding:5px 6px;vertical-align:top">
        <div style="font-size:12px;font-weight:bold">${esc(company.name || '')}</div>
        <div style="font-size:9px">${lines(company.address)}</div>
      </td>
      <td style="padding:5px 6px;text-align:right;vertical-align:top;font-size:9.5px">
        <div>No. : <b>${esc(doc.documentNumber || '')}</b></div>
        <div>Dated : <b>${esc(doc.date || '')}</b></div>
      </td>
    </tr>
  </table>
  ${isTransfer
    ? stockTable('Source (Consumption)', source) + stockTable('Destination (Production)', dest)
    : stockTable('Physical Stock', doc.items || [])}
  <div style="border-top:1px solid #000;padding:4px 6px">
    <div style="font-size:9px">On Account of :</div>
    <div style="font-size:9.5px">${esc(doc.narration || '')}</div>
  </div>
  <div style="border-top:1px solid #000;padding:4px 6px;text-align:right">
    <div style="height:34px"></div>
    <div style="font-size:9px">Authorised Signatory</div>
  </div>
</div>
<div style="text-align:center;font-size:9px;margin-top:3px">-- 1 of 1 --</div>`;
}

// ── entry point ─────────────────────────────────────────────────────────────

export function renderTallyHTML(doc: VoucherDocument, opts: TallyRenderOptions = {}): string {
  let body: string;
  if (ACCOUNTING_VOUCHERS.includes(doc.documentType)) body = renderAccountingVoucher(doc, opts);
  else if (STATEMENT_DOCS.includes(doc.documentType)) body = renderStockDocument(doc, opts);
  else body = renderInvoiceGrid(doc, opts);

  const watermark = doc.isProvisional && doc.watermarkText
    ? `<div style="position:fixed;top:40%;left:0;right:0;text-align:center;font-size:52px;color:rgba(0,0,0,0.08);transform:rotate(-24deg);font-weight:bold">${esc(doc.watermarkText)}</div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:10mm}
  table{width:100%;border-collapse:collapse}
  th{font-weight:bold}
</style></head><body>${watermark}${body}</body></html>`;
}
