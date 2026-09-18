// ============================================================
// Backend endpoint — single source of truth.
//
// Previously duplicated in services/api.ts and context/AuthContext.tsx, which
// meant an EAS profile could point one at staging and the other at production.
//
// Selection is build-time (EXPO_PUBLIC_* is inlined by Expo):
//   EXPO_PUBLIC_BACKEND_URL  explicit backend for this build (EAS profile env)
//   EXPO_PUBLIC_APP_ENV      environment identity: production | staging | development
// ============================================================

export type AppEnv = 'production' | 'staging' | 'development';

export const PRODUCTION_BACKEND_URL = 'https://api.tallydekho.com';
const DEV_LAN_BACKEND_URL = 'http://192.168.29.243:3001';

const PRODUCTION_HOST_PATTERN = /^api\.tallydekho\.com$/i;

export function resolveAppEnv(
  env: Record<string, string | undefined> = process.env as never,
  isDev: boolean = __DEV__
): AppEnv {
  const explicit = String(env.EXPO_PUBLIC_APP_ENV || '').trim().toLowerCase();
  if (explicit === 'production' || explicit === 'staging' || explicit === 'development') {
    return explicit;
  }
  return isDev ? 'development' : 'production';
}

function hostOf(url: string): string {
  const match = /^[a-z]+:\/\/([^/:]+)/i.exec(String(url || '').trim());
  return match ? match[1] : '';
}

/**
 * A staging build must never silently fall back to production: it would sync and
 * write real customer data during QA. The old fallback chain did exactly that
 * whenever EXPO_PUBLIC_BACKEND_URL was missing from a release build.
 */
export function resolveBackendUrl(
  env: Record<string, string | undefined> = process.env as never,
  isDev: boolean = __DEV__
): string {
  const appEnv = resolveAppEnv(env, isDev);
  const explicit = String(env.EXPO_PUBLIC_BACKEND_URL || '').trim().replace(/\/+$/, '');

  if (appEnv === 'staging') {
    if (!explicit) {
      throw new Error(
        'EXPO_PUBLIC_APP_ENV=staging requires EXPO_PUBLIC_BACKEND_URL. ' +
          'Refusing to fall back to the production backend.'
      );
    }
    if (PRODUCTION_HOST_PATTERN.test(hostOf(explicit))) {
      throw new Error(
        `EXPO_PUBLIC_APP_ENV=staging is pointed at the production backend (${explicit}).`
      );
    }
    return explicit;
  }

  if (explicit) return explicit;
  return appEnv === 'development' ? DEV_LAN_BACKEND_URL : PRODUCTION_BACKEND_URL;
}

export const APP_ENV: AppEnv = resolveAppEnv();
export const BACKEND_URL: string = resolveBackendUrl();

/** True when this build talks to a non-production backend (badge/telemetry use). */
export const IS_NON_PRODUCTION_BUILD = APP_ENV !== 'production';
