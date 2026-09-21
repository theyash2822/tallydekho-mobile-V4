import { CommercialPrintModel } from '../CommercialPrintModel';
import { esc, formatInr } from '../../voucher-print/shared';

const CELL = 'border:1px solid #000;padding:3px 5px;font-size:9px;vertical-align:top';
const TH = `${CELL};font-weight:bold;background:#fff`;

/** Print-safe wrapper: repeating thead, keep closing block together, A4. */
export function wrapCommercialHtmlDocument(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: A4; margin: 10mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family: Arial, Helvetica, "Noto Sans", "DejaVu Sans", sans-serif;
    color:#000; background:#fff;
    padding:8mm;
    font-size:9.5px;
    line-height:1.35;
  }
  table{width:100%;border-collapse:collapse}
  thead{display:table-header-group}
  tfoot{display:table-footer-group}
  tr{page-break-inside:avoid}
  .closing{page-break-inside:avoid}
  .page-footer{text-align:center;font-size:9px;margin-top:6px;color:#444}
  .rupee{font-family: Arial, Helvetica, "Noto Sans", sans-serif}
  img.logo{max-height:48px;max-width:120px;object-fit:contain;margin-bottom:4px}
</style></head><body>${body}</body></html>`;
}

/** Shared rendering helpers for all commercial templates. */
export function renderCompanyLetterhead(model: CommercialPrintModel, centered = true): string {
  const c = model.company;
  const lines: string[] = [];
  if (c.logoUrl) {
    lines.push(`<img class="logo" src="${esc(c.logoUrl)}" alt=""/>`);
  }
  lines.push(`<div style="font-size:12px;font-weight:bold">${esc(c.name)}</div>`);
  for (const a of c.addressLines || []) {
    lines.push(`<div style="font-size:9px">${esc(a)}</div>`);
  }
  if (c.district) lines.push(`<div style="font-size:9px">Distt: ${esc(c.district)}</div>`);
  if (c.state) lines.push(`<div style="font-size:9px">${esc(c.state)}</div>`);
  if (c.stateName || c.stateCode) {
    const parts = [
      c.stateName ? `State Name : ${esc(c.stateName)}` : '',
      c.stateCode ? `Code : ${esc(c.stateCode)}` : '',
    ].filter(Boolean);
    lines.push(`<div style="font-size:9px">${parts.join(', ')}</div>`);
  }
  if (c.gstin) lines.push(`<div style="font-size:9px">GSTIN/UIN: ${esc(c.gstin)}</div>`);
  if (c.pan) lines.push(`<div style="font-size:9px">PAN: ${esc(c.pan)}</div>`);
  if (c.phone) lines.push(`<div style="font-size:9px">Phone: ${esc(c.phone)}</div>`);
  if (c.email) lines.push(`<div style="font-size:9px">E-Mail : ${esc(c.email)}</div>`);
  for (const extra of c.extraPrintLines || []) {
    lines.push(`<div style="font-size:9px">${esc(extra)}</div>`);
  }

  const align = centered ? 'center' : 'left';
  return `<div style="text-align:${align};padding:4px 0 6px">${lines.join('\n')}</div>`;
}

export function renderTitleRibbon(model: CommercialPrintModel): string {
  return `
  <div style="text-align:center;font-size:11px;font-weight:bold;letter-spacing:0.4px;padding:4px 0;border-top:1px solid #000;border-bottom:1px solid #000">
    ${esc(model.identity.title)}
  </div>`;
}

export function renderPartyBlock(party: CommercialPrintModel['parties'][number]): string {
  const lines = [
    `<div style="font-size:9px;font-weight:bold">${esc(party.label)}</div>`,
    `<div style="font-size:9.5px;font-weight:bold;margin-top:2px">${esc(party.name)}</div>`,
  ];
  for (const a of party.addressLines) {
    lines.push(`<div style="font-size:9px">${esc(a)}</div>`);
  }
  if (party.city) lines.push(`<div style="font-size:9px">${esc(party.city)}</div>`);
  if (party.state || party.stateCode) {
    lines.push(
      `<div style="font-size:9px">${[party.state, party.stateCode ? `Code: ${party.stateCode}` : ''].filter(Boolean).join(', ')}</div>`
    );
  }
  if (party.gstin) lines.push(`<div style="font-size:9px">GSTIN/UIN: ${esc(party.gstin)}</div>`);
  if (party.pan) lines.push(`<div style="font-size:9px">PAN: ${esc(party.pan)}</div>`);
  if (party.email) lines.push(`<div style="font-size:9px">E-Mail: ${esc(party.email)}</div>`);
  if (party.phone) lines.push(`<div style="font-size:9px">Phone: ${esc(party.phone)}</div>`);
  return lines.join('\n');
}

function metaCell(label: string, value?: string | null): string {
  return `<div style="font-size:8.5px;color:#333">${esc(label)}</div>
    <div style="font-size:9px;min-height:12px;font-weight:${value ? 'bold' : 'normal'}">${esc(value || '')}</div>`;
}

export function renderClassicMetaGrid(model: CommercialPrintModel): string {
  const r = model.references;
  const id = model.identity;
  const numLabel = model.flags?.documentNumberLabel || 'Invoice No.';
  const rows: string[][] = [
    [numLabel, id.documentNumber, 'e-Way Bill No.', r.eWayBillNo || ''],
    ['Dated', id.date, 'Delivery Note', r.deliveryNoteNo || ''],
    ['', '', 'Mode/Terms of Payment', r.paymentTerms || ''],
    ['Reference No. & Date.', [r.referenceNo, r.referenceDate].filter(Boolean).join(' / '), "Buyer's Order No.", r.buyerOrderNo || ''],
    ['Other References', r.otherReferences || '', 'Order Dated', r.buyerOrderDate || ''],
    ['Supplier Invoice No.', [r.supplierInvoiceNo, r.supplierInvoiceDate].filter(Boolean).join(' / '), 'Original Invoice', [r.originalInvoiceNo, r.originalInvoiceDate].filter(Boolean).join(' / ')],
    ['Dispatch Doc No.', r.dispatchDocNo || '', 'Dispatched through', r.dispatchThrough || ''],
    ['Destination', r.destination || '', 'Bill of Lading/LR-RR No.', r.lrRrNo || ''],
    ['Motor Vehicle No.', r.motorVehicleNo || '', 'Terms of Delivery', r.termsOfDelivery || ''],
    ['Valid Until', r.validUntil || '', 'Reason for Note', r.reasonForNote || ''],
  ];
  for (const ex of r.extra || []) {
    rows.push([ex.label, ex.value, '', '']);
  }

  const htmlRows = rows
    .map(
      ([l1, v1, l2, v2]) =>
        `<tr>
      <td style="${CELL};width:25%">${metaCell(l1, v1)}</td>
      <td style="${CELL};width:25%">${metaCell(l2, v2)}</td>
    </tr>`
    )
    .join('');

  return `<table style="width:100%">${htmlRows}</table>`;
}

export function renderItemsTable(
  model: CommercialPrintModel,
  opts: { showDisc?: boolean; compact?: boolean } = {}
): string {
  const hideAmt = !!model.flags?.hideItemAmounts;
  const showDisc =
    !hideAmt &&
    opts.showDisc !== false &&
    model.items.some((i) => i.discountPercent || i.discountAmount);

  const headers = ['Sl', 'Description of Goods', 'HSN/SAC', 'Quantity'];
  if (!hideAmt) {
    headers.push('Rate', 'per');
    if (showDisc) headers.push('Disc. %');
    headers.push('Amount');
  }

  const headRow = headers
    .map((h, i) => {
      const alignRight = h === 'Rate' || h === 'Amount' || h === 'Disc. %';
      return `<th style="${TH};${alignRight ? 'text-align:right' : ''}">${esc(h)}</th>`;
    })
    .join('');

  const rows = model.items
    .map((item) => {
      const qtyParts = [
        `${formatInr(item.quantity)}${item.unit ? ` ${esc(item.unit)}` : ''}`,
      ];
      if (item.secondaryQuantity) {
        qtyParts.push(
          `(${formatInr(item.secondaryQuantity)}${item.secondaryUnit ? ` ${esc(item.secondaryUnit)}` : ''})`
        );
      }
      const descLines = [esc(item.description)];
      for (const ad of item.additionalDescriptionLines || []) {
        descLines.push(`<div style="font-size:8.5px">${esc(ad)}</div>`);
      }

      const cells = [
        `<td style="${CELL};text-align:center">${item.sequence}</td>`,
        `<td style="${CELL}">${descLines.join('')}</td>`,
        `<td style="${CELL}">${esc(item.hsnSac || '')}</td>`,
        `<td style="${CELL}">${qtyParts.join('<br/>')}</td>`,
      ];
      if (!hideAmt) {
        cells.push(
          `<td style="${CELL};text-align:right">${item.rate ? formatInr(item.rate) : ''}</td>`,
          `<td style="${CELL}">${esc(item.ratePer || item.unit || '')}</td>`
        );
        if (showDisc) {
          cells.push(
            `<td style="${CELL};text-align:right">${item.discountPercent ? formatInr(item.discountPercent) : ''}</td>`
          );
        }
        cells.push(
          `<td style="${CELL};text-align:right">${formatInr(item.amount)}</td>`
        );
      }
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  const qtyTotal = model.totals.primaryQuantity
    ? `<tr>
      <td style="${CELL}" colspan="3"><b>Total</b></td>
      <td style="${CELL}"><b>${formatInr(model.totals.primaryQuantity)}${model.totals.secondaryQuantity ? `<br/><span style="font-weight:normal">(${formatInr(model.totals.secondaryQuantity)})</span>` : ''}</b></td>
      ${hideAmt ? '' : `<td style="${CELL}" colspan="${showDisc ? 3 : 2}"></td><td style="${CELL};text-align:right"><b>${formatInr(model.totals.grandTotal)}</b></td>`}
    </tr>`
    : '';

  return `
  <table style="width:100%;margin-top:0">
    <thead><tr>${headRow}</tr></thead>
    <tbody>${rows}${qtyTotal}</tbody>
  </table>`;
}

export function renderTaxSummaryTable(model: CommercialPrintModel): string {
  if (!model.taxSummary.length || model.flags?.hideItemAmounts) return '';
  const hasCess = model.taxSummary.some((t) => t.cessAmount);
  const rows = model.taxSummary
    .map(
      (t) =>
        `<tr>
      <td style="${CELL}">${esc(t.hsnSac)}</td>
      <td style="${CELL};text-align:right">${formatInr(t.taxableValue)}</td>
      <td style="${CELL};text-align:right">${t.cgstRate ? formatInr(t.cgstRate) : ''}</td>
      <td style="${CELL};text-align:right">${t.cgstAmount ? formatInr(t.cgstAmount) : ''}</td>
      <td style="${CELL};text-align:right">${t.sgstRate ? formatInr(t.sgstRate) : ''}</td>
      <td style="${CELL};text-align:right">${t.sgstAmount ? formatInr(t.sgstAmount) : ''}</td>
      <td style="${CELL};text-align:right">${t.igstRate ? formatInr(t.igstRate) : ''}</td>
      <td style="${CELL};text-align:right">${t.igstAmount ? formatInr(t.igstAmount) : ''}</td>
      ${hasCess ? `<td style="${CELL};text-align:right">${t.cessAmount ? formatInr(t.cessAmount) : ''}</td>` : ''}
      <td style="${CELL};text-align:right">${t.totalTaxAmount ? formatInr(t.totalTaxAmount) : ''}</td>
    </tr>`
    )
    .join('');

  return `
  <table style="width:100%;margin-top:6px">
    <thead><tr>
      <th style="${TH}">HSN/SAC</th>
      <th style="${TH};text-align:right">Taxable Value</th>
      <th style="${TH};text-align:right">CGST Rate</th>
      <th style="${TH};text-align:right">CGST Amt</th>
      <th style="${TH};text-align:right">SGST Rate</th>
      <th style="${TH};text-align:right">SGST Amt</th>
      <th style="${TH};text-align:right">IGST Rate</th>
      <th style="${TH};text-align:right">IGST Amt</th>
      ${hasCess ? `<th style="${TH};text-align:right">Cess</th>` : ''}
      <th style="${TH};text-align:right">Total Tax</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderTotalsBlock(model: CommercialPrintModel): string {
  if (model.flags?.hideItemAmounts) {
    return model.totals.primaryQuantity
      ? `<table style="width:100%;margin-top:4px"><tr>
          <td style="${CELL};text-align:right">Total Quantity</td>
          <td style="${CELL};text-align:right;width:90px">${formatInr(model.totals.primaryQuantity)}</td>
        </tr></table>`
      : '';
  }

  const chargeRows = model.charges
    .map(
      (c) =>
        `<tr>
      <td style="${CELL};text-align:right" colspan="2">${esc(c.label)}</td>
      <td style="${CELL};text-align:right;width:90px">${formatInr(c.amount)}</td>
    </tr>`
    )
    .join('');

  const summaryRows = [
    model.totals.taxableValue
      ? `<tr><td style="${CELL};text-align:right" colspan="2">Taxable Value</td><td style="${CELL};text-align:right">${formatInr(model.totals.taxableValue)}</td></tr>`
      : '',
    model.totals.taxAmount
      ? `<tr><td style="${CELL};text-align:right" colspan="2">Tax Amount</td><td style="${CELL};text-align:right">${formatInr(model.totals.taxAmount)}</td></tr>`
      : '',
    chargeRows,
    model.totals.primaryQuantity
      ? `<tr><td style="${CELL};text-align:right" colspan="2">Total Quantity</td><td style="${CELL};text-align:right">${formatInr(model.totals.primaryQuantity)}</td></tr>`
      : '',
    model.totals.secondaryQuantity
      ? `<tr><td style="${CELL};text-align:right" colspan="2">Secondary Qty</td><td style="${CELL};text-align:right">${formatInr(model.totals.secondaryQuantity)}</td></tr>`
      : '',
    `<tr>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;font-weight:bold;background:#000;color:#fff;text-align:right" colspan="2">Grand Total</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:10px;font-weight:bold;background:#000;color:#fff;text-align:right;width:90px" class="rupee">${formatInr(model.totals.grandTotal, true)}</td>
    </tr>`,
  ]
    .filter(Boolean)
    .join('');

  return `<table style="width:100%;margin-top:4px"><tbody>${summaryRows}</tbody></table>`;
}

export function renderAmountInWords(model: CommercialPrintModel): string {
  const eoe = model.legal.showEoe !== false ? ' E. &amp; O.E' : '';
  if (model.flags?.hideItemAmounts) {
    return `
  <div style="padding:6px;border:1px solid #000;border-top:none;font-size:9px">
    <div style="font-style:italic">Quantity note — amounts not applicable.</div>
  </div>`;
  }
  return `
  <div style="padding:6px;border:1px solid #000;border-top:none;font-size:9px">
    <div>Amount Chargeable (in words)</div>
    <div style="font-size:9.5px;font-weight:bold;margin-top:2px">${esc(model.amountInWords || '')}${eoe}</div>
    ${model.taxAmountInWords ? `<div style="margin-top:6px">Tax Amount (in words)</div><div style="font-size:9.5px;font-weight:bold;margin-top:2px">${esc(model.taxAmountInWords)}</div>` : ''}
  </div>`;
}

export function renderLegalFooter(model: CommercialPrintModel): string {
  const l = model.legal;
  const panGst = [
    l.companyPan ? `Company's PAN : ${esc(l.companyPan)}` : '',
    l.companyGstin ? `Company's GSTIN/UIN : ${esc(l.companyGstin)}` : '',
    l.buyerPan ? `Buyer's PAN : ${esc(l.buyerPan)}` : '',
  ]
    .filter(Boolean)
    .join('<br/>');

  const nonPostingNote = model.flags?.nonPostingDocument
    ? `<div style="margin-bottom:4px;font-style:italic">This document does not create an accounting posting by itself.</div>`
    : '';

  const bank = (model as any)._bankInfo as
    | { bankName?: string | null; accountNo?: string | null; ifsc?: string | null; upiId?: string | null }
    | null
    | undefined;
  const qrImage = (model as any)._qrImage as string | null | undefined;
  const bankLines = bank
    ? [
        bank.bankName ? `Bank: ${esc(bank.bankName)}` : '',
        bank.accountNo ? `A/C: ${esc(bank.accountNo)}` : '',
        bank.ifsc ? `IFSC: ${esc(bank.ifsc)}` : '',
        bank.upiId ? `UPI: ${esc(bank.upiId)}` : '',
      ].filter(Boolean)
    : [];

  return `
  <div class="closing" style="padding:6px;border:1px solid #000;border-top:none;font-size:9px">
    ${panGst ? `<div style="margin-bottom:4px">${panGst}</div>` : ''}
    ${model.narration ? `<div style="margin-bottom:4px"><b>Narration:</b> ${esc(model.narration)}</div>` : ''}
    ${model.terms ? `<div style="margin-bottom:4px"><b>Terms:</b> ${esc(model.terms)}</div>` : ''}
    ${l.declaration ? `<div style="margin-bottom:4px"><b>Declaration</b><br/>${esc(l.declaration)}</div>` : ''}
    ${nonPostingNote}
    ${l.jurisdiction ? `<div style="margin-bottom:4px;font-weight:bold">${esc(l.jurisdiction)}</div>` : ''}
    ${l.computerGeneratedText ? `<div style="margin-bottom:4px;font-style:italic">${esc(l.computerGeneratedText)}</div>` : ''}
    <table style="width:100%;margin-top:12px">
      <tr>
        <td style="vertical-align:bottom;font-size:9px;width:50%">
          ${bankLines.length ? bankLines.map((x) => `<div>${x}</div>`).join('') : ''}
          ${qrImage ? `<img src="${esc(qrImage)}" style="width:64px;height:64px;margin-top:6px;object-fit:contain"/>` : ''}
        </td>
        <td style="vertical-align:bottom;text-align:right;font-size:9px;width:50%">
          <div style="margin-bottom:28px">for <b>${esc(l.authorisedFor || model.company.name)}</b></div>
          <div style="border-top:1px solid #000;width:160px;margin-left:auto;padding-top:4px">${esc(l.authorisedSignatoryLabel || 'Authorised Signatory')}</div>
        </td>
      </tr>
    </table>
  </div>`;
}

function isPurchaseSide(t: CommercialPrintModel['identity']['documentType']): boolean {
  return t === 'PurchaseInvoice' || t === 'PurchaseOrder';
}

function docNoLabel(model: CommercialPrintModel): string {
  return model.flags?.documentNumberLabel || 'Invoice No.';
}

/** Left-column company block (matches PDF — not a centered banner). */
function renderCompanyBlockInCell(model: CommercialPrintModel): string {
  const c = model.company;
  const lines: string[] = [];
  if (c.logoUrl) lines.push(`<img class="logo" src="${esc(c.logoUrl)}" alt=""/>`);
  lines.push(`<div style="font-size:11px;font-weight:bold">${esc(c.name)}</div>`);
  for (const a of c.addressLines || []) {
    lines.push(`<div style="font-size:9px">${esc(a)}</div>`);
  }
  if (c.district) lines.push(`<div style="font-size:9px">Distt: ${esc(c.district)}</div>`);
  if (c.state) lines.push(`<div style="font-size:9px">${esc(c.state)}</div>`);
  if (c.stateName || c.stateCode) {
    lines.push(
      `<div style="font-size:9px">State Name : ${esc(c.stateName || c.state || '')}${c.stateCode ? `, Code : ${esc(c.stateCode)}` : ''}</div>`
    );
  }
  if (c.gstin) lines.push(`<div style="font-size:9px">GSTIN/UIN: ${esc(c.gstin)}</div>`);
  if (c.email) lines.push(`<div style="font-size:9px">E-Mail : ${esc(c.email)}</div>`);
  if (c.phone) lines.push(`<div style="font-size:9px">Phone: ${esc(c.phone)}</div>`);
  return `<div style="padding:4px 5px">${lines.join('\n')}</div>`;
}

function renderPartyCell(party: CommercialPrintModel['parties'][number]): string {
  return `<div style="padding:4px 5px;border-top:1px solid #000">${renderPartyBlock(party)}</div>`;
}

type MetaPair = [string, string | null | undefined, string, string | null | undefined];

function renderMetaPairsTable(pairs: MetaPair[], opts: { spacer?: boolean } = {}): string {
  return `
  <table style="width:100%;height:100%">
    ${pairs
      .map(
        ([l1, v1, l2, v2]) =>
          `<tr>
        <td style="${CELL};width:50%">${metaCell(l1, v1)}</td>
        <td style="${CELL};width:50%">${metaCell(l2, v2)}</td>
      </tr>`
      )
      .join('')}
    ${opts.spacer ? `<tr><td style="${CELL};height:48px" colspan="2"></td></tr>` : ''}
  </table>`;
}

/** Sales Invoice — full logistics meta (blank cells kept). */
function renderSalesLogisticsMeta(model: CommercialPrintModel): string {
  const r = model.references;
  const id = model.identity;
  const pairs: MetaPair[] = [
    [docNoLabel(model), id.documentNumber, 'e-Way Bill No.', r.eWayBillNo],
    ['Dated', id.date, 'Delivery Note', r.deliveryNoteNo],
    ['', '', 'Mode/Terms of Payment', r.paymentTerms],
    ['Reference No. & Date.', [r.referenceNo, r.referenceDate].filter(Boolean).join(' / ') || null, "Buyer's Order No.", r.buyerOrderNo],
    ['Other References', r.otherReferences, 'Dated', r.buyerOrderDate],
    ['Dispatch Doc No.', r.dispatchDocNo, 'Delivery Note Date', r.deliveryNoteDate],
    ['Dispatched through', r.dispatchThrough, 'Destination', r.destination],
    ['Bill of Lading/LR-RR No.', r.lrRrNo, 'Motor Vehicle No.', r.motorVehicleNo],
    ['Terms of Delivery', r.termsOfDelivery, '', ''],
  ];
  return renderMetaPairsTable(pairs);
}

/** Purchase Invoice / Purchase Order (/ SO mirror) — shorter supplier meta. */
function renderPurchaseOrderMeta(model: CommercialPrintModel): string {
  const r = model.references;
  const id = model.identity;
  const pairs: MetaPair[] = [
    [docNoLabel(model), id.documentNumber, 'e-Way Bill No.', r.eWayBillNo],
    ['Dated', id.date, 'Supplier Invoice No. & Date.', [r.supplierInvoiceNo, r.supplierInvoiceDate].filter(Boolean).join('  dt. ') || null],
    ['Other References', r.otherReferences, '', ''],
  ];
  // Sales Order: show buyer order style extras if present
  if (model.identity.documentType === 'SalesOrder') {
    pairs.push(
      ["Buyer's Order No.", r.buyerOrderNo, 'Order Dated', r.buyerOrderDate],
      ['Dispatch Doc No.', r.dispatchDocNo, 'Destination', r.destination]
    );
  }
  return renderMetaPairsTable(pairs, { spacer: true });
}

/** Credit Note / Debit Note — original invoice + reason. */
function renderNoteMeta(model: CommercialPrintModel): string {
  const r = model.references;
  const id = model.identity;
  const orig = [r.originalInvoiceNo, r.originalInvoiceDate].filter(Boolean).join(' / ') || null;
  const pairs: MetaPair[] = [
    [docNoLabel(model), id.documentNumber, 'Original Invoice No. & Date', orig],
    ['Dated', id.date, 'Reason for Note', r.reasonForNote],
    ['Other References', r.otherReferences, '', ''],
  ];
  return renderMetaPairsTable(pairs, { spacer: true });
}

/** Proforma Invoice / Quotation — validity + payment terms. */
function renderQuoteProformaMeta(model: CommercialPrintModel): string {
  const r = model.references;
  const id = model.identity;
  const pairs: MetaPair[] = [
    [docNoLabel(model), id.documentNumber, 'Valid Until', r.validUntil],
    ['Dated', id.date, 'Mode/Terms of Payment', r.paymentTerms],
    ['Other References', r.otherReferences, '', ''],
  ];
  if (r.buyerOrderNo || r.buyerOrderDate) {
    pairs.push(["Buyer's Order No.", r.buyerOrderNo, 'Order Dated', r.buyerOrderDate]);
  }
  return renderMetaPairsTable(pairs, { spacer: true });
}

/** Delivery / Receipt Note — shorter logistics meta. */
function renderDeliveryNoteMeta(model: CommercialPrintModel): string {
  const r = model.references;
  const id = model.identity;
  const pairs: MetaPair[] = [
    [docNoLabel(model), id.documentNumber, 'Dispatch Doc No.', r.dispatchDocNo],
    ['Dated', id.date, 'Dispatched through', r.dispatchThrough],
    ['Destination', r.destination, 'Motor Vehicle No.', r.motorVehicleNo],
    ['Delivery Note Date', r.deliveryNoteDate || id.date, '', ''],
  ];
  return renderMetaPairsTable(pairs, { spacer: true });
}

function renderTallyPrimeMeta(model: CommercialPrintModel): string {
  switch (model.identity.documentType) {
    case 'SalesInvoice':
      return renderSalesLogisticsMeta(model);
    case 'PurchaseInvoice':
    case 'PurchaseOrder':
    case 'SalesOrder':
      return renderPurchaseOrderMeta(model);
    case 'CreditNote':
    case 'DebitNote':
      return renderNoteMeta(model);
    case 'ProformaInvoice':
    case 'Quotation':
      return renderQuoteProformaMeta(model);
    case 'DeliveryNote':
    case 'ReceiptNote':
      return renderDeliveryNoteMeta(model);
    default:
      return renderSalesLogisticsMeta(model);
  }
}

function aggregateTaxLines(model: CommercialPrintModel): Array<{ label: string; rate?: string | null; amount: string }> {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let cgstRate: string | null = null;
  let sgstRate: string | null = null;
  let igstRate: string | null = null;
  for (const t of model.taxSummary) {
    if (t.cgstAmount) {
      cgst += parseFloat(String(t.cgstAmount).replace(/,/g, '')) || 0;
      cgstRate = t.cgstRate || cgstRate;
    }
    if (t.sgstAmount) {
      sgst += parseFloat(String(t.sgstAmount).replace(/,/g, '')) || 0;
      sgstRate = t.sgstRate || sgstRate;
    }
    if (t.igstAmount) {
      igst += parseFloat(String(t.igstAmount).replace(/,/g, '')) || 0;
      igstRate = t.igstRate || igstRate;
    }
  }
  const out: Array<{ label: string; rate?: string | null; amount: string }> = [];
  if (cgst) out.push({ label: 'CGST', rate: cgstRate, amount: moneyFromNumber(cgst) });
  if (sgst) out.push({ label: 'SGST', rate: sgstRate, amount: moneyFromNumber(sgst) });
  if (igst) out.push({ label: 'IGST', rate: igstRate, amount: moneyFromNumber(igst) });
  return out;
}

/** Import moneyFromNumber for tax line formatting — use format path via string. */
function moneyFromNumber(n: number): string {
  const abs = Math.abs(n);
  const cents = Math.round(abs * 100);
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  return `${n < 0 ? '-' : ''}${whole}.${frac}`;
}

/**
 * Tally Prime item table: always HSN + Disc % (when amounts shown), tax/charge lines under goods, total row.
 * Respects model.flags.hideItemAmounts (e.g. non-valued Delivery Note).
 */
function renderTallyPrimeItemsTable(model: CommercialPrintModel): string {
  const hideAmt = !!model.flags?.hideItemAmounts;
  const headers = hideAmt
    ? ['Sl', 'Description of Goods', 'HSN/SAC', 'Quantity']
    : ['Sl', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Disc. %', 'Amount'];
  const colCount = headers.length;

  const head = headers
    .map((h, i) => {
      const right =
        h === 'Quantity' || h === 'Rate' || h === 'Disc. %' || h === 'Amount';
      return `<th style="${TH};${right ? 'text-align:right' : ''}">${esc(h)}</th>`;
    })
    .join('');

  const itemRows = model.items
    .map((item) => {
      const qtyParts = [
        `${formatInr(item.quantity)}${item.unit ? ` ${esc(item.unit)}` : ''}`,
      ];
      if (item.secondaryQuantity) {
        qtyParts.push(
          `(${formatInr(item.secondaryQuantity)}${item.secondaryUnit ? ` ${esc(item.secondaryUnit)}` : ''})`
        );
      }
      const desc = [esc(item.description)];
      for (const ad of item.additionalDescriptionLines || []) {
        desc.push(`<div style="font-size:8.5px">${esc(ad)}</div>`);
      }
      const cells = [
        `<td style="${CELL};text-align:center">${item.sequence}</td>`,
        `<td style="${CELL}">${desc.join('')}</td>`,
        `<td style="${CELL};text-align:center">${esc(item.hsnSac || '')}</td>`,
        `<td style="${CELL};text-align:right">${qtyParts.join('<br/>')}</td>`,
      ];
      if (!hideAmt) {
        cells.push(
          `<td style="${CELL};text-align:right">${item.rate ? formatInr(item.rate) : ''}</td>`,
          `<td style="${CELL}">${esc(item.ratePer || item.unit || '')}</td>`,
          `<td style="${CELL};text-align:right">${item.discountPercent ? formatInr(item.discountPercent) + ' %' : ''}</td>`,
          `<td style="${CELL};text-align:right">${formatInr(item.amount)}</td>`
        );
      }
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  const taxLines = hideAmt ? [] : aggregateTaxLines(model);
  const ledgerRows = hideAmt
    ? ''
    : [
        ...taxLines.map(
          (t) => `<tr>
      <td style="${CELL}"></td>
      <td style="${CELL}">${esc(t.label)}</td>
      <td style="${CELL}"></td>
      <td style="${CELL}"></td>
      <td style="${CELL};text-align:right">${t.rate ? formatInr(t.rate) : ''}</td>
      <td style="${CELL}">${t.rate ? '%' : ''}</td>
      <td style="${CELL}"></td>
      <td style="${CELL};text-align:right">${formatInr(t.amount)}</td>
    </tr>`
        ),
        ...model.charges.map(
          (c) => `<tr>
      <td style="${CELL}"></td>
      <td style="${CELL};text-align:right">${esc(c.label)}</td>
      <td style="${CELL}"></td>
      <td style="${CELL}"></td>
      <td style="${CELL}"></td>
      <td style="${CELL}"></td>
      <td style="${CELL};text-align:right">${c.rate ? formatInr(c.rate) + ' %' : ''}</td>
      <td style="${CELL};text-align:right">${formatInr(c.amount)}</td>
    </tr>`
        ),
      ].join('');

  // Spacer so few items still look Tally-like
  const spacer =
    model.items.length < 4
      ? `<tr><td style="${CELL};height:${Math.max(24, 80 - model.items.length * 18)}px" colspan="${colCount}"></td></tr>`
      : '';

  const totalRow = hideAmt
    ? `<tr>
    <td style="${CELL}" colspan="2"><b>Total</b></td>
    <td style="${CELL}"></td>
    <td style="${CELL};text-align:right"><b>${model.totals.primaryQuantity ? formatInr(model.totals.primaryQuantity) + ' nos' : ''}</b></td>
  </tr>`
    : `<tr>
    <td style="${CELL}" colspan="2"><b>Total</b></td>
    <td style="${CELL}"></td>
    <td style="${CELL};text-align:right"><b>${model.totals.primaryQuantity ? formatInr(model.totals.primaryQuantity) + ' nos' : ''}</b></td>
    <td style="${CELL}" colspan="3"></td>
    <td style="${CELL};text-align:right"><b class="rupee">${formatInr(model.totals.grandTotal, true)}</b></td>
  </tr>`;

  return `
  <table style="width:100%;border-top:1px solid #000">
    <thead><tr>${head}</tr></thead>
    <tbody>
      ${itemRows}
      ${spacer}
      ${ledgerRows}
      ${totalRow}
    </tbody>
  </table>`;
}

function renderTallyPrimeWords(model: CommercialPrintModel): string {
  if (model.flags?.hideItemAmounts) {
    return `
  <table style="width:100%">
    <tr>
      <td style="${CELL}">
        <div style="font-size:9px;font-style:italic">Quantity note — amounts not applicable.</div>
      </td>
    </tr>
  </table>`;
  }
  return `
  <table style="width:100%">
    <tr>
      <td style="${CELL}">
        <div style="font-size:9px">Amount Chargeable (in words)</div>
        <div style="font-size:9.5px;font-weight:bold;margin-top:2px">${esc(model.amountInWords || '')}</div>
      </td>
      <td style="${CELL};width:70px;text-align:right;vertical-align:top;font-size:9px">E. &amp; O.E</td>
    </tr>
  </table>`;
}

/** Sales sample: simple HSN + Taxable Value (+ tax words). */
function renderTallyPrimeHsnSimple(model: CommercialPrintModel): string {
  if (!model.taxSummary.length) {
    return model.taxAmountInWords
      ? `<div style="padding:4px 6px;border:1px solid #000;border-top:none;font-size:9px">Tax Amount (in words) : <b>${esc(model.taxAmountInWords)}</b></div>`
      : '';
  }
  const rows = model.taxSummary
    .map(
      (t) =>
        `<tr>
      <td style="${CELL}">${esc(t.hsnSac)}</td>
      <td style="${CELL};text-align:right">${formatInr(t.taxableValue)}</td>
    </tr>`
    )
    .join('');
  const taxableSum = model.totals.taxableValue || model.taxSummary[0]?.taxableValue || '';
  return `
  <table style="width:100%">
    <thead><tr>
      <th style="${TH}">HSN/SAC</th>
      <th style="${TH};text-align:right">Taxable Value</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr>
        <td style="${CELL}"><b>Total</b></td>
        <td style="${CELL};text-align:right"><b>${formatInr(taxableSum)}</b></td>
      </tr>
    </tbody>
  </table>
  ${model.taxAmountInWords ? `<div style="padding:4px 6px;border:1px solid #000;border-top:none;font-size:9px">Tax Amount (in words) : <b>${esc(model.taxAmountInWords)}</b></div>` : ''}`;
}

function renderTallyPrimeFooter(model: CommercialPrintModel): string {
  const l = model.legal;
  const purchase = isPurchaseSide(model.identity.documentType);
  const idLines = purchase
    ? [
        l.companyGstin ? `Company's GSTIN/UIN : ${esc(l.companyGstin)}` : '',
        l.buyerPan ? `Buyer's PAN : ${esc(l.buyerPan)}` : '',
      ]
    : [
        l.companyPan ? `Company's PAN : ${esc(l.companyPan)}` : '',
        l.declaration ? '' : '',
      ];

  const bank = (model as any)._bankInfo as
    | { bankName?: string | null; accountNo?: string | null; ifsc?: string | null; upiId?: string | null }
    | null
    | undefined;
  const qrImage = (model as any)._qrImage as string | null | undefined;
  const bankLines = bank
    ? [
        bank.bankName ? `Bank: ${esc(bank.bankName)}` : '',
        bank.accountNo ? `A/C: ${esc(bank.accountNo)}` : '',
        bank.ifsc ? `IFSC: ${esc(bank.ifsc)}` : '',
        bank.upiId ? `UPI: ${esc(bank.upiId)}` : '',
      ].filter(Boolean)
    : [];

  const nonPostingNote = model.flags?.nonPostingDocument
    ? `<div style="margin-top:4px;font-style:italic">This document does not create an accounting posting by itself.</div>`
    : '';

  return `
  <div class="closing" style="border:1px solid #000;border-top:none">
    <table style="width:100%">
      <tr>
        <td style="vertical-align:top;padding:6px;width:58%;font-size:9px;border-right:1px solid #000">
          ${idLines.filter(Boolean).map((x) => `<div>${x}</div>`).join('')}
          ${!purchase && l.declaration ? `<div style="margin-top:6px"><b>Declaration</b><div style="margin-top:2px">${esc(l.declaration)}</div></div>` : ''}
          ${model.narration ? `<div style="margin-top:4px"><b>Narration:</b> ${esc(model.narration)}</div>` : ''}
          ${model.terms ? `<div style="margin-top:4px"><b>Terms:</b> ${esc(model.terms)}</div>` : ''}
          ${nonPostingNote}
          ${bankLines.map((x) => `<div>${x}</div>`).join('')}
          ${qrImage ? `<img src="${esc(qrImage)}" style="width:64px;height:64px;margin-top:6px;object-fit:contain"/>` : ''}
        </td>
        <td style="vertical-align:bottom;text-align:right;padding:6px;width:42%;font-size:9px">
          <div style="margin-bottom:36px">for <b>${esc(l.authorisedFor || model.company.name)}</b></div>
          <div style="border-top:1px solid #000;padding-top:4px">${esc(l.authorisedSignatoryLabel || 'Authorised Signatory')}</div>
        </td>
      </tr>
    </table>
    ${l.jurisdiction ? `<div style="text-align:center;font-size:9px;font-weight:bold;padding:3px;border-top:1px solid #000">${esc(l.jurisdiction)}</div>` : ''}
    ${l.computerGeneratedText ? `<div style="text-align:center;font-size:9px;font-style:italic;padding:3px;border-top:1px solid #000">${esc(l.computerGeneratedText)}</div>` : ''}
  </div>`;
}

function renderTallyPrimeCoreLayout(model: CommercialPrintModel): string {
  const leftStack = [
    renderCompanyBlockInCell(model),
    ...model.parties.map(renderPartyCell),
  ].join('');

  const body = `
<div style="border:1px solid #000">
  ${renderTitleRibbon(model)}
  <table style="width:100%;border-top:1px solid #000">
    <tr>
      <td style="width:50%;vertical-align:top;padding:0;border-right:1px solid #000">${leftStack}</td>
      <td style="width:50%;vertical-align:top;padding:0">${renderTallyPrimeMeta(model)}</td>
    </tr>
  </table>
  ${renderTallyPrimeItemsTable(model)}
  ${renderTallyPrimeWords(model)}
  ${model.identity.documentType === 'SalesInvoice' && !model.flags?.hideItemAmounts ? renderTallyPrimeHsnSimple(model) : ''}
  ${renderTallyPrimeFooter(model)}
</div>`;

  return wrapCommercialHtmlDocument(body);
}

/** Tally Classic — Spec §12. All commercial types use Tally Prime core layout. */
export function renderTallyClassicCommercial(model: CommercialPrintModel): string {
  return renderTallyPrimeCoreLayout(model);
}
