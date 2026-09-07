import { CommercialPrintModel } from '../CommercialPrintModel';
import { esc } from '../../voucher-print/shared';
import {
  renderPartyBlock,
  renderItemsTable,
  renderTaxSummaryTable,
  renderTotalsBlock,
  renderAmountInWords,
  renderLegalFooter,
  wrapCommercialHtmlDocument,
} from './tallyClassicCommercial';

function ledgerHeader(model: CommercialPrintModel): string {
  const c = model.company;
  const addr = [
    ...(c.addressLines || []),
    c.district ? `Distt: ${c.district}` : '',
    [c.stateName || c.state, c.stateCode ? `Code ${c.stateCode}` : ''].filter(Boolean).join(' · '),
  ].filter(Boolean);
  const numLabel = model.flags?.documentNumberLabel || 'Doc No.';

  return `
  <table style="margin-bottom:6px">
    <tr>
      <td style="vertical-align:top;width:58%">
        ${c.logoUrl ? `<img class="logo" src="${esc(c.logoUrl)}" alt=""/>` : ''}
        <div style="font-size:13px;font-weight:bold">${esc(c.name)}</div>
        ${addr.map((a) => `<div style="font-size:9px;color:#333">${esc(a)}</div>`).join('')}
        ${c.gstin ? `<div style="font-size:9px;color:#333">GSTIN: ${esc(c.gstin)}</div>` : ''}
        ${c.pan ? `<div style="font-size:9px;color:#333">PAN: ${esc(c.pan)}</div>` : ''}
        ${c.email ? `<div style="font-size:9px;color:#333">${esc(c.email)}</div>` : ''}
        ${c.phone ? `<div style="font-size:9px;color:#333">${esc(c.phone)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:12px;font-weight:bold;letter-spacing:0.4px">${esc(model.identity.title)}</div>
        <div style="font-size:9.5px;margin-top:4px">${esc(model.identity.documentNumber ? `${numLabel} ${model.identity.documentNumber}` : '')}</div>
        <div style="font-size:9.5px">${esc(model.identity.date)}</div>
      </td>
    </tr>
  </table>
  <div style="border-top:1.5px solid #000;margin:4px 0 10px"></div>`;
}

function ledgerMetaStrip(model: CommercialPrintModel): string {
  const r = model.references;
  const cells = [
    ['DATED', model.identity.date],
    ['DELIVERY NOTE', r.deliveryNoteNo],
    ['PAYMENT TERMS', r.paymentTerms],
    ['REFERENCE', [r.referenceNo, r.referenceDate].filter(Boolean).join(' / ')],
    ['ORDER', r.buyerOrderNo],
    ['SUPPLIER INV', [r.supplierInvoiceNo, r.supplierInvoiceDate].filter(Boolean).join(' / ')],
    ['ORIGINAL INV', [r.originalInvoiceNo, r.originalInvoiceDate].filter(Boolean).join(' / ')],
    ['DISPATCH DOC', r.dispatchDocNo],
    ['DESTINATION', r.destination],
    ['VEHICLE', r.motorVehicleNo],
    ['LR/RR', r.lrRrNo],
    ['TERMS', r.termsOfDelivery],
    ['E-WAY BILL', r.eWayBillNo],
    ['VALID UNTIL', r.validUntil],
    ['REASON', r.reasonForNote],
    ...(r.extra || []).map((e) => [e.label.toUpperCase(), e.value] as [string, string]),
  ].filter((entry): entry is [string, string] => !!entry[1]);

  if (!cells.length) return '';

  const chunk = (arr: [string, string][], size: number) => {
    const out: [string, string][][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const renderRow = (row: [string, string][]) =>
    `<tr>${row
      .map(
        ([label, val]) =>
          `<td style="padding:4px 6px;border:1px solid #ddd;font-size:8.5px;width:${Math.floor(100 / Math.max(row.length, 1))}%">
            <div style="color:#666;text-transform:uppercase;letter-spacing:0.3px">${esc(label)}</div>
            <div style="font-size:9.5px;font-weight:bold;margin-top:1px">${esc(val || '')}</div>
          </td>`
      )
      .join('')}</tr>`;

  return `
  <table style="width:100%;margin-bottom:10px;border-collapse:collapse">
    ${chunk(cells, 4).map(renderRow).join('')}
  </table>`;
}

function ledgerPartyRow(model: CommercialPrintModel): string {
  const parties = model.parties;
  if (!parties.length) return '';

  const cols = parties
    .map(
      (p) =>
        `<td style="vertical-align:top;width:${Math.floor(100 / parties.length)}%;padding:6px;border:1px solid #ddd">
      ${renderPartyBlock(p)}
    </td>`
    )
    .join('');

  return `<table style="width:100%;margin-bottom:10px"><tr>${cols}</tr></table>`;
}

function ledgerAccountingSummary(model: CommercialPrintModel): string {
  if (model.flags?.hideItemAmounts) return '';
  const rows = [
    model.totals.taxableValue ? ['Taxable Value', model.totals.taxableValue] : null,
    model.totals.taxAmount ? ['Tax Amount', model.totals.taxAmount] : null,
    ...model.charges.map((c) => [c.label, c.amount] as [string, string]),
    ['Grand Total', model.totals.grandTotal],
  ].filter(Boolean) as [string, string][];

  return `
  <div style="margin:8px 0;padding:8px;border:1px solid #ddd;background:#fafafa">
    <div style="font-size:9px;font-weight:bold;margin-bottom:4px;letter-spacing:0.4px">ACCOUNTING SUMMARY</div>
    <table>
      ${rows
        .map(
          ([l, v], i) =>
            `<tr>
          <td style="padding:2px 0;font-size:9px;${i === rows.length - 1 ? 'font-weight:bold' : ''}">${esc(l)}</td>
          <td style="padding:2px 0;font-size:9px;text-align:right;${i === rows.length - 1 ? 'font-weight:bold' : ''}" class="rupee">${esc(v)}</td>
        </tr>`
        )
        .join('')}
    </table>
  </div>`;
}

/** TallyDekho Ledger — Spec §13. Left company + title right, metadata strip. */
export function renderTdLedgerCommercial(model: CommercialPrintModel): string {
  const body = `
${ledgerHeader(model)}
${ledgerPartyRow(model)}
${ledgerMetaStrip(model)}
${renderItemsTable(model, { compact: true })}
${ledgerAccountingSummary(model)}
<table style="width:100%;margin-top:8px">
  <tr>
    <td style="vertical-align:top;width:55%;padding-right:8px">
      ${renderAmountInWords(model).replace(/border:1px solid #000;border-top:none;/, '')}
    </td>
    <td style="vertical-align:top;width:45%">
      ${renderTotalsBlock(model)}
    </td>
  </tr>
</table>
${renderTaxSummaryTable(model)}
${renderLegalFooter(model)}
<div class="page-footer">TallyDekho Ledger</div>`;

  return wrapCommercialHtmlDocument(body);
}
