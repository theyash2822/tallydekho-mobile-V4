/**
 * Development-only camera diagnostics (CAMERA_SCANNER_STANDARD §6).
 * Never logs barcodes, QR payloads, tokens, or customer data.
 *
 * Collector: optional via EXPO_PUBLIC_CAMERA_DIAG_URL. Failures never block preview.
 */

import { AppState, Platform } from 'react-native';

const TAG = '[CameraDiag]';

/** Deduplicate identical events within this window (ms). */
const DEDUPE_MS = 400;

export type CameraDiagEvent = {
  ts: number;
  instanceId: string;
  route?: string;
  event: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

/** Build marker so device logs prove which JS bundle is loaded. */
export const CAMERA_DIAG_BUILD = '2026-09-25-ios-retry-warm';

function collectorUrl(): string | null {
  if (!__DEV__) return null;
  const raw = process.env.EXPO_PUBLIC_CAMERA_DIAG_URL;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
}

const lastKey = new Map<string, number>();

function shouldEmit(instanceId: string, event: string, data?: CameraDiagEvent['data']): boolean {
  // Always emit lifecycle / errors
  if (
    event === 'onMountError'
    || event === 'screen_mount'
    || event === 'screen_unmount'
    || event === 'onCameraReady'
    || event === 'scan_fire'
    || event === 'scan_accept'
    || event === 'scan_reject_frame'
    || event === 'torch_auto_on'
  ) {
    return true;
  }
  const key = `${instanceId}|${event}|${JSON.stringify(data ?? null)}`;
  const now = Date.now();
  const prev = lastKey.get(key) ?? 0;
  if (now - prev < DEDUPE_MS) return false;
  lastKey.set(key, now);
  return true;
}

export function cameraDiag(
  instanceId: string,
  event: string,
  data?: Record<string, string | number | boolean | null | undefined>,
  route?: string,
): void {
  if (!__DEV__) return;
  if (!shouldEmit(instanceId, event, data)) return;

  const payload: CameraDiagEvent = {
    ts: Date.now(),
    instanceId,
    route,
    event,
    data: {
      build: CAMERA_DIAG_BUILD,
      platform: Platform.OS,
      appState: AppState.currentState,
      ...data,
    },
  };
  console.log(TAG, JSON.stringify(payload));

  const url = collectorUrl();
  if (!url) return;
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
