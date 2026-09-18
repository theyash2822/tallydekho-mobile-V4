# KNOWN_ISSUES.md — tallydekho-mobile-V4

## Fixed Issues (for reference)

### Modal UX Fixes (May 2026 — All 5 Stock Modals + 9 Settings Modals)
All fixed: EditStockModal, StockTransferModal, StockAdjustmentModal, AddItemModal, BulkTransferModal
+ profile, payment-reminders, bank-feeds, barcodes (settings + stocks)
Pattern:
- animationType="slide" (was 'none')
- justifyContent:'flex-end' on outer View (sheet pins to bottom)
- KAV wraps only sheet (was wrapping overlay → keyboard issues)
- paddingBottom: Math.max(insets.bottom, 8) on footer
- sheet paddingBottom: 0

### Stock KPI Hardcoded Value (Fixed May 29)
- Total Stock Value was hardcoded ₹83,150
- Fix: computed from real sourceItems.closing_value

### Filter Category Bug (Fixed May 29)
- selCat not reset in Clear All
- Dead code removed from FilterBottomSheet

### Bulk Transfer API (Fixed May 29)
- handleDone was showing fake toast
- Fix: now calls real createStockTransfer API

### Stock Item Detail Mock Data (Fixed May 2026)
- Was showing ITEM_DETAILS and STOCK_ITEMS fallback mock
- Fix: all mock removed, shows loading/empty states

### Ledger Infinite Scroll (Fixed May 2026)
- Load More button replaced with onEndReached infinite scroll

### Financial Report P&L Empty State (Fixed May 2026)
- Was showing fake ₹12L numbers when pl=null
- Fix: shows proper empty state

### TypeScript Errors (Fixed May 2)
- 20+ TypeScript errors fixed
- Duplicate ErrorBanner imports removed from 14+ files

### Stocks Tab Crash (Fixed May 2)
- Missing imports from stockData.ts caused crash
- Fix: imports added

## Active / Open Issues

### Android slower than iOS (mitigated 2026-09-17)
- Was building 4 ABIs + Metro maxWorkers=2. Now arm64-v8a + more Metro workers.
- If Android **runtime** (not build) still feels slow: ensure Remote JS Debugging is OFF, use a release-ish build for profiling, avoid Expo Go vs comparing to a different iOS path.
- Emulator: may need `reactNativeArchitectures=arm64-v8a,x86_64`

### IP Changes on WiFi Reconnect
- EXPO_PUBLIC_BACKEND_URL in .env = 192.168.29.243
- If backend unreachable, check Mac IP with `ifconfig`
- Static DHCP not yet configured — may need manual update

### Mock Data in stockData.ts
- `src/data/stockData.ts` may still be imported in some stock screens
- Audit stock screens for remaining mock usage

### Company Logo Feature
- Not built in mobile app UI
- Backend routes exist, mobile UI not implemented

### i18n Coverage
- Needs verification: which screens have full translation coverage

## Architecture Notes
- Expo Router — adding a file in app/ automatically creates a route
- All screens MUST import ApiStateViews.tsx (LoadingView/ErrorView/EmptyView)
- Never add mock data fallbacks to screens after pairing
- `fyInfoToParam()` must be used for all FY → API params conversions
- ErrorBanner was duplicated across many files — always check for duplicate imports
