# CHANGELOG_AGENT.md

## 2026-06-06 — Stock Settings CTO Audit + Repair

### Fixed
- **TextInput clearing bug**: all numeric fields used `parseInt(v) || 0` — snapped to 0 on clear. Fixed with `drafts` state (Record<string,string>). `dv(key,val)` shows draft or committed value. `numChange` commits only on valid int. `handleSave` flushes all drafts before POST.
- **Unit for new items**: prepend selected unit to UoM list on load if missing — ensures checkmark shows
- **Batch/Expiry/Negative toggles**: were hardcoded `value={false}` + empty onChange. Now wired to `batch_tracking_app_enabled` etc. Show Tally pending note when ON.
- **Warehouse codes**: were saving correctly but UX was confusing; draft-aware archive months added
- **Fast/slow settings**: backend now reads `fast_moving_top_pct` from company_inventory_settings (was hardcoded 50%)
- **Expiry days before**: draft-aware (key `expiry_days`)
- **Cancel button**: now resets drafts + reloads from API

### Commits
- `630a2650` (mobile) — CTO audit fixes
- `a05e3327` — displayName total-stock (main screen was missing)
- `afcfd5cf` — QA YF-1+YF-2 fixes (reorder-queue mapper + fast-slow tooltip)
- `8ab0717e` — original Stock Settings redesign

---

## 2026-06-06 — Stock Settings Full Redesign

### Redesigned
- `app/stocks/settings.tsx` — full rewrite, production-ready, Tally-aware, API-wired

### Changes
**General section:**
- Product Display Name — radio (auto/name/alias/part_number/description)
- Default Unit for New Items — live from Tally UoMs via API (was hardcoded)
- Purchase Buffer Days — renamed from "Global Reorder Buffer"
- Reorder Calculation Mode — new radio (hybrid/tally_reorder/sales_velocity/default_low_stock)
- Low Stock Threshold Mode — new radio (reorder_level/safety_stock/days_of_cover/custom_percentage)
- Archive Old Stock Activity — renamed from "Auto-archive ledger"

**Warehouses section:**
- Loads real Tally godowns from API (was hardcoded fake data)
- Per-warehouse settings: Code, Cycle Count Frequency (pills), Archive Stock Layers (months)
- Add Warehouse modal REMOVED — creation exists on dedicated screen
- Empty state when no godowns synced

**Items section:**
- Batch Tracking, Expiry Tracking, Allow Negative Stock — Tally Controlled badges (no local toggle)
- Default Low Stock Level — renamed from "Default Reorder Point"
- Inventory Aging Rules — new pill picker (0-30/31-60/61-90/90+ Days)
- Fast/Slow Moving Analysis — new section (analysis period + fast%/slow days/dead days)
- Unit for New Items — from live Tally UoMs

**Alerts section:**
- All 4 alerts: Low Stock, Negative Stock, Expiry, Fast/Slow Moving
- Channel chips: In-App / Email / WA (renamed from `wa` to `whatsapp` to match backend)

**Data binding:**
- Loads from `GET /api/inventory/settings` on mount with loading spinner
- Saves to `POST /api/inventory/settings` with saving spinner
- Cancel = reload from API (discard local changes)
- isDirty guard — Save/Cancel bar only appears on unsaved change

**Bug fixes:**
- All bare Text strings wrapped in `<Text>` — fixes "Text strings must be rendered within a <Text>" RN error
- No bare interpolated strings outside `<Text>` tags

### api.ts additions
- `getInventorySettings(companyGuid)` — GET /api/inventory/settings
- `saveInventorySettings(companyGuid, payload)` — POST /api/inventory/settings

### Commit
- `8ab0717e` → tallydekho-mobile-V4

---

## 2026-06-04 | Fix: fyInfoToParam not from useAuth() — 4 stock screens

**Task:** Negative stock (and reorder/valuation/item-detail) always showed current FY data regardless of FY selected on dashboard.

**Root Cause:** `fyInfoToParam` is a standalone exported function from `AuthContext.tsx`. It is NOT in the context provider value. All 4 screens were doing `const { fyInfoToParam } = useAuth()` which always returns `undefined` → `fyParam` always `undefined` → `fy=` param never sent to API.

**Files Changed:**
- `app/stocks/negative-stock.tsx` — import fyInfoToParam directly
- `app/stocks/reorder-queue.tsx` — same fix
- `app/stocks/valuation-summary.tsx` — same fix
- `app/stocks/item-detail.tsx` — same fix

**Pattern (correct):** `import { useAuth, fyInfoToParam } from '../../src/context/AuthContext'`
**Pattern (wrong, never use):** `const { fyInfoToParam } = useAuth()`

**Tested:** Backend confirmed returning FY-correct data. Mobile now sends fy= param.
**Risks:** None — pure import fix, no logic change.

--- — tallydekho-mobile-V4

Format: Date | Task | Files Changed | Behavior Changed | Tested | Risks

---

## 2026-06-02 | Warehouses List — Ring Filled with Real Qty %
Files changed: app/stocks/warehouses.tsx
Behavior changed:
- Ring now filled as % of total company qty (this warehouse qty / sum of all warehouses qty * 100)
- Label changed from 'util' to 'qty%'
- grandTotalQty computed from all warehouse total_qty values
- Footer shows real: '{N} items · qty {X}'
Tested: Waiting for user confirmation
Risks: Ring % shows relative distribution, not absolute capacity

---

## 2026-06-02 | Warehouses List — Real SKU + Qty Data on Tile
Files changed: app/stocks/warehouses.tsx
Behavior changed:
- Mapped total_qty and skus from getWarehouses() API response
- Ring replaced with bordered circle showing SKU count (no utilization % — capacity data not available)
- Footer now shows: '{N} items · qty {X}' with real backend data
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Create Warehouse — Simplified Form + Fixed Payload + Autocomplete Parent
Files changed: app/stocks/create-warehouse.tsx
Behavior changed:
- Removed RegularOptionalToggle from header
- Removed fields: Code, Phone, Email, Zip, Racks, Narration (not used by Tally)
- Kept: Name (required), Parent (text + autocomplete, default Primary), Address (optional)
- Fixed payload: was sending company_guid/code/phone (wrong), now sends companyGuid/companyName/name/parentGodown/address (correct)
- Parent autocomplete: fetches existing warehouses from getWarehouses(), filters on type, always shows Primary
- createWarehouse() calls POST /tally/master/warehouse via existing write-back pipeline
Tested: Waiting for user confirmation
Risks: isPaired check still enforced (user must be paired)

---

## 2026-06-02 | Warehouse Detail — Activity: All transactions (no 4-limit)
Files changed: app/stocks/warehouse-detail.tsx
Behavior changed: Removed .slice(0,4) — shows all activity with natural ScrollView scroll
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Warehouse Detail — Full Redesign (2 tiles + 4 activity)
Files changed: app/stocks/warehouse-detail.tsx, app/stocks/warehouses.tsx, app/stocks/total-stock.tsx
Behavior changed:
- warehouse-detail.tsx: Complete redesign — 2 big tiles (Total Stock + On Hand Stock) + 4 recent activity rows
- Tiles: load stocks via getStocks(?warehouse=name), compute stats client-side
- Total Stock tile → total-stock screen with ?warehouse= pre-filter
- On Hand tile → total-stock screen with ?warehouse= + ?onhand=true
- Activity: first 4 from warehouse-detail API, with voucher icons + tap handler
- warehouses.tsx: passes name in nav URL for instant header display
- total-stock.tsx: reads warehouse + onhand params, auto-applies filter on mount
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Warehouses List — Show Real SKU + Qty Data
Files changed: app/stocks/warehouses.tsx
Behavior changed:
- Mapped total_qty and skus from API response (was hardcoded to utilization:0)
- Replaced RingChart (always 0%) with SKU count + net qty stats display
- Card footer now shows: 'Tally Godown · X items · qty Y'
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Total Stock Filter — ScrollView Replaced with Plain View
Files changed: app/stocks/total-stock.tsx
Behavior changed:
- Removed horizontal ScrollView for chip row — was causing unpredictable vertical sizing inside flex:1 parent
- Replaced with plain View (flexDirection:row, flexWrap:wrap) — chips wrap naturally, no height ambiguity
- activeFiltersScroll style removed, activeFiltersRow updated with backgroundColor + border
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Total Stock Filter — Blank Space Fix + Double-Filter Fix
Files changed: app/stocks/total-stock.tsx
Behavior changed:
- Bug 1 fixed: horizontal ScrollView now has style.height:44 (activeFiltersScroll) — prevents vertical expansion causing large blank area. border/bg moved to ScrollView style.
- Bug 2 fixed: whMatch = true always — warehouse filtering is done by API refetch (whFilteredStocks), not client-side. item.warehouse is always 'Default' in stocks API response, so client-side filter was always returning 0.
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Total Stock Filter — Chip Fix + Warehouse Data Fix
Files changed: app/stocks/total-stock.tsx
Behavior changed:
- whOptions: filter to skus > 0 only — prevents empty results when warehouse has no stock_transactions
- Chip: removed WH/GRP prefix badge, uses close-circle icon, alignSelf:flex-start ensures chip shrinks to content
- maxWidth: 110 (was 130)
- Root cause of empty filter: getWarehouses LEFT JOINs all warehouses (even empty ones), user was selecting warehouses with 0 transactions
Tested: Waiting for user confirmation
Risks: None

---

## 2026-06-02 | Total Stock Filter — Warehouse Re-Enabled via Backend API
Files changed: app/stocks/total-stock.tsx
Behavior changed:
- getWarehouses() restored — warehouse names from API shown in filter
- onApply with warehouse: re-fetches stocks via GET /api/stocks/items?warehouse=name
- sourceItems = whFilteredStocks (if warehouse active) ?? liveStocks
- Chip remove + Clear All + empty state clear all reset whFilteredStocks
- whFilterLoading shows 'Filtering by warehouse...' during fetch
- Groups still use client-side filter with .trim()
- activeFilterCount = selWh.length + selGrp.length (warehouse re-enabled)
Tested: Needs manual test with multi-godown Tally data
Risks: Only first selected warehouse used (wh[0]) — multi-warehouse select supported later

---

## 2026-06-02 | Total Stock Filter — Warehouse Removed, Groups Fixed, Chip Compact
Files changed: app/stocks/total-stock.tsx
Behavior changed:
- Warehouse filter removed from modal — stocks API has no warehouse_name field (backend TODO)
- Group names trimmed on build + filter to fix Tally whitespace mismatch
- activeFilterCount now counts only selGrp (warehouse/category disabled)
- Chip: maxWidth 130, prefix badge font 8px, flexShrink:0 on prefix
- catOptions built but not shown in modal (future use)
Tested: Manual — open filter, select group, verify list filters, chip tap removes
Risks: Warehouse filter non-functional until backend adds godown data to stocks/items response

---

## 2026-06-02 | Total Stock Filter — Chip UI + Filter Logic + Tap Fix
Files changed: app/stocks/total-stock.tsx
Behavior changed:
- Problem A fixed: whOptions now always derived from stock data (not warehouse API) — ensures selWh.includes(item.warehouse) always matches
- Problem B fixed: Added keyboardShouldPersistTaps="handled" to chip ScrollView — chip tap to remove now works reliably
- Chip UI fixed: maxWidth 160→120, removed manual .slice() truncation, using numberOfLines+ellipsizeMode="tail", prefix badge has flexShrink:0
- Removed unused getWarehouses import
Tested: Manual — test by selecting warehouse/group filter, verify list filters + chip tap removes filter
Risks: None

---

## 2026-06-02 | Blueprint System Created
Files changed: AGENTS.md, BLUEPRINT.md, MOBILE_MAP.md, NAVIGATION_MAP.md, API_USAGE.md, STORAGE_AND_AUTH.md, TASK_ROUTING.md, KNOWN_ISSUES.md, CHANGELOG_AGENT.md, .agentignore
Behavior changed: None (docs only)
Tested: N/A
Risks: None

---

## 2026-05-29 | QA GREEN — All Fixes Verified
Files changed: app/(tabs)/stocks.tsx, src/components/FilterBottomSheet.tsx, app/stocks/total-stock.tsx, app/stocks/create-transfer.tsx
Behavior changed: Stock KPI value computed from real data; Bulk Transfer calls real API; filter Clear All resets selCat; dead code removed
Tested: QA agent — 30/30 PASS
Risks: None

---

## 2026-05-2x | Modal UX Overhaul (All Bottom Sheets)
Files changed: 14 modal component files across stocks + settings
Behavior changed: All bottom sheet modals now animate from bottom, keyboard pushes sheet up correctly, no gap below footer
Tested: Manual device test
Risks: None

---

## 2026-05-02 | TypeScript Fixes + Mock Data Removal
Files changed: 20+ files (TypeScript errors, ErrorBanner imports, mock data)
Behavior changed: Stocks tab no longer crashes; duplicate imports removed; mock data removed from reports
Tested: Expo Go manual
Risks: None

---

## 2026-04-29 | Pairing Banner + Offline Badge
Files changed: src/components/PairingBanner.tsx, src/components/OfflineBadge.tsx
Behavior changed: Shows pairing banner when not paired; offline badge when no network
Tested: Manual
Risks: None

---

_Add new entries at top._

## 2026-06-02 — Real API: Reorder Queue + Stock Alerts Selector
- `app/stocks/reorder-queue.tsx`: removed REORDER_ITEMS mock; now fetches `/api/stocks/items` (limit 500), filters where `closing_qty <= reorder_level > 0`, calculates priority from ratio
- `app/settings/stock-alerts.tsx`: removed MOCK_ITEMS/MOCK_GROUPS; item selector now uses real stock names (`getStocks`) and group names (`getStockGroups`)
- Both screens: UI/UX 100% unchanged
- TypeScript: 0 errors

## 2026-06-03 — Fast/Slow Moving Screen

### New Feature
- **Backend**: New `GET /api/stocks/fast-slow` endpoint
  - Calculates per-item: `total_outward_qty`, `outward_txn_count`, `avg_daily_outward`, `days_remaining`
  - FY-aware (respects `fy=` param via `resolveFYDates`)
  - Classification: items with outward movement sorted by total qty → top 50% = Fast, rest + zero-movement = Slow
  - Returns summary: `total_items`, `active_items`, `inactive_items`, `financial_year`

### Mobile: `app/stocks/fast-slow.tsx` (full rewrite)
- Calls dedicated `/stocks/fast-slow` endpoint (was using generic `/stocks/items`)
- Summary strip: Total SKUs / Fast count / Slow count / No Movement count
- Bar chart: Top fast movers by **outward qty** (was closing qty — wrong)
- Tooltip: Outward Qty + Txn Count + Closing Stock Value
- Cards show: Outward Qty, Txn Count, Closing Stock, Stock Value
- "Days remaining" banner when calculable (closing_qty ÷ avg_daily_outward)
- Pagination: 20 items/page with "Load More (X remaining)" button; resets on tab switch
- Shimmer skeletons during initial load

### Colors (Option A — theme-consistent)
- Both Fast and Slow tabs active → `brandPrimary` (#1A1A1A) + white text (consistent selection indicator)
- Inactive tabs → `textSecondary` text
- Fast avatar → `brandPrimary` bg, white letter
- Slow avatar → `activeBg` bg, `textSecondary` letter
- Fast badge → `activeBg` bg + `textPrimary` text
- Slow badge → `warningBg` bg + `textSecondary` text
- All hardcoded #16A34A / #D97706 / #DCFCE7 replaced with COLORS.* constants

### api.ts
- Added `getStockFastSlow` export pointing to `/stocks/fast-slow`

## 2026-06-04 — Stock Ledger Live Data

### Changes
- `app/stocks/stock-ledger.tsx` — wired to real API
  - Replaced static empty `txnData` with `getStockLedger()` call
  - Added `useAuth` + `fyInfoToParam` (direct import, correct pattern)
  - LoadingState / ErrorState from ApiStateViews
  - Pagination (30/page, Load More button)
  - Summary strip: entries, total in, total out, real value from API
  - Warehouse filter: dynamic from API (no more static empty array)
  - Apply Filters triggers fresh API fetch
  - Helper fns: `ddmmyyToISO`, `isoToDdmmyy`, `deriveType`, `mapEntry`
- `src/services/api.ts` — added `getStockLedger` function

### QA
- TypeScript: 0 errors
- ESLint: 0 errors in changed files

## 2026-06-04 — Stock Ledger 3-mode API wiring (continued)

### Bug Fixes
- `by_item` 0 movements: stCond.slice(1) reuse had wrong param indices — item names being compared to dates. Removed the broken reuse; transactions now load correctly.
- `by_document` SQL crash: v.id in ORDER BY not in GROUP BY → fixed to MIN(v.id)
- Duplicate React key error: all 5 key spots now use composite `${id}-${index}` keys
- By Item "selected" bug: [].every() vacuous truth → added length > 0 guard
- Selected state now cleared on tab switch

### UI Improvements (Chronological tile)
- Title: item name (was tx.sku — often null)
- Subtitle: docRef · date · warehouse
- Left: colored 2-letter type badge (SA/PU/TR) replacing letter avatar
- Qty: uses − sign for outward (was blank)

### By Item tile
- Title: item name only (removed sku from title, moved to subtitle)
- Subtitle: SKU (if available) · N movements

## 2026-06-04

### fix(reorder-queue): use current stock (closing_qty) instead of FY-derived qty
- Removed `fy=` param from `getStocks` call — reorder decisions use Tally's authoritative `closing_qty`
- Physical Stock vouchers inflate FY qty → removing FY param sidesteps the problem entirely
- Removed unused `fyInfoToParam` import, removed `selectedFY` from useEffect deps
- **File:** `app/stocks/reorder-queue.tsx`

### fix(reorder-queue): Medium priority color → COLORS.positive (#2D7D46)
### fix(stock-ledger): load voucher types on mount via useEffect
### fix(stock-ledger): move loadVoucherTypes after apiVoucherTypes declaration (crash fix)


## 2026-06-06

### fix(stocks): movement-analytics screen — two-line chart + sold-out items + icon colors
- `movement-analytics.tsx`: ChartDay type extended (`inward_value`, `inward_qty`). LineChart now draws two lines: gold (sold) + green (purchased). Legend added. Active tap tooltip shows both Sold ₹X and Bought ₹X. Sold-out items show SOLD OUT badge, ∞ TR, 0d DSI. Empty state: "No stock movements found".
- `stocks.tsx`: Low Stock, Aged Inventory, Movement Analytics icon colors unified to `ICON_COLOR`/`ICON_BG` (were hardcoded red/amber/blue).
- Commits: `8a71fc14` (movement-analytics), `5dc9fc8b` (stocks icon fix)
