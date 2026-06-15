
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
