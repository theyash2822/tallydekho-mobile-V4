/**
 * EAS project id for push registration (SEC-049) — pure, node-testable.
 *
 * `Notifications.getExpoPushTokenAsync` needs the EAS project id. No committed
 * config supplies it (see docs/eas-profiles.md): the owner must provide
 * `EXPO_PUBLIC_PROJECT_ID` (EAS env) or `extra.eas.projectId` (app.json). The
 * app cannot invent it, so it resolves what it finds and warns in development
 * when nothing is there — a release build would silently never register.
 */
export interface PushProjectIdSources {
  env?: Record<string, string | undefined>;
  /** `Constants.expoConfig?.extra` */
  extra?: { eas?: { projectId?: string | null } | null } | null;
  /** `Constants.easConfig` */
  easConfig?: { projectId?: string | null } | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** First non-empty source wins: env → app config `extra.eas.projectId` → easConfig. */
export function resolvePushProjectId(src: PushProjectIdSources): string | null {
  const candidates = [
    src.env?.EXPO_PUBLIC_PROJECT_ID,
    src.extra?.eas?.projectId,
    src.easConfig?.projectId,
  ];
  for (const c of candidates) {
    const v = String(c ?? '').trim();
    if (v) return v;
  }
  return null;
}

export function isPlausibleProjectId(id: string | null | undefined): boolean {
  return !!id && UUID_RE.test(id);
}

export const PUSH_PROJECT_ID_WARNING =
  '[Push] No EAS project id: set EXPO_PUBLIC_PROJECT_ID (EAS env) or extra.eas.projectId (app.json). ' +
  'Push registration is skipped in this build — see docs/eas-profiles.md.';

/** Message to log at startup, or null when the configuration is complete. */
export function pushProjectIdStartupWarning(src: PushProjectIdSources): string | null {
  return resolvePushProjectId(src) ? null : PUSH_PROJECT_ID_WARNING;
}
