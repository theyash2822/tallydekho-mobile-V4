# Camera Scanner Standard (TallyDekho Mobile)

## Ownership / mount condition

Mount (or keep active) a camera only when **all** apply — use `src/hooks/useCameraOwnerGate.ts`:

```text
permission granted
AND owning screen focused
AND app in foreground (AppState === 'active')
AND this scanner open
AND valid measured bounds (w>0 && h>0)
```

- One owner at a time — no overlapping CameraView instances.
- Release on close, blur, and background; recover on return.
- Cancel timers/listeners; ignore stale async after close.
- Do not spam permission requests.
- Prefer conditional mount over unexplained delays / random remount keys.
- Unique per-mount IDs via `useCameraMountId(scannerName)` for diagnostics.

## Layout pattern (verified 2026-09-25)

**CONFIRMED cause (probe):** `StyleSheet.absoluteFill` on `CameraView` reported `onLayout` height **0** while a `flex:1` parent was nonzero. `onCameraReady` still fired — readiness ≠ visible frames.

**Correction (June 11 + MD):**

1. Measure a **full-screen** (or full-modal) flex host; mount when w>0 && h>0.
2. Size `CameraView` with **explicit pixel** width/height filling that host (do not hardcode one phone’s size).
3. Draw the scan chrome as an **overlay** (dim top/sides/bottom + **transparent** center + corner brackets). Do **not** nest `CameraView` inside the 130 / 240 / 260 frame.
4. Accept barcodes only via the **spatial filter** (in-bracket). Keep frame `measureInWindow` consistent with full-screen preview coordinates.
5. **Native listener stability (2026-09-25 printed-speed):** keep `onBarcodeScanned` attached while `CameraView` is mounted. Installed `expo-camera` sets `barcodeScannerEnabled = !!onBarcodeScanned`; detaching the prop stops scanning and (iOS) removes session outputs. Gate business acceptance in JS refs instead. Prefer `zoom={0}` unless a measured benefit for zoom is proven. Do not invent a barcode FPS setting.

### Locked product frames (guide / filter only — not camera size)

| Scanner | Frame chrome |
| --- | --- |
| Stocks (Jun 11) | Height **130**, side inset **12**, white corners |
| Sales / PO / PI product barcode | **240×240** |
| Purchase Invoice e-Invoice QR | **260×260** |

## Diagnostics

- Probe: `app/dev/camera-probe.tsx` — `__DEV__` only; inert in release (no camera mount / no collector).
- Entry: **Settings → Contact & Information → Camera diagnostic (dev)** (not on Stocks barcodes).
- Logger: `src/utils/cameraDiag.ts` — `__DEV__` gate; optional `EXPO_PUBLIC_CAMERA_DIAG_URL`; dedupe; never log barcodes/QR/tokens.
- Always log **platform**, build marker, AppState, parent **and** camera dimensions, unique mount id.
- Never equate: permission → layout → `onCameraReady` → **moving video** → decode → correct draft.

## Result contracts

| Flow | Bridge / resolve | Notes |
| --- | --- | --- |
| Stocks barcode | `stocksBarcodeScan` | Jun 11 UI + spatial filter |
| Sales / PO / PI line barcode | `barcodePicker` → `/sales/product-scanner` | Shared route; test each caller |
| PI e-Invoice QR | Local Modal + parse | Separate from product lookup |

Clean up bridge registrations on success/cancel/failed navigation.

## Acceptance checklist (device)

See physical matrix in [`../incidents/2026-09-25-camera-preview.md`](../incidents/2026-09-25-camera-preview.md). Record Android and iOS separately. Development success ≠ release-build success.

## Rollback

Revert only camera layout/lifecycle/diag files for this patch; leave unrelated local work untouched. Prefer restoring previous `CameraView` style + frame nesting rather than deleting whole screens.
