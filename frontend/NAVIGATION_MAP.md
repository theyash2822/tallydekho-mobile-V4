# NAVIGATION_MAP.md — tallydekho-mobile-V4

## Root Layout: app/_layout.tsx
Wraps entire app in: AuthProvider → SettingsProvider → GestureHandlerRootView → SafeAreaProvider
Auth guard redirects: unauthenticated → (auth)/index, authenticated → (tabs)

## Auth Stack: app/(auth)/
| File | Screen | Notes |
|------|--------|-------|
| index.tsx | Phone number entry | |
| otp.tsx | OTP verification | |
| register.tsx | Name registration | New user |
| verify-pin.tsx | 2FA PIN entry | If PIN enabled |
| reset-pin.tsx | Reset PIN | |
| tally-sync.tsx | Pairing setup | Enter pairing code |
| terms.tsx | Terms of service | |

## Main Tabs: app/(tabs)/
| File | Tab | Notes |
|------|-----|-------|
| index.tsx | Home/Dashboard | KPI strip + recent activity |
| ledger.tsx | Ledger | Ledger list |
| stocks.tsx | Stocks | Total stock view |
| reports.tsx | Reports | Report categories |

## Stack Screens (pushed from tabs)

### Dashboard stacks
| File | Screen |
|------|--------|
| app/kpi/bank-balance.tsx | Bank Balance detail |
| app/kpi/cash-in-hand.tsx | Cash in Hand detail |
| app/kpi/cash-register.tsx | Cash Register |
| app/kpi/loans-ods.tsx | Loans & ODs |
| app/kpi/payables.tsx | Payables |
| app/kpi/payments.tsx | Payments |
| app/kpi/receipts.tsx | Receipts |
| app/kpi/receivables.tsx | Receivables |
| app/notifications.tsx | Notifications |
| app/sales-register.tsx | Sales register |

### Sales: app/sales/
| File | Screen |
|------|--------|
| index.tsx | Sales list |
| register.tsx | Sales register |
| create-invoice.tsx | Create sales invoice |
| create-order.tsx | Create sales order |
| create-credit-note.tsx | Create credit note |
| create-delivery-note.tsx | Create delivery note |
| credit-note.tsx | Credit note list |
| delivery-note.tsx | Delivery note list |
| ewaybill.tsx | E-Way Bill |
| order.tsx | Order list |

### Purchase: app/purchase/
| File | Screen |
|------|--------|
| index.tsx | Purchase list |
| register.tsx | Purchase register |
| create-invoice.tsx | Create purchase invoice |
| create-order.tsx | Create purchase order |
| create-debit-note.tsx | Create debit note |
| debit-note.tsx | Debit note list |
| order.tsx | Order list |

### Vouchers: app/voucher/
| File | Screen |
|------|--------|
| index.tsx | Voucher list |
| create.tsx | Create voucher |
| create-payment.tsx | Create payment |
| create-receipt.tsx | Create receipt |
| create-journal.tsx | Create journal |
| create-contra.tsx | Create contra |
| payment.tsx | Payment list |
| receipt.tsx | Receipt list |
| journal.tsx | Journal list |
| contra.tsx | Contra list |
| preview.tsx | Voucher preview / PDF |

### Ledger: app/ledger/
| File | Screen |
|------|--------|
| [id].tsx | Ledger detail + statement |
| create.tsx | Create new ledger |

### Stocks: app/stocks/
| File | Screen |
|------|--------|
| total-stock.tsx | Total stock overview |
| item-detail.tsx | Stock item detail |
| create-item.tsx | Create new item |
| create-adjustment.tsx | Stock adjustment |
| create-transfer.tsx | Stock transfer |
| create-warehouse.tsx | Create warehouse |
| warehouses.tsx | Warehouse list |
| warehouse-detail.tsx | Warehouse detail |
| stock-ledger.tsx | Stock ledger |
| stock-snapshot.tsx | Stock snapshot |
| on-hand-stock.tsx | On-hand stock |
| negative-stock.tsx | Negative stock |
| aged-items.tsx | Aged items |
| fast-slow.tsx | Fast/slow moving |
| reorder-queue.tsx | Reorder queue |
| movement-analytics.tsx | Movement analytics |
| valuation-summary.tsx | Valuation summary |
| expiry-schedule.tsx | Expiry schedule |
| barcodes.tsx | Barcode list |
| print-barcodes.tsx | Print barcodes |
| label-preview.tsx | Label preview |
| print-settings.tsx | Print settings |
| transfer-history.tsx | Transfer history |
| transfer-details.tsx | Transfer detail |
| reports.tsx | Stock reports menu |
| settings.tsx | Stock settings |

### Reports: app/reports/
| File | Screen |
|------|--------|
| financial.tsx | P&L + Balance Sheet |
| gst.tsx | GST report |
| compliance.tsx | Compliance overview |
| audit-trail.tsx | Audit trail |
| ai-insights.tsx | AI Insights |
| einvoice-compliance.tsx | E-Invoice compliance |
| einvoice-list.tsx | E-Invoice list |
| ewb-compliance.tsx | E-Way Bill compliance |
| ewb-list.tsx | E-Way Bill list |
| other-taxes.tsx | Other taxes |
| other-taxes-register.tsx | Tax register |
| unmatched-list.tsx | Unmatched GST |

### Expenses: app/expenses/
| File | Screen |
|------|--------|
| index.tsx | Expense list |
| register.tsx | Expense register |

### Daybook: app/daybook/
| File | Screen |
|------|--------|
| (index via _layout) | Daily voucher log |

### Settings: app/settings/
| File | Screen |
|------|--------|
| index.tsx | Settings home |
| profile.tsx | User profile |
| company.tsx | Company info |
| tally-sync.tsx | Tally sync settings |
| payment-reminders.tsx | Payment reminders |
| bank-feeds.tsx | Bank feeds |
| security.tsx | Security / PIN / Biometric |
| preferences.tsx | App preferences |
| currency.tsx | Currency settings |
| language.tsx | Language settings |
| notification-channels.tsx | Notification channels |
| compliance-reminders.tsx | Compliance reminders |
| stock-alerts.tsx | Stock alerts |
| voucher-config.tsx | Voucher config |
| einvoice.tsx | E-Invoice settings |
| ewb.tsx | E-Way Bill settings |
| barcodes.tsx | Barcode settings |
| license.tsx | License info |
| about.tsx | About screen |
| help.tsx | Help / FAQ |

### Document: app/document/
- [id].tsx — Shared document viewer / PDF preview

## src/components/ (Shared)
- ApiStateViews.tsx — LoadingView, ErrorView, EmptyView
- Header.tsx — Top header with company + FY switcher
- FilterBottomSheet.tsx — Filter panel
- DateRangePickerModal.tsx — Date range picker
- QuickActionsModal.tsx — Quick actions FAB menu
- PairingBanner.tsx — "Not paired" banner
- OfflineBadge.tsx — Offline indicator
- CashflowCard.tsx — Cashflow chart card
- RecentActivity.tsx — Recent transactions widget
- ShimmerPlaceholder.tsx — Loading skeleton
- Skeleton.tsx — Skeleton component
- document/ — PDF/document view components
- forms/ — Shared form components
