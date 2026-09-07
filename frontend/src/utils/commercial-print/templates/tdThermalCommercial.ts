/**
 * TallyDekho Thermal — commercial PDF (td_thermal_commercial_v1).
 * Spec §13: stacked reflow from CommercialPrintModel.
 */
import { CommercialPrintModel } from '../CommercialPrintModel';
import { esc, formatInr } from '../../voucher-print/shared';
import {
  ThermalPaperWidth,
  DEFAULT_THERMAL_PAPER_WIDTH,
  thermalDash,
  thermalDouble,
  wrapThermalHtml,
} from '../../pdf/thermalShared';

export function renderTdThermalCommercial(
  model: CommercialPrintModel,
  opts: { paperWidth?: ThermalPaperWidth } = {}
): string {
  const w = opts.paperWidth ?? DEFAULT_THERMAL_PAPER_WIDTH;
  return wrapThermalHtml(renderBody(model, w), { paperWidth: w });
}

function sep(w: ThermalPaperWidth): string {
  return `<div class="sep">${thermalDash(w)}</div>`;
}
function dbl(w: ThermalPaperWidth): string {
  return `<div class="sep">${thermalDouble(w)}</div>`;
}

function kv(label: string, value?: string | null): string {
  if (!value) return '';
  return `<div class="row"><span class="muted">${esc(label)}</span><span class="b">${esc(value)}</span></div>`;
}

function renderBody(model: CommercialPrintModel, w: ThermalPaperWidth): string {
  const c = model.company;
  const id = model.identity;
  const r = model.references;
  const hideAmt = !!model.flags?.hideItemAmounts;

  const company: string[] = [];
  company.push(`<div class="c b" style="font-size:${w === 58 ? '11px' : '12px'}">${esc(c.name)}</div>`);
  for (const a of c.addressLines || []) company.push(`<div class="c muted">${esc(a)}</div>`);
  if (c.district) company.push(`<div class="c muted">Distt: ${esc(c.district)}</div>`);
  if (c.stateName || c.state || c.stateCode) {
    company.push(
      `<div class="c muted">${esc([c.stateName || c.state, c.stateCode ? `(${c.stateCode})` : ''].filter(Boolean).join(' '))}</div>`
    );
  }
  if (c.gstin) company.push(`<div class="c muted">GSTIN: ${esc(c.gstin)}</div>`);
  if (c.email) company.push(`<div class="c muted">E-Mail: ${esc(c.email)}</div>`);
  if (c.phone) company.push(`<div class="c muted">Phone: ${esc(c.phone)}</div>`);

  const parties = (model.parties || [])
    .map((p) => {
      const lines = [
        `<div class="b">${esc(p.label)}</div>`,
        `<div class="b">${esc(p.name)}</div>`,
        ...(p.addressLines || []).map((a) => `<div class="muted">${esc(a)}</div>`),
        p.state || p.stateCode
          ? `<div class="muted">${esc([p.state, p.stateCode].filter(Boolean).join(' - '))}</div>`
          : '',
        p.gstin ? `<div class="muted">GSTIN: ${esc(p.gstin)}</div>` : '',
        p.pan ? `<div class="muted">PAN: ${esc(p.pan)}</div>` : '',
        p.phone ? `<div class="muted">Phone: ${esc(p.phone)}</div>` : '',
      ].filter(Boolean);
      return `<div style="margin:6px 0">${lines.join('')}</div>`;
    })
    .join(sep(w));

  const metaBits = [
    kv(model.flags?.documentNumberLabel || 'No.', id.documentNumber),
    kv('Date', id.date),
    kv('e-Way Bill', r.eWayBillNo),
    kv('Payment Terms', r.paymentTerms),
    kv('Reference', [r.referenceNo, r.referenceDate].filter(Boolean).join(' / ') || null),
    kv("Buyer's Order", [r.buyerOrderNo, r.buyerOrderDate].filter(Boolean).join(' / ') || null),
    kv('Supplier Inv.', [r.supplierInvoiceNo, r.supplierInvoiceDate].filter(Boolean).join(' / ') || null),
    kv('Original Inv.', [r.originalInvoiceNo, r.originalInvoiceDate].filter(Boolean).join(' / ') || null),
    kv('Reason', r.reasonForNote),
    kv('Valid Until', r.validUntil),
    kv('Dispatch Doc', r.dispatchDocNo),
    kv('Dispatched through', r.dispatchThrough),
    kv('Destination', r.destination),
    kv('Vehicle', r.motorVehicleNo),
    kv('LR/RR', r.lrRrNo),
    kv('Terms of Delivery', r.termsOfDelivery),
    kv('Other Refs', r.otherReferences),
  ].filter(Boolean);
  for (const x of r.extra || []) {
    const bit = kv(x.label, x.value);
    if (bit) metaBits.push(bit);
  }
  const meta = metaBits.join('');

  const items = (model.items || [])
    .map((it) => {
      const bits: string[] = [
        `<div class="b">${it.sequence}. ${esc(it.description)}</div>`,
      ];
      for (const ad of it.additionalDescriptionLines || []) {
        bits.push(`<div class="muted">${esc(ad)}</div>`);
      }
      if (it.hsnSac) bits.push(`<div>HSN/SAC: ${esc(it.hsnSac)}</div>`);
      bits.push(
        `<div>Qty: ${formatInr(it.quantity)}${it.unit ? ` ${esc(it.unit)}` : ''}</div>`
      );
      if (it.secondaryQuantity) {
        bits.push(
          `<div>Alt Qty: ${formatInr(it.secondaryQuantity)}${it.secondaryUnit ? ` ${esc(it.secondaryUnit)}` : ''}</div>`
        );
      }
      if (!hideAmt) {
        if (it.rate) {
          bits.push(
            `<div>Rate: ${formatInr(it.rate)}${it.ratePer || it.unit ? ` / ${esc(it.ratePer || it.unit || '')}` : ''}</div>`
          );
        }
        if (it.discountPercent) bits.push(`<div>Discount: ${formatInr(it.discountPercent)}%</div>`);
        if (it.discountAmount) bits.push(`<div>Disc Amt: ${formatInr(it.discountAmount)}</div>`);
        bits.push(`<div class="row"><span>Amount</span><span class="b">${formatInr(it.amount)}</span></div>`);
      }
      return `<div style="margin:8px 0">${bits.join('')}${sep(w)}</div>`;
    })
    .join('');

  let cgst = 0,
    sgst = 0,
    igst = 0,
    cess = 0;
  for (const t of model.taxSummary || []) {
    cgst += parseFloat(String(t.cgstAmount || '').replace(/,/g, '')) || 0;
    sgst += parseFloat(String(t.sgstAmount || '').replace(/,/g, '')) || 0;
    igst += parseFloat(String(t.igstAmount || '').replace(/,/g, '')) || 0;
    cess += parseFloat(String(t.cessAmount || '').replace(/,/g, '')) || 0;
  }
  const taxLines: string[] = [];
  if (model.totals.taxableValue && !hideAmt) {
    taxLines.push(
      `<div class="row"><span>Taxable</span><span>${formatInr(model.totals.taxableValue)}</span></div>`
    );
  }
  if (cgst) taxLines.push(`<div class="row"><span>CGST</span><span>${formatInr(String(cgst.toFixed(2)))}</span></div>`);
  if (sgst) taxLines.push(`<div class="row"><span>SGST</span><span>${formatInr(String(sgst.toFixed(2)))}</span></div>`);
  if (igst) taxLines.push(`<div class="row"><span>IGST</span><span>${formatInr(String(igst.toFixed(2)))}</span></div>`);
  if (cess) taxLines.push(`<div class="row"><span>CESS</span><span>${formatInr(String(cess.toFixed(2)))}</span></div>`);

  const charges = (model.charges || [])
    .map(
      (ch) =>
        `<div class="row"><span>${esc(ch.label)}</span><span>${formatInr(ch.amount)}</span></div>`
    )
    .join('');

  const hsnSimple = (model.taxSummary || [])
    .map((t) => {
      const taxParts = [
        t.cgstAmount ? `C:${formatInr(t.cgstAmount)}` : '',
        t.sgstAmount ? `S:${formatInr(t.sgstAmount)}` : '',
        t.igstAmount ? `I:${formatInr(t.igstAmount)}` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<div style="margin:2px 0"><div class="row"><span>HSN ${esc(t.hsnSac)}</span><span>${formatInr(t.taxableValue)}</span></div>${taxParts ? `<div class="muted">${taxParts}</div>` : ''}</div>`;
    })
    .join('');

  const l = model.legal;
  const bank = (model as any)._bankInfo as
    | { bankName?: string; accountNo?: string; ifsc?: string; upiId?: string }
    | null
    | undefined;
  const qrImage = (model as any)._qrImage as string | null | undefined;

  const qtyFooter =
    model.totals.primaryQuantity || model.totals.secondaryQuantity
      ? `<div class="row"><span>Total Qty</span><span>${[
          model.totals.primaryQuantity ? formatInr(model.totals.primaryQuantity) : '',
          model.totals.secondaryQuantity ? formatInr(model.totals.secondaryQuantity) : '',
        ]
          .filter(Boolean)
          .join(' / ')}</span></div>`
      : '';

  return `
${company.join('\n')}
${sep(w)}
<div class="c b" style="font-size:${w === 58 ? '11px' : '12px'};letter-spacing:0.4px">${esc(id.title)}</div>
${model.flags?.nonPostingDocument ? `<div class="c muted">(Non-posting document)</div>` : ''}
${hideAmt ? `<div class="c muted">(Item amounts not applicable)</div>` : ''}
${sep(w)}
${meta}
${sep(w)}
${parties}
${sep(w)}
${items}
${qtyFooter}
${!hideAmt ? taxLines.join('') : ''}
${!hideAmt ? charges : ''}
${!hideAmt ? `<div class="row b" style="margin-top:4px"><span>TOTAL</span><span>${formatInr(model.totals.grandTotal, true)}</span></div>` : ''}
${dbl(w)}
${model.amountInWords && !hideAmt ? `<div class="muted">Amount Chargeable (in words)</div><div class="b">${esc(model.amountInWords)}</div>` : ''}
${hsnSimple ? `${sep(w)}<div class="b">HSN Summary</div>${hsnSimple}` : ''}
${model.taxAmountInWords ? `<div style="margin-top:4px">Tax Amount (in words): <b>${esc(model.taxAmountInWords)}</b></div>` : ''}
${sep(w)}
${l.companyGstin ? `<div>Company's GSTIN: ${esc(l.companyGstin)}</div>` : ''}
${l.companyPan ? `<div>Company's PAN: ${esc(l.companyPan)}</div>` : ''}
${l.buyerPan ? `<div>Buyer's PAN: ${esc(l.buyerPan)}</div>` : ''}
${l.declaration ? `<div style="margin-top:4px"><b>Declaration</b><div>${esc(l.declaration)}</div></div>` : ''}
${model.narration ? `<div style="margin-top:4px"><b>Narration:</b> ${esc(model.narration)}</div>` : ''}
${model.terms ? `<div style="margin-top:4px"><b>Terms:</b> ${esc(model.terms)}</div>` : ''}
${bank?.bankName ? `<div>Bank: ${esc(bank.bankName)}</div>` : ''}
${bank?.accountNo ? `<div>A/C: ${esc(bank.accountNo)}</div>` : ''}
${bank?.ifsc ? `<div>IFSC: ${esc(bank.ifsc)}</div>` : ''}
${bank?.upiId ? `<div>UPI: ${esc(bank.upiId)}</div>` : ''}
${qrImage ? `<div class="c" style="margin-top:8px"><img src="${esc(qrImage)}" style="width:72px;height:72px;object-fit:contain"/></div>` : ''}
<div style="margin-top:18px;text-align:right">
  <div>for <b>${esc(l.authorisedFor || c.name)}</b></div>
  <div style="margin-top:20px;border-top:1px solid #000;display:inline-block;padding-top:4px;min-width:120px">
    ${esc(l.authorisedSignatoryLabel || 'Authorised Signatory')}
  </div>
</div>
${l.jurisdiction ? `<div class="c b" style="margin-top:8px">${esc(l.jurisdiction)}</div>` : ''}
${l.computerGeneratedText ? `<div class="c muted" style="margin-top:4px;font-style:italic">${esc(l.computerGeneratedText)}</div>` : ''}
`;
}
