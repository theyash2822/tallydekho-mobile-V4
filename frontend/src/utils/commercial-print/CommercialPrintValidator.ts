import { CommercialPrintModel } from './CommercialPrintModel';
import { moneyToCents } from '../voucher-print/shared';

export class CommercialPrintValidationError extends Error {
  constructor(
    message: string,
    public readonly companyGuid?: string,
    public readonly documentGuid?: string
  ) {
    super(message);
    this.name = 'CommercialPrintValidationError';
  }
}

/**
 * Basic integrity checks before any commercial template renders.
 * Never auto-balances or mutates values.
 */
export function validateCommercialPrintModel(model: CommercialPrintModel): void {
  const { companyGuid, documentGuid } = model.identity;

  if (!model.company.name?.trim()) {
    throw new CommercialPrintValidationError(
      'Company name is required for commercial print.',
      companyGuid,
      documentGuid
    );
  }

  if (!model.identity.documentType) {
    throw new CommercialPrintValidationError(
      'Document type is required.',
      companyGuid,
      documentGuid
    );
  }

  const grandCents = moneyToCents(model.totals.grandTotal);
  if (model.totals.grandTotal == null || model.totals.grandTotal === '') {
    throw new CommercialPrintValidationError(
      'Grand total is required.',
      companyGuid,
      documentGuid
    );
  }

  // Items may be empty for edge-case drafts; grand total must still be present.
  if (model.items.length === 0 && grandCents === 0) {
    // Allow zero-total empty drafts; no throw.
  }
}

/** Alias matching index.ts usage. */
export const validate = validateCommercialPrintModel;
