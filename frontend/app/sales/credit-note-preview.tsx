/**
 * Route: /sales/credit-note-preview?tdkRef=TDK-CRN-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function CreditNotePreviewScreen() {
  return <VoucherPreviewScreen title="Credit Note Preview" documentType="credit_note" />;
}
