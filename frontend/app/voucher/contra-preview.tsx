/**
 * Route: /voucher/contra-preview?tdkRef=TDK-CTR-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getContraPreview } from '../../src/services/api';

export default function ContraPreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.voucherContraPreview.title')}
      documentType="contra_voucher"
      fetcher={getContraPreview}
    />
  );
}
