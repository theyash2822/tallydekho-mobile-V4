/**
 * Route: /purchase/debit-note-preview?tdkRef=TDK-DBN-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function DebitNotePreviewScreen() {
  const { t } = useTranslation();
  return <VoucherPreviewScreen title={t('screens.purchaseDebitNotePreview.title')} documentType="debit_note" />;
}
