
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
