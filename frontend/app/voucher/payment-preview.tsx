/**
 * Route: /voucher/payment-preview?tdkRef=TDK-PAY-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getPaymentPreview } from '../../src/services/api';

export default function PaymentPreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Payment Preview"
      documentType="payment_voucher"
      fetcher={getPaymentPreview}
    />
  );
}
