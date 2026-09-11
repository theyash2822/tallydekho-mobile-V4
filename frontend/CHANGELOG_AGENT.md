# CHANGELOG_AGENT.md — tallydekho-mobile-V4 (Mobile)

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
