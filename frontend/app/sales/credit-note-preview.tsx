/**
 * Route: /sales/credit-note-preview?tdkRef=TDK-CRN-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function CreditNotePreviewScreen() {
  const { t } = useTranslation();
  return <VoucherPreviewScreen title={t('screens.salesCreditNotePreview.title')} documentType="credit_note" />;
}
