/**
 * barcodePicker.ts
 *
 * Module-level callback store that lets product-scanner.tsx pass its result
 * back to create-invoice.tsx without React navigation params or context.
 *
 * Usage:
 *   // create-invoice — before navigating to scanner
 *   barcodePicker.set((result) => { ...fill item... });
 *   router.push('/sales/product-scanner');
 *
 *   // product-scanner — after successful lookup
 *   barcodePicker.resolve({ productName, unit });
 *   router.back();
 */

export interface BarcodePickResult {
  /** Matches StockItem.name — used for item.product lookup */
  productName: string;
  unit?: string;
}

type PickCallback = (result: BarcodePickResult) => void;

let _pending: PickCallback | null = null;

export const barcodePicker = {
  /** Set callback before navigating to scanner */
  set(cb: PickCallback) {
    _pending = cb;
  },

  /** Call from scanner screen on successful scan */
  resolve(result: BarcodePickResult) {
    if (_pending) {
      _pending(result);
      _pending = null;
    }
  },

  /** Clean up if scanner is cancelled */
  clear() {
    _pending = null;
  },
};
