/**
 * Screens refetch when the data revision moves. Only a verified sync moves it — the desktop
 * heartbeat (`last_seen`) is presence, not data (R6 / W2). Free of React Native imports so
 * scripts/verify-mobile-remediation.mjs can run it.
 */
export function nextDataRevision(prevMs: number, status: any): number {
  const secs = Number(status?.device?.last_sync_at);
  if (!Number.isFinite(secs) || secs <= 0) return prevMs;
  const ms = secs * 1000;
  return ms > prevMs ? ms : prevMs;
}
