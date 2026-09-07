/**
 * Day Book / Register list PDF — Tally Prime Day Book column layout.
 * Title is caller-controlled (Day Book, Sales Register, Cash Register, …).
 */
export type RegisterCompany = {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  gstin?: string | null;
  state?: string | null;
};

export type DayBookRow = {
  date?: string | null;
  particulars?: string | null;
  vchType?: string | null;
  vchNo?: string | null;
  /** Money debit, or inward qty text e.g. "24,298 nos" */
  debitOrInwards?: string | number | null;
  /** Money credit, or outward qty text */
  creditOrOutwards?: string | number | null;
};

export type DayBookInput = {
  company?: RegisterCompany;
  title: string;
  period?: string | null;
  rows: DayBookRow[];
};

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const money = (n: number): string =>
  Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function cellAmount(v: string | number | null | undefined): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return money(v);
  return esc(v);
}

function addressLines(address?: string | null): string {
  if (!address) return '';
  return address
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((l) => `<div style="font-size:9px">${esc(l)}</div>`)
    .join('');
}

/** Tally Day Book–style register: centered letterhead, dual amount/qty columns. */
export function renderDayBookHTML(input: DayBookInput): string {
  const c = input.company || {};
  const rows = (input.rows || [])
    .map((r) => {
      return `<tr>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top;white-space:nowrap">${esc(r.date || '')}</td>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top;font-weight:bold">${esc(r.particulars || '')}</td>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top">${esc(r.vchType || '')}</td>
      <td style="padding:3px 4px;font-size:9px;vertical-align:top">${esc(r.vchNo || '')}</td>
      <td style="padding:3px 4px;font-size:9px;text-align:right;vertical-align:top">${cellAmount(r.debitOrInwards)}</td>
      <td style="padding:3px 4px;font-size:9px;text-align:right;vertical-align:top">${cellAmount(r.creditOrOutwards)}</td>
    </tr>`;
    })
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
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:left;width:88px">Vch Type</th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:left;width:70px">Vch No.</th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:right;width:100px">
          <div>Debit Amount</div><div style="font-weight:normal;font-size:8px">Inwards Qty</div>
        </th>
        <th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:right;width:100px">
          <div>Credit Amount</div><div style="font-weight:normal;font-size:8px">Outwards Qty</div>
        </th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="padding:24px;text-align:center;color:#888">No entries</td></tr>`}
    </tbody>
  </table>
</body></html>`;
}
