# Forensic Investigation: Mobile Camera / Barcode Scanner Black Preview

**Date:** 2026-09-25  
**Product:** TallyDekho Mobile (`tallydekho-mobile-V4/frontend`)  
**Audience:** CTO / engineering decision  
**Status:** Open — permission works; live camera preview fails on tested Android (Expo Go)  
**Author:** Agent investigation (session with Yash)

---

## 1. Executive summary

Users open barcode / QR scanners and see:

- OS **camera permission dialog** (Android confirmed — permission granted to Expo Go)
- Scanner **chrome** renders (white corner brackets, torch, Cancel) on Stocks
- Camera **preview is black / blank** (no live frames)
- Same blank preview on **Sales product scanner** on the same Android phone

**Conclusion for decision-makers:**

| Layer | Status |
|-------|--------|
| Stocks Jun 11 **UI design** | Correct (chrome visible) |
| Stocks **navigation** to full-screen route | Correct (permission asked) |
| Android **OS permission** | Granted |
| Native **`CameraView` preview** | **Failing across multiple entry points** on tested Android + Expo Go |

This is **no longer explainable as a Stocks-only layout bug**. It is a **shared camera stack / runtime** problem affecting all product barcode scans that use `expo-camera` `CameraView`. Purchase Invoice also has a **second** scanner (e-Invoice QR in a Modal) with additional known Modal risks.

**Recommended CTO decision fork:**

1. **Stay on Expo Go** → align `expo-camera` / Expo SDK, retest; if still black → treat as Expo Go / OEM limitation.  
2. **Ship a development / production build** (`npx expo run:android` / EAS) → verify camera on same device; this is the strongest validation of whether the bug is Expo Go–specific.  
3. **Do not** keep iterating Stocks Modal ↔ route as the primary fix while Sales `product-scanner` is also black on the same device.

---

## 2. Problem statement (user-visible)

### 2.1 Stocks → Barcodes → Scan

- **Expected:** Live back-camera preview + Jun 11 strip scan frame (130px), torch, zoom, spatial “in-frame” filter, result panel.  
- **Actual (Android, 2026-09-25):** Permission asked and granted; Jun 11 chrome visible; **preview black**.  
- **Earlier (iOS):** Green privacy indicator + black preview + frame stuck at top when scanner lived inside RN `Modal`.

### 2.2 Sales / Purchase Order / Purchase Invoice → product barcode scan

- Uses shared screen: `/sales/product-scanner`.  
- **Actual (same Android phone):** **Also no live preview** (user confirmed).  
- This is the critical control test: UI differences between Stocks and Sales are **not** the root cause on Android.

### 2.3 Purchase Invoice → e-Invoice QR scan

- Separate implementation: `CameraView` inside a React Native **`Modal`** on `create-invoice.tsx`.  
- Historically associated with black preview on iOS (session starts, frames do not paint).  
- Product line-item barcode on purchase flows uses `product-scanner` (same as sales), not this Modal.

### 2.4 Unrelated noise in Metro logs

```
VirtualizedList: You have a large list that is slow to update...
[Push] Expo Go detected — push notifications require a dev build. Skipping.
[Socket] connect retry / transport close
```

- VirtualizedList: list performance warning — **not** camera.  
- Push skip: expected in Expo Go.  
- Socket flaps: backend reachability / process restarts — **orthogonal** to camera preview (backend was healthy during later tests).

---

## 3. Environment

| Item | Value |
|------|--------|
| App | Expo Router app `auditor` / TallyDekho mobile |
| Runtime under test | **Expo Go** (confirmed by push log) |
| Expo SDK (installed) | `expo@57.0.22` (package.json range `^57.0.17`) |
| `expo-camera` (installed) | `57.0.5` (`~57.0.5`) |
| CLI note | Expo reported available update `57.0.22 → ~57.0.25` |
| Backend (dev) | `http://192.168.29.243:3001` via `EXPO_PUBLIC_BACKEND_URL` |
| Android Camera permission | Granted to Expo Go (user verified in system settings) |
| Device | Physical Android (user); iOS also observed earlier with Modal black preview |

`app.json` includes:

- Plugin: `expo-camera` with `cameraPermission` string  
- Android permissions: `CAMERA`, `RECORD_AUDIO`  
- iOS: `NSCameraUsageDescription`  

**Note:** `app.json` / plugin strings apply fully to **custom native builds**. Expo Go uses Expo Go’s own native binary and permission prompts; JS still calls `useCameraPermissions()` / `requestPermission()`.

---

## 4. Inventory of all camera scanners in the app

| # | User journey | Screen / code | Mount style | Purpose |
|---|--------------|---------------|-------------|---------|
| A | Stocks → Barcodes → Scan | `app/stocks/barcode-scanner.tsx` | **Stack screen** (full-screen route) | Product barcode link / lookup (Jun 11 UI) |
| B | Sales Invoice / Order → barcode | `app/sales/product-scanner.tsx` | **Stack screen** | Add product by barcode |
| C | Purchase Order → barcode | `app/purchase/create-order.tsx` → navigates to **B** | Stack (`/sales/product-scanner`) | Same as sales product scan |
| D | Purchase Invoice → line barcode | `app/purchase/create-invoice.tsx` → navigates to **B** | Stack (`/sales/product-scanner`) | Same as sales product scan |
| E | Purchase Invoice → e-Invoice QR | `app/purchase/create-invoice.tsx` Modal `showCamera` | **RN Modal + CameraView** | Scan vendor e-Invoice QR |

Shared plumbing:

- Hook: `src/hooks/useBarcodeScanner.ts` (lookup + vibrate) — used by A and B  
- Bridge A: `src/utils/stocksBarcodeScan.ts`  
- Bridge B: `src/utils/barcodePicker.ts`  
- API: `lookupBarcode` via backend (preview failure happens **before** successful decode)

---

## 5. Code architecture (current)

### 5.1 Stocks barcode flow (2026-09-25)

**List screen** `app/stocks/barcodes.tsx`:

- `openScanner()` sets `stocksBarcodeScan` callback, then:
  - `safePush(router, '/stocks/barcode-scanner?companyGuid=...')`
- Does **not** host `CameraView` anymore (Modal path removed for this flow).

**Scanner screen** `app/stocks/barcode-scanner.tsx`:

- `useCameraPermissions()` + auto `requestPermission()` when undetermined  
- Permission wall UI if not granted  
- Jun 11 overlay: 130px strip frame, torch, zoom, spatial bounds + dedup fallback, result panels  
- `CameraView` with `facing="back"`, `zoom`, `enableTorch`, `barcodeScannerSettings`, `onBarcodeScanned`  
- Extra vs sales: `cameraActive` + `useFocusEffect` remount delay (intended to avoid stale sessions; **may** hurt Android after permission grant — secondary hypothesis only, because sales is also black without this gate)

### 5.2 Sales / Purchase Order product scanner

**`app/sales/product-scanner.tsx`:**

- Full-screen stack screen  
- Mounts `CameraView` **immediately** when `permission.granted` (no `cameraActive` gate)  
- 240×240 centered frame UI (different chrome from Jun 11, same native camera component)  
- Used by Purchase Order (`create-order.tsx` ~line 1040) and Purchase Invoice product barcode (~line 1372)

### 5.3 Purchase Invoice e-Invoice QR (separate problem class)

**`app/purchase/create-invoice.tsx` ~1655+:**

```text
Modal visible={showCamera}
  └── CameraView (absoluteFill) + overlay (QR frame)
```

Known class of bugs (industry + our iOS observations):

- `CameraView` inside **React Native Modal** → privacy/session indicator can show while **preview stays black**  
- Layout overlays inside Modal can collapse (frame “pushed up”) when using absoluteFill + flex incorrectly  

This path should be treated as **architecture debt** even if product-scanner is fixed: long-term, QR scan should likely move to a stack screen like B.

### 5.4 Historical Jun 11 reference

Commit `ab4df78f` (2026-06-11): spatial bounds filter for Android + iOS on Stocks scanner.

- Design (frame height 130, torch, zoom, out-of-frame) is the **product baseline** for Stocks.  
- That commit still used **Modal + CameraView**. On modern iOS that pattern is fragile; Android blank on **all** stack scanners now points beyond Modal alone.

---

## 6. Timeline of investigation (condensed)

1. **Stocks Modal scanner:** black preview; frame at top; “no permission asked” when already granted.  
2. **Hypothesis:** Modal is root cause → moved Stocks to full-screen route (mirror sales).  
3. **Rollback** requested → Modal returned → same black UI screenshot again.  
4. **Re-implement hybrid:** Jun 11 UI **on** full-screen route (not Modal, not purchase Modal style).  
5. **Android test:** permission dialog appears (route + Expo permission API work); chrome visible; preview still black.  
6. **Control test:** Sales `product-scanner` also **no live preview** on same Android phone.  
7. **Ops:** Dual Metro 8081/8082 caused confusion; sockets flapped when backend died — cleaned up; camera issue persisted with single Expo + granted permission.

---

## 7. Evidence matrix

| Observation | Implication |
|-------------|-------------|
| Android OS permission dialog on Stocks scan | JS reached `requestPermission` / undetermined → granted path |
| Expo Go → Camera = Allow in system settings | Not a missing OS grant |
| Jun 11 chrome visible on Stocks | Overlay/UI route is the new scanner, not a frozen old bundle only |
| Sales product-scanner also blank | Shared `CameraView` / Expo Go / device issue |
| iOS earlier: green privacy + black in Modal | Session can start without painting frames |
| Backend `/health` OK | Not caused by API URL for **preview** |
| Push “Expo Go detected” | Confirming Expo Go runtime |

---

## 8. Root-cause hypotheses (ordered)

### H1 — Expo Go + `expo-camera` / CameraX on this Android OEM (HIGH)

- Permission granted, UI mounts, native preview surface black.  
- Documented historically for `expo-camera` black screens (device / build / CameraX).  
- **Strongest explanation** given Sales + Stocks both fail.

### H2 — Expo Go native binary vs project `expo-camera@57.0.5` mismatch (MEDIUM)

- Project depends on `expo-camera ~57.0.5`; Expo host app may expect a newer aligned set.  
- Mitigate: `npx expo install expo-camera` (and `npx expo install --fix`).  
- Retest Sales scanner first.

### H3 — Need custom native build (MEDIUM–HIGH for production)

- Expo Go embeds its own native modules. Some camera bugs only reproduce (or only **fix**) in Expo Go.  
- CTO-grade validation: **dev client / `expo run:android`** on the same handset.  
- If preview works in dev build but not Expo Go → ship decision = don’t rely on Expo Go for camera QA.

### H4 — Stocks `cameraActive` / `useFocusEffect` remount (LOW on Android given Sales)

- Can cause black preview after permission on some devices.  
- Sales does **not** use this gate and still fails → **not sufficient** as sole Android root cause.  
- Still worth removing when polishing Stocks to match sales mount path.

### H5 — Overlay covering preview (LOW)

- Ruled out for Stocks: user sees white brackets / torch / Cancel; center should be transparent over `CameraView`.  
- If `CameraView` painted, user would see video inside the strip.

### H6 — RN Modal (Purchase QR / old Stocks) (HIGH for those paths; not for sales stack)

- Explains iOS Modal black + frame collapse.  
- Purchase e-Invoice QR still on this architecture.  
- Does **not** explain Sales stack blank on Android.

### H7 — Multiple Metro instances / stale JS (LOW now)

- 8081 vs 8082 caused wrong bundle / reloads.  
- Mitigated by killing ports; user retested with permission + chrome = current route.  
- Keep single `expo start --port 8081`.

### H8 — Backend / socket (VERY LOW for blank preview)

- Socket disconnect does not prevent local camera preview.  
- Lookup API only runs **after** a barcode is decoded.

### H9 — Simulator / emulator camera (N/A if physical Android)

- Emulators often show black; user described physical permission + Expo Go settings.

### H10 — Conflicting camera consumers (LOW)

- Another app holding camera; rare. Check by force-stopping other camera apps / reboot.

---

## 9. What we already ruled out (or partially)

| Claim | Verdict |
|-------|---------|
| “Only Stocks Jun 11 layout is wrong” | **Ruled out** — Sales blank too |
| “Permission not configured / not asked” | **Ruled out** on Android for this session |
| “Backend down causes black camera” | **Ruled out** for preview |
| “Must use purchase Modal pattern to open camera” | **Incorrect** — Modal is worse on iOS; sales stack also blank on Android |
| “Full-screen route was the wrong idea for Stocks” | **Partially wrong** — route is still correct for architecture; it did not fix Android preview alone |

---

## 10. Purchase Order / Purchase Invoice — scenario for CTO

### Purchase Order (`create-order.tsx`)

- Product barcode CTA → `/sales/product-scanner` (**same screen as Sales**).  
- If Sales scanner is black, **Purchase Order scanner is black for the same reason**.  
- No separate camera implementation to “fix” in PO alone.

### Purchase Invoice (`create-invoice.tsx`)

Two camera features:

1. **Line-item product barcode** → `/sales/product-scanner` (same as above).  
2. **e-Invoice QR** → **Modal `CameraView`** (`showCamera`).  

So Purchase Invoice can fail in **two different ways**:

| Feature | Architecture | Risk |
|---------|--------------|------|
| Product barcode | Stack `product-scanner` | Shared Android Expo Go black preview (H1–H3) |
| e-Invoice QR | Modal `CameraView` | Modal black preview (H6) + any shared preview failure |

**CTO takeaway:** Fixing Stocks UI alone will not restore Purchase Order scanning. Fixing the **shared** `product-scanner` / camera runtime restores Sales + PO + PI product barcode. PI QR still needs a separate Modal → stack migration.

---

## 11. Options for CTO decision

### Option A — Package align + retest on Expo Go (cheap, 30–60 min)

```bash
cd tallydekho-mobile-V4/frontend
npx expo install expo-camera
npx expo install --check
# single metro
npx expo start -c --port 8081
```

**Success criteria:** Sales `product-scanner` shows live preview on the same Android phone.

### Option B — Development build on same Android device (recommended validation)

```bash
cd tallydekho-mobile-V4/frontend
npx expo run:android
# or EAS development build
```

**Success criteria:** Live preview in custom binary.  
**If B works and A fails:** stop QA-ing camera on Expo Go; require dev builds for scanner sign-off.

### Option C — Code harden (parallel, low risk)

1. Stocks: mount `CameraView` exactly like sales when granted (drop `cameraActive` remount).  
2. Keep Jun 11 UI overlay.  
3. Purchase Invoice QR: migrate Modal → full-screen route (same pattern as Stocks).  
4. Unify all scanners behind one `CameraScannerShell` component.

**Does not replace A/B** if Expo Go native preview is broken.

### Option D — Alternative scanning stack (last resort)

- Consider `vision-camera` / ML Kit dedicated modules if `expo-camera` remains unreliable on target OEM list after native builds.  
- Higher cost; only after B fails.

---

## 12. Recommended decision path

1. **Authorize Option A** (package align) today.  
2. If still black → **authorize Option B** (dev build) as the truth test.  
3. Parallel **Option C.1–C.2** (Stocks mount parity + keep Jun 11 UI).  
4. Schedule **Option C.3** (Purchase Invoice QR off Modal) as dedicated ticket.  
5. Do **not** treat further Modal rollbacks as the Android fix.

---

## 13. Test plan (for whoever validates)

| # | Test | Pass |
|---|------|------|
| T1 | Android Expo Go → Sales Invoice → product barcode scan | Live preview |
| T2 | Android Expo Go → Purchase Order → product barcode scan | Live preview (same as T1) |
| T3 | Android Expo Go → Stocks → Barcodes → Scan | Live preview + Jun 11 frame centered |
| T4 | Android → Purchase Invoice → e-Invoice QR | Live preview (may fail until Modal migration) |
| T5 | Repeat T1–T3 on **dev build** | Live preview |
| T6 | iOS device T3 | Live preview (full-screen route, not Modal) |
| T7 | Deny camera → Grant wall → Settings path | Correct UX |

---

## 14. Key file references

```
tallydekho-mobile-V4/frontend/
  app/stocks/barcodes.tsx              # navigates to scanner route
  app/stocks/barcode-scanner.tsx       # Jun 11 UI + CameraView (stack)
  app/sales/product-scanner.tsx        # shared product barcode CameraView
  app/purchase/create-order.tsx        # → product-scanner
  app/purchase/create-invoice.tsx      # → product-scanner + Modal QR CameraView
  src/hooks/useBarcodeScanner.ts
  src/utils/stocksBarcodeScan.ts
  src/utils/barcodePicker.ts
  app.json                             # expo-camera plugin + permissions
  package.json                         # expo-camera ~57.0.5
```

Historical: git `ab4df78f` — Jun 11 spatial filter on Stocks (Modal-era).

---

## 15. Bottom line for CTO

**Problem:** Live camera preview is black on the tested Android phone in Expo Go for **all** product barcode scanners (Stocks + Sales + therefore Purchase Order), despite granted camera permission and correct scanner UI chrome.

**Not the core problem anymore:** Jun 11 visual design; Stocks-only routing; backend; VirtualizedList warnings.

**Still a real secondary problem:** Purchase Invoice **e-Invoice QR** uses Modal `CameraView` (fragile on iOS; should move to stack).

**Correct decision axis:** Validate whether `CameraView` works in a **custom native build** vs Expo Go, align `expo-camera`, then harden code (mount parity + migrate PI QR). Until Sales `product-scanner` shows frames, further Stocks UI experiments will not unlock Purchase Order scanning.

---

*End of forensic report.*
