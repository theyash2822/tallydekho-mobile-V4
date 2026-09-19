import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const SECURE_KEY = 'td_pre_auth_token';
const LEGACY_KEY = 'pre_auth_token';

export async function setPreAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEY, token);
  } catch { /* no keychain */ }
  await AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
}

export async function getPreAuthToken(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(SECURE_KEY);
    if (secure) return secure;
  } catch { /* fall through */ }
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      await setPreAuthToken(legacy);
      return legacy;
    }
  } catch { /* ignore */ }
  return null;
}

export async function clearPreAuthToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(SECURE_KEY); } catch { /* ignore */ }
  await AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
}
