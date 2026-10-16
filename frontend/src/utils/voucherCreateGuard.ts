import { isRunningFinancialYear } from './runningFinancialYear';
import type { FYInfo } from '../context/AuthContext';

export const BACKDATED_ENTRY_MESSAGE =
  'Back-dated entry is not allowed. Select the current financial year on the Desktop app.';

/** Voucher create kinds that must use the running (current) financial year (web parity). */
export const VOUCHER_ENTRY_CREATE_KINDS = new Set([
  'sales-invoice',
  'sales-order',
  'purchase-invoice',
  'purchase-order',
  'payment',
  'receipt',
  'journal',
  'credit-note',
  'debit-note',
  'delivery-note',
  'contra',
  'expense',
]);

/** QuickActionsModal item id → web create kind. */
const QUICK_ACTION_KIND: Record<string, string> = {
  'sale-invoice': 'sales-invoice',
  'sale-order': 'sales-order',
  'sale-credit': 'credit-note',
  'pur-invoice': 'purchase-invoice',
  'pur-order': 'purchase-order',
  'pur-debit': 'debit-note',
  'vou-receipt': 'receipt',
  'vou-payment': 'payment',
  'vou-journal': 'journal',
  'vou-contra': 'contra',
  'vou-expense': 'expense',
};

export function canOpenVoucherCreate(selectedFY: FYInfo | null | undefined, kind: string) {
  if (!VOUCHER_ENTRY_CREATE_KINDS.has(kind)) return true;
  return isRunningFinancialYear(selectedFY);
}

export function canOpenQuickActionCreate(
  selectedFY: FYInfo | null | undefined,
  quickActionItemId: string,
) {
  const kind = QUICK_ACTION_KIND[quickActionItemId];
  if (!kind) return true;
  return canOpenVoucherCreate(selectedFY, kind);
}
