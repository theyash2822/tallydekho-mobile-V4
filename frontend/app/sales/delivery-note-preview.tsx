/**
 * Route: /sales/delivery-note-preview?tdkRef=TDK-DLN-2026-0001
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';

export default function DeliveryNotePreviewScreen() {
  const { t } = useTranslation();
  return <VoucherPreviewScreen title={t('screens.salesDeliveryNotePreview.title')} documentType="delivery_note" />;
}
