# CHANGELOG_AGENT.md — tallydekho-mobile-V4 (Mobile)

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
