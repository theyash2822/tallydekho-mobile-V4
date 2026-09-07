import { VoucherPrintModel } from '../VoucherPrintModel';
import { esc, formatInr, wrapHtmlDocument } from '../shared';
import { voucherTitle } from '../VoucherPrintModelAdapter';

/** TallyDekho Ledger — MD §7. Accounting-first readable layout. */
export function renderTallyDekhoLedger(model: VoucherPrintModel): string {
  const body =
    model.layoutMode === 'debit-credit'
      ? renderDebitCredit(model)
      : renderAmount(model);
  return wrapHtmlDocument(body);
}

function header(model: VoucherPrintModel): string {
  const c = model.company;
  const addr = [
    ...(c.addressLines || []),
    c.district ? `Distt: ${c.district}` : '',
    [c.stateName || c.state, c.stateCode].filter(Boolean).join(' · '),
  ].filter(Boolean);
  return `
  <table style="margin-bottom:6px">
    <tr>
      <td style="vertical-align:top;width:58%">
        <div style="font-size:13px;font-weight:bold">${esc(c.name)}</div>
        ${addr.map((a) => `<div style="font-size:9px;color:#333">${esc(a)}</div>`).join('')}
        ${c.gstin ? `<div style="font-size:9px;color:#333">GSTIN: ${esc(c.gstin)}</div>` : ''}
        ${c.email ? `<div style="font-size:9px;color:#333">${esc(c.email)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right">
        <div style="font-size:12px;font-weight:bold;letter-spacing:0.4px">${esc(voucherTitle(model.identity.voucherType).toUpperCase())}</div>
        <div style="font-size:9.5px;margin-top:4px">Voucher #${esc(model.identity.voucherNumber)}</div>
        <div style="font-size:9.5px">${esc(model.identity.date)}</div>
      </td>
    </tr>
  </table>
  <div style="border-top:1.5px solid #000;margin:4px 0 10px"></div>`;
}

function renderDebitCredit(model: VoucherPrintModel): string {
  const rows = model.lines.map((line) => {
    const name = `${line.displayPrefix ? `${line.displayPrefix} ` : ''}${esc(line.ledgerName)}`;
    return `<tr>
      <td style="padding:5px 4px;border-bottom:1px solid #ddd;font-size:9.5px">${name}</td>
      <td style="padding:5px 4px;border-bottom:1px solid #ddd;font-size:9px;width:40px;text-align:center">${line.drCr || ''}</td>
      <td style="padding:5px 4px;border-bottom:1px solid #ddd;font-size:9.5px;text-align:right;width:100px">${line.debit ? formatInr(line.debit) : ''}</td>
      <td style="padding:5px 4px;border-bottom:1px solid #ddd;font-size:9.5px;text-align:right;width:100px">${line.credit ? formatInr(line.credit) : ''}</td>
    </tr>`;
  }).join('');

  return `
${header(model)}
<table>
  <thead><tr style="border-bottom:1.5px solid #000">
    <th style="text-align:left;padding:4px;font-size:9px">ACCOUNT / PARTICULARS</th>
    <th style="padding:4px;font-size:9px;width:40px">TYPE</th>
    <th style="text-align:right;padding:4px;font-size:9px;width:100px">DEBIT</th>
    <th style="text-align:right;padding:4px;font-size:9px;width:100px">CREDIT</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr style="border-top:1.5px solid #000">
    <td colspan="2" style="padding:6px 4px;font-size:9.5px;font-weight:bold">TOTAL</td>
    <td style="padding:6px 4px;text-align:right;font-size:10px;font-weight:bold">${formatInr(model.totals.debit, true)}</td>
    <td style="padding:6px 4px;text-align:right;font-size:10px;font-weight:bold">${formatInr(model.totals.credit, true)}</td>
  </tr></tfoot>
</table>
<div style="margin-top:14px">
  <div style="font-size:9px;font-weight:bold;letter-spacing:0.5px">NARRATION</div>
  <div style="font-size:9.5px;margin-top:3px">${esc(model.narration || '—')}</div>
</div>
<div style="margin-top:36px;text-align:right">
  <div style="border-top:1px solid #000;width:160px;margin-left:auto"></div>
  <div style="font-size:9px;margin-top:4px">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</div>
</div>
<div style="text-align:center;font-size:9px;margin-top:12px;color:#666">-- 1 of 1 --</div>`;
}

function renderAmount(model: VoucherPrintModel): string {
  const account = model.account;
  const allocs = model.lines[0]?.allocations || [];
  const partyLine = [account?.ledgerName, account?.addressLine].filter(Boolean).join(' ');

  const allocRows = allocs.map((a) => `<tr>
    <td style="padding:4px;border-bottom:1px solid #eee;font-size:9px">${esc(a.type)}</td>
    <td style="padding:4px;border-bottom:1px solid #eee;font-size:9px">${esc(a.reference || '')}</td>
    <td style="padding:4px;border-bottom:1px solid #eee;font-size:9px;text-align:center;width:40px">${a.drCr || ''}</td>
    <td style="padding:4px;border-bottom:1px solid #eee;font-size:9.5px;text-align:right">${formatInr(a.amount)}</td>
  </tr>`).join('');

  return `
${header(model)}
<div style="font-size:9px;font-weight:bold;letter-spacing:0.5px">ACCOUNT</div>
<div style="display:flex;justify-content:space-between;margin:4px 0 10px">
  <div style="font-size:10.5px;font-weight:bold">${esc(partyLine)}</div>
  <div style="font-size:10.5px;font-weight:bold">${formatInr(account?.amount, true)}</div>
</div>
${model.through ? `
<div style="font-size:9px;font-weight:bold;letter-spacing:0.5px">THROUGH</div>
<div style="font-size:10px;margin:3px 0 12px">${esc(model.through.ledgerName)}</div>` : ''}
${allocs.length ? `
<div style="font-size:9px;font-weight:bold;letter-spacing:0.5px;margin-bottom:4px">ALLOCATIONS</div>
<div style="border-top:1px solid #000"></div>
<table>
  <thead><tr>
    <th style="text-align:left;padding:4px;font-size:8.5px">TYPE</th>
    <th style="text-align:left;padding:4px;font-size:8.5px">REFERENCE</th>
    <th style="padding:4px;font-size:8.5px;width:40px">DR/CR</th>
    <th style="text-align:right;padding:4px;font-size:8.5px">AMOUNT</th>
  </tr></thead>
  <tbody>${allocRows}</tbody>
</table>
<div style="border-top:1.5px solid #000;display:flex;justify-content:space-between;padding:6px 0;font-weight:bold;font-size:10px">
  <span>TOTAL</span><span>${formatInr(model.totals.amount, true)}</span>
</div>` : `
<div style="border-top:1.5px solid #000;display:flex;justify-content:space-between;padding:6px 0;font-weight:bold;font-size:10px">
  <span>TOTAL</span><span>${formatInr(model.totals.amount, true)}</span>
</div>`}
<div style="margin-top:12px">
  <div style="font-size:9px;font-weight:bold;letter-spacing:0.5px">NARRATION</div>
  <div style="font-size:9.5px;margin-top:3px">${esc(model.narration || '—')}</div>
</div>
<div style="margin-top:10px">
  <div style="font-size:9px;font-weight:bold;letter-spacing:0.5px">AMOUNT IN WORDS</div>
  <div style="font-size:9.5px;margin-top:3px;font-weight:600">${esc(model.amountInWords || '')}</div>
</div>
<div style="margin-top:36px;display:flex;justify-content:space-between">
  ${model.signatures.showReceiver ? `<div style="width:45%"><div style="border-top:1px solid #000;margin-top:28px"></div><div style="font-size:9px;margin-top:4px">${esc(model.signatures.receiverLabel || "Receiver's Signature")}</div></div>` : '<div></div>'}
  <div style="width:45%;text-align:right"><div style="border-top:1px solid #000;margin-top:28px;margin-left:auto;width:100%"></div><div style="font-size:9px;margin-top:4px">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</div></div>
</div>
<div style="text-align:center;font-size:9px;margin-top:12px;color:#666">-- 1 of 1 --</div>`;
}
