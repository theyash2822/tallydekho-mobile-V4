/**
 * Invoices as the GST portal holds them (Reports → GST → Sales / Purchases on the GST portal): which period comes
 * before and after the one on screen, what a refusal means, and the status of a row.
 */
import type { GstPortalStatus, GstPurchaseSource } from '../services/api';
import type { Tone } from '../components/settings/SettingsKit';
import { shiftGstPeriod } from './complianceRules';

export type GstPortalKind = 'sales' | 'purchases';

export const PORTAL_STATUSES: readonly GstPortalStatus[] = ['matched', 'mismatch', 'books_only', 'portal_only'];

export const PORTAL_STATUS_TONE: Record<GstPortalStatus, Tone> = {
  matched: 'positive',
  mismatch: 'warning',
  books_only: 'negative',
  portal_only: 'info',
};

export function isPortalStatus(value: unknown): value is GstPortalStatus {
  return PORTAL_STATUSES.includes(value as GstPortalStatus);
}

/** GST began in July 2017; the server refuses earlier periods. */
const FIRST_PERIOD_ORDINAL = 201707;

/** MMYYYY → YYYYMM as a number, for comparing periods; 0 when it is not a period. */
export function periodOrdinal(period: string | null | undefined): number {
  const m = String(period || '').match(/^(0[1-9]|1[0-2])(\d{4})$/);
  return m ? Number(m[2]) * 100 + Number(m[1]) : 0;
}

/**
 * Months between one period and the next. A quarterly filer's GSTR-2B comes per quarter (its period is the
 * quarter's last month, labelled "Oct–Dec 2026"); sales (IFF for months 1 and 2, GSTR-1 for the quarter) and
 * GSTR-2A go month by month.
 */
export function periodStep(kind: GstPortalKind, source: GstPurchaseSource, opts: { label?: string | null; frequency?: string | null } = {}): 1 | 3 {
  if (kind !== 'purchases' || source !== '2b') return 1;
  const label = String(opts.label || '').trim();
  const quarterly = label ? /\p{L}\s*[–-]\s*\p{L}/u.test(label) : opts.frequency === 'quarterly';
  return quarterly ? 3 : 1;
}

/**
 * The periods either side of `period`: none before GST began, none whose first month is still ahead of `today`
 * (the current month can be asked for; the server then says when the portal will have it).
 */
export function adjacentPeriods(period: string, step: 1 | 3, today: Date = new Date()): { prev: string | null; next: string | null } {
  if (!periodOrdinal(period)) return { prev: null, next: null };
  const prev = shiftGstPeriod(period, -step);
  const next = shiftGstPeriod(period, step);
  const nextStarts = periodOrdinal(shiftGstPeriod(period, 1));
  const current = today.getFullYear() * 100 + today.getMonth() + 1;
  return {
    prev: periodOrdinal(prev) >= FIRST_PERIOD_ORDINAL ? prev : null,
    next: nextStarts <= current ? next : null,
  };
}

/** What a refusal from /gst/portal-sales or /gst/purchases asks of the user; null for any other failure. */
export type PortalProblem = 'connect' | 'expired' | 'gstin' | 'unreachable' | 'timeout';

export function portalProblem(err: unknown): PortalProblem | null {
  switch (String((err as { code?: unknown } | null)?.code || '')) {
    case 'GST_NOT_CONNECTED': return 'connect';
    case 'GST_SESSION_EXPIRED': return 'expired';
    case 'COMPANY_GSTIN_MISSING': return 'gstin';
    case 'GST_PORTAL_UNREACHABLE': return 'unreachable';
    case 'GST_PORTAL_TIMEOUT': return 'timeout';
    default: return null;
  }
}

/** The screen's route: `frequency` (from the GST overview) tells it a quarterly filer's GSTR-2B steps by quarter. */
export function gstPortalRoute(kind: GstPortalKind, opts: { source?: GstPurchaseSource; frequency?: string | null } = {}) {
  return {
    pathname: '/reports/gst-portal',
    params: {
      kind,
      ...(opts.source ? { source: opts.source } : {}),
      ...(opts.frequency ? { freq: String(opts.frequency) } : {}),
    },
  };
}

/** Rows per status, and all of them. */
export function statusCounts(items: readonly { status: string }[]): Record<GstPortalStatus | 'all', number> {
  const counts: Record<GstPortalStatus | 'all', number> = { all: items.length, matched: 0, mismatch: 0, books_only: 0, portal_only: 0 };
  for (const item of items) if (isPortalStatus(item.status)) counts[item.status] += 1;
  return counts;
}
