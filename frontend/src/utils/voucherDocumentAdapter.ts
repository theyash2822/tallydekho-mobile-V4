/**
 * voucherDocumentAdapter.ts
 *
 * The single mapping from a backend preview snapshot to `VoucherDocument`.
 *
 * Every preview screen used to carry its own `mapToVoucherDocument()`, and each
 * one dropped a different set of fields — HSN, tax splits, discounts, terms, and
 * `metadata` entirely, which is why the "Reference & Details" section was always
 * blank. All screens now go through here.
 *
 * Backend source: GET /tally/invoice/:tdkRef/preview (buildVoucherDocument in
 * td-backend/src/routes/tally-write.js).
 */
import {
  VoucherDocument, DocumentType, ItemLine, TaxLine, LedgerEntry,
  DocumentLayout, TallyMetadata, HsnSummaryRow, ChargeLine,
} from '../types/document';
import { DEFAULT_DECLARATION } from './pdf/tallyLayout';

const num = (v: any, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Backend `documentType` → the mobile `DocumentType` union.
 * The two vocabularies differ for money vouchers and stock journals.
 */
const DOCUMENT_TYPE_MAP: Record<string, DocumentType> = {
  sales_invoice: 'sales_invoice',
  proforma_invoice: 'proforma_invoice',
  sales_order: 'sales_order',
  delivery_note: 'delivery_note',
  credit_note: 'credit_note',
  debit_note: 'debit_note',
  purchase_invoice: 'purchase_invoice',
  purchase_order: 'purchase_order',
  receipt_note: 'receipt_note',
  quotation: 'quotation',
  receipt: 'receipt_voucher',
  receipt_voucher: 'receipt_voucher',
  payment: 'payment_voucher',
  payment_voucher: 'payment_voucher',
  expense: 'expense_voucher',
  expense_voucher: 'expense_voucher',
  contra: 'contra_voucher',
  contra_voucher: 'contra_voucher',
  journal: 'journal_voucher',
  journal_voucher: 'journal_voucher',
  stock_transfer: 'stock_journal',
  stock_adjustment: 'stock_journal',
  stock_journal: 'stock_journal',
};

const TITLE_KIND: Record<DocumentType, string> = {
  sales_invoice: 'Invoice',
  proforma_invoice: 'Proforma Invoice',
  sales_order: 'Sales Order',
  delivery_note: 'Delivery Note',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
  purchase_invoice: 'Purchase Invoice',
  purchase_order: 'Purchase Order',
  receipt_note: 'Receipt Note',
  quotation: 'Quotation',
  payment_voucher: 'Payment',
  receipt_voucher: 'Receipt',
  expense_voucher: 'Expense',
  contra_voucher: 'Contra',
  journal_voucher: 'Journal',
  stock_journal: 'Stock Journal',
};

export function resolveDocumentType(raw: any): DocumentType {
  const key = String(raw?.documentType || '').toLowerCase();
  return DOCUMENT_TYPE_MAP[key] || 'sales_invoice';
}

function mapItems(raw: any): ItemLine[] {
  return (raw?.items || []).map((item: any, idx: number): ItemLine => ({
    id: String(item.id ?? idx),
    name: item.name || item.itemName || '',
    description: item.description || undefined,
    hsn: item.hsn || undefined,
    qty: num(item.qty, num(item.billedQty, num(item.actualQty, 0))),
    unit: item.unit || 'Nos',
    rate: num(item.rate),
    discount: num(item.discount) || undefined,
    discountType: item.discountType || undefined,
    taxPct: num(item.taxPct) || undefined,
    taxAmount: num(item.taxAmount) || undefined,
    taxableAmount: num(item.taxableAmount, num(item.amount)),
    amount: num(item.amount),
    godown: item.godown || undefined,
    batch: item.batch || undefined,
    ledgerName: item.ledgerName || item.salesLedger || item.purchaseLedger || undefined,
    direction: item.direction === 'in' || item.direction === 'out' ? item.direction : undefined,
  }));
}

function mapTaxes(raw: any): TaxLine[] {
  const rows = raw?.taxLines || raw?.taxes || [];
  return rows.map((t: any): TaxLine => ({
    description: t.description || t.ledgerName || 'Tax',
    kind: t.kind || undefined,
    rate: num(t.rate ?? t.taxRate),
    taxableAmount: num(t.taxableAmount ?? t.taxableValue),
    cgst: num(t.cgst) || undefined,
    sgst: num(t.sgst) || undefined,
    igst: num(t.igst) || undefined,
    cess: num(t.cess) || undefined,
    total: num(t.total ?? t.taxAmount),
  }));
}

function mapCharges(raw: any): ChargeLine[] {
  return (raw?.additionalCharges || []).map((c: any): ChargeLine => ({
    description: c.description || 'Charge',
    amount: num(c.amount),
    taxes: (c.taxes || []).map((t: any) => ({
      description: t.description || 'Tax',
      kind: t.kind,
      rate: num(t.rate),
      amount: num(t.amount),
    })),
  }));
}

function mapHsnSummary(raw: any): HsnSummaryRow[] {
  return (raw?.hsnSummary || []).map((h: any): HsnSummaryRow => ({
    hsn: h.hsn || '',
    taxableAmount: num(h.taxableAmount),
    taxPct: num(h.taxPct) || undefined,
    cgst: num(h.cgst),
    sgst: num(h.sgst),
    igst: num(h.igst),
    cess: num(h.cess),
    totalTax: num(h.totalTax),
  }));
}

/**
 * The Dr/Cr particulars table for money vouchers. Tally prints the party ledger
 * with its bill allocations indented beneath it, then the bank/cash ledger under
 * a "Through :" label.
 */
function mapLedgerEntries(raw: any, documentType: DocumentType): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const push = (e: Omit<LedgerEntry, 'id'>) => entries.push({ id: String(entries.length), ...e });

  if (
    documentType === 'receipt_voucher' ||
    documentType === 'payment_voucher' ||
    documentType === 'expense_voucher'
  ) {
    const block = raw.receipt || raw.payment || raw.expense || {};
    const amount = num(block.amount, num(raw.totals?.grandTotal));
    const isReceipt = documentType === 'receipt_voucher';
    // A receipt credits the party and debits the bank; payment/expense is the mirror.
    push({
      particulars: raw.party?.name || block.partyLedger || block.expenseLedger || '',
      reference: 'Account',
      ...(isReceipt ? { credit: amount } : { debit: amount }),
    });
    for (const b of block.billAllocations || []) {
      push({
        particulars: `${b.billType || 'On Account'}${b.billRefName ? ` ${b.billRefName}` : ''}`,
        reference: 'allocation',
        ...(isReceipt ? { credit: num(b.amount) } : { debit: num(b.amount) }),
      });
    }
    if (block.ledgerAccount || block.paymentMethod) {
      push({
        particulars: block.ledgerAccount || block.paymentMethod,
        reference: 'Through',
        ...(isReceipt ? { debit: amount } : { credit: amount }),
      });
    }
    return entries;
  }

  if (documentType === 'journal_voucher') {
    const j = raw.journal || {};
    const amount = num(j.amount, num(raw.totals?.grandTotal));
    if (j.drLedger) push({ particulars: j.drLedger, debit: amount });
    if (j.crLedger) push({ particulars: j.crLedger, credit: amount });
    return entries;
  }

  if (documentType === 'contra_voucher') {
    const c = raw.contra || {};
    const amount = num(c.amount, num(raw.totals?.grandTotal));
    // Money leaves the source ledger (Cr) and lands in the destination (Dr).
    if (c.toLedger) push({ particulars: c.toLedger, debit: amount });
    if (c.fromLedger) push({ particulars: c.fromLedger, credit: amount });
    return entries;
  }

  return entries;
}

function mapPaymentDetails(raw: any, documentType: DocumentType) {
  const block = raw.receipt || raw.payment || raw.expense;
  if (block) {
    return {
      mode: block.paymentMethod || 'Cash',
      ledgerName: block.ledgerAccount || undefined,
      amount: num(block.amount),
      reference: block.instrument?.instrumentNo || undefined,
      bankName: block.instrument?.bankName || undefined,
      chequeNo: block.instrument?.instrumentNo || undefined,
      instrumentDate: block.instrument?.instrumentDate || undefined,
      transactionRef: block.instrument?.transactionType || undefined,
    };
  }
  if (raw.paymentInfo) {
    return {
      mode: raw.paymentInfo.mode || 'Cash',
      ledgerName: raw.paymentInfo.mode || undefined,
      amount: num(raw.paymentInfo.collected),
      reference: raw.paymentInfo.reference || undefined,
    };
  }
  return undefined;
}

/** Condensed metadata for the existing "Reference & Details" card. */
function mapCardMetadata(meta: TallyMetadata, raw: any) {
  const transport = [meta.dispatchedThrough, meta.transportMode].filter(Boolean).join(' · ');
  return {
    placeOfSupply: meta.placeOfSupply || undefined,
    orderRef: meta.buyersOrderNo || raw.againstOrderNo || undefined,
    invoiceRef: meta.originalInvoiceNo || meta.supplierInvoiceNo || raw.againstInvoiceNo || undefined,
    paymentTerms: meta.paymentTerms || undefined,
    dueDate: meta.dueDate || raw.dueDate || undefined,
    eway: meta.ewayBillNo || undefined,
    vehicleNo: meta.motorVehicleNo || undefined,
    transportDetails: transport || undefined,
    deliveryTerms: meta.termsOfDelivery || undefined,
    warehouse: meta.warehouse || raw.items?.[0]?.godown || undefined,
  };
}

function mapAddress(block: any) {
  if (!block) return undefined;
  return {
    name: block.name || undefined,
    line1: block.address || undefined,
    state: block.state || undefined,
    pincode: block.pincode || undefined,
  };
}

/**
 * Maps a backend preview snapshot to `VoucherDocument`.
 *
 * `overrides` exists for screens that must force a document type — e.g. an
 * unconverted Proforma keeps its Proforma title while the backend already
 * relabels a converted one as a Tax Invoice.
 */
export function toVoucherDocument(
  raw: any,
  overrides: Partial<VoucherDocument> = {}
): VoucherDocument {
  const documentType = overrides.documentType || resolveDocumentType(raw);
  const layout: DocumentLayout | undefined = raw.layout;
  const meta: TallyMetadata = raw.metadata || {};
  const totals = raw.totals || {};
  const ledgerEntries = mapLedgerEntries(raw, documentType);
  const drTotal = ledgerEntries.reduce((s, e) => s + num(e.debit), 0);
  const crTotal = ledgerEntries.reduce((s, e) => s + num(e.credit), 0);
  // Stock docs share one DocumentType but two Tally titles (Stock Journal vs
  // Physical Stock), so the voucher type wins when the backend sends it.
  const titleKind = documentType === 'stock_journal'
    ? (raw.tallyVoucherType || TITLE_KIND[documentType])
    : (TITLE_KIND[documentType] || 'Document');
  const numberLabel = raw.documentNumber || 'Pending from TallyPrime';

  const doc: VoucherDocument = {
    id: raw.tdkRef || raw.invoiceUuid || String(Date.now()),
    documentType,
    documentTitle: `${titleKind}${numberLabel ? ` - ${numberLabel}` : ''}`,
    documentNumber: numberLabel,
    date: raw.documentDate || '',
    company: {
      name: raw.company?.name || '',
      address: raw.company?.address || '',
      gstin: raw.company?.gstin || '',
      pan: raw.company?.pan || '',
      phone: raw.company?.phone || '',
      email: raw.company?.email || '',
      state: raw.company?.state || '',
      stateCode: raw.company?.stateCode || '',
      pincode: raw.company?.pincode || '',
      jurisdiction: raw.company?.jurisdiction || '',
      declarationText: raw.company?.declarationText || '',
      bank: raw.company?.bank || null,
    },
    party: {
      name: raw.party?.name || '',
      address: raw.party?.address || '',
      gstin: raw.party?.gstin || '',
      pan: raw.party?.pan || '',
      phone: raw.party?.phone || '',
      email: raw.party?.email || '',
      state: raw.party?.state || '',
      stateCode: raw.party?.stateCode || '',
      pincode: raw.party?.pincode || '',
    },
    billing: mapAddress(raw.billing || raw.party),
    shipping: mapAddress(raw.shipping),
    metadata: mapCardMetadata(meta, raw),
    tallyMeta: meta,
    items: mapItems(raw),
    ledgerEntries: ledgerEntries.length ? ledgerEntries : undefined,
    taxes: mapTaxes(raw),
    hsnSummary: mapHsnSummary(raw),
    additionalCharges: mapCharges(raw),
    totals: {
      subtotal: num(totals.subtotal),
      discount: num(totals.discount) || undefined,
      taxableAmount: num(totals.taxableAmount) || undefined,
      cgstTotal: num(totals.cgstTotal) || undefined,
      sgstTotal: num(totals.sgstTotal) || undefined,
      igstTotal: num(totals.igstTotal) || undefined,
      cessTotal: num(totals.cessTotal) || undefined,
      chargeTotal: num(totals.chargeTotal) || undefined,
      taxTotal: num(totals.taxTotal) || undefined,
      roundOff: num(totals.roundOff),
      roundOffLabel: totals.roundOffLabel || undefined,
      total: num(totals.grandTotal, num(totals.total)),
      totalQty: num(totals.totalQty) || undefined,
      totalInWords: raw.totalInWords || undefined,
      taxAmountInWords: raw.taxAmountInWords || undefined,
      drTotal: drTotal || undefined,
      crTotal: crTotal || undefined,
    },
    paymentDetails: mapPaymentDetails(raw, documentType),
    narration: raw.narration || '',
    reference: meta.referenceNo || raw.tdkRef || undefined,
    terms: raw.termsText || undefined,
    footerInfo: {
      declaration: layout?.showDeclaration ? (raw.company?.declarationText || undefined) : undefined,
      receiverNote: layout?.showReceivedInGoodCondition ? 'Recd. in Good Condition' : undefined,
      authorizedSignatory: raw.company?.name || undefined,
      systemNote: layout?.computerGeneratedText || undefined,
    },
    dispatchDetails: raw.dispatchDetails || raw.dispatch_details || undefined,
    layout,
    tallyVoucherType: raw.tallyVoucherType || undefined,
    tdkRef: raw.tdkRef || undefined,
    postingTag: raw.postingTag || undefined,
    isProvisional: raw.isProvisional ?? undefined,
    watermarkText: raw.watermarkText ?? undefined,
    ...overrides,
  };

  return doc;
}

/**
 * An unconverted Proforma must keep the Proforma title; once Tally converts it
 * the backend already returns `sales_invoice`.
 */
export function isUnconvertedProforma(raw: any): boolean {
  return raw?.documentType === 'proforma_invoice'
    && raw?.conversionStatus !== 'converted'
    && raw?.currentEntryType !== 'regular';
}

// ── Tally-synced vouchers (GET /vouchers/:guid) ──────────────────────────────

const PURCHASE_SIDE: DocumentType[] = ['purchase_invoice', 'debit_note', 'purchase_order', 'receipt_note'];
const INVOICE_FAMILY: DocumentType[] = [
  'sales_invoice', 'proforma_invoice', 'sales_order', 'delivery_note', 'credit_note',
  'debit_note', 'purchase_invoice', 'purchase_order', 'receipt_note',
];

/**
 * Derives the same presentation flags the backend attaches to app-created
 * vouchers, for documents that only exist in the Tally sync tables.
 */
export function deriveLayout(documentType: DocumentType): DocumentLayout {
  if (documentType === 'stock_journal') {
    return { family: 'stock', title: 'Stock Journal', showSignatory: true };
  }
  if (!INVOICE_FAMILY.includes(documentType)) {
    const isMoney = documentType === 'receipt_voucher' || documentType === 'payment_voucher' || documentType === 'expense_voucher';
    return {
      family: 'voucher',
      title: TITLE_KIND[documentType] + ' Voucher',
      columns: isMoney ? ['amount'] : ['debit', 'credit'],
      showThrough: isMoney,
      showGstin: documentType !== 'contra_voucher',
      showSignatory: true,
    };
  }
  const isPurchaseSide = PURCHASE_SIDE.includes(documentType);
  const showsDeclaration = documentType === 'sales_invoice' || documentType === 'proforma_invoice';
  return {
    family: 'invoice',
    title: documentType === 'sales_invoice' ? 'TAX INVOICE' : TITLE_KIND[documentType].toUpperCase(),
    partyRole: isPurchaseSide ? 'supplier' : 'buyer',
    partyLabel: isPurchaseSide ? 'Supplier (Bill from)' : 'Buyer (Bill to)',
    showHsnSummary: ['sales_invoice', 'proforma_invoice', 'purchase_invoice'].includes(documentType),
    showDeclaration: showsDeclaration,
    showReceivedInGoodCondition: documentType === 'delivery_note',
    showJurisdiction: showsDeclaration,
    computerGeneratedText: documentType === 'sales_invoice'
      ? 'This is a Computer Generated Invoice'
      : 'This is a Computer Generated Document',
    showSignatory: true,
  };
}

/**
 * Map GET /vouchers/:guid `ledger_entries` into preview/PDF rows.
 * Tags Account / Through on money vouchers so Classic PDF + sheet UI stay consistent.
 */
function mapSyncedLedgerEntries(
  data: any,
  documentType: DocumentType,
  partyName?: string,
  totalAmount?: number
): LedgerEntry[] {
  const raw: any[] = data.ledger_entries || data.ledgerEntries || [];
  const entries: LedgerEntry[] = raw.map((e: any, i: number) => {
    const amt = Math.abs(num(e.amount));
    const drCr = String(e.dr_cr || e.drCr || '').toLowerCase();
    const isDr = drCr === 'dr' || drCr === 'debit' || (!drCr && num(e.amount) > 0);
    return {
      id: String(i),
      particulars: e.ledger_name || e.ledgerName || e.particulars || '—',
      ...(isDr ? { debit: amt } : { credit: amt }),
    };
  });

  const isMoney =
    documentType === 'receipt_voucher' ||
    documentType === 'payment_voucher' ||
    documentType === 'expense_voucher';

  if (isMoney && entries.length) {
    const partyLower = (partyName || '').toLowerCase();
    let accountIdx = partyLower
      ? entries.findIndex((e) => e.particulars.toLowerCase() === partyLower)
      : -1;
    if (accountIdx < 0) {
      accountIdx = documentType === 'receipt_voucher'
        ? entries.findIndex((e) => !!e.credit)
        : entries.findIndex((e) => !!e.debit);
    }
    let throughIdx = entries.findIndex((_, i) => i !== accountIdx);
    if (documentType === 'receipt_voucher') {
      throughIdx = entries.findIndex((e, i) => i !== accountIdx && !!e.debit);
    } else {
      throughIdx = entries.findIndex((e, i) => i !== accountIdx && !!e.credit);
    }
    if (throughIdx < 0) throughIdx = entries.findIndex((_, i) => i !== accountIdx);

    return entries.map((e, i) => ({
      ...e,
      reference:
        i === accountIdx ? 'Account' : i === throughIdx ? 'Through' : e.reference,
    }));
  }

  if (isMoney && !entries.length && (partyName || totalAmount)) {
    const amount = totalAmount || 0;
    const isReceipt = documentType === 'receipt_voucher';
    const out: LedgerEntry[] = [];
    if (partyName) {
      out.push({
        id: '0',
        particulars: partyName,
        reference: 'Account',
        ...(isReceipt ? { credit: amount } : { debit: amount }),
      });
    }
    return out;
  }

  return entries;
}

/** Maps the Tally-synced voucher payload from GET /vouchers/:guid. */
function isTaxOrRoundOffLedger(name: string): boolean {
  return /cgst|sgst|igst|utgst|\bcess\b|round\s*(ed)?\s*off/i.test(name);
}

function isBankOrCashLedger(name: string): boolean {
  return /\b(bank|cash|petty\s*cash|od\s*a\/?c|overdraft)\b/i.test(name);
}

/** Recover party when Tally left it null or stamped the bank on Receipt/Payment. */
function resolvePartyName(voucher: any, ledgerEntries: any[], documentType: string): string | undefined {
  const stored = String(voucher?.party_name || '').trim();
  const vt = String(voucher?.voucher_type || documentType || '');
  const isReceipt = /receipt/i.test(vt);
  const isPayment = /payment/i.test(vt);
  const purchase = /purchase|debit\s*note/i.test(vt);

  if (stored && !(isReceipt || isPayment) && !isBankOrCashLedger(stored)) return stored;
  if (stored && (isReceipt || isPayment) && !isBankOrCashLedger(stored)) return stored;

  const preferredSide = isReceipt ? 'cr' : isPayment || !purchase ? 'dr' : 'cr';
  const candidates = (ledgerEntries || [])
    .map((e) => ({
      name: String(e.ledger_name || e.ledgerName || '').trim(),
      amount: Math.abs(num(e.amount)),
      side: String(e.dr_cr || '').toLowerCase() || (num(e.amount) < 0 ? 'dr' : 'cr'),
    }))
    .filter((e) => e.name && !isTaxOrRoundOffLedger(e.name) && !isBankOrCashLedger(e.name));

  const preferred = candidates
    .filter((e) => e.side === preferredSide)
    .sort((a, b) => b.amount - a.amount);
  if (preferred[0]?.name) return preferred[0].name;
  candidates.sort((a, b) => b.amount - a.amount);
  return candidates[0]?.name || (stored && !isBankOrCashLedger(stored) ? stored : undefined);
}

/**
 * Tally prints the sales/purchase ledger under each goods line. Synced inventory
 * rows don't carry it — it lives on voucher_ledger_entries. Match a non-party,
 * non-tax ledger whose amount equals the line (or the goods total).
 */
function isRoundOffName(name: string): boolean {
  return /round\s*(ed)?\s*off/i.test(name);
}

/**
 * Extra lines Tally prints under the goods row: freight, packing, their tax,
 * and round-off. Prefer the app payload (`logistics`), then any synced ledger
 * that is not the party, the sales ledger, or CGST/SGST/IGST.
 */
function chargesFromSyncedVoucher(
  data: any,
  partyName: string,
  itemLedgerNames: Set<string>
): { additionalCharges: ChargeLine[]; roundOff: number; roundOffLabel?: string } {
  const additionalCharges: ChargeLine[] = [];
  let roundOff = 0;
  let roundOffLabel: string | undefined;
  const known = new Set<string>();

  const remember = (name: string) => {
    const key = name.trim().toLowerCase();
    if (key) known.add(key);
  };

  for (const l of Array.isArray(data.logistics) ? data.logistics : []) {
    const name = String(l.ledgerName || l.description || '').trim();
    if (!name) continue;
    const amount = num(l.amount);
    if (isRoundOffName(name)) {
      roundOff += amount;
      roundOffLabel = name;
      remember(name);
      continue;
    }
    const taxes = (Array.isArray(l.taxes) ? l.taxes : []).map((t: any) => {
      const description = String(t.ledgerName || t.description || 'Tax').trim();
      remember(description);
      return {
        description,
        rate: num(t.taxRate ?? t.rate),
        amount: num(t.taxAmount ?? t.amount),
      };
    }).filter((t: { amount: number }) => t.amount);
    additionalCharges.push({ description: name, amount, taxes });
    remember(name);
  }

  const skip = new Set<string>([partyName.trim().toLowerCase(), ...itemLedgerNames]);
  for (const e of data.ledger_entries || []) {
    const name = String(e.ledger_name || e.ledgerName || '').trim();
    const key = name.toLowerCase();
    if (!name || known.has(key) || skip.has(key)) continue;
    if (isBankOrCashLedger(name)) continue;
    if (/cgst|sgst|igst|utgst|\bcess\b/i.test(name)) continue;
    const signed = num(e.amount);
    if (!signed) continue;
    if (isRoundOffName(name)) {
      roundOff += signed;
      roundOffLabel = roundOffLabel || name;
      remember(name);
      continue;
    }
    additionalCharges.push({ description: name, amount: signed });
    remember(name);
  }

  return { additionalCharges, roundOff, roundOffLabel };
}

function salesLedgerByItemIndex(
  items: any[],
  ledgerEntries: any[],
  partyName?: string
): Map<number, string> {
  const out = new Map<number, string>();
  const party = String(partyName || '').trim().toLowerCase();
  const candidates = (ledgerEntries || [])
    .map((e) => ({
      name: String(e.ledger_name || e.ledgerName || '').trim(),
      amount: Math.abs(num(e.amount)),
    }))
    .filter((e) => e.name && e.name.toLowerCase() !== party && !isTaxOrRoundOffLedger(e.name) && !isBankOrCashLedger(e.name));

  const used = new Set<number>();
  items.forEach((item, i) => {
    const amt = Math.abs(num(item.amount));
    const idx = candidates.findIndex((c, ci) => !used.has(ci) && Math.abs(c.amount - amt) < 0.05);
    if (idx >= 0) {
      used.add(idx);
      out.set(i, candidates[idx].name);
    }
  });

  const missing = items.map((_, i) => i).filter((i) => !out.has(i));
  if (missing.length) {
    const sum = missing.reduce((s, i) => s + Math.abs(num(items[i].amount)), 0);
    const cover = candidates.findIndex((c, ci) => !used.has(ci) && Math.abs(c.amount - sum) < 0.05);
    if (cover >= 0) {
      for (const i of missing) out.set(i, candidates[cover].name);
    }
  }
  return out;
}

export function fromTallyVoucher(
  data: any,
  companyName: string,
  documentType: DocumentType,
  documentTitle: string,
  formatDate: (iso: string) => string,
  toWords: (n: number) => string
): VoucherDocument {
  const v = data.voucher || {};
  const gst = data.gst || null;
  const partyLedger = data.party || null;
  const co = data.company || null;
  const dd = data.dispatch_details || null;
  const collectPayment = data.collect_payment || null;
  const layout = deriveLayout(documentType);
  const partyName = resolvePartyName(v, data.ledger_entries || [], documentType);

  // party_amount is the per-party ledger entry; v.amount is wrong on
  // multi-party vouchers.
  const totalAmount = num(v.party_amount ?? v.amount);
  const ledgerEntries = mapSyncedLedgerEntries(
    data,
    documentType,
    partyName,
    totalAmount
  );
  const drTotal = ledgerEntries.reduce((s, e) => s + num(e.debit), 0);
  const crTotal = ledgerEntries.reduce((s, e) => s + num(e.credit), 0);
  const throughEntry = ledgerEntries.find((e) => e.reference === 'Through');

  const rawItems = data.items || [];
  const ledgerByIndex = salesLedgerByItemIndex(rawItems, data.ledger_entries || [], partyName);
  const items: ItemLine[] = rawItems.map((item: any, i: number) => ({
    id: String(item.id || i),
    name: item.stock_item_name || '—',
    hsn: item.hsn || undefined,
    qty: num(item.actual_qty, num(item.billed_qty)),
    unit: item.unit || 'Nos',
    rate: num(item.rate),
    discount: num(item.discount) || undefined,
    taxableAmount: num(item.amount),
    amount: num(item.amount),
    godown: item.godown_name || undefined,
    batch: item.batch_name || undefined,
    ledgerName:
      item.sales_ledger ||
      item.salesLedger ||
      item.purchaseLedger ||
      item.ledgerName ||
      ledgerByIndex.get(i) ||
      undefined,
  }));

  // Prefer gst_voucher_details when amounts are present. Many recent syncs leave
  // that row at 0 while CGST/SGST still sit on voucher_ledger_entries — fall back
  // so preview/PDF still show a tax breakdown.
  const gstCgst = num(gst?.cgst_amount);
  const gstSgst = num(gst?.sgst_amount);
  const gstIgst = num(gst?.igst_amount);
  const gstTaxable = num(gst?.taxable_amount);
  let taxes: TaxLine[] = [];
  if (gst && (gstCgst > 0 || gstSgst > 0 || gstIgst > 0 || gstTaxable > 0)) {
    taxes = [{
      description: gst.gst_reg_type ? `GST (${gst.gst_reg_type})` : 'GST',
      rate: 0,
      taxableAmount: gstTaxable,
      cgst: gstCgst || undefined,
      sgst: gstSgst || undefined,
      igst: gstIgst || undefined,
      total: gstCgst + gstSgst + gstIgst,
    }];
  } else {
    const taxFromLedgers = (data.ledger_entries || []).filter((e: any) =>
      /cgst|sgst|igst|utgst|\bcess\b/i.test(String(e.ledger_name || ''))
    );
    if (taxFromLedgers.length) {
      let cgst = 0, sgst = 0, igst = 0, cess = 0;
      for (const e of taxFromLedgers) {
        const amt = Math.abs(num(e.amount));
        const n = String(e.ledger_name || '').toLowerCase();
        if (n.includes('cgst')) cgst += amt;
        else if (n.includes('sgst') || n.includes('utgst')) sgst += amt;
        else if (n.includes('igst')) igst += amt;
        else if (n.includes('cess')) cess += amt;
      }
      const total = cgst + sgst + igst + cess;
      if (total > 0) {
        const goods = items.reduce((s, i) => s + Math.abs(i.amount), 0);
        taxes = [{
          description: 'GST',
          rate: 0,
          taxableAmount: goods > 0 ? goods : Math.max(0, totalAmount - total),
          cgst: cgst || undefined,
          sgst: sgst || undefined,
          igst: igst || undefined,
          cess: cess || undefined,
          total,
        }];
      }
    } else if (gst) {
      taxes = [{
        description: gst.gst_reg_type ? `GST (${gst.gst_reg_type})` : 'GST',
        rate: 0,
        taxableAmount: gstTaxable,
        cgst: gstCgst || undefined,
        sgst: gstSgst || undefined,
        igst: gstIgst || undefined,
        total: gstCgst + gstSgst + gstIgst,
      }];
    }
  }

  const taxTotal = taxes.reduce((s, t) => s + t.total, 0);
  const goodsTotal = items.reduce((s, i) => s + Math.abs(i.amount), 0);
  const taxableAmount = gstTaxable > 0
    ? gstTaxable
    : (goodsTotal > 0 ? goodsTotal : (taxTotal > 0 ? totalAmount - taxTotal : totalAmount));
  const itemLedgers = new Set(
    items.map((i) => (i.ledgerName || '').trim().toLowerCase()).filter(Boolean)
  );
  const { additionalCharges, roundOff, roundOffLabel } = chargesFromSyncedVoucher(
    data,
    partyName || '',
    itemLedgers
  );

  const tallyMeta: TallyMetadata = {
    referenceNo: v.reference || undefined,
    referenceDate: v.date || undefined,
    placeOfSupply: gst?.place_of_supply || dd?.ship_to_state || undefined,
    dispatchDocNo: dd?.transport_doc_no || undefined,
    dispatchedThrough: dd?.transporter_name || undefined,
    destination: dd?.ship_to_place || dd?.ship_to_destination || dd?.ship_to || undefined,
    motorVehicleNo: dd?.vehicle_number || undefined,
    transportMode: dd?.transport_mode_simple || dd?.transport_mode || undefined,
    paymentTerms: collectPayment?.mode || undefined,
    // Compliance identifiers Tally prints above the item grid once reported.
    irn: v.irn || undefined,
    ackNo: data.e_invoice?.ack_no || undefined,
    ackDate: data.e_invoice?.ack_date || undefined,
    ewayBillNo: v.ewb_number || data.e_way_bill?.ewb_no || undefined,
    ewayBillDate: data.e_way_bill?.ewb_date || undefined,
    ewayBillValidTill: data.e_way_bill?.valid_till || undefined,
  };

  return {
    id: v.guid || String(v.id),
    documentType,
    documentTitle,
    documentNumber: String(v.voucher_number || '—'),
    date: formatDate(v.date || ''),
    company: {
      name: companyName || co?.name || 'Company',
      address: [co?.address, co?.state, co?.country].filter(Boolean).join(', ') || '',
      gstin: co?.gstin || undefined,
      pan: co?.pan || undefined,
      state: co?.state || undefined,
      email: co?.email || undefined,
      phone: co?.phone || undefined,
    },
    party: partyName ? {
      name: partyName,
      gstin: partyLedger?.gstin || undefined,
      address: partyLedger?.address || undefined,
      phone: partyLedger?.phone || undefined,
      state: partyLedger?.state_name || undefined,
    } : undefined,
    billing: partyName ? {
      name: partyName,
      line1: partyLedger?.address || undefined,
      state: partyLedger?.state_name || undefined,
    } : undefined,
    shipping: dd?.ship_to || dd?.ship_to_address ? {
      name: partyName || undefined,
      line1: dd.ship_to_address || dd.ship_to_place || dd.ship_to,
      state: dd.ship_to_state || undefined,
    } : undefined,
    metadata: mapCardMetadata(tallyMeta, { items }),
    tallyMeta,
    items: items.length ? items : undefined,
    taxes: taxes.length ? taxes : undefined,
    additionalCharges: additionalCharges.length ? additionalCharges : undefined,
    ledgerEntries: ledgerEntries.length ? ledgerEntries : undefined,
    narration: v.narration || data.app_narration || undefined,
    reference: v.reference || undefined,
    dispatchDetails: dd || undefined,
    paymentDetails: collectPayment ? {
      mode: collectPayment.mode || '',
      ledgerName: collectPayment.ledgerName || throughEntry?.particulars || '',
      amount: num(collectPayment.amount, totalAmount),
      reference: collectPayment.reference || '',
    } : throughEntry ? {
      mode: throughEntry.particulars,
      ledgerName: throughEntry.particulars,
      amount: totalAmount,
    } : undefined,
    totals: {
      subtotal: taxableAmount > 0 ? taxableAmount : totalAmount,
      taxableAmount: taxableAmount > 0 ? taxableAmount : undefined,
      taxTotal: taxTotal > 0 ? taxTotal : undefined,
      roundOff: roundOff || undefined,
      roundOffLabel,
      cgstTotal: taxes[0]?.cgst,
      sgstTotal: taxes[0]?.sgst,
      igstTotal: taxes[0]?.igst,
      total: totalAmount,
      totalQty: items.reduce((s, i) => s + i.qty, 0) || undefined,
      totalInWords: toWords(totalAmount),
      drTotal: drTotal || undefined,
      crTotal: crTotal || undefined,
    },
    layout,
    footerInfo: {
      // Tally-synced vouchers carry no print profile, so fall back to the standard
      // wording rather than printing an invoice with no declaration at all.
      declaration: layout.showDeclaration ? DEFAULT_DECLARATION : undefined,
      receiverNote: layout.showReceivedInGoodCondition ? 'Recd. in Good Condition' : undefined,
      authorizedSignatory: companyName || co?.name || undefined,
      systemNote: layout.computerGeneratedText,
    },
  };
}
