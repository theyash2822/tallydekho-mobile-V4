/**
 * Route: /voucher/expense-preview?tdkRef=TDK-PAY-…
 * Expense is stored as a payment voucher in Tally; we force expense_voucher
 * so preview + Settings PDF format use the Expense template.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getPaymentPreview } from '../../src/services/api';

export default function ExpensePreviewScreen() {
  const { t } = useTranslation();
  return (
    <VoucherPreviewScreen
      title={t('screens.voucherExpensePreview.title')}
      documentType="expense_voucher"
      fetcher={getPaymentPreview}
    />
  );
}
