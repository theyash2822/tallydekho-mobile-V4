import { CommercialPrintModel } from '../CommercialPrintModel';
import { esc, formatInr } from '../../voucher-print/shared';
import {
  renderPartyBlock,
  renderItemsTable,
  renderTaxSummaryTable,
  renderTotalsBlock,
  renderAmountInWords,
  wrapCommercialHtmlDocument,
} from './tallyClassicCommercial';

function executiveHeader(model: CommercialPrintModel): string {
  const c = model.company;
  const line2 = [
    ...(c.addressLines || []).slice(0, 2),
    c.district,
  ].filter(Boolean).join(' · ');
  const line3 = [c.state || c.stateName, c.stateCode].filter(Boolean).join(' ');

  return `
  <table>
    <tr>
      <td style="vertical-align:top">
        ${c.logoUrl ? `<img class="logo" src="${esc(c.logoUrl)}" alt=""/>` : ''}
        <div style="font-size:14px;font-weight:bold">${esc(c.name)}</div>
        ${line2 ? `<div style="font-size:9px;color:#444;margin-top:2px">${esc(line2)}</div>` : ''}
        ${line3 ? `<div style="font-size:9px;color:#444">${esc(line3)}</div>` : ''}
        ${c.gstin ? `<div style="font-size:9px;color:#444">GSTIN ${esc(c.gstin)}</div>` : ''}
        ${c.pan ? `<div style="font-size:9px;color:#444">PAN ${esc(c.pan)}</div>` : ''}
        ${c.email ? `<div style="font-size:9px;color:#444">${esc(c.email)}</div>` : ''}
        ${c.phone ? `<div style="font-size:9px;color:#444">${esc(c.phone)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right;font-size:13px;font-weight:bold;letter-spacing:0.6px">
        ${esc(model.identity.title)}
      </td>
    </tr>
  </table>
  <div style="border-top:1px solid #000;margin:8px 0"></div>`;
}

function executiveMetaStrip(model: CommercialPrintModel): string {
  const r = model.references;
  const numLabel = (model.flags?.documentNumberLabel || 'DOC NO.').toUpperCase();
  const items: [string, string | null | undefined][] = [
    [numLabel, model.identity.documentNumber],
    ['DATE', model.identity.date],
    ['DELIVERY NOTE', r.deliveryNoteNo],
    ['E-WAY BILL', r.eWayBillNo],
  ];

  return `
  <table style="width:100%;margin-bottom:12px">
    <tr>
      ${items
        .map(
          ([label, val]) =>
            `<td style="width:25%;padding:4px 8px 4px 0">
          <div style="font-size:8px;color:#777;text-transform:uppercase;letter-spacing:0.4px">${esc(label)}</div>
          <div style="font-size:10.5px;font-weight:bold;margin-top:2px">${esc(val || '—')}</div>
        </td>`
        )
        .join('')}
    </tr>
  </table>
  <div style="border-top:1px solid #000;margin-bottom:12px"></div>`;
}

function executiveLogisticsGrid(model: CommercialPrintModel): string {
  const r = model.references;
  const fields = [
    ['Reference', [r.referenceNo, r.referenceDate].filter(Boolean).join(' / ')],
    ['Payment Terms', r.paymentTerms],
    ['Order', r.buyerOrderNo],
    ['Supplier Invoice', [r.supplierInvoiceNo, r.supplierInvoiceDate].filter(Boolean).join(' / ')],
    ['Dispatch', r.dispatchDocNo],
    ['LR/RR', r.lrRrNo],
    ['Destination', r.destination],
    ['Vehicle', r.motorVehicleNo],
    ['Delivery Terms', r.termsOfDelivery],
    ['Expected Delivery', r.expectedDeliveryDate],
    ['Valid Until', r.validUntil],
    ['Original Invoice', [r.originalInvoiceNo, r.originalInvoiceDate].filter(Boolean).join(' / ')],
    ['Reason', r.reasonForNote],
    ...(r.extra || []).map((e) => [e.label, e.value] as [string, string]),
  ].filter((entry): entry is [string, string] => !!entry[1]);

  if (!fields.length) return '';

  return `
  <table style="width:100%;margin-bottom:12px">
    ${fields
      .map(
        ([label, val]) =>
          `<tr>
        <td style="font-size:8px;color:#777;text-transform:uppercase;width:28%;padding:2px 0">${esc(label)}</td>
        <td style="font-size:9.5px;padding:2px 0">${esc(val || '')}</td>
      </tr>`
      )
      .join('')}
  </table>`;
}

function executivePartyRow(model: CommercialPrintModel): string {
  const parties = model.parties;
  if (!parties.length) return '';

  return `
  <table style="width:100%;margin-bottom:12px">
    <tr>
      ${parties
        .map(
          (p) =>
            `<td style="vertical-align:top;width:${Math.floor(100 / parties.length)}%;padding-right:12px">
          ${renderPartyBlock(p)}
        </td>`
        )
        .join('')}
    </tr>
  </table>
  <div style="border-top:1px solid #eee;margin-bottom:12px"></div>`;
}

function executiveAmountSummary(model: CommercialPrintModel): string {
  if (model.flags?.hideItemAmounts) return '';
  return `
  <div style="margin:10px 0;padding:10px 0;border-top:1px solid #000;border-bottom:1px solid #000">
    <table>
      <tr>
        <td style="font-size:10px">Amount Chargeable</td>
        <td style="font-size:12px;font-weight:bold;text-align:right" class="rupee">${formatInr(model.totals.grandTotal, true)}</td>
      </tr>
      <tr>
        <td colspan="2" style="font-size:9px;padding-top:4px">${esc(model.amountInWords || '')}</td>
      </tr>
      ${model.taxAmountInWords ? `<tr><td colspan="2" style="font-size:9px;padding-top:2px">Tax: ${esc(model.taxAmountInWords)}</td></tr>` : ''}
    </table>
  </div>`;
}

/**
 * Closing block — bank + QR parity with Classic / Thermal
 * (from voucher-config Default Bank + QR settings).
 */
function executiveClosing(model: CommercialPrintModel): string {
  const l = model.legal;
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

  return `
  <div class="closing" style="margin-top:12px;padding:10px 0 0;border-top:1px solid #000;font-size:9px">
    ${panGst ? `<div style="margin-bottom:6px;color:#444">${panGst}</div>` : ''}
    ${model.narration ? `<div style="margin-bottom:4px"><b>Narration:</b> ${esc(model.narration)}</div>` : ''}
    ${model.terms ? `<div style="margin-bottom:4px"><b>Terms:</b> ${esc(model.terms)}</div>` : ''}
    ${l.declaration ? `<div style="margin-bottom:4px"><b>Declaration</b><br/>${esc(l.declaration)}</div>` : ''}
    ${nonPostingNote}
    ${l.jurisdiction ? `<div style="margin-bottom:4px;font-weight:bold">${esc(l.jurisdiction)}</div>` : ''}
    ${l.computerGeneratedText ? `<div style="margin-bottom:4px;font-style:italic;color:#555">${esc(l.computerGeneratedText)}</div>` : ''}
    <table style="width:100%;margin-top:14px">
      <tr>
        <td style="vertical-align:bottom;font-size:9px;width:50%;padding-right:12px">
          ${bankLines.length ? bankLines.map((x) => `<div style="margin-bottom:2px">${x}</div>`).join('') : ''}
          ${qrImage ? `<img src="${esc(qrImage)}" style="width:64px;height:64px;margin-top:8px;object-fit:contain"/>` : ''}
        </td>
        <td style="vertical-align:bottom;text-align:right;font-size:9px;width:50%">
          <div style="margin-bottom:28px">for <b>${esc(l.authorisedFor || model.company.name)}</b></div>
          <div style="border-top:1px solid #000;width:160px;margin-left:auto;padding-top:4px">${esc(l.authorisedSignatoryLabel || 'Authorised Signatory')}</div>
        </td>
      </tr>
    </table>
  </div>`;
}

/** TallyDekho Executive — Spec §14. Premium spacing, metadata strip. */
export function renderTdExecutiveCommercial(model: CommercialPrintModel): string {
  const body = `
${executiveHeader(model)}
${executiveMetaStrip(model)}
${executivePartyRow(model)}
${executiveLogisticsGrid(model)}
${renderItemsTable(model)}
${executiveAmountSummary(model)}
<table style="width:100%;margin-top:10px">
  <tr>
    <td style="vertical-align:top;width:52%;padding-right:12px">
      ${renderAmountInWords(model).replace(/border:1px solid #000;border-top:none;/, '')}
    </td>
    <td style="vertical-align:top;width:48%">
      ${renderTotalsBlock(model)}
    </td>
  </tr>
</table>
${renderTaxSummaryTable(model)}
${executiveClosing(model)}
<div class="page-footer">TallyDekho Executive</div>`;

  return wrapCommercialHtmlDocument(body);
}
