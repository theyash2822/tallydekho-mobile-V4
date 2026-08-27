import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  getDeviceOnline,
  setDeviceOnline,
  subscribeDeviceOnline,
} from '../services/apiErrors';

/**
 * Device network online status (distinct from desktop/Tally `isDesktopOnline`).
 * Web: navigator.onLine. Native: tracks fetch success/failure via api layer + AppState resume.
 */
export function useDeviceOnline(): boolean {
  const [online, setOnline] = useState(getDeviceOnline);

  useEffect(() => {
    const unsub = subscribeDeviceOnline(setOnline);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const sync = () => setDeviceOnline(!!navigator.onLine);
      sync();
      window.addEventListener('online', sync);
      window.addEventListener('offline', sync);
      return () => {
        unsub();
        window.removeEventListener('online', sync);
        window.removeEventListener('offline', sync);
      };
    }

    const sub = AppState.addEventListener('change', (state) => {
      // On resume, don't force offline — next successful request will clear it
      if (state === 'active' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
        setDeviceOnline(!!(navigator as any).onLine);
      }
    });

    return () => {
      unsub();
      sub.remove();
    };
  }, []);

  return online;
}
