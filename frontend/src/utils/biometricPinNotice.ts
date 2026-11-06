/**
 * Keychain-downgrade notice for the biometric PIN (SEC-031).
 *
 * `biometricPin.ts` falls back to an unprotected keychain item when the device
 * refuses the protected options. That used to happen silently. It now records
 * the downgrade here and the verify-pin screen shows a one-time, non-blocking
 * notice the next time it reads or writes the PIN.
 *
 * Pure module (no React Native imports) so it can be unit-tested with node.
 */
export type BiometricPinDowngradeStage = 'set' | 'get';

let _pending: BiometricPinDowngradeStage | null = null;
let _shown = false;

/** Called by biometricPin when the protected keychain write/read failed. */
export function markBiometricPinDowngrade(stage: BiometricPinDowngradeStage): void {
  if (_shown) return;
  if (!_pending) _pending = stage;
}

/**
 * Returns the stage of a recorded downgrade exactly once; later calls return null
 * until the process restarts. The caller shows the notice.
 */
export function takeBiometricPinDowngradeNotice(): BiometricPinDowngradeStage | null {
  if (_shown || !_pending) return null;
  const stage = _pending;
  _pending = null;
  _shown = true;
  return stage;
}

/** True while a downgrade has been recorded and not yet surfaced. */
export function hasPendingBiometricPinDowngrade(): boolean {
  return !_shown && _pending != null;
}

/** Test helper: forget any recorded downgrade. */
export function resetBiometricPinDowngradeNotice(): void {
  _pending = null;
  _shown = false;
}
