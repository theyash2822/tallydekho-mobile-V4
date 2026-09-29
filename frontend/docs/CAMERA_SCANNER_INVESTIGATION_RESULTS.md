# CAMERA_SCANNER_INVESTIGATION_RESULTS.md

**Date:** 2026-09-25  
**Brief followed:** `/Users/mac/Downloads/TallyDekho_Cursor_Camera_Investigation.md`  
**Repo:** `tallydekho-mobile-V4` branch `cursor`  
**Verdict:** **LIKELY CAUSE** (not CONFIRMED ROOT CAUSE — physical discriminating tests C1–C5 largely NOT RUN)

---

## 1. Executive verdict

**LIKELY CAUSE (composite, evidence-graded):**

1. **Confirmed code defect (ownership):** Purchase Invoice e-Invoice QR kept a `CameraView` in the React tree under a `Modal` whenever `permission.granted`, gated only by Modal `visible` — not by an explicit “scanner open” mount condition. That violates the ownership rule in the CTO brief and can contend with other scanners if RN keeps Modal children mounted. **Fixed:** mount only when `showCamera && permission.granted`.

2. **Confirmed code defect (Stocks lifecycle):** Stocks scanner used a delayed `cameraActive` remount behind a full-screen dark overlay. While inactive, the user sees Jun 11 chrome over a black boot layer — indistinguishable from a “failed preview.” **Fixed:** mount when `permission.granted && isFocused`, use expo-camera `active={isFocused}`, no delay gate.

3. **Unresolved for Android blank on Sales + Stocks:** User-reported black preview on **both** stack scanners after permission grant. That is **not** explained by (1) alone if PI was never opened, and not fully explained by (2) for Sales (Sales had no delay gate). Remaining open: Expo Go host vs `expo-camera@57.0.5`, OEM CameraX, overlay-vs-surface, or lifecycle races — **requires C2 bare probe + logcat on device**.

**Not claimed as root cause:** “OEM only,” “must migrate all Modals,” “package 57.0.25 fixes camera,” or “backend.”

---

## 2. Architecture and camera ownership (file/line)

| ID | Entry | File | Mount condition (before → after) | Result bridge |
|----|-------|------|----------------------------------|---------------|
| A | Stocks → Barcodes → Scan | `app/stocks/barcodes.tsx` ~570–587 → `app/stocks/barcode-scanner.tsx` | Stack route; was `cameraActive` delay → now `granted && isFocused` + `active={isFocused}` | `stocksBarcodeScan` |
| B | Sales Invoice/Order product barcode | `app/sales/product-scanner.tsx` ~193+ | Stack; was always mount when granted → now `granted && isFocused` + `active` | `barcodePicker` |
| C | Purchase Order product barcode | `app/purchase/create-order.tsx` ~1026–1040 | Navigates to **B** | `barcodePicker` |
| D | Purchase Invoice product barcode | `app/purchase/create-invoice.tsx` ~1369–1372 | Navigates to **B** | `barcodePicker` |
| E | Purchase Invoice e-Invoice QR | `app/purchase/create-invoice.tsx` ~1655–1705 | Modal; was `permission?.granted` inside Modal → now `showCamera && permission?.granted` | `applyEInvoiceQrData` (local) |
| F | Bill photo (PI) | same file ~919–943 | `ImagePicker.launchCameraAsync` (separate from `CameraView`) | attachment URI |
| G | **NEW** bare probe | `app/dev/camera-probe.tsx` | `granted && isFocused`, no overlay/barcode | none |

Layouts: `app/stocks/_layout.tsx` Stack (`contentStyle` pageBg); `app/sales/_layout.tsx` Stack.  
Hook: `src/hooks/useBarcodeScanner.ts` — lookup only after decode; does not gate CameraView.  
Diag: `src/utils/cameraDiag.ts` (`__DEV__` only; build marker `2026-09-25-cto-brief`).

**Desired ownership (brief):** camera exists only when permission granted, owner focused, app foregrounded, scanner open.  
**Implemented toward that:** focus + `active` on A/B; explicit `showCamera` mount on E. AppState pause not yet wired (residual risk).

---

## 3. Corrections to the prior forensic report

| Prior claim | Correction applied |
|-------------|-------------------|
| Visible brackets ⇒ overlay not covering preview | Rejected. Opaque layers can sit under brackets; centre transparency must be verified in code (`scanFrame` now explicit `transparent`) and by **bare probe without overlay**. |
| Permission dialog ⇒ navigation/layout OK | Permission only proves request path. |
| Stocks+Sales fail ⇒ Expo Go/OEM strongest | Shared failure also fits shared lifecycle/deps/rendering; no high-confidence rank without C2–C5. |
| Custom native build = root cause | Reframed as **experiment C4**, not a cause. |
| Copy Sales mount because Sales “works” | Sales also reported black on same phone — not a proven baseline. |
| Modal inherently broken; PI QR must migrate | Modal involvement unproven for Android product-scan blank; PI QR ownership fixed in place; stack migration remains **option**, not confirmed fix. |
| PO must fail identically | Predicted by shared route B; each caller still needs its own device test. |
| UI chrome ⇒ correct bundle | Need Metro identity + `CAMERA_DIAG_BUILD` in logs. |

iOS historical Modal symptoms kept **separate** from current Android observations.

---

## 4. Baseline environment

| Item | Value |
|------|--------|
| Branch | `cursor` |
| HEAD | `9d075beb7cb3c7999dea67cf5ea62b41aac22814` — *Items settings UX: HSN report, Dead tab, batch gate, neg warn* |
| Working tree | Dirty: scanner work + HSN/settings uncommitted; **new** `barcode-scanner.tsx`, `stocksBarcodeScan.ts`, `docs/`, `dev/camera-probe.tsx`, `cameraDiag.ts` |
| Package manager | npm (`package-lock.json`); no overrides/resolutions |
| expo | 57.0.22 |
| expo-camera | 57.0.5 |
| expo-router | 57.0.21 |
| react / RN | 19.2.3 / 0.86.3 |
| react-native-screens | 4.26.2 |
| expo-modules-core | 57.0.18 (nested) |
| ab4df78f | Exists — Jun 11 spatial filter commit (design reference, **not** verified working runtime on this device) |
| Native folders | `android/` present; **no** `ios/` in frontend |
| expo-doctor | 18/21; failures include network to exp.host + non-CNG sync warning for app.json vs android/ |
| `npx expo install --check` | Failed: HTTP Proxy Forbidden (environment) |
| Metro at capture | PID 45753, cwd `.../tallydekho-mobile-V4/frontend`, **port 8081**, clients on `192.168.29.223` |
| Runtime (user) | Expo Go (push log); Android Camera permission granted (user) |
| Device model / Expo Go build / OS API | **NOT CAPTURED** (needs Yash) |

---

## 5. Hypothesis table

| ID | Hypothesis | Supporting | Contradicting | Discriminating test | Status |
|----|------------|------------|---------------|---------------------|--------|
| H-own-PI | PI Modal mounts CameraView while “closed” | Code before fix: CameraView under Modal when `permission.granted` | User black on Stocks without opening PI | Open Sales cold after never opening PI | **Mitigated in code**; device effect NOT RUN |
| H-stocks-gate | Delayed `cameraActive` shows black under chrome | Code path: boot View + overlay | Sales also black without this gate | C2 bare; compare Stocks logs `onCameraReady` | **Mitigated in code**; device NOT RUN |
| H-overlay | Opaque overlay hides live frames | Possible in general | Frame View no fill color | C2 bare (no overlay) | OPEN |
| H-expo-go | Expo Go / CameraX host issue | Shared A+B failure on one Android | No second device; no logcat | C2 in Expo Go vs C4 dev build | OPEN |
| H-deps | expo-camera 57.0.5 vs host mismatch | SDK 57 docs list ~57.0.5; doctor/network incomplete | No controlled upgrade yet | One controlled `expo install expo-camera` after C2 baseline | OPEN — **not** first move |
| H-retained-stack | Prior screen keeps camera | Possible with stack retention | Need instance logs across routes | C1 entry-order + CameraDiag instance IDs | OPEN |
| H-modal-ios | Modal black on iOS | Prior screenshots; Expo #49760 is iOS lead | Android product scan is stack | Separate iOS Modal repro | OPEN (separate) |
| H-backend | Backend gates preview | — | Preview is local | — | REJECTED for preview |

---

## 6. Experiment table

| Test | Commit/changes | Device/runtime | Expected | Observed | Logs | Result |
|------|----------------|----------------|----------|----------|------|--------|
| A0 Baseline deps | HEAD + dirty tree | Host Mac | Versions recorded | See §4 | npm ls | PASS |
| A1 expo-doctor | — | Host | Report | Network failures + non-CNG warn | doctor output | PARTIAL |
| C1 Cold-start Sales/Stocks order | After ownership fixes | Android Expo Go | Entry-order matrix | — | — | **NOT RUN** |
| C2 Bare `/dev/camera-probe` | Added this session | Android Expo Go | Live frames or onMountError | — | expect `[CameraDiag]` | **NOT RUN** (Yash) |
| C3 Independent mini app | — | Same Expo Go | Compare | — | — | **NOT RUN** |
| C4 Dev build | — | Same phone | Compare runtime | — | — | **NOT RUN** |
| C5 logcat | — | Android | CameraX/Expo lines | — | — | **NOT RUN** |
| User prior | Pre-fix | Android Expo Go | — | Permission OK; A+B black; Stocks chrome visible | Metro VirtualizedList noise | OBSERVATION |

---

## 7. Minimal reproduction and native logs

- **In-app bare probe:** `/dev/camera-probe` (build marker `2026-09-25-cto-brief`).  
- **Independent Expo sample / logcat / second device:** NOT RUN.  
- Expo issue [#49760](https://github.com/expo/expo/issues/49760): iOS SDK 57 black preview with green indicator; **investigative lead only**, not proof of this Android case.  
- SDK 57 camera docs recommend `expo-camera ~57.0.5` (matches lock) and document `onCameraReady` / `onMountError` / single active preview.

---

## 8. Exact changes this session (fix / instrumentation)

| Change | Rationale | Rollback |
|--------|-----------|----------|
| `src/utils/cameraDiag.ts` | Dev-only lifecycle logs; no barcodes/PII | Delete file; remove imports |
| `app/dev/camera-probe.tsx` | C2 bare CameraView | Delete route |
| `barcode-scanner.tsx` | Remove delay gate; `isFocused` + `active`; diag; transparent frame | Revert file |
| `product-scanner.tsx` | Focus ownership + diag | Revert file |
| `create-invoice.tsx` PI QR | `showCamera && permission.granted` before CameraView | Revert Modal condition |

**Residual risks:** AppState background not handled; stack screens may still retain state; package upgrade not performed; physical preview success **unproven**.

**No** VisionCamera migration. **No** blind Expo upgrade. **No** deploy.

---

## 9. Acceptance results

| Test | Result |
|------|--------|
| Fresh permission / already granted / denial UX | NOT RUN on device |
| Stocks Jun 11 live preview | NOT RUN (code ready) |
| Sales / PO / PI product scan | NOT RUN |
| PI e-Invoice QR | NOT RUN (ownership fix only) |
| 5× open/close, alternate scanners | NOT RUN |
| tsc camera-touched files | Clean after import fix (re-verify locally) |

---

## 10. Recommendations

### Immediate (repair / diagnose)

1. Reload single Metro (`8081` only).  
2. Run **Yash device script** below (C2 first).  
3. Paste `[CameraDiag]` lines + whether bare probe shows **moving** frames (not just onCameraReady).

### Near-term architecture (after C2)

- If bare probe **works** and full scanner **fails** → reintroduce overlay/zoom one feature at a time.  
- If bare probe **fails** in Expo Go → run C4 dev build before more UI work.  
- Consider shared `CameraSession` helper (focus + AppState + active) without coupling product lookup to e-Invoice parsing.  
- PI QR stack migration: only if Modal still fails after ownership fix and C2.

### Do not

- Treat Expo Go failure alone as OEM verdict.  
- Unrestricted dependency upgrades as first step.  
- Mix product barcode lookup with e-Invoice QR parsing.

---

## Message to Yash

**Proved from code (this machine):**  
- Exact deps/branch/Metro identity.  
- PI QR could own a camera without an explicit open mount — fixed.  
- Stocks delay-gate could present black under Jun 11 chrome — fixed.  
- Bare probe route + `[CameraDiag]` instrumentation ready.

**Not proved:** Why Sales+Stocks preview were black on your Android Expo Go (needs your C2 result + logs).

**Changed:** ownership/lifecycle + diagnostics only (Jun 11 Stocks UI kept).

**Smallest next device action:**

```text
1. Ensure only Metro on 8081 for this frontend.
2. Reload Expo Go.
3. Manually open: /dev/camera-probe
   (in Expo: shake → type URL path, or add a temporary button — route file is app/dev/camera-probe.tsx)
4. Allow camera if asked.
5. Tell me:
   a) Do you see LIVE moving video? (yes/no)
   b) Paste all Metro lines containing [CameraDiag]
6. Then open Sales product barcode scan once — yes/no live video + [CameraDiag] lines.
```

Optional logcat (if comfortable):

```bash
adb logcat -c && adb logcat | rg -i 'camera|CameraX|expo.modules.camera|CameraView'
```

(Run while opening `/dev/camera-probe` once.)

---

*End of results.*
