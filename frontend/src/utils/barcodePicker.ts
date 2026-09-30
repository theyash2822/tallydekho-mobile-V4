/**
 * barcodePicker.ts
 *
 * Module-level callback store that lets barcode-scanner.tsx (mode=pick) pass its
 * result back to the create-invoice / create-order screens without React
 * navigation params or context.
 *
 * Usage:
 *   // create-invoice — before navigating to scanner
 *   barcodePicker.set((result) => { ...fill item... });
 *   router.push('/stocks/barcode-scanner?mode=pick');
 *
 *   // barcode-scanner — after successful lookup
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
