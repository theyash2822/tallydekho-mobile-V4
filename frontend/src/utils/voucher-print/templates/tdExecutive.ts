import { VoucherPrintModel } from '../VoucherPrintModel';
import { esc, formatInr, wrapHtmlDocument } from '../shared';
import { voucherTitle } from '../VoucherPrintModelAdapter';

/** TallyDekho Executive — MD §8. Compact premium share layout. */
export function renderTallyDekhoExecutive(model: VoucherPrintModel): string {
  const body =
    model.layoutMode === 'debit-credit'
      ? renderDebitCredit(model)
      : renderAmount(model);
  return wrapHtmlDocument(body);
}

function header(model: VoucherPrintModel): string {
  const c = model.company;
  const line2 = [
    ...(c.addressLines || []).slice(0, 2),
    c.district,
  ].filter(Boolean).join(' · ');
  const line3 = [
    c.state || c.stateName,
    c.stateCode,
  ].filter(Boolean).join(' ');

  return `
  <table>
    <tr>
      <td style="vertical-align:top">
        <div style="font-size:14px;font-weight:bold">${esc(c.name)}</div>
        ${line2 ? `<div style="font-size:9px;color:#444;margin-top:2px">${esc(line2)}</div>` : ''}
        ${line3 ? `<div style="font-size:9px;color:#444">${esc(line3)}</div>` : ''}
        ${c.gstin ? `<div style="font-size:9px;color:#444">GSTIN ${esc(c.gstin)}</div>` : ''}
        ${c.email ? `<div style="font-size:9px;color:#444">${esc(c.email)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right;font-size:13px;font-weight:bold;letter-spacing:0.6px">
        ${esc(voucherTitle(model.identity.voucherType).toUpperCase())}
      </td>
    </tr>
  </table>
  <div style="border-top:1px solid #000;margin:8px 0"></div>
  <table style="margin-bottom:10px">
    <tr>
      <td style="width:33%">
        <div style="font-size:8px;color:#777;text-transform:uppercase">Voucher No.</div>
        <div style="font-size:10.5px;font-weight:bold">${esc(model.identity.voucherNumber)}</div>
      </td>
      <td style="width:33%">
        <div style="font-size:8px;color:#777;text-transform:uppercase">Date</div>
        <div style="font-size:10.5px;font-weight:bold">${esc(model.identity.date)}</div>
      </td>
      <td style="width:34%;text-align:right">
        <div style="font-size:8px;color:#777;text-transform:uppercase">Company</div>
        <div style="font-size:10.5px;font-weight:bold">${esc(c.name)}</div>
      </td>
    </tr>
  </table>
  <div style="border-top:1px solid #000;margin-bottom:10px"></div>`;
}

function renderDebitCredit(model: VoucherPrintModel): string {
  const rows = model.lines.map((line) => {
    const name = `${line.displayPrefix ? `${line.displayPrefix} ` : ''}${esc(line.ledgerName)}`;
    return `<tr>
      <td style="padding:5px 2px;border-bottom:1px solid #e5e5e5;font-size:9.5px">${name}</td>
      <td style="padding:5px 2px;border-bottom:1px solid #e5e5e5;font-size:9px;text-align:center;width:36px">${line.drCr || ''}</td>
      <td style="padding:5px 2px;border-bottom:1px solid #e5e5e5;font-size:9.5px;text-align:right;width:95px">${line.debit ? formatInr(line.debit) : ''}</td>
      <td style="padding:5px 2px;border-bottom:1px solid #e5e5e5;font-size:9.5px;text-align:right;width:95px">${line.credit ? formatInr(line.credit) : ''}</td>
    </tr>`;
  }).join('');

  return `
${header(model)}
<table>
  <thead><tr>
    <th style="text-align:left;padding:3px 2px;font-size:8.5px;border-bottom:1px solid #000">PARTICULARS</th>
    <th style="padding:3px 2px;font-size:8.5px;border-bottom:1px solid #000;width:36px">TYPE</th>
    <th style="text-align:right;padding:3px 2px;font-size:8.5px;border-bottom:1px solid #000;width:95px">DEBIT</th>
    <th style="text-align:right;padding:3px 2px;font-size:8.5px;border-bottom:1px solid #000;width:95px">CREDIT</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div style="margin-top:10px;font-size:10px;font-weight:bold">
  Total &nbsp; Dr ${formatInr(model.totals.debit, true)} / Cr ${formatInr(model.totals.credit, true)}
</div>
<div style="margin-top:14px">
  <div style="font-size:8.5px;color:#777;letter-spacing:0.5px">NARRATION</div>
  <div style="font-size:9.5px;margin-top:3px">${esc(model.narration || '—')}</div>
</div>
<div style="margin-top:40px;text-align:right">
  <div style="font-size:9px">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</div>
  <div style="border-top:1px solid #000;width:140px;margin-left:auto;margin-top:20px"></div>
</div>
<div style="text-align:center;font-size:9px;margin-top:12px;color:#888">-- 1 of 1 --</div>`;
}

function renderAmount(model: VoucherPrintModel): string {
  const account = model.account;
  const allocs = model.lines[0]?.allocations || [];
  const partyLine = [account?.ledgerName, account?.addressLine].filter(Boolean).join(' ');

  const allocRows = allocs.map((a) => `<tr>
    <td style="padding:4px 2px;border-bottom:1px solid #eee;font-size:9px">${esc(a.type)}</td>
    <td style="padding:4px 2px;border-bottom:1px solid #eee;font-size:9px">${esc(a.reference || '')}</td>
    <td style="padding:4px 2px;border-bottom:1px solid #eee;font-size:9px;text-align:center;width:36px">${a.drCr || ''}</td>
    <td style="padding:4px 2px;border-bottom:1px solid #eee;font-size:9.5px;text-align:right">${formatInr(a.amount)}</td>
  </tr>`).join('');

  return `
${header(model)}
<div style="font-size:8.5px;color:#777;letter-spacing:0.5px">ACCOUNT</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin:3px 0 8px;padding-bottom:8px;border-bottom:1px solid #000">
  <div style="font-size:11px;font-weight:bold">${esc(partyLine)}</div>
  <div style="font-size:11px;font-weight:bold">${formatInr(account?.amount, true)}</div>
</div>
<table style="margin-bottom:10px">
  <tr>
    <td style="width:40%;vertical-align:top">
      <div style="font-size:8.5px;color:#777">THROUGH</div>
      <div style="font-size:10px;font-weight:600;margin-top:2px">${esc(model.through?.ledgerName || '—')}</div>
    </td>
    <td style="width:60%;vertical-align:top">
      <div style="font-size:8.5px;color:#777">NARRATION</div>
      <div style="font-size:10px;margin-top:2px">${esc(model.narration || '—')}</div>
    </td>
  </tr>
</table>
${allocs.length ? `
<div style="font-size:8.5px;color:#777;letter-spacing:0.5px;margin-bottom:4px">ALLOCATIONS</div>
<table>
  <thead><tr>
    <th style="text-align:left;padding:3px 2px;font-size:8px;border-bottom:1px solid #000">TYPE</th>
    <th style="text-align:left;padding:3px 2px;font-size:8px;border-bottom:1px solid #000">REFERENCE</th>
    <th style="padding:3px 2px;font-size:8px;border-bottom:1px solid #000;width:36px">DR/CR</th>
    <th style="text-align:right;padding:3px 2px;font-size:8px;border-bottom:1px solid #000">AMOUNT</th>
  </tr></thead>
  <tbody>${allocRows}</tbody>
</table>` : ''}
<div style="margin-top:12px">
  <div style="font-size:8.5px;color:#777">AMOUNT IN WORDS</div>
  <div style="font-size:9.5px;font-weight:600;margin-top:3px">${esc(model.amountInWords || '')}</div>
</div>
<div style="margin-top:10px;text-align:right;font-size:11px;font-weight:bold">${formatInr(model.totals.amount, true)}</div>
<div style="margin-top:36px;display:flex;justify-content:space-between">
  ${model.signatures.showReceiver ? `<div style="width:45%"><div style="font-size:9px">${esc(model.signatures.receiverLabel || "Receiver's Signature")}</div><div style="border-top:1px solid #000;margin-top:24px"></div></div>` : '<div></div>'}
  <div style="width:45%;text-align:right"><div style="font-size:9px">${esc(model.signatures.authorisedLabel || 'Authorised Signatory')}</div><div style="border-top:1px solid #000;margin-top:24px"></div></div>
</div>
<div style="text-align:center;font-size:9px;margin-top:12px;color:#888">-- 1 of 1 --</div>`;
}
