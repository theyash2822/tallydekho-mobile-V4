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

/** Legacy routes whose screen is not the list the alert is about. */
const LEGACY: Record<string, string> = {
  '/settings/ewb': '/reports/ewb-list?status=pending',
  '/settings/einvoice': '/reports/einvoice-list?status=pending',
};

export function notificationRoute(n: { target?: Target; route?: string | null }): string | null {
  const t = n?.target;
  const enc = encodeURIComponent;
  if (t?.kind === 'stock_item') return t.guid ? `/stocks/item-detail?id=${enc(t.guid)}` : '/stocks/low-stock';
  if (t?.kind === 'ledger') return t.guid ? `/ledger/${enc(t.guid)}` : '/(tabs)/ledger';
  if (t?.kind === 'voucher' && t.guid) return `/document/${enc(t.guid)}`;
  if (t?.kind === 'page' && t.page && PAGES[t.page]) return t.filter ? `${PAGES[t.page]}?status=${enc(t.filter)}` : PAGES[t.page];
  const route = String(n?.route || '').trim();
  if (!route.startsWith('/')) return null;
  return LEGACY[route.split('?')[0]] || route;
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
