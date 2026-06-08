# CHANGELOG_AGENT.md — tallydekho-mobile-V4 (Mobile)

## 2026-06-08 — Barcode Module (Mobile)

### api.ts — New barcode types + functions
- Types: `BarcodeItem`, `BarcodeSettings`, `BarcodeSummary`
- Functions: `getBarcodeList`, `generateBarcode`, `linkBarcode`, `lookupBarcode`, `bulkImportBarcodes`, `getBarcodeTemplate`, `getBarcodeSettings`, `saveBarcodeSettings`

### app/stocks/barcodes.tsx — Full real-data wire-up
**Mock data replaced:** `MOCK_ITEMS` removed; all data from `POST /api/inventory/barcodes`
**Filters:** Period, Group (from API), Status (9 options from API) all call backend with debounce
**Scanner:** scan → `lookupBarcode` API → found: navigate to `/stocks/item-detail?id=xxx`; not found: Link Barcode modal
**Item tap:** linked item → item-detail; unlinked → alert (Generate / Link / Open Details)
**Generate barcode:** calls `generateBarcode` API → shows generated code
**Link Barcode modal:** search loaded items → `linkBarcode` API
**Bulk Import modal:** DocumentPicker CSV upload + paste text → `bulkImportBarcodes` API → summary alert
**Settings modal (gear icon in header):** storage mode radio (App Only / Tally Alias / Part Number / UDF), barcode type radio (CODE128/EAN13/EAN8/QR/Internal), auto-sync toggle → `saveBarcodeSettings` API
**Subtitle:** shows actual barcode if linked, "No barcode linked" (italic) if not
**Loading states:** ActivityIndicator for initial load, footer spinner for pagination

### Commit: `8a5247b5` → tallydekho-mobile-V4
