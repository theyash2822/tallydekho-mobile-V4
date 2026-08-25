# Forensic UI Restore Audit — Mock Cleanup Regressions

**Source commit:** `31a3f402` (2026-08-24) — *Replace KPI/Sales/register mock UIs with live API data*  
**Goal:** Live Tally data is correct; designed UI (gradients, carousels, rich cards) must not be thrown away. Fix **screen by screen**.

**Rule of thumb**
1. Show what **Tally sync already gives** first (ledger name, closing balance, parent/group, voucher list, dates, Dr/Cr).
2. Mark optional enrichment (Bank Feeds A/c+IFSC, EMI calendars, rates) separately — do not invent mocks.
3. Restore the **visual shell** from pre-`31a3f402` and wire it to live fields.

---

## Status legend

| Status | Meaning |
|--------|---------|
| ✅ Restored | UI shell + live data done |
| 🔴 Needs restore | Designed UI lost; live list/chips only |
| 🟡 Partial | Live data OK; some designed chrome missing or simplified |
| 🟢 OK | Live wiring kept designed UI |

---

## 1. Bank Balance — `app/kpi/bank-balance.tsx`

| | |
|--|--|
| **Status** | ✅ Restored (2026-08-25) |
| **Designed UI (pre-cleanup)** | KPI carousel + **gradient bank cards** (swipe + dots): name, account mask, balance, “Last feed”, per-bank txn list |
| **After cleanup** | KPI carousel kept; banks became **horizontal chips** (name + compact balance); no gradients |
| **Tally provides today** | `name`, `parent`, `closing_balance`, recent voucher lines (`guid`, `voucher_number`, `party_name`, `date`, `amount`, `Dr/Cr`) via `GET /kpi/bank-balance` |
| **Tally does NOT provide** | “Bank feed” aggregator timestamp (use last voucher date instead) |
| **Restore mapping** | Card title = ledger **name**; secondary = **masked A/c** from Tally when synced, else parent; IFSC when present; “Last txn” = latest voucher date |
| **Optional later** | — (A/c+IFSC now from Tally ledger master sync, not Bank Feeds) |

---

## 2. Loans & ODs — `app/kpi/loans-ods.tsx`

| | |
|--|--|
| **Status** | 🔴 Needs restore |
| **Designed UI** | KPI carousel + **gradient loan/OD cards** (name, maturity, Principal/Rate/EMIs or Limit/Utilised/Interest) + Outstanding (6m) / OD utilisation tabs + **EMI calendar** modal + upcoming EMI list |
| **After cleanup** | KPI carousel + **plain ledger list** (name + balance only). ~823 → ~183 lines |
| **Tally provides today** | Loan/OD-ish ledger **name** + **closing_balance** (and parent) via KPI loans endpoint |
| **Tally does NOT provide** | Maturity date, interest rate, EMI schedule, OD limit/utilisation history (unless custom ledgers / bank feeds) |
| **Restore plan** | Bring back gradient carousel: **name + balance** (and parent as type Loan vs OD). Hide Rate/EMI/Maturity or show “—” until a data source exists |
| **Fetch later** | OD limit: only if stored in Bank Feeds / custom fields; EMI calendar: product decision (not in standard Tally XML sync) |

---

## 3. Cash in Hand — `app/kpi/cash-in-hand.tsx`

| | |
|--|--|
| **Status** | 🟡 Partial |
| **Designed UI** | Summary KPI carousel (auto-scroll) + cash movements list |
| **After cleanup** | Same pattern, live API + period tabs — structure largely preserved |
| **Tally provides** | Cash ledger balance + cash voucher movements |
| **Notes** | Re-check visual polish vs old (auto-scroll, card density). No gradient bank-style cards were primary here |

---

## 4. Receivables — `app/kpi/receivables.tsx`

| | |
|--|--|
| **Status** | 🟡 Partial |
| **Designed UI** | Filter chips (All / Overdue / Receipts) + aging carousel + tabs **Recent Outstandings / Overdue Parties** with richer party rows |
| **After cleanup** | Aging carousel (live) + tabs **Parties / Bills** — simpler rows |
| **Tally provides** | Debtor ledgers + `bill_outstanding` (bill name, dates, pending) + aging buckets from API |
| **Restore plan** | Reintroduce overdue-focused tab chrome / filter chips if product wants parity; keep live aging + bills |
| **Optional** | Call / WhatsApp actions only if mobile on ledger exists |

---

## 5. Payables — `app/kpi/payables.tsx`

| | |
|--|--|
| **Status** | 🟡 Partial |
| **Same pattern as Receivables** | Aging carousel kept; creditor/party UX simplified vs mock design |
| **Tally provides** | Sundry creditors + bill outstanding |
| **Restore plan** | Mirror Receivables restore once AR chrome is agreed |

---

## 6. Cash Register — `app/kpi/cash-register.tsx`

| | |
|--|--|
| **Status** | 🟢 OK / minor |
| **Change** | Small live wiring tweak in same commit |
| **Action** | Spot-check only |

---

## 7. Sales Hub — `app/sales/index.tsx`

| | |
|--|--|
| **Status** | 🟢 OK |
| **Designed UI** | Metric carousel + sticky banner carousel |
| **After cleanup** | Live home-metrics; carousels **kept** |
| **Action** | No restore needed for shell; verify metric labels match Tally |

---

## 8. Sales / Purchase Register — `app/sales/register.tsx`, `app/purchase/register.tsx`

| | |
|--|--|
| **Status** | 🟢 OK (data) |
| **Change** | Removed `MONTH_GROUPS` mock fallback; month accordion from live invoices |
| **Action** | Confirm empty-state copy; UI shell was already live-oriented |

---

## 9. Bank Feeds (Settings) — `app/settings/bank-feeds.tsx`

| | |
|--|--|
| **Status** | 🟡 Partial (data gap, UI shell kept) |
| **Designed UI** | Gradient `BankCard`s, swipe-to-edit, A/c + IFSC + branch form — **still present** |
| **After cleanup** | Dropped `MOCK_ACCOUNTS`; loads `getBankLedgers` → maps **ledger name only**, leaves `accountNumber`/`ifsc`/`branch` **empty** |
| **Tally provides** | Bank ledger **names** (and balances elsewhere) |
| **Does not provide** | A/c number / IFSC unless user enters them in this screen (or future sync field) |
| **Fix** | Persist user-entered Bank Feed metadata and join to KPI Bank Balance cards; don’t show fake A/c |

---

## 10. Deleted mock modules

| File | Note |
|------|------|
| `src/data/mockData.ts` | Deleted — do not restore wholesale |
| `src/data/mockDocuments.ts` | Deleted — do not restore wholesale |

Prefer restoring **UI components** + API fields, not mock datasets.

---

## Recommended fix order (screen by screen)

1. ✅ **Bank Balance** — gradient carousel + live name/balance/parent/last txn  
2. 🔴 **Loans & ODs** — same card pattern; Tally fields only first  
3. 🟡 **Bank Feeds** — persist A/c+IFSC; feed KPI enrichment  
4. 🟡 **Receivables / Payables** — restore filter/tab chrome if desired  
5. 🟡 **Cash in Hand** — polish pass  
6. Spot-check Sales / registers  

---

## Field availability cheat sheet

| UI label (designed) | Source | Available from Tally sync? |
|---------------------|--------|----------------------------|
| Ledger / bank name | `ledgers.name` | Yes |
| Closing balance | `ledgers.closing_balance` | Yes |
| Parent / group | `ledgers.parent` | Yes |
| Voucher list | `vouchers` + `voucher_ledger_entries` | Yes |
| Aging buckets | `bill_outstanding` | Yes |
| A/c number / IFSC | Bank Feeds user input (or future) | No (unless saved in app) |
| Last bank feed time | Bank aggregator | No |
| Loan rate / EMI / maturity | Banking / schedule product | No |
| OD limit / utilisation series | Bank / custom | No (balance only today) |

---

## How to verify each restore

1. Company with real bank/loan ledgers (e.g. Yash Ki Company).  
2. Screen shows **designed chrome** (gradients/swipe/dots where applicable).  
3. Numbers match Tally / API — no mock strings.  
4. Missing optional fields show “—” / omit — never fake HDFC CA-1234 style data.
