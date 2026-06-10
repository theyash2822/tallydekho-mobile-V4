/**
 * useBarcodeScanner.ts
 *
 * Encapsulates all barcode scan state + lookup logic.
 * Keeps camera callback clean — no inline API calls in UI.
 */

import { useState, useRef, useCallback } from 'react';
import { Vibration } from 'react-native';
import { lookupBarcode } from '../services/api';

export interface ScanResultItem {
  stockGuid:   string;
  displayName: string;
  currentQty:  number;
  unit:        string;
  sku:         string | null;
  groupName:   string | null;
  [key: string]: any;
}

export interface ScanResult {
  found:   boolean;
  barcode: string;
  item?:   ScanResultItem;
}

export function useBarcodeScanner(companyGuid: string | undefined) {
  // Ref-based guard: synchronous, no stale-closure issues.
  // Camera fires onBarcodeScanned many times per second — ref blocks all
  // subsequent calls after the first one until resetScanner() is called.
  const isProcessingRef = useRef(false);

  const [scanned,       setScanned]       = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scanResult,    setScanResult]    = useState<ScanResult | null>(null);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setScanned(true);
      Vibration.vibrate(80);
      setScanLookingUp(true);
      setScanResult(null);

      if (!companyGuid) {
        setScanLookingUp(false);
        isProcessingRef.current = false;
        return;
      }
      try {
        const res = await lookupBarcode(companyGuid, data);
        const d = res?.data ?? res;
        if (d?.found && d?.item?.stockGuid) {
          setScanResult({ found: true, barcode: data, item: d.item });
        } else {
          setScanResult({ found: false, barcode: data });
        }
      } catch {
        setScanResult({ found: false, barcode: data });
      } finally {
        setScanLookingUp(false);
        // isProcessingRef stays true until resetScanner() — prevents duplicate API calls
      }
    },
    [companyGuid],
  );

  const resetScanner = useCallback(() => {
    isProcessingRef.current = false;
    setScanned(false);
    setScanResult(null);
    setScanLookingUp(false);
  }, []);

  return {
    scanned,
    scanLookingUp,
    scanResult,
    handleBarcodeScanned,
    resetScanner,
    isProcessingRef,
  };
}
