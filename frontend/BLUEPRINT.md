# BLUEPRINT.md — tallydekho-mobile-V4 (Mobile)

## Stack
- React Native + Expo (Expo Router file-based navigation)
- TypeScript
- Backend: `EXPO_PUBLIC_BACKEND_URL` env (default: http://192.168.29.243:3001)
- Auth storage: AsyncStorage (+ localStorage fallback for web)

## Entry Points
- `app/_layout.tsx` — root layout, auth guard, font loading, push notification setup
- `app/(auth)/_layout.tsx` — auth stack
- `app/(tabs)/_layout.tsx` — main tab bar (Home, Ledger, Stocks, Reports)
- `app/index.tsx` — root redirect

## Navigation Structure (Expo Router)
- File-based routing — folder = route segment
- `(auth)/` — unauthenticated flow
- `(tabs)/` — main tab navigation
- Other folders are stack screens pushed from tabs
- See: NAVIGATION_MAP.md for full screen list

## Auth Flow
1. `app/(auth)/index.tsx` — phone number entry
2. `app/(auth)/otp.tsx` — OTP verification
3. `app/(auth)/verify-pin.tsx` — 2FA PIN (if enabled)
4. On success → `src/context/AuthContext.tsx` stores token in AsyncStorage
5. App bootstraps via `getMe()` → restores company + isPaired state

## State: AuthContext
File: `src/context/AuthContext.tsx`
Key values: `{ isAuthenticated, isLoading, token, user, company, isPaired, selectedFY }`
Key fn: `fyInfoToParam(fy)` — converts FYInfo to "2025-2026" format for API calls

## API Layer
File: `src/services/api.ts`
- Base: `EXPO_PUBLIC_BACKEND_URL/api/*`
- Auth: `Authorization: Bearer <token>` from AsyncStorage
- Prefixes: `api/` (default), `tally/`, `app/`
- `withCompany(endpoint, guid, extra)` — appends ?companyGuid=&fy= params
- No mock data — strict rule

## Data Fetching
Hook: `src/hooks/useApiData.ts`
Component: `src/components/ApiStateViews.tsx` — LoadingView, ErrorView, EmptyView

## Colors / Theme
File: `src/constants/colors.ts`
Theme: Cream #F5F4EF base

## i18n
File: `src/i18n/index.ts` + `src/i18n/locales/`
Initialized in `app/_layout.tsx` before render

## Socket
File: `src/services/socketService.ts` — connects to backend, listens for sync events

## Push Notifications
File: `src/services/pushNotifications.ts`

## Details
- Navigation map: NAVIGATION_MAP.md
- API usage: API_USAGE.md
- Storage + Auth: STORAGE_AND_AUTH.md
- Task routing: TASK_ROUTING.md
