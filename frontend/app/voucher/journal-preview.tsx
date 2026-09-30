/**
 * Route: /voucher/journal-preview?tdkRef=TDK-JRN-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getJournalPreview } from '../../src/services/api';

export default function JournalPreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.voucherJournalPreview.title')}
      documentType="journal_voucher"
      fetcher={getJournalPreview}
    />
  );
}
