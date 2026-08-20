/**
 * Stock Adjustment preview — Tally Physical Stock snapshot.
 * Route: /stocks/adjustment-preview?tdkRef=TDK-PHY-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getStockAdjustmentPreview } from '../../src/services/api';

export default function StockAdjustmentPreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Adjustment Preview"
      documentType="stock_journal"
      fetcher={getStockAdjustmentPreview}
    />
  );
}
