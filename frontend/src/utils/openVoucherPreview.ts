/**
 * Single entry point for "tap a voucher → preview". Rules (locked, same as My Entries):
 *  1. Tally voucher id known  → /document/<id> (optional ?type=, else the voucher's own type)
 *  2. App TDK reference only  → the app-copy preview screen for that TDK prefix
 *  3. Neither                 → "Not yet synced" alert (never a silent no-op)
 */
import { Alert } from 'react-native';
import { safePush } from './safeNavigation';

type RouterLike = { push: (href: any) => void };

export interface VoucherPreviewTarget {
  /** vouchers.guid (or Tally voucher number where a screen has no guid) */
  guid?: string | null;
  tdkRef?: string | null;
  /** DocumentType for /document ?type= — omit to let the preview use the voucher's own type */
  docType?: string | null;
  /** Display type (e.g. "Sales Order", "Purchase") — disambiguates TDK refs */
  entryType?: string | null;
}

/** TDK-ADV-* is an advance bill-allocation name, not a voucher of its own. */
function isVoucherTdkRef(ref: string): boolean {
  return /^TDK-/i.test(ref) && !/^TDK-ADV-/i.test(ref);
}

export function tdkPreviewRoute(tdkRef: string, entryType?: string | null): string {
  const ref = encodeURIComponent(tdkRef);
  const type = entryType || '';
  if (/TDK-(?:OPT-)?SOR-/i.test(tdkRef) || type === 'Sales Order') return `/sales/order-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?CON-/i.test(tdkRef)) return `/voucher/contra-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?JOR-/i.test(tdkRef)) return `/voucher/journal-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?PAY-/i.test(tdkRef)) return `/voucher/payment-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?RCP-/i.test(tdkRef)) return `/voucher/receipt-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?PHY-/i.test(tdkRef)) return `/stocks/adjustment-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?STJ-/i.test(tdkRef)) return `/stocks/transfer-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?CN-/i.test(tdkRef)) return `/sales/credit-note-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?DBN-/i.test(tdkRef)) return `/purchase/debit-note-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?DN-/i.test(tdkRef)) return `/sales/delivery-note-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?POR-/i.test(tdkRef)) return `/purchase/order-preview?tdkRef=${ref}`;
  if (/TDK-(?:OPT-)?PUR-/i.test(tdkRef) || type === 'Purchase') {
    return `/sales/invoice-preview?tdkRef=${ref}&type=purchase_invoice`;
  }
  if (/TDK-(?:OPT-)?PRF-/i.test(tdkRef) || type === 'Proforma Invoice') {
    return `/sales/invoice-preview?tdkRef=${ref}&type=proforma_invoice`;
  }
  if (/TDK-(?:OPT-)?QTN-/i.test(tdkRef) || /quotation/i.test(type)) {
    return `/sales/invoice-preview?tdkRef=${ref}&type=quotation`;
  }
  return `/sales/invoice-preview?tdkRef=${ref}`;
}

export function openVoucherPreview(router: RouterLike, target: VoucherPreviewTarget): boolean {
  const { guid, tdkRef, docType, entryType } = target;
  if (guid) {
    const id = encodeURIComponent(String(guid));
    return safePush(router, docType ? `/document/${id}?type=${encodeURIComponent(docType)}` : `/document/${id}`);
  }
  if (tdkRef && isVoucherTdkRef(tdkRef)) {
    return safePush(router, tdkPreviewRoute(tdkRef, entryType));
  }
  Alert.alert('Not yet synced', 'Preview is not available yet. Check again after Tally syncs.', [{ text: 'OK' }]);
  return false;
}
