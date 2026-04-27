# TallyDekho — Complete Backend API Specification

> **Version:** 1.0.0 | **Base URL:** `/api` | **Auth:** JWT Bearer Token (every protected endpoint)
> **Database:** PostgreSQL | **Conventions:** snake_case fields, ISO 8601 dates, INR amounts as integers (paise)

---

## Table of Contents

1. [Global Conventions](#1-global-conventions)
2. [Auth & User Management](#2-auth--user-management)
3. [Companies](#3-companies)
4. [Dashboard](#4-dashboard)
5. [Ledger Management](#5-ledger-management)
6. [Sales — Invoices](#6-sales--invoices)
7. [Sales — Orders, Quotations, Credit Notes, Delivery Notes](#7-sales--orders-quotations-credit-notes-delivery-notes)
8. [Purchase — Invoices, Orders, Debit Notes](#8-purchase--invoices-orders-debit-notes)
9. [Vouchers (Payment / Receipt / Journal / Contra)](#9-vouchers)
10. [Stocks & Inventory](#10-stocks--inventory)
11. [KPI Detail Views](#11-kpi-detail-views)
12. [Reports & Analytics](#12-reports--analytics)
13. [Notifications](#13-notifications)
14. [Settings](#14-settings)
15. [Tally Sync](#15-tally-sync)
16. [Expenses](#16-expenses)
17. [Database Schema (PostgreSQL)](#17-database-schema-postgresql)

---

## 1. Global Conventions

### Authentication Header (all protected routes)
```
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
X-Company-ID: <company_id>
```

### Standard Pagination Query Params
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Records per page (max 100) |
| `sort` | string | `created_at` | Sort field |
| `order` | string | `desc` | `asc` or `desc` |

### Standard Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 145,
    "total_pages": 8
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": [
      { "field": "gstin", "message": "Invalid GSTIN format" }
    ]
  }
}
```

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (invalid/expired JWT) |
| 403 | Forbidden (insufficient role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

---

## 2. Auth & User Management

### 2.1 Send OTP
**POST** `/api/auth/send-otp`

**Request Body**
```json
{
  "phone": "+919876543210"
}
```

**Validation**
- `phone`: required, Indian mobile format `+91XXXXXXXXXX`, exactly 13 chars

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent via WhatsApp",
    "expires_in": 300,
    "masked_phone": "+91 98**** *210"
  }
}
```

**Error Responses**
- `400` — Invalid phone format
- `429` — Too many OTP requests (rate limit: 3 per 10 min)

---

### 2.2 Verify OTP
**POST** `/api/auth/verify-otp`

**Request Body**
```json
{
  "phone": "+919876543210",
  "otp": "1234"
}
```

**Validation**
- `otp`: required, exactly 4 digits, numeric string

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "is_new_user": true,
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600,
    "user": null
  }
}
```

**Edge Cases**
- OTP expired → `400` with code `OTP_EXPIRED`
- Wrong OTP → `400` with code `OTP_INVALID` (max 5 attempts, then lockout for 15 min)

---

### 2.3 Register User
**POST** `/api/auth/register`

**Request Body**
```json
{
  "name": "Ashish Agarwal",
  "phone": "+919876543210",
  "language": "en",
  "accept_terms": true
}
```

**Validation**
- `name`: required, 2–80 chars
- `language`: required, enum `["en", "hi", "gu", "mr", "ta", "te"]`
- `accept_terms`: must be `true`

**Success Response (201)**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_01HXYZ",
      "name": "Ashish Agarwal",
      "phone": "+919876543210",
      "language": "en",
      "created_at": "2025-06-01T10:00:00Z"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### 2.4 Refresh Token
**POST** `/api/auth/refresh`

**Request Body**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

---

### 2.5 Logout
**POST** `/api/auth/logout` 🔒

**Request Body**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200)**
```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

---

### 2.6 Get My Profile
**GET** `/api/auth/me` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "usr_01HXYZ",
    "name": "Ashish Agarwal",
    "phone": "+919876543210",
    "email": "ashish@ykind.com",
    "language": "en",
    "role": "admin",
    "biometric_enabled": true,
    "two_fa_enabled": false,
    "active_company_id": "cmp_01ABC",
    "created_at": "2025-06-01T10:00:00Z"
  }
}
```

---

### 2.7 Update Profile
**PATCH** `/api/auth/me` 🔒

**Request Body**
```json
{
  "name": "Ashish Agarwal",
  "email": "newemail@ykind.com",
  "language": "hi",
  "biometric_enabled": true
}
```

**Validation**
- `email`: optional, valid email format
- `language`: optional, enum as above
- All fields optional (partial update)

---

## 3. Companies

### 3.1 List My Companies
**GET** `/api/companies` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmp_01ABC",
      "name": "YK Industries Pvt. Ltd.",
      "gstin": "27ABCDE1234F1Z5",
      "pan": "ABCDE1234F",
      "active": true,
      "logo_url": "https://cdn.tallydekho.com/logos/cmp_01ABC.png",
      "fy_start_month": "April",
      "created_at": "2024-04-01T00:00:00Z"
    }
  ]
}
```

---

### 3.2 Get Company Details
**GET** `/api/companies/:id` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "cmp_01ABC",
    "name": "YK Industries Pvt. Ltd.",
    "gstin": "27ABCDE1234F1Z5",
    "pan": "ABCDE1234F",
    "address": "B-42, Andheri Industrial Area, Mumbai - 400069",
    "email": "finance@ykind.com",
    "phone": "+912244217890",
    "website": "www.ykind.com",
    "fy_start_month": "April",
    "book_lock_enabled": true,
    "book_lock_days": 30,
    "logo_url": null,
    "state": "Maharashtra",
    "country": "India"
  }
}
```

---

### 3.3 Update Company
**PUT** `/api/companies/:id` 🔒

**Request Body**
```json
{
  "name": "YK Industries Pvt. Ltd.",
  "gstin": "27ABCDE1234F1Z5",
  "pan": "ABCDE1234F",
  "address": "B-42, Andheri Industrial Area, Mumbai - 400069",
  "email": "finance@ykind.com",
  "phone": "+912244217890",
  "website": "www.ykind.com",
  "fy_start_month": "April",
  "book_lock_enabled": true,
  "book_lock_days": 30
}
```

**Validation**
- `gstin`: 15-char alphanumeric regex `[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}`
- `pan`: 10-char alphanumeric regex `[A-Z]{5}[0-9]{4}[A-Z]{1}`
- `fy_start_month`: enum of 12 months
- `book_lock_days`: int 1–365 when `book_lock_enabled` is true

---

### 3.4 Upload Company Logo
**POST** `/api/companies/:id/logo` 🔒

**Content-Type:** `multipart/form-data`

**Form Data**
- `logo`: File (JPEG/PNG/GIF, max 500 KB)

**Success Response (200)**
```json
{
  "success": true,
  "data": { "logo_url": "https://cdn.tallydekho.com/logos/cmp_01ABC.png" }
}
```

**Error**
- `400` — File too large or unsupported format

---

### 3.5 Switch Active Company
**POST** `/api/companies/:id/switch` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "message": "Switched to YK Industries Pvt. Ltd.",
    "active_company_id": "cmp_01ABC"
  }
}
```

---

## 4. Dashboard

### 4.1 KPI Strip
**GET** `/api/dashboard/kpi-strip` 🔒

**Query Params**
| Param | Values |
|-------|--------|
| `period` | `7D`, `1M`, `3M`, `6M` (default: `7D`) |

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "cash",
      "label": "Cash In Hand",
      "amount": "₹24,500",
      "amount_raw": 2450000,
      "icon": "wallet-outline",
      "trend": "+8.6%",
      "positive": true,
      "route": "/kpi/cash-in-hand"
    }
  ]
}
```

---

### 4.2 Dashboard Metrics
**GET** `/api/dashboard/metrics` 🔒

**Query Params:** `period` (same as 4.1)

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "sales",
      "label": "Sales",
      "icon": "trending-up",
      "amount": "₹1.23L",
      "amount_raw": 123000,
      "change": 12.0,
      "positive": true,
      "route": "/sales"
    }
  ]
}
```

---

### 4.3 Cashflow Summary
**GET** `/api/dashboard/cashflow` 🔒

**Query Params:** `period` (same as 4.1)

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "net_cash": 8500,
    "gross_cash": 12300.00,
    "net_realisable_balance": 8100,
    "gross_profit": 18400,
    "net_profit": 6200,
    "income_percentage": 76,
    "total_income": 12300,
    "total_expense": 3800,
    "updated_at": "5 mins. ago"
  }
}
```

---

### 4.4 Recent Activity Feed
**GET** `/api/dashboard/recent-activity` 🔒

**Query Params:** `limit` (default: 10)

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "act_001",
      "type": "credit",
      "label": "Sales Invoice #INV-2847",
      "amount": "+₹18,400",
      "amount_raw": 1840000,
      "date": "Today, 3:45 PM",
      "party": "Mehta Enterprises",
      "document_id": "inv_01XYZ",
      "route": "/document/inv_01XYZ"
    }
  ]
}
```

---

### 4.5 Global Search
**GET** `/api/dashboard/search` 🔒

**Query Params**
| Param | Type | Required |
|-------|------|----------|
| `q` | string | Yes (min 2 chars) |
| `types` | string | No — comma-sep: `invoice,ledger,voucher,stock` |

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "invoices": [ { "id": "INV-2847", "party": "Mehta Enterprises", "amount": "₹18,400" } ],
    "ledgers":  [ { "id": "LED002", "name": "Raj Enterprises", "balance": "₹12,500" } ],
    "stocks":   [ { "id": "SI01", "name": "Black JBL Speaker", "sku": "PRD-1002-ABC" } ]
  }
}
```

---

## 5. Ledger Management

### 5.1 List Ledgers
**GET** `/api/ledgers` 🔒

**Query Params**
| Param | Type | Description |
|-------|------|-------------|
| `group` | string | Filter by group (e.g., `Sundry Debtor`) |
| `nature` | string | `Assets`, `Liabilities`, `Income`, `Expense` |
| `search` | string | Name search |
| `page` | int | Pagination |
| `limit` | int | Pagination |

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "LED001",
      "name": "Indian Export House",
      "group": "Sundry Creditor",
      "balance": "₹34,000",
      "balance_raw": 3400000,
      "type": "credit",
      "nature": "Liabilities",
      "phone": "9876543210",
      "last_updated": "2025-08-28"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 85, "total_pages": 5 }
}
```

---

### 5.2 Get Ledger Detail + Transactions
**GET** `/api/ledgers/:id` 🔒

**Query Params**
| Param | Type | Description |
|-------|------|-------------|
| `from` | date | Filter start date `YYYY-MM-DD` |
| `to` | date | Filter end date |
| `page` | int | Transactions page |
| `limit` | int | Transactions per page |

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "ledger": {
      "id": "LED002",
      "name": "Raj Enterprises",
      "group": "Sundry Debtor",
      "opening_balance": 1000000,
      "closing_balance": 1250000,
      "gstin": "27ABCDE1234F1Z5",
      "pan": "ABCDE1234F",
      "phone": "9845012345",
      "email": "raj@enterprises.com",
      "credit_days": 30,
      "mailing_address": {
        "name": "Raj Enterprises",
        "address": "123 MG Road",
        "state": "Maharashtra",
        "pincode": "400001",
        "country": "India"
      },
      "bank_details": {
        "beneficiary_name": "Raj Enterprises",
        "bank_name": "HDFC Bank",
        "account_no": "1234567890",
        "ifsc": "HDFC0001234",
        "branch": "Andheri"
      }
    },
    "transactions": [
      {
        "id": "txn_001",
        "date": "2025-08-28",
        "voucher_type": "Sales Invoice",
        "voucher_no": "INV-2847",
        "narration": "Sale of electronics",
        "debit": 1840000,
        "credit": 0,
        "balance": 1250000,
        "document_id": "inv_01XYZ"
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 48, "total_pages": 3 }
  }
}
```

---

### 5.3 Create Ledger ➕ (from + button)
**POST** `/api/ledgers` 🔒

**Request Body**
```json
{
  "name": "Kumar & Sons",
  "type": "sundry_debtor",
  "group": "Sundry Debtors",
  "opening_balance": 0,
  "opening_balance_type": "Dr",
  "credit_days": 30,
  "gst_registration_type": "Regular",
  "gstin": "27ABCDE1234F1Z5",
  "pan": "ABCDE1234F",
  "mailing": {
    "enabled": true,
    "name": "Kumar & Sons",
    "address": "456 Park Street, Pune",
    "state": "Maharashtra",
    "pincode": "411001",
    "country": "India"
  },
  "bank": {
    "enabled": true,
    "beneficiary_name": "Kumar & Sons",
    "bank_name": "SBI",
    "account_no": "9876543210",
    "ifsc": "SBIN0001234",
    "branch": "Pune Main"
  },
  "duty_type": null,
  "duty_percentage": null
}
```

**Validation**
- `name`: required, 2–100 chars, unique per company
- `type`: enum `sundry_creditor | sundry_debtor | duties_taxes | custom`
- `group`: required (from Tally standard groups or custom)
- `gstin`: optional, valid 15-char format when provided
- `pan`: optional, valid 10-char format
- `duty_type`: required if `type=duties_taxes`, enum `CGST|SGST|IGST|Cess|Others`
- `duty_percentage`: required if `type=duties_taxes`, 0–100 decimal

**Success Response (201)**
```json
{
  "success": true,
  "data": {
    "id": "LED013",
    "name": "Kumar & Sons",
    "group": "Sundry Debtors",
    "balance": "₹0",
    "created_at": "2025-06-01T10:00:00Z"
  }
}
```

**Error Responses**
- `409` — Ledger name already exists in company
- `400` — Invalid GSTIN format

---

### 5.4 Update Ledger
**PUT** `/api/ledgers/:id` 🔒

Same body as Create, all fields optional for partial updates.

---

### 5.5 Delete Ledger
**DELETE** `/api/ledgers/:id` 🔒

**Validation / Edge Cases**
- Cannot delete if ledger has any transactions (returns `409`)
- System ledgers (Cash, Bank) cannot be deleted (returns `403`)

---

### 5.6 Ledger Statement PDF
**GET** `/api/ledgers/:id/statement` 🔒

**Query Params:** `from`, `to` (date range required)

**Response:** `application/pdf` file download

---

## 6. Sales — Invoices

### 6.1 List Sales Invoices
**GET** `/api/sales/invoices` 🔒

**Query Params**
| Param | Description |
|-------|-------------|
| `status` | `pending_irn`, `generated`, `paid`, `unpaid`, `partial` |
| `party_id` | Filter by ledger/party |
| `from` | Date filter |
| `to` | Date filter |
| `search` | Invoice no or party name |
| `page`, `limit` | Pagination |

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "inv_01XYZ",
        "invoice_no": "INV-2847",
        "party": "Mehta Enterprises",
        "party_id": "LED010",
        "date": "2025-04-17",
        "due_date": "2025-04-24",
        "amount": "₹18,400",
        "amount_raw": 1840000,
        "status": "pending_irn",
        "payment_status": "unpaid",
        "irn": null
      }
    ],
    "summary": {
      "total_docs": 14,
      "pending_irn_count": 9,
      "total_amount": 3240000
    }
  },
  "meta": { "page": 1, "limit": 20, "total": 14, "total_pages": 1 }
}
```

---

### 6.2 Get Invoice Detail
**GET** `/api/sales/invoices/:id` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "inv_01XYZ",
    "invoice_no": "INV-2847",
    "entry_type": "regular",
    "sales_ledger": "credit_sales",
    "sales_ledger_id": "LED008",
    "date": "2025-04-17",
    "due_date": "2025-04-24",
    "party": "Mehta Enterprises",
    "party_id": "LED010",
    "payment_terms": "30d",
    "reference_no": "PO-123",
    "items": [
      {
        "id": "item_001",
        "warehouse_id": "WH01",
        "product_id": "SI01",
        "product_name": "JBL Portable Speaker",
        "qty": 2,
        "unit": "pcs",
        "rate": 4200,
        "discount_type": "%",
        "discount": 5,
        "tax_rate": 18,
        "gross": 8400,
        "discount_amount": 420,
        "taxable": 7980,
        "cgst": 718.2,
        "sgst": 718.2,
        "subtotal": 9416.4
      }
    ],
    "logistics": [
      { "label": "Freight", "amount": 500, "tax_rate": 18 }
    ],
    "totals": {
      "subtotal": 8400,
      "discount": 420,
      "taxable": 7980,
      "cgst": 718.2,
      "sgst": 718.2,
      "igst": 0,
      "logistics": 590,
      "grand_total": 10006.4
    },
    "payment": {
      "collect_now": true,
      "mode": "neft",
      "amount_paid": 10006.4,
      "reference": "TXN123456",
      "status": "paid"
    },
    "narration": "Sale to Mehta Enterprises",
    "terms": "Goods once sold will not be taken back.",
    "irn": null,
    "ewb_no": null,
    "status": "pending_irn"
  }
}
```

---

### 6.3 Create Sales Invoice ➕ (from + button)
**POST** `/api/sales/invoices` 🔒

**Request Body**
```json
{
  "entry_type": "regular",
  "sales_ledger_id": "LED008",
  "date": "2025-06-01",
  "party_id": "LED010",
  "payment_terms": "30d",
  "payment_terms_days": null,
  "due_date": "2025-07-01",
  "reference_no": "PO-456",
  "items": [
    {
      "warehouse_id": "WH01",
      "product_id": "SI01",
      "qty": 2,
      "unit": "pcs",
      "rate": 4200,
      "discount_type": "%",
      "discount": 5,
      "tax_rate": 18
    }
  ],
  "logistics": [
    { "label": "Freight", "amount": 500, "tax_rate": 18 }
  ],
  "payment": {
    "collect_now": true,
    "mode": "neft",
    "amount_paid": 10006,
    "reference": "TXN123456"
  },
  "narration": "Sale to Mehta Enterprises",
  "terms": "Goods once sold will not be taken back.",
  "is_draft": false
}
```

**Validation**
- `date`: required, valid date, not locked (book lock check)
- `party_id`: required, must be valid ledger ID in company
- `items`: min 1 item required
- `items[].qty`: positive number
- `items[].rate`: positive number
- `items[].discount`: 0–100 for `%` type, 0–`rate*qty` for flat
- `items[].tax_rate`: enum `0|5|12|18|28`
- `payment.mode`: enum `cash|neft|rtgs|cheque|upi|imps` when `collect_now=true`
- `payment.amount_paid`: positive, max = grand_total

**Success Response (201)**
```json
{
  "success": true,
  "data": {
    "id": "inv_02ABC",
    "invoice_no": "INV-2848",
    "amount_raw": 1000640,
    "status": "pending_irn",
    "created_at": "2025-06-01T10:00:00Z"
  }
}
```

**Error Responses**
- `400` — Insufficient stock for item
- `400` — Book locked for this date
- `404` — Party or warehouse not found

---

### 6.4 Update Invoice
**PUT** `/api/sales/invoices/:id` 🔒

Same body as Create. Cannot update if IRN already generated.

---

### 6.5 Delete / Cancel Invoice
**DELETE** `/api/sales/invoices/:id` 🔒

**Edge Cases**
- Cannot delete if IRN generated → return `409` with `IRN_GENERATED`
- Cannot delete if payment applied → return `409`
- Creates reversal entry in ledger on delete

---

### 6.6 Generate IRN (E-Invoice)
**POST** `/api/sales/invoices/:id/generate-irn` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "irn": "a5c12d...hash...",
    "ack_no": "1122334455",
    "ack_date": "2025-06-01T10:00:00Z",
    "qr_code_url": "https://cdn.tallydekho.com/qr/irn_abc.png",
    "signed_invoice": "..."
  }
}
```

---

### 6.7 Bulk Generate IRN
**POST** `/api/sales/invoices/bulk-irn` 🔒

**Request Body**
```json
{ "invoice_ids": ["inv_01XYZ", "inv_02ABC"] }
```

---

## 7. Sales — Orders, Quotations, Credit Notes, Delivery Notes

> Pattern for all: `List / Get / Create / Update / Delete`
> Endpoints follow `/api/sales/{resource}` format

### 7.1 Sales Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/orders` | List with filters: `status` (`pending|confirmed|cancelled`), `party_id`, date range |
| GET | `/api/sales/orders/:id` | Full detail |
| POST | `/api/sales/orders` | Create ➕ |
| PUT | `/api/sales/orders/:id` | Update |
| DELETE | `/api/sales/orders/:id` | Cancel |
| POST | `/api/sales/orders/:id/convert-invoice` | Convert SO → Sales Invoice |

**Create Body** (same structure as Invoice minus `payment` and `irn` fields)
```json
{
  "date": "2025-06-01",
  "party_id": "LED010",
  "delivery_date": "2025-06-15",
  "items": [ { "product_id": "SI01", "qty": 5, "rate": 4200, "tax_rate": 18 } ],
  "narration": "Sales Order for June delivery",
  "is_draft": false
}
```

---

### 7.2 Quotations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/quotations` | List with `status` filter: `pending|accepted|expired` |
| GET | `/api/sales/quotations/:id` | Detail |
| POST | `/api/sales/quotations` | Create ➕ |
| PUT | `/api/sales/quotations/:id` | Update |
| DELETE | `/api/sales/quotations/:id` | Delete |
| POST | `/api/sales/quotations/:id/convert-order` | Convert to Sales Order |
| POST | `/api/sales/quotations/:id/convert-invoice` | Convert to Invoice |

**Create Body** (same structure as Sales Order + `validity_days` field)
```json
{
  "date": "2025-06-01",
  "party_id": "LED010",
  "validity_days": 15,
  "items": [ { "product_id": "SI01", "qty": 3, "rate": 4200, "tax_rate": 18 } ]
}
```

---

### 7.3 Credit Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/credit-notes` | List with `status` filter: `issued|settled` |
| GET | `/api/sales/credit-notes/:id` | Detail |
| POST | `/api/sales/credit-notes` | Create ➕ |
| PUT | `/api/sales/credit-notes/:id` | Update |
| DELETE | `/api/sales/credit-notes/:id` | Cancel |

**Create Body**
```json
{
  "date": "2025-06-01",
  "party_id": "LED010",
  "reference_invoice_id": "inv_01XYZ",
  "items": [
    { "product_id": "SI01", "qty": 1, "rate": 4200, "tax_rate": 18, "reason": "Damaged goods" }
  ],
  "narration": "Return due to damage"
}
```

---

### 7.4 Delivery Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/delivery-notes` | List with `status`: `pending|in_transit|delivered` |
| GET | `/api/sales/delivery-notes/:id` | Detail |
| POST | `/api/sales/delivery-notes` | Create ➕ |
| PUT | `/api/sales/delivery-notes/:id` | Update status |
| DELETE | `/api/sales/delivery-notes/:id` | Cancel |

**Create Body**
```json
{
  "date": "2025-06-01",
  "party_id": "LED010",
  "dispatch_through": "BlueDart",
  "lr_no": "LR123456",
  "items": [ { "product_id": "SI01", "qty": 2, "from_warehouse_id": "WH01" } ]
}
```

---

### 7.5 E-Way Bills

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales/ewaybills` | List with `status`: `generated|pending|cancelled` |
| GET | `/api/sales/ewaybills/:id` | Detail |
| POST | `/api/sales/ewaybills` | Generate EWB ➕ |
| POST | `/api/sales/ewaybills/:id/cancel` | Cancel EWB |
| POST | `/api/sales/ewaybills/:id/extend` | Extend validity |

**Create Body**
```json
{
  "invoice_id": "inv_01XYZ",
  "transporter_id": "12ABCDE1234F1Z5",
  "transporter_name": "BlueDart",
  "vehicle_no": "MH01AB1234",
  "vehicle_type": "Regular",
  "supply_type": "OutwardSupply",
  "sub_supply_type": "Supply",
  "distance_km": 450
}
```

---

## 8. Purchase — Invoices, Orders, Debit Notes

### 8.1 Purchase Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase/invoices` | List with `status`, `vendor_id`, date filters |
| GET | `/api/purchase/invoices/:id` | Detail |
| POST | `/api/purchase/invoices` | Create ➕ |
| PUT | `/api/purchase/invoices/:id` | Update |
| DELETE | `/api/purchase/invoices/:id` | Cancel |

**Create Body**
```json
{
  "date": "2025-06-01",
  "vendor_id": "LED001",
  "vendor_invoice_no": "SUPP-INV-001",
  "purchase_ledger_id": "LED-PUR",
  "items": [
    {
      "product_id": "SI01",
      "warehouse_id": "WH01",
      "qty": 10,
      "unit": "pcs",
      "rate": 3500,
      "discount_type": "%",
      "discount": 2,
      "tax_rate": 18
    }
  ],
  "payment": {
    "collect_now": false
  },
  "narration": "Purchase from ABC Traders"
}
```

---

### 8.2 Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase/orders` | List |
| GET | `/api/purchase/orders/:id` | Detail |
| POST | `/api/purchase/orders` | Create ➕ |
| PUT | `/api/purchase/orders/:id` | Update |
| DELETE | `/api/purchase/orders/:id` | Cancel |
| POST | `/api/purchase/orders/:id/convert-invoice` | Convert to Purchase Invoice |

---

### 8.3 Debit Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase/debit-notes` | List |
| GET | `/api/purchase/debit-notes/:id` | Detail |
| POST | `/api/purchase/debit-notes` | Create ➕ |
| PUT | `/api/purchase/debit-notes/:id` | Update |
| DELETE | `/api/purchase/debit-notes/:id` | Cancel |

**Create Body**
```json
{
  "date": "2025-06-01",
  "vendor_id": "LED001",
  "reference_invoice_id": "pi_01XYZ",
  "items": [
    { "product_id": "SI01", "qty": 2, "rate": 3500, "tax_rate": 18, "reason": "Quality issue" }
  ]
}
```

---

## 9. Vouchers

### 9.1 List Vouchers
**GET** `/api/vouchers` 🔒

**Query Params**
| Param | Values |
|-------|--------|
| `type` | `payment|receipt|journal|contra` |
| `status` | `posted|draft|cleared|pending` |
| `from`, `to` | Date filters |

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "vch_001",
      "voucher_no": "PMT-00234",
      "type": "payment",
      "date": "2025-06-01",
      "party": "ABC Traders",
      "amount": 4500000,
      "method": "neft",
      "status": "cleared",
      "narration": "Payment for INV-30978"
    }
  ]
}
```

---

### 9.2 Get Voucher Detail
**GET** `/api/vouchers/:id` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "vch_001",
    "voucher_no": "PMT-00234",
    "type": "payment",
    "date": "2025-06-01",
    "entries": [
      { "ledger_id": "LED001", "ledger_name": "ABC Traders", "debit": 0, "credit": 4500000 },
      { "ledger_id": "LED012", "ledger_name": "HDFC Bank",   "debit": 4500000, "credit": 0 }
    ],
    "method": "neft",
    "reference_no": "NEFT20250601",
    "narration": "Payment for INV-30978",
    "status": "cleared"
  }
}
```

---

### 9.3 Create Payment Voucher ➕
**POST** `/api/vouchers/payment` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "party_id": "LED001",
  "bank_ledger_id": "LED012",
  "amount": 4500000,
  "method": "neft",
  "reference_no": "NEFT20250601",
  "narration": "Payment to ABC Traders",
  "is_draft": false
}
```

**Validation**
- `party_id`: required, valid sundry creditor ledger
- `bank_ledger_id`: required, must be bank/cash ledger
- `amount`: positive integer (paise)
- `method`: enum `cash|neft|rtgs|cheque|upi|imps`

---

### 9.4 Create Receipt Voucher ➕
**POST** `/api/vouchers/receipt` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "party_id": "LED010",
  "bank_ledger_id": "LED012",
  "amount": 5200000,
  "method": "cash",
  "reference_no": null,
  "narration": "Receipt from Kumar & Sons",
  "is_draft": false
}
```

---

### 9.5 Create Journal Voucher ➕
**POST** `/api/vouchers/journal` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "narration": "Depreciation entry - June 2025",
  "entries": [
    { "ledger_id": "LED009", "debit": 1500000, "credit": 0 },
    { "ledger_id": "LED006", "debit": 0, "credit": 1500000 }
  ],
  "is_draft": false
}
```

**Validation**
- `entries`: min 2 entries
- Sum of all debits must equal sum of all credits (double-entry rule)
- `entries[].ledger_id`: valid ledger in company

---

### 9.6 Create Contra Voucher ➕
**POST** `/api/vouchers/contra` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "from_ledger_id": "LED003",
  "to_ledger_id": "LED012",
  "amount": 2000000,
  "narration": "Cash to HDFC Bank transfer",
  "is_draft": false
}
```

**Validation**
- Both ledgers must be Cash or Bank type
- `from_ledger_id` ≠ `to_ledger_id`

---

### 9.7 Update Voucher
**PUT** `/api/vouchers/:id` 🔒
Cannot update `posted` vouchers; must be in `draft` status.

---

### 9.8 Delete Voucher
**DELETE** `/api/vouchers/:id` 🔒
Cannot delete if referenced in other documents.

---

## 10. Stocks & Inventory

### 10.1 List Stock Items
**GET** `/api/stocks/items` 🔒

**Query Params**
| Param | Description |
|-------|-------------|
| `warehouse_id` | Filter by warehouse |
| `category` | Category filter |
| `group` | Group filter |
| `status` | `in_stock|low_stock|out_of_stock` |
| `search` | Name or SKU search |

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_value": "₹6,06,210",
      "total_skus": 56,
      "total_warehouses": 3,
      "low_stock_count": 8
    },
    "items": [
      {
        "id": "SI01",
        "name": "Black JBL Speaker",
        "sku": "PRD-1002-ABC",
        "category": "Audio",
        "group": "Consumer Electronics",
        "price": 420000,
        "qty": 85,
        "status": "in_stock",
        "warehouse": "WH01 – Mumbai",
        "warehouse_id": "WH01",
        "reorder_level": 20
      }
    ]
  }
}
```

---

### 10.2 Get Stock Item Detail
**GET** `/api/stocks/items/:id` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "SI01",
    "name": "Black JBL Speaker",
    "sku": "PRD-1002-ABC",
    "category": "Audio",
    "group": "Consumer Electronics",
    "unit": "pcs",
    "tax_rate": 18,
    "hsn_code": "8518",
    "mrp": 450000,
    "purchase_rate": 350000,
    "selling_rate": 420000,
    "reorder_level": 20,
    "reorder_qty": 50,
    "opening_qty": 100,
    "current_qty": 85,
    "warehouse_id": "WH01",
    "rack": "A-07",
    "description": "",
    "ledger_id": "LED-STOCK",
    "batches": [
      { "batch_no": "B001", "expiry": "2026-12-31", "qty": 85, "rate": 350000 }
    ],
    "movement": [
      { "date": "2025-06-01", "type": "sale", "qty": -2, "ref": "INV-2847" }
    ]
  }
}
```

---

### 10.3 Create Stock Item ➕
**POST** `/api/stocks/items` 🔒

**Request Body**
```json
{
  "name": "Sony WH-1000XM6",
  "sku": "SNY-002",
  "category": "Audio",
  "group": "Consumer Electronics",
  "unit": "pcs",
  "tax_rate": 18,
  "hsn_code": "8518",
  "mrp": 3200000,
  "purchase_rate": 2500000,
  "selling_rate": 2800000,
  "reorder_level": 5,
  "reorder_qty": 20,
  "opening_qty": 15,
  "opening_qty_rate": 2500000,
  "warehouse_id": "WH01",
  "rack": "A-08",
  "track_batches": false,
  "track_expiry": false
}
```

**Validation**
- `name`: required, unique per company
- `sku`: optional, unique per company if provided
- `unit`: enum `pcs|kg|box|set|litre|mtr|nos`
- `tax_rate`: enum `0|5|12|18|28`
- `opening_qty`: non-negative

---

### 10.4 Update Stock Item
**PUT** `/api/stocks/items/:id` 🔒

---

### 10.5 Delete Stock Item
**DELETE** `/api/stocks/items/:id` 🔒
Cannot delete if item has transactions.

---

### 10.6 List Warehouses
**GET** `/api/stocks/warehouses` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "WH01",
      "name": "Mumbai",
      "code": "WH01",
      "address": "Andheri, Mumbai",
      "manager": "Rahul Sharma",
      "phone": "9876543210",
      "total_items": 45,
      "total_value": "₹2,40,000",
      "utilization_pct": 72
    }
  ]
}
```

---

### 10.7 Create Warehouse ➕
**POST** `/api/stocks/warehouses` 🔒

**Request Body**
```json
{
  "name": "Pune",
  "code": "WH05",
  "address": "MIDC, Pune 411019",
  "manager": "Suresh Kumar",
  "phone": "9812345678",
  "capacity_units": 1000
}
```

---

### 10.8 Create Stock Adjustment ➕
**POST** `/api/stocks/adjustments` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "warehouse_id": "WH01",
  "reason": "damage",
  "narration": "Damaged during transit",
  "items": [
    { "product_id": "SI01", "qty_change": -5, "rate": 420000, "batch_no": "B001" }
  ]
}
```

**Validation**
- `reason`: enum `damage|theft|count|opening|other`
- `items[].qty_change`: can be negative (decrease) or positive (increase)
- Cannot reduce below 0 stock (unless `allow_negative_stock` is enabled in settings)

---

### 10.9 Create Stock Transfer ➕
**POST** `/api/stocks/transfers` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "from_warehouse_id": "WH01",
  "to_warehouse_id": "WH02",
  "narration": "Transfer to Delhi for demand",
  "items": [
    { "product_id": "SI01", "qty": 10, "batch_no": null }
  ]
}
```

**Validation**
- `from_warehouse_id` ≠ `to_warehouse_id`
- Sufficient stock must exist in source warehouse

---

### 10.10 Stock Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stocks/reports/on-hand` | Current on-hand stock |
| GET | `/api/stocks/reports/valuation` | Stock valuation summary |
| GET | `/api/stocks/reports/fast-slow` | Fast & slow-moving items |
| GET | `/api/stocks/reports/aged-items` | Items unsold > N days |
| GET | `/api/stocks/reports/expiry` | Expiry schedule |
| GET | `/api/stocks/reports/negative` | Negative stock items |
| GET | `/api/stocks/reports/reorder-queue` | Items below reorder level |
| GET | `/api/stocks/ledger/:id` | Movement ledger for a stock item |
| GET | `/api/stocks/snapshot` | Point-in-time stock snapshot |

**Common Query Params:** `warehouse_id`, `from`, `to`, `page`, `limit`

---

## 11. KPI Detail Views

### 11.1 Cash In Hand Detail
**GET** `/api/kpi/cash-in-hand` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "current_balance": 2450000,
    "display": "₹24,500",
    "transactions": [
      { "date": "2025-06-01", "narration": "Cash sale", "debit": 500000, "credit": 0, "balance": 2450000 }
    ],
    "daily_flow": [
      { "date": "2025-05-26", "inflow": 800000, "outflow": 300000 }
    ]
  }
}
```

---

### 11.2 Bank Balance Detail
**GET** `/api/kpi/bank-balance` 🔒

**Query Params:** `bank_ledger_id` (optional, filter by specific bank)

**Success Response** — Similar to Cash with bank-wise breakdown
```json
{
  "success": true,
  "data": {
    "total_balance": 18530000,
    "banks": [
      { "ledger_id": "LED012", "name": "HDFC Bank", "balance": 12500000, "account_no": "****7890" }
    ]
  }
}
```

---

### 11.3 Receivables Detail
**GET** `/api/kpi/receivables` 🔒

**Success Response** (see existing implementation in `server.py` — extend with)
```json
{
  "success": true,
  "data": {
    "total": 7500000,
    "aging": [
      { "bucket": "0-30d",  "amount": 2800000, "count": 5 },
      { "bucket": "31-60d", "amount": 2200000, "count": 3 },
      { "bucket": "61-90d", "amount": 1800000, "count": 2 },
      { "bucket": "90+d",   "amount": 700000,  "count": 1 }
    ],
    "overdue_parties": [
      { "party": "ABC Traders", "days": 35, "amount": 375000 }
    ],
    "recent_receipts": [
      { "ref": "RCT-001", "party": "Kumar & Sons", "date": "2025-06-01", "amount": 5200000 }
    ]
  }
}
```

---

### 11.4 Payables Detail
**GET** `/api/kpi/payables` 🔒

Same structure as Receivables but for creditors.

---

### 11.5 Loans & ODs
**GET** `/api/kpi/loans-ods` 🔒

```json
{
  "success": true,
  "data": {
    "total_loans": 25000000,
    "total_od": 0,
    "loans": [
      { "ledger_id": "L001", "name": "SBI Term Loan", "balance": 25000000, "rate": 8.5, "emi": 250000 }
    ]
  }
}
```

---

### 11.6 Payments Summary
**GET** `/api/kpi/payments` 🔒

**Query Params:** `period` (`7D|1M|3M`)

```json
{
  "success": true,
  "data": {
    "total": 3850000,
    "by_method": [
      { "method": "neft", "amount": 2800000 },
      { "method": "cash", "amount": 1050000 }
    ],
    "recent": [
      { "id": "vch_001", "voucher_no": "PMT-00234", "party": "ABC Traders", "amount": 4500000, "date": "2025-06-01" }
    ]
  }
}
```

---

### 11.7 Receipts Summary
**GET** `/api/kpi/receipts` 🔒

Same structure as Payments.

---

## 12. Reports & Analytics

### 12.1 Financial Overview
**GET** `/api/reports/financial` 🔒

**Query Params:** `from`, `to` (date range)

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "months": ["Apr", "May", "Jun"],
    "revenue": [450000, 520000, 480000],
    "expenses": [380000, 420000, 410000]
  }
}
```

---

### 12.2 Financial Report (P&L / Balance Sheet / Trial Balance)
**GET** `/api/reports/financial-report` 🔒

**Query Params:** `from`, `to`, `type` (`pl|balance_sheet|trial_balance`)

---

### 12.3 GST Report
**GET** `/api/reports/gst` 🔒

**Query Params:** `month` (YYYY-MM), `type` (`gstr1|gstr3b|gstr2a`)

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "period": "2025-05",
    "summary": {
      "igst": 18200000,
      "cgst": 9000000,
      "sgst": 9000000,
      "cess": 0,
      "total_tax_collected": 36200000
    },
    "b2b_invoices": [ { "gstin": "27ABCDE...", "invoices": 12, "taxable_value": 450000, "tax": 81000 } ],
    "b2c_invoices": [ { "state": "Maharashtra", "taxable_value": 200000, "tax": 36000 } ]
  }
}
```

---

### 12.4 E-Invoice Compliance
**GET** `/api/reports/einvoice-compliance` 🔒

**Query Params:** `from`, `to`

```json
{
  "success": true,
  "data": {
    "total_invoices": 145,
    "irn_generated": 136,
    "irn_pending": 9,
    "cancelled": 3,
    "compliance_pct": 93.8
  }
}
```

---

### 12.5 E-Way Bill Report
**GET** `/api/reports/ewb` 🔒

```json
{
  "success": true,
  "data": {
    "generated": 265,
    "pending": 33,
    "cancelled": 17,
    "errors": 9,
    "expiring_in_24h": 12
  }
}
```

---

### 12.6 Audit Trail
**GET** `/api/reports/audit-trail` 🔒

**Query Params:** `user_id`, `action_type`, `entity_type`, `from`, `to`, `page`, `limit`

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "aud_001",
      "user": "Ashish Agarwal",
      "user_id": "usr_01HXYZ",
      "action": "CREATE",
      "entity_type": "sales_invoice",
      "entity_id": "inv_01XYZ",
      "entity_ref": "INV-2847",
      "changes": { "status": { "from": null, "to": "pending_irn" } },
      "ip_address": "192.168.1.1",
      "timestamp": "2025-06-01T10:00:00Z"
    }
  ]
}
```

---

### 12.7 Compliance Calendar
**GET** `/api/reports/compliance-calendar` 🔒

**Query Params:** `year`, `month`

```json
{
  "success": true,
  "data": [
    { "date": "2025-07-11", "type": "GSTR-1", "description": "GSTR-1 filing due for June 2025", "status": "upcoming" },
    { "date": "2025-07-20", "type": "GSTR-3B", "description": "GSTR-3B filing due", "status": "upcoming" }
  ]
}
```

---

### 12.8 AI Insights
**GET** `/api/reports/ai-insights` 🔒

```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "id": "ins_001",
        "type": "alert",
        "title": "Cash flow dip predicted",
        "description": "Based on payment patterns, expect ₹2.4L outflow next week. Ensure liquidity.",
        "action_label": "View Details",
        "generated_at": "2025-06-01T06:00:00Z"
      }
    ]
  }
}
```

---

## 13. Notifications

### 13.1 List Notifications
**GET** `/api/notifications` 🔒

**Query Params:** `type` (`warning|urgent|info`), `read` (`true|false`), `page`, `limit`

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "N001",
      "type": "warning",
      "title": "Budget Overspend Warning",
      "message": "You've exceeded your monthly marketing budget by ₹2,000.",
      "time": "5 mins.",
      "action_label": "Adjust plan",
      "action_route": "/reports/financial",
      "is_read": false,
      "created_at": "2025-06-01T09:55:00Z"
    }
  ],
  "meta": { "unread_count": 3 }
}
```

---

### 13.2 Mark Notification as Read
**PATCH** `/api/notifications/:id/read` 🔒

---

### 13.3 Mark All as Read
**PATCH** `/api/notifications/read-all` 🔒

---

### 13.4 Delete Notification
**DELETE** `/api/notifications/:id` 🔒

---

## 14. Settings

### 14.1 Get User Settings
**GET** `/api/settings` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "profile": { "name": "Ashish Agarwal", "phone": "+919876543210", "email": "ashish@ykind.com", "role": "admin" },
    "preferences": {
      "language": "en",
      "currency": "INR",
      "date_format": "DD/MM/YYYY",
      "theme": "light",
      "kpi_carousel_auto_scroll": true
    },
    "notifications": {
      "email": true,
      "whatsapp": true,
      "sms": false,
      "push": true,
      "quiet_hours": {
        "enabled": true,
        "start": "22:00",
        "end": "07:00",
        "weekends": { "saturday": false, "sunday": true }
      },
      "payment_reminders": { "enabled": true, "days_before": [1, 3, 7] },
      "compliance_reminders": { "enabled": true, "days_before": 3 },
      "stock_alerts": { "enabled": true, "threshold_pct": 20 }
    }
  }
}
```

---

### 14.2 Update Notification Settings
**PUT** `/api/settings/notifications` 🔒

**Request Body**
```json
{
  "email": true,
  "whatsapp": false,
  "sms": false,
  "push": true,
  "quiet_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "07:00",
    "saturday": false,
    "sunday": true
  },
  "payment_reminders_enabled": true,
  "payment_reminder_days": [1, 3, 7],
  "compliance_reminders_enabled": true,
  "compliance_reminder_days": 3,
  "stock_alerts_enabled": true,
  "stock_alert_threshold_pct": 20
}
```

---

### 14.3 Update Preferences
**PUT** `/api/settings/preferences` 🔒

**Request Body**
```json
{
  "language": "en",
  "currency": "INR",
  "date_format": "DD/MM/YYYY",
  "theme": "dark",
  "kpi_carousel_auto_scroll": false,
  "voucher_config": {
    "sales_invoice": { "prefix": "INV", "starting_no": 1, "auto_irn": true },
    "payment": { "prefix": "PMT", "starting_no": 1 },
    "receipt": { "prefix": "RCT", "starting_no": 1 }
  }
}
```

---

### 14.4 E-Invoice (IRN) Settings
**GET** `/api/settings/einvoice` 🔒
**PUT** `/api/settings/einvoice` 🔒

**Request/Response Body**
```json
{
  "provider": "nic",
  "gstin": "27ABCDE1234F1Z5",
  "username": "irp_user",
  "password": "encrypted_value",
  "client_id": "abc123",
  "client_secret": "xyz789"
}
```

---

### 14.5 Test E-Invoice Connection
**POST** `/api/settings/einvoice/test` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": { "connected": true, "message": "Successfully connected to NIC IRP portal" }
}
```

---

### 14.6 E-Way Bill Settings
**GET** `/api/settings/ewb` 🔒
**PUT** `/api/settings/ewb` 🔒

```json
{
  "username": "ewb_user",
  "password": "encrypted_value",
  "auto_generate": true,
  "distance_threshold_km": 50
}
```

---

### 14.7 Stock Alert Settings
**PUT** `/api/settings/stock-alerts` 🔒

```json
{
  "global_reorder_pct": 20,
  "enable_email_alert": true,
  "enable_push_alert": true,
  "custom_alerts": [
    { "product_id": "SI01", "reorder_level": 10 }
  ]
}
```

---

### 14.8 Bank Feeds Config
**GET** `/api/settings/bank-feeds` 🔒
**PUT** `/api/settings/bank-feeds` 🔒

```json
{
  "accounts": [
    { "ledger_id": "LED012", "bank_name": "HDFC Bank", "account_no": "1234567890", "auto_reconcile": true }
  ]
}
```

---

### 14.9 Currency Settings
**GET** `/api/settings/currency` 🔒
**PUT** `/api/settings/currency` 🔒

```json
{
  "base_currency": "INR",
  "enabled_currencies": ["USD", "EUR", "GBP"],
  "auto_update_rates": true
}
```

---

## 15. Tally Sync

### 15.1 Get Tally Sync Config
**GET** `/api/tally-sync/config` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "id": "tsync_001",
    "tally_server_ip": "192.168.1.100",
    "tally_port": 9000,
    "company_name": "YK Industries Pvt. Ltd.",
    "sync_mode": "two_way",
    "auto_sync_enabled": true,
    "sync_interval_minutes": 15,
    "last_sync_at": "2025-06-01T09:45:00Z",
    "last_sync_status": "success",
    "records_synced": 1248
  }
}
```

---

### 15.2 Save Tally Sync Config
**PUT** `/api/tally-sync/config` 🔒

**Request Body**
```json
{
  "tally_server_ip": "192.168.1.100",
  "tally_port": 9000,
  "company_name": "YK Industries Pvt. Ltd.",
  "sync_mode": "two_way",
  "auto_sync_enabled": true,
  "sync_interval_minutes": 15
}
```

**Validation**
- `tally_server_ip`: valid IP or hostname
- `tally_port`: int 1–65535
- `sync_mode`: enum `one_way_pull|one_way_push|two_way`
- `sync_interval_minutes`: int 5–1440

---

### 15.3 Test Tally Connection
**POST** `/api/tally-sync/test` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "tally_version": "TallyPrime 4.1",
    "company": "YK Industries Pvt. Ltd.",
    "response_time_ms": 124
  }
}
```

---

### 15.4 Trigger Manual Sync
**POST** `/api/tally-sync/sync` 🔒

**Request Body**
```json
{
  "sync_type": "full",
  "entities": ["ledgers", "vouchers", "stock_items"]
}
```

**Validation**
- `sync_type`: enum `full|delta`
- `entities`: subset of `ledgers|vouchers|stock_items|companies|masters`

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "sync_id": "sync_20250601_001",
    "status": "in_progress",
    "started_at": "2025-06-01T10:00:00Z",
    "estimated_seconds": 30
  }
}
```

---

### 15.5 Get Sync Status
**GET** `/api/tally-sync/status/:sync_id` 🔒

**Success Response (200)**
```json
{
  "success": true,
  "data": {
    "sync_id": "sync_20250601_001",
    "status": "completed",
    "started_at": "2025-06-01T10:00:00Z",
    "completed_at": "2025-06-01T10:00:42Z",
    "records": {
      "ledgers": { "created": 0, "updated": 12, "errors": 0 },
      "vouchers": { "created": 45, "updated": 0, "errors": 0 }
    }
  }
}
```

---

### 15.6 Get Sync Logs
**GET** `/api/tally-sync/logs` 🔒

**Query Params:** `status` (`success|failed`), `from`, `to`, `page`, `limit`

---

## 16. Expenses

### 16.1 List Expenses
**GET** `/api/expenses` 🔒

**Query Params:** `category`, `from`, `to`, `page`, `limit`

**Success Response (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": "exp_001",
      "date": "2025-06-01",
      "category": "Office Supplies",
      "description": "Printer cartridges",
      "amount": 250000,
      "ledger_id": "LED009",
      "paid_from": "cash",
      "receipt_url": null,
      "voucher_id": "vch_exp_001"
    }
  ]
}
```

---

### 16.2 Create Expense ➕
**POST** `/api/expenses` 🔒

**Request Body**
```json
{
  "date": "2025-06-01",
  "category": "Office Supplies",
  "description": "Printer cartridges",
  "amount": 250000,
  "expense_ledger_id": "LED009",
  "paid_from_ledger_id": "LED003",
  "tax_rate": 18,
  "narration": "June office supplies"
}
```

---

### 16.3 Get Expense Detail
**GET** `/api/expenses/:id` 🔒

---

### 16.4 Delete Expense
**DELETE** `/api/expenses/:id` 🔒

---

## 17. Database Schema (PostgreSQL)

```sql
-- ══════════════════════════════════════════════════════════
-- USERS & AUTH
-- ══════════════════════════════════════════════════════════

CREATE TABLE users (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    phone           VARCHAR(15) UNIQUE NOT NULL,
    name            VARCHAR(100),
    email           VARCHAR(100),
    language        VARCHAR(5)  DEFAULT 'en',
    role            VARCHAR(20) DEFAULT 'admin',
    biometric_en    BOOLEAN     DEFAULT FALSE,
    two_fa_en       BOOLEAN     DEFAULT FALSE,
    active_company  VARCHAR(26) REFERENCES companies(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
    id          VARCHAR(26) PRIMARY KEY,
    user_id     VARCHAR(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN     DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE otp_requests (
    id          VARCHAR(26) PRIMARY KEY,
    phone       VARCHAR(15) NOT NULL,
    otp_hash    VARCHAR(64) NOT NULL,
    attempts    INTEGER     DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
-- COMPANIES
-- ══════════════════════════════════════════════════════════

CREATE TABLE companies (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    name            VARCHAR(150) NOT NULL,
    gstin           VARCHAR(15),
    pan             VARCHAR(10),
    address         TEXT,
    email           VARCHAR(100),
    phone           VARCHAR(15),
    website         VARCHAR(100),
    state           VARCHAR(50)  DEFAULT 'Maharashtra',
    country         VARCHAR(50)  DEFAULT 'India',
    fy_start_month  VARCHAR(10)  DEFAULT 'April',
    book_lock_en    BOOLEAN      DEFAULT FALSE,
    book_lock_days  INTEGER      DEFAULT 30,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE company_users (
    company_id  VARCHAR(26) REFERENCES companies(id) ON DELETE CASCADE,
    user_id     VARCHAR(26) REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) DEFAULT 'staff',
    active      BOOLEAN     DEFAULT TRUE,
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (company_id, user_id)
);

-- ══════════════════════════════════════════════════════════
-- LEDGERS (Chart of Accounts)
-- ══════════════════════════════════════════════════════════

CREATE TABLE ledger_groups (
    id          VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id  VARCHAR(26) REFERENCES companies(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    parent      VARCHAR(26)  REFERENCES ledger_groups(id),
    nature      VARCHAR(20),   -- Assets, Liabilities, Income, Expense
    is_system   BOOLEAN DEFAULT FALSE
);

CREATE TABLE ledgers (
    id                    VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id            VARCHAR(26) NOT NULL REFERENCES companies(id),
    name                  VARCHAR(150) NOT NULL,
    group_id              VARCHAR(26) REFERENCES ledger_groups(id),
    type                  VARCHAR(30),  -- sundry_creditor, sundry_debtor, duties_taxes, custom
    opening_balance       BIGINT DEFAULT 0,  -- paise
    opening_balance_type  VARCHAR(2) DEFAULT 'Dr',
    credit_days           INTEGER DEFAULT 0,
    gstin                 VARCHAR(15),
    pan                   VARCHAR(10),
    gst_reg_type          VARCHAR(20) DEFAULT 'Regular',
    -- Mailing
    mailing_enabled       BOOLEAN DEFAULT FALSE,
    mailing_name          VARCHAR(150),
    address               TEXT,
    state                 VARCHAR(50),
    pincode               VARCHAR(10),
    country               VARCHAR(50) DEFAULT 'India',
    -- Bank
    bank_enabled          BOOLEAN DEFAULT FALSE,
    beneficiary_name      VARCHAR(100),
    bank_name             VARCHAR(100),
    account_no            VARCHAR(20),
    ifsc                  VARCHAR(11),
    branch                VARCHAR(100),
    -- Duties
    duty_type             VARCHAR(10),  -- CGST, SGST, IGST, Cess, Others
    duty_percentage       DECIMAL(5,2),
    -- Contact
    phone                 VARCHAR(15),
    email                 VARCHAR(100),
    is_system             BOOLEAN DEFAULT FALSE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (company_id, name)
);

CREATE TABLE ledger_transactions (
    id            VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id    VARCHAR(26) NOT NULL REFERENCES companies(id),
    ledger_id     VARCHAR(26) NOT NULL REFERENCES ledgers(id),
    date          DATE NOT NULL,
    voucher_type  VARCHAR(30),
    voucher_id    VARCHAR(26),
    voucher_no    VARCHAR(20),
    narration     TEXT,
    debit         BIGINT DEFAULT 0,
    credit        BIGINT DEFAULT 0,
    balance       BIGINT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_txn_ledger ON ledger_transactions(ledger_id, date);

-- ══════════════════════════════════════════════════════════
-- WAREHOUSES & STOCK ITEMS
-- ══════════════════════════════════════════════════════════

CREATE TABLE warehouses (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    code            VARCHAR(10) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    address         TEXT,
    manager         VARCHAR(100),
    phone           VARCHAR(15),
    capacity_units  INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, code)
);

CREATE TABLE stock_items (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    name            VARCHAR(150) NOT NULL,
    sku             VARCHAR(50),
    category        VARCHAR(50),
    group_name      VARCHAR(100),
    unit            VARCHAR(10) DEFAULT 'pcs',
    tax_rate        DECIMAL(5,2) DEFAULT 18,
    hsn_code        VARCHAR(10),
    mrp             BIGINT DEFAULT 0,
    purchase_rate   BIGINT DEFAULT 0,
    selling_rate    BIGINT DEFAULT 0,
    reorder_level   INTEGER DEFAULT 0,
    reorder_qty     INTEGER DEFAULT 0,
    warehouse_id    VARCHAR(26) REFERENCES warehouses(id),
    rack            VARCHAR(20),
    track_batches   BOOLEAN DEFAULT FALSE,
    track_expiry    BOOLEAN DEFAULT FALSE,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

CREATE TABLE stock_balances (
    item_id         VARCHAR(26) REFERENCES stock_items(id),
    warehouse_id    VARCHAR(26) REFERENCES warehouses(id),
    qty             DECIMAL(12,3) DEFAULT 0,
    value           BIGINT DEFAULT 0,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (item_id, warehouse_id)
);

CREATE TABLE stock_movements (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    item_id         VARCHAR(26) NOT NULL REFERENCES stock_items(id),
    warehouse_id    VARCHAR(26) REFERENCES warehouses(id),
    date            DATE NOT NULL,
    type            VARCHAR(20),  -- sale, purchase, adjustment, transfer_in, transfer_out
    qty_change      DECIMAL(12,3),
    rate            BIGINT,
    voucher_type    VARCHAR(30),
    voucher_id      VARCHAR(26),
    voucher_no      VARCHAR(20),
    batch_no        VARCHAR(50),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustments (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    date            DATE NOT NULL,
    warehouse_id    VARCHAR(26) REFERENCES warehouses(id),
    reason          VARCHAR(20),
    narration       TEXT,
    created_by      VARCHAR(26) REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_adjustment_items (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    adjustment_id   VARCHAR(26) NOT NULL REFERENCES stock_adjustments(id),
    item_id         VARCHAR(26) NOT NULL REFERENCES stock_items(id),
    qty_change      DECIMAL(12,3) NOT NULL,
    rate            BIGINT DEFAULT 0,
    batch_no        VARCHAR(50)
);

CREATE TABLE stock_transfers (
    id                  VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id          VARCHAR(26) NOT NULL REFERENCES companies(id),
    date                DATE NOT NULL,
    from_warehouse_id   VARCHAR(26) REFERENCES warehouses(id),
    to_warehouse_id     VARCHAR(26) REFERENCES warehouses(id),
    narration           TEXT,
    status              VARCHAR(20) DEFAULT 'completed',
    created_by          VARCHAR(26) REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stock_transfer_items (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    transfer_id     VARCHAR(26) NOT NULL REFERENCES stock_transfers(id),
    item_id         VARCHAR(26) NOT NULL REFERENCES stock_items(id),
    qty             DECIMAL(12,3) NOT NULL,
    batch_no        VARCHAR(50)
);

-- ══════════════════════════════════════════════════════════
-- SALES INVOICES
-- ══════════════════════════════════════════════════════════

CREATE TABLE sales_invoices (
    id                  VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id          VARCHAR(26) NOT NULL REFERENCES companies(id),
    invoice_no          VARCHAR(20) NOT NULL,
    entry_type          VARCHAR(10) DEFAULT 'regular',  -- regular, optional
    sales_ledger_id     VARCHAR(26) REFERENCES ledgers(id),
    date                DATE NOT NULL,
    due_date            DATE,
    party_id            VARCHAR(26) REFERENCES ledgers(id),
    payment_terms       VARCHAR(20),
    payment_terms_days  INTEGER,
    reference_no        VARCHAR(50),
    subtotal            BIGINT DEFAULT 0,
    discount_total      BIGINT DEFAULT 0,
    taxable_amount      BIGINT DEFAULT 0,
    cgst_total          BIGINT DEFAULT 0,
    sgst_total          BIGINT DEFAULT 0,
    igst_total          BIGINT DEFAULT 0,
    logistics_total     BIGINT DEFAULT 0,
    grand_total         BIGINT DEFAULT 0,
    amount_paid         BIGINT DEFAULT 0,
    payment_mode        VARCHAR(10),
    payment_reference   VARCHAR(50),
    payment_status      VARCHAR(10) DEFAULT 'unpaid',  -- paid, unpaid, partial
    narration           TEXT,
    terms               TEXT,
    irn                 VARCHAR(100),
    ack_no              VARCHAR(20),
    ack_date            TIMESTAMPTZ,
    ewb_no              VARCHAR(20),
    status              VARCHAR(20) DEFAULT 'pending_irn',
    is_draft            BOOLEAN DEFAULT FALSE,
    created_by          VARCHAR(26) REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, invoice_no)
);

CREATE TABLE invoice_items (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    invoice_id      VARCHAR(26) NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    warehouse_id    VARCHAR(26) REFERENCES warehouses(id),
    product_id      VARCHAR(26) REFERENCES stock_items(id),
    product_name    VARCHAR(150),
    qty             DECIMAL(12,3) NOT NULL,
    unit            VARCHAR(10) DEFAULT 'pcs',
    rate            BIGINT NOT NULL,
    discount_type   VARCHAR(5) DEFAULT '%',
    discount        DECIMAL(10,2) DEFAULT 0,
    tax_rate        DECIMAL(5,2) DEFAULT 18,
    gross           BIGINT DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    taxable         BIGINT DEFAULT 0,
    cgst            BIGINT DEFAULT 0,
    sgst            BIGINT DEFAULT 0,
    igst            BIGINT DEFAULT 0,
    subtotal        BIGINT DEFAULT 0,
    sort_order      INTEGER DEFAULT 0
);

CREATE TABLE invoice_logistics (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    invoice_id      VARCHAR(26) NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    label           VARCHAR(50),
    amount          BIGINT DEFAULT 0,
    tax_rate        DECIMAL(5,2) DEFAULT 0,
    tax_amount      BIGINT DEFAULT 0
);

-- ══════════════════════════════════════════════════════════
-- OTHER SALES DOCUMENTS (Orders, Quotations, Notes)
-- ══════════════════════════════════════════════════════════

CREATE TABLE sales_orders (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    order_no        VARCHAR(20) NOT NULL,
    date            DATE NOT NULL,
    delivery_date   DATE,
    party_id        VARCHAR(26) REFERENCES ledgers(id),
    grand_total     BIGINT DEFAULT 0,
    status          VARCHAR(15) DEFAULT 'pending',  -- pending, confirmed, cancelled
    narration       TEXT,
    is_draft        BOOLEAN DEFAULT FALSE,
    converted_to_invoice VARCHAR(26) REFERENCES sales_invoices(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotations (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    quotation_no    VARCHAR(20) NOT NULL,
    date            DATE NOT NULL,
    validity_days   INTEGER DEFAULT 15,
    expires_at      DATE,
    party_id        VARCHAR(26) REFERENCES ledgers(id),
    grand_total     BIGINT DEFAULT 0,
    status          VARCHAR(10) DEFAULT 'pending',  -- pending, accepted, expired
    narration       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE credit_notes (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    credit_note_no  VARCHAR(20) NOT NULL,
    date            DATE NOT NULL,
    party_id        VARCHAR(26) REFERENCES ledgers(id),
    ref_invoice_id  VARCHAR(26) REFERENCES sales_invoices(id),
    grand_total     BIGINT DEFAULT 0,
    status          VARCHAR(10) DEFAULT 'issued',  -- issued, settled
    narration       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE delivery_notes (
    id                  VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id          VARCHAR(26) NOT NULL REFERENCES companies(id),
    delivery_note_no    VARCHAR(20) NOT NULL,
    date                DATE NOT NULL,
    party_id            VARCHAR(26) REFERENCES ledgers(id),
    dispatch_through    VARCHAR(100),
    lr_no               VARCHAR(50),
    status              VARCHAR(15) DEFAULT 'pending',  -- pending, in_transit, delivered
    narration           TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ewaybills (
    id                  VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id          VARCHAR(26) NOT NULL REFERENCES companies(id),
    ewb_no              VARCHAR(20) UNIQUE,
    invoice_id          VARCHAR(26) REFERENCES sales_invoices(id),
    date                DATE NOT NULL,
    valid_upto          TIMESTAMPTZ,
    transporter_id      VARCHAR(15),
    transporter_name    VARCHAR(100),
    vehicle_no          VARCHAR(10),
    vehicle_type        VARCHAR(20),
    supply_type         VARCHAR(30),
    sub_supply_type     VARCHAR(30),
    distance_km         INTEGER,
    status              VARCHAR(15) DEFAULT 'pending',  -- generated, pending, cancelled
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
-- PURCHASE DOCUMENTS
-- ══════════════════════════════════════════════════════════

CREATE TABLE purchase_invoices (
    id                  VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id          VARCHAR(26) NOT NULL REFERENCES companies(id),
    invoice_no          VARCHAR(20) NOT NULL,
    vendor_invoice_no   VARCHAR(50),
    purchase_ledger_id  VARCHAR(26) REFERENCES ledgers(id),
    date                DATE NOT NULL,
    due_date            DATE,
    vendor_id           VARCHAR(26) REFERENCES ledgers(id),
    grand_total         BIGINT DEFAULT 0,
    amount_paid         BIGINT DEFAULT 0,
    payment_status      VARCHAR(10) DEFAULT 'unpaid',
    narration           TEXT,
    is_draft            BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_orders (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    order_no        VARCHAR(20) NOT NULL,
    date            DATE NOT NULL,
    delivery_date   DATE,
    vendor_id       VARCHAR(26) REFERENCES ledgers(id),
    grand_total     BIGINT DEFAULT 0,
    status          VARCHAR(15) DEFAULT 'pending',
    narration       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE debit_notes (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) NOT NULL REFERENCES companies(id),
    debit_note_no   VARCHAR(20) NOT NULL,
    date            DATE NOT NULL,
    vendor_id       VARCHAR(26) REFERENCES ledgers(id),
    ref_invoice_id  VARCHAR(26) REFERENCES purchase_invoices(id),
    grand_total     BIGINT DEFAULT 0,
    status          VARCHAR(10) DEFAULT 'issued',
    narration       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
-- VOUCHERS (Double-Entry)
-- ══════════════════════════════════════════════════════════

CREATE TABLE vouchers (
    id          VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id  VARCHAR(26) NOT NULL REFERENCES companies(id),
    voucher_no  VARCHAR(20) NOT NULL,
    type        VARCHAR(15) NOT NULL,  -- payment, receipt, journal, contra
    date        DATE NOT NULL,
    method      VARCHAR(10),  -- cash, neft, rtgs, cheque, upi, imps
    reference_no VARCHAR(50),
    narration   TEXT,
    total_debit BIGINT DEFAULT 0,
    total_credit BIGINT DEFAULT 0,
    status      VARCHAR(10) DEFAULT 'posted',  -- posted, draft, cleared
    is_draft    BOOLEAN DEFAULT FALSE,
    created_by  VARCHAR(26) REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, voucher_no)
);

CREATE TABLE voucher_entries (
    id          VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    voucher_id  VARCHAR(26) NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    ledger_id   VARCHAR(26) NOT NULL REFERENCES ledgers(id),
    debit       BIGINT DEFAULT 0,
    credit      BIGINT DEFAULT 0,
    narration   TEXT,
    sort_order  INTEGER DEFAULT 0
);

-- ══════════════════════════════════════════════════════════
-- EXPENSES
-- ══════════════════════════════════════════════════════════

CREATE TABLE expenses (
    id                  VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id          VARCHAR(26) NOT NULL REFERENCES companies(id),
    date                DATE NOT NULL,
    category            VARCHAR(50),
    description         TEXT,
    amount              BIGINT NOT NULL,
    tax_rate            DECIMAL(5,2) DEFAULT 0,
    tax_amount          BIGINT DEFAULT 0,
    total               BIGINT NOT NULL,
    expense_ledger_id   VARCHAR(26) REFERENCES ledgers(id),
    paid_from_ledger_id VARCHAR(26) REFERENCES ledgers(id),
    voucher_id          VARCHAR(26) REFERENCES vouchers(id),
    receipt_url         TEXT,
    narration           TEXT,
    created_by          VARCHAR(26) REFERENCES users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ══════════════════════════════════════════════════════════

CREATE TABLE notifications (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    user_id         VARCHAR(26) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id      VARCHAR(26) REFERENCES companies(id),
    type            VARCHAR(10) NOT NULL,  -- warning, urgent, info
    title           VARCHAR(100) NOT NULL,
    message         TEXT NOT NULL,
    action_label    VARCHAR(50),
    action_route    VARCHAR(100),
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- ══════════════════════════════════════════════════════════
-- AUDIT LOGS
-- ══════════════════════════════════════════════════════════

CREATE TABLE audit_logs (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) REFERENCES companies(id),
    user_id         VARCHAR(26) REFERENCES users(id),
    action          VARCHAR(10) NOT NULL,  -- CREATE, UPDATE, DELETE, VIEW
    entity_type     VARCHAR(30) NOT NULL,
    entity_id       VARCHAR(26),
    entity_ref      VARCHAR(50),
    changes         JSONB,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_company ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ══════════════════════════════════════════════════════════
-- SETTINGS
-- ══════════════════════════════════════════════════════════

CREATE TABLE user_settings (
    user_id         VARCHAR(26) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language        VARCHAR(5) DEFAULT 'en',
    theme           VARCHAR(10) DEFAULT 'light',
    date_format     VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    currency        VARCHAR(3) DEFAULT 'INR',
    kpi_auto_scroll BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE company_settings (
    company_id              VARCHAR(26) PRIMARY KEY REFERENCES companies(id),
    notif_email             BOOLEAN DEFAULT TRUE,
    notif_whatsapp          BOOLEAN DEFAULT TRUE,
    notif_sms               BOOLEAN DEFAULT FALSE,
    notif_push              BOOLEAN DEFAULT TRUE,
    quiet_hours_enabled     BOOLEAN DEFAULT FALSE,
    quiet_start             TIME DEFAULT '22:00',
    quiet_end               TIME DEFAULT '07:00',
    quiet_saturday          BOOLEAN DEFAULT FALSE,
    quiet_sunday            BOOLEAN DEFAULT TRUE,
    pay_reminder_enabled    BOOLEAN DEFAULT TRUE,
    pay_reminder_days       INTEGER[] DEFAULT '{1,3,7}',
    compliance_reminder_en  BOOLEAN DEFAULT TRUE,
    compliance_reminder_days INTEGER DEFAULT 3,
    stock_alert_en          BOOLEAN DEFAULT TRUE,
    stock_alert_threshold   INTEGER DEFAULT 20,
    einvoice_provider       VARCHAR(20) DEFAULT 'nic',
    einvoice_gstin          VARCHAR(15),
    einvoice_username       VARCHAR(100),
    einvoice_password_enc   TEXT,
    einvoice_client_id      VARCHAR(100),
    einvoice_client_secret  TEXT,
    ewb_username            VARCHAR(100),
    ewb_password_enc        TEXT,
    ewb_auto_generate       BOOLEAN DEFAULT FALSE,
    voucher_config          JSONB,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tally_sync_config (
    id                      VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id              VARCHAR(26) UNIQUE REFERENCES companies(id),
    server_ip               VARCHAR(100),
    port                    INTEGER DEFAULT 9000,
    tally_company_name      VARCHAR(150),
    sync_mode               VARCHAR(15) DEFAULT 'two_way',
    auto_sync_enabled       BOOLEAN DEFAULT FALSE,
    sync_interval_minutes   INTEGER DEFAULT 15,
    last_sync_at            TIMESTAMPTZ,
    last_sync_status        VARCHAR(10),
    records_synced          INTEGER DEFAULT 0,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tally_sync_logs (
    id              VARCHAR(26) PRIMARY KEY DEFAULT gen_ulid(),
    company_id      VARCHAR(26) REFERENCES companies(id),
    sync_type       VARCHAR(10),
    status          VARCHAR(10),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    records_json    JSONB,
    error_message   TEXT
);

-- ══════════════════════════════════════════════════════════
-- SEQUENCE COUNTERS (for auto-numbering)
-- ══════════════════════════════════════════════════════════

CREATE TABLE document_sequences (
    company_id      VARCHAR(26) REFERENCES companies(id),
    doc_type        VARCHAR(20),  -- sales_invoice, purchase_invoice, voucher_payment, etc.
    prefix          VARCHAR(10) DEFAULT '',
    last_no         INTEGER DEFAULT 0,
    fy_year         VARCHAR(7),   -- 2025-26
    PRIMARY KEY (company_id, doc_type, fy_year)
);
```

---

## Summary Table — All Endpoints

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| 1 | POST | `/api/auth/send-otp` | No | Send OTP |
| 2 | POST | `/api/auth/verify-otp` | No | Verify OTP |
| 3 | POST | `/api/auth/register` | No | Register user |
| 4 | POST | `/api/auth/refresh` | No | Refresh JWT |
| 5 | POST | `/api/auth/logout` | Yes | Logout |
| 6 | GET | `/api/auth/me` | Yes | Get profile |
| 7 | PATCH | `/api/auth/me` | Yes | Update profile |
| 8 | GET | `/api/companies` | Yes | List companies |
| 9 | GET | `/api/companies/:id` | Yes | Company detail |
| 10 | PUT | `/api/companies/:id` | Yes | Update company |
| 11 | POST | `/api/companies/:id/logo` | Yes | Upload logo |
| 12 | POST | `/api/companies/:id/switch` | Yes | Switch company |
| 13 | GET | `/api/dashboard/kpi-strip` | Yes | KPI strip |
| 14 | GET | `/api/dashboard/metrics` | Yes | Metrics |
| 15 | GET | `/api/dashboard/cashflow` | Yes | Cashflow |
| 16 | GET | `/api/dashboard/recent-activity` | Yes | Activity feed |
| 17 | GET | `/api/dashboard/search` | Yes | Global search |
| 18 | GET | `/api/ledgers` | Yes | List ledgers |
| 19 | GET | `/api/ledgers/:id` | Yes | Ledger + txns |
| 20 | POST | `/api/ledgers` | Yes | ➕ Create ledger |
| 21 | PUT | `/api/ledgers/:id` | Yes | Update ledger |
| 22 | DELETE | `/api/ledgers/:id` | Yes | Delete ledger |
| 23 | GET | `/api/ledgers/:id/statement` | Yes | PDF statement |
| 24 | GET | `/api/sales/invoices` | Yes | List invoices |
| 25 | GET | `/api/sales/invoices/:id` | Yes | Invoice detail |
| 26 | POST | `/api/sales/invoices` | Yes | ➕ Create invoice |
| 27 | PUT | `/api/sales/invoices/:id` | Yes | Update invoice |
| 28 | DELETE | `/api/sales/invoices/:id` | Yes | Cancel invoice |
| 29 | POST | `/api/sales/invoices/:id/generate-irn` | Yes | Generate IRN |
| 30 | POST | `/api/sales/invoices/bulk-irn` | Yes | Bulk IRN |
| 31 | GET/POST/PUT/DELETE | `/api/sales/orders` | Yes | Sales Orders CRUD |
| 32 | POST | `/api/sales/orders/:id/convert-invoice` | Yes | SO → Invoice |
| 33 | GET/POST/PUT/DELETE | `/api/sales/quotations` | Yes | Quotations CRUD |
| 34 | POST | `/api/sales/quotations/:id/convert-order` | Yes | Quotation → SO |
| 35 | GET/POST/PUT/DELETE | `/api/sales/credit-notes` | Yes | Credit Notes CRUD |
| 36 | GET/POST/PUT/DELETE | `/api/sales/delivery-notes` | Yes | Delivery Notes CRUD |
| 37 | GET/POST | `/api/sales/ewaybills` | Yes | E-Way Bills |
| 38 | POST | `/api/sales/ewaybills/:id/cancel` | Yes | Cancel EWB |
| 39 | GET/POST/PUT/DELETE | `/api/purchase/invoices` | Yes | Purchase Invoices |
| 40 | GET/POST/PUT/DELETE | `/api/purchase/orders` | Yes | Purchase Orders |
| 41 | GET/POST/PUT/DELETE | `/api/purchase/debit-notes` | Yes | Debit Notes |
| 42 | GET | `/api/vouchers` | Yes | List vouchers |
| 43 | GET | `/api/vouchers/:id` | Yes | Voucher detail |
| 44 | POST | `/api/vouchers/payment` | Yes | ➕ Payment |
| 45 | POST | `/api/vouchers/receipt` | Yes | ➕ Receipt |
| 46 | POST | `/api/vouchers/journal` | Yes | ➕ Journal |
| 47 | POST | `/api/vouchers/contra` | Yes | ➕ Contra |
| 48 | PUT/DELETE | `/api/vouchers/:id` | Yes | Update/Delete |
| 49 | GET | `/api/stocks/items` | Yes | Stock list |
| 50 | GET | `/api/stocks/items/:id` | Yes | Item detail |
| 51 | POST | `/api/stocks/items` | Yes | ➕ Create item |
| 52 | PUT/DELETE | `/api/stocks/items/:id` | Yes | Update/Delete item |
| 53 | GET | `/api/stocks/warehouses` | Yes | Warehouse list |
| 54 | POST | `/api/stocks/warehouses` | Yes | ➕ Create warehouse |
| 55 | POST | `/api/stocks/adjustments` | Yes | ➕ Adjustment |
| 56 | POST | `/api/stocks/transfers` | Yes | ➕ Transfer |
| 57 | GET | `/api/stocks/reports/*` | Yes | Stock reports (8) |
| 58 | GET | `/api/kpi/cash-in-hand` | Yes | Cash detail |
| 59 | GET | `/api/kpi/bank-balance` | Yes | Bank detail |
| 60 | GET | `/api/kpi/receivables` | Yes | Receivables |
| 61 | GET | `/api/kpi/payables` | Yes | Payables |
| 62 | GET | `/api/kpi/loans-ods` | Yes | Loans & ODs |
| 63 | GET | `/api/kpi/payments` | Yes | Payments |
| 64 | GET | `/api/kpi/receipts` | Yes | Receipts |
| 65 | GET | `/api/reports/financial` | Yes | Monthly chart |
| 66 | GET | `/api/reports/financial-report` | Yes | P&L, BS, TB |
| 67 | GET | `/api/reports/gst` | Yes | GST report |
| 68 | GET | `/api/reports/einvoice-compliance` | Yes | IRN compliance |
| 69 | GET | `/api/reports/ewb` | Yes | EWB report |
| 70 | GET | `/api/reports/audit-trail` | Yes | Audit trail |
| 71 | GET | `/api/reports/compliance-calendar` | Yes | GST calendar |
| 72 | GET | `/api/reports/ai-insights` | Yes | AI insights |
| 73 | GET | `/api/notifications` | Yes | List |
| 74 | PATCH | `/api/notifications/:id/read` | Yes | Mark read |
| 75 | PATCH | `/api/notifications/read-all` | Yes | Mark all read |
| 76 | DELETE | `/api/notifications/:id` | Yes | Delete |
| 77 | GET | `/api/settings` | Yes | All settings |
| 78 | PUT | `/api/settings/notifications` | Yes | Notif prefs |
| 79 | PUT | `/api/settings/preferences` | Yes | App prefs |
| 80 | GET/PUT | `/api/settings/einvoice` | Yes | IRN config |
| 81 | POST | `/api/settings/einvoice/test` | Yes | Test IRN |
| 82 | GET/PUT | `/api/settings/ewb` | Yes | EWB config |
| 83 | PUT | `/api/settings/stock-alerts` | Yes | Stock alerts |
| 84 | GET/PUT | `/api/settings/bank-feeds` | Yes | Bank feeds |
| 85 | GET/PUT | `/api/settings/currency` | Yes | Currency |
| 86 | GET | `/api/tally-sync/config` | Yes | Sync config |
| 87 | PUT | `/api/tally-sync/config` | Yes | Save config |
| 88 | POST | `/api/tally-sync/test` | Yes | Test connection |
| 89 | POST | `/api/tally-sync/sync` | Yes | Manual sync |
| 90 | GET | `/api/tally-sync/status/:id` | Yes | Sync status |
| 91 | GET | `/api/tally-sync/logs` | Yes | Sync logs |
| 92 | GET | `/api/expenses` | Yes | List expenses |
| 93 | POST | `/api/expenses` | Yes | ➕ Create expense |
| 94 | GET | `/api/expenses/:id` | Yes | Detail |
| 95 | DELETE | `/api/expenses/:id` | Yes | Delete |

**Total: 95 endpoints | 22 PostgreSQL tables | JWT Auth throughout**

---

*Generated for TallyDekho v1.0 — June 2025*
