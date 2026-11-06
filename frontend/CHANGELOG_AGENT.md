# CHANGELOG_AGENT.md — tallydekho-mobile-V4 (Mobile)

## 2026-11-06 — Production cleanup: rebrand residue, prune, security (branch `6-11-2026`, local only)

Three commits (rebrand / prune / security) from `audits/production_cleanup/2026-11-06-mobile-inventory.md`. Frozen and untouched: `com.tallydekho.app`, slug/scheme `auditor`, `tallydekho_series`, `source:'tallydekho'`, `td_*`/`tdk_*` storage keys, `TDK-` prefixes, template ids, i18n keys, `renderTallyDekho*` names, env var names, API hosts.

- **Rebrand (user-facing only):** the three hard-coded English brand strings now come from i18n — `screens.settingsVoucherConfig.formatTallyClassic / formatAuditerThermal / formatAuditerExecutive` (voucher-config format cards + toast), `onboarding.brand` (onboarding flow pill), new `common.appName` (Other Taxes share text); brand names are identical in all 11 locales. Comment/doc-header "TallyDekho" → "Auditer" in 14 source files and the engineering docs (spec file names and the repo name kept). `src/config/backend.ts`: the production host is one constant (`PRODUCTION_API_HOST`) feeding both `PRODUCTION_BACKEND_URL` and the staging guard regex. `verify-compliance-v2.mjs` uses the canonical web domain `app.auditer.com`. `MOBILE_MAP.md`, `TASK_ROUTING.md`, `.agentignore` no longer point at the deleted mock files.
- **Prune:** Emergent scaffolding deleted at the repo root (`backend/`, `tests/`, `test_reports/`, `test_result.md`, `memory/`, `.emergent/`, `.gitconfig`). The root `CHANGELOG_AGENT.md` (the one maintained since October) is merged into this file; the older frontend-only log is kept at the bottom under "Archived changelog". Deleted with zero references: `app/switch-company.tsx`, `app/sales/index.tsx`, `app/purchase/index.tsx` (no `Stack.Screen` registrations existed; typed routes compile), `AddPartyModal.tsx` (+ `screens.componentsFormsAddPartyModal` in 11 locales), `SearchableDropdown.tsx`, `qaSpecCheck.ts`, `qaRegisterSheets.ts`, `qaThermalSmoke.ts`, `SpaceMono-Regular.ttf`, `app-image.png`. The five legacy redirect routes stay. `react-native-webview`, `expo-symbols`, `@react-navigation/elements` uninstalled; `packageManager` (yarn) removed — npm + `package-lock.json` only. ESLint 8 errors → 0: `BlinkingCaret` keeps its `Animated.Value` in lazy `useState`; `react-hooks/set-state-in-effect` is a warning (3 legacy sites). ~110 unused imports/vars removed, `array-type` / `import/first` autofixes; `PartyForm` loses its dead bank* fields. `verify-data-revision` no longer greps the deleted index screens.
- **Security:** access token moves to SecureStore (`td_access_token`) on native via `src/utils/accessToken.ts` — `api.ts`, `AuthContext`, `(auth)/tally-sync.tsx` share it; first read migrates the old AsyncStorage `auth_token` and deletes it; web keeps `localStorage`; no keychain → AsyncStorage fallback with one warning. Sign-up no longer passes the token as a route param: `otp.tsx` calls `storeSessionTokens` before `router.replace('/(auth)/register')`. `app.json`: `android.allowBackup: false`. Biometric PIN stored with `requireAuthentication` + `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (fallback to the plain item with a warning). Push `data.route` must start with a known top-level route group (`PUSH_ROUTE_PREFIXES` in `notificationLinks.ts`, applied in `pushNotifications.ts`). `labelPrint.ts` escapes name / barcode / SKU. New `app.config.ts` adds `NSAllowsLocalNetworking` only when `EXPO_PUBLIC_APP_ENV !== 'production'` (removed from `app.json`).
- **Tested:** `tsc --noEmit` 0 errors; `npm test` (9 verify scripts) pass; `eslint app src` 0 errors / 130 warnings (was 8 / 288). `npx expo config --type public` shows the same name / slug / scheme / ids in both envs. Not run on a device — needs a native rebuild (`allowBackup`, `app.config.ts`, SecureStore options), and a check of the biometric unlock on a real phone (the keychain read now shows its own OS prompt after the app's `LocalAuthentication` prompt).

## 2026-11-06 (05:26–06:05) — Requests screen, workspace dropdown, voice search (branch `28-10-2026`, local only)

- Settings → Requests (`app/settings/requests.tsx`): approvals ("For this workspace", only for those who can approve) and invitations ("For you", with "Invited by") in one screen with Day Book-style tabs; the old approvals / invitations routes redirect. One `usePendingRequests` hook feeds the Settings badge, the bell badge, the Home banners and a pinned "Needs your action" card in Notifications (one poll, paused in the background).
- The Settings workspace switcher is a dropdown under the workspace name (`src/components/settings/WorkspaceDropdown.tsx`), styled like the Home company / FY dropdowns, with inline rename; the switch runs after the dropdown has closed.
- Voice search listens in the app language (en-IN fallback), offers Open Settings when permission is blocked and says so when the phone has no speech recognizer; app.json microphone / speech texts say Auditer. Needs a native build (`npx expo run:android --device` / `npx expo run:ios --device`), not Expo Go.
- 36 new keys in all 11 languages.
- **Tested:** tsc 0 errors; eslint no new errors vs HEAD; all 9 verify scripts; locale parity (5,154 keys).

## 2026-11-06 (03:15–05:10) — Keyboard fix, redesigned settings screens, cashflow, ledger PDFs, GST portal, App Guide v2, sessions (branch `28-10-2026`, local only)

- **Keyboard:** `BottomModalShell` keeps its KeyboardAvoidingView mounted (`enabled`, padding on both platforms) — swapping it in when the keyboard opened remounted the sheet and closed the keyboard (GST connect OTP, integration setup, compliance and e-way bill sheets, stock modals). Also: GST / integration scroll views, workspace rename, HSN and create-ledger modals, two gorhom sheets without `adjustResize`.
- **Approvals:** restore picker shows company names (the folder number stays the key sent); Hard Sync cards show companies inline, a readable title, short device id, expiry; one merged list with pull-to-refresh, toasts, tokens only. Home banner also flags Hard Sync approvals for Owner/Admin.
- **Redesigned:** Notifications, My Access (no raw GUIDs), Billing & Credits (was License & Credits; links to app.auditer.com) on the shared `src/components/settings/SettingsKit.tsx`.
- **Cashflow:** the report draws the backend's daily/weekly/monthly series, reloads after a sync and on pull, drops stale answers; Home keeps a chosen 7D; the card shows when its data was loaded.
- **Ledgers:** Share PDF asks *Transactions only* or *Full details* (details sheet + statement with narrations), on the list (single and multi-select, 5 statements at a time) and the ledger screen; the ledger screen's PDF no longer mixes filtered rows with unfiltered balances.
- **GST portal:** Reports → GST and the GST overview card open *Sales on the GST portal* (GSTR-1) and *Purchases on the GST portal* (GSTR-2B / 2A) — `app/reports/gst-portal.tsx`, same `/api/gst/portal-sales` and `/api/gst/purchases?source=` as the web.
- **App Guide v2:** 11 slides on the design tokens (Ionicons, no emoji), shown once after sign-in per user (`auditer_guide_v2_seen:<userId>`); the pre-login first-launch gate is gone.
- **Sessions:** `X-Client-Type` / `X-Device-Name`; register keeps its new tokens; logout sends `{ refreshToken, pushToken }` (5 s, one retry); push token and a device id persist and re-register after sign-in and credential changes; socket `logout` / SESSION_REVOKED sign out with a reason; sign-out clears the navigation stack; only 400/401 from refresh ends the session (captive Wi-Fi no longer signs out); Settings → Signed-in devices with *Log out of all devices*.
- **Rebrand:** auditer.com links (About, Tally Sync download), "latest Auditer Agent", Help FAQ for today's tabs. Locales: 11 files, 5,118 keys each, placeholders match.
- **Tested:** `tsc --noEmit` 0 errors; all 9 `verify:*` pass; ESLint: no changed file worse than HEAD, new files clean. Needs a device check: sheet keyboard on Android, guide layout on small phones, the 1M cashflow chart.

## 2026-11-04 (23:40) — GST read-only notice (branch `28-10-2026`, local, not pushed)

- `read_only` on `GstConfig` / `GstOverview`; Settings → GST Returns shows a read-only callout and the GST overview card one line while the server only reads from the portal (backend `GST_READ_ONLY`). IMS / deposits already follow the server's `view` / `show`. Username + OTP connect screen unchanged (Settings → GST Returns).
- `screens.settingsGst.readOnly` in 11 languages. tsc 0; `verify:compliance-v2` passes.

## 2026-11-04 (21:30) — Compliance v2 QA fixes (mobile) and full translation parity (branch `28-10-2026`, local, not pushed)

QA plan `audits/compliance_v2/QA_2026-11-04.md`; the app reads the backend shapes of contracts C1–C11.

- **GST** (`components/compliance/GstPanels.tsx`, `services/api.ts`, `utils/complianceRules.ts`): IMS asks for every section (chips "All" + one per `sections` entry with counts, section on each row), Reject asks first (M2, L10); deposits show their Tally state from `post_status` (Posted / Sent to Tally / "Could not post to Tally" + `post_error`), the button only when `can_post`, "Post again" after a refusal, `unknown` warns with no button, Post asks first with amount and date (M3, L10); calendar: "Status not known" when the portal's filing status cannot be read (L5).
- **E-way bills raised on you** (`app/reports/ewb-list.tsx`): "Reject by …" from `reject_by`, Reject allowed while now < `reject_by` and checked again on tap (L3). **E-invoices**: "N sales to unregistered buyers need no e-invoice" from `counts.b2c_excluded` (L10).
- **Translations** (`src/i18n/locales/*.json`): the 328 keys that had never been translated (e-invoice list 112, e-way bill list 95, e-invoice / e-way bill settings 56, reminders, approvals and a few others) now in all 10 languages; every key of `en.json` exists in every locale, placeholders intact. "Ready" inside two sentences now quotes the translated tab name. Odia: the Bengali letter ও used inside 15 Odia words replaced with ଓ.
- **Deposits** (Yash 22:25): the Post to Tally confirm shows what one post costs (`post_credits` from the server; charged like any entry posted to Tally).
- **Tested**: `npm test` (all verify scripts, compliance v2 included), `tsc --noEmit` 0 errors. Not run on a device.

## 2026-11-04 — Compliance v2, workstream E (mobile): questions before configuration, GST on PeriOne, correction, signed QR image (branch `28-10-2026`, not committed)

- Settings → E-Invoice / E-Way Bill (`IntegrationSettingsScreen.tsx`): the question first — e-invoice "has turnover crossed ₹5 Cr since 2017-18?" / "₹10 Cr or more?" with the estimate from the books (`GET /api/compliance/turnover`) and its advice; e-way bill "move goods worth ₹50,000 or more?". No → a short Not applicable card and nothing else. Yes → the existing cards, then "Invoices created in Auditer" (auto / follow_mode, or auditer / tally) or "Documents Auditer tracks" + "Limit inside <state>" (editable, reset to the state rule). The old Not applicable switch is gone. Every change is one partial `saveComplianceConfig`.
- Settings → GST (new `app/settings/gst.tsx`, entry next to E-Invoice / E-Way Bill, same gate): portal connection (username, the three API-access steps, OTP sheet with "Keep connected for" 1–30 days, connected until, Disconnect), returns / IMS / deposits choices (+ debit and bank ledgers), filing frequency. 503 GST_NOT_CONFIGURED or `configured_on_server: false` → one notice, controls disabled.
- Lists: days-left chip on Ready / Needs attention e-invoices; stale-Tally banner; ₹10 Cr question callout (Owner/Admin); Share report (CSV via expo-file-system + expo-sharing); e-way bill kind tag; generate sheet asks why a delivery note's goods move (4/5/10/12/11/8, description for 8) and the receiving godown of a stock transfer, distance optional (shows `distance_km` after), Check vehicle (Vahan; hidden once unavailable); Incoming reads the stored list (last 3 days, "Reject by …"), a date still asks the portal.
- Correct invoice: Fix sheet → `app/sales/create-invoice.tsx?correct=<guid>` for a today-dated invoice with an invoice-level gap (web GapFixDrawer rule); prefilled from `GET /vouchers/:guid`, date locked, banner with the portal's reason, submit `POST /tally/voucher/sales-correct`, button "Correct invoice". Create invoice also shows "E-invoice: registered automatically once Tally accepts this invoice (2 credits)" when the config says so.
- Signed QR as an image on shared / printed invoices and acknowledgements (`src/utils/irnQr.ts`: qrcode → SVG data URI; `tallyMeta.irnSignedQr` → `irnQrImage` in `buildVoucherPdf` / multi-share; acknowledgement sheets).
- Party create: Verify beside GSTIN (`GET /api/gst/gstin-check`). Settings → Compliance Reminders: Compliance alerts card (10 kinds, Push / Email / WhatsApp, e-way bill expiry hours). Reports → GST: Overview (connection, due dates, score) + IMS and Deposits sheets. Push: `compliance_*` → `data.link` mapped to app screens (`complianceLinkRoute`); derived notification targets open their tab.
- `request()`: a 503 `*_NOT_CONFIGURED` answer no longer flags the server unreachable or goes to Sentry.
- 217 new strings in all 11 locales. New `scripts/verify-compliance-v2.mjs` (in `npm test`). tsc 0 errors; `npm test` passes; ESLint 0 errors (40 existing warnings).

## 2026-11-03 (20:10–21:30) — E-document settings on Settings → E-Invoice / E-Way Bill; lists trimmed; From Tally (branch `28-10-2026`, local, not pushed)

- `src/components/compliance/IntegrationSettingsScreen.tsx`: per company — **Generated in** TallyPrime | Auditer chips (TallyPrime hides Configure / Test / Activate / Remove), then once Active a **mode card** (IRN: Manual | Auto after Tally sync; e-way bill: Manual | Auto when details ready | Ask after IRN) with a "choose" box while nothing is chosen and the explanation + Auto since once chosen, and a **Not applicable** switch with the ₹5 Cr / services text. Each change is one partial save (`saveComplianceConfig`). `app/settings/voucher-config.tsx`: sections 2–3 (E-Invoice / E-Way Bill) removed; note + links to the two settings screens; only numbering is saved. `services/api.ts`: `IntegrationCompanyRow.compliance`, `ReadinessRow.source / pending_in_tally`, `ReadinessResponse.integration`.
- `app/reports/einvoice-list.tsx`, `ewb-list.tsx`: action sheet trimmed to View · Acknowledgement (was Share PDF) · [Part B / transporter / extend] · Generate e-way bill · Refresh status · Cancel · History; signed JSON / Verify dropped from the sheet. "From Tally" badge on documents TallyPrime generated, and those rows offer View · Acknowledgement · History only. TallyPrime mode: the Ready tab reads "Pending in Tally", rows show the badge instead of Generate. List screens otherwise unchanged (Owner: minimal mobile scope).
- Print engine copies (`src/utils/pdf/tallyLayout.ts`, `src/utils/commercial-print/*`, `src/types/document.ts`): IRN band with the signed QR image + e-way bill line, `compliance` block on the commercial model, byte-identical with the web portal (the app does not yet turn the JWT into a QR image, so its prints show the band without the image).
- tsc 0 errors; `npm test` (verify scripts) all pass.

## 2026-11-03 (16:00) — Fix sheet: IRN_CANCELLED explanation (branch `28-10-2026`)

- `src/components/compliance/FixGapSheet.tsx` + `en.json` `gapIrnCancelled`: no e-way bill from an invoice whose e-invoice was cancelled; raise a fresh invoice in Tally.

## 2026-11-03 (14:15) — Fix sheet: LEDGER_HSN_MISSING explanation (branch `28-10-2026`)

- `src/components/compliance/FixGapSheet.tsx` + `en.json` `gapLedgerHsn`: accounting-mode invoice — set HSN/SAC and GST rate on the named sales ledgers in Tally, then sync.

## 2026-11-03 (13:20) — Fix sheet: FUTURE_DATED explanation (branch `28-10-2026`)

- `src/components/compliance/FixGapSheet.tsx` + `en.json` `gapFutureDated`: an invoice dated after today waits in Needs attention and moves to Ready on its date (backend gap `FUTURE_DATED`).

## 2026-11-03 (09:00–09:20) — Settings integrations show only the header's company; no rates (branch `29-10-2026`)

- `src/components/compliance/IntegrationSettingsScreen.tsx`: lists only the company chosen in the header (`useAuth().company`), rates line removed, Activate confirm without a number. `FixGapSheet.tsx`: `TOO_OLD` gap text (30-day window).

## 2026-11-03 (07:40–08:30) — Compliance rework: e-Invoice / e-Way Bill through PeriOne, mobile half (spec `audits/compliance_rework/2026-11-03-SPEC.md` §4; branch `29-10-2026`, local only)

- `app/reports/einvoice-list.tsx`, `app/reports/ewb-list.tsx` rewritten: header KPIs (Generated · Ready · Needs attention · Failed / Expiring · Coverage) from `GET /einvoice/readiness` / `GET /ewaybills/readiness`; segments Ready / Needs attention / Generated (+ Incoming for EWB with a date picker, Accept / Reject). Ready → Generate confirmation sheet (portal preview, "2 credits will be charged", "Also generate e-way bill" switch defaulting to `preview.transport.has` with the dispatch fields); long-press multi-select → bulk Generate (`/einvoice/generate-bulk`, `/ewaybills/generate-bulk`). Needs attention → first gap + Fix sheet (HSN per item → `/tally/master/stock-item-alter`, party GSTIN / pincode / state → `/tally/master/party-alter`, company / numbering / portal gaps explained; EWB `IRN_REQUIRED` → "Register e-invoice first"). Generated → ⋯ sheet: View, Share PDF, Download signed JSON (shared as `IRN-<irn>.json`), Verify signed data, Refresh status, Generate e-way bill, Cancel (reason 1–4 + remarks), History; EWB adds Complete Part B / Update vehicle, Update transporter, Extend validity, Consolidate (multi-select → form → `/ewaybills/consolidated`) and the consolidated list.
- New `app/reports/compliance-detail.tsx` (INVOICE / E-INVOICE / E-WAY BILL / HISTORY with the same actions; Generate / Fix for pending vouchers) and `app/reports/compliance-history.tsx` (`GET /compliance/history`).
- `app/reports/einvoice-compliance.tsx`, `ewb-compliance.tsx` now redirect to the lists; `app/reports/compliance.tsx` links point at the lists.
- `app/sales/index.tsx`: IRN / EWB chips on recent rows (pending only ≥ ₹50,000) opening the compliance record; the pending-IRN banner's "Generate now" opens the Ready tab. `app/document/[id].tsx`: compliance bar with the chips. `app/sales/invoice-preview.tsx`: once the Tally number is final the voucher guid is resolved via `/vouchers/:id` and `GET /einvoice/:voucherGuid` is polled (≤ 90 s) to show the auto-IRN result.
- `app/settings/einvoice.tsx`, `ewb.tsx` → shared `src/components/compliance/IntegrationSettingsScreen.tsx`: per-company rows from `GET /workspaces/:id/integrations/:domain` (`gateway`, `rate`, `companies[]`) with Configure (GSTIN / API username / password, sandbox "Use test login"), Activate (confirm "100 credits once for <company>, then 2 credits per generation"), Remove (`DELETE ?companyId=`, keeps the paid activation), Test login.
- `app/settings/notification-channels.tsx`: SMS toggle back (`sms_enabled`), per-channel costs (WhatsApp 1 credit, email 0.5, SMS 0.5, push free); `app/settings/compliance-reminders.tsx` chips show the same costs.
- `src/services/api.ts`: `fetchEinvoiceReadiness`, `generateEinvoice` (`alsoEwb`, `dispatchDetails` in the server's snake_case), `generateEinvoiceBulk`, `getEinvoiceRecord`, `getEinvoiceSignedJson`, `verifyEinvoice`, `refreshEinvoice`, `fetchEwbReadiness`, `generateEwb`, `generateEwbBulk`, `getEwbRecord`, `updateEwbVehicle`, `updateEwbTransporter`, `extendEwb`, `refreshEwb`, `createConsolidatedEwb`, `listConsolidatedEwbs`, `listIncomingEwbs`, `acceptIncomingEwb`, `rejectIncomingEwb`, `recordComplianceEvent`, `getComplianceHistory`, `alterParty`, `removeWorkspaceIntegration`; `saveWorkspaceIntegration` / `testWorkspaceIntegration` / `activateWorkspaceIntegration` take `companyId`.
- Shared: `src/components/compliance/{complianceShared.ts, ComplianceChips.tsx, ComplianceSheets.tsx, EwbForms.tsx, FixGapSheet.tsx}`, `src/utils/complianceActions.ts`. ~280 English keys added to `en.json` (all strings use `defaultValue`).
- Gates: tsc 0 errors (baseline 0); ESLint 0 errors on touched files; `npm test` green.

## 2026-11-03 (06:40–06:50) — Generate EWB on pending rows (branch `29-10-2026`)

- `app/reports/ewb-list.tsx`: pending rows get a "Generate EWB" button (`generateEWayBill`, dispatch details from Tally / the app invoice; the server names what is missing). E-Invoices already had per-row Generate.

## 2026-11-03 (06:05–06:20) — Settings → E-Invoice / E-Way Bill on the PeriOne gateway (branch `29-10-2026`)

- `app/settings/einvoice.tsx`, `app/settings/ewb.tsx`: provider dropdown and client id / secret removed; GSTIN, API username, API password only, saved with `provider: 'perione'`. New Gateway card (PeriOne · Sandbox / Live), sandbox note with the test login and "Use the test login for this workspace" (`useSandboxLogin: true`), "Test login" button (`testWorkspaceIntegration`) with the result line, portal how-to text. Strings use `defaultValue` so every language shows English until translated.
- `src/services/api.ts`: `testWorkspaceIntegration`.
- tsc clean on the touched files; `npm test` green.

## 2026-11-03 (04:15–04:50) — Notification badge, channels save, payment reminder rules, Reminder History, Approvals without voucher requests (branch `28-10-2026`, local only)

- **Bell badge:** Home counts only unread alerts (`filter(n => !n.read)`), reloads on `[dataReady, companyGuid]` and on every focus, so returning from Notifications drops the number; `Header` defaults to 0 instead of 1. `markNotificationRead` now `encodeURIComponent`s the id (ids carry `%`), so marking read actually reaches the server; the optimistic flip on the Notifications screen is reverted to unread if the PATCH fails.
- **Channels & Quiet hours** (`settings/notification-channels.tsx`): Save calls the real PATCH (`/notification-settings`) with push / email / WhatsApp, `quiet_enabled` / `quiet_from` / `quiet_to` and `quiet_saturday` / `quiet_sunday` (the old Save only showed a toast); the dirty flag clears only after success and a failure shows the server message. SMS toggle removed. "Channels" and "Quiet hours" are section headers above their cards; a note under Quiet hours: "Alerts that fall in quiet hours are delivered when they end."
- **Settings list:** the "Low Stock & Expiry Alerts" sub-item is gone (it lives under Stocks → Settings → Alerts); `settings/stock-alerts.tsx` stays as the redirect for old deep links.
- **Payment Reminders** (`settings/payment-reminders.tsx`): each rule has a When control (Before due / On due date / After due), a Days stepper (hidden for On due date, min 1 otherwise) and a Time; the "On due date" checkbox is gone. Up to 6 rules, always shown in chronological order and re-sorted after every change (more days before first → on due date → after ascending, then by time). Each card has a one-line summary, e.g. "6 days before due · 10:00 AM · WhatsApp". A rule without a time shows an inline hint, Save asks for it, and the server's 400 message (max 6 / missing time / two rules at the same moment) is shown on save. New info line under the threshold: "Reminders for a bill stop as soon as a receipt is recorded in the app or Tally shows it paid." Rows are sent as `when` / `days` (+ `stopWhenPaid: true`); legacy `daysBefore` / `onDueDate` are read on load but never sent. Header has a "History" pill (route `/settings/sent-reminders` unchanged).
- **Reminder History** (`settings/sent-reminders.tsx`, renamed from "Sent reminders"): a `SectionList` grouped by day of `sentAt` — Today, Yesterday, then "Weekday, d Mon yyyy"; each row shows time, party, bill (+ due date), amount, stage / rule name, channel (incl. "App" for stopped rows) and a Sent / Failed / Stopped pill with the error text for failures; "Load more" button per page (duplicate ids across pages are dropped).
- **Approvals** (`settings/approvals.tsx`): the one-off voucher / entry requests section, its loader and `createVoucherRequest` / `getVoucherRequests` / `approveVoucherRequest` / `rejectVoucherRequest` in `services/api.ts` are removed (the endpoints no longer exist). Hard Sync and Restore now share one card style: type chip (Hard Sync / Restore), requested-at, title, one meta line, Show / Hide details (companies & years, identity replacement; backup & company picker for a restore, open by default), Approve / Reject. On a ledger, a restricted voucher shows "The other side of this voucher is outside your access." with OK — the "Ask the Owner" action is gone.
- **i18n:** new English strings under `screens.settingsNotificationChannels.*`, `screens.settingsPaymentReminders.*` (incl. `daysBeforeDue` / `daysAfterDue` plurals), `screens.settingsSentReminders.*`, `screens.settingsApprovals.*`, `screens.ledgerRestricted.bodyPlain`; the other 10 locales fall back to English for these. Keys no screen reads any more (voucher requests, SMS channel, "Ask the Owner", test-reminder copy) removed from all 11 locale files; non-English copies whose meaning changed (history title / empty text, "Maximum 4") removed so they fall back too.
- Tested: `tsc --noEmit` 0 errors; `npm test` (all 8 verify scripts) passes; `expo lint` shows only the 10 pre-existing errors in files not touched here (changed files: 0 errors, 40 warnings, down from 47).

## 2026-11-03 (02:05–02:45) — Permission keys instead of Owner/Admin checks; entry mode on every voucher; access refresh on foreground (branch `28-10-2026`, local only)

- Owner/Admin-only screens now follow permissions: Stock settings and print settings (`inventory.settings.manage`), Barcodes (`inventory.barcodes.view`; the server checks `inventory.barcodes.manage` on writes), the Stocks tab header buttons likewise, HSN edit on an item and HSN validation (`stock_item.alter`), Add item in the + menu (`stock_item.create` only), Payment Reminders and Sent Reminders (`reminders.manage`), WhatsApp reminder on a ledger (`reminders.manage`), Compliance Reminders save (`alerts.manage`), Add bank account (`ledger_master.create`); E-Way / E-Invoice settings and Approvals also open for a role holding `integrations.configure` / `tally.restore_replace`. The "Only the Workspace Owner or an Admin can change this" toasts became "This needs a permission your role does not have."
- Entry mode on every voucher: `utils/entryScope.ts` `ENTRY_MODE_KEYS` / `usesEntryMode`; `hooks/useRbasCreate.ts` clamps `entryType` to the mode (a restored draft cannot pick a forbidden kind) and `assertCanCreate(key, kind?)` refuses a kind the mode forbids at submit for every voucher, with converting a proforma counted as regular; `RegularOptionalToggle` shows a "NO ENTRY" chip for NONE instead of a live toggle; the + menu hides every voucher for NONE and keeps the Create Invoice ↔ Proforma swap for Optional only / Regular only. `sales/create-invoice.tsx` passes the kind explicitly (proforma optional, convert under `sales_proforma.convert_to_regular`).
- `context/WorkspaceContext.tsx`: `/context` is re-read when the app returns to the foreground (at most every 15 s) and on pull-to-refresh of Home and Stocks, so a role edited on Web shows up without a restart.
- Messages: "Limited by your data access" (with "Your role allows this; your access for this company does not. Ask the Workspace Owner.") when the role allows a screen but the company's data access removes it — in `RequireCapability` and on a locked tab; "Not in your access" / "Not allowed" otherwise. New `en.json` strings `common.limitedByAccess`, `limitedByAccessHint`, `permissionNeeded` (other languages fall back to English for now).
- Tested: `tsc --noEmit` 0 errors; `npm test` (all verify scripts) passes; `expo lint` shows only the 10 pre-existing errors in files not touched today.

## 2026-11-02 (21:05–21:25) — PDF addresses in 2–3 lines; a short invoice fits one page (branch `28-10-2026`, local only)

- Every PDF format printed each comma piece of an address on its own line (seller, consignee, buyer), so a one-item Tally Classic invoice spilled the declaration and signature onto a second page. Addresses are now one comma-separated paragraph that wraps over 2–3 lines (`addressParagraph` in `voucher-print/shared.ts`); a piece that repeats (e.g. the state) appears once; State Name / Code, GSTIN and e-mail keep their own lines. Applies to Tally Classic, Auditer Thermal and Auditer Executive for invoices, orders and notes, to the payment / receipt / journal voucher formats, and to the Tally statement sheets (`pdf/tallyLayout.ts`). Executive now prints the whole address (it showed only the first two pieces).
- Same files copied to the web portal (`src/print/utils`), which renders the same formats.
- Tested: `tsc --noEmit` 0 errors; `npm test` passes; commercial template QA (`qaSpecCheck.ts`) PASS for every document type and template. The sample invoice of the report renders at 735 px of the 1,047 px A4 page (room for about 18 more item rows).

## 2026-11-02 (19:53–20:20) — Workspace name at sign-up, real Delete Account, My Access as on the web (branch `28-10-2026`, local only)

- Sign-up asks for a Workspace name (required, 2–60 characters) right after Full Name, with a hint under it; the workspace is no longer named after the person. Sent as `workspace_name` on Continue and on Skip for now. If the server refuses a field, the form comes back with the server's message. The form now scrolls on small screens.
- Delete Account is real: opening it sends a WhatsApp code (`POST /api/auth/account/delete/start`) and shows "code sent to <masked number>"; Delete confirms the code (`/confirm`). A wrong code shows the server's message under the boxes and clears them. Owners of workspaces with other members see those workspaces named and only a Close button. After deletion the app signs out the same way as Sign out (and drops this number's saved biometric PIN), opens sign-in and shows "Account Deleted". The fake success and the "Change?" link are gone.
- My Access shows the same information as the web portal, in words: Tally connected / waiting for first sync / not paired, Demo Mode or Live data, membership status, role, entry mode, and "Credits & billing: managed by the Workspace Owner" for members; 11 modules in two columns with a check or a lock; data scope as All, None or names (company names instead of GUIDs, 12 then "+N more"); sensitive fields in a fixed order. Raw capability keys, pairing and status codes, ✓/✗ chips removed. Rules in `src/utils/myAccess.ts`.
- 41 shared strings (identical to the web portal) merged into all 11 languages. Needs the matching backend change; until it lands, Delete Account shows the server's error with Retry and sign-up names the workspace as before.
- Follow-up (20:30): entry mode NONE reads "None" (translated) on both apps; the shared "Full Name" now uses the app's own wording (it was garbled in Malayalam, Odia and Telugu); the Tamil owner footnote uses the same word for Memberships as the web page title.
- Tested: `npm test` — 8 verify scripts pass: 93 checks (79 existing + 14 new in `verify:account-access`) plus 13 e-invoice parser checks; `tsc --noEmit` 0 errors; ESLint on changed files 0 errors (10 existing warnings, 2 fewer than before); Android bundle builds (HTTP 200).

## 2026-11-02 (19:00–20:15) — Company details from Tally Prime, read-only (from `21-10-2026` onto branch `28-10-2026`, local only)

- Settings → Company Information shows the selected company's Tally company master read-only: company name, mailing name, GSTIN, PAN, address, state, country, pincode, email, mobile, phone, website, financial year beginning from and books beginning from (dates as Tally shows them, e.g. 1-Apr-2023), with the notice that they change only in Tally Prime and update after the next sync, and when Tally last updated them.
- Logo upload stays for the Owner, an Admin or a role with Company Profile — Edit (RBAS rule); others see the logo with "only the Workspace Owner, an Admin or a role with Company Profile — Edit can change the logo" (`company.readOnly`, reworded in all 11 languages). Details and logo are held per company.
- Printing: voucher documents (`toVoucherDocument`, `fromTallyVoucher`) and the Sales/Purchase Order share PDF print the Tally mailing name (company name when it is blank) in the header and the "for <company>" signatory.
- 13 new `company.*` labels in all 11 languages; `updateCompanyProfile` removed from `services/api.ts`.
- **Tested:** `tsc --noEmit` 0 errors; all 7 `verify:*` scripts pass; eslint: company screen clean, the 2 `set-state-in-effect` errors in the create-order screens are on the committed branch too.

## 2026-10-29 (19:15) — OTP autofill and paste (local only)

- OTP boxes accept a whole code in one box (iOS/Android autofill, keyboard suggestion, long-press paste) and spread it over the six boxes; a complete code verifies at once. Boxes are marked `oneTimeCode` / `sms-otp` for system autofill. Typing over a filled box still replaces just that digit.
- "Paste code" next to Resend (and on the Reset PIN code step) reads the code copied with WhatsApp's "Copy code" button (`expo-clipboard`, included in Expo Go; `src/utils/otpCode.ts` picks the standalone 6-digit code). Strings in 11 languages.
- iOS only suggests codes from Messages (SMS) and Mail, so WhatsApp codes are pasted, not auto-suggested.

## 2026-10-29 (19:00) — OTP / PIN caret (local only)

- The caret in the empty focused box is centred (the empty digit text no longer sits above it and pushes it down) and blinks like the system caret (`src/components/BlinkingCaret.tsx`). OTP, Reset PIN and Verify PIN screens.

## 2026-10-29 (18:00–19:30) — Auditer name and logo (local only)

- App name "Auditer" (was "Auditor"); Face ID, microphone and speech prompts say Auditer. Store IDs `com.tallydekho.app`, Expo slug and deep-link scheme `auditor` unchanged.
- New app icon, Android adaptive icon and favicon: the white crossbar-free A on #1A1A1A (same as the desktop Auditer Agent); splash: white Auditer wordmark on #1A1A1A (replaces the template placeholders). Takes effect in the next native build.
- `src/components/AuditerLogo.tsx` (wordmark + A mark from the logo kit, react-native-svg) on login, OTP, register, PIN, pairing, onboarding and About.
- All 11 languages: TallyDekho → Auditer, TallyDekho Desktop/App/Agent → Auditer Agent, support@auditer.com. Print template names and PDF footer say Auditer; Android notification channel "Auditer Notifications". Stored values (`tallydekho_series`, `td_*` template ids), API URLs and tallydekho.com website links unchanged.
- Tested: `tsc` clean; Android bundle builds.

## 2026-10-29 (02:10–03:00) — Owner/Admin settings (local only)

- Day Book tab follows Day Book access (locked, no data loaded); payment reminders and sent reminders: Owner/Admin only (locked screen); Remind button, add bank, add stock item and stock-item HSN edits: Owner/Admin only; compliance reminders and stock settings read-only for members; translations added. Tested: tsc clean, Android bundle builds.

## 2026-10-29 (01:00–02:10) — Fixes from manual testing (branch `28-10-2026`, local only)

- All four tabs always shown; a tab outside access carries a lock and explains on tap; its screen shows a locked view.
- Locks are drawn inside cards (KPI carousel, Home tiles, Reports cards, Stocks tiles and reorder card) so layouts stay intact; access refusals show a lock in the shared error views.
- Financial Report shows withheld sections (e.g. Trial Balance) as locked.
- Tested: `tsc --noEmit` clean; Android bundle builds.

## 2026-10-29 — Manual-test fixes, Phases A–E (branch `28-10-2026`, local only)

- Audit trail shows Made by for the Owner and Admins; Owner billing summary lists recent credit activity.
- Capabilities narrowed by per-company Reports and Stock access; Home KPI cards, sales/purchases/expenses tiles, report cards and the Stock tab show blurred locked cards ("Not in your access") instead of errors; "Your N parties" labels.
- Server access codes mapped; background reads outside access no longer raise error toasts; amounts never show ₹NaN; latest permitted year opens by default.
- `expo-blur` added (~57.0.3). Translations in 10 languages. Tested: `tsc --noEmit` clean; Android bundle builds (HTTP 200).

## 2026-10-28 — RBAS + workspace billing (branch `28-10-2026`)

- Company profile/GST gating (RBC-01); socket reconnects after a server-side disconnect so scope is re-checked (RBC-03).
- Ledger statement shows restricted lines as “Restricted account” with “Ask the Owner”; Owner’s Approvals lists voucher requests (RBC-04).
- License & Credits: read-only Owner billing summary — credits (available/held/expiring), seat pool and renewal, grace/pause/dues, transfer fee due, recent notices (RBC-09). New text in 11 locales.
- Tested: `tsc --noEmit` clean.

## 2026-10-22 — Restore requests on Home (branch `21-10-2026`)

- New `src/components/RestoreRequestBanner.tsx` on Home, Workspace Owner only: "Restore request waiting" with the PC and verified contact, tap → Settings → Approvals. Loads on focus, every 30 s while Home is open, and on restore events (`WorkspaceContext.restoreSignal`), because Expo Go gets no push.
- The restore toast now shows only to the Owner and only for a new request.
- Approvals no longer blinks: the 8-second refresh swapped the whole list for a spinner (and reset the scroll); the spinner now covers only the first answer for the workspace, refreshes update in place, a failed refresh keeps the list, and a reply for a workspace the user left is dropped.
- **Tested:** `tsc --noEmit` 0 errors; `npm test` verify scripts pass. Expo device testing pending.

## 2026-10-21 (night) — Restore requests approved by the Workspace Owner (branch `21-10-2026`)

- Settings → Approvals: the restore code entry is gone; each pending request (Owner only) shows the PC name, masked verified contact, requested/expiry time and the desktop it replaces, with a backup and company choice per request; approve/reject by request id (`approveRestoreRequest`). Tapping a `restore_request` push opens Approvals. New labels in all 11 languages.
- **Tested:** `tsc --noEmit` 0 errors; `npm test` verify scripts pass. Expo device testing pending.

## 2026-10-21 — 6-digit codes, sign-up email verification, change phone in any supported country (branch `21-10-2026`)

- Login, Forgot PIN and Settings OTPs take 6 digits in boxes that share the row width (PIN screens keep their 4 boxes); resend shows the server's limit message.
- Sign-up: Continue sends a 6-digit code to the email, then Verify & Continue or Skip for now.
- Settings → change phone follows the account's own country (code prefix, digit length, saved number); India behaves as before. The phone country list moves unchanged to `src/constants/phoneCountries.ts`.
- **Tested:** `tsc --noEmit` 0 errors; `npm test` all verify scripts pass. Expo device testing pending.

## 2026-10-17 — Bring `10-10-2026` work to `cursor` + sync refresh, entry dates (branch `cursor`)

- **Merged (owner-approved):** commits `2758cdad`, `d4783e8d`, `ea5404d1`, `3696c919` from `10-10-2026` (FY kept across refreshes, Cancelled chips, approvals scope, close forms on company removal, missed-sync recovery, outcome-unknown retry confirmation).
- **Refresh:** `synced` refreshes only for a new revision (`isFreshSync`); `tally_connection` refreshes only on a real transition; device `last_seen` heartbeats no longer refetch every screen; selected-company revision probe every 30 s and on returning to the foreground; "Tally data synced" toast only for fresh data.
- **Entry dates (owner rule):** date pickers capped at today (credit/debit/delivery notes, journal, contra, expense, orders); regular sales/purchase orders locked to today like the other forms.
- **Audit trail:** server queue state shown under each My Entries row.
- **Tested:** `tsc --noEmit` 0 errors; `npm test` all verify scripts pass (new data-revision checks). Expo device testing pending.

## 2026-10-12 (evening) — Cancelled vouchers in registers (branch `10-10-2026`)

- Sales and Purchase registers request `includeCancelled: '1'`, so the "Cancelled" chip and filter now have rows. Total, Average and Docs cards skip cancelled vouchers. Home screens, pickers, audit trail unchanged.
- **Tested:** `npm test` (`verify:data-revision` 7 checks); `tsc --noEmit` 0 errors.

## 2026-10-12 — Revision-aware refresh, Cancelled label, approval scope (branch `10-10-2026`)

- `src/services/dataRevision.ts`: GETs read `X-Data-Revision`; an older response is fetched again once; a newer revision triggers the same refresh as `synced`.
- Cancelled vouchers show a grey "Cancelled" chip (was "Unpaid") in Sales/Purchase home and registers; the register filter option is "Cancelled". Voucher preview shows "Cancelled in Tally".
- Approvals screen shows companies, years and any old → new company identity.
- **Tested:** `npm test` incl. new `verify:data-revision` (6 checks); `tsc --noEmit` 0 errors. Expo device testing pending; no APK built.

## 2026-10-10 — Desktop removal refresh (branch `10-10-2026`, TD-DESKTOP-CORE-2026-10-10-v1)

- `socketService` forwards removal syncs (`reason: companies_removed`) to `src/services/scopeRefresh.ts`. The root layout dismisses bottom sheets and stacked screens, clears the workspace's `*_draft` keys (again after 1 s), opens Home, reloads companies and shows "Data has been refreshed" / "No data available" plus the queued-entry deadline.
- An ordinary sync is unchanged.
- **Tested:** `npm test` incl. new `verify:scope-refresh` (6 behavioural checks); `tsc --noEmit` 0 errors. Not run on a device.

## 2026-10-08 — P6 FY kept across heartbeats, posting events, unknown-outcome retry (branch `8-10-2026`, TD-FIX-2026-10-08)

- **W2:** the Header re-checked the chosen FY after every `lastSyncAt` bump (each desktop heartbeat) by comparing only its start date; `fyEquals` also compares the end date, so the check always failed and the FY reset to the first year. It now uses `fyInList` with the full chosen FY.
- **W1:** posting events go through `socketService.subscribePostingEvents`, which survives reconnects and a socket created after the screen mounted. `voucher:regularized` is handled and workspace-scoped. Previews (shared voucher preview, sales invoice, sales order) refresh only for the workspace, company and reference on screen (`isPostingEventForDocument`).
- **X9 (UI):** Audit Trail retry of an unknown-outcome entry shows a confirmation and only then sends `confirmOutcomeUnknown`; bulk retry never re-sends those (counted as skipped). New English strings; other languages fall back to English.
- **W4:** mobile lists already refetch on `lastSyncAt`; no change.
- **Tested:** `npm test` (all verify scripts incl. 3 new checks) pass; `tsc --noEmit` 0 errors; eslint on touched files at the branch baseline. Not run on a device.

## 2026-10-01 — Header company + FY dropdowns (local branch `cursor-header-dropdown`, not pushed)

- `Header.tsx` follows the reference repo's header (`tallydekho-mobile-emergent-code`): two RN `Modal` dropdowns under the header (company: letter icon, name, GSTIN, check; FY: year list with tick), wired to real data (`getCompanies` scoped for CONNECTED/RECONNECTING, `getCompanyYears`, `AuthContext.setCompany` / `setSelectedFY`). Demo mode and single-company toast unchanged.
- Freeze safeguards: each Modal mounts only while open; the company / FY change is applied in an effect after its Modal has unmounted. `statusBarTranslucent` so `insets.top + 58` lines up on Android.
- `app/switch-company.tsx` stays but nothing links to it.
- Follow-up (device feedback): dropdowns only closed on selection. The backdrop is now a `Pressable` sized from `useWindowDimensions` (the flex / absoluteFill version did not catch taps), so tapping outside the card, or on the company name / FY pill / chevrons under it, closes the dropdown. The card claims the responder, so taps on its title or empty space don't close it.
- Tested: tsc clean, eslint (1 pre-existing intentional warning), `npm test` pass; QA YELLOW pending device test on Android + iPhone.

---

## 2026-09-30 — Rolled back header dropdown change

- Reverted `6e318c11` (company + FY dropdowns via `@gorhom/portal`) at Yash's request: dropdowns did not work on device. Header is back to `6ce51ef0` behaviour (company → `/switch-company` screen, FY in-header overlay). The FY tap issue is still open.

---

## 2026-09-21 — Browser-local period dates

`todayLocalISO` / `resolvePeriodDates` use the device calendar, not UTC.

---

## 2026-09-19 — Snapshot branch `19-09-2026-final-code`

Pushed local `cursor` tip (billing 402 = validation; mixed/split codes removed)
as `19-09-2026-final-code`. LAN backend remains `http://192.168.29.243:3001`.

---

## 2026-09-18 — Staging EAS profile + centralized backend config

Added `frontend/src/config/backend.ts` as the single source for backend URL
resolution; `services/api.ts` and `context/AuthContext.tsx` now import from it
instead of each duplicating the logic (and the hardcoded URLs).

Added a `staging` EAS profile (`EXPO_PUBLIC_APP_ENV=staging`,
`EXPO_PUBLIC_BACKEND_URL=https://staging-api.tallydekho.com`) and made the
`production` profile state its environment explicitly. A staging build refuses to
fall back to `api.tallydekho.com`.

Added `npm run verify:config` (`frontend/scripts/verify-backend-config.mjs`) and
wired it as the default `test` script. All checks PASS.

Risks: no staging EAS build has been produced; guards are verified statically.

---

## 2026-09-08 — Publish hardening

Ledger share/pagination, multiShare page sizes, About URLs, token logs, `__DEV__`-only LAN API. Testing Agent YELLOW. Pushing `cursor`.

---

## 2026-09-08 — P0/P1 publish prep

Receipt Note → commercial cream/PDF; orphan Ledger/ZIP removed; tsc clean. See `frontend/CHANGELOG_AGENT.md`. Pushing `cursor`.

---

## 2026-09-07 — Thermal replaces Ledger

Mobile PDF middle template is now Thermal (80/58). See `frontend/CHANGELOG_AGENT.md`. Ready for device test; not pushed.

---

## 2026-09-01 — 0% KPI trend is grey + black

Home + KPI carousels: flat **0%** is grey background and black text (not green/red). See `frontend/CHANGELOG_AGENT.md`. Not pushed.

---

## [2026-08-31] Swipe actions — Ledger square geometry everywhere

### Why
Stock / Bank Feeds swipe buttons were rounded islands; Ledger uses flush full-height slabs.

### Change
- Total Stock: width 80, no per-button radius, no gap, swipeable `overflow: hidden` clip
- Bank Feeds: same slab geometry; clip radius 18 to match bank card

### Files
- `frontend/app/stocks/total-stock.tsx`
- `frontend/app/settings/bank-feeds.tsx`

### QA
GREEN — tsc clean; Ledger/Stock/Bank Feeds swipe geometry aligned

---


### Why
Optional Proforma rows showed `[Proforma Invoice]` + `[Proforma]` — redundant.

### Change
Second chip follows same rule as Sales: **Regular** or **Optional** from `currentEntryType`.

### File
- `frontend/app/reports/audit-trail.tsx`

### QA
GREEN — tsc clean

---


### Why
Calendar / voucher-type filter used gold (AMBER); Ledger uses brandPrimary black.

### Change
- Calendar, date strip, voucher-type active, sheet check → `COLORS.brandPrimary`
- Keep AMBER for pending sync + Not Posted / Optional status chips

### File
- `frontend/app/reports/audit-trail.tsx`

### QA
GREEN — tsc clean; chrome → brandPrimary; AMBER kept for status only

---


### Why
Month-group card + left border accent clipped the right outline; swipe also broke the edge.

### Change
- Each entry is its own bordered tile
- Sync accent = absolute strip (not borderLeftWidth)
- No swipe actions (tap opens preview; Convert swipe removed)

### File
- `frontend/app/reports/audit-trail.tsx`

### QA
YELLOW — tsc clean; device smoke of closed tile borders pending

---


### Why
My Entries tiles needed clearer books status and Dr/Cr without crowding Preview/Convert.

### Layout
- Left: sync icon (retry when pending/failed)
- Party; ref · date | Posted/Not Posted/Cancelled (+ IRN)
- [type] [Regular|Optional|Proforma] | amount **Dr/Cr**
- Tap → Preview; swipe left → Convert (Proforma only)

### Changed
- `frontend/app/reports/audit-trail.tsx`

### QA
YELLOW — tsc clean; device visual/gesture smoke pending

---


### Layout
Left: party · voucher no · date  
Right: amount; then type + Paid/Unpaid chips on one row

### Style
- All type chips black & white (Proforma-style)
- Paid green / Unpaid red
- Tighter row padding (14→10)

### QA
GREEN

## [2026-08-29] Voucher list tile redesign — 2-column layout

### Why
Sales/Purchase/Expense list tiles were cluttered (badges + ID + party stacked, status dot + return-arrow icon).

### Layout
Left: party · voucher no · date  
Right: type badge · amount · status badge  
Dropped: green status dot, circular return-arrow.

### Changed
- `src/components/VoucherListTile.tsx` — shared tile + PaymentStatusBadge + ExpenseTypeBadge
- Sales/Purchase/Expense home + register wire-up
- Sales home status → paid/unpaid (Paid filter works)

### QA
YELLOW — tsc clean; Paid still cancelled-proxy (pre-existing).

## [2026-08-29] Expense Register — FY date sync (empty list fix)

### Why
Register initialized date range to `01/04/24–31/03/25` before Auth FY loaded, then never synced. Yash expenses are May 2025–Aug 2026 → list/counts looked empty and Type filter appeared broken.

### Changed
- `app/expenses/register.tsx` — sync `fromDate`/`toDate` when `fyFrom`/`fyTo` load (parity with Sales/Purchase/Home)

### Note
Yash Ki Company: Direct=0, Indirect=11 (data). Direct empty is expected.

## [2026-08-29] Option A — Sales/Purchase/Expense home multi-filter + combined Recent

### Policy
- **Default selection = all doc types** so first paint shows the full combined Recent feed after API is ready.
- Ledger-style funnel: badge + chips + toast (`Filters applied` / cleared).
- Paid/Unpaid/All pill on Sales/Purchase unchanged. Register remains a separate nav target (not a voucher-type filter).

### Changed
- `src/components/voucherHomeFilters.tsx` — FilterIconWithBadge, ActiveFilterChips, notifyFiltersApplied, doc-type catalogs
- `app/sales/index.tsx` — filter icon right of E-Way Bill; sheet multi-select Invoices/Orders/Credit notes/Delivery notes/Proforma/Quotations; `GET /sales/vouchers`
- `app/purchase/index.tsx` — same pattern; Invoices/Orders/Debit notes; `GET /purchase/vouchers`
- `app/expenses/index.tsx` — filter sheet All/Direct/Indirect + API categories; passes `type`/`category`; removed broken `includes('direct')` client match
- `src/services/api.ts` — `getSalesVouchers`, `getPurchaseVouchers`

### How to test
1. Backend on `:3001` with new routes → Expo reload
2. Sales → filter → deselect some types → Apply → Recent updates, chips + toast; Quotation may be empty
3. Purchase → same for Invoices/Orders/Debit notes; Register still via View All
4. Expenses → Direct vs Indirect via funnel (no Indirect bleed); category chips from API

### Known gaps
- Quotations empty until Tally sync has Quotation voucher types

---

## [2026-08-27] UX soft-refresh + shimmer policy (Phases 1–4)

### Policy
- First load / company switch: full shimmer OK
- Period change: in-place number update
- PTR: native RefreshControl only
- Spinners: Save/OTP/PDF only
- Home ↔ Cashflow: `CASHFLOW_PERIOD_KEY`

### Changed
- Home soft-refresh + stale-request guard; Stocks/Reports soft PTR; Ledger debounced soft search; Reports/Financial single-fetch hygiene; shimmer replaces content-load spinners on touched screens

### How to test
1. Home 7D↔1M no flick; PTR on 4 tabs; first load shimmer only

---

## [2026-08-27] Home — trend pills on all 7 KPI cards

### Changed
- `app/(tabs)/index.tsx`: Home KPI carousel always shows a trend badge; green/red `±N%` when `trend_pct` is set; **"—"** (neutral) when null. Wired to enriched `/dashboard/kpi-strip`.

### How to test
1. Backend on `:3001` with kpi-strip trends + Expo reload
2. Home → scroll 7 cards (Cash, Bank, Receivables, Payables, Loans, Payments, Receipts)
3. Each card shows pill or —; no invented %

---

## [2026-08-26] Phases 2–4 — Cash/Bank/AR/AP/Loans live trend pills

### Phase 2
- `cash-in-hand.tsx`: summary carousel trend pills from `kpi_cards`; grey weekday day pill on Daily Cash Balance header (tap still shows tooltip); hide day-over-day % when null
- `bank-balance.tsx`: KPI carousel trend pills from API (pills-only; no new chart)

### Phase 3
- `receivables.tsx` / `payables.tsx`: Total Due uses `trend_pct`; aging cards map `aging[].trend` (pills only when non-null)

### Phase 4
- `loans-ods.tsx`: KPI carousel trend pills from `kpi_cards`

### How to test
1. Pull `cursor` + restart backend `:3001` + Expo reload
2. Home → Cash / Bank / Receivables / Payables / Loans
3. Pills appear only when API sends real `trend_pct` (AR/AP may need 1+ day of snapshots)

---

## [2026-08-26] Phase 1 — Payments + Receipts live trend pills + charts

### Roadmap (document)
- **Phase 1 (this):** Payments + Receipts — `daily_series`, `kpi_cards.trend_pct`, Daily In/Outflow chart, Cash vs Bank donut
- **Phase 2:** Cash + Bank balance trend pills + day pill on cash charts
- **Phase 3:** Receivables + Payables — aging snapshots + MoM when history exists
- **Phase 4:** Loans & ODs — outstanding trend pills on carousel

### Added / Restored
- `payments.tsx` / `receipts.tsx`: KPI carousel trend pills (omit when `trend_pct` null), Daily Outflow/Inflow line chart with weekday day pill, Cash vs Bank donut with horizontal flex legend (no vertical letter stacking)
- Wired to live `GET /kpi/payments` + `/kpi/receipts` (`daily_series`, `kpi_cards`, cash/bank totals)

### How to test
1. Backend on `:3001` with Phase 1 API
2. Expo reload → Home → Payments / Receipts
3. Confirm carousel pills, chart touch + day tag, Cash vs Bank legend readable

---

## [2026-08-25] Phase B–D — AR/AP/Cash UI restore with live data

### Fixed
- Receivables / Payables: filter chips (DateRangePicker + Overdue + Receipts/Payments), aging carousel with Not Due, tabs, Call/WhatsApp on overdue parties
- Trend badges kept with "—" until MoM history exists (no fake %)
- Cash in Hand: restored charts (Daily Cash Balance + Receipts vs Payments) from live 30d series
- Bank Balance KPI label: Book Balance (Tally)


## [2026-08-25] Loans & ODs Phase A — rich cards + estimated EMI/rate

### Fixed
- Restored gradient loan/OD carousel + tabs + expected EMI calendar
- **RICH** mode (e.g. Hdfc Car Loan): Outstanding, Estimated Rate, Expected EMI/date, 6m history, calendar
- **SIMPLE** mode (unsecured without EMI pattern): name + outstanding + transactions only
- Labels follow TALLY_EXACT / Estimated / Expected rules from Loans OD spec

## [2026-08-25] Bank A/c + IFSC from Tally sync on Bank Balance / Feeds

### Fixed
- Bank Balance cards show **masked A/c** + **IFSC** from Tally ledger master (not Bank Feeds)
- Bank Feeds maps live `account_number` / `ifsc` / `branch` / `bank_name` from `getBankLedgers`

### Note
- Requires desktop with updated LedgerFull/FullLedger XML + one ledger resync

## [2026-08-25] Bank Balance carousel restore + UI forensic audit

### Fixed
- **Bank Balance KPI** — restored gradient swipe cards + dots (pre-mock-cleanup design) wired to live `getKPIBankBalance`
- Card fields: ledger **name**, **parent**/OD label, **balance**, last txn date; Dr=inflow green / Cr=outflow red
- Optional A/c+IFSC deferred to Bank Feeds link (not faked)

### Added
- `FORENSIC_UI_RESTORE_AUDIT.md` — screen-by-screen list of designed-UI losses from `31a3f402` mock cleanup

## [2026-08-24] Mock cleanup Phases 1–5 — live KPI / Sales / registers

### Fixed
- **KPI siblings** (cash / bank / AR / AP / loans) — Payments-pattern live UI; no mock lists
- **Sales home** — metrics from `GET /sales/home-metrics` (no `METRIC_CARDS`)
- **Sales / Purchase registers** — removed `MONTH_GROUPS` mock fallbacks; empty-state only
- **Bank feeds / payment reminders / license** — no fake accounts/parties/purchase history
- Deleted orphan `src/data/mockData.ts` + `mockDocuments.ts`

### Added
- `getSalesHomeMetrics`; KPI cash/bank accept period `from`/`to`

## [2026-08-24] Cashflow Income/Expense → Receipts/Payments

### Changed
- Home Cashflow + cashflow report bars now reflect **Receipts** (inflow) and **Payments** (outflow), not Sales/Purchase
- Labels updated on `CashflowCard` and cashflow report

## [2026-08-24] Payments + Receipts KPI screens: real API data

### Fixed
- **Payments / Receipts KPI** screens were fetching the API but still rendering hardcoded mock lists (AGL Traders etc.) — now show live vouchers including today's cash payment
- Period pills (7D/1M/3M/6M) + Cash/Bank filters wired to real data
- Summary cards: period total, today, cash, bank

## [2026-08-24] Home dashboard refresh + FY period clamp

### Fixed
- **AuthContext** — coerce `last_seen` with `Number()` so `lastSyncAt` advances after desktop sync (pg bigint was a string; `typeof === 'number'` never matched)
- Adopt company when paired with empty company cache (avoids MISSING_COMPANY)
- **Home** — gate dashboard fetch on `companyGuid`; clamp 7D/1M/3M/6M windows inside selected FY
- **Cashflow report** — same FY clamp for period dates
- **periodDates.ts** — past FY anchors to last N days of that FY

## [2026-08-22] AI Insights crash + duplicate list keys

### Fixed
- **AI Insights** (`app/reports/ai-insights.tsx`) — guard donut/line/bar charts against NaN when receivable buckets sum to 0%; default segment colors
- **Purchase / Expenses / Recent Activity** — list keys use `guid` instead of voucher number (fixes duplicate key `5` warning)
- **Purchase Register** — navigation uses `guid` for document preview

## [2026-08-22] Purchase + Expenses: remove mock data, wire real APIs

### Fixed
- **Purchase** (`app/purchase/index.tsx`) — removed hardcoded demo invoices/vendors; loads `GET /api/purchase/invoices` + debit notes
- **Expenses** (`app/expenses/index.tsx`) — removed mock RECENT_EXPENSES, METRIC_CARDS, TOP_CATEGORIES; real API only
- **Expense Register** — switched from `getVouchers` (Payment/Receipt/Contra) to `getExpenses` with correct ledger mapping

## [2026-08-22] Home voice search + dashboard search

### Added
- Real speech-to-text on home search mic via `expo-speech-recognition` (`useVoiceSearch` hook)
- Debounced dashboard search wired to `GET /api/dashboard/search` (vouchers, ledgers, stock)
- iOS mic/speech permission strings; live transcript + Done button in mic modal

### Changed
- `RecentActivity` supports custom title and `route` for search result navigation

### Note
- Voice mic requires a **development build** (not Expo Go)
- Lazy-load speech module so Expo Go does not crash on home screen load

## [2026-08-22] UI Phase 1 + Phase 2 integration

### Added
- Phase 1: ModuleTiles, cashflow report, stock dashboard wiring, ledger UX, daybook → audit-trail
- Phase 2: onboarding tour (first-time), App Guide in Settings, notifications inbox (filters + deep links)
- StatusBarCover + onboarding gate in root layout; auth nav defers to tour when not completed

### Changed
- Header: logo removed, longer company name truncation
- Notifications screen: real API with category chips, Today/Earlier groups, mark read

---

## [2026-08-17] Proforma XML + My Entries after convert

### Fixed
- Converted Proforma in My Entries shows **Sales** + **From Proforma** (not Proforma Invoice title)
- Submit payload includes item **unit** for Tally qty/rate

---

## [2026-08-17] Proforma convert opens Sales Invoice form

### Changed
- Convert (preview, My Entries, Proforma success) opens **Create Invoice** with Proforma data filled in
- Submit **Alters the same Tally voucher** (optional → regular) — no second invoice
- Convert API accepts edited items/taxes/party/amount from the form
- Draft Resume banner is skipped when a Proforma-convert prefill is present (avoids overlaying an old invoice draft onto the Alter)

---

## [2026-08-17] Proforma UX polish

### Fixed
- Share/PDF: stamp **Proforma Invoice** / Proforma No. (not Tax Invoice) while unconverted
- Preview Convert bar: brand black (`#1A1A1A`), not blue
- My Entries: **Preview** + **Convert** chips (confirm → convert API); sync gate toast if not ready
- Removed invalid `useSettings` from `formatCurrency`

---

## [2026-08-14] Proforma Invoice

### Added
- Sales menu + FAB: Proforma Invoice (`/sales/create-proforma`) — always optional, no Regular toggle
- `createProformaInvoice` / `convertProformaInvoice` API
- Preview title Proforma Invoice; Convert to Sales Invoice when synced
- My Entries: Proforma badge vs Optional on Sales Invoice

### Unchanged
- Create Invoice Regular/Optional

---

## [2026-08-06] Debit Note — Credit Note mirror (Purchase Return)

### Changed
- `create-debit-note.tsx`: full rewrite — pick Purchase Invoice → return qty (capped) → `createDebitNote` with `linked_invoice`; TDK-DBN via backend
- `api.ts`: `getPurchaseInvoiceDebitNoteContext`
- `debit-note.tsx`: list vendor mapping polish

### Locked
Always against PI; prefix **DBN** (not Delivery Note DN).

### Test
FAB → Debit Note → select PI → return qty → submit → Tally Debit Note with Agst Ref + `02-Purchase Return`.

---

## [2026-08-06] Purchase Order — SO parity + convert to Purchase Invoice

### Changed
- `create-order.tsx`: full rewrite — live vendors/stocks/warehouses/purchase ledgers, numbering, logistics, `createPurchaseOrder` submit, success Convert → PI
- `create-invoice.tsx`: reads `tdpo_to_invoice_prefill_*` (30m TTL); sends `againstOrderNo` on submit

### Test
FAB → Purchase Order → live masters → submit → Convert to Purchase Invoice → PI prefills → submit with ORDERNO link.

---

## [2026-08-06] Purchase Invoice — remove e-Way Bill / Dispatch

### Removed
- `create-invoice.tsx`: Dispatch / E-Way Bill toggle, fields, and `dispatch_details` submit (not required for Purchase)

### Note
Sales Invoice EWB unchanged.

---

## [2026-08-06] Purchase Invoice e-Way Bill / Transport Details

### Added
- ~~`create-invoice.tsx`: toggle **E-Way Bill / Transport Details**~~ — **removed 2026-08-06** (Purchase does not need EWB)

---

## [2026-08-06] Tax ledger % autofill on select

### Added
- `src/utils/taxLedgerHelpers.ts` — resolve rate from API `taxRate` or name (`@ 9%`)
- Sales/Purchase Invoice, Sales Order, Delivery Note TaxEntryRow + LogisticsSection: selecting CGST/SGST autofills editable Rate % + Amount

### Note
Requires backend ledger sync so `ledgers.tax_rate` is populated; name parse works as interim fallback.

---

## [2026-08-06] Purchase Invoice/Order — forensic UX fixes (QA YELLOW)

### Fixed
- `create-invoice.tsx`: QR close overlay outside CameraView; bill scan via ImagePicker; narration keyboard scroll; destination warehouse = all company godowns; discount UI = sales; Add Vendor drawer padding
- `create-order.tsx`: product → then warehouse; barcode close outside CameraView

### Note
Bill photo is local URI only (not uploaded with invoice). PO still mock masters.

### Test
PI: QR dismiss, bill attach chip, warehouse list after product, narration scroll, vendor drawer padding.

---

## [2026-08-05] Purchase Invoice — Sales-parity 3-step + dual scanner

### Changed
- `frontend/app/purchase/create-invoice.tsx` — full rewrite:
  - 3 steps: Details → Items → Review (Sales pattern)
  - Live Purchase ledgers, parties, stocks, warehouses, tax/charge ledgers
  - + Add Vendor (Sundry Creditors)
  - Scan e-Invoice QR + Scan/Upload Bill (in-house; no OCR_MOCK)
  - Make Payment Now → `make_payment` (Payment voucher, not Receipt)
  - `voucherType: 'Purchase'`, numbering policy, REG/OPT date lock
  - Post-submit success overlay + preview/share PDF
- `frontend/src/services/api.ts` — `getPurchaseLedgerAccounts`

### Test
FAB → Purchase Invoice → 3-step with live Tally masters → submit → Payment if Make Payment Now.

---

## [2026-08-03] Credit Note — item_attributed GST (phases 1–3 client)

### Changed
- `frontend/app/sales/create-credit-note.tsx`
  - Reads per-item `taxEntries` + `allocationMode: item_attributed`
  - VAT treated as goods tax; bare GST kept when sole GST style
  - Line GST reverse uses item taxEntries (5%/18%/9%) instead of blended invoice rate

### Test
QA YELLOW — reload Expo after pull; return mixed-rate invoice → per-item rates, no packing GST.

---

## [2026-08-03] Credit Note — GST reversal item-wise

### Changed
- `frontend/app/sales/create-credit-note.tsx`
  - Amount from original net taxable/unit (discount-safe)
  - Per-item GST reversal rows (CGST/SGST or IGST) from original invoice
  - Summary: Returned item value / GST reversal / Total customer credit
  - Tax ledgers read-only; backend recalculates on submit
  - QA fix: trust explicit server `returnTaxMode`; include `sgstAmount` when inferring

### Test
Select taxable invoice → return qty → see line GST + summary credit total.
Exempt invoice → GST reversal ₹0.

---

## [2026-08-03] Credit Note — qty drives amount + disable reason

### Changed
- `frontend/app/sales/create-credit-note.tsx`
  - Selecting an item prefills remaining Return Qty and Amount (qty × invoice rate)
  - Qty always recalculates Amount; Amount locked until Qty > 0
  - Subtotal / submit use `lineReturnAmount` (no orphan amount without qty)
  - Footer shows why Continue / Issue Credit Note is disabled
  - Per-line estimated tax hint; client merge of duplicate tax ledgers sums rates

### Test
QA YELLOW — ship with backend tax collapse. Device: select item → qty/amount fill →
fill narration → Issue enables; tax rows one per ledger.

---

## [2026-07-29] Credit Note — 2-step invoice-linked Sales Return

### Changed
- `frontend/app/sales/create-credit-note.tsx`: live Details & Invoice → Returned Items & Review flow; mandatory FY Sales invoice and backend cumulative-return context
- Original invoice items start unselected; qty is capped to backend remaining; original unit/rate lock while Sales ledger, godown, and context taxes remain editable
- Production camelCase submit, Settings numbering, REG/OPT FY date behavior, and queued/posted success with real Preview/Share
- `frontend/app/sales/credit-note.tsx`: real FY list states and synced `/document/[id]` opening
- `frontend/app/voucher/preview.tsx`: removed credit-note demo fallbacks
- `frontend/src/services/api.ts`: added credit-note-context helper
- `frontend/API_USAGE.md`: documented read/write contract

### Test
Select party → invoice → return context; select lines within remaining qty, add reason, submit, preview/share, and open the synced list row.

---

## [2026-07-29] Delivery Note — 3-step + Invoice-style REG/OPT date lock

### Changed
- `frontend/app/sales/create-delivery-note.tsx`: 3 steps (Details → Order & Dispatch → Items & Logistics)
- REG locks date to today; OPT unlocks within selected FY
- Linked SO prefills Step 3 via `getOrderPreview` / `getVoucherById`
- Order/Dispatch screenshot fields; submit sends `original_entry_type` + expanded `dispatch_details`

### Test
Reload Expo → Delivery Note → link SO → fill Order/Dispatch → submit → verify in Tally.

---

## [2026-07-29] Delivery Note — 2-step rewrite on live masters

### Context
`create-delivery-note.tsx` was a mock stub: hard-coded party/invoice/product/dispatch
arrays, a fake `DN-00235` badge shown as the voucher number, and a submit payload
(`company_guid`, `stock_item`, `dispatch_method`, …) that did not match
`POST /tally/voucher/delivery-note`. Rewritten as a 2-step screen using the same
patterns as `create-order.tsx` / `create-invoice.tsx`.

### Added / Changed
- Step 1 "Details": sales ledger (`getSalesLedgerAccounts`), party (`getParties`),
  date, and an optional linked Sales Order loaded only after a party is chosen
  (`getSalesOrders({ partyName })`); changing/clearing the party clears the linked order
- Step 2 "Items & Dispatch": live `getStocks` item picker with per-item godown
  (`getStockGodowns`, `getWarehouses`), qty/unit/rate/derived amount, per-item sales
  ledger, per-item tax rows (`getTaxLedgers`), `LogisticsSection`
  (`getChargeLedgers`), dispatch block and narration
- Numbering comes from `useNumberingPolicy` — no invented number, no on-screen
  override pill; Regular/Optional toggle is submitted as `isOptional`
- Payload now matches the backend contract: `companyGuid`, `companyName`,
  `partyLedger`, ISO `date`, `totalAmount`, `items[{itemName, actualQty, billedQty,
  unit, rate, amount, salesLedger, godown, trackingNumber}]`, `taxes`, `logistics`,
  `narration`, `isOptional`, `numbering_policy`, `dispatch_details`, `linked_order`
- Success overlay reports the real result: Tally voucher number when returned,
  otherwise "Pending from TallyPrime"; Preview is only offered when the response
  carries a TDK reference
- Validations: ledger/party/date before step 2; ≥1 item with qty and rate; sales
  ledger per item; godown required when an item has multiple godowns; vehicle
  number format
- Removed all mock arrays (`PARTIES`, `INVOICES`, `DISPATCH_METHODS`, `PRODUCTS`,
  `UNITS`) — units now derive from live stock masters

### Files
- `frontend/app/sales/create-delivery-note.tsx`

### Device checklist
1. Sales → Create Delivery Note → ledger + party load from Tally
2. Pick a party → linked Sales Order list loads for that party only
3. Change the party → linked Sales Order clears and reloads
4. Step 2 → pick a product → godown list loads; qty × rate drives Amount
5. Add a tax row → rate auto-fills amount → Grand Total updates
6. Toggle Dispatch → fill transport mode / doc / destination / vehicle → submit
7. Tally receives the Delivery Note; success card shows the Tally number, never a
   fabricated one
8. OPT toggle → voucher lands as optional in Tally

### Risks / follow-up
- Backend now consumes the full contract, writes accounting/GST/dispatch/order-link
  XML, returns `tdkReferenceNo`, and persists `app_vouchers`.
- Linked Sales Orders use exact backend `partyName` filtering plus selected-FY
  `from`/`to`; changing party clears the selection.
- Item units are read-only from the live stock master. A unitless item sends a bare
  rate instead of inventing `pcs`.
- Live Tally import/reconciliation remains the required device smoke test.

---

## [2026-07-15] Journal Depreciation — Direct write-down (Cr Asset)

### Context
Depreciation mode incorrectly used Acc. Dep as credit. Correct Tally Direct method: Dr Depreciation · Cr Asset; Base = asset FY closing (editable).

### Added / Changed
- Depr mode: Credit = Asset; Base prefilled from ledger `closing_balance`; swap disabled
- Removed depr narration autofill
- `depreciationMeta.method = direct_write_down` + asset/expense names
- journal-preview shows Direct / asset write-down

### Files
- `frontend/app/voucher/create-journal.tsx`
- `frontend/app/voucher/journal-preview.tsx`

### Device checklist
1. Depr ON → pick Asset (Cr) → Base = closing
2. Rate 15% → amount = base × 15%
3. Pick Depreciation expense (Dr) → submit
4. Tally: asset reduced by dep amount

---

## [2026-07-14] Contra voucher rewrite + Cash Count sheet

### Context
Contra was a stub (fake CV no, free-text, wrong API keys). Rewrite: Source→Destination Cash|Bank only, inferred kind, instruments, optional Cash Count → Tally CASHDENOMINATION (hard match gate).

### Added / Changed
- `create-contra.tsx` — full rewrite: pickers, Contra No.+Date, instruments, Cash Count card, Regular/Optional, success → preview
- `CashCountSheet.tsx` — denomination cards, Auto Split / Clear / Use Last, match-only Apply
- `cashDenominations.ts` — currency-keyed masters (INR includes ₹2000)
- `contra.tsx` list polish + `contra-preview.tsx` + `getContraPreview`

### Files
- `frontend/app/voucher/create-contra.tsx`
- `frontend/app/voucher/contra.tsx`
- `frontend/app/voucher/contra-preview.tsx`
- `frontend/src/components/forms/CashCountSheet.tsx`
- `frontend/src/constants/cashDenominations.ts`
- `frontend/src/services/api.ts`

### 🔴 Pending user device verification
- Cash→Bank + matched Cash Count → Tally has denom
- Mismatch blocks submit
- Skip Cash Count OK
- Bank→Cash / Bank→Bank / Cash→Cash
- Optional → `TDK-OPT-CON-…`

---

## [2026-07-14] Journal voucher + Depreciation on Asset (v1)

### Context
Journal was a stub. Rewrite to single Dr+Cr with Receipt/Payment parity; optional Depreciation mode (Dr expense / Cr Acc. Dep, manual WDV × editable IT %).

### Added / Changed
- `create-journal.tsx` — full rewrite: ledger pickers, date, Settings numbering, optional, success → preview
- Depreciation toggle + IT rate list (`indiaDepreciationRates.ts`) + WDV base + editable %
- `journal-preview.tsx` + list polish on `journal.tsx`
- `getJournalPreview` API helper

### Files
- `frontend/app/voucher/create-journal.tsx`
- `frontend/app/voucher/journal.tsx`
- `frontend/app/voucher/journal-preview.tsx`
- `frontend/src/constants/indiaDepreciationRates.ts`
- `frontend/src/services/api.ts`

### 🔴 Pending user device verification
1. Restart Mac backend + reload Expo / pull latest
2. Simple Journal Dr+Cr → in Tally
3. Optional Journal → TDK-OPT-JOR
4. Depreciation: base 100000 × 15% → 15000; Dr Dep / Cr Acc. Dep → in Tally
5. Edit rate → amount recalculates (unless amount overridden)

---

## [2026-07-14] Payment/Receipt leftover Advance NAME + preview sync copy

### Context
Tally rejects Advance bill allocations without `<NAME>`; On Account must have no NAME. Same leftover UX existed on Payment and Receipt create screens.

### Changed
- `create-payment.tsx` / `create-receipt.tsx`: leftover still defaults On Account; Advance sends auto `TDK-ADV-…` name; sheet note explains the rule.
- `payment-preview.tsx` / `receipt-preview.tsx`: Posted + number pending → clearer banner copy.

### Files
- `frontend/app/voucher/create-payment.tsx`
- `frontend/app/voucher/create-receipt.tsx`
- `frontend/app/voucher/payment-preview.tsx`
- `frontend/app/voucher/receipt-preview.tsx`

### 🔴 Pending user device verification
1. Pull latest mobile + restart Mac backend
2. Multi-bill Payment with leftover **On Account** → should land in Tally
3. Multi-bill Payment with leftover **Advance** → should land (auto ref name)
4. Open `TDK-PAY-2026-0003` Preview → should show voucher **#2**

---

## [2026-07-06] Party Form — Multi-country dropdown + Bank Details removal

### Context
During the same session as backend Tally 6.2 mailing details fix, user asked to:
1. Remove Bank Details section from Party Form (not needed on customer ledgers)
2. Support all 25 countries the app already supports (Settings had multi-country, Party Form was India-only)

### Added
- **src/constants/countries.ts (NEW)** — Authoritative list of 25 countries (Tally-canonical spellings, sorted alpha): Australia, Bahrain, Bangladesh, Canada, China, France, Germany, India, Japan, Kenya, Kuwait, Malaysia, Nepal, New Zealand, Nigeria, Oman, Qatar, Saudi Arabia, Singapore, South Africa, Sri Lanka, Tanzania, UAE, United Kingdom, United States. Exports `COUNTRIES` (string[]) + `DEFAULT_COUNTRY = 'India'`.

### Changed
- **src/components/forms/PartyForm.tsx:**
  - `COUNTRY_OPTIONS` const now maps from `COUNTRIES` constant (was hardcoded India-only, 1 option).
  - Imports `COUNTRIES, DEFAULT_COUNTRY` from new constants file.
  - **Bank Details JSX section removed from render** (toggleRow + expandSection with 5 PartyInputs).
  - Interface field `bankEnabled` + all bank state hooks (bankBeneficiaryName, bankName, bankAccountNo, bankIfsc, bankBranch) + useImperativeHandle getData return values preserved so external refs/PartyFormData interface don't break. `bankEnabled` stays `false` forever, so downstream payload conditionals never fire.
- **app/ledger/create.tsx:** `bankDetails: pd.bankEnabled ? {...} : undefined` payload block removed. `vatDetails:` block preserved.
- **app/sales/create-invoice.tsx:** `bankDetails: pd?.bankEnabled ? {...} : undefined` payload block removed. `vatDetails:` block preserved.

### Not changed
- `app/settings/language.tsx` — uses its own `COUNTRY_TZ` object as source (locale/tz features). Today's Party Form list happens to align 1:1. Future DRY pass can merge them.
- Backend `bankXml` code in `tally-write.js` — dormant path preserved (never fires when `bankEnabled=false`), ready for future re-enable behind a config flag (e.g. bank details on supplier ledgers only).
- Read path (Tally → DB sync via ingestProcessor) untouched — if an existing ledger has bank details in Tally, they still populate our DB.

### QA
🟢 GREEN — LITE subagent (11 checks all passed): TypeScript `npx tsc --noEmit` = 0 errors, PartyForm imports + COUNTRY_OPTIONS wired, Bank JSX cleanly removed, state hooks + interface preserved, both payload files clean, git diff scope shows only 4 expected files.

### Files
- `frontend/src/constants/countries.ts` (NEW)
- `frontend/src/components/forms/PartyForm.tsx`
- `frontend/app/ledger/create.tsx`
- `frontend/app/sales/create-invoice.tsx`

### Commit
`75e4aea5` on `main`

### 🔴 Pending user device verification
Open Party Form (from Ledger → New OR Sales → Invoice → Add Customer). Verify:
1. Country dropdown now shows 25 options (not just India).
2. Bank Details toggle + fields are GONE from the form.
3. Creating a ledger with non-India country (say UAE) syncs correctly to Tally (mailing details show UAE).
4. Creating a ledger with India works exactly as before (regression sanity).

---

## [2026-07-01] (R3) UX — Trust backend order, remove client-side re-sort

### Fixed
- R2 client-side sort (`b.date.localeCompare(a.date)` then tdkRef tiebreak) was fighting the backend order.
- Backend now sorts by `av.created_at DESC, av.id ASC` (app-side entry timestamp) — correct business flow: Invoice on top, chained Receipt directly below within same pair.
- Removed `.sort()` on `allMerged` entirely. Queue rows still merged in front of posted rows (in-progress work always on top).

### QA
🟢 GREEN (formal subagent R3, mobile side).

### Commits
- `0c873b0c` → tallydekho-mobile-V4

---

## [2026-07-01] (R2) UX — Same-day sort tiebreak by tdkRef

### Fixed
- Audit-Trail My Entries: when multiple entries share the same date (common with same-day Sales+Receipt pairs), the previous sort `b.date.localeCompare(a.date)` returned 0 and stable-sort kept input order — pushing the freshest pair below older same-day entries.
- Added tiebreak: `(b.tdkRef || '').localeCompare(a.tdkRef || '')` → newer sequence wins (e.g. `TDK-SAL-2026-0030 > TDK-SAL-2026-0029`), latest pair now on top of the same-date cluster.
- Double-guarded with `|| ''` fallback so entries without tdkRef fall through to prior stable behavior.

### QA
🟢 GREEN (formal subagent R2) — `tsc --noEmit` 0 errors, null-safe verified.

### Commits
- `468b2f81` → tallydekho-mobile-V4

---

## [2026-07-01] UX — Remove 'Linked to Sales' subtitle on Receipt tiles

### Changed
- `app/reports/audit-trail.tsx` — removed `↳ Linked to Sales …` subtitle from Receipt entries in My Entries tab.
- Rationale: Sales + Receipt tiles always render sequentially in the same date group, so pairing is visually implied without needing a hyperlink-style subtitle.
- Removed dead legacy computation (`linkedInvoiceRef` / `linkedInvoiceAmt`) that populated the deleted subtitle.
- Kept `parentTdkRef` / `parentTallyVoucherNo` in the `VoucherEntry` model — still returned by `/vouchers/my-entries` and available for future drill-down UX.

### QA
🟢 GREEN — `npx tsc --noEmit` zero errors, no other refs to removed fields.

### Commits
- `2a6b57e9` → tallydekho-mobile-V4

---

## [2026-06-06] QA Testing Agent — movement-analytics.tsx

### Bugs Fixed (QA inline)
- Removed unused `useRef` import (chartScrollRef was deleted but import remained)
- Removed unused `Dimensions` import (SW constant was deleted but import remained)
- Fixed `flex: 1` on tap-overlay TouchableOpacity (conflicted with `width: DAY_W` — Yoga would distribute space evenly instead of fixed 44px per column)

### Verified Clean
- TypeScript: `npx tsc --noEmit --skipLibCheck` → EXIT:0
- Y-axis Svg correctly pinned outside ScrollView
- Scrollable Svg + tap overlay correctly inside ScrollView
- Search filters `filtered` array, clears with X
- Auto-select first item on load
- tr=0 items show '—' not '0.0x'

## 2026-06-10 — Barcode Section Audit + Scanner Fixes (INCOMPLETE)

### Done
- Full backend audit: 500 barcodes in DB, all status='active', lookup SQL works, IP 192.168.29.243 confirmed
- Fixed scanner race condition: `isProcessingRef` ref-based guard (stale closure fix)
- Wrapped `handleBarcodeScanned` in `useCallback([companyGuid])`
- Removed buggy `cameraActive` gate
- Added "View Barcode" bottom sheet modal (tap linked product → see barcode)
- Installed `react-native-qrcode-svg@6.3.21`
- Added QR code in View Barcode modal (NEEDS REVERT — user wants CODE128)

### Pending (URGENT)
- Revert QR code → replace with proper wide CODE128 barcode image
- Fix api error when tapping products (not investigated)
- CODE128 bar width fix: min 3dp/module + ScrollView + quiet zone

### Commits
- `b766dd84` — race condition + useCallback fix
- `4bce8c2f` — replace onShow with useEffect (reverted in next commit)
- `b59e2886` — simplified scanner, removed cameraActive
- `1d6ac5ad` — View Barcode modal (CODE128 SVG)
- `34c54c41` — QR code (NEEDS REVERT/FIX)

## 2026-06-24 — Invoice PDF Before Tally Sync Flow (Phase A)

### Mobile Changes
- `src/services/api.ts`: Added `getInvoicePreview(tdkRef, companyGuid)` and `invoiceSharePdf(tdkRef, companyGuid, waitForTallyNumber, maxWaitMs)`
- `src/services/socketService.ts`: Exported `getSocket()` for direct socket event listening
- `app/sales/invoice-preview.tsx` (NEW SCREEN):
  - Fetches provisional/final invoice snapshot from `/tally/invoice/:tdkRef/preview`
  - Shows DocumentPreviewPage with provisional banner + watermark
  - Auto-refreshes via `invoice_posting_updated` WebSocket when Tally syncs
- `src/components/document/DocumentPreviewPage.tsx`:
  - New optional props: `isProvisional?: boolean`, `watermarkText?: string`
  - Provisional watermark overlay (pointer-events: none)
  - Null-safe `documentTitle` fallback
- `app/sales/create-invoice.tsx`:
  - Success screen: 3 buttons only (Preview, Share PDF, Done)
  - Removed: WhatsApp, IRN, EWB buttons from success screen
  - Preview tap: navigates to `/sales/invoice-preview?tdkRef=...`
  - Share PDF tap: 10s wait → local PDF generation → native share sheet (expo-sharing)
  - `invoiceUuid` captured in submitResult
- `app/reports/audit-trail.tsx`:
  - Unsynced entry tap with `tdkRef` → navigates to provisional preview (not Alert)

---

## Archived changelog (former `frontend/CHANGELOG_AGENT.md`, 2026-06 → 2026-09-30)

The repo-root `CHANGELOG_AGENT.md` (entries above, maintained through 2026-11-06) and this file were kept in parallel; they were merged on 2026-11-06 and the root copy deleted. Entries below are the older frontend-only log, unchanged.

## 2026-09-30 — Overdue Parties: Ledger-style swipe cards (Yash approved)

- New `src/components/OverduePartyTile.tsx`: `EntityListTile` card; swipe left for Call / WhatsApp (`ReanimatedSwipeable`, same look as the Ledger tab); no swipe when the party has no phone. Tap opens the party ledger (`/ledger/<ledgerGuid>` from the AR/AP payload).
- `app/kpi/receivables.tsx`, `app/kpi/payables.tsx`: Overdue Parties use it; old inline round buttons and their styles removed.
- Tested: tsc 0 errors; ESLint 0 errors (2 existing `lastSyncAt` warnings); `npm test` verify scripts pass.

## 2026-09-30 — Production readiness (plan phases 2–5)

- Phase 2: real AI weekly chart or empty message; retry banners on report screens; e-Invoice/EWB settings Retry + Save disabled until loaded; socket token refresh with silent retry + banner; GUID-only voucher taps; About shows real version; Create Item batch number + expiry (opening stock into that batch); Sent reminders screen.
- Phase 3: Receivables/Payables rows carry `olderYear`; tapping an older-year bill shows "Older financial year"; note "Includes N bill(s) from earlier years" under the list.
- Phase 4: `android/` removed from git (+ `/android`, `/ios`, `.env` ignored); de-duplicated permissions, Face ID usage text, splash image; `eas.json` remote app version + `autoIncrement`; `@sentry/react-native` via `src/services/monitoring.ts` (only active when `EXPO_PUBLIC_SENTRY_DSN` is set; release builds silence console.log/info/debug); root `ErrorBoundary`; 5xx responses reported; `@expo/ngrok` moved to devDependencies.
- Phase 5: deleted 18 dead screens, mock data, template assets, `reset-project.js`; removed unused deps (jsbarcode, jszip, expo-blur, expo-haptics, react-native-dotenv); tsc 60 → 0 errors, ESLint 457 → 0 errors (4 justified disables); `useApiData` starts in `loading`; EWB `Field` hoisted (fixes focus loss while typing).
- i18n: ~3,700 hard-coded strings moved to `en.json` under `screens.<screenId>.*` (plus 4 `home.*` fallbacks); English text unchanged; Settings My Access / Approvals / Invitations rows now show labels instead of raw keys; all 10 locales machine-translated (Hindi/Gujarati need a native spot-check). Logic values, Tally field names, PDF titles/file names and brand/acronyms intentionally stay in English.

## 2026-09-29 — Receivables/Payables filter sheet + unified voucher preview

- Receivables / Payables: header calendar + filter icon; `ArApFilterSheet` (Show: Outstanding bills / Receipts-Payments; Status: Overdue only, disabled for settlements); amber active chips; old chip row removed.
- Cash in Hand: date pill removed; always uses the selected FY.
- `src/utils/openVoucherPreview.ts`: one rule for voucher taps — GUID → `/document/[id]`, TDK ref → TDK preview route, else "Not yet synced". Used by My Entries (audit trail), Receivables and Payables bill + receipt/payment tiles.

---

## 2026-09-29 — QA follow-ups: bill-check timeout, duplicate IRN alert, API docs

- `request()` takes an optional `timeoutMs`; `analyzePurchaseBill` uses 45 s (others stay 25 s).
- Bill check failures (busy / too slow / network) show an alert with **Try again**.
- `409 DUPLICATE_IRN` on save → "Already booked" alert instead of "Submit Failed".
- `API_USAGE.md` lists the new purchase endpoints.

---

## 2026-09-29 — Purchase Invoice: e-Invoice QR import, bill validation, universal item scanner

- **e-Invoice QR:** strict JWS parser (`src/utils/einvoiceQr.ts`, no signature verification yet) + `EinvoiceQrPreviewSheet` (vendor by GSTIN, duplicate IRN block, buyer GSTIN warning). Apply fills vendor / inv no / date — all editable, never auto-saves. `einvoiceImport` sent with submit; QR total mismatch warning. `npm run verify:einvoice` (13 checks).
- **Bill upload:** Take Photo / Upload (Photo Library, PDF). QR in photo → review sheet; server `/purchase/bill-analyze` blocks non-bills; warn-only match of vendor GSTIN / inv no / grand total (±₹1). File uploaded after save.
- **Universal scanner:** item-row scan on Sales Invoice / Sales Order / Purchase Order / Purchase Invoice → `/stocks/barcode-scanner?mode=pick` (locked Stocks scanner; pipeline unchanged). `sales/product-scanner.tsx` kept until tested.
- PI QR camera overlay no longer touches the top.
- QA: YELLOW (no blockers). Device testing by user pending.

---

## 2026-09-25 — Printed barcode speed (stable native listener)

**CONFIRMED:** `expo-camera@57.0.5` disables barcode scanning when
`onBarcodeScanned` is undefined (iOS removes session outputs). Fix: keep
listener attached; gate accept in JS. Also: `zoom={0}` (no auto-zoom), drop
iOS 450ms listen delay, same-unknown suppress 2.5s (no 1.6s global re-arm),
`autofocus="off"`. Incident: `docs/incidents/2026-09-25-printed-barcode-speed.md`.
Build `2026-09-25-printed-speed`. Physical timing **NOT RUN**.

---

## 2026-09-25 — Camera: full-screen preview + bracket spatial filter (Jun 11 + MD)

Reverted frame-nested CameraView. Pattern: measured full-screen host + explicit
CameraView pixels; overlay dims + transparent strip/square + corners; spatial
filter accepts only in-bracket codes. Fixes scan failures from tiny preview
and restores full-screen live video. Build `2026-09-25-fullscreen-jun11`.

---

Implemented `TallyDekho_Camera_Stability_and_Debugging_Standard.md` as source of truth:

- **Layout:** `absoluteFill` → measured host + explicit CameraView pixels; preview nested in product frames (Stocks 130 / Sales 240 / PI QR 260).
- **Lifecycle:** `useCameraOwnerGate` (permission ∧ focus ∧ AppState ∧ open ∧ bounds); unique mount IDs.
- **Diag:** `__DEV__` only; optional `EXPO_PUBLIC_CAMERA_DIAG_URL`; Settings → Camera diagnostic (dev); probe inert in release.
- **Docs:** `docs/engineering/DEBUGGING_STANDARD.md`, `CAMERA_SCANNER_STANDARD.md`, incident `2026-09-25-camera-preview.md`; Cursor rule `tallydekho-camera-debugging.mdc`.
- Deps unchanged. Probe live preview CONFIRMED; Stocks/Sales/PI QR device matrix pending Yash.

---

## 2026-09-25 — Stocks scanner: Jun 11 UI on full-screen route

Hybrid fix: keep Jun 11 design (130px strip frame, spatial filter, torch,
zoom, result panel) but mount it on `/stocks/barcode-scanner` stack screen
— not RN Modal (black preview + frame stuck at top on iOS). Expo
`useCameraPermissions` + focus remount for CameraView. List screen navigates
via `stocksBarcodeScan` bridge. Not the purchase QR Modal / 240² product frame.

---

## 2026-09-24 — Scanner Jun 11 restore + hard HSN validation

Stock barcode scanner restored to Jun 11 behavior (spatial frame filter,
torch, zoom, out-of-frame hint). Overlay uses flex:1 so frame centers in
Modal. Invalid HSN is blocked on item detail, HSN validation, Edit Stock,
and Create Item (no soft “you can still save”).

---

Forensic: frame pushed up came from flexGrow overlay hack; black preview from
`cameraActive` gate (known since b59e2886). Restored Option A styles
(`flex:1` / 130 / `flex:1`) and mount CameraView whenever permission granted.

---

Barcode scanner overlay: frame was stuck at top — centered with safe-area.
Item-detail Generate now reads Barcode Settings (storage mode + type) so
Tally Alias / Part Number sync applies the same as the Barcodes screen.

---

## 2026-09-24 — Stock detail: HSN inline in Pricing & Cost

Removed standalone HSN card. HSN sits under Last Selling Price with pencil;
once digits differ from saved, icon becomes save (checkmark) → Tally Alter.

---

## 2026-09-24 — HSN validation UX + edit bug + detail enter HSN

Cross-check: 218 items have valid HSN (hidden from report); 283 truly empty
in `stocks.hsn` from Tally — not a false “all missing”.
Removed “N needs attention” tile. Enter HSN on validation + item detail.
Edit Stock modal was binding HSN to SKU — fixed; alter pushes HSN to Tally
and optimistically updates local `stocks.hsn`. Removed Generate Barcode on
item detail.

---

## 2026-09-24 — Stock alerts: remove duplicate settings + map to Stocks

Settings → Notifications “Stock Alerts” opens Stocks → Settings → Alerts
(`?section=alerts`). Legacy `/settings/stock-alerts` redirects there.
Hint: Email/WhatsApp use profile contact; delivery when channels configured.

---

## 2026-09-24 — Items settings + HSN validation report

Removed Aging / Analysis Period. Fast/Slow/Dead tabs. HSN Verification toggle
+ report screen. Create Item gates batch/expiry; soft HSN hint. Sales invoice
warns on negative stock when setting OFF.

---

## 2026-09-24 — Warehouse Code display + settings cleanup

Warehouse list/detail show code (searchable). Settings: Cycle Count + Archive
Layers removed; Warehouse Code saved as Tally Godown Alias (append-only).

---

## 2026-09-24 — Stock General settings: unit fallback + buffer + cleanup

Removed Reorder Calc Mode, Low Stock Threshold Mode, Archive Old Stock Activity
from Settings UI. Default Unit = app/web display fallback when Tally unit blank
(`displayUnit`). Purchase Buffer Days drives Reorder Suggest horizon. UoM list
merges `units` master ∪ stocks. Create Item untouched.

---

## 2026-09-23 — QA: refreshContext uses active workspace id

Testing Agent: `refreshContext` now reads `getActiveWorkspaceId()` instead of
stale React `workspaceId`, so `switchWorkspace` → `await refreshContext()`
validates the switched workspace before the next render.

---

## 2026-09-23 — Error UI theme + company/workspace heal

`ApiStateViews` Retry uses `COLORS.brandPrimary` (#1A1A1A), not hardcoded
slate `#3F5263`. Friendly map for COMPANY_SCOPE_DENIED. Workspace switch no
longer restores stale company cache before context validation; Home Retry
refreshes workspace context first.

---

## 2026-09-23 — P0/P1 stock semantics alignment

Unified “Low Stock” = settings `default_low_stock_level` (qty 1…T); Reorder =
Tally item/group reorder. Low Stock + Reorder fetch via `stockHealth` (limit
5000). Reorder Add to PO prefills create-order like Low Stock. Hub Movements →
movement-analytics; Fast Moving → fast-slow. Settings subtitle corrected.
On-hand + total-stock badges use threshold (not hardcoded 10 / reorder).
Transfer details: mock removed; loads real transfer by `voucher_guid`.

---

## 2026-09-22 — Low Stock screen + Modal scrim restore

New `/stocks/low-stock`: Low / Out tabs only; threshold =
`default_low_stock_level` from inventory settings. Long-press multi-select and
row Add to PO prefills create-order (qty 0, rate from closing when present).
Hub Low-Stock tile routes here (Reorder Queue untouched). Shared Modal dim
restored (flex root, not absoluteFill) for FAB Quick Actions, BottomModalShell,
DatePicker, AddParty, FilterBottomSheet, ledger/audit/barcodes sheets.
Branch `cursor` `1f71adf8`.

---

## 2026-09-21 — Cash/bank label + workspace-scoped stock cache clear

Dashboard `netCash` string is “Cash & Bank Balance”. `clearStockListCache()`
clears the active workspace only; logout still clears all.

---

## 2026-09-21 — Create/maxDate uses device calendar

Invoice, receipt, payment, stock transfer/adjust, and AI insights date-only
fields use `todayLocalISO()` instead of UTC `toISOString().slice(0,10)`.

---

## 2026-09-19 — Insufficient credits is 402, not logout

`kindFromStatus(402)` is validation. Existing `INSUFFICIENT_CREDITS` toast codes
stay. No Billing screen added.

---

## 2026-09-19 — Mobile production remediation (P0/P1 closure)

Logout now calls `POST /api/auth/logout`, then always clears local tenant state
even if the network call fails. Invoice/proforma drafts, prefills, logos, FY,
company selection, ledger/stock caches, and `pre_auth_token` are swept. Tenant
keys are `user + workspace + company + feature`; ambiguous GUID-only leftovers
are deleted, never adopted. Biometric PIN is phone-bound in SecureStore.

`AuthContext.company` is the only company authority. `/auth/me` no longer writes
company. The 10s poll compares guid vs id correctly and does not rewrite a valid
selection. FY uses a non-native overlay (same chrome), equality + workspace+company
persistence. Demo authority is `companies.is_demo` only. RECONNECTING stays real.
Demo writes go to `/api/demo/entries`. Tenant sockets require workspaceId.
Barcode template uses the central client. Stock create sends the entered HSN.
Submit success is after API. Reports clear on workspace/company/FY change.
Production ATS `NSAllowsArbitraryLoads` is false. `tsc --noEmit` is 0.
Unused `switch-fy.tsx` deleted. Physical Android company/FY still MANUAL.

## 2026-09-18 — Workspace isolation: no global pairing, scoped sockets, token refresh

### Why
A user who owns unpaired workspace ABC and is invited to paired workspace XYZ saw
XYZ's pairing state, company cache and toasts leak onto ABC and back. Three causes:
a user-global `is_paired` flag, socket events applied without checking which
workspace sent them, and async reads that wrote their result after the user had
already switched. Separately, mobile never stored the refresh token, so every
session died 15 minutes after login.

### Change — pairing is per workspace
- `AuthContext`: removed `isPaired` / `setIsPaired` and the `is_paired` AsyncStorage
  key. Auth is user identity only; `is_paired` is now swept on logout for old installs.
- Home screen: `livePaired = isPaired || CONNECTED || RECONNECTING` → `tallyConnected`.
  RECONNECTING still serves Demo books, so it no longer counts as a live link, and the
  connect/disconnect toast re-baselines on workspace switch instead of firing.
- `settings/tally-sync`, `_layout`, `(auth)/otp|verify-pin|reset-pin|tally-sync` and the
  nine screens that only destructured `isPaired` all read the workspace instead.

### Change — socket events are workspace-scoped
- New `src/services/workspaceEventScope.ts` (pure, unit-tested): `synced`, `paired`,
  `unpaired`, `tally_connection`, access/hard-sync/restore events are dropped unless
  `payload.workspaceId` matches `getActiveWorkspaceId()` **at delivery time**. A payload
  with no workspaceId is dropped as well. `invitation_received` stays user-scoped.

### Change — late replies can no longer write to the wrong workspace
- `WorkspaceContext`: generation counter bumped on every switch. `refreshContext`,
  `refreshWorkspaces` (20s timer) and `switchWorkspace` re-check it after each await.
- `AuthContext` status poll: re-checks the active workspace after each await and resets
  desktop-online state on switch.

### Change — access token refresh
- `api.ts`: refresh token stored in **SecureStore** (`td_refresh_token`), never
  AsyncStorage. A 401 triggers one refresh then one replay; concurrent 401s share the
  single in-flight refresh. Sign-out only on a rejected refresh — an unreachable refresh
  endpoint keeps the session, and 403/RBAC still never signs out. Cleared on logout.

### Tests
`npm test` now also runs `scripts/verify-workspace-isolation.mjs` (19 checks).

### How to re-test
1. Sign in as a user with an unpaired Personal workspace and a paired invited one.
2. Switch between them repeatedly: pairing banner, Offline badge and toasts must follow
   the selected workspace only, with no toast fired by the switch itself.
3. Pair/unpair from Desktop on one workspace while the other is open — the idle one
   must not react.
4. Leave the app open past 15 minutes and pull to refresh: data loads, no logout.
5. Hit an RBAC-denied screen as a restricted member: toast, still signed in.

---

## 2026-09-17 — Desktop 409 when already paired + ledger JSON names

### Desktop
- Startup called `/desktop/pairing-code` before checking paired → **409** while CONNECTED.
- Fix: check `pairedDevice` first; surface `DEVICE_ALREADY_PAIRED`; PairingPanel won't refresh while paired.

### Mobile / Backend
- One ledger stored as `["Motu Halve Wala","Chaurha Wala"]` (processMasters used raw NAME array).
- Fix: `processMasters` uses `tallyName`; repaired DB row; ledger list normalizes JSON-ish names.

---

## 2026-09-17 — Android local build/runtime speed (ABI + Metro)

### Why
Android `expo run:android` / Gradle was much slower than iOS. Root causes: native build for **4 ABIs**, Metro capped at **2 workers**, network inspector on.

### Change
- `android/gradle.properties`: `reactNativeArchitectures=arm64-v8a` only; Gradle cache/parallel; JVM 4G; `EX_DEV_CLIENT_NETWORK_INSPECTOR=false`
- `metro.config.js`: workers = min(6, cpus-1) instead of hard 2
- `expo-build-properties` + `app.json` plugin so prebuild keeps single ABI

### How to re-test
1. Stop Expo, clear Android build once: `cd android && ./gradlew clean`
2. Restart: `npx expo start -c` then `npx expo run:android`
3. Emulator on Mac needing x86_64: set `reactNativeArchitectures=arm64-v8a,x86_64`

---

## 2026-09-14 — Phase E: onboarding canonical pair + CONNECTED write gates

### Why
Onboarding still called legacy `/tally-sync/pair`; some creates gated on `isPaired`.

### Change
- `(auth)/tally-sync` → `pairWorkspaceTally` via Personal Workspace id
- Legacy `pairWithTally` / `unpairDevice` reject with WORKSPACE_REQUIRED
- Ledger/warehouse create require `pairingStatus === CONNECTED`
- Settings Restore/Replace conflict copy

### Manual test
1. Fresh signup → pair with Desktop code → awaiting first sync
2. Create warehouse while RECONNECTING → blocked
3. Settings Pair conflict messages match locked copy

---

## 2026-09-14 — Header: lock Demo company switch; restore FY dropdown

### Why
Demo Mode still felt switchable; FY opened a full page instead of the old compact dropdown.

### Change
- Header: company tap disabled in Demo (no chevron); CONNECTED + 2+ companies still opens switch screen
- Header: FY back to transparent Modal dropdown (previous UX)
- switch-company: auto-back if opened in Demo Mode

### Manual test
1. UNPAIRED/RECONNECTING: company name not tappable; FY opens dropdown under header
2. CONNECTED with 2+ companies: company opens Switch Company screen; FY still dropdown

---



### Why
Owner saw “paired, syncing started” but never left Demo. Tally Sync treated only CONNECTED as paired.

### Change
- Socket: `tally_connection` / `unpaired` / `paired` → refreshContext; CONNECTED bumps lastSyncAt
- Auth poll: adopt live company when workspace_status flips to CONNECTED (not inside isPaired setter)
- Tally Sync: RECONNECTING counts as paired UI; pending refresh if context fetch in-flight

### Manual test
1. Pair → Tally Sync shows paired, Home still Demo until first sync.
2. Desktop init-sync → Owner company becomes live Tally books.
3. Unpair → Demo Company only.

---



### Why
Product decisions Waves 2–4: missing view/create caps must hide **and** deep-link fail closed; finish ungated stock/ledger creates; company/FY/CC scopes in pickers; sensitiveDisplay on money/qty surfaces (BE authoritative). No Mobile checkout.

### Change
- Added `RequireCapability` / `useRequireCapability` (deny while caps loading; toast + back/home when denied).
- Module hubs (sales/purchase/expenses/voucher) + tabs ledger/stocks/reports: require `*.view`; tabs `_layout` uses `href: null` when missing.
- Mount-time create guards on all create screens; wired `assertCanCreate` + CONNECTED on stock transfer/adjustment/item/warehouse, ledger create, StockTransfer/BulkTransfer/AddParty modals.
- QuickActions expense cap → `expense.create`; Settings Approvals Owner/Admin only; License Web portal CTA Owner only (`isOwner`).
- `filterScoped` extended for companies / fys / costCentres; Header company + FY pickers scoped; `useRbasCreate` exposes `scopeCostCentres`.
- `sensitiveDisplay` on Home KPI cash/bank, ModuleTiles purchase values, CashflowCard, stocks inventory valuation, bank-balance / cash-in-hand KPI screens.

### Manual test
1. Member without `sales.view`: deep-link `/sales` → toast + redirect; tile hidden.
2. Member without create cap: open create URL → redirect; FAB item hidden; submit gated.
3. Scoped company/FY: Header pickers only show allow-list.
4. Role with `cash_balance` / `bank_balance` masked: Home KPI + KPI detail show `••••` / hidden.
5. Non-Owner: License shows ask-Owner copy (no Web portal CTA). Non-Owner/Admin: Approvals row hidden.

### Risks
- Mobile has no cost-centre pickers on create forms yet — `scopeCostCentres` ready when fields appear.
- Pre-existing `StyleSheet.absoluteFillObject` tsc noise unchanged.

---

## 2026-09-12 — Create screens: useRbasCreate Entry Mode + scope filters

### Why
RBAS Entry Mode and scoped party/godown pickers must be consistent across all create flows (not only sales invoice).

### Change
- Wired `useRbasCreate` on sales order/credit note/delivery note, purchase invoice/order/debit note, expense/payment/receipt/journal/contra, and stock transfer.
- `RegularOptionalToggle` gets `entryMode`; party/ledger lists use `scopeParties`; warehouses use `scopeGodowns`.
- Sales `create-invoice.tsx` left unchanged (already done).

### Manual test
Open each create screen under a scoped RBAS role: toggle Regular/Optional follows Entry Mode; party and warehouse pickers only show scoped masters.

---

## 2026-09-12 — Already-paired copy

### Why
Cross-workspace pair failure was a one-liner.

### Change
- Tally Sync shows full unpair-elsewhere vs workspace-already-has-desktop copy.
- `WORKSPACE_ALREADY_HAS_DESKTOP` in rbasErrors.

---


## 2026-09-12 — Hard Sync / Restore approvals

### Why
Owner/Admin must approve Desktop Hard Sync and new-computer restore from Mobile.

### Change
- Settings → Approvals: live poll, restore by Desktop code + backup, already-approved Hard Sync copy.
- Tally Sync: link to Approvals; toast on `hard_sync_request` / restore events.
- `approveWorkspaceRestoreByCode` → `POST /api/workspace/restore/approve`.

### Manual test
Owner: Settings → Approvals. Desktop Request restore → enter code + Approve. Desktop Hard Sync (multi-user) → Approve/Reject.

---

## 2026-09-11 — safePush, date ISO, multi PDF, audit refresh; bottom-sheet rollback

### Why
Double-tap nav stacked screens; date filters empty/wrong under Settings formats; Thermal multi-share opened N sheets; Audit Trail stale on back; attempted global Gorhom bottom-sheet migration broke sheet open (Profile / Daybook voucher type) — rolled back to RN Modal.

### Change
- `safeNavigation.ts` + `safePush` across high-traffic screens/tiles/`openLedger`.
- `dateRange.ts` + `DateRangePickerModal` ISO wire/state; Settings-aware display; FY-safe presets.
- `multiShare` + `pdf-lib`: always one share sheet (Thermal/Classic/mixed).
- Audit Trail soft refresh with `fetchGenRef`.
- Voucher Config QR/UPI helpers (`voucherPdfConfig`, `sanitizeImageSrc`).
- Bottom sheets: keep `FilterBottomSheet` / `BottomModalShell` as RN Modal (no `BottomSheetShell`).

### Manual test (QA YELLOW)
Filters/modals open; double-tap no stack; date range Apply/Reset FY; multi-share one sheet; Audit Trail leave/return; Payment Reminders party sheet; Voucher Config QR print.

---

## 2026-09-09 — Mobile UI keyboard / party create fixes

### Why
Filter search covered by keyboard; bank/profile sheets gapped on Android KAV `height` when closed; contact edit autofocus; AddPartyModal not on shared shell; sales customer create missing Tally parent.

### Change
- `FilterBottomSheet`: keyboard-height `paddingBottom` (iOS will / Android did show-hide); still RN Modal.
- `bank-feeds` BankFormSheet + `profile` OTPVerifySheet: KAV only while keyboard open; Android `behavior` undefined; contact `autoFocus={false}`.
- `AddPartyModal` → `BottomModalShell`.
- Sales `createTallyParty`: `parent: 'Sundry Debtors'`.

### Manual test
Filter search with keyboard; bank/profile sheets flush when keyboard closed; profile contact edit no autofocus; Add Party sheet; create customer under Sundry Debtors.

---

## 2026-09-09 — Thermal multi-select Share = one PDF (Classic parity)

### Why
Classic multi-voucher Share produced one multi-page PDF; Thermal opened N share sheets (mixed page-size loop).

### Change
- `shareMultiPageHtmlPdf`: all A4 → existing HTML stitch; all Thermal → normalize width + `wrapThermalHtml` stitch; mixed / stitch fail → `pdf-lib` merge → **always one share sheet**.
- Added `pdf-lib` dependency.

### Manual test
Multi-select Thermal vouchers → one share; Classic unchanged; mixed Thermal+Classic → one merged PDF.

---

## 2026-09-08 — Date filters: ISO + Settings style + Home FY

### Why
Date range filters returned empty / ignored Settings Date Style; presets collapsed on closed FY; modal spoke DD/MM/YY only.

### Change
- Wire/state/API: always ISO `YYYY-MM-DD`. Display: `settings.date_format` (incl. real `DD-MM-YYYY`).
- `DateRangePickerModal`: ISO Apply; FY-safe presets; Clear → Reset to FY; Settings-aware labels.
- Migrated registers, Day Book/Audit, ledger detail (re-fetch + year-aware dates), KPI dates, EWB/e-Inv, financial/GST/AI, stock ledger/transfer/on-hand.
- Home FY remains the only year switcher; ranges cannot escape FY.

### QA next
Founder device: Last 3 Months / manual dates / Date Style switch / FY switch on Home.

---

## 2026-09-08 — Publish hardening (audit fixes)

### Why
Pre-publish audit: silent ledger PDF fallback, pagination under filters, mixed Thermal+A4 stitch, token logs, broken About URLs, LAN API in release builds.

### Change
- Ledger multi-share: no balance-only invent; partial-export confirm; load-more not gated on `filtered.length`; `hasMore` uses unique append length.
- `multiShare`: mixed page sizes → sequential shares; same-size stitch keeps detected page size.
- Cash Register filter Apply closes sheet.
- Stop logging raw push/auth tokens (boolean/`__DEV__` only).
- About: live Privacy + Terms PDF URLs.
- API/Auth: LAN fallback `__DEV__` only; prod → `https://api.tallydekho.com`.

### QA
Testing Agent **YELLOW** (static + tsc; device manual list below). Pushing `cursor`.

---

## 2026-09-08 — P0/P1 publish prep (universal print + cleanup)

### Why
Close Spec holes before cursor push: Receipt Note on commercial cream/PDF; remove orphan Ledger/ZIP; clean tsc.

### Change
- `receipt_note` → commercial-print (qty-note hide amounts; purchase parties); cream + Settings PDF via `delivery_note` format.
- Deleted unused `tdLedger*`, `shareZip.ts`; scrubbed ZIP comments.
- `cash-in-hand.tsx` tsc fix; ledger Summary A + search shimmer (prior).
- Offline: thermal smoke / Spec (10 types) / register sheets / `tsc --noEmit` PASS.

### Not in this pass
- Quotation create screen
- ESC/POS; device Thermal smoke still founder-side

---

## 2026-09-07 — Thermal replaces Ledger (PDF template)

### Why
Master Spec v1: middle layout is Thermal (80mm default / 58mm compact), not Ledger. Cream on-screen sheets stay; Settings PDF Preview uses thermal page size when Thermal is selected.

### Change
- Template IDs: `td_thermal_v1` / `td_thermal_commercial_v1` (legacy `td_ledger_*` / `modern_a` map → Thermal).
- Renderers: `tdThermal.ts`, `tdThermalCommercial.ts` + `thermalShared.ts` (true narrow reflow).
- Settings: Thermal format + 80/58 paper chips; PDF Preview uses thermal page size.
- `voucherPdf` / `multiShare`: non-A4 print size when Thermal.
- Offline: `qaThermalSmoke` PASS; `qaSpecCheck` PASS; `qaRegisterSheets` PASS.

### Not in this pass
- ESC/POS direct print
- Commit / push

---

## 2026-09-07 — Multi-select: ZIP → multi-page PDF (ledger style)

### Why
Device ZIP share failed. Match multi-ledger: one PDF, page-break per voucher, one share sheet.

### Change
- `shareVouchersAsMultiPagePdf` / `shareCompliancePdfsAsMultiPage` stitch Spec/compliance HTML with page breaks.
- Chooser: “Each voucher (one PDF)” (no ZIP).
- Call sites: ledger detail, registers, audit, cash, e-invoice/ewb.

---

## 2026-09-07 — QA: Total Stock mapStockRows StockItem icons

### Why
Testing Agent typecheck: `mapStockRows` omitted required `icon` / `iconColor` / `iconBg` on `StockItem`.

### Change
- `stocks/total-stock.tsx`: default cube icon fields (UI already hardcodes cube).

---

## 2026-09-07 — Waves C–E: multi-select PDF sharing

### Why
Wire real multi-select Share PDF across registers, audit trail, cash, compliance lists, stock screens, GST, and AI insights (footer-only UI; no Export/XLS).

### Change
- Helpers: `shareSummaryTablePdf`, `shareCompliancePdfsAsZip`, `buildCompliancePdfFile`.
- Sales / Purchase / Expense registers: footer multi-select (N selected, Select All, Cancel, Share PDF); `promptShareMode` → ZIP Spec PDFs or combined Day Book register PDF; Export removed; header no longer “N Selected”.
- Audit Trail + Cash Register: real share via chooser; titles Day Book / My Entries / Cash Register.
- E-Invoice + E-Way Bill: footer “Share PDF” zips individual compliance PDFs; header fixed.
- Stock Ledger / Total Stock + fast-slow, negative, expiry, valuation, snapshot: real stock/summary PDFs.
- GST + AI Insights: print-style summary table PDFs.

### Not in this pass
- No push / no merge to main

---

## 2026-09-07 — Phases 1–2: polish + preview-only stock/masters

### Why
Finish voucher polish/parity; stock journals + masters get cream printable preview only (no PDF share). Multi-select deferred.

### Change
- Accounting create success: Share PDF on payment/receipt/journal/contra/expense.
- Classic commercial PDF: all 9 types use Tally Prime core layout (type-specific meta; DN qty-only).
- `StockJournalPreview`: cream sheet for transfer/adjustment; wired from `DocumentPreviewPage`; **no Share PDF**.
- `masters/preview`: cream print theme for ledger/item/warehouse; **Share PDF removed**.
- Stock edit: no create-edit voucher flow in app — N/A this pass.

### Not in this pass
- Multi-select (Phase 4)
- Stock/master PDF generation

---

## 2026-09-07 — Share PDF on accounting voucher create success

### Why
Match sales create success: share voucher PDF from payment/receipt/journal/contra/expense create overlays.

### Change
- `create-payment|receipt|journal|contra|expense.tsx`: Share PDF after Preview via `shareVoucherPdfByRef` + filled brand `pdfBtn`.

---

## 2026-09-04 — Commercial Spec completion pass (preview + PDF)

### Why
Close Spec gaps: field loss, type rules, Ledger/Executive depth, RN sheet parity; then QA.

### Change
- Adapter: locked titles (Proforma≠TAX INVOICE), tax words NIL, secondary qty totals, DN non-valued, Quotation validity, CN/DN original+reason, non-posting flag, logo passthrough.
- Classic/Ledger/Executive: print CSS (thead/closing), richer meta, HSN+cess, hide DN amounts, accounting summary (Ledger), amount summary (Executive).
- `CommercialDocumentPreview`: HSN summary, tax words, type meta labels, DN qty-only.
- Offline Spec check: `qaSpecCheck.ts` — 9×3 PASS.

### Not in this pass
- Server-side PDF engine (Spec §32) — still client `expo-print`.
- Device visual smoke / golden PNG snapshots.

---

## 2026-09-04 — Rollback Option B: restore RN print-sheet previews

### Why
WYSIWYG WebView preview (preview === PDF layout) was wrong. Restore polished RN print-sheets for vouchers + commercial docs; PDF still uses Settings templates.

### Change
- Restored `AccountingVoucherPreview` + `CommercialDocumentPreview` RN sheets.
- Removed `DocumentTemplatePreview`.
- Settings layout preview back to Share PDF sample (no WebView modal).
- Kept SplashScreen `.catch()` fix.

---

## 2026-09-04 — Option B: preview === PDF layout + SplashScreen fix

### Why
User chose WYSIWYG: on-screen preview must match Settings layout (Classic / Ledger / Executive); Share PDF uses the same HTML. SplashScreen hide was throwing uncaught promises on reload.

### Change
- `DocumentTemplatePreview` — WebView of `generateDocumentHTML` from Settings format; same chrome + Share button.
- Commercial + accounting previews re-export that component.
- Settings: selecting a layout / Preview layout opens HTML modal; Share as PDF from there.
- SplashScreen `preventAutoHideAsync` / `hideAsync` swallow errors.

### Files
- `DocumentTemplatePreview.tsx`, `CommercialDocumentPreview.tsx`, `AccountingVoucherPreview.tsx`
- `settings/voucher-config.tsx`, `app/_layout.tsx`

---

## 2026-09-04 — Commercial preview app-wide (all open paths)

### Why
Commercial print-sheet must open everywhere — Sales/Purchase lists, Audit Trail, create success, KPI, ledger, GST, Recent Activity — not only one preview route.

### Change
- `?type=sales_invoice` etc. now resolve (snake_case aliases in `TX_TO_DOC_TYPE`).
- `/document/[id]` prefers route type for commercial + accounting.
- Invoice preview accepts `?type=` (purchase / proforma / quotation).
- Audit Trail passes type on synced opens; provisional TDK routes for PUR/PRF/QTN.
- Sales Order success Share uses `shareVoucherPdfSafely` (Spec commercial PDF).
- Recent Activity forwards type hints when present.

### Files
- `documentHelpers.ts`, `document/[id].tsx`, `invoice-preview.tsx`
- `audit-trail.tsx`, `create-invoice.tsx`, `create-order.tsx`, `purchase/create-invoice.tsx`
- `RecentActivity.tsx`, `voucherPdf.ts`, `voucherDocumentAdapter.ts`

---

## 2026-09-04 — Commercial docs: polished preview + Spec PDF engine

### Why
Commercial documents (Tax Invoice, Proforma, Purchase Invoice, PO/SO, CN/DN, Delivery Note, Quotation) needed the same split as accounting vouchers: on-screen print-sheet from product screenshots, PDF from Spec v1 3-template engine, Share button matching vouchers.

### Change
- New `commercial-print/` module: print model, adapter, validator, Classic / Ledger / Executive HTML templates.
- `CommercialDocumentPreview` — cream print-sheet + compact **Share as PDF** (same chrome as vouchers).
- `DocumentPreviewPage` early-routes commercial types → that preview.
- `generateDocumentHTML` routes commercial → `renderCommercialDocumentHtml` (Settings format maps to commercial template IDs).
- Audit Trail / registers / create previews already hit `/document/[id]` or `DocumentPreviewPage` — inherit the path.

### Files
- `frontend/src/utils/commercial-print/**`
- `frontend/src/components/document/CommercialDocumentPreview.tsx`
- `frontend/src/components/document/DocumentPreviewPage.tsx`
- `frontend/src/utils/documentHelpers.ts`

---

## 2026-09-04 — Fix blank party on Journal / Sales Order / Proforma tiles

### Why
Those vouchers often have NULL `party_name`; the ledger lives in `voucher_ledger_entries` (sometimes as a JSON multi-party array).

### Change
- List APIs resolve `party_name` from primary ledger (+ flatten `["A","B"]` → `A, B`).
- Ingest fills party from ledger when Tally omits PartyName.
- Tile + sales/purchase mappers harden display.

---

## 2026-09-04 — Registers include money vouchers + amount column wrap fix

### Why
Receipt/Journal/Payment/Contra only appeared in Ledger. Large INR amounts wrapped the trailing digit in Debit/Credit cells.

### Change
- Sales register (+ API): Receipt, Journal
- Purchase register (+ API): Payment, Contra
- Expense rows open the real voucher type (Payment/Journal/Contra/Expense)
- Preview amount columns wider + single-line `adjustsFontSizeToFit`

### Files
- `td-backend/src/routes/api-v1.js`
- `voucherHomeFilters.tsx`, `AccountingVoucherPreview.tsx`
- `expenses/index.tsx`, `expenses/register.tsx`

---

### Why
Payment / Receipt / Contra / Journal / Expense must open the polished print-sheet and Share as PDF must use the format selected in Settings, from every entry point.

### Change
- `/document/[id]` honors `?type=` (incl. short aliases) and maps Expense; builds ledger rows from `ledger_entries`.
- New `/voucher/expense-preview`; create-expense opens it after submit.
- KPI / expenses lists use `*_voucher` type params.
- `AccountingVoucherPreview` Share uses `shareVoucherPdfSafely` (Settings format).
- `DocumentPreviewPage` early-routes all five accounting types to that preview.

### Files
- `app/document/[id].tsx`, `app/voucher/expense-preview.tsx`, `create-expense.tsx`
- `app/kpi/payments.tsx`, `receipts.tsx`, `expenses/*`, `reports/audit-trail.tsx`
- `AccountingVoucherPreview.tsx`, `DocumentPreviewPage.tsx`
- `voucherDocumentAdapter.ts`, `documentHelpers.ts`

### QA
Open Payment/Receipt/Contra/Journal/Expense from create success, list, KPI, ledger, My Entries → same sheet. Share PDF matches Settings template for that type.

---

### Why
On-screen preview must match the dense `4--sep-2026` print-sheet (title ribbon, letterhead, ruled table). Share PDF stays Tally Classic from Spec / real Tally PDFs (preview ≠ PDF layout OK).

### Change
- `AccountingVoucherPreview` rewritten as native RN print-sheet (no Classic WebView).
- Receipt/Payment/Expense: collapse bill allocations under party; Through/Cash ordering matches sheet mock.
- **Share as PDF** still uses `renderAccountingVoucherHtml` (Settings template, default `tally_classic_v1`).
- Expense maps into `paymentDetails` for Through line.

### Files
- `frontend/src/components/document/AccountingVoucherPreview.tsx`
- `frontend/src/utils/voucherDocumentAdapter.ts`

### QA
Open Receipt/Payment/Journal/Contra/Expense → cream sheet with ribbon + GSTIN/PAN/phone; dense Particulars/Dr/Cr. Share as PDF → Classic Account/Through amount layout.

---

## 2026-09-04 — Accounting voucher 3-template print engine (Spec v2)

### Why
Preview/PDF for Payment, Receipt, Journal, Contra, Expense must match Tally print truth with no field loss, and Settings needs three locked templates.

### Change
- Canonical `VoucherPrintModel` + adapter + validator under `src/utils/voucher-print/`.
- Three HTML templates: `tally_classic_v1` (default), `td_ledger_v1`, `td_executive_v1`.
- Legacy Settings formats `tally`/`modern_a`/`modern_b` map to the new IDs.
- Accounting voucher PDF engine + Settings wiring; preview chrome later rewritten as print-sheet (see entry above).
- Invoice/stock previews unchanged for now.
- `expense_voucher` document type added.

### Files
- `frontend/src/utils/voucher-print/**` (new)
- `frontend/src/components/document/AccountingVoucherPreview.tsx` (new)
- `frontend/src/components/document/DocumentPreviewPage.tsx`
- `frontend/src/utils/documentHelpers.ts`, `voucherPdf.ts`, `voucherDocumentAdapter.ts`, `types/document.ts`
- `frontend/app/settings/voucher-config.tsx`

### QA
Open Payment/Receipt/Journal/Contra/Expense preview → sheet looks Tally-classic → Share as PDF opens system share. Settings → Voucher Config shows three named templates; Classic is default.

---

## 2026-09-03 — Expense voucher in Quick Actions (Web Portal parity)

### Why
Web Portal 4.0 Create → Voucher → Expense records a simplified payment against expense ledgers. Mobile data-entry modal lacked this.

### Change
- New `/voucher/create-expense` screen: expense ledger + paid-from (cash/bank) + amount/date/narration → `POST /voucher/payment`.
- Expense ledgers: all ledgers whose parent contains “Expense”, plus Direct/Indirect Expenses from `/parties?type=expense`.
- Quick Actions Voucher section + Vouchers hub create sheet include **Expense Voucher**.

### Files
- `frontend/app/voucher/create-expense.tsx` (new)
- `frontend/src/components/QuickActionsModal.tsx`
- `frontend/app/voucher/index.tsx`
- `frontend/src/i18n/locales/en.json`, `hi.json`

### QA
FAB → Voucher → Expense Voucher → pick expense ledger + cash/bank → submit. Preview opens payment preview.

---

## 2026-09-01 — 0% KPI trend is grey + black

### Why
Loans & ODs (and any flat KPI) showed 0% in green because `trend_positive` is true for `>= 0`.

### Change
- Home KPI strip, module tiles, and Loans / Payments / Receipts / Bank KPI carousels: **0%** uses grey `activeBg` and black `textPrimary`, no arrow.
- Non-zero % stays green/red.

### Files
- `frontend/app/(tabs)/index.tsx`
- `frontend/src/components/ModuleTiles.tsx`
- `frontend/app/kpi/loans-ods.tsx`
- `frontend/app/kpi/payments.tsx`
- `frontend/app/kpi/receipts.tsx`
- `frontend/app/kpi/bank-balance.tsx`

### QA
Reload home; Loans 0% should be grey/black. Not pushed.

---

## 2026-08-29 — Expense Type All/Direct/Indirect actually filters

### Root cause
1. **Register Type was multi-checkbox**: tapping Indirect after Direct selected *both* → treated as All → list unchanged.
2. **Expenses home** used `expenseGroup.includes('direct')` which matches **"Indirect Expenses"**.

### Fix
- Expense Register Type tab → **radio** All / Direct / Indirect (Category stays multi).
- Register sends `types` + legacy `type`; row shows Direct/Indirect pill from `expense_type`.
- Expenses home passes `types`/`type` to API; removed includes('direct') client filter.

### Files
- `src/components/voucherHomeFilters.tsx`
- `app/expenses/register.tsx`, `app/expenses/index.tsx`

### How to test
1. Reload app → Expenses → Register → Filter → Direct → Apply → list empty on Yash Ki Company (counts Direct=0) or only Direct rows on Y.K Industries.
2. Same sheet → Indirect → only Indirect rows; chips show one type.
3. Expenses home dropdown Direct/Indirect must diverge the same way.

---
## 2026-08-29 — Voucher type badges + expense filter fix

### Product
1. **Voucher type badges** on Sales/Purchase home Recent + Register rows (Sales Invoice, Order, CN, DN, Proforma, Quotation / Purchase Invoice, Order, Debit Note). Visual language matches My Entries / audit-trail compact pills + DOC_TYPE colors.
2. **Expense Register filter**: backend walks Direct/Indirect group tree so Category/Type counts and multi-select work with nested expense groups; client uses `expense_type` for Direct/Indirect.

### Files
- `src/components/voucherHomeFilters.tsx` — `VoucherTypeBadge`, `resolveVoucherTypeBadge`, `classifyVoucherDocType`; expense sheet `heightFraction`
- `app/sales|purchase/index.tsx`, `app/sales|purchase/register.tsx` — badge on each row
- `app/expenses/register.tsx` — map `expense_type`

### How to test
1. Sales Register (All types) → each row shows type badge + status
2. Sales home Recent → Invoice badge (invoices-only feed)
3. Purchase Register / home → Purchase Invoice / Order / Debit Note badges
4. Expense Register → Filter → Category tab lists sub-groups with counts; Direct-only Apply narrows list; chips/badge/toast OK

---
## 2026-08-29 — Register filters: multi-select Type + Groups

### Product
- **Type = multi-select** (checkboxes) on Sales / Purchase / Expense Register — e.g. Credit Note + Order
- **Sales/Purchase Group tab**: party ledger parents from counts API (`ledgers.parent` via party_guid/name)
- **Expense**: Type multi among Direct/Indirect (All clears); Category multi-select from API parents
- Clear All / Apply / toast / badge / chips unchanged pattern

### Files
- `src/components/FilterBottomSheet.tsx` — `FilterCheckRow`
- `src/components/voucherHomeFilters.tsx` — DocTypeFilterModal + ExpenseRegisterFilterModal multi
- `app/sales|purchase|expenses/register.tsx` — state + API params
- `API_USAGE.md`

### How to test
1. Sales Register → filter → Type: tick Credit Note + Order → Apply → chips + filtered list
2. Group tab → pick a party group → Apply → list narrowed
3. Expense Register → Direct+Indirect or Category multi → Apply

---
## 2026-08-29 — Relocate voucher filters to Register (Ledger radio pattern)

### Product
- **Removed** multi doc-type filter icon/chips from Sales / Purchase / Expense **homes**; homes back to invoices-focused Recent (Paid/Unpaid kept on Sales home)
- **Added** Ledger-style `FilterBottomSheet` + **radio rows with counts** on Register only:
  - Sales Register: All / Invoice / Order / Credit Note / Delivery Note / Proforma / Quotation
  - Purchase Register: All / Invoice / Order / Debit Note
  - Expense Register: Tab Type (All/Direct/Indirect) + Tab Category (API categories); fixed Direct vs Indirect client mapping
- Toast + funnel badge + removable chips after Apply (Ledger pattern)
- List wired via `getSalesVouchers` / `getPurchaseVouchers` / `getExpenses` + new counts endpoints

### Files
- `app/sales|purchase|expenses/index.tsx` — restore pre-home-filter Recent
- `app/sales|purchase|expenses/register.tsx` — filter sheet + API filter
- `src/components/voucherHomeFilters.tsx` — DocTypeFilterModal + ExpenseRegisterFilterModal
- `src/components/FilterBottomSheet.tsx` — optional `count` on FilterRadioRow
- `src/services/api.ts`, `API_USAGE.md`

### How to test
1. Sales home — no funnel next to E-Way Bill; Recent = invoices; Paid/Unpaid still works
2. Sales → Register → filter icon → radio list with counts → pick Credit Note → Apply → toast + chip + filtered list
3. Purchase / Expense Register same pattern; Expense Type Direct must not include Indirect

---
## 2026-08-27 — Bottom modal sheets fix (stock + ledger family)

### Product
- Total Stock `+` opens `AddItemModal` **directly** (removed one-item `menuOpen` popover)
- Kept Add New Item as in-sheet bottom modal (not full-screen create-item)

### Shared
- New `BottomModalShell`: flex:1 + `justifyContent:'flex-end'` root, absolute overlay, KAV `width:'100%'`, sticky footer + safe-area, ScrollView `flexShrink` body
- `InlineDropdownField`: menus are **in-flow** (no `position:'absolute'`) so Modal ScrollView grows and options are tappable
- Labels: strip trailing `*` when `required` is set (fixes double asterisk); Group marked required

### Sheets updated
- `AddItemModal`, `EditStockModal`, `StockAdjustmentModal`, `StockTransferModal`, `BulkTransferModal` → `BottomModalShell`
- `FilterBottomSheet` → flex:1 root + flex-end (was absolute overlay/sheet siblings)
- `AddPartyModal`, `DatePickerModal` → Pattern A fixed (overlay+sheet under flex root)

### How to test
1. Total Stock → tap `+` → Add New Item sheet opens immediately
2. Open Group / Unit / Tax / Warehouse dropdowns → options visible + tappable; Save stays above home indicator
3. Filter sheet on Total Stock / Ledger; Edit / Adjust / Transfer sheets; voucher date picker; Add Party if used

---
## 2026-08-27 — Comprehensive error handling (Phases 1–4)

### Locked policy
1. Home partial success via `allSettled` — never fail whole Home if one section fails
2. Soft refresh fail → keep stale + banner with as-of time; **no toast** for load failures
3. First load all-primary fail → full-page `ErrorState` + Retry
4. Loads → banner/section/ErrorState; mutations → toast/snackbar
5. Visible Retry mandatory on banners/ErrorStates; PTR remains additional
6. Device “No internet” bar ≠ Desktop/Tally offline chip (`isDesktopOnline`)
7. Central 401 → AuthContext signOut; **403 never logs out**
8. Recent Activity local unavailable only — does not alone trigger page partial banner

### Phase 1 — API foundation
- `src/services/apiErrors.ts`: typed `ApiError` (status/code/kind), auth handler, device-online pub/sub
- `src/services/api.ts`: 25s timeout + AbortController, safe JSON parse, status/code on errors, 401 → `notifyAuthFailure`, never 403 logout
- `AuthContext`: registers `setAuthFailureHandler(signOut)`
- `src/hooks/useDeviceOnline.ts`: device network status (distinct from desktop)

### Phase 2 — Home
- `app/(tabs)/index.tsx`: `Promise.allSettled` for KPI/metrics/cashflow/activity; section cashflow error; activity local unavailable; page partial banner; first-load ErrorState; soft-refresh stale banner; OfflineBadge device + desktop

### Phase 3 — Soft-refresh + retries
- KPI screens: soft `hasDataRef` — no wipe on error; ErrorBanner + Retry
- Sales/Purchase home: `allSettled` partial success
- Reports: GST/Audit partial failure surfaced (not swallowed)
- Fixed dead Retries: sales/purchase register, ewaybill, cash-register ErrorBanner

### Phase 4 — i18n
- en + hi keys for partial/refresh/offline/activity/cashflow strings

### How to test
1. Kill one Home API (e.g. cashflow) → other sections show; cashflow SectionError + Retry; page partial banner
2. Airplane mode → device “No internet” bar; desktop offline when Tally offline (distinct copy)
3. Soft refresh fail (PTR with backend down) → stale data + “Couldn't refresh. Showing data from …”
4. First load fail all primary → full ErrorState (not zeroed dashboard)
5. 401 → session cleared centrally; 403 (pairing) must not log out

---

## 2026-08-27 — UX soft-refresh + shimmer policy (Phases 1–4)

### Locked policy
1. First load / company switch → full-page shimmer OK
2. Period change → update numbers in place (no section wipe)
3. PTR → native RefreshControl only (no full-page shimmer)
4. Spinners only on Save/Submit, OTP/auth busy, PDF generating
5. Home ↔ Cashflow period stay linked via `CASHFLOW_PERIOD_KEY`

### Phase 1 — Home
- `app/(tabs)/index.tsx`: `setIsLoading(true)` only when no dashboard data yet; period/PTR/lastSyncAt soft-refresh with request-generation guard; skip `getRecentActivity` on period-only change; lastSyncAt debounced ~400ms soft refresh

### Phase 2 — Tab PTR + soft load
- `stocks.tsx` / `reports.tsx`: RefreshControl soft PTR; lastSyncAt soft when data exists
- `ledger.tsx`: PTR stays soft; debounced search (350ms) avoids hard skeleton wipe; pagination footer uses row shimmer

### Phase 3 — Fetch hygiene
- `reports.tsx` / `reports/financial.tsx`: removed duplicate useEffect + useFocusEffect double fetch; single load path + in-flight guard

### Phase 4 — Spinner → shimmer
- Financial report first paint uses CardSkeleton; Ledger load-more uses LedgerRowSkeleton
- `sales/index.tsx`: soft lastSyncAt refresh (keep shimmer for first paint only)
- Save/OTP/PDF spinners untouched

### How to test
1. Expo reload → Home first paint shows shimmer; after data, 7D↔1M updates KPIs/tiles/cashflow **in place** (no flick)
2. PTR on Home / Ledger / Stocks / Reports → native spinner only, content stays
3. Company switch → shimmer OK; Ledger search typing → list not wiped each keystroke

---

## 2026-08-27 — AR/AP aging carousel: Due Today + always show trend pills

### Changed
- `receivables.tsx` / `payables.tsx`: carousel includes **Due Today** from `due_today`; every card always shows a trend pill (`±%` or **"—"** when null/prior=0), matching Home KPI strip.

### How to test
1. Expo reload → Receivables / Payables → swipe Total Due, Due Today, aging buckets — each has a pill.
2. Home → Receivables / Payables cards should show live `%` when backend returns `trend_pct`.

---

## 2026-08-26 — Fix Ledger "No token provided" on mount

### Root cause
- Ledger tab called `getLedgers` on mount without waiting for AuthContext hydrate / `companyGuid` (Home/Stocks already gated).
- Unauthenticated requests hit backend `authMiddleware` → `No token provided`, surfaced via ErrorBanner.
- API `getToken` on web only read AsyncStorage while AuthContext also uses `localStorage` — possible Bearer miss on web.

### Fixed
- `app/(tabs)/ledger.tsx`: wait for `!authLoading && isAuthenticated && companyGuid` before fetch; no ErrorBanner for auth-missing races.
- `src/services/api.ts`: align token read with AuthContext (web localStorage first); throw `Not authenticated` client-side when auth required and no token (do not send bare request).

### How to test
1. Cold start logged-in app → open Ledger tab → list loads, no "No token provided".
2. Switch language in Settings → return to Ledger → still loads, no error spam.
3. Log out → should not show Ledger auth error banner (redirect to auth).

## 2026-08-26 — Full-app language coverage (i18n Phases 1–4)

### Added
- Expanded `en.json` namespaces: `home`, `quickActions`, `stocks`, `reports`, `expenses`, `kpi`, `onboarding`, `notifications`, plus richer `nav` / `pdf` / `voucher` / `auth` / `dashboard` / `common`.
- Hindi (`hi.json`) real translations for high-traffic chrome (nav, home, quick actions, stocks, reports hubs, KPI, onboarding, PDF action bar).
- Critical `nav.home` / expenses / vouchers / quickActions keys synced into gu/mr/ta/te/kn/pa/bn/ml/or (other new keys fall back to English).
- `src/i18n/labelMap.ts` — maps KPI/metric API ids → `t()` keys (UI chrome only; Tally master data stays as-is).

### Changed
- **Phase 1:** AsyncStorage hydrate in `SettingsContext` calls `i18n.changeLanguage`; CustomTabBar titles via `useTranslation` (`nav.home` etc.).
- **Phase 2:** Home KPI/metric labels, CashflowCard, RecentActivity, ModuleTiles, QuickActionsModal, Stocks/Reports tabs, Sales/Purchase/Expenses hubs, all KPI screens, Notifications filters.
- **Phase 3:** Settings chrome, voucher create titles/alerts, auth validation messages, many stocks/sales/purchase/reports sub-screen headers.
- **Phase 4:** Onboarding slides + Skip/Next/Get Started; DocumentPreviewPage Share/Download PDF action bar via `t()`.

### Product rules (locked)
- 10 languages in picker; missing keys → `fallbackLng: 'en'`.
- Tally party/item/voucher-number/API voucher_type strings shown AS-IS.
- PDF/share chrome localized.

### QA
- `npx tsc --noEmit` clean after import fixes.
- Smoke: locale JSON valid; key samples present in en + hi.

## 2026-08-24 — Unified list SearchBar (Total Stock style + mic)

### Added
- `src/components/SearchBar.tsx` — shared list search (Total Stock look, clear ×, voice mic + modal via `useVoiceSearch`).

### Changed
- 24 list screens now use `SearchBar` (Home, Ledger, registers, vouchers, stock lists, cash register, etc.).
- Mic on all list search bars; data-entry modals (`BottomSheetSearch`, create forms, picker sheets) unchanged (no mic).
- Ledger tab: Position hero (net receivable/payable, top debtor/creditor) from existing `getLedgers` data — ported from `Thursday-Friday-21Aug2026` without branch merge (branch used mocks).

### QA
- GREEN FLAG — mobile-only UI; `tsc` clean. Test on `cursor` branch (`14b5eae9`).

## 2026-08-20 — Phase 7: compliance print layouts, Quotation and Receipt Note decided

### Added
- `src/utils/pdf/complianceSheet.ts`: `renderEInvoiceSheetHTML` (IRN, Ack No/Date,
  signed QR, buyer, invoice value) and `renderEWayBillSheetHTML` (EWB no, validity,
  transporter, vehicle, route, consignment value). Ruled monochrome sheets — neither
  is a Tally voucher type, so there is no native print to copy.
- `src/utils/voucherPdf.ts`: `shareCompliancePdf` / `shareCompliancePdfSafely`.
- Share PDF actions on `reports/einvoice-list.tsx` (rows with an IRN),
  `reports/ewb-list.tsx` and `sales/ewaybill.tsx` (rows with an EWB number).
- Invoice-grid PDFs now print the IRN band (`IRN`, `Ack No.`, `Ack Date`) above the
  item table when the invoice has been reported; omitted entirely otherwise.

### Changed
- `DocumentType` gains `quotation`, display-only. Tally companies do sync Quotation
  vouchers; they used to fall through and print as `TAX INVOICE`. There is still no
  Quotation create screen or write route — Proforma and Sales Order cover pre-sale.
- `app/document/[id].tsx`: `Receipt Note` no longer matches the `receipt` test and
  print as a Receipt Voucher; `Quotation` resolves to the new type.
- `TallyMetadata` gains `ackNo`, `ackDate`, `ewayBillValidTill`; `fromTallyVoucher`
  fills them from the new `e_invoice` / `e_way_bill` blocks on `GET /vouchers/:id`.

### Fixed (found by QA before release)
- `fromTallyVoucher` had `declaration: layout.showDeclaration ? undefined : undefined`, a
  no-op ternary, so Tally-synced invoices printed with no declaration. Now falls back to
  a shared `DEFAULT_DECLARATION`, de-duplicated out of `tallyLayout.ts`.
- `voucherConfigCache` survived sign-out, so a second account inherited the first one's
  PDF format choices. `signOut` clears it.
- Removed the dead `handleWhatsApp` in `DocumentPreviewPage` (and its now-unused
  `Linking` import) — unreachable, and the native share sheet already offers WhatsApp.

---

## 2026-08-06 — Debit Note = Credit Note mirror (Purchase Return)

### Changed
- `purchase/create-debit-note.tsx`: full rewrite from mock form → CN 2-step flow
  (Vendor + Purchase Invoice → return items / GST / submit). Uses
  `getPurchaseInvoices`, `getPurchaseInvoiceDebitNoteContext`,
  `getPurchaseLedgerAccounts`, `createDebitNote` with `linked_invoice` +
  `purchaseLedger`. Success overlay like Credit Note. No invented voucher numbers.
- `src/services/api.ts`: `getPurchaseInvoiceDebitNoteContext`
- `purchase/debit-note.tsx`: list maps `party_name` → `vendor` for search/display

### QA
- Prefer `npx tsc --noEmit` on frontend after pull

---

### Changed
- `purchase/create-order.tsx`: full rewrite to Sales Order 2-step parity (Order Details →
  Items & Review). Live vendors (`getParties` type vendor), purchase ledgers
  (`getPurchaseLedgerAccounts`), stocks/warehouses/tax/charge ledgers, destination
  warehouses (all company warehouses like PI), tax ledger autofill, LogisticsSection,
  RegularOptionalToggle, `useNumberingPolicy`, barcode via `sales/product-scanner`.
  Submit → `createPurchaseOrder` (`POST /voucher/purchase-order`). Success overlay:
  Share PDF (local), Convert to Purchase Invoice, Done. Preview omitted (no PO preview route).
- Convert writes `tdpo_to_invoice_prefill_${companyGuid}` (TTL 30 min on read) then
  `router.replace('/purchase/create-invoice')`. `againstOrderNo` = Tally voucherNumber only.
- `purchase/create-invoice.tsx`: reads that prefill on mount (party→vendor, ledger→
  purchaseLedger, date/items/logEntries/roundOff/narration/refNo); state
  `againstOrderNo` sent on `createPurchaseInvoice`. Skips TDK- prefixed order numbers.
- No sales files touched. No EWB on PO. Add Vendor drawer omitted (SO has no Add Party).

### QA
- `tsc --noEmit`: 0 errors (project-wide).

---

## 2026-08-05 — Purchase Invoice 3-step Sales-parity rewrite

### Changed
- `purchase/create-invoice.tsx`: full rewrite from single-scroll mock screen to a
  3-step flow (`StepIndicator`: Invoice Details → Items → Review & Submit), mirroring
  `sales/create-invoice.tsx` structure/patterns.
- Step 1: Scan e-Invoice QR (best-effort GST e-invoice JSON parse → Vendor Invoice
  No./Date; raw value fallback on parse failure) and Scan/Upload Bill (camera or
  `expo-image-picker` gallery, no OCR — Toast prompts manual entry); live Purchase
  Ledger (`getPurchaseLedgerAccounts`), locked auto Our Ref No., REG-locked/OPT-datepicker
  Date, live Vendor picker (`getParties(guid, { type: 'vendor' })`) with "Add New Vendor"
  (`createTallyParty` with `parent: 'Sundry Creditors'`), Vendor Invoice No./Date,
  Purchase Reference.
- Step 2: live stock items/warehouses/tax ledgers via `BottomSheetSearch` `ItemRow`
  (product, per-item godown, qty/rate/discount, multi tax-ledger entries), barcode scan
  reusing `sales/product-scanner` + `barcodePicker` + `lookupBarcode`, optional
  `LogisticsSection` (feeds `logistics[]` in submit payload), running total.
- Step 3: "Make Payment Now" toggle (bank/cash ledgers via `getBankLedgers`, partial/full
  payment status chip), invoice summary, narration, submit → `createPurchaseInvoice`
  with `voucherType: 'Purchase'`, `isOptional`/`original_entry_type`, `numbering_policy`
  (`useNumberingPolicy`), `make_payment`; success overlay with tdkRef/invoice number,
  Preview (`/sales/invoice-preview?tdkRef=`, generic route) and Share PDF
  (`invoiceSharePdf` + `generateDocumentHTML`).
- Removed all mock data (`LEDGER_OPTS`, `VENDORS`, `PRODUCTS`, `OCR_MOCK`, hardcoded
  `PINV-00089`) and the old single-step OCR-mock layout.
- `getPurchaseLedgerAccounts` already existed in `services/api.ts` (`GET
  /purchase/ledger-accounts`) — no API changes needed.
- FAB route `/purchase/create-invoice` unchanged.

### QA
- TypeScript: `tsc --noEmit` — 0 errors project-wide after the rewrite.

---

## 2026-08-03 — Stop double-submit and Audit Trail re-push duplicates

### Changed
- `create-invoice.tsx`, `create-credit-note.tsx`, `create-delivery-note.tsx`: immediate
  `useRef` submit lock so a second tap cannot fire while one request is in flight; lock
  stays held after success while the result overlay is shown.
- `reports/audit-trail.tsx`: Retry only for queued (`pending`) or `failed` entries;
  ignore synced/processing; per-entry in-flight lock + spinner; bulk push skips
  non-retryable rows. Prevents re-forwarding the same XML into Tally.

### QA
- TypeScript: pass on touched files
- ESLint: 0 errors on touched files (pre-existing warnings only)

---

## 2026-07-30 — Credit Note amount input and semantic colors

### Changed
- `create-credit-note.tsx`: Return Amount is now a required editable field per selected
  item. It auto-calculates from return quantity × original invoice rate until manually
  edited; subtotal, tax, total and submit payload all use the entered amount.
- Replaced Credit Note's red badge, amount and primary-action styling with the universal
  neutral brand palette. Red remains reserved for validation/errors.

### QA
- TypeScript: pass (`tsc --noEmit`)
- Targeted ESLint: 0 errors, 1 pre-existing hook dependency warning

---

## 2026-07-29 — Credit Note 2-step Sales Return rewrite

### Changed
- `create-credit-note.tsx`: replaced all mock parties, invoices, inventory, warehouses, barcode mappings, and fake CN number with a production two-step flow
- Step 1 loads live parties, then every Sales invoice for that party in the selected FY; linked invoice is required and loads `/sales/invoices/:id/credit-note-context`
- Step 2 contains only original invoice lines, initially unselected, with sold / previously returned / remaining quantities; return qty is capped to backend cumulative remaining quantity
- Original unit/rate stay locked; original Sales ledger and godown are prefilled but editable from live masters; tax rows are prefilled from return context and remain editable
- Submit uses the camelCase credit-note contract with selected items/taxes, `linked_invoice`, `isOptional`, `original_entry_type`, and Settings-only `numbering_policy`
- Success overlay reports queued/posted state, real Tally number or `Pending from TallyPrime`, TDK reference, and real Preview/Share actions
- `voucher/preview.tsx`: removed credit/debit note demo item and credit-note number/date fallbacks
- `credit-note.tsx`: removed placeholder filters/stats/share UI; added real FY-scoped loading/error/empty list and synced document opening
- `api.ts`: added `getSalesInvoiceCreditNoteContext`

### Test
1. Sales → Credit Note → select party; verify all FY Sales invoices load, including paid invoices
2. Select invoice; verify context loads and all original items start unchecked
3. Select a line; verify qty cannot exceed Remaining, unit/rate are locked, and ledger/godown/tax are real
4. Enter mandatory narration and submit Regular and Optional returns
5. Verify queued/posted result, Tally number/TDK ref, Preview/Share, then open the synced row from Credit Notes

---

## 2026-07-29 — Delivery Note 3-step + Invoice-style REG/OPT date lock

### Changed
- `create-delivery-note.tsx`: rewritten as **3 steps**
  1. **Details** — Sales Ledger, locked DN No, Party, Linked Sales Order; REG/OPT like Sales Invoice
  2. **Order & Dispatch** — screenshot fields (Order No read-only from Step 1; Mode/Terms of Payment; Other References; Terms of Delivery; Dispatch Doc No; Dispatched through; Destination; Carrier; LR/Bill of Lading + date; Motor Vehicle No)
  3. **Items & Logistics** — items/taxes/logistics/narration/submit
- **Regular:** date snaps to today and stays locked; **Optional:** date unlocked within selected FY (`fyStart`–`fyEnd`)
- Linked SO select → prefill Step 3 via `getOrderPreview` (TDK snapshot) or `getVoucherById` (synced inventory); qty editable for partial delivery; godown/tax remain editable
- Submit sends `original_entry_type` + expanded `dispatch_details` matching backend Order/Dispatch tags
- Dropped Transporter ID / Vehicle Type from main DN UI (not on screenshot); internal `trackingNumber` still set from linked SO for item `TRACKINGNUMBER`

### Test
1. Reload Expo → FAB Delivery Note → confirm 3-step indicator
2. REG date locked; flip OPT → pick past/future in FY; flip REG → today again
3. Party Airen International → link SO #1 → items appear in Step 3
4. Fill Order/Dispatch → submit with desktop paired → verify fields in Tally

---

## 2026-07-29 — Delivery Note 2-step rewrite on live masters

### Added / Changed
- `create-delivery-note.tsx`: full rewrite as a 2-step flow (Details → Items & Dispatch),
  replacing the mock stub (hard-coded parties/invoices/products/dispatch methods and a
  fake `DN-00235` number)
- Step 1: `getSalesLedgerAccounts`, `getParties`, date, and an optional linked Sales
  Order via `getSalesOrders({ partyName })` fetched only after a party is selected;
  party change clears it; selected-FY `from`/`to` scopes the list
- Step 2: `getStocks` picker + per-item `getStockGodowns`/`getWarehouses`, per-item sales
  ledger, per-item taxes (`getTaxLedgers`), `LogisticsSection` (`getChargeLedgers`),
  dispatch fields and narration
- Numbering via `useNumberingPolicy` (no on-screen override, no invented number);
  Regular/Optional submitted as `isOptional`
- Payload aligned to `POST /tally/voucher/delivery-note`: `companyGuid`, `companyName`,
  `partyLedger`, ISO `date`, `totalAmount`, `items[{itemName, actualQty, billedQty, unit,
  rate, amount, salesLedger, godown, trackingNumber}]`, `taxes`, `logistics`, `narration`,
  `isOptional`, `numbering_policy`, `dispatch_details`, `linked_order`
- Success overlay shows the Tally voucher number when returned, else "Pending from
  TallyPrime"; Preview only rendered when a TDK reference comes back
- Delivery Note preview now uses submitted customer/items/dispatch/order data and
  removes all hardcoded demo fallbacks
- Item unit is read-only from the live stock master; unitless items send a bare rate

### API
No new endpoint. `/sales/orders` now supports exact `partyName` filtering.

### Test
See device checklist in `CHANGELOG_AGENT.md` at the mobile repo root.

---

## 2026-07-23 — Sales Order 2-step create + convert to invoice

### Added / Changed
- `create-order.tsx`: 2-step flow (Order Details → Items & Review); live parties/stocks/warehouses/ledgers; Due Date; Terms & Conditions; no Add Customer; Regular/Optional; logistics/taxes; success Preview / Share / Convert to Invoice
- `order-preview.tsx`: preview + Convert to Invoice (AsyncStorage prefill)
- `create-invoice.tsx`: reads `tdso_to_invoice_prefill_*`, sends `againstOrderNo`
- Audit Trail: Sales Order type/filter; SOR → order-preview; Convert shortcut
- Quotation removed from FAB / routes (Sales Order kept)
- `getOrderPreview` API alias

### Test
See device checklist in session reply / `.memory/CURRENT_TASKS.md`

---

## 2026-07-16 — PartyForm worldwide country / division + GST India-only

### Changed
- `PartyForm`: countries/states from `/api/geo/*`; field label = Emirate/Province/Division/State
- GST Details section hidden when country ≠ India
- `getGeoCountries` / `getGeoStates` in `api.ts`

### Test
1. Sales → Create Invoice → +Add Customer
2. Country Nepal → label Province → pick Gandaki → GST hidden
3. Country UAE → Emirate → Dubai → GST hidden
4. Country India → State + GST as before

---

## 2026-07-16 — Universal numbering: lock REFERENCE path + Strategy C fallback

Expanded `DECISIONS.md` + `useNumberingPolicy` + ingest comment:
- Primary: REFERENCE match for all vouchers
- Fallbacks (ordered): Sales bill-ref → Batch JOIN → Strategy C unique-only
- Forbidden: narration as primary identity; inventing UI series numbers

---

### Changed
- New `src/hooks/useNumberingPolicy.ts` — Settings-only numbering for all create screens
- Wired hook: Sales Invoice, Receipt, Payment, Journal, Contra
- Contra: Journal-style **Contra No. + Date** row; removed header Auto chip + old info-row date
- Keyboard: Receipt/Payment dismiss on scroll-drag; Contra narration scrolls into view
- Fixed Contra `settings.currency` for CashCountSheet

### Files
- `src/hooks/useNumberingPolicy.ts`
- `app/voucher/create-{contra,receipt,payment,journal}.tsx`
- `app/sales/create-invoice.tsx`

### Test
1. Contra create shows Contra No. | Date like Journal
2. No numbering pills on create screens — Settings only
3. Narration focus scrolls above keyboard; drag dismisses keyboard

---

## 2026-07-13 — Payment Voucher full rewrite (Receipt parity)

### Added
- `app/voucher/create-payment.tsx`: Receipt-parity create (Creditors + Show all, Cr-only bills, FIFO, instruments, Settings numbering, preview).
- `app/voucher/payment-preview.tsx`: share/preview for TDK-PAY.
- Purchase **Make Payment Now** on `app/purchase/create-invoice.tsx` (pairs via backend `make_payment`).

### Changed
- `app/voucher/payment.tsx`: real party/date/amount/voucher no/Posted/method list + create shortcut.
- `src/services/api.ts`: `crOnly` on outstanding bills; `getPaymentPreview`.

### Test
1. Create Payment → Creditors party with Cr bills → FIFO → Submit → Preview Posted.
2. Expense ledger (no Cr bills) → empty allocation → On Account/Advance.
3. Purchase Create → Make Payment Now → submit (when purchase write is live).

---

## 2026-07-13 — Receipt UI: compact Receipt No. + Date like Sales Invoice

### Changed
`app/voucher/create-receipt.tsx`: Date no longer full-width. Side-by-side row matches Sales Invoice — locked **Receipt No. (Auto)** + compact **Date** (locked for Regular, picker for Optional).

---

## 2026-07-13 — Receipt UX polish: Settings numbering, Dr-only bills, clear-on-amount

### Changed
- `app/voucher/create-receipt.tsx`: removed Numbering pills; loads policy from `getComplianceConfig` (Settings only). Outstanding fetch uses `drOnly: true`; sorted by bill_date; clearing amount clears bill allocations. Leftover On Account/Advance unchanged.
- `app/sales/create-invoice.tsx`: clarified Settings-only numbering (already no on-screen override).
- `src/services/api.ts`: `getPartyOutstandingBills(..., { drOnly })`.

### Test
1. Settings → Voucher Config → set policy → open Create Receipt → no numbering pills; submit uses Settings policy.
2. Party with Dr+Cr outstanding → only Dr bills listed, oldest first when dates present.
3. Auto FIFO → clear amount → all bill checks/amounts cleared.

---

## 2026-07-01 (R5) — Dispatch/EWB: address lines + pincode fields in Sales Create Invoice

### Context
User asked to extend Dispatch/E-Way Bill Details in Sales → Create Invoice — currently only State + City were captured. NIC EWB requires Address Line 1/2 + 6-digit pincode for both dispatch-from and ship-to. User approved plan: addr1 required, addr2 optional, prefill company (dispatch) and party (ship-to), only show mandatory when EWB applicable, no theme/font changes.

### Added
`app/sales/create-invoice.tsx`:
- 6 new fields on Dispatch section: `dispatchFromAddress1`, `dispatchFromAddress2`, `dispatchFromPincode`, `shipToAddress1`, `shipToAddress2`, `shipToPincode`
- `companyProfile` state + `getCompanyProfile(company.guid)` fetch on mount
- Party dropdown now exposes `address`, `state_name`, `pincode` in `.data` (from expanded `/parties` API response)
- Prefill effect: when Dispatch section opens AND company profile loaded → split company address on `\n` → fill `dispatchFromAddress1/2/Pincode/State` if still blank
- Prefill effect: when party selected AND Dispatch section open → read party's address/state/pincode → fill `shipToAddress1/2/Pincode/State` if still blank
- User edits are always preserved (only blanks get prefilled)
- Validation extended in `handleSubmit`: when `ewbRequired && showDispatch`, addr1 mandatory both sides + 6-digit pincode enforced via `/^\d{6}$/`
- Pincode inputs are keyboard-locked to numeric + hard-capped at 6 digits (`replace(/[^0-9]/g, '').slice(0, 6)`)
- Draft save/restore extended for all 6 new fields
- `dispatch_details` payload extended with `dispatch_from_address1/2/pincode` + `ship_to_address1/2/pincode`

### UI Rules Enforced
Zero theme changes. Only `ThemedFInput`, `s.fLabel`, `s.row2`, existing `COLORS` constants used. No new StyleSheet colors, no font family changes.

### QA
GREEN — QA agent ran `npx tsc --noEmit --skipLibCheck` (zero errors), verified API contract match with backend, verified prefill guards, verified no theme leaks.

### Commit
`892e8a78` on `main`

---

## 2026-07-01 (R4c) — Audit-Trail: stable-sort merged queue+posted by rawDate DESC

### Context
User reported June entries above July in Audit Trail. Backend fix (R4a: `ORDER BY v.date DESC` first) landed but symptom persisted. Forensic audit: mobile merge logic `[...queueFiltered, ...postedRows]` was prepending ALL pending above ALL posted regardless of date. 28 stale `failed` write_queue rows from May 27—June 24 (old debug data) were floating to the top and pushing current-July posted entries below them.

### Fixed
- `app/reports/audit-trail.tsx` — replaced naive concat with stable-sort by `rawDate DESC`:
  ```ts
  const combined = [...queueFiltered, ...postedRows];
  const allMerged = combined.slice().sort((a, b) => {
    const da = a.rawDate || '';
    const db = b.rawDate || '';
    if (da === db) return 0; // stable — preserves original relative order
    return db.localeCompare(da); // DESC (newest date first)
  });
  ```
- JS/Hermes `Array.sort` is stable — preserves backend's `av.created_at DESC + av.id ASC` order for same-date entries, and keeps queue-first-then-posted ordering within a single date group.
- `rawDate` is `YYYY-MM-DD` string from backend — `localeCompare` DESC works lexicographically.
- Updated the surrounding comment that said "trust backend order" (R3-era) so future me doesn't undo this.

### Files
- `app/reports/audit-trail.tsx` (merge block ~line 416)

### QA
- `npx tsc --noEmit` — zero errors on audit-trail.tsx 🟢 GREEN

### Commits
- `086a465a` — fix(audit-trail): re-sort merged queue+posted by rawDate DESC

### Related
- Backend companions: `008c78a` (R4a ORDER BY), `2dbf825` (R4b shared created_at)
- Data cleanup: 28 stale failed write_queue rows soft-archived (backend DB, no commit)

---

## 2026-06-26 — AddCustomerDrawer PAN + Document Type Fixes

### Fixed
- `pan: pan.trim()` added to `createTallyParty()` payload in `AddCustomerDrawer` `handleSave()` — PAN was captured in form state but never sent to backend
- `DispatchDetails` type: added optional `dispatch_from` and `ship_to` direct fields (fallback for Tally-synced vouchers)
- `PaymentDetails` type: added optional `ledgerName`, `amount`, `reference` fields
- `DocumentPreviewPage.tsx` `DispatchBlock`: added `d.dispatch_from` / `d.ship_to` as fallback in dispatch display

### Files Changed
- `app/sales/create-invoice.tsx` — `handleSave()` in `AddCustomerDrawer` only
- `src/types/document.ts` — type additions
- `src/components/document/DocumentPreviewPage.tsx` — `DispatchBlock` fallback fields

### Commits
- `03abede7` — PAN fix
- `909524d5` — document type + dispatch fallback

---

## 2026-06-09 — Barcode Scan Failure Fix (Mobile)

### Root Causes Found & Fixed

**Bug 1 — CRITICAL: Code 128B check-character crash (`barcode.ts`)**
- `CODE128B_PATTERNS` had 96 entries (indices 0–95) but `checksum % 103` produces 0–102
- For checkVal 96–102 (7 cases), `CODE128B_PATTERNS[checkVal]` was `undefined`
- `bars.push(...undefined)` → `Cannot convert undefined value to object` → crash
- Affected TDK2272 barcodes: seq=3 (cv=100), seq=12 (cv=99), seq=21 (cv=98), seq=30 (cv=97)...
- Fix: Added 7 missing symbol patterns (96–102) per ISO 15417 / Code 128 standard
- All 103 barcode sequences now render successfully (0 crashes)

**Bug 2 — CRITICAL: No quiet zone in print barcode (`barcode.ts` `barcodeSVG`)**
- `barcodeSVG()` (used by `barcodeDataURI` → print HTML) computed `moduleW = width / totalModules`
- No quiet zone margin — bars ran edge-to-edge to SVG boundary
- Code 128 spec requires ≥10 quiet modules each side; without them, scanners can't find start/stop
- Fix: Added `QUIET = 10`; `totalWithQuiet = totalModules + 20`; bars now start at `QUIET * moduleW`

**Bug 3 — CRITICAL: Print barcode too small (`print-settings.tsx`)**
- `barcodeDataURI(item.barcode, 200, 40)` — only 200px wide for ~209 modules = <1px/module
- Completely unscannable on printed labels
- Fix: Changed to `barcodeDataURI(item.barcode, 600, 80)` + CSS `width:100%;height:13mm;display:block`

### Scanner Config — Verified OK
- `CameraView` barcode types include `code128` ✅
- Lookup API does `barcode.trim()` exact match ✅
- DB stores and queries `status='active'` barcodes ✅
- No normalization or case-sensitivity issues found

### Commit: `7ea623dd` → tallydekho-mobile-V4

---

## 2026-06-08 — Barcode Module (Mobile)

### api.ts — New barcode types + functions
- Types: `BarcodeItem`, `BarcodeSettings`, `BarcodeSummary`
- Functions: `getBarcodeList`, `generateBarcode`, `linkBarcode`, `lookupBarcode`, `bulkImportBarcodes`, `getBarcodeTemplate`, `getBarcodeSettings`, `saveBarcodeSettings`

### app/stocks/barcodes.tsx — Full real-data wire-up
**Mock data replaced:** `MOCK_ITEMS` removed; all data from `POST /api/inventory/barcodes`
**Filters:** Period, Group (from API), Status (9 options from API) all call backend with debounce
**Scanner:** scan → `lookupBarcode` API → found: navigate to `/stocks/item-detail?id=xxx`; not found: Link Barcode modal
**Item tap:** linked item → item-detail; unlinked → alert (Generate / Link / Open Details)
**Generate barcode:** calls `generateBarcode` API → shows generated code
**Link Barcode modal:** search loaded items → `linkBarcode` API
**Bulk Import modal:** DocumentPicker CSV upload + paste text → `bulkImportBarcodes` API → summary alert
**Settings modal (gear icon in header):** storage mode radio (App Only / Tally Alias / Part Number / UDF), barcode type radio (CODE128/EAN13/EAN8/QR/Internal), auto-sync toggle → `saveBarcodeSettings` API
**Subtitle:** shows actual barcode if linked, "No barcode linked" (italic) if not
**Loading states:** ActivityIndicator for initial load, footer spinner for pagination

### Commit: `8a5247b5` → tallydekho-mobile-V4

## 2026-07-09 — Receipt Voucher rewrite (multi-bill, instrument, preview)

**`app/voucher/create-receipt.tsx`** — full rewrite (~700 lines):
- Universal Regular/Optional + date-lock (Regular=today, Optional=FY range) mirrored from Sales Invoice.
- Party picker with Sundry Debtors default + "Show all parties" toggle. **No inline "+ Add Customer"** (per rule: only Sales/Purchase Invoice get that).
- Multi-bill allocation UI: checkbox list with per-bill editable amounts, FIFO auto-allocate button, live Allocated/Remaining footer, leftover disposition pill (On Account / Advance).
- Payment method pills → Cash Ledger dropdown for Cash, Bank Ledger for others. Ref field labeled per method (Cheque No / NEFT UTR / RTGS UTR / UPI Ref ID). Instrument date + bank name for Cheque/NEFT/RTGS.
- Numbering: Tally Series / TallyDekho Series pill.
- Submit → success overlay with Preview button routing to `/voucher/receipt-preview?tdkRef=...`.

**`app/voucher/receipt-preview.tsx`** — NEW (~350 lines):
- Fetches via `getReceiptPreview` → backend `/tally/invoice/:tdkRef/preview` (same endpoint as Sales, receipt-branched buildVoucherDocument).
- Shows provisional watermark until Tally assigns real voucher number.
- Live refresh via `voucher:tallySynced` + `invoice_posting_updated` sockets.
- Bottom bar: Share (React Native `Share` API) + Done.

**`src/services/api.ts`:**
- Added `getPartyOutstandingBills(companyGuid, ledger)` and `getReceiptPreview(tdkRef, companyGuid)`.

**QA:** 🟢 GREEN (LITE, 18/18 checks). `tsc --noEmit` = 0 errors.
