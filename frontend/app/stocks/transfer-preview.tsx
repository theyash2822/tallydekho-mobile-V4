/**
 * Stock Transfer preview — Tally Stock Journal snapshot.
 * Route: /stocks/transfer-preview?tdkRef=TDK-STJ-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getStockTransferPreview } from '../../src/services/api';

export default function StockTransferPreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.stocksTransferPreview.title')}
      documentType="stock_journal"
      fetcher={getStockTransferPreview}
    />
  );
}
