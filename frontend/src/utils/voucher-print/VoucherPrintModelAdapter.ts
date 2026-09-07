import { DocumentType, VoucherDocument, LedgerEntry } from '../../types/document';
import { tallyWords } from '../pdf/words';
import {
  VoucherPrintModel,
  VoucherPrintType,
  VoucherLayoutMode,
} from './VoucherPrintModel';
import { formatClassicDate, moneyFromNumber } from './shared';

const DOC_TO_PRINT: Partial<Record<DocumentType, VoucherPrintType>> = {
  contra_voucher: 'Contra',
  journal_voucher: 'Journal',
  payment_voucher: 'Payment',
  receipt_voucher: 'Receipt',
  expense_voucher: 'Expense',
};

export function isAccountingVoucherType(t: DocumentType | string | undefined): boolean {
  return !!t && t in DOC_TO_PRINT;
}

export function layoutModeFor(type: VoucherPrintType): VoucherLayoutMode {
  return type === 'Contra' || type === 'Journal' ? 'debit-credit' : 'amount';
}

function splitAddress(address?: string): string[] {
  if (!address) return [];
  return address
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function titleFor(type: VoucherPrintType): string {
  return `${type} Voucher`;
}

/**
 * Build the canonical print model from the existing mobile VoucherDocument.
 * Templates must not re-map accounting; this adapter is the only mapper.
 */
export function toVoucherPrintModel(
  doc: VoucherDocument,
  opts: {
    companyGuid?: string | null;
    tenantId?: string | null;
    showReceiver?: boolean;
  } = {}
): VoucherPrintModel {
  const voucherType = DOC_TO_PRINT[doc.documentType];
  if (!voucherType) {
    throw new Error(`Document type ${doc.documentType} is not an accounting voucher.`);
  }

  const layoutMode = layoutModeFor(voucherType);
  const entries = doc.ledgerEntries || [];
  const showGstin = voucherType !== 'Contra';

  const company = doc.company || ({} as any);
  const addressLines = splitAddress(company.address);

  if (layoutMode === 'debit-credit') {
    return buildDebitCreditModel(doc, voucherType, entries, company, addressLines, showGstin, opts);
  }
  return buildAmountModel(doc, voucherType, entries, company, addressLines, showGstin, opts);
}

function buildDebitCreditModel(
  doc: VoucherDocument,
  voucherType: VoucherPrintType,
  entries: LedgerEntry[],
  company: any,
  addressLines: string[],
  showGstin: boolean,
  opts: { companyGuid?: string | null; tenantId?: string | null; showReceiver?: boolean }
): VoucherPrintModel {
  // Preserve source order. Tally prefixes credit-side with "To " on Journal/Contra.
  const lines = entries.map((e, idx) => {
    const isCredit = !!(e.credit && e.credit > 0);
    const isDebit = !!(e.debit && e.debit > 0);
    return {
      sequence: idx + 1,
      ledgerName: e.particulars || '',
      displayPrefix: (isCredit ? 'To' : null) as 'To' | null,
      drCr: (isDebit ? 'Dr' : isCredit ? 'Cr' : null) as 'Dr' | 'Cr' | null,
      debit: isDebit ? moneyFromNumber(e.debit) : null,
      credit: isCredit ? moneyFromNumber(e.credit) : null,
      amount: null,
    };
  });

  const drTotal = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const crTotal = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const total = doc.totals?.drTotal ?? doc.totals?.crTotal ?? doc.totals?.total ?? drTotal;

  return {
    schemaVersion: 1,
    identity: {
      tenantId: opts.tenantId || '',
      companyGuid: opts.companyGuid || '',
      voucherGuid: doc.id || '',
      voucherType,
      voucherNumber: doc.documentNumber || '',
      date: formatClassicDate(doc.date),
    },
    company: {
      name: company.name || '',
      addressLines,
      state: company.state || null,
      stateName: company.state || null,
      stateCode: company.stateCode || null,
      email: company.email || null,
      gstin: showGstin ? company.gstin || null : null,
      logoUrl: null,
    },
    layoutMode: 'debit-credit',
    lines,
    account: null,
    through: null,
    narration: doc.narration || null,
    amountInWords: doc.totals?.totalInWords || tallyWords(total),
    totals: {
      debit: moneyFromNumber(doc.totals?.drTotal ?? drTotal),
      credit: moneyFromNumber(doc.totals?.crTotal ?? crTotal),
      amount: null,
      currencyCode: 'INR',
      currencySymbol: '\u20B9',
    },
    signatures: {
      showReceiver: false,
      showAuthorised: true,
      authorisedLabel: 'Authorised Signatory',
    },
    sourceMeta: {
      source: 'tallydekho',
      reference: doc.reference || null,
    },
  };
}

function buildAmountModel(
  doc: VoucherDocument,
  voucherType: VoucherPrintType,
  entries: LedgerEntry[],
  company: any,
  addressLines: string[],
  showGstin: boolean,
  opts: { companyGuid?: string | null; tenantId?: string | null; showReceiver?: boolean }
): VoucherPrintModel {
  const isReceipt = voucherType === 'Receipt';
  const accountEntry = entries.find((e) => e.reference === 'Account') || entries[0];
  const throughEntry = entries.find((e) => e.reference === 'Through');
  const allocationEntries = entries.filter((e) => e.reference === 'allocation');

  const partyAmount =
    accountEntry?.debit || accountEntry?.credit || doc.totals?.total || 0;

  const allocations = allocationEntries.map((e, idx) => {
    const amt = e.debit || e.credit || 0;
    const label = e.particulars || '';
    // "Agst Ref 508" → type Agst Ref, reference 508
    const m = label.match(/^(Agst Ref|On Account|Advance)\s*(.*)$/i);
    const type = m ? m[1] : label.split(/\s+/)[0] || 'On Account';
    const reference = m ? (m[2] || null) : null;
    return {
      sequence: idx + 1,
      type,
      reference,
      amount: moneyFromNumber(amt),
      drCr: (isReceipt ? 'Cr' : 'Dr') as 'Dr' | 'Cr',
    };
  });

  const partyAddr =
    doc.party?.address ||
    [doc.billing?.city, doc.billing?.state].filter(Boolean).join(', ') ||
    null;

  const accountName =
    accountEntry?.particulars ||
    doc.party?.name ||
    (voucherType === 'Expense' ? 'Expense' : '');

  return {
    schemaVersion: 1,
    identity: {
      tenantId: opts.tenantId || '',
      companyGuid: opts.companyGuid || '',
      voucherGuid: doc.id || '',
      voucherType,
      voucherNumber: doc.documentNumber || '',
      date: formatClassicDate(doc.date),
    },
    company: {
      name: company.name || '',
      addressLines,
      state: company.state || null,
      stateName: company.state || null,
      stateCode: company.stateCode || null,
      email: company.email || null,
      gstin: showGstin ? company.gstin || null : null,
      logoUrl: null,
    },
    layoutMode: 'amount',
    lines: [
      {
        sequence: 1,
        ledgerName: accountName,
        amount: moneyFromNumber(partyAmount),
        drCr: isReceipt ? 'Cr' : 'Dr',
        allocations: allocations.length ? allocations : undefined,
      },
    ],
    account: {
      ledgerName: accountName,
      amount: moneyFromNumber(partyAmount),
      addressLine: partyAddr,
    },
    through: throughEntry
      ? { ledgerName: throughEntry.particulars }
      : doc.paymentDetails?.ledgerName
        ? { ledgerName: doc.paymentDetails.ledgerName }
        : doc.paymentDetails?.mode
          ? { ledgerName: doc.paymentDetails.mode }
          : null,
    narration: doc.narration || null,
    amountInWords: doc.totals?.totalInWords || tallyWords(doc.totals?.total ?? partyAmount),
    totals: {
      amount: moneyFromNumber(doc.totals?.total ?? partyAmount),
      debit: null,
      credit: null,
      currencyCode: 'INR',
      currencySymbol: '\u20B9',
    },
    signatures: {
      showReceiver: opts.showReceiver === true || voucherType === 'Payment',
      receiverLabel: "Receiver's Signature",
      showAuthorised: true,
      authorisedLabel: 'Authorised Signatory',
    },
    sourceMeta: {
      source: 'tallydekho',
      reference: doc.reference || null,
    },
  };
}

export function voucherTitle(type: VoucherPrintType): string {
  return titleFor(type);
}
