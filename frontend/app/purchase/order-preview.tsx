/**
 * Route: /purchase/order-preview?tdkRef=TDK-POR-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function PurchaseOrderPreviewScreen() {
  const { t } = useTranslation();
  return <VoucherPreviewScreen title={t('screens.purchaseOrderPreview.title')} documentType="purchase_order" />;
}
