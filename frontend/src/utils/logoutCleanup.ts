import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  isAmbiguousLegacyDraftKey,
  isTenantStorageKey,
  LOGOUT_ALWAYS_REMOVE,
} from './tenantStorage';
import { clearLedgerCache } from './ledgerCache';
import { clearStockListCache } from './stockCache';

export async function sweepTenantAsyncStorage(): Promise<string[]> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem('auth_token');
      window.localStorage.removeItem('user_data');
    } catch { /* private mode */ }
  }
  let keys: string[] = [];
  try {
    keys = [...(await AsyncStorage.getAllKeys())];
  } catch {
    keys = [];
  }
  const scoped = keys.filter((k) => isTenantStorageKey(k) || isAmbiguousLegacyDraftKey(k));
  const remove = [...new Set([...LOGOUT_ALWAYS_REMOVE, ...scoped])];
  if (remove.length) await AsyncStorage.multiRemove(remove);
  clearLedgerCache();
  clearStockListCache();
  return remove;
}

export function wouldSweepKey(key: string): boolean {
  return LOGOUT_ALWAYS_REMOVE.includes(key) || isTenantStorageKey(key) || isAmbiguousLegacyDraftKey(key);
}
