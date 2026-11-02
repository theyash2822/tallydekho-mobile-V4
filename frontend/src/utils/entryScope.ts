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

/**
 * Keys whose creation obeys Entry Mode (Regular / Optional): every Tally voucher type and converting
 * a proforma (which makes a regular invoice). Masters and PDFs have no entry mode.
 */
export const ENTRY_MODE_KEYS = new Set<string>([
  'sales_invoice.create', 'sales_order.create', 'delivery_note.create', 'credit_note.create', 'sales_proforma.convert_to_regular',
  'purchase_invoice.create', 'purchase_order.create', 'debit_note.create',
  'receipt.create', 'payment.create', 'expense.create', 'journal.create', 'contra.create',
  'stock_adjustment.create', 'stock_transfer.create',
]);
export const usesEntryMode = (key?: string | null) => !!key && ENTRY_MODE_KEYS.has(key);

/** Role capabilities minus the entry types this company's scope does not allow. */
/**
 * Reports the Owner can switch per member and company (same list as the server). Area
 * capabilities (Home, Reports, Stock) are never in it, so narrowing reports never removes a tab.
 */
export const REPORT_KEYS = new Set([
  'financials.profit_loss.view', 'financials.balance_sheet.view', 'financials.trial_balance.view',
  'financials.cash_register.view', 'financials.bank_balance.view', 'financials.loans_od.view',
  'financials.receivables.view', 'financials.payables.view', 'daybook.view', 'expenses.view',
  'gst.view', 'einvoice.view', 'eway.view',
  'inventory.stock_ledger.view', 'inventory.negative_stock.view', 'inventory.aged_items.view',
  'inventory.expiry.view', 'inventory.reorder.view', 'ai_insights.view',
]);

export type SectionScopes = {
  reportScope?: { mode?: string; keys?: string[] } | null;
  stockScope?: { mode?: string } | null;
};

/** The role's capabilities narrowed by the member's data entry, reports and stock access for the company. */
export function effectiveCapabilities(capabilities: string[], scope?: EntryScope | null, sections: SectionScopes = {}): string[] {
  let caps = capabilities;
  const narrow = (sc: { mode?: string; keys?: string[] } | null | undefined, keys: Set<string>) => {
    if (!sc || !sc.mode || sc.mode === 'ALL') return;
    const allowed = new Set(sc.keys || []);
    caps = caps.filter((k) => !keys.has(k) || (sc.mode === 'SELECTED' && allowed.has(k)));
  };
  narrow(scope, ENTRY_KEYS);
  narrow(sections.reportScope, REPORT_KEYS);
  if (sections.stockScope?.mode === 'NONE') caps = caps.filter((k) => !k.startsWith('inventory.'));
  return caps;
}

/** The server sends REGULAR / OPTIONAL / BOTH (NONE for a conflicting member setting). */
export function toMobileEntryMode(raw?: string | null): 'OPTIONAL_ONLY' | 'REGULAR_ONLY' | 'BOTH' | 'NONE' {
  const m = String(raw || 'BOTH').toUpperCase();
  if (m === 'REGULAR' || m === 'REGULAR_ONLY') return 'REGULAR_ONLY';
  if (m === 'OPTIONAL' || m === 'OPTIONAL_ONLY') return 'OPTIONAL_ONLY';
  if (m === 'NONE') return 'NONE';
  return 'BOTH';
}
