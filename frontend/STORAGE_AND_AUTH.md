# STORAGE_AND_AUTH.md — tallydekho-mobile-V4

## Auth Context
File: `src/context/AuthContext.tsx`
Provides: `{ isAuthenticated, isLoading, user, company, isDesktopOnline, selectedFY }`

Auth is user identity only. **Pairing is not here** — it belongs to the selected
workspace (`useWorkspace().pairingStatus` / `tallyConnected`), because one user
can own an unpaired workspace and be a member of a paired one at the same time.

## Storage Keys (AsyncStorage)
| Key | Type | Content |
|-----|------|---------|
| auth_token | string | JWT access token (15 min) |
| user_data | string (JSON) | {id, name, phone, email, language} |
| company_data | string (JSON) | {guid, name, gstin} |
| user_info | string (JSON) | Additional user info |
| active_workspace_id | string | Selected workspace |
| ws:&lt;id&gt;:company_data / :selected_fy | string (JSON) | Per-workspace selection |

`is_paired` was removed (2026-09-18). It is only swept from AsyncStorage on
logout so older installs shed it.

## Storage Keys (SecureStore / keychain)
| Key | Content |
|-----|---------|
| td_refresh_token | Refresh token — never AsyncStorage |
| biometric_pin | PIN revealed behind device biometrics |

## Web Fallback
On web (Expo Web), storage uses `window.localStorage` with same keys as fallback.

## Token Flow
1. User enters phone → POST /api/auth/send-otp
2. User enters OTP → POST /api/auth/verify-otp
   - If 2FA enabled → returns `pre_auth_token` + `requires_2fa: true`
   - If no 2FA → returns `access_token` directly
3. If 2FA: verify PIN → POST /api/auth/verify-pin (with pre_auth_token)
4. Store `access_token` in AsyncStorage as `auth_token`, `refresh_token` in SecureStore
5. All subsequent requests use: `Authorization: Bearer <token>`
6. On 401, `api.ts` refreshes once via POST /api/auth/refresh and replays the
   request. Only a rejected refresh signs the user out; 403 never does.

## Bootstrap on App Start
`app/_layout.tsx` → `useEffect` → `getMe()` → `GET /api/auth/me`
Restores: company and user info from server on cold start. The `is_paired` field
in that response is ignored — pairing comes from the workspace context.

## Auth Guards
`app/_layout.tsx` → `RootNavigation` component:
- `!isAuthenticated` → redirect to `(auth)/index`
- `isAuthenticated` → redirect to `(tabs)` main app

## FY Selection
`selectedFY` in AuthContext = FYInfo object
Convert to backend param: `fyInfoToParam(selectedFY)` → "2025-2026"
Pass to all API calls as: `?fy=2025-2026`

## Company Selection
`company` in AuthContext = { guid, name, gstin }
All API calls require: `?companyGuid=<company.guid>`
Restored on bootstrap via getMe() or set during pairing.

## Pairing State
Per workspace, owned by `src/context/WorkspaceContext.tsx`:
- `pairingStatus` — `UNPAIRED` | `RECONNECTING` | `CONNECTED` (server truth)
- `tallyConnected` — `CONNECTED` only; the single test for "live Tally books"
- `demoMode` — `UNPAIRED` or `RECONNECTING`; PairingBanner shows here

Every async read in WorkspaceContext captures a generation counter before its
first `await` and discards its result if the user switched workspace meanwhile.

## Socket Service
`src/services/socketService.ts`
Connects to backend WebSocket on login.
Workspace-scoped events (`synced`, `paired`, `unpaired`, `tally_connection`,
access/hard-sync/restore) are dropped unless `payload.workspaceId` equals
`getActiveWorkspaceId()` at delivery time; a payload with no workspaceId is
dropped too. The rule lives in `src/services/workspaceEventScope.ts`.
`invitation_received` is user-scoped and never filtered.

## Security Notes
- Token never logged or exposed
- Pre-auth token (2FA) is short-lived (5 minutes)
- PIN stored hashed on backend (never in AsyncStorage)
- Refresh token in SecureStore only; cleared on logout with the tenant keys
- Biometric: native device auth gates PIN reveal (Needs verification on exact impl)
