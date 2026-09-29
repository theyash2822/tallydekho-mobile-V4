/**
 * useBarcodeScanner.ts
 *
 * Encapsulates barcode scan state + lookup.
 * Locks while looking up / after a found hit; auto-unlocks after a miss so
 * iOS can take a second aim without tapping Scan Again.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Vibration } from 'react-native';
import { lookupBarcode } from '../services/api';

/** After not-found / error, re-arm the camera listener (ms). */
export const SCAN_RETRY_UNLOCK_MS = 1600;

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
  const isProcessingRef = useRef(false);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanned,       setScanned]       = useState(false);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scanResult,    setScanResult]    = useState<ScanResult | null>(null);

  const clearUnlockTimer = useCallback(() => {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearUnlockTimer(), [clearUnlockTimer]);

  /** Re-arm listening after a miss; keep not-found panel until next accept / Scan Again. */
  const scheduleRetryUnlock = useCallback(() => {
    clearUnlockTimer();
    unlockTimerRef.current = setTimeout(() => {
      unlockTimerRef.current = null;
      isProcessingRef.current = false;
      setScanned(false);
    }, SCAN_RETRY_UNLOCK_MS);
  }, [clearUnlockTimer]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      clearUnlockTimer();

      setScanned(true);
      Vibration.vibrate(80);
      setScanLookingUp(true);
      setScanResult(null);

      if (!companyGuid) {
        setScanLookingUp(false);
        setScanResult({ found: false, barcode: data });
        scheduleRetryUnlock();
        return;
      }
      try {
        const res = await lookupBarcode(companyGuid, data);
        const d = res?.data ?? res;
        const item = d?.item;
        const stockGuid = item?.stockGuid || item?.guid || item?.id;
        if (d?.found && item && stockGuid) {
          setScanResult({
            found: true,
            barcode: data,
            item: { ...item, stockGuid: String(stockGuid) },
          });
          // Stay locked until Scan Again / navigate away
        } else {
          setScanResult({ found: false, barcode: data });
          scheduleRetryUnlock();
        }
      } catch {
        setScanResult({ found: false, barcode: data });
        scheduleRetryUnlock();
      } finally {
        setScanLookingUp(false);
      }
    },
    [companyGuid, clearUnlockTimer, scheduleRetryUnlock],
  );

  const resetScanner = useCallback(() => {
    clearUnlockTimer();
    isProcessingRef.current = false;
    setScanned(false);
    setScanResult(null);
    setScanLookingUp(false);
  }, [clearUnlockTimer]);

  return {
    scanned,
    scanLookingUp,
    scanResult,
    handleBarcodeScanned,
    resetScanner,
    isProcessingRef,
  };
}
