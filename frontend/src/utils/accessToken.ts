/**
 * Access token storage — one implementation for api.ts and AuthContext.
 *
 * Native: the token lives in the device keychain (expo-secure-store, key
 * `td_access_token`), like the refresh token and the PIN. Older installs kept it
 * in AsyncStorage under `auth_token`; the first read after upgrade copies that
 * value into SecureStore and deletes the AsyncStorage copy.
 *
 * Web: `window.localStorage` (unchanged — the existing platform branch) with the
 * AsyncStorage mirror kept for code that still reads it there.
 *
 * If the keychain is unavailable (no secure enclave / simulator quirk) the
 * helpers fall back to AsyncStorage so sign-in keeps working, with a warning.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** New keychain key. */
export const ACCESS_TOKEN_SECURE_KEY = 'td_access_token';
/** Legacy AsyncStorage / localStorage key (still swept on logout). */
export const ACCESS_TOKEN_LEGACY_KEY = 'auth_token';

let _warnedNoKeychain = false;
function warnNoKeychain(err: unknown) {
  if (_warnedNoKeychain) return;
  _warnedNoKeychain = true;
  console.warn('[accessToken] SecureStore unavailable; falling back to AsyncStorage', err);
}

export async function readAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      const t = window.localStorage.getItem(ACCESS_TOKEN_LEGACY_KEY);
      if (t) return t;
    } catch { /* private mode: fall through */ }
    try { return await AsyncStorage.getItem(ACCESS_TOKEN_LEGACY_KEY); } catch { return null; }
  }

  let secureOk = true;
  try {
    const secure = await SecureStore.getItemAsync(ACCESS_TOKEN_SECURE_KEY);
    if (secure) return secure;
  } catch (err) {
    secureOk = false;
    warnNoKeychain(err);
  }

  // One-time migration from the pre-2026-11 AsyncStorage location.
  let legacy: string | null = null;
  try { legacy = await AsyncStorage.getItem(ACCESS_TOKEN_LEGACY_KEY); } catch { legacy = null; }
  if (legacy && secureOk) {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_SECURE_KEY, legacy);
      await AsyncStorage.removeItem(ACCESS_TOKEN_LEGACY_KEY).catch(() => {});
    } catch (err) {
      warnNoKeychain(err);
    }
  }
  return legacy;
}

export async function writeAccessToken(token: string): Promise<void> {
  const value = String(token);
  if (Platform.OS === 'web') {
    try { window.localStorage.setItem(ACCESS_TOKEN_LEGACY_KEY, value); } catch { /* private mode */ }
    await AsyncStorage.setItem(ACCESS_TOKEN_LEGACY_KEY, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_SECURE_KEY, value);
    await AsyncStorage.removeItem(ACCESS_TOKEN_LEGACY_KEY).catch(() => {});
  } catch (err) {
    warnNoKeychain(err);
    await AsyncStorage.setItem(ACCESS_TOKEN_LEGACY_KEY, value);
  }
}

export async function deleteAccessToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try { window.localStorage.removeItem(ACCESS_TOKEN_LEGACY_KEY); } catch { /* private mode */ }
  } else {
    try { await SecureStore.deleteItemAsync(ACCESS_TOKEN_SECURE_KEY); } catch { /* no keychain */ }
  }
  await AsyncStorage.removeItem(ACCESS_TOKEN_LEGACY_KEY).catch(() => {});
}
