/**
 * Stock Transfer preview — Tally Stock Journal snapshot.
 * Route: /stocks/transfer-preview?tdkRef=TDK-STJ-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getStockTransferPreview } from '../../src/services/api';

export default function StockTransferPreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Transfer Preview"
      documentType="stock_journal"
      fetcher={getStockTransferPreview}
    />
  );
}
