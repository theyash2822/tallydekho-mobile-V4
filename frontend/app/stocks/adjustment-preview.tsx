/**
 * Stock Adjustment preview — Tally Physical Stock snapshot.
 * Route: /stocks/adjustment-preview?tdkRef=TDK-PHY-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getStockAdjustmentPreview } from '../../src/services/api';

export default function StockAdjustmentPreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.stocksAdjustmentPreview.title')}
      documentType="stock_journal"
      fetcher={getStockAdjustmentPreview}
    />
  );
}
