# Security remediation — mobile (2026-11-06)

Source: `security-audit/2026-11-06T040557Z/SECURITY_AUDIT_REPORT.md` §D and
`parts/MOB-mobile.md`. Branch `6-11-2026`, base `8d594be6`. No push, no native build.
Guard: `npm run verify:security` (`scripts/verify-security-2026-11-06.mjs`), now part of `npm test`.

| Finding | Status | Change |
|---|---|---|
| SEC-030 | Fixed | `socketService.ts`: JWT only in handshake `auth`; `query.token` removed. Backend `socketHandler.js` reads no handshake field at all — it authenticates on the `register` event — so nothing else needs to change. |
| SEC-031 | Fixed (hardening; `requireAuthentication` stays off by owner decision) | `verify-pin.tsx`: `disableDeviceFallback: true` (biometric only; typing the PIN remains the in-app fallback). `biometricPin.ts` records a keychain downgrade in new `biometricPinNotice.ts`; `verify-pin.tsx` shows a one-time non-blocking toast (`auth.keychainDowngradeTitle/Body`, en + fallback) instead of staying silent. |
| SEC-032 | Fixed | New `tempFiles.ts` (`deleteTempFile`, `withTempFile`, `sweepExportCache`) + pure `exportCacheSweep.ts`. Every share site (`voucherPdf.ts` via `presentPdfAndDiscard`, `multiShare.ts`, `complianceActions.ts` JSON/CSV, `label-preview`, `print-settings`, `voucher-config`, `barcodes`) deletes its generated file once the share sheet closes; pdf-lib merge inputs deleted after merging. `logoutCleanup.ts` sweeps `<cache>/*.pdf|*.csv|*.json|IRN-*` and `<cache>/Print/` on sign-out. Sweep tested against a temp directory. |
| SEC-033 | Fixed | New `services/apiPath.ts` `seg()`; all 14 path interpolations in `api.ts` now `${seg(...)}`. Static guard: every `${…}` in an `api.ts` path template must be `seg(`/`encodeURIComponent(`. |
| SEC-029 (mobile) | Fixed | `documentHelpers.ts`: `_generateFormat2HTML`, `_generateFormat3HTML`, `_bankBlock` deleted; every non-accounting/commercial type (`stock_journal`) renders through the escaped `renderTallyHTML`. Test renders a stock journal with `<img src=x onerror=…>` in company/party/item names and asserts it is escaped. `tallyLayout.ts` / `voucher-print/shared.ts`: type-only imports became `import type` so the engine is node-importable (no runtime change). |
| SEC-041 | Fixed / verified | New `utils/userInfoStore.ts` (SecureStore `td_user_info` on native, one-time migration from AsyncStorage `user_info`, AsyncStorage/localStorage branch kept on web, keychain-failure fallback like `accessToken.ts`). `AuthContext.tsx`, `register.tsx`, `onboardingNav.ts` use it; sign-out deletes the keychain copy; legacy key still in `LOGOUT_ALWAYS_REMOVE`. Help-chat transcripts: TTL already 24 h and keys `td_help_chat_*` already swept — asserted by the guard. |
| SEC-048 | Fixed (profile part) | `eas.json` `preview`: `EXPO_PUBLIC_APP_ENV=staging`, `EXPO_PUBLIC_BACKEND_URL=https://staging-api.tallydekho.com`, Sentry upload off. New `docs/eas-profiles.md` documents every profile and env var. The access-token AsyncStorage downgrade noted in the same finding is unchanged (out of scope). |
| SEC-050 | Fixed | `demo/config.ts`: `DEMO_MODE = Platform.OS === 'web' && EXPO_PUBLIC_DEMO_MODE === '1'`. |
| SEC-049 | Mitigated; owner action required | New pure `services/pushProjectId.ts`; `pushNotifications.ts` resolves the id through it and `app/_layout.tsx` logs a dev-only startup warning when none is configured. The id itself cannot be committed from here — see `docs/eas-profiles.md` (`extra.eas.projectId` or EAS env `EXPO_PUBLIC_PROJECT_ID`). |

## Verification

- `npx tsc --noEmit` — 0 errors
- `npm test` — all 10 verify scripts pass (121 PASS, 0 FAIL)
- `npx eslint app src` — 0 errors (pre-existing warnings only; none in touched files)
- `npx expo config --type public` — name `Auditer`, slug `auditor`, scheme `auditor`, ids `com.tallydekho.app` unchanged

## Owner follow-ups

- Rebuild native artifacts (no OTA in this app) to ship the biometric option, export cleanup and preview env.
- Provide the EAS project id (SEC-049) — `docs/eas-profiles.md`.
- Backend: no change needed for SEC-030 (`socketHandler.js` never read the handshake query).
