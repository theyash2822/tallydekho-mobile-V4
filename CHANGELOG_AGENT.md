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
