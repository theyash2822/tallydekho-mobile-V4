/**
 * Route: /voucher/receipt-preview?tdkRef=TDK-RCP-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getReceiptPreview } from '../../src/services/api';

export default function ReceiptPreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.voucherReceiptPreview.title')}
      documentType="receipt_voucher"
      fetcher={getReceiptPreview}
    />
  );
}
