/**
 * Callback bridge: stocks/barcodes.tsx ←→ stocks/barcode-scanner.tsx
 *
 * Full-screen route (NOT Modal) so CameraView paints frames on iOS.
 * Jun 11 scanner UI lives on the route; list screen only receives the result.
 */

export type StocksScanResult =
  | { found: true; barcode: string; item: any }
  | { found: false; barcode: string };

type ScanCallback = (result: StocksScanResult) => void;

let _pending: ScanCallback | null = null;

export const stocksBarcodeScan = {
  set(cb: ScanCallback) {
    _pending = cb;
  },
  resolve(result: StocksScanResult) {
    if (_pending) {
      _pending(result);
      _pending = null;
    }
  },
  clear() {
    _pending = null;
  },
};
