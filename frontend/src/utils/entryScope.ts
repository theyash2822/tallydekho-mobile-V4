/**
 * Per-member data entry, per company (set by the Owner on Web). Mirrors the server's entry types;
 * a company without an entry scope allows everything the role allows.
 */
export const ENTRY_KEYS = new Set<string>([
  'sales_invoice.create', 'sales_order.create', 'delivery_note.create', 'credit_note.create', 'sales_proforma.convert_to_regular',
  'purchase_invoice.create', 'purchase_order.create', 'debit_note.create',
  'receipt.create', 'payment.create', 'expense.create', 'journal.create', 'contra.create',
  'stock_adjustment.create', 'stock_transfer.create', 'stock_item.create', 'stock_item.alter', 'warehouse.create',
  'ledger_master.create',
]);

export type EntryScope = { mode?: string; keys?: string[]; entryMode?: string };

/** Role capabilities minus the entry types this company's scope does not allow. */
export function effectiveCapabilities(capabilities: string[], scope?: EntryScope | null): string[] {
  if (!scope || !scope.mode || scope.mode === 'ALL') return capabilities;
  const allowed = new Set(scope.keys || []);
  return capabilities.filter((k) => !ENTRY_KEYS.has(k) || (scope.mode === 'SELECTED' && allowed.has(k)));
}

/** The server sends REGULAR / OPTIONAL / BOTH (NONE for a conflicting member setting). */
export function toMobileEntryMode(raw?: string | null): 'OPTIONAL_ONLY' | 'REGULAR_ONLY' | 'BOTH' | 'NONE' {
  const m = String(raw || 'BOTH').toUpperCase();
  if (m === 'REGULAR' || m === 'REGULAR_ONLY') return 'REGULAR_ONLY';
  if (m === 'OPTIONAL' || m === 'OPTIONAL_ONLY') return 'OPTIONAL_ONLY';
  if (m === 'NONE') return 'NONE';
  return 'BOTH';
}
