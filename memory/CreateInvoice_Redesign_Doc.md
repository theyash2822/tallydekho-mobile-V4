# Sales > Create Invoice — Redesign Documentation
**Version:** 2.0  
**Date:** June 2026  
**Status:** ✅ Implemented & Tested

---

## 1. Overview

The `Sales > Create Invoice` screen was completely redesigned from a single long-scroll form (1500+ lines) into a **clean 3-Step Wizard** with collapsible sections, toggle-driven panels, and multi-row dynamic inputs.

### Goals
- Break complex form into focused, manageable steps
- Reduce cognitive load with progressive disclosure
- Support multiple taxes per item with fully editable fields
- Provide logistics as a multi-row ledger-based entry
- Move Payment Terms to the Review step for logical flow

---

## 2. Final Architecture — Tree Diagram

```
╔══════════════════════════════════════════════════════════════╗
║  STEP 1 — Invoice Details                                    ║
╚══════════════════════════════════════════════════════════════╝
├── Regular / Optional toggle  (header right side)
│   ├── Regular → Invoice No. auto-locked, Date locked to today
│   └── Optional → Invoice No. editable, past-date picker enabled
├── Sales Ledger  (searchable dropdown, required)
├── Invoice No.  [auto in Regular | manual editable in Optional]
├── Date  [today locked in Regular | date picker in Optional]
└── Customer / Party  (searchable dropdown + "Add New" shortcut)


╔══════════════════════════════════════════════════════════════╗
║  STEP 2 — Items & Services                                   ║
╚══════════════════════════════════════════════════════════════╝
├── Each item = collapsible card
│   ├── COLLAPSED view:
│   │   └── Product name  |  Qty × Rate  |  ₹ Total
│   └── EXPANDED view:
│       ├── Product / Service  (barcode scan OR search bar)   ← FIRST
│       ├── Warehouse  (mandatory dropdown)                    ← SECOND
│       ├── Qty  |  UOM  |  Rate (₹)
│       ├── Discount  (% or flat ₹ — toggle between modes)
│       ├── ── TAXES (multiple rows) ──
│       │   ├── Row: [Tax Type ▼] [Rate % editable] [₹ Amount editable] [✕ remove]
│       │   ├── Empty by default — no pre-filled taxes
│       │   └── [+ Add Tax] button
│       └── Item Total  (auto-calculated, shown at bottom)
│
├── [+ Add Item / Service] button
│
└── ▼ Logistics & Shipping  (collapsible toggle section)
    ├── Each row:
    │   ├── [Ledger Name — searchable]  [₹ Amount]  [✕ remove]
    │   ├── ☐ Add Taxes  (checkbox per row)
    │   └── If checked → tax rows expand:
    │       ├── Row: [Tax Type ▼] [Rate % editable] [₹ Amount editable] [✕]
    │       └── [+ Add Tax Row] button
    └── [+ Add Logistics Row] button


╔══════════════════════════════════════════════════════════════╗
║  STEP 3 — Payment & Review                                   ║
╚══════════════════════════════════════════════════════════════╝
│
├── ── [💵] Collect Payment Now  (toggle) ──
│   ├── Mode of Payment  (small dropdown ▼)
│   │   └── Options: Cash / Cheque / NEFT / Bank Transfer / UPI
│   ├── Amount Received (₹)
│   ├── Reference No.  (Txn / Cheque No.)
│   └── Payment Status chip  (Paid / Partial / Pending)
│
├── ── [🚚] Dispatch / E-Way Bill  (toggle) ──
│   ├── Dispatch From  |  Ship To
│   ├── Transport Mode chips:
│   │   └── Road / Rail / Air / Ship / Not Applicable
│   ├── Transporter Name  |  Transporter ID
│   ├── Vehicle No.
│   ├── Vehicle Type chips:
│   │   └── Regular / Over Dimensional / Not Applicable
│   └── Doc / LR / RR No.  |  Doc Date
│
├── ── ▼ Payment Terms  (collapsible section) ──
│   ├── Terms Dropdown:
│   │   └── Due on Receipt / 15 Days / 30 Days / Custom
│   ├── If Custom → text field (number of days)
│   ├── Due Date  (auto-calculated or manual)
│   └── Reference No.
│
├── ── Invoice Summary  (read-only) ──
│   ├── Subtotal
│   ├── Logistics & Charges  (if any added)
│   ├── Tax Breakdown  (each tax type on its own line)
│   └── Grand Total
│
├── Notes
│   ├── Narration  (free text)
│   └── Terms & Conditions  (free text)
│
└── [🟢 Submit Invoice]   ← NO Save Draft
```

---

## 3. Field-by-Field Reference

### STEP 1 — Invoice Details

| Field | Type | Behaviour |
|---|---|---|
| Regular / Optional | Toggle (header) | Switches entry mode; locks/unlocks Invoice No and Date |
| Sales Ledger | Searchable dropdown | Required; defaults to "Credit Sales" |
| Invoice No. | Text input | Auto-generated + locked in Regular; manually editable in Optional |
| Date | Date display | Locked to today in Regular; date picker allowed in Optional |
| Customer / Party | Searchable dropdown | Required; has "Add New Customer" quick-action |

---

### STEP 2 — Item Card (Expanded)

| Field | Type | Behaviour |
|---|---|---|
| Product / Service | Search + Barcode scan | Shows all products; filtered to warehouse when warehouse is selected |
| Warehouse | Mandatory dropdown | Required field; changing clears product if not in new warehouse |
| Qty | Numeric input | Editable quantity |
| UOM | Dropdown | Unit of Measure (pcs, kg, box, etc.) |
| Rate (₹) | Numeric input | Per-unit price |
| Discount | Toggle + Numeric | Switch between % discount and flat ₹ discount |
| Tax Rows | Dynamic multi-row | No defaults; user adds manually |
| — Tax Type | Dropdown | CGST / SGST / IGST / CESS / Add. Cess / Other |
| — Rate % | Editable text | Percentage rate (editable) |
| — ₹ Amount | Editable text | Auto-calculated from Rate%; overridable by typing manually |
| Item Total | Read-only | Auto-calculated: (Qty × Rate) − Discount + Taxes |

### STEP 2 — Logistics & Shipping (per row)

| Field | Type | Behaviour |
|---|---|---|
| Ledger Name | Searchable dropdown | e.g. Freight Charges, Packing, Courier, Insurance, etc. |
| Amount (₹) | Numeric input | Charge amount for this ledger entry |
| Add Taxes | Checkbox | If checked, reveals per-row tax rows (same as item taxes) |

---

### STEP 3 — Payment & Review

#### Collect Payment Now (toggle → reveals)
| Field | Type | Behaviour |
|---|---|---|
| Mode of Payment | Small dropdown | Cash / Cheque / NEFT / Bank Transfer / UPI |
| Amount Received | Numeric input | Pre-filled with Grand Total; editable |
| Reference No. | Text input | Txn / Cheque number |
| Payment Status | Chip selector | Paid / Partial / Pending |

#### Dispatch / E-Way Bill (toggle → reveals)
| Field | Type | Behaviour |
|---|---|---|
| Dispatch From | Text input | Source location |
| Ship To | Text input | Destination location |
| Transport Mode | Chip selector | Road / Rail / Air / Ship / Not Applicable |
| Transporter Name | Text input | Name of transport company |
| Transporter ID | Text input | GSTIN of transporter |
| Vehicle No. | Text input | Vehicle registration number |
| Vehicle Type | Chip selector | Regular / Over Dimensional / Not Applicable |
| Doc / LR / RR No. | Text input | Lorry Receipt / Railway Receipt number |
| Doc Date | Text input | Date of dispatch document |

#### Payment Terms (collapsible → reveals)
| Field | Type | Behaviour |
|---|---|---|
| Terms | Dropdown | Due on Receipt / 15 Days / 30 Days / Custom |
| Custom Days | Numeric input | Shown only when "Custom" is selected |
| Due Date | Date input | Auto-calculated or manual entry |
| Reference No. | Text input | PO or reference number |

---

## 4. Key Business Logic

| Rule | Description |
|---|---|
| Regular Mode | Invoice No. locked (auto), Date locked to today |
| Optional Mode | Invoice No. editable, past dates selectable via date picker |
| No Default Taxes | Items start with empty tax list; user adds taxes as needed |
| Tax Amount Override | ₹ amount field is always editable; if typed manually it overrides the auto-calculation |
| Product-first UX | Product search is always active; warehouse is selected second; changing warehouse clears product if that product isn't stocked there |
| Logistics Total | Logistics rows (base + taxes) are summed separately and shown in Invoice Summary as "Logistics & Charges" |
| No Save Draft | The wizard has only "Submit Invoice" — no draft/save functionality |
| E-Way Bill | Behaves identically to Collect Payment (toggle reveals form fields) |

---

## 5. Files Changed

| File | Change |
|---|---|
| `/app/frontend/app/sales/create-invoice.tsx` | Main file — 7 targeted edits |
| `/app/frontend/src/components/forms/LogisticsSection.tsx` | Complete rewrite — new Ledger+Amount+Tax design |
| `/app/frontend/app/sales/create-order.tsx` | Updated LogisticsSection API signature |
| `/app/frontend/app/sales/create-quotation.tsx` | Updated LogisticsSection API signature |
| `/app/frontend/app/purchase/create-order.tsx` | Updated LogisticsSection API signature |

### Summary of Edits to `create-invoice.tsx`

1. `PAY_MODES` → Updated to: `Cash, Cheque, NEFT, Bank Transfer, UPI` (removed RTGS and IMPS)
2. `newItem()` → `taxes: []` (removed default CGST 9% + SGST 9%)
3. `ItemCard` → Product field moved **above** Warehouse field
4. Product search → Always enabled (no longer disabled when no warehouse)
5. `logTaxRate` state → Removed (taxes are now per-row in LogisticsSection)
6. `logisticsTotal` useMemo → Updated to `calcLogisticsTotal(logEntries)` (removed taxRate arg)
7. Payment Terms block → **Removed from Step 1**, **Added to Step 3** as collapsible section
8. Payment Mode label → Moved above the dropdown button (label-first UX)

---

## 6. Logistics Section — Component Interface

```typescript
// New LogEntry shape (LogisticsSection.tsx)
export interface TaxLine {
  id: string;
  type: string;   // 'CGST' | 'SGST' | 'IGST' | 'CESS' | 'ADD_CESS' | 'OTHER'
  rate: string;   // percentage (editable text)
  amount: string; // ₹ amount (editable text; overrides auto-calc if filled)
}

export interface LogEntry {
  id: string;
  ledger: string;    // value key from LOGISTICS_LEDGERS
  amount: string;    // base charge amount
  addTaxes: boolean; // checkbox state
  taxes: TaxLine[];  // per-row tax lines (empty unless addTaxes = true)
}

// Props
interface Props {
  entries: LogEntry[];
  onEntriesChange: (entries: LogEntry[]) => void;
}

// Helper
export function calcLogisticsTotal(entries: LogEntry[]): number
```

### Available Logistics Ledgers
- Freight Charges
- Packing & Forwarding
- Transport Charges
- Courier Charges
- Insurance
- Loading / Unloading
- Handling Charges
- Other Charges

---

## 7. Testing Results

| # | Test Case | Result |
|---|---|---|
| 1 | Step 1 renders: Ledger, Invoice No (locked), Date (locked), Party — NO Payment Terms | ✅ PASS |
| 2 | REG/OPT toggle visible in header | ✅ PASS |
| 3 | Step 2: Product shown FIRST, Warehouse SECOND | ✅ PASS |
| 4 | Step 2: Item taxes empty (no defaults), [+ Add Tax] visible | ✅ PASS |
| 5 | Step 2: Logistics section is a toggle with Ledger+Amount+Add Taxes per row | ✅ PASS |
| 6 | Step 3: Payment Terms collapsible IS in Step 3 | ✅ PASS |
| 7 | Step 3: Payment Mode dropdown = Cash/Cheque/NEFT/Bank Transfer/UPI only | ✅ PASS |
| 8 | Step 3: E-Way Bill toggle + Summary + Submit button | ✅ PASS |

**All 8 tests PASSED ✅**

---

*Document generated: June 2026 | TallyDekho Mobile App*
