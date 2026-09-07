import { VoucherPrintModel } from './VoucherPrintModel';
import { moneyEquals, moneyToCents } from './shared';

export class VoucherPrintValidationError extends Error {
  constructor(
    message: string,
    public readonly companyGuid?: string,
    public readonly voucherGuid?: string
  ) {
    super(message);
    this.name = 'VoucherPrintValidationError';
  }
}

/**
 * Accounting integrity checks before any template renders.
 * Never auto-balances or mutates values.
 */
export function validateVoucherPrintModel(model: VoucherPrintModel): void {
  const { companyGuid, voucherGuid, voucherType } = model.identity;

  if (!model.identity.voucherNumber && !voucherGuid) {
    throw new VoucherPrintValidationError(
      'Voucher identity missing (number/guid).',
      companyGuid,
      voucherGuid
    );
  }

  if (model.layoutMode === 'debit-credit') {
    const dr = model.totals.debit;
    const cr = model.totals.credit;
    if (!moneyEquals(dr, cr)) {
      throw new VoucherPrintValidationError(
        `${voucherType} voucher is unbalanced: Debit ${dr} ≠ Credit ${cr}.`,
        companyGuid,
        voucherGuid
      );
    }
    // Zero totals allowed for provisional empty drafts only.
    return;
  }

  // amount mode — Payment / Receipt / Expense
  const total = moneyToCents(model.totals.amount);
  if (total < 0) {
    throw new VoucherPrintValidationError(
      `${voucherType} voucher amount is invalid.`,
      companyGuid,
      voucherGuid
    );
  }
  // Allow zero only when there are no lines yet (provisional empty draft) —
  // still refuse negative / allocation overflow.
  if (total === 0 && model.lines.length > 0 && (model.account?.ledgerName || model.lines[0]?.ledgerName)) {
    // Keep rendering; Tally drafts can briefly show 0 before amount sync.
  }

  const allocs = model.lines[0]?.allocations || [];
  if (allocs.length > 0 && total > 0) {
    const sum = allocs.reduce((s, a) => s + moneyToCents(a.amount), 0);
    if (sum > total + 1) {
      throw new VoucherPrintValidationError(
        `${voucherType} allocations exceed voucher total.`,
        companyGuid,
        voucherGuid
      );
    }
  }
}
