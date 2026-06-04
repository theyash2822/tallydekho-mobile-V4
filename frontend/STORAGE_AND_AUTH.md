# STORAGE_AND_AUTH.md — tallydekho-mobile-V4

## Auth Context
File: `src/context/AuthContext.tsx`
Provides: `{ isAuthenticated, isLoading, token, user, company, isPaired, selectedFY }`

## Storage Keys (AsyncStorage)
| Key | Type | Content |
|-----|------|---------|
| auth_token | string | JWT access token |
| user_data | string (JSON) | {id, name, phone, email, language} |
| company_data | string (JSON) | {guid, name, gstin} |
| is_paired | string | "true" / "false" |
| user_info | string (JSON) | Additional user info |

## Web Fallback
On web (Expo Web), storage uses `window.localStorage` with same keys as fallback.

## Token Flow
1. User enters phone → POST /api/auth/send-otp
2. User enters OTP → POST /api/auth/verify-otp
   - If 2FA enabled → returns `pre_auth_token` + `requires_2fa: true`
   - If no 2FA → returns `access_token` directly
3. If 2FA: verify PIN → POST /api/auth/verify-pin (with pre_auth_token)
4. Store `access_token` in AsyncStorage as `auth_token`
5. All subsequent requests use: `Authorization: Bearer <token>`

## Bootstrap on App Start
`app/_layout.tsx` → `useEffect` → `getMe()` → `GET /api/auth/me`
Restores: company, isPaired, user info from server on cold start.

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
`isPaired` = boolean stored in AsyncStorage + AuthContext
Set to true when desktop pairs.
Socket event `pairing:confirmed` updates this.
PairingBanner shown when `!isPaired`.

## Socket Service
`src/services/socketService.ts`
Connects to backend WebSocket on login.
Events received:
- sync events → trigger data refresh
- unpair event → setIsPaired(false)

## Security Notes
- Token never logged or exposed
- Pre-auth token (2FA) is short-lived (5 minutes)
- PIN stored hashed on backend (never in AsyncStorage)
- Biometric: native device auth gates PIN reveal (Needs verification on exact impl)
