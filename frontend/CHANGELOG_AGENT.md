# CHANGELOG_AGENT.md — tallydekho-mobile-V4 (Mobile)

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
