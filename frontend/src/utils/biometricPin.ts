import * as SecureStore from 'expo-secure-store';
import { markBiometricPinDowngrade } from './biometricPinNotice';

const LEGACY_KEY = 'td_biometric_pin';

/**
 * The PIN never leaves this device (no iCloud keychain / backup) and is readable only
 * while the device is unlocked. The app gates reads with its own Face ID / Touch ID
 * prompt (verify-pin, biometric only — no device-passcode fallback), so
 * `requireAuthentication` is deliberately off (owner decision): turning it on makes
 * the OS show a second prompt at every unlock. Devices that reject these options
 * fall back to a plain keychain item, as before; the downgrade is logged and
 * surfaced once to the user through `biometricPinNotice` (SEC-031).
 */
const PIN_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

let _warnedFallback = false;
function warnFallback(stage: 'set' | 'get', err: unknown) {
  markBiometricPinDowngrade(stage);
  if (_warnedFallback) return;
  _warnedFallback = true;
  console.warn(`[biometricPin] protected keychain ${stage} failed; using unprotected item`, err);
}

function normalizePhone(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '');
}

/** SecureStore keys may only hold letters, digits, ".", "-" and "_". */
export function biometricPinKey(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  return digits ? `${LEGACY_KEY}_${digits}` : LEGACY_KEY;
}

export async function setBiometricPin(phone: string | null | undefined, pin: string): Promise<void> {
  const key = biometricPinKey(phone);
  if (key === LEGACY_KEY) return;
  try {
    await SecureStore.setItemAsync(key, pin, PIN_STORE_OPTIONS);
  } catch (err) {
    warnFallback('set', err);
    await SecureStore.setItemAsync(key, pin);
  }
  try { await SecureStore.deleteItemAsync(LEGACY_KEY); } catch { /* ignore */ }
}

export async function getBiometricPin(
  phone: string | null | undefined,
  authenticationPrompt?: string,
): Promise<string | null> {
  const key = biometricPinKey(phone);
  if (key === LEGACY_KEY) return null;
  try {
    const scoped = await SecureStore.getItemAsync(
      key,
      authenticationPrompt ? { ...PIN_STORE_OPTIONS, authenticationPrompt } : PIN_STORE_OPTIONS,
    );
    if (scoped) return scoped;
  } catch (err) {
    // Older installs stored the PIN without protection; a device without a secure
    // enclave cannot evaluate the options at all. Either way, read the plain item.
    warnFallback('get', err);
    try {
      const plain = await SecureStore.getItemAsync(key);
      if (plain) return plain;
    } catch { /* ignore */ }
  }
  // Never submit a device-global leftover PIN for a different user.
  try { await SecureStore.deleteItemAsync(LEGACY_KEY); } catch { /* ignore */ }
  return null;
}

export async function clearBiometricPin(phone?: string | null): Promise<void> {
  try { await SecureStore.deleteItemAsync(LEGACY_KEY); } catch { /* ignore */ }
  if (phone) {
    try { await SecureStore.deleteItemAsync(biometricPinKey(phone)); } catch { /* ignore */ }
  }
}
