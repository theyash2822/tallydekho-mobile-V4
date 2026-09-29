# CTO Brief — Barcode Scanner: Printed Label Speed (iOS + Android)

**Date:** 2026-09-25  
**Product:** TallyDekho Mobile (Expo Go / SDK 57, `expo-camera` CameraView)  
**Surfaces:** Stocks Jun 11 scanner (`/stocks/barcode-scanner`), Sales product scanner (`/sales/product-scanner`)  
**Status:** Layout + in-bracket filter largely correct; **printed barcode time-to-first-success still too slow** on iOS (and now also felt slow on Android).  
**Ask:** CTO decision on next investment path (app-only mitigations vs native module / vendor / process).

---

## 1. What we are facing (problem statement)

### User-visible symptoms

| Symptom | iOS | Android |
| --- | --- | --- |
| On-screen / bright barcode | Often OK | Generally OK / fast |
| **Printed label** | Slow or needs flash / multiple aims | Was good; recently also feels slower than expected |
| Must be inside white brackets | Wanted — Android matches well | Working as designed |
| First aim often misses | Common | Less common historically; now reported too |
| Second aim after a miss | Felt blocked until we added unlock | Less reported |

### Business impact

- Warehouse / shop floor scanning of **printed CODE128 (and similar)** is the primary use case.
- Slow first decode → user distrust, torch spam, abandoned scans, support load.
- We cannot ship “increase FPS” as a simple toggle — Expo Camera does not expose a barcode FPS API.

### Important clarification

**“FPS” in older notes was not a frame-rate setting.**  
It referred to iOS **AVFoundation missing early barcode callbacks** when:

1. `barcodeScannerSettings` was a new object every render (pipeline re-init), and/or  
2. Camera mounted before the session had settled (~400–450ms).

There is **no app-level “retries per second” quota**. Native can fire `onBarcodeScanned` many times per second while listening; our JS **accepts the first in-frame hit**, then locks until lookup finishes / retry unlock.

---

## 2. Platform reality (why iOS ≠ Android)

| Layer | iOS | Android |
| --- | --- | --- |
| Engine | AVFoundation barcode | ML Kit (via Expo) |
| Light / contrast | Much more sensitive; torch often required for print | More tolerant in ambient light |
| Bounds for spatial filter | Screen/view coords (usually); can sit slightly outside thin 130px strip for large printed codes | Screen dp when preview sized; aligns well with brackets |
| Early frames | Unreliable until session settles | Typically ready near-immediately |

Printed labels are harder than phone-screen barcodes: smaller optical contrast, glare, distance, bar height, and focus.

---

## 3. What we already fixed / shipped (this arc)

Aligned to `docs/engineering/CAMERA_SCANNER_STANDARD.md` and Jun 11 UI.

### Layout (both platforms)

- Full-screen measured `CameraView` (explicit W×H) — **not** nested inside the 130/240 frame (nesting broke decode).
- Jun 11 chrome: dim overlay + transparent strip/square + corner brackets.
- Stocks frame chrome locked: **height 130**, side inset **12** (UI unchanged).

### Reliability

| Fix | Purpose |
| --- | --- |
| Memoized `barcodeScannerSettings` | Stop iOS pipeline re-init every render |
| Mount preview immediately; delay **listener** ~450ms on iOS | Warm AVFoundation without dead first second from delayed whole mount |
| Spatial filter (screen-dp) | Only accept in-bracket (Android-tight) |
| **iOS-only invisible hit inflate** (+110dp vertical / +36dp sides) | Printed centres often report just outside thin 130 strip; UI brackets unchanged |
| Auto-torch after ~2s with no success | iOS often needs light for print |
| Softer / delayed auto-zoom (cap 0.08; iOS zoom ~2.2s) | Strong zoom blurred printed labels |
| Auto re-arm after miss (~1.6s) | Second aim without mandatory “Scan Again” |
| Soft-lock only after accept; stay locked on **found**; unlock after **not found** | Stop one-shot lock killing retries |

### What we deliberately did **not** do

- Change visible frame sizes away from standard (130 / 240 / 260).
- Full-screen accept on iOS (broke “only inside brackets”).
- Blind Expo / native dependency upgrades.
- Claim a configurable barcode FPS.

### Current build marker (diag)

`CAMERA_DIAG_BUILD` ≈ `2026-09-25-ios-retry-warm` (confirm in Metro `[CameraDiag]` logs).

---

## 4. Current behaviour model (for CTO)

```text
Camera mounts (gate: permission + focus + foreground + measured host)
    → iOS: wait ~450ms then attach onBarcodeScanned
    → Native may emit many decode events / second (OS-controlled)
    → JS: spatial hit-test (Android tight; iOS inflated)
         → outside → hint, keep listening
         → inside  → LOCK → vibrate → lookupBarcode API (1 call)
              → found → stay locked (result UI)
              → miss  → show not-found → re-arm listen after ~1.6s
    → If no accept for ~2s → auto torch ON (user can turn off)
```

**API lookups ≠ camera frames.** We do **one lookup per accepted scan**, not N lookups per second.

---

## 5. Residual gap (why it still feels slow)

Likely mix of:

1. **Decode physics** — AVFoundation / ML Kit need enough light, focus, and bar contrast on print; app cannot force a higher barcode sample rate via Expo.
2. **Thin optical target** — 130px guide is correct for Jun 11 UX but leaves little margin for large printed codes even with hit inflate.
3. **Expo Go vs custom native** — Expo Camera abstractions limit advanced focus / barcode session tuning that a custom native module or `vision-camera` + ML Kit / Apple Vision might expose.
4. **Label quality** — historically short bar height hurt iOS; user reports current pain is **speed**, not only height (still worth QA on real label stock).

---

## 6. Options for CTO (decision)

### Option A — Continue app-only mitigations (low cost, diminishing returns)

Examples: slightly earlier torch; optional “torch on open” for Stocks; further iOS hit inflate; disable auto-zoom entirely on Stocks; longer listen overlap.

- **Pros:** Fast, stays on Expo Go path.  
- **Cons:** Won’t beat native decode limits; iOS print may remain torch-dependent.

### Option B — Product / process (cheap, high leverage)

- Torch on by default for Stocks scanner.  
- Print QA checklist: min bar height, contrast, matte stock, hold distance.  
- Train: aim strip + wait for auto-flash.

- **Pros:** Improves field success without native rewrite.  
- **Cons:** Doesn’t fix engine speed.

### Option C — Native / library investment (medium–high cost, best long-term decode)

Evaluate one of:

- Dev client + tuned `expo-camera` / config plugins, or  
- `react-native-vision-camera` + barcode plugin (ML Kit / Vision), or  
- Thin native module for continuous barcode session with focus lock.

- **Pros:** Real control over focus, torch policy, processing cadence.  
- **Cons:** Leaves pure Expo Go; CI / release / QA cost.

### Option D — Accept platform asymmetry (policy)

Document: **Android = primary floor scanner; iOS = supported with torch.**  
Ship as known limitation until Option C.

---

## 7. Recommended ask to CTO

1. **Confirm priority:** Is “printed label &lt; ~1s to vibrate on mid-tier phones, Expo Go” a hard P0 for **both** iOS and Android?  
2. If **yes** → approve **Option C spike** (1–2 days): vision-camera or native barcode PoC vs current Expo path, same Jun 11 UI.  
3. If **no / near-term** → ship **Option A + B** (torch-on-open for Stocks + print checklist) and freeze further inflate/filter experiments.  
4. Do **not** invest in searching for an Expo “FPS” setting — it does not exist for this stack.

---

## 8. Key files (engineering)

| Area | Path |
| --- | --- |
| Standard | `docs/engineering/CAMERA_SCANNER_STANDARD.md` |
| Stocks UI + filter | `app/stocks/barcode-scanner.tsx` |
| Sales UI + filter | `app/sales/product-scanner.tsx` |
| Hit-test + iOS inflate | `src/utils/barcodeFrameHit.ts` |
| Lock / retry unlock | `src/hooks/useBarcodeScanner.ts` |
| Mount vs listen settle | `src/hooks/useCameraOwnerGate.ts` |
| Auto torch | `src/hooks/useAutoTorchAssist.ts` |
| Diag | `src/utils/cameraDiag.ts` |

---

## 9. One-line summary for standup

> Printed barcode scan is still too slow on iOS (and reported on Android); layout/brackets/retry/torch mitigations are in place, but Expo Camera gives no barcode FPS control — need CTO call on torch/print process vs native scanner spike.
