/**
 * TallyDekho Thermal — voucher PDF (td_thermal_v1).
 * Spec §7: narrow reflow, same VoucherPrintModel as Classic/Executive.
 */
import { VoucherPrintModel } from '../VoucherPrintModel';
import { esc, formatInr } from '../shared';
import { voucherTitle } from '../VoucherPrintModelAdapter';
import {
  ThermalPaperWidth,
  DEFAULT_THERMAL_PAPER_WIDTH,
  thermalDash,
  thermalDouble,
  wrapThermalHtml,
} from '../../pdf/thermalShared';

export function renderTallyDekhoThermal(
  model: VoucherPrintModel,
  opts: { paperWidth?: ThermalPaperWidth } = {}
): string {
  const w = opts.paperWidth ?? DEFAULT_THERMAL_PAPER_WIDTH;
  const body =
    model.layoutMode === 'debit-credit'
      ? renderDebitCredit(model, w)
      : renderAmount(model, w);
  return wrapThermalHtml(body, { paperWidth: w });
}

function sep(w: ThermalPaperWidth): string {
  return `<div class="sep">${thermalDash(w)}</div>`;
}

function dbl(w: ThermalPaperWidth): string {
  return `<div class="sep">${thermalDouble(w)}</div>`;
}

function header(model: VoucherPrintModel, w: ThermalPaperWidth): string {
  const c = model.company;
  const lines: string[] = [];
  lines.push(`<div class="c b" style="font-size:${w === 58 ? '11px' : '12px'}">${esc(c.name)}</div>`);
  for (const a of c.addressLines || []) {
    lines.push(`<div class="c muted">${esc(a)}</div>`);
  }
  if (c.district) lines.push(`<div class="c muted">Distt: ${esc(c.district)}</div>`);
  if (c.stateName || c.state || c.stateCode) {
    const st = [c.stateName || c.state, c.stateCode].filter(Boolean).join(' - ');
    lines.push(`<div class="c muted">${esc(st)}</div>`);
  }
  if (c.gstin) lines.push(`<div class="c muted">GSTIN: ${esc(c.gstin)}</div>`);
  if (c.email) lines.push(`<div class="c muted">${esc(c.email)}</div>`);
  if ((c as any).phone) lines.push(`<div class="c muted">${esc((c as any).phone)}</div>`);
  const title = voucherTitle(model.identity.voucherType).toUpperCase();
  const noDate =
    w === 58
      ? `<div>No: ${esc(model.identity.voucherNumber)}</div><div>Date: ${esc(model.identity.date)}</div>`
      : `<div class="row"><span>No: ${esc(model.identity.voucherNumber)}</span><span>Date: ${esc(model.identity.date)}</span></div>`;
  return `
${lines.join('\n')}
${sep(w)}
<div class="c b" style="font-size:${w === 58 ? '11px' : '12px'};letter-spacing:0.5px">${esc(title)}</div>
${sep(w)}
${noDate}
${sep(w)}`;
}

function renderDebitCredit(model: VoucherPrintModel, w: ThermalPaperWidth): string {
  const blocks = model.lines
    .map((line) => {
      const name = `${line.displayPrefix ? `${line.displayPrefix} ` : ''}${esc(line.ledgerName)}`;
      const side = line.drCr || (line.debit ? 'Dr' : line.credit ? 'Cr' : '');
      const amt = line.debit || line.credit || line.amount;
      const bill = (line as any).billRef || (line as any).reference;
      return `<div style="margin:6px 0">
  <div class="b">${name}</div>
  ${bill ? `<div class="muted">${esc(String(bill))}</div>` : ''}
  <div class="row"><span>${esc(side)}</span><span class="b">${formatInr(amt)}</span></div>
</div>`;
    })
    .join('');

  return `
${header(model, w)}
<div class="b">PARTICULARS</div>
${sep(w)}
${blocks}
${sep(w)}
<div class="row"><span class="b">TOTAL DR</span><span class="b">${formatInr(model.totals.debit)}</span></div>
<div class="row"><span class="b">TOTAL CR</span><span class="b">${formatInr(model.totals.credit)}</span></div>
${dbl(w)}
${model.amountInWords ? `<div class="b" style="margin-top:6px">Amount (in words)</div><div>${esc(model.amountInWords)}</div>` : ''}
${model.narration ? `<div class="b" style="margin-top:6px">ON ACCOUNT OF</div><div>${esc(model.narration)}</div>` : ''}
${sep(w)}
<div class="c" style="margin-top:16px">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</div>
`;
}

function renderAmount(model: VoucherPrintModel, w: ThermalPaperWidth): string {
  const account = model.account;
  const allocs = model.lines[0]?.allocations || [];
  const party = [account?.ledgerName, account?.addressLine].filter(Boolean).join(' — ');

  const allocHtml = allocs
    .map(
      (a) => `<div class="row" style="margin:2px 0 2px 8px">
  <span>${esc(a.type)}${a.reference ? ` ${esc(a.reference)}` : ''}</span>
  <span>${formatInr(a.amount)} ${a.drCr || ''}</span>
</div>`
    )
    .join('');

  return `
${header(model, w)}
<div class="b">Account :</div>
<div class="row" style="margin:4px 0 8px">
  <span class="b">${esc(party)}</span>
  <span class="b">${formatInr(account?.amount)}</span>
</div>
${allocHtml}
${model.through ? `<div class="b" style="margin-top:8px">Through :</div><div>${esc(model.through.ledgerName)}</div>` : ''}
${model.narration ? `<div class="b" style="margin-top:8px">On Account of :</div><div>${esc(model.narration)}</div>` : ''}
${model.amountInWords ? `<div class="b" style="margin-top:8px">Amount (in words) :</div><div>${esc(model.amountInWords)}</div>` : ''}
${sep(w)}
<div class="r b" style="font-size:11px;margin:6px 0">${formatInr(model.totals.amount || account?.amount, true)}</div>
${dbl(w)}
<div style="display:flex;justify-content:space-between;margin-top:18px">
  <div style="font-size:9px">${model.signatures.showReceiver ? "Receiver's Signature" : ''}</div>
  <div style="font-size:9px;text-align:right">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</div>
</div>
`;
}
