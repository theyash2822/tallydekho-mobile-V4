# Debugging Standard (TallyDekho Mobile)

Use this method for non-trivial bugs. Keep it proportional: small defects need a short evidence/fix/check note; cross-layer failures need a fuller investigation.

## Steps (in order)

1. **Define the failure** — expected vs observed, affected scope, reproducible sequence.
2. **Capture a baseline** — commit + dirty changes, dependency versions, device/runtime, config, relevant logs. Preserve user work and working evidence.
3. **Map the execution path** — caller, owner, lifecycle, shared dependencies, result destination.
4. **Separate facts from hypotheses** — supporting/contradicting evidence; a test that could disprove each hypothesis. Label **NOT RUN** accurately.
5. **Instrument the failing boundary** — measure the actual component/resource, not only its parent or a nearby success signal (e.g. parent vs child dimensions; ready callback vs visible output).
6. **Build the smallest valid reproduction** — remove unrelated dependencies; validate the reproduction before blaming a framework.
7. **Change one variable** — keep comparison conditions stable; document unavoidable differences.
8. **Fix the demonstrated cause** — prefer a narrow patch; separate cleanup and architecture work.
9. **Verify end to end** — original path, lifecycle/failure paths, user-visible success. Static checks are not a substitute for runtime results.
10. **Close with durable evidence** — root-cause confidence, exact diff (including new files), tests, limitations, patch-specific rollback.

## Confidence labels

| Label | Meaning |
| --- | --- |
| **CONFIRMED** | Causal mechanism supported by code/runtime evidence; controlled repair restores the failing behavior. |
| **LIKELY** | Supporting evidence exists; a discriminating test remains outstanding. |
| **UNRESOLVED** | Evidence does not yet isolate the cause. |

## Anti-patterns

- Blind UI rewrites, package upgrades, or library replacements before isolation.
- Equating compilation, permission, readiness events, or visible chrome with end-to-end success.
- Blaming devices/vendors/frameworks merely because multiple screens fail.
- Sleeps / remount loops to hide lifecycle bugs.
- Assuming shared routes behave identically from every caller.
- Long reports without the next discriminating test.
- Calling old errors “unrelated” without a baseline comparison.
- A “full diff” that omits new/untracked source files.

## Related

- Camera scanners: [`CAMERA_SCANNER_STANDARD.md`](./CAMERA_SCANNER_STANDARD.md)
- Example incident: [`../incidents/2026-09-25-camera-preview.md`](../incidents/2026-09-25-camera-preview.md)
