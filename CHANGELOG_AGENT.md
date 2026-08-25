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
