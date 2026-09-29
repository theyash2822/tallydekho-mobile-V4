# Incident — iOS printed barcode: decode OK, accept/lookup lock broken

**Date:** 2026-09-25  
**Build:** `2026-09-25-lock-fix`  
**Runtime:** Expo 57.0.22 · expo-camera 57.0.5 · RN 0.86.3

---

## Evidence from Yash (Test A + Stocks logs)

| Observation | Verdict |
| --- | --- |
| Decode probe: **38** raw CODE128 hits, camera 390×844, zoom 0, torch OFF, ready yes | **CONFIRMED** — native/iOS decode works for printed CODE128 |
| Stocks `scan_raw` with type code128, valid bounds, centre near frame | **CONFIRMED** — production also receives decodes |
| Immediately `scan_ignored_lock` reason `accept_gate`, `processing: true` | **CONFIRMED** — app rejects after decode |
| Decoder replacement / focus / torch as root cause | **REJECTED** for this failure mode |

---

## Demonstrated defect (CONFIRMED)

In `useBarcodeScanner`:

```ts
isProcessingRef.current = true;
setScanned(true);
await feedbackAccept();   // yields; lookingUp still false
setScanLookingUp(true);
```

1. **Lock held with lookingUp=false** during haptic awaits → torch assist treats scanner as idle; further `scan_raw` ignored (`processing` / lagged `acceptGate`).
2. **`acceptScansRef` synced in `useEffect`** from `isProcessingRef` → can lag; ignore reason logged as `accept_gate` even when `processing: true`.
3. **No attempt ID** → remount / Scan Again / late lookup could leave confusing lock state; `markScanSession` on `mountCamera` reset **tMs** under same `instanceId` without invalidating the in-flight attempt.

### Lock classification for the captured logs

| Hypothesis | Fit |
| --- | --- |
| Valid pending lookup | Possible for some windows, but lookingUp was false while processing true during haptic gap — **not** a clean pending-lookup UI |
| Successful found awaiting Scan Again | **No** — torch_auto_on requires `!scanResult?.found` |
| Stalled request | Possible if lookup hung *after* lookingUp true |
| Missed reset after not-found | Possible with remount + orphaned async |
| Stale closure / overlapping timer | **Likely contributor** — haptic await + effect-derived gate |

---

## Answers to specific questions

### Why zoom is 0.18 (not a 0.08 “cap”)

Production Jun 11 timer is **two steps**: `0 → 0.08` (800ms) → **`0.18`** (800ms). There is no production cap at 0.08. Probe correctly stays at 0. Logs showing `zoom: 0.18` mean the second step already fired (~1.6s after open).

### Why tMs reset under the same instanceId

`useCameraMountId` is stable for the screen mount. `markScanSession(mountId)` runs whenever `mountCamera` becomes true again (focus/foreground/bounds gate). That **resets elapsed tMs** without changing `instanceId`. Wall-clock can still advance (torch_auto_on after scan_ignored) while tMs drops (e.g. 7832 → 2019).

---

## Fix applied (lock only — no decoder/focus/torch/zoom/inflate changes)

File: `src/hooks/useBarcodeScanner.ts` (+ Stocks/Sales gate wiring)

- Set **`scanLookingUp` + processing lock synchronously before any await**
- **`canAcceptRef` / `foundLockRef` updated synchronously** (no effect lag)
- **`attemptIdRef`**: reset/Scan Again/new accept invalidates in-flight lookup; stale results ignored
- **Company guid captured at accept**; late result ignored if guid mismatch
- Haptics **fire-and-forget** so they cannot hold the accept path
- Unlock on miss/error in `finally`; keep lock only on found until Scan Again

Android path uses the same hook (behavior preserved: still unlocks on miss, locks on found).

---

## Verification checklist (Yash)

Reload build `2026-09-25-lock-fix`. On **Stocks** (not probe):

1. First printed scan → expect `lock_transition` `accept_start` → `lookup_start` → `lookup_end` → result (not endless `scan_ignored_lock`)
2. Unknown code → unlock; second different code can accept
3. Found → stays locked until Scan Again
4. Scan Again → `lock_transition` `reset`; scan works again
5. Close/reopen scanner → clean accept

---

## Temporary diagnostics

- Decode probe kept under Settings (dev) until Yash confirms Stocks; then remove.
- `lock_transition` / `lookup_*` logs kept briefly for verify; trim after PASS.

---

## Residual

If Stocks still fails **with** `scan_accept` + `lookup_end found:true` but no UI → separate render bug.  
If **no** `scan_raw` at all on Stocks but probe hits → spatial/filter only (next).  
Current evidence pointed at **lock**, which this patch addresses.
