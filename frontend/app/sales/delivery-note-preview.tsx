/**
 * Route: /sales/delivery-note-preview?tdkRef=TDK-DLN-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function DeliveryNotePreviewScreen() {
  return <VoucherPreviewScreen title="Delivery Note Preview" documentType="delivery_note" />;
}
