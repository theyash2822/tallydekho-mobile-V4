/**
 * Route: /voucher/contra-preview?tdkRef=TDK-CTR-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getContraPreview } from '../../src/services/api';

export default function ContraPreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Contra Preview"
      documentType="contra_voucher"
      fetcher={getContraPreview}
    />
  );
}
