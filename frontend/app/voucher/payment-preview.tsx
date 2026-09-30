/**
 * Route: /voucher/payment-preview?tdkRef=TDK-PAY-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getPaymentPreview } from '../../src/services/api';

export default function PaymentPreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.voucherPaymentPreview.title')}
      documentType="payment_voucher"
      fetcher={getPaymentPreview}
    />
  );
}
