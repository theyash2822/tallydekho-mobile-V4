/**
 * Route: /voucher/expense-preview?tdkRef=TDK-PAY-…
 * Expense is stored as a payment voucher in Tally; we force expense_voucher
 * so preview + Settings PDF format use the Expense template.
 */
import React from 'react';
import VoucherPreviewScreen from '../../src/components/document/VoucherPreviewScreen';
import { getPaymentPreview } from '../../src/services/api';

export default function ExpensePreviewScreen() {
  return (
    <VoucherPreviewScreen
      title="Expense Preview"
      documentType="expense_voucher"
      fetcher={getPaymentPreview}
    />
  );
}
