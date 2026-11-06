# EAS build profiles and environment variables

`eas.json` cannot carry comments, so the rules for each profile live here.
Source of truth for backend selection: `src/config/backend.ts` (`resolveAppEnv`,
`resolveBackendUrl`), guarded by `npm run verify:config`.

Security-audit references: SEC-048 (preview profile), SEC-049 (push project id),
SEC-050 (demo flag). Report: `security-audit/2026-11-06T040557Z`.

## Profiles

| Profile | `EXPO_PUBLIC_APP_ENV` | `EXPO_PUBLIC_BACKEND_URL` | Artifact | Purpose |
|---|---|---|---|---|
| `development` | *(unset → `development` because `__DEV__`)* | *(unset → LAN dev URL in `backend.ts`)* | dev-client APK / iOS simulator | Local development against the Mac on the LAN |
| `preview` | `staging` | `https://staging-api.tallydekho.com` | internal APK | QA / internal testers. **Never production**: a release bundle without `EXPO_PUBLIC_APP_ENV` would resolve to `production` and write QA data into real books (SEC-048) |
| `staging` | `staging` | `https://staging-api.tallydekho.com` | internal APK / iOS device | Same backend as `preview`; kept for iOS device builds |
| `production` | `production` | `https://api.tallydekho.com` | AAB (auto-increment) | Store release |

Rules enforced by `verify:config`:

- `staging` and `preview` must set `EXPO_PUBLIC_APP_ENV=staging` **and** an explicit
  non-production `EXPO_PUBLIC_BACKEND_URL`; a staging build refuses to fall back to
  production (`resolveBackendUrl` throws).
- `production` must set `EXPO_PUBLIC_APP_ENV=production`.
- The production host string appears only in `src/config/backend.ts`.

`app.config.ts` adds iOS `NSAllowsLocalNetworking` whenever
`EXPO_PUBLIC_APP_ENV !== 'production'`, so `preview`/`staging` builds can reach
plain-http LAN backends and the production build cannot.

## Environment variable inventory (`EXPO_PUBLIC_*` — all inlined into the JS bundle, none secret)

| Variable | Read in | Set by |
|---|---|---|
| `EXPO_PUBLIC_APP_ENV` | `src/config/backend.ts`, `app.config.ts` | `eas.json` profile `env` |
| `EXPO_PUBLIC_BACKEND_URL` | `src/config/backend.ts` | `eas.json` profile `env`; `.env` for local dev |
| `EXPO_PUBLIC_PROJECT_ID` | `src/services/pushProjectId.ts` | **EAS project environment variable — owner must set (see below)** |
| `EXPO_PUBLIC_SENTRY_DSN` | `src/services/monitoring.ts` | EAS project environment variable (optional; Sentry stays off without it) |
| `EXPO_PUBLIC_DEMO_MODE` | `src/demo/config.ts`, `app.config.ts` | Website demo web build only (`=1`). Inert on native since SEC-050 (`Platform.OS === 'web'` guard) |
| `EXPO_PUBLIC_DEMO_DATA_URL` | `src/demo/demoData.ts` | Website demo web build only |
| `EXPO_PUBLIC_CAMERA_DIAG_URL` | `src/services/cameraDiag.ts` | Dev-only diagnostics |

## Push notifications need the EAS project id (SEC-049) — owner action

`Notifications.getExpoPushTokenAsync({ projectId })` requires the EAS project id.
**No committed file supplies it**: `app.json` has no `extra.eas.projectId` and
`eas.json` sets no `EXPO_PUBLIC_PROJECT_ID`. Because the project uses a dynamic
config (`app.config.ts`), `eas init` will not write the id into `app.json`
automatically.

Until it is provided, every build logs
`[Push] No EAS project id …` (dev builds at startup, every build at registration)
and **never registers a push token** — notifications are silently off.

Do one of the following (the id is a public identifier, safe to commit):

1. Add it to `app.json`:

   ```json
   "extra": { "eas": { "projectId": "<uuid from https://expo.dev/accounts/<account>/projects/auditor>" } }
   ```

   (keep the existing `extra.router` entry), **or**

2. Create an EAS environment variable `EXPO_PUBLIC_PROJECT_ID=<uuid>` for the
   `preview`, `staging` and `production` environments
   (`eas env:create --scope project --name EXPO_PUBLIC_PROJECT_ID --value <uuid> --visibility plain`).

Resolution order in the app (`resolvePushProjectId`):
`EXPO_PUBLIC_PROJECT_ID` → `expoConfig.extra.eas.projectId` → `easConfig.projectId`.

After setting it, rebuild the native artifacts (no OTA/`expo-updates` in this app)
and confirm on a device that `POST /api/push-token` is sent after sign-in.

## Native rebuild required

None of the following reach users without a new EAS build: the `preview` profile
env, the project id, `expo-local-authentication` option changes
(`disableDeviceFallback`), and the export-cache sweep (uses `expo-file-system`,
already linked). There is no `expo-updates` in this app.
