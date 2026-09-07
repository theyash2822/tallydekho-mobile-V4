import { VoucherPrintModel } from '../VoucherPrintModel';
import { esc, formatInr, wrapHtmlDocument } from '../shared';
import { voucherTitle } from '../VoucherPrintModelAdapter';

/** Tally Classic — MD §6. Centered company header, traditional ruled tables. */
export function renderTallyClassic(model: VoucherPrintModel): string {
  const body =
    model.layoutMode === 'debit-credit'
      ? renderDebitCredit(model)
      : renderAmount(model);
  return wrapHtmlDocument(body);
}

function companyHeader(model: VoucherPrintModel): string {
  const c = model.company;
  const lines: string[] = [];
  lines.push(`<div style="font-size:12px;font-weight:bold">${esc(c.name)}</div>`);
  for (const a of c.addressLines || []) {
    lines.push(`<div style="font-size:9px">${esc(a)}</div>`);
  }
  if (c.district) lines.push(`<div style="font-size:9px">Distt: ${esc(c.district)}</div>`);
  if (c.state && !c.stateName) lines.push(`<div style="font-size:9px">${esc(c.state)}</div>`);
  if (c.stateName || c.stateCode) {
    const parts = [
      c.stateName ? `State Name : ${esc(c.stateName)}` : '',
      c.stateCode ? `Code : ${esc(c.stateCode)}` : '',
    ].filter(Boolean);
    lines.push(`<div style="font-size:9px">${parts.join(', ')}</div>`);
  }
  // GSTIN optional — print when present (Contra adapter clears it).
  if (c.gstin) lines.push(`<div style="font-size:9px">GSTIN/UIN: ${esc(c.gstin)}</div>`);
  if (c.email) lines.push(`<div style="font-size:9px">E-Mail : ${esc(c.email)}</div>`);

  return `
  <div style="text-align:center;padding:4px 0 8px">
    ${lines.join('\n')}
    <div style="font-size:11px;font-weight:bold;margin-top:8px;letter-spacing:0.3px">
      ${esc(voucherTitle(model.identity.voucherType))}
    </div>
  </div>`;
}

function metaRow(model: VoucherPrintModel): string {
  return `
  <table style="border-top:1px solid #000;border-bottom:1px solid #000">
    <tr>
      <td style="padding:4px 6px;font-size:9.5px">No. : <b>${esc(model.identity.voucherNumber)}</b></td>
      <td style="padding:4px 6px;font-size:9.5px;text-align:right">Dated : <b>${esc(model.identity.date)}</b></td>
    </tr>
  </table>`;
}

function renderDebitCredit(model: VoucherPrintModel): string {
  const rows = model.lines.map((line) => {
    const name = `${line.displayPrefix ? `${line.displayPrefix} ` : ''}${esc(line.ledgerName)}`;
    const drSuffix = line.drCr === 'Dr' && line.debit
      ? ` <span style="font-size:8.5px">Dr</span>`
      : '';
    return `<tr>
      <td style="border:1px solid #000;padding:3px 6px;font-size:9.5px;vertical-align:top">${name}${drSuffix}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:right;font-size:9.5px;width:110px">${line.debit ? formatInr(line.debit) : ''}</td>
      <td style="border:1px solid #000;padding:3px 6px;text-align:right;font-size:9.5px;width:110px">${line.credit ? formatInr(line.credit) : ''}</td>
    </tr>`;
  }).join('');

  return `
<div style="border:1px solid #000">
  ${companyHeader(model)}
  ${metaRow(model)}
  <table>
    <thead><tr>
      <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;text-align:left">Particulars</th>
      <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:110px">Debit</th>
      <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:110px">Credit</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr><td style="border:1px solid #000;height:36px"></td><td style="border:1px solid #000"></td><td style="border:1px solid #000"></td></tr>
    </tbody>
  </table>
  <div style="padding:6px">
    <div style="font-size:9px">On Account of :</div>
    <div style="font-size:9.5px;min-height:14px">${esc(model.narration || '')}</div>
  </div>
  <div style="padding:6px 8px 4px;text-align:right">
    <span class="rupee" style="font-size:10.5px;font-weight:bold;margin-right:24px">${formatInr(model.totals.debit, true)}</span>
    <span class="rupee" style="font-size:10.5px;font-weight:bold">${formatInr(model.totals.credit, true)}</span>
    <div style="border-top:1px solid #000;width:220px;margin-left:auto;margin-top:2px"></div>
  </div>
  ${signatureBlock(model)}
</div>
<div style="text-align:center;font-size:9px;margin-top:4px">-- 1 of 1 --</div>`;
}

function renderAmount(model: VoucherPrintModel): string {
  const account = model.account;
  const allocs = model.lines[0]?.allocations || [];
  const partyLine = [
    account?.ledgerName || '',
    account?.addressLine || '',
  ].filter(Boolean).join(' ');

  const allocRows = allocs.map((a) => {
    const label = [a.type, a.reference].filter(Boolean).join(' ');
    return `<tr>
      <td style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 6px 2px 22px;font-size:9px">${esc(label)}</td>
      <td style="border-right:1px solid #000;padding:2px 6px;text-align:right;font-size:9px;width:140px">${formatInr(a.amount)}${a.drCr ? ` ${a.drCr}` : ''}</td>
    </tr>`;
  }).join('');

  return `
<div style="border:1px solid #000">
  ${companyHeader(model)}
  ${metaRow(model)}
  <table>
    <thead><tr>
      <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;text-align:left">Particulars</th>
      <th style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:140px">Amount</th>
    </tr></thead>
    <tbody>
      <tr>
        <td style="border-left:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-size:9.5px">Account :</td>
        <td style="border-right:1px solid #000"></td>
      </tr>
      <tr>
        <td style="border-left:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-size:9.5px"><b>${esc(partyLine)}</b></td>
        <td style="border-right:1px solid #000;padding:3px 6px;text-align:right;font-size:9.5px">${formatInr(account?.amount)}</td>
      </tr>
      ${allocRows}
      ${model.through ? `
      <tr>
        <td style="border-left:1px solid #000;border-right:1px solid #000;padding:6px 6px 2px;font-size:9.5px">Through :</td>
        <td style="border-right:1px solid #000"></td>
      </tr>
      <tr>
        <td style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 6px 6px;font-size:9.5px"><b>${esc(model.through.ledgerName)}</b></td>
        <td style="border-right:1px solid #000"></td>
      </tr>` : ''}
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;font-size:9px" colspan="2">
          <div>On Account of :</div>
          <div style="font-size:9.5px;margin-top:2px">${esc(model.narration || '')}</div>
          <div style="margin-top:8px">Amount (in words) :</div>
          <div style="font-size:9.5px;font-weight:bold;margin-top:2px">${esc(model.amountInWords || '')}</div>
        </td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10px;font-weight:bold"></td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:right;font-size:10.5px;font-weight:bold" class="rupee">${formatInr(model.totals.amount, true)}</td>
      </tr>
    </tbody>
  </table>
  ${signatureBlock(model)}
</div>
<div style="text-align:center;font-size:9px;margin-top:4px">-- 1 of 1 --</div>`;
}

function signatureBlock(model: VoucherPrintModel): string {
  const recv = model.signatures.showReceiver
    ? `<span style="font-size:9px">${esc(model.signatures.receiverLabel || "Receiver's Signature")} :</span>`
    : '<span></span>';
  const auth = model.signatures.showAuthorised
    ? `<span style="font-size:9px">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</span>`
    : '';
  return `
  <div style="border-top:1px solid #000;padding:28px 8px 8px;display:flex;justify-content:space-between;align-items:flex-end">
    ${recv}
    <div style="text-align:right">${auth}</div>
  </div>`;
}
