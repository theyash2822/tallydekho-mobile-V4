# MOBILE FINAL CLOSURE STATUS

Date: 2026-09-19  
Live app: `tallydekho-mobile-V4/frontend`  
Stale tree: `td-source/mobile` — not modified

## GIT

Nothing pushed: YES  
origin/cursor unchanged: YES (`53c4abc90242dca32334a53ed8cbb680340b6993`)  
origin/main unchanged: YES (`07a875a43ea05e774e450fc910e6449371f94310`)  
Local HEAD: `9ddcac87` (branch `cursor`)  
Local commits: 7 new on `cursor` (ahead 11 of `origin/cursor`; 4 pre-existing + 7 this pass)  
Working tree clean: YES (mobile repo, after commits)

========================================
LIVE APP
========================================

Remediated repo: `tallydekho-mobile-V4/frontend`  
Stale td-source/mobile modified: NO

Stale report (unchanged):
- branch: `mobile-mock-data-fix`
- dirty files: `src/services/api/config.js` (pre-existing; not touched)

========================================
UI FREEZE
========================================

UI redesigned: NO  
Company selector visual changes: NONE (`Header` → `/switch-company` → FlatList kept)  
FY selector visual changes: NONE (same pill/rows/colors/type; host changed from RN Modal to overlay)  
Navigation redesign: NO

========================================
P0 LOGOUT ISOLATION
========================================

Online server logout: PASS (`signOut` → `logoutOnServer` → `POST /api/auth/logout`)  
Server session revoked: PASS when reachable (body may include `pushToken`; backend contract already revokes session + optional push)  
Offline local logout: PASS (network failure still clears local credentials/state and returns to auth)  
Invoice drafts cleared: PASS  
Proforma drafts cleared: PASS  
Prefills cleared: PASS  
Company state cleared: PASS  
FY state cleared: PASS  
Stock cache cleared: PASS  
Ledger cache cleared: PASS (`clearLedgerCache()` in logout sweep)  
Pre-auth token cleared: PASS (SecureStore + AsyncStorage leftover)  
Cross-user leakage: Expected NONE

### Logout key inventory

Always removed:
`auth_token`, `user_data`, `is_paired`, `user_info`, `active_workspace_id`, `active_workspace_manual_pin`, `company_data`, `pre_auth_token`

Swept by pattern:
`td:u:*` tenant keys, `ws:*`, `company_*`, `*_prefill_*`, `draft_*`, `*_draft_*`, `tdk_*`, `tdinvoice_*`, `tdproforma_*`, `tdso_*`, `tdpo_*`, `tdprf_*`, `userSettings`, `voucherConfig`, `cashflow_period`, `td_help_chat_*`, `selected_fy`

Also cleared:
refresh token (SecureStore), pre-auth (SecureStore), in-memory ledger/stock/voucher caches, `_writeAsDemo`, tenant-key context, workspace generation, socket disconnect

Device-scope retained (deliberate):
user-bound biometric PIN (`td_biometric_pin:<phone digits>`), onboarding-completed flag

Backend: `POST /api/auth/logout` already revokes the session and accepts optional `pushToken`. No new backend architecture invented. If push unregister is missing server-side for a given session, report belongs to backend — Mobile sends the token when known.

========================================
LOCAL STORAGE / TENANT KEYS
========================================

Global `company_data`: REMOVED (deleted on hydrate/persist; never written)  
Draft keys: user/workspace/company scoped (`td:u:<user>:ws:<ws>:co:<guid>:invoice_draft|proforma_draft`)  
Logo keys: user/workspace/company scoped  
Prefill keys: user/workspace/company scoped  
GUID-only tenant state remaining: NONE as writers  
Legacy ambiguous keys: deleted on read (`dropLegacyKeys`); drafts never silently adopted

========================================
COMPANY SWITCHING
========================================

Authoritative state: `AuthContext.company`  
Async writer count: 1 (`setCompany`) — poll, switch-company, workspace adopt call it  
Workspace generation guard: PASS  
getMe race: FIXED (`/auth/me` updates user only; generation-guarded)  
Poll id/guid mismatch: FIXED (`sameCompany` / `companyInList` — guid ≠ internal id)  
Late response overwrite: Expected NO  
Request storm: CONTROLLED (no rewrite when selection already valid)

========================================
FY
========================================

Native problematic Modal removed: YES  
Existing visual design preserved: YES  
Equality guard: PASS (`fyEquals` after `begin_date`/`startDate` normalize)  
Date normalization: PASS  
Repeated FY rewrite: Expected NO  
Persistence scope: WORKSPACE+COMPANY  
Reason: FY list comes from `getCompanyYears(company.guid)` / per-company years; Company A and B can differ.

`app/switch-fy.tsx`: REMOVED (zero callers; full-screen route would change the journey)

========================================
DEMO
========================================

Backend `is_demo` authoritative: PASS  
Name-prefix detection: NONE  
Real "Demo Traders": PASS (`is_demo=false` stays real)  
UNPAIRED → Demo: PASS  
CONNECTED → real: PASS  
RECONNECTING → real: PASS  
Paired Desktop offline → real historical data: PASS (code path; device MANUAL)  
Private Demo create endpoint: PASS (`resolveWriteTarget` → `/api/demo/entries`)  
Demo reaches write_queue: Expected NO  
Demo reaches Tally: Expected NO

========================================
SOCKETS
========================================

workspaceId required for tenant UI events: PASS  
`voucher:tallySynced` scoped: PASS  
`invoice_posting_updated` scoped: PASS  
Wrong workspace ignored: PASS  
Missing workspace ignored: PASS  
Listener leaks: Expected 0 (preview handlers `off` on cleanup)  
Mobile ready for backend legacy socket fallback deletion: YES  
NOTE: Web audit still required. Backend not modified.

========================================
AUTH
========================================

Modern `/api/auth`: PASS  
Live `/app` callers: 0  
Refresh single-flight: PASS (`beginSingleFlight`)  
5×401 test: PASS  
403 no logout: PASS  
Session revoke: PASS (401 + refresh rejected → `signOut`)  
Biometric PIN user-bound: PASS (phone-scoped SecureStore; global leftover never submitted)

========================================
API
========================================

Central authenticated request path: PASS  
Barcode template workspace-scoped: PASS  
Ad-hoc tenant fetches: 0 documented (`barcodes.tsx` `fetch(file.uri)` is local file read)

========================================
STOCK / VOUCHERS
========================================

Create-item HSN: PASS  
AddItem HSN: PASS  
GST payload: PASS  
Success-before-API: Expected NO  
Error-as-success: Expected NO  
422 domain validation: PASS (`kind=validation`)  
Double-submit: PASS (`SubmitButton` disabled while loading)

========================================
REPORTS / DASHBOARD
========================================

Old workspace figures visible after switch: Expected NO (reports clear fin/GST/audit immediately)  
Late response protection: PASS (generation / identity ref)  
Company switch: PASS  
FY switch: PASS

========================================
SECURITY
========================================

Token logs: Expected 0  
OTP logs: Expected 0  
Notification body logs: Expected 0  
Invoice/customer logs: Expected 0  
Refresh token: SecureStore  
Biometric credential: SecureStore + user-bound  
Production ATS arbitrary loads: NO (`NSAllowsArbitraryLoads: false`)  
Dev local backend still supported: YES (`NSAllowsLocalNetworking: true`)

========================================
TYPE / STATIC QUALITY
========================================

tsc --noEmit: PASS  
Type errors: 0  
Lint: warnings / pre-existing volume (`expo lint` reported 449 errors + 361 warnings, largely historical style; not mass-fixed)  
expo-doctor: warnings (icon 512×513, prebuild vs app.json native folders, 8 patch-level Expo package skews). No framework upgrades performed.

Root cause of absoluteFillObject errors: Expo RN typings omit `StyleSheet.absoluteFillObject` even though the runtime API exists. Fix: one declaration merge in `src/types/rn-stylesheet.d.ts`.

========================================
DEAD CODE
========================================

Removed:
- `app/switch-fy.tsx`
- name/GUID Demo-detection helpers (replaced by `isDemoCompany`)
- Mobile `/app` request prefix + `appPost` docs
- unused `MOCK_LAST_SYNCED` / `MOCK_PC_NAME`
- misleading Header mock last-sync default

Retained:
- `ws:<id>:company_data` read-on-hydrate only, then deleted (no dual-write)
- device-bound biometric after logout (user-scoped)

Old `/app` Mobile code: REMOVED  
Duplicate Demo helpers: REMOVED  
Unused switch-fy: REMOVED  
Legacy `is_paired`: never read/written; still swept on logout  
Stale td-source/mobile: UNCHANGED

========================================
TESTS
========================================

Existing config: PASS (`verify:config`)  
Existing isolation: PASS (`verify:isolation`)  
New behavioral: PASS (`verify:remediation`)  
Auth: PASS  
Workspace switch: PASS  
Company/FY: PASS  
Demo: PASS  
Storage/logout: PASS  
Socket: PASS  
Stock payload: PASS  
Typecheck: PASS  
Lint: warnings / pre-existing errors  
Expo doctor: warnings  

Failed: none of the required behavioral checks  
Skipped: native Android touch (MANUAL)

========================================
DEFECTS
========================================

P0: 0  
P1: 0  

P2:
- `expo lint` still reports a large pre-existing error/warning volume (style/array-type/import). Not a functional P0/P1.
- `expo-doctor`: non-square 512×513 icons; app.json fields vs checked-in `android/`/`ios/`; 8 Expo patch-version mismatches. Upgrades deferred per “no framework upgrades merely for warnings”.
- LAN HTTP by raw IP (not localhost) may still need a narrow ATS exception on some iOS versions. `NSAllowsLocalNetworking` covers local development.

P3: none blocking

========================================
USER MANUAL TEST REQUIRED
========================================

Impossible to prove automatically (real device / Expo):

- Android company switcher open/close/rapid switch — no freeze
- Android FY overlay open/close/rapid switch — no frozen touch
- Rapid company → FY → company → FY
- Paired Desktop offline: XYZ remains real historical data, no Demo fallback
- Real Tally company named “Demo Traders” (`is_demo=false`) treated as real
- ABC UNPAIRED Demo vs XYZ PAIRED real (no cross-bleed)
- Session >20 min; 5 concurrent 401 → one refresh
- Force 403 → message, no logout
- Force 401 + refresh rejected → controlled logout
- Logout User A → User B on same device: no drafts/company/FY/logo/reports/ledger
- Online logout revokes User A server session
- Stock HSN+GST from create-item and Add Item modal persist after refresh
- Private Demo create uses `/api/demo/entries` (network inspector)

========================================
FINAL STATE
========================================

MOBILE CORE CLOSED  
P0 = 0  
P1 = 0  
UI DESIGN PRESERVED  
COMPANY SWITCH STABLE  
FY SWITCH STABLE  
WORKSPACE TENANT ISOLATION CLEAN  
LOGOUT ISOLATION CLEAN  
SERVER LOGOUT ACTIVE  
DEMO MODEL CORRECT  
PAIRED-OFFLINE MODEL CORRECT  
SOCKETS WORKSPACE-SCOPED  
STORAGE WORKSPACE-SAFE  
TYPECHECK CLEAN  
PROVEN DEAD MOBILE CODE REMOVED  
WORKING TREE CLEAN  

READY FOR:  
WEB FINAL STABILITY AUDIT  

DO NOT START:  
WEB  
BILLING  
