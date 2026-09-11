/**
 * Date-range helpers — ISO wire format, Settings display, Home FY bounds.
 *
 * Contract:
 * - API / screen filter state: always YYYY-MM-DD
 * - Display: settings.date_format via formatDate / formatDateRange
 * - Home selectedFY is the only year switcher; ranges never escape FY
 */

import { formatDate, type FormatSettings } from './format';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: string): boolean {
  return ISO_RE.test((s || '').slice(0, 10));
}

/** Local calendar date → ISO (avoids UTC off-by-one from toISOString). */
export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse ISO YYYY-MM-DD to local Date at noon (stable vs DST). */
export function parseISODate(iso: string): Date | null {
  const part = (iso || '').slice(0, 10);
  if (!ISO_RE.test(part)) return null;
  const d = new Date(`${part}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateRange(
  fromIso: string,
  toIso: string,
  settings: FormatSettings,
  sep = ' – ',
): string {
  if (!fromIso && !toIso) return '';
  if (fromIso && toIso) return `${formatDate(fromIso, settings)}${sep}${formatDate(toIso, settings)}`;
  return formatDate(fromIso || toIso, settings);
}

/**
 * Parse a user-facing date string using settings.date_format → ISO.
 * Also accepts already-ISO strings.
 */
export function parseUserDate(str: string, dateFormat: string): string | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (ISO_RE.test(trimmed.slice(0, 10))) return trimmed.slice(0, 10);

  const fmt = dateFormat || 'DD/MM/YYYY';
  let y = 0, m = 0, d = 0;

  if (fmt === 'YYYY-MM-DD') {
    const p = trimmed.split('-');
    if (p.length < 3) return null;
    y = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    d = parseInt(p[2], 10);
  } else if (fmt === 'MM/DD/YYYY') {
    const p = trimmed.split('/');
    if (p.length < 3) return null;
    m = parseInt(p[0], 10);
    d = parseInt(p[1], 10);
    y = parseInt(p[2], 10);
  } else if (fmt === 'DD-MM-YYYY') {
    const p = trimmed.split('-');
    if (p.length < 3) return null;
    d = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    y = parseInt(p[2], 10);
  } else {
    // DD/MM/YYYY (default) — also tolerate legacy DD/MM/YY
    const p = trimmed.split('/');
    if (p.length < 3) return null;
    d = parseInt(p[0], 10);
    m = parseInt(p[1], 10);
    y = parseInt(p[2], 10);
    if (y < 100) y += 2000;
  }

  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return ISO_RE.test(iso) ? iso : null;
}

export type FyBounds = { from?: string; to?: string };

function clampIso(iso: string, fyFrom?: string | null, fyTo?: string | null): string {
  let out = iso;
  if (fyFrom && out < fyFrom) out = fyFrom;
  if (fyTo && out > fyTo) out = fyTo;
  return out;
}

/**
 * FY-safe preset windows (ISO). Same spirit as Home periodDates:
 * if the natural window sits after a closed FY, anchor to the last N days of that FY.
 */
export function resolveFyPreset(
  key: 'this_month' | 'last_1' | 'last_3',
  fyBounds?: FyBounds | null,
): { from: string; to: string } {
  const fyFrom = fyBounds?.from?.slice(0, 10) || null;
  const fyTo = fyBounds?.to?.slice(0, 10) || null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  let fromD: Date;
  let toD: Date;

  if (key === 'this_month') {
    fromD = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    toD = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
  } else if (key === 'last_1') {
    toD = new Date(today);
    fromD = new Date(today);
    fromD.setDate(fromD.getDate() - 29);
  } else {
    // last_3 ≈ ~90 days ending today (or end of FY)
    toD = new Date(today);
    fromD = new Date(today);
    fromD.setDate(fromD.getDate() - 89);
  }

  let from = dateToISO(fromD);
  let to = dateToISO(toD);

  if (fyFrom && fyTo) {
    if (from > fyTo) {
      const end = parseISODate(fyTo)!;
      const start = new Date(end);
      const days = key === 'this_month' ? Math.min(30, Math.max(1, Math.round((end.getTime() - (parseISODate(fyFrom)?.getTime() ?? end.getTime())) / 86400000) + 1)) : key === 'last_1' ? 30 : 90;
      start.setDate(start.getDate() - (days - 1));
      from = dateToISO(start);
      to = fyTo;
      // this_month on closed FY: last calendar month inside FY
      if (key === 'this_month') {
        const endD = parseISODate(fyTo)!;
        from = dateToISO(new Date(endD.getFullYear(), endD.getMonth(), 1, 12));
        to = fyTo;
      }
    }
    from = clampIso(from, fyFrom, fyTo);
    to = clampIso(to, fyFrom, fyTo);
    if (from > to) from = to;
  }

  return { from, to };
}

/** Default range for a screen = full selected FY (ISO). */
export function fullFyRange(fyBounds?: FyBounds | null): { from: string; to: string } {
  return {
    from: fyBounds?.from?.slice(0, 10) || '',
    to: fyBounds?.to?.slice(0, 10) || '',
  };
}
