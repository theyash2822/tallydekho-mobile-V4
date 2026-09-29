/**
 * Shared camera ownership gate (CAMERA_SCANNER_STANDARD §4).
 * Mount CameraView when permission + focus + foreground + valid bounds.
 *
 * iOS (c1cef8f8 + 2026-09-25): mount preview immediately so AVFoundation warms up,
 * but delay enabling onBarcodeScanned (~450ms) — early barcode frames are unreliable.
 * Delaying the whole CameraView made the first aim feel dead.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { useIsFocused } from 'expo-router';

export type CameraBounds = { w: number; h: number };

/** iOS settle before attaching barcode listener (June 10). */
export const IOS_BARCODE_LISTEN_SETTLE_MS = 450;

/** @deprecated use IOS_BARCODE_LISTEN_SETTLE_MS — kept for call-site compatibility */
export const IOS_CAMERA_SETTLE_MS = IOS_BARCODE_LISTEN_SETTLE_MS;

export function useAppForeground(): boolean {
  const [fg, setFg] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const onChange = (next: AppStateStatus) => setFg(next === 'active');
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);
  return fg;
}

/** Unique id per component mount so overlapping instances are distinguishable in logs. */
export function useCameraMountId(scannerName: string): string {
  const idRef = useRef(`${scannerName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  return idRef.current;
}

/**
 * @param permissionGranted from useCameraPermissions().granted
 * @param bounds measured camera host; required when measured sizing is used
 * @param scannerOpen for Modal scanners — pass showCamera; stack screens default true
 * @param iosSettleMs delay before barcodeListenReady on iOS (default 450)
 */
export function useCameraOwnerGate(opts: {
  permissionGranted: boolean;
  bounds: CameraBounds;
  scannerOpen?: boolean;
  iosSettleMs?: number;
}): {
  isFocused: boolean;
  appForeground: boolean;
  boundsReady: boolean;
  gateOpen: boolean;
  /** Mount CameraView as soon as the gate opens (preview warm-up). */
  mountCamera: boolean;
  /** Attach onBarcodeScanned only after iOS settle (Android: same as mount). */
  barcodeListenReady: boolean;
} {
  const isFocused = useIsFocused();
  const appForeground = useAppForeground();
  const scannerOpen = opts.scannerOpen !== false;
  const boundsReady = opts.bounds.w > 0 && opts.bounds.h > 0;
  const iosSettleMs = opts.iosSettleMs ?? IOS_BARCODE_LISTEN_SETTLE_MS;

  const gateOpen = useMemo(
    () =>
      !!opts.permissionGranted
      && isFocused
      && appForeground
      && scannerOpen
      && boundsReady,
    [opts.permissionGranted, isFocused, appForeground, scannerOpen, boundsReady],
  );

  // Preview mounts immediately with the gate
  const mountCamera = gateOpen;

  const [barcodeListenReady, setBarcodeListenReady] = useState(Platform.OS !== 'ios');

  useEffect(() => {
    if (!gateOpen) {
      setBarcodeListenReady(false);
      return;
    }
    if (Platform.OS !== 'ios' || iosSettleMs <= 0) {
      setBarcodeListenReady(true);
      return;
    }
    setBarcodeListenReady(false);
    const t = setTimeout(() => setBarcodeListenReady(true), iosSettleMs);
    return () => clearTimeout(t);
  }, [gateOpen, iosSettleMs]);

  return {
    isFocused,
    appForeground,
    boundsReady,
    gateOpen,
    mountCamera,
    barcodeListenReady,
  };
}
