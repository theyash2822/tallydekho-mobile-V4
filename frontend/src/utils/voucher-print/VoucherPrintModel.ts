/**
 * Canonical print model for accounting vouchers (Contra / Journal / Payment /
 * Receipt / Expense). All three PDF templates consume this model only.
 * Spec: TallyDekho_Voucher_PDF_3_Layout_Implementation_Spec_v2.md
 */

export type VoucherPrintType =
  | 'Contra'
  | 'Journal'
  | 'Payment'
  | 'Receipt'
  | 'Expense';

export type VoucherLayoutMode = 'debit-credit' | 'amount';

/** Decimal money as a string — never use JS floats for accounting math. */
export type Money = string;

export type VoucherPrintModel = {
  schemaVersion: 1;

  identity: {
    tenantId: string;
    companyGuid: string;
    voucherGuid: string;
    voucherType: VoucherPrintType;
    voucherNumber: string;
    date: string;
  };

  company: {
    name: string;
    addressLines: string[];
    district?: string | null;
    state?: string | null;
    stateName?: string | null;
    stateCode?: string | null;
    email?: string | null;
    gstin?: string | null;
    logoUrl?: string | null;
    extraHeaderLines?: string[];
  };

  layoutMode: VoucherLayoutMode;

  lines: Array<{
    sequence: number;
    ledgerGuid?: string | null;
    ledgerName: string;
    displayPrefix?: 'To' | 'By' | null;
    drCr?: 'Dr' | 'Cr' | null;
    debit?: Money | null;
    credit?: Money | null;
    amount?: Money | null;
    allocations?: Array<{
      sequence: number;
      type: string;
      reference?: string | null;
      amount: Money;
      drCr?: 'Dr' | 'Cr' | null;
    }>;
  }>;

  account?: {
    ledgerGuid?: string | null;
    ledgerName: string;
    amount?: Money | null;
    addressLine?: string | null;
  } | null;

  through?: {
    ledgerGuid?: string | null;
    ledgerName: string;
  } | null;

  narration?: string | null;
  amountInWords?: string | null;

  totals: {
    debit?: Money | null;
    credit?: Money | null;
    amount?: Money | null;
    currencyCode?: string | null;
    currencySymbol?: string | null;
  };

  signatures: {
    showReceiver: boolean;
    receiverLabel?: string | null;
    showAuthorised: boolean;
    authorisedLabel?: string | null;
  };

  sourceMeta?: {
    source: 'tally' | 'tallydekho';
    alterId?: string | null;
    reference?: string | null;
  };
};
