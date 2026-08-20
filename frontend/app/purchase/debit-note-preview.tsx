/**
 * Route: /purchase/debit-note-preview?tdkRef=TDK-DBN-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function DebitNotePreviewScreen() {
  return <VoucherPreviewScreen title="Debit Note Preview" documentType="debit_note" />;
}
