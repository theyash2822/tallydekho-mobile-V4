/**
 * Route: /voucher/receipt-preview?tdkRef=TDK-RCP-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getReceiptPreview } from '../../src/services/api';

export default function ReceiptPreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Receipt Preview"
      documentType="receipt_voucher"
      fetcher={getReceiptPreview}
    />
  );
}
