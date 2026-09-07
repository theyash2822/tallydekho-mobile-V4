/**
 * Stock Ledger / stock list PDF — Tally stock register column layout.
 */
import { RegisterCompany } from './dayBookSheet';

export type StockRegisterRow = {
  date?: string | null;
  particulars?: string | null;
  vchType?: string | null;
  vchNo?: string | null;
  inwardsQty?: string | null;
  outwardsQty?: string | null;
};

export type StockRegisterInput = {
  company?: RegisterCompany;
  title: string;
  period?: string | null;
  rows: StockRegisterRow[];
};

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function addressLines(address?: string | null): string {
  if (!address) return '';
  return address
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((l) => `<div style="font-size:9px">${esc(l)}</div>`)
    .join('');
}

export function renderStockRegisterHTML(input: StockRegisterInput): string {
  const c = input.company || {};
  const rows = (input.rows || [])
    .map(
      (r) => `<tr>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top;white-space:nowrap">${esc(r.date || '')}</td>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top;font-weight:bold">${esc(r.particulars || '')}</td>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top">${esc(r.vchType || '')}</td>
      <td style="padding:3px 4px;font-size:9px;text-align:right;vertical-align:top">${esc(r.vchNo || '')}</td>
      <td style="padding:3px 4px;font-size:9px;text-align:right;vertical-align:top;font-weight:bold">${esc(r.inwardsQty || '')}</td>
      <td style="padding:3px 4px;font-size:9px;text-align:right;vertical-align:top;font-weight:bold">${esc(r.outwardsQty || '')}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 10mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:8mm;font-size:9.5px}
  table{width:100%;border-collapse:collapse}
</style></head><body>
  <div style="text-align:center;margin-bottom:6px">
    <div style="font-size:13px;font-weight:bold">${esc(c.name || '')}</div>
    ${addressLines(c.address)}
    ${c.state ? `<div style="font-size:9px">${esc(c.state)}</div>` : ''}
    ${c.email ? `<div style="font-size:9px">E-Mail : ${esc(c.email)}</div>` : ''}
    ${c.gstin ? `<div style="font-size:9px">GSTIN/UIN: ${esc(c.gstin)}</div>` : ''}
  </div>
  <div style="border-top:1px solid #000;margin:4px 0"></div>
  <div style="text-align:center;font-size:12px;font-weight:bold;margin:4px 0">${esc(input.title)}</div>
  <table style="margin-bottom:4px">
    <tr>
      <td style="font-size:9.5px">${esc(input.period || '')}</td>
      <td style="font-size:9.5px;text-align:right">Page 1</td>
    </tr>
  </table>
  <table>
    <thead>
      <tr>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:left;width:72px">Date</th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:left">Particulars</th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:left;width:100px">Vch Type</th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:right;width:70px">Vch No.</th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:right;width:100px">
          <div>Inwards</div><div style="font-weight:normal;font-size:8px">Quantity</div>
        </th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:right;width:100px">
          <div>Outwards</div><div style="font-weight:normal;font-size:8px">Quantity</div>
        </th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="padding:24px;text-align:center;color:#888">No entries</td></tr>`}
    </tbody>
  </table>
</body></html>`;
}
