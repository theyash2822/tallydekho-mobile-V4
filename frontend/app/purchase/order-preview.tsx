/**
 * Route: /purchase/order-preview?tdkRef=TDK-POR-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function PurchaseOrderPreviewScreen() {
  return <VoucherPreviewScreen title="Purchase Order Preview" documentType="purchase_order" />;
}
