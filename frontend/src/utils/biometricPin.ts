import * as SecureStore from 'expo-secure-store';

const LEGACY_KEY = 'td_biometric_pin';

function normalizePhone(phone: string | null | undefined): string {
  return String(phone || '').replace(/\D/g, '');
}

export function biometricPinKey(phone: string | null | undefined): string {
  const digits = normalizePhone(phone);
  return digits ? `${LEGACY_KEY}:${digits}` : LEGACY_KEY;
}

export async function setBiometricPin(phone: string | null | undefined, pin: string): Promise<void> {
  const key = biometricPinKey(phone);
  if (key === LEGACY_KEY) return;
  await SecureStore.setItemAsync(key, pin);
  try { await SecureStore.deleteItemAsync(LEGACY_KEY); } catch { /* ignore */ }
}

export async function getBiometricPin(phone: string | null | undefined): Promise<string | null> {
  const key = biometricPinKey(phone);
  if (key === LEGACY_KEY) return null;
  try {
    const scoped = await SecureStore.getItemAsync(key);
    if (scoped) return scoped;
  } catch { /* ignore */ }
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
