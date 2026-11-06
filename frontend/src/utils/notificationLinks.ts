// Where a notification opens in the app — same rules as the web portal. The server sends a
// `target` (the record or list the alert is about) and a legacy `route`.

type Target = { kind?: string; guid?: string | null; name?: string; page?: string; filter?: string } | null | undefined;

const PAGES: Record<string, string> = {
  'expiry-schedule': '/stocks/expiry-schedule',
  'negative-stock': '/stocks/negative-stock',
  'low-stock': '/stocks/low-stock',
  'eway-bill': '/reports/ewb-list',
  einvoice: '/reports/einvoice-list',
};

/** A filter that names a tab of the e-invoice / e-way bill lists opens that tab. */
const LIST_TABS = new Set(['ready', 'attention', 'generated', 'incoming']);

const SETTINGS_PAGES: Record<string, string> = {
  einvoice: '/settings/einvoice',
  ewb: '/settings/ewb',
  'eway-bill': '/settings/ewb',
  gst: '/settings/gst',
  'tally-sync': '/settings/tally-sync',
  alerts: '/settings/compliance-reminders',
};

/** Legacy routes whose screen is not the list the alert is about. */
const LEGACY: Record<string, string> = {
  '/settings/ewb': '/reports/ewb-list?status=pending',
  '/settings/einvoice': '/reports/einvoice-list?status=pending',
};

/**
 * Top-level route groups under `app/` that a notification may open. A server-sent
 * `route` outside this list is ignored (auth/onboarding screens are deliberately absent).
 */
export const PUSH_ROUTE_PREFIXES: readonly string[] = [
  '/(tabs)',
  '/cashflow-report',
  '/daybook',
  '/document',
  '/expenses',
  '/kpi',
  '/ledger',
  '/masters',
  '/notifications',
  '/purchase',
  '/reports',
  '/sales',
  '/settings',
  '/stocks',
  '/voucher',
];

/** True when `route` is an in-app path under one of the known top-level route groups. */
export function isAllowedPushRoute(route: unknown): route is string {
  const raw = String(route ?? '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('..') || /[\s\\]/.test(raw)) return false;
  const path = raw.split(/[?#]/)[0];
  return PUSH_ROUTE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export function notificationRoute(n: { target?: Target; route?: string | null }): string | null {
  const t = n?.target;
  const enc = encodeURIComponent;
  if (t?.kind === 'stock_item') return t.guid ? `/stocks/item-detail?id=${enc(t.guid)}` : '/stocks/low-stock';
  if (t?.kind === 'ledger') return t.guid ? `/ledger/${enc(t.guid)}` : '/(tabs)/ledger';
  if (t?.kind === 'voucher' && t.guid) return `/document/${enc(t.guid)}`;
  if (t?.kind === 'page' && t.page && PAGES[t.page]) {
    if (!t.filter) return PAGES[t.page];
    return LIST_TABS.has(t.filter) ? `${PAGES[t.page]}?tab=${enc(t.filter)}` : `${PAGES[t.page]}?status=${enc(t.filter)}`;
  }
  if (t?.kind === 'settings' && t.page && SETTINGS_PAGES[t.page]) return SETTINGS_PAGES[t.page];
  const route = String(n?.route || '').trim();
  if (!route.startsWith('/')) return null;
  const resolved = LEGACY[route.split('?')[0]] || complianceLinkRoute(route) || route;
  return isAllowedPushRoute(resolved) ? resolved : null;
}

/** Compliance alerts (push `data.type` 'compliance_<kind>') carry the web path of what they are about in `data.link`. */
export const isComplianceAlert = (data: { type?: unknown } | null | undefined): boolean => /^compliance_/.test(String(data?.type || ''));

function queryOf(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of search.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    try {
      out[decodeURIComponent((i < 0 ? part : part.slice(0, i)).replace(/\+/g, ' '))] = i < 0 ? '' : decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    } catch { /* a malformed pair is skipped */ }
  }
  return out;
}

/**
 * The web portal path of a compliance alert → the app screen that shows the same thing:
 * /compliance/einvoice?tab=attention → the e-invoice list on Needs attention, /compliance/eway-bill?tab=incoming →
 * Incoming e-way bills, /compliance/gst?tab=deposits → GST with its deposits, /settings/{einvoice,ewb,gst,tally-sync}.
 */
export function complianceLinkRoute(link: unknown): string | null {
  const raw = String(link ?? '').trim().replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  if (!raw.startsWith('/')) return null;
  const [pathPart, search = ''] = raw.split('?');
  const path = pathPart.replace(/\/+$/, '') || '/';
  const q = queryOf(search);
  const tabbed = (base: string, tab: string | undefined) => (tab ? `${base}?tab=${encodeURIComponent(tab)}` : base);
  if (path === '/compliance/einvoice' || path === '/compliance/e-invoice') {
    const tab = q.tab === 'failed' ? 'attention' : q.tab;
    return tabbed('/reports/einvoice-list', tab && LIST_TABS.has(tab) && tab !== 'incoming' ? tab : undefined);
  }
  if (path === '/compliance/eway-bill' || path === '/compliance/ewaybill' || path === '/compliance/ewb') {
    const tab = q.tab === 'failed' ? 'attention' : q.tab;
    return tabbed('/reports/ewb-list', tab && LIST_TABS.has(tab) ? tab : (q.ewb ? 'generated' : undefined));
  }
  if (path === '/compliance/gst') return tabbed('/reports/gst', q.tab === 'ims' || q.tab === 'deposits' ? q.tab : undefined);
  if (path === '/compliance') return '/reports/compliance';
  const settings = /^\/settings\/([a-z-]+)$/.exec(path);
  if (settings) return SETTINGS_PAGES[settings[1]] || null;
  return null;
}

export type NotificationGroup = 'Today' | 'Yesterday' | 'Earlier';

/** Today / Yesterday / Earlier from the alert's time on this device. */
export function notificationGroup(createdAt: string | undefined, now = new Date()): NotificationGroup {
  const d = createdAt ? new Date(createdAt) : now;
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
}

export type Severity = 'critical' | 'attention' | 'info';

/** Critical alerts (negative or expired stock) and ones that need attention; the rest are info. */
export function notificationSeverity(n: { title?: string; body?: string; message?: string }): Severity {
  const text = `${n.title || ''} ${n.body || n.message || ''}`;
  if (/negative|expired/i.test(text)) return 'critical';
  if (/low stock|expir|pending|due|outstanding|owes/i.test(text)) return 'attention';
  return 'info';
}
