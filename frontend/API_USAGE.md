# API_USAGE.md — tallydekho-mobile-V4

Source: `src/services/api.ts`
Base: `EXPO_PUBLIC_BACKEND_URL` (default: http://192.168.29.243:3001)
Prefix: `/api/*` for most calls, `/tally/*` for write-back, `/app/*` for legacy

## Auth Header
Token from AsyncStorage `auth_token` → `Authorization: Bearer <token>`

## Access Token Renewal
Access tokens expire after 15 minutes. On a 401, `request()` calls
`tryRefreshSession()` once — `POST /api/auth/refresh` with the SecureStore
refresh token — and replays the original request. Concurrent 401s share the one
in-flight refresh. Sign-out happens only when the refresh is rejected; a 403 or
RBAC denial never signs the user out.

## Company + FY Pattern
```ts
withCompany('/endpoint', company?.guid, { fy: fyInfoToParam(selectedFY) })
// Produces: /endpoint?companyGuid=<guid>&fy=2025-2026
```

## Request Functions
```ts
get('/endpoint')          // GET /api/endpoint
post('/endpoint', body)   // POST /api/endpoint
patch('/endpoint', body)  // PATCH /api/endpoint
del('/endpoint')          // DELETE /api/endpoint
tallyGet('/endpoint')     // GET /tally/endpoint
tallyPost('/endpoint', b) // POST /tally/endpoint
appPost('/endpoint', b)   // POST /app/endpoint
```

## Auth Endpoints
| Function | HTTP | Path |
|----------|------|------|
| sendOTP | POST | /api/auth/send-otp |
| verifyOTP | POST | /api/auth/verify-otp |
| _(internal)_ tryRefreshSession | POST | /api/auth/refresh |
| verifyPin | POST | /api/auth/verify-pin |
| setPin | POST | /api/auth/set-pin |
| resetPin | POST | /api/auth/reset-pin |
| removePin | DELETE | /api/auth/remove-pin |
| setBiometric | PATCH | /api/auth/set-biometric |
| getMe | GET | /api/auth/me |
| logout | POST | /api/auth/logout |
| register | POST | /api/auth/register |

## Pairing / Sync
| Function | Path |
|----------|------|
| pairDevice | POST /api/tally-sync/pair |
| getSyncStatus | GET /api/tally-sync/status |
| unpairDevice | POST /api/tally-sync/unpair |
| getCompanyYears | GET /api/company/years |
| getCompanies | GET /api/companies |

## Dashboard
| Function | Path |
|----------|------|
| getKPIStrip | GET /api/dashboard/kpi-strip |
| getDashboardMetrics | GET /api/dashboard/metrics |
| getCashflow | GET /api/dashboard/cashflow |
| getRecentActivity | GET /api/dashboard/recent-activity |

## KPI Drill-downs
getKPICashInHand, getKPIBankBalance, getKPIReceivables, getKPIPayables,
getKPIPayments, getKPIReceipts, getKPILoansODs
All: GET /api/kpi/<type> + ?companyGuid&fy

## Sales / Purchase
getSalesInvoices, getSalesVouchers, getSalesVoucherCounts, getSalesOrders, getCreditNotes,
getDeliveryNotes, getPurchaseInvoices, getPurchaseVouchers, getPurchaseVoucherCounts,
getPurchaseOrders, getDebitNotes
All: GET /api/sales/* or /api/purchase/* + ?companyGuid&fy

Register filters (Ledger-style sheet; homes use invoices-only Recent):
- `getSalesVouchers(companyGuid, { docTypes, partyGroups?, from, to, limit, page })` — `GET /api/sales/vouchers` (multi docTypes + optional party ledger parents)
- `getSalesVoucherCounts(companyGuid, { from, to })` — `GET /api/sales/vouchers/counts` → `{ invoice, order, …, all, partyGroups:[{name,count}] }`
- `getPurchaseVouchers` / `getPurchaseVoucherCounts` — same for Purchase (`invoice|order|debit_note` + partyGroups)
- `getExpenses(companyGuid, { types?: 'Direct,Indirect', categories?: comma parents, type?, category?, from, to, limit })` — multi type/category; legacy `type`/`category` still work
- `getExpenseCounts(companyGuid, { from, to })` — `GET /api/expenses/counts` → `{ all, direct, indirect, categories:[{name,count}] }`

Credit Note Sales Return:
- `getSalesInvoices(companyGuid, { partyName, from, to, limit })` — all Sales invoices for the selected party and FY
- `getSalesInvoiceCreditNoteContext(invoiceId, companyGuid)` — `GET /api/sales/invoices/:id/credit-note-context?companyGuid=...`; returns original invoice lines plus cumulative returned/remaining quantities, original Sales ledger/godown, and tax context
- `createCreditNote(payload)` — `POST /tally/voucher/credit-note` with camelCase voucher payload, selected return lines, taxes, `linked_invoice`, `original_entry_type`, and `numbering_policy`

Debit Note Purchase Return:
- `getPurchaseInvoices(companyGuid, { partyName, from, to, limit })` — Purchase invoices for selected vendor and FY
- `getPurchaseInvoiceDebitNoteContext(invoiceId, companyGuid)` — `GET /api/purchase/invoices/:id/debit-note-context?companyGuid=...`; remaining qty + Purchase ledger/tax context
- `getPurchaseLedgerAccounts(companyGuid)` — Purchase Accounts group
- `createDebitNote(payload)` — `POST /tally/voucher/debit-note` with `linked_invoice`, items (`purchaseLedger`), taxes, `numbering_policy`

Purchase Invoice (3-step create, `purchase/create-invoice.tsx`):
- `getPurchaseLedgerAccounts(companyGuid)` — `GET /api/purchase/ledger-accounts` — Purchase Accounts group ledgers only (now consumed by the create screen; wrapper pre-existed in `api.ts`)
- `getParties(companyGuid, { type: 'vendor' })` — `GET /api/parties?type=vendor` — server-side filters to `parent ILIKE '%Sundry Creditor%'`
- `createTallyParty({ ..., parent: 'Sundry Creditors' })` — "Add New Vendor" drawer
- `createPurchaseInvoice(payload)` — `POST /tally/voucher/purchase` with `voucherType: 'Purchase'`, `items`, `taxes`, `logistics`, `make_payment`, `isOptional`/`original_entry_type`, `numbering_policy`

## Vouchers
getVouchers, getMyEntries, getVoucherById, retryVoucherEntry
Write: POST /tally/* (via tallyPost)

## Ledgers
getLedgers, getLedgerById, getLedgerStatement, getLedgerFYBalances
All: GET /api/ledgers/* + ?companyGuid&fy

## Stocks
getStockItems, getStockItemById, getStockItemMovements, getStockItemGodowns,
getStockUnits, getStockGroups, getWarehouses, getWarehouseById
createStockAdjustment, createStockTransfer, createStockItem, createWarehouse

## Reports
getFinancialReport, getPLBS, getGSTReport, getGSTSummary, getGSTDetail,
getEWayBills, getEWBStatus, getEInvoiceStatus, getOtherTaxes,
getAuditTrail, getDaybook, getExpenses, getSyncHistory

## AI Insights
getAIInsights, getAIInsightsHistory — GET /api/ai/insights + ?companyGuid&fy

## Settings
getUserSettings, updateUserSettings, getNotificationSettings, updateNotificationSettings,
getAlertSettings, updateAlertSettings, getIntegrationSettings, updateIntegrationSettings
sendPaymentReminder — POST /api/reminders/send

## Workspace approvals (Owner/Admin)
getWorkspaceApprovals(workspaceId) — GET /api/workspaces/:id/approvals
approveHardSyncRequest(id) — POST /api/hard-sync-requests/:id/approve
rejectHardSyncRequest(id) — POST /api/hard-sync-requests/:id/reject
approveWorkspaceRestoreByCode({ code, backupId }) — POST /api/workspace/restore/approve
rejectRestoreSession(id) — POST /api/restore-sessions/:id/reject

## Strict Rule
No mock/fallback data. If API fails → throw error → caller shows ErrorView.
Never substitute mock data for failed API responses.
