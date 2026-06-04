# API_USAGE.md — tallydekho-mobile-V4

Source: `src/services/api.ts`
Base: `EXPO_PUBLIC_BACKEND_URL` (default: http://192.168.29.243:3001)
Prefix: `/api/*` for most calls, `/tally/*` for write-back, `/app/*` for legacy

## Auth Header
Token from AsyncStorage `auth_token` → `Authorization: Bearer <token>`

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
getSalesInvoices, getSalesOrders, getSalesQuotations, getSalesCreditNotes,
getSalesDeliveryNotes, getPurchaseInvoices, getPurchaseOrders, getPurchaseDebitNotes
All: GET /api/sales/* or /api/purchase/* + ?companyGuid&fy

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

## Strict Rule
No mock/fallback data. If API fails → throw error → caller shows ErrorView.
Never substitute mock data for failed API responses.
