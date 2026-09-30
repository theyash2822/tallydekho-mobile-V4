/**
 * Crash / error reporting. Sentry starts only when EXPO_PUBLIC_SENTRY_DSN is set,
 * so it stays off in dev and until the production DSN is configured.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
let enabled = false;

export function initMonitoring(): void {
  if (!__DEV__) {
    // Release builds: keep warn/error (Sentry breadcrumbs), drop chatty logs.
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
  }
  if (enabled || !DSN || __DEV__) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV || 'production',
    release: Constants.expoConfig?.version,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  enabled = true;
}

/** Report a caught error without surfacing it to the user. No-op until Sentry is on. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) console.warn('[reportError]', error, context);
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
