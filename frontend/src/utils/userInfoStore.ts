/**
 * Signed-in identity storage (SEC-041) — same shape as utils/accessToken.ts.
 *
 * Native: `{ id, name, phone, email, language }` lives in the device keychain
 * (expo-secure-store, key `td_user_info`). Older installs kept it in AsyncStorage
 * under `user_info`; the first read after upgrade copies that value into
 * SecureStore and deletes the AsyncStorage copy.
 *
 * Web: AsyncStorage (`window.localStorage`-backed) under the legacy key, unchanged.
 *
 * If the keychain is unavailable the helpers fall back to AsyncStorage so sign-in
 * keeps working, with one warning — identical to the access-token helper.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Keychain key. */
export const USER_INFO_SECURE_KEY = 'td_user_info';
/** Legacy AsyncStorage / localStorage key (still swept on logout via LOGOUT_ALWAYS_REMOVE). */
export const USER_INFO_LEGACY_KEY = 'user_info';

export interface StoredUserInfo {
  id?: number | string;
  name?: string;
  phone?: string;
  email?: string;
  language?: string;
}

let _warnedNoKeychain = false;
function warnNoKeychain(err: unknown) {
  if (_warnedNoKeychain) return;
  _warnedNoKeychain = true;
  console.warn('[userInfo] SecureStore unavailable; falling back to AsyncStorage', err);
}

function parse(raw: string | null | undefined): StoredUserInfo | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as StoredUserInfo) : null;
  } catch {
    return null;
  }
}

/** Raw JSON string, for callers that previously read AsyncStorage directly. */
export async function readUserInfoRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return await AsyncStorage.getItem(USER_INFO_LEGACY_KEY); } catch { return null; }
  }

  let secureOk = true;
  try {
    const secure = await SecureStore.getItemAsync(USER_INFO_SECURE_KEY);
    if (secure) return secure;
  } catch (err) {
    secureOk = false;
    warnNoKeychain(err);
  }

  // One-time migration from the pre-2026-11 AsyncStorage location.
  let legacy: string | null = null;
  try { legacy = await AsyncStorage.getItem(USER_INFO_LEGACY_KEY); } catch { legacy = null; }
  if (legacy && secureOk) {
    try {
      await SecureStore.setItemAsync(USER_INFO_SECURE_KEY, legacy);
      await AsyncStorage.removeItem(USER_INFO_LEGACY_KEY).catch(() => {});
    } catch (err) {
      warnNoKeychain(err);
    }
  }
  return legacy;
}

export async function readUserInfo(): Promise<StoredUserInfo | null> {
  return parse(await readUserInfoRaw());
}

export async function writeUserInfo(info: StoredUserInfo): Promise<void> {
  const value = JSON.stringify(info);
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(USER_INFO_LEGACY_KEY, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(USER_INFO_SECURE_KEY, value);
    await AsyncStorage.removeItem(USER_INFO_LEGACY_KEY).catch(() => {});
  } catch (err) {
    warnNoKeychain(err);
    await AsyncStorage.setItem(USER_INFO_LEGACY_KEY, value);
  }
}

export async function deleteUserInfo(): Promise<void> {
  if (Platform.OS !== 'web') {
    try { await SecureStore.deleteItemAsync(USER_INFO_SECURE_KEY); } catch { /* no keychain */ }
  }
  await AsyncStorage.removeItem(USER_INFO_LEGACY_KEY).catch(() => {});
}
