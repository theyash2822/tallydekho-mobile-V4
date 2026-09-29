# Incident: Camera preview black / zero-height layout (2026-09-25)

Source of truth brief: `TallyDekho_Camera_Stability_and_Debugging_Standard.md` (25 Sep 2026).

## Failure

Expected: live back-camera preview in probe and product scanners.  
Observed: black/blank preview; probe logged container nonzero, camera height **0**; permission granted; `onCameraReady` fired.

## Baseline

| Field | Value |
| --- | --- |
| Repo | `tallydekho-mobile-V4` |
| Branch | `cursor` |
| HEAD | `9d075beb7cb3c7999dea67cf5ea62b41aac22814` |
| Dirty | Yes — camera layout/lifecycle/diag + unrelated stocks/settings files preserved |
| expo | `^57.0.17` (resolved SDK 57) |
| expo-camera | `~57.0.5` |
| react-native | `0.86.3` |
| Deps changed during repair | **No** |
| Runtime | Expo Go (dev). Release build separate. |

Platform/device: record per physical test (Android ≠ iOS). Earlier screenshot may have been iOS.

## Cause

| Item | Confidence |
| --- | --- |
| `absoluteFill` on CameraView → `onLayout` height 0 while flex parent nonzero | **CONFIRMED** (probe); layout fix restored moving preview (Yash) |
| Native CameraView paints above RN dim overlays → full-screen leak outside frame | **LIKELY** — clip CameraView into product frame |
| Sales/Stocks identical root cause to probe | **LIKELY** — same pattern applied; full matrix pending |

Honest limit: Sales/Stocks/PI QR visible-preview confirmation is still awaiting Yash after frame-clip + ownership gate.

## Exact correction

1. Measure host/frame `onLayout`; mount when w>0 && h>0.
2. Explicit pixel `CameraView` `{ width, height }` (not `absoluteFill`).
3. Nest preview inside frame: Stocks **130** strip / Sales **240** / PI QR **260**; opaque black outside.
4. Shared gate `useCameraOwnerGate`: permission ∧ focus ∧ AppState foreground ∧ scanner open ∧ bounds.
5. Unique per-mount diag IDs; `__DEV__` only; optional `EXPO_PUBLIC_CAMERA_DIAG_URL`.
6. Probe accessible from **Settings → Contact → Camera diagnostic (dev)**; removed from Stocks barcodes production surface.
7. Jun 11 Stocks UI + bridges preserved.

## Files (this repair)

- `app/dev/camera-probe.tsx`
- `app/stocks/barcode-scanner.tsx`
- `app/sales/product-scanner.tsx`
- `app/purchase/create-invoice.tsx`
- `app/stocks/barcodes.tsx` (launcher only; diag CTA removed)
- `app/settings/index.tsx` (dev diag entry)
- `src/utils/cameraDiag.ts`
- `src/hooks/useCameraOwnerGate.ts`
- `src/utils/stocksBarcodeScan.ts` / `barcodePicker.ts` (unchanged contracts)
- Docs: `docs/engineering/*`, `docs/incidents/2026-09-25-camera-preview.md`
- Cursor rule: workspace `.cursor/rules/tallydekho-camera-debugging.mdc`

## Validation

| Scenario | Status |
| --- | --- |
| Probe moving preview | **PASS** (Yash, pre frame-clip of product screens) |
| Stocks 130 strip inside corners | Ask Yash |
| Sales / PO / PI product 240 | Ask Yash |
| PI e-Invoice QR 260 (not full-screen) | Ask Yash |
| Open-close ×5 / background / permission | NOT RUN |
| Release inert probe | Code-gated; device NOT RUN |
| iOS | NOT RUN |

Static: `npx tsc --noEmit` — filter changed paths; project has pre-existing unrelated errors.

## Rollback

Revert only the camera files listed above. Do not reset unrelated dirty stocks/settings work on the branch.
