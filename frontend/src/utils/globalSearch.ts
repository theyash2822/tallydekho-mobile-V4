// Global search, shared rules with the web portal: grouped hits (vouchers, ledgers, stock items),
// rotating placeholder phrases, and the screen each hit opens.

export type SearchHit = {
  id?: string;
  kind: 'voucher' | 'ledger' | 'stock' | string;
  guid?: string;
  label?: string;
  [key: string]: unknown;
};

/** i18n key + English default, in rotation order. */
export const SEARCH_PLACEHOLDERS: [string, string][] = [
  ['search.ph.transactions', 'Search transactions, parties…'],
  ['search.ph.vouchers', 'Search vouchers…'],
  ['search.ph.invoices', 'Search invoices…'],
  ['search.ph.ledgers', 'Search ledgers and parties…'],
  ['search.ph.stock', 'Search stock items…'],
  ['search.ph.fields', 'Search by amount, GSTIN or reference…'],
];
export const PLACEHOLDER_ROTATE_MS = 2600;

const SECTIONS: { id: string; titleKey: string; title: string }[] = [
  { id: 'voucher', titleKey: 'search.vouchers', title: 'Vouchers' },
  { id: 'ledger', titleKey: 'search.ledgers', title: 'Ledgers' },
  { id: 'stock', titleKey: 'search.stockItems', title: 'Stock items' },
];

/** Hits grouped by kind in display order; empty groups are left out. */
export function buildSearchSections<T extends SearchHit>(hits: T[]) {
  return SECTIONS.map((s) => ({ ...s, items: hits.filter((h) => h.kind === s.id) })).filter((s) => s.items.length > 0);
}

/** The screen a hit opens: the document, the ledger, or the stock item. */
export function searchHitRoute(hit: SearchHit): string | null {
  if (!hit?.guid) return null;
  const id = encodeURIComponent(hit.guid);
  if (hit.kind === 'voucher') return `/document/${id}`;
  if (hit.kind === 'ledger') return `/ledger/${id}`;
  if (hit.kind === 'stock') return `/stocks/item-detail?id=${id}`;
  return null;
}

export const MATCHED_LABELS: Record<string, string> = {
  amount: 'Amount', reference: 'Reference', irn: 'IRN', ewb_number: 'E-Way Bill', narration: 'Narration',
};
