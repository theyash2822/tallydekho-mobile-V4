/**
 * Route: /voucher/journal-preview?tdkRef=TDK-JRN-2026-0001
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getJournalPreview } from '../../src/services/api';

export default function JournalPreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Journal Preview"
      documentType="journal_voucher"
      fetcher={getJournalPreview}
    />
  );
}
