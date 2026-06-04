# TASK_ROUTING.md — tallydekho-mobile-V4

For each task type, read ONLY the listed files.

---

## Auth / OTP / Login Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/(auth)/index.tsx
- app/(auth)/otp.tsx
- app/(auth)/verify-pin.tsx (if 2FA issue)
- src/context/AuthContext.tsx
- src/services/api.ts (auth section, lines ~1–100)

Do NOT read: tab screens, stock screens, reports, settings

---

## Dashboard / KPI Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/(tabs)/index.tsx
- app/kpi/<relevant-screen>.tsx
- src/services/api.ts (dashboard/kpi section)
- src/components/CashflowCard.tsx (if chart issue)
- src/components/Header.tsx (if company/FY switcher issue)

Do NOT read: auth, stocks, compliance, settings

---

## Sales Screen Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/sales/index.tsx or app/sales/register.tsx
- app/sales/create-invoice.tsx (if create form issue)
- src/services/api.ts (sales section)
- src/components/forms/ (if form component issue)

Do NOT read: auth, stocks, reports, settings

---

## Purchase Screen Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/purchase/index.tsx or app/purchase/register.tsx
- src/services/api.ts (purchase section)

Do NOT read: auth, stocks, reports, settings

---

## Voucher Bug (Payment / Receipt / Journal / Contra)
Read:
- AGENTS.md, BLUEPRINT.md
- app/voucher/<relevant-screen>.tsx
- src/services/api.ts (voucher section)

Do NOT read: auth, stocks, reports, sales

---

## Ledger Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/(tabs)/ledger.tsx
- app/ledger/[id].tsx
- src/services/api.ts (ledger section)

Do NOT read: auth, stocks, reports, compliance

---

## Stock Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/(tabs)/stocks.tsx
- app/stocks/<relevant-screen>.tsx
- src/services/api.ts (stocks section)
- src/components/FilterBottomSheet.tsx (if filter issue)

Do NOT read: auth, ledger, reports, compliance

---

## Reports Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/(tabs)/reports.tsx
- app/reports/<relevant-screen>.tsx
- src/services/api.ts (reports section)

Do NOT read: auth, stocks, ledger, sales/purchase

---

## GST / Compliance Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/reports/gst.tsx or app/reports/compliance.tsx
- app/reports/einvoice-*.tsx or app/reports/ewb-*.tsx
- src/services/api.ts (GST/einvoice/ewb section)

---

## Settings Bug
Read:
- AGENTS.md, BLUEPRINT.md
- app/settings/<relevant-screen>.tsx
- src/context/AuthContext.tsx (if auth-related setting)
- src/context/SettingsContext.tsx (if preference)
- src/services/api.ts (settings section)

---

## Modal / UX Bug (Bottom Sheet / Keyboard)
Read:
- AGENTS.md, BLUEPRINT.md
- Specific modal component file
- src/components/FilterBottomSheet.tsx (if filter modal)

Pattern to check:
- animationType="slide" ✓
- justifyContent:'flex-end' on outer View ✓
- KeyboardAvoidingView wraps ONLY the sheet (not the overlay) ✓
- paddingBottom: Math.max(insets.bottom, 8) on footer ✓

---

## New Screen
Read:
- AGENTS.md, BLUEPRINT.md, NAVIGATION_MAP.md
- Closest similar screen for pattern
- src/components/ApiStateViews.tsx (required on every screen)
- src/services/api.ts (relevant section)

Every new screen must have: LoadingView, ErrorView, EmptyView from ApiStateViews.tsx

---

## API Integration (new endpoint)
Read:
- AGENTS.md, BLUEPRINT.md, API_USAGE.md
- src/services/api.ts
- src/hooks/useApiData.ts
- Relevant screen file

---

## Files to ALWAYS Ignore
- node_modules/
- android/build/
- ios/Pods/
- .metro-cache/
- .expo/cache/
- dist/
- assets/
- src/data/mockData.ts (never use for live display)
- src/data/mockDocuments.ts
- Sibling repos (td-backend, td-web-portal, td-source, td-website)
