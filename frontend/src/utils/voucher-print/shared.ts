import { Money } from './VoucherPrintModel';

export function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format a decimal money string with Indian grouping for display. */
export function formatInr(amount: Money | null | undefined, withSymbol = false): string {
  if (amount == null || amount === '') return '';
  const raw = String(amount).replace(/,/g, '').trim();
  if (!raw) return '';
  const neg = raw.startsWith('-');
  const abs = neg ? raw.slice(1) : raw;
  const [intPart, frac = '00'] = abs.split('.');
  const frac2 = (frac + '00').slice(0, 2);
  const n = Number(intPart);
  if (!Number.isFinite(n)) return abs;
  const grouped = Math.abs(n).toLocaleString('en-IN');
  const body = `${grouped}.${frac2}`;
  const signed = neg ? `-${body}` : body;
  if (!withSymbol) return signed;
  // Prefer ₹; fall back handled by CSS font stack in templates.
  return `\u20B9 ${signed}`;
}

/** Convert a known numeric amount to a decimal Money string (2 dp). Display only — not for calc. */
export function moneyFromNumber(n: number | null | undefined): Money {
  if (n == null || !Number.isFinite(n)) return '0.00';
  const abs = Math.abs(n);
  const cents = Math.round(abs * 100);
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  const sign = n < 0 ? '-' : '';
  return `${sign}${whole}.${frac}`;
}

/** Compare two Money strings by integer cents (no float). */
export function moneyEquals(a: Money | null | undefined, b: Money | null | undefined): boolean {
  return moneyToCents(a) === moneyToCents(b);
}

export function moneyToCents(m: Money | null | undefined): number {
  if (m == null || m === '') return 0;
  const raw = String(m).replace(/,/g, '').trim();
  const neg = raw.startsWith('-');
  const abs = neg ? raw.slice(1) : raw;
  const [intPart, frac = ''] = abs.split('.');
  const frac2 = (frac + '00').slice(0, 2);
  const cents = (parseInt(intPart || '0', 10) || 0) * 100 + (parseInt(frac2, 10) || 0);
  return neg ? -cents : cents;
}

/** Classic date: 20-Aug-26. Accepts ISO or already-display dates. */
export function formatClassicDate(date: string): string {
  if (!date) return '';
  // Already like 20-Aug-26 or 20 Aug 2026
  if (/^\d{1,2}[- ][A-Za-z]{3}/.test(date)) {
    const m = date.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ]?(\d{2,4})/);
    if (m) {
      const yy = m[3].length === 4 ? m[3].slice(-2) : m[3];
      return `${m[1].padStart(2, '0')}-${m[2]}-${yy}`;
    }
    return date;
  }
  // ISO 2026-08-20
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, mo, d] = date.slice(0, 10).split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d}-${months[parseInt(mo, 10) - 1]}-${y.slice(-2)}`;
  }
  // DD/MM/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(date)) {
    const [dd, mm, yy] = date.split('/');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const y = yy.length === 4 ? yy.slice(-2) : yy;
    return `${dd.padStart(2, '0')}-${months[parseInt(mm, 10) - 1] || ''}-${y}`;
  }
  return date;
}

export function wrapHtmlDocument(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family: Arial, Helvetica, "Noto Sans", "DejaVu Sans", sans-serif;
    color:#000; background:#fff;
    padding:10mm;
    font-size:9.5px;
    line-height:1.35;
  }
  table{width:100%;border-collapse:collapse}
  .rupee{font-family: Arial, Helvetica, "Noto Sans", sans-serif}
</style></head><body>${body}</body></html>`;
}
