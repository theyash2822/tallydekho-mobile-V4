# TallyDekho Frontend — PRD & Architecture

## Project Overview
React Native (Expo) mobile accounting app replicating TallyDekho's Figma design.
Color scheme updated to warm cream/dark palette. Mock data fallback architecture implemented.

## Architecture
- **Framework**: Expo (SDK 54) with Expo Router v6 (file-based routing)
- **State**: React Context (AuthContext) for auth state management
- **Data Pattern**: Single mockData.ts → api.ts with fetchWithFallback → auto uses API when available
- **Navigation**: expo-router with (auth) and (tabs) route groups

## Color Palette (User Specified)
- Page bg: #F5F4EF | Card bg: #FFFFFF | Brand Primary: #1A1A1A
- Positive: #2D7D46 | Negative: #C0392B | Warning: #D97706
- Nav bg: #1A1A1A | Nav text: #F5F4EF | Inactive nav: #9A9A97

## Phase 1 — Implemented (April 2026)

### Auth Flow
- Login screen (WhatsApp +91 OTP)
- OTP Verification (6-box, auto-advance, countdown resend)
- Registration (name, language, terms acceptance)
- Tally Sync onboarding (pair key or skip)

### Main App
- Home Dashboard (KPI strip, time filters, metrics, cashflow SVG ring, recent activity)
- Quick Actions Modal (Sales/Purchase/Voucher/Inventory/Ledgers accordion)
- Stocks Tab (total value, SKUs, warehouses, item list with status badges)
- Ledger Tab (list with Debit/Credit chips, search, filter)
- Reports Tab (Financial/Compliance/Audit/AI sections)

### Infrastructure
- `/src/constants/colors.ts` — color/typography/spacing constants
- `/src/data/mockData.ts` — ALL static mock data in one file
- `/src/services/api.ts` — fetchWithFallback pattern
- `/src/context/AuthContext.tsx` — auth state management
- `/src/components/` — Header, QuickActionsModal, CashflowCard, RecentActivity

## Phase 2 Backlog (Pending)

### P0 (Critical for user)
- [ ] Create Sales Invoice (5-step form: Party → Products → Taxes → Logistics → Submit)
- [ ] Create Purchase Invoice
- [ ] Create Sales Order / Purchase Order
- [ ] Notifications screen

### P1 (Important)
- [ ] Create Quotation, Credit Note, Debit Note, Delivery Note
- [ ] Create Vouchers (Payment, Receipt, Journal, Contra)
- [ ] Ledger Creation modal
- [ ] Ledger Detail screen

### P2 (Nice to have)
- [ ] Reports detail screens (P&L, Balance Sheet, GST)
- [ ] Stock Transfer, Add Item, Bulk Transfer forms
- [ ] E-way Bill detail
- [ ] AI Insights screen
- [ ] Settings screen (Account, Preferences, Notifications, Integrations)

## API Endpoints Expected (Backend)
- POST /api/auth/send-otp
- POST /api/auth/verify-otp
- POST /api/auth/register
- GET /api/dashboard/kpi-strip
- GET /api/dashboard/metrics?period=7D
- GET /api/dashboard/cashflow
- GET /api/dashboard/recent-activity
- GET /api/stocks
- GET /api/ledgers
- GET /api/reports
- GET /api/notifications

## Document References (15 docs analyzed)
1. Home Dashboard | 2. Sales Invoice | 3. Sales Order | 4. Purchase Invoice
5. Purchase Order | 6. Quotation | 7. Credit Note | 8. Debit Note
9. Delivery Note | 10. E-way Bills | 11. Stock Management | 12. Voucher Creation
13. Ledgers | 14. Reports | 15. Settings

## Source of Truth
Figma: https://www.figma.com/design/IuL8VXs5mkcyKQIYH8sBCi/Ashish---TallyDekho--Accounting-APP-
PDF Export: 199 screens analyzed from customer PDF export
