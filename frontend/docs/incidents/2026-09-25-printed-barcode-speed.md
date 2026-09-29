# Incident — Printed barcode scan speed (iOS + Android)

**Date:** 2026-09-25  
**Branch / HEAD:** `cursor` @ `9d075beb` (+ uncommitted scanner work)  
**Runtime:** Expo SDK **57.0.22**, `expo-camera` **57.0.5**, RN **0.86.3**  
**Surfaces:** `/stocks/barcode-scanner`, `/sales/product-scanner`  
**Labels:** Unchanged (Yash: printing is correct — out of scope)

---

## Verdict

| Finding | Status |
| --- | --- |
| Toggling `onBarcodeScanned` to `undefined` **disables native barcode scanning** and on iOS **removes session outputs** (`BarcodeScanner.stopBarcodeScanning`) | **CONFIRMED** (installed `expo-camera@57.0.5` source) |
| That toggle was used as our “lock” → native pipeline restarted on every accept / re-arm → slow first + second aims | **CONFIRMED** (code path) |
| Auto-zoom (`0 → 0.08`) can disturb focus while aiming printed labels | **LIKELY** |
| Arbitrary iOS ~450ms listener delay added blind interval after warm mount | **LIKELY** (harmful once listener is stable) |
| Same unknown code re-looked up after 1.6s unlock | **CONFIRMED** (prior `SCAN_RETRY_UNLOCK_MS`) |
| Need Expo “barcode FPS” API | **REJECTED** — does not exist |
| Native decoder still slow with app fixed (Expo Go vs custom build / VisionCamera) | **UNRESOLVED** — needs device timing after this patch |

---

## Stage model (failure separation)

| Stage | Meaning |
| --- | --- |
| 1 Preview/session | Camera mounts |
| 2 Listener + layout | Native barcode enabled; frame measured |
| 3 Raw JS callback | Decode observed at JS boundary (`scan_raw`) |
| 4 Bounds / lock | Accept vs reject / ignore |
| 5 Feedback | Vibration on accept (before lookup) |
| 6 Lookup / UI | API + result panel |

An unknown product = successful decode + business miss — **not** a decode failure.

---

## Claimed features — verified before change

| Claim | Existed? | Behavior |
| --- | --- | --- |
| Memoized `barcodeScannerSettings` | Yes | Stable types array |
| ~450ms iOS listener delay | Yes | `barcodeListenReady` gated `onBarcodeScanned` |
| iOS hit inflate ~110/36 dp | Yes | `IOS_HIT_INFLATE` in `barcodeFrameHit.ts` |
| Auto torch ~2s | Yes | `useAutoTorchAssist` |
| Auto zoom cap 0.08 | Yes | Delayed timers |
| ~1.6s re-arm on miss | Yes | `SCAN_RETRY_UNLOCK_MS` |
| Locks on accept / found | Yes | `isProcessingRef` + `scanned` |

`autofocus`: default in package is `'off'` (= continuous when needed). Explicit `autofocus="off"` set; **`on` would one-shot lock** — not used.

---

## Correction applied (smallest evidence-supported)

1. **Stable `onBarcodeScanned`** while `CameraView` is mounted — business gate via refs (`acceptScansRef` + `isProcessingRef`). Native pipeline stays warm.
2. **`zoom={0}`** — remove auto-zoom timers (Stocks + Sales).
3. **Remove iOS 450ms listener settle** — `barcodeListenReady === gateOpen`.
4. **Miss handling:** unlock immediately for a *different* code; **suppress same unknown** for 2.5s (`SAME_MISS_SUPPRESS_MS`) — no 1.6s global hammer.
5. **`autofocus="off"`** explicit; keep memoized settings; keep Jun 11 UI + in-bracket rule + iOS hit inflate (not increased further).
6. **`__DEV__` stage timing:** `markScanSession` / `tMs` on `scan_raw` / `scan_accept` / `scan_reject_frame` / `scan_ignored_lock` (no barcode values logged).

Build marker: `CAMERA_DIAG_BUILD = 2026-09-25-printed-speed`.

---

## Files touched

- `app/stocks/barcode-scanner.tsx`
- `app/sales/product-scanner.tsx`
- `src/hooks/useCameraOwnerGate.ts`
- `src/hooks/useBarcodeScanner.ts`
- `src/utils/cameraDiag.ts`
- `src/utils/barcodeFrameHit.ts` (comment audit only)
- `app/purchase/create-invoice.tsx` (QR listener always on when mounted)

---

## Benchmark table

| Platform / device / runtime | Metric | Result |
| --- | --- | --- |
| iOS physical | Median / p90 open→vibrate (printed) | **NOT RUN** — needs Yash |
| Android physical | Same | **NOT RUN** — needs Yash |
| Metro `__DEV__` | `scan_raw.tMs` vs `scan_accept.tMs` | Available after reload |

**Evaluation target:** &lt;1s accept from steady aim (not a cross-device SLA).

---

## Device checklist for Yash (smallest remaining test)

1. Reload Expo Go; confirm logs show `build":"2026-09-25-printed-speed"`.
2. Stocks + Sales: same printed labels, note time-to-vibrate (first aim + second aim after miss).
3. Confirm outside-bracket codes still rejected (orange hint).
4. Unknown product: panel shows; aiming a **different** code works without waiting 1.6s; same unknown does not spam API.
5. Five open/close + background/foreground.

Report PASS / FAIL per platform.

---

## Residual risks / escalation

If `scan_raw` is still late (&gt;1–2s) with warm camera and torch on → app lifecycle is unlikely the bottleneck → escalate to **Expo Go vs custom dev client** comparison, then optional VisionCamera / native PoC (CTO brief Option C). Do **not** change labels.

---

## Rollback

Revert the files listed above on branch `cursor`. Layout/ownership gate pattern from the preview incident remains desirable; only undo the speed-specific listener/zoom/miss changes if regressing.

---

## Cleanup status

- No temporary diagnostic **routes/buttons/overlays** added for this investigation.
- Production `__DEV__` `cameraDiag` kept (legitimate observability; no barcode payloads).
- No bounds debug overlay shipped.
- Method retained in this incident + `CAMERA_SCANNER_STANDARD.md` note.
