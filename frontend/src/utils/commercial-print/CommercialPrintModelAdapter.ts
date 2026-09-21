import {
  DocumentType,
  VoucherDocument,
  ItemLine,
  PartyInfo,
  AddressInfo,
  HsnSummaryRow,
  TaxLine,
} from '../../types/document';
import { tallyWords } from '../pdf/words';
import { formatClassicDate, moneyFromNumber } from '../voucher-print/shared';
import {
  CommercialPrintModel,
  CommercialDocumentType,
  CommercialChargeLine,
} from './CommercialPrintModel';

const COMMERCIAL_DOC_TYPES = new Set<DocumentType>([
  'sales_invoice',
  'proforma_invoice',
  'purchase_invoice',
  'purchase_order',
  'sales_order',
  'credit_note',
  'debit_note',
  'delivery_note',
  'receipt_note',
  'quotation',
]);

const PURCHASE_DOC_TYPES = new Set<DocumentType>([
  'purchase_invoice',
  'purchase_order',
  'receipt_note',
]);

const DOC_TO_PRINT: Record<string, CommercialDocumentType> = {
  sales_invoice: 'SalesInvoice',
  proforma_invoice: 'ProformaInvoice',
  purchase_invoice: 'PurchaseInvoice',
  purchase_order: 'PurchaseOrder',
  sales_order: 'SalesOrder',
  credit_note: 'CreditNote',
  debit_note: 'DebitNote',
  delivery_note: 'DeliveryNote',
  receipt_note: 'ReceiptNote',
  quotation: 'Quotation',
};

const DEFAULT_TITLE: Record<CommercialDocumentType, string> = {
  SalesInvoice: 'TAX INVOICE',
  ProformaInvoice: 'PROFORMA INVOICE',
  PurchaseInvoice: 'PURCHASE INVOICE',
  PurchaseOrder: 'PURCHASE ORDER',
  SalesOrder: 'SALES ORDER',
  CreditNote: 'CREDIT NOTE',
  DebitNote: 'DEBIT NOTE',
  DeliveryNote: 'DELIVERY NOTE',
  ReceiptNote: 'RECEIPT NOTE',
  Quotation: 'QUOTATION',
};

const DOC_NUMBER_LABEL: Record<CommercialDocumentType, string> = {
  SalesInvoice: 'Invoice No.',
  ProformaInvoice: 'Proforma No.',
  PurchaseInvoice: 'Invoice No.',
  PurchaseOrder: 'Purchase Order No.',
  SalesOrder: 'Sales Order No.',
  CreditNote: 'Credit Note No.',
  DebitNote: 'Debit Note No.',
  DeliveryNote: 'Delivery Note No.',
  ReceiptNote: 'Receipt Note No.',
  Quotation: 'Quotation No.',
};

export function isCommercialDocumentType(t: DocumentType | string | undefined): boolean {
  return !!t && COMMERCIAL_DOC_TYPES.has(t as DocumentType);
}

function splitAddress(address?: string): string[] {
  if (!address) return [];
  return address
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function addressFromInfo(info?: AddressInfo | PartyInfo | null): string[] {
  if (!info) return [];
  if ('address' in info && info.address) return splitAddress(info.address);
  const lines: string[] = [];
  if ('line1' in info && info.line1) lines.push(info.line1);
  const city = 'city' in info ? info.city : undefined;
  const state = 'state' in info ? info.state : undefined;
  const pincode = 'pincode' in info ? info.pincode : undefined;
  const cityLine = [city, state, pincode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  return lines;
}

function partyBlock(
  role: string,
  label: string,
  source?: PartyInfo | AddressInfo | null,
  dispatch?: VoucherDocument['dispatchDetails']
): CommercialPrintModel['parties'][number] | null {
  if (!source && !dispatch) return null;

  let name = '';
  let addressLines: string[] = [];
  let city: string | null = null;
  let state: string | null = null;
  let stateCode: string | null = null;
  let gstin: string | null = null;
  let pan: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;

  if (source) {
    name = source.name || ('line1' in source ? source.line1 || '' : '');
    addressLines = addressFromInfo(source);
    city = 'city' in source ? source.city || null : null;
    state = 'state' in source ? source.state || null : null;
    stateCode = 'stateCode' in source ? source.stateCode || null : null;
    gstin = 'gstin' in source ? source.gstin || null : null;
    pan = 'pan' in source ? source.pan || null : null;
    email = 'email' in source ? source.email || null : null;
    phone = 'phone' in source ? source.phone || null : null;
  }

  if (dispatch && role === 'consignee') {
    if (dispatch.ship_to) name = dispatch.ship_to;
    if (dispatch.ship_to_address) {
      addressLines = splitAddress(dispatch.ship_to_address);
    }
    if (dispatch.ship_to_place) city = dispatch.ship_to_place;
    if (dispatch.ship_to_state) state = dispatch.ship_to_state;
  }

  if (!name && addressLines.length === 0) return null;

  return {
    role,
    label,
    name,
    addressLines,
    city,
    state,
    stateCode,
    gstin,
    pan,
    email,
    phone,
  };
}

function mapParties(doc: VoucherDocument, isPurchase: boolean): CommercialPrintModel['parties'] {
  const parties: CommercialPrintModel['parties'] = [];
  const dispatch = doc.dispatchDetails;
  const companyAsParty = doc.company
    ? ({
        name: doc.company.name,
        address: doc.company.address,
        gstin: doc.company.gstin,
        pan: doc.company.pan,
        state: doc.company.state,
        stateCode: doc.company.stateCode,
        email: doc.company.email,
        phone: doc.company.phone,
      } as PartyInfo)
    : null;

  if (isPurchase) {
    // Tally Prime: Consignee (Ship to) then Supplier (Bill from)
    const consigneeSource =
      doc.shipping || dispatch?.ship_to
        ? ({
            name: doc.shipping?.name || dispatch?.ship_to || '',
            line1: doc.shipping?.line1 || dispatch?.ship_to_address,
            city: doc.shipping?.city || dispatch?.ship_to_place,
            state: doc.shipping?.state || dispatch?.ship_to_state,
            pincode: doc.shipping?.pincode,
            gstin: (doc.shipping as any)?.gstin,
            email: (doc.shipping as any)?.email,
          } as AddressInfo)
        : companyAsParty;
    const consignee = partyBlock('consignee', 'Consignee (Ship to)', consigneeSource, dispatch);
    if (consignee) parties.push(consignee);

    const supplier = partyBlock('supplier', 'Supplier (Bill from)', doc.party);
    if (supplier) parties.push(supplier);
    return parties;
  }

  const consigneeSource = doc.shipping || dispatch?.ship_to
    ? ({
        name: doc.shipping?.name || dispatch?.ship_to || '',
        line1: doc.shipping?.line1 || dispatch?.ship_to_address,
        city: doc.shipping?.city || dispatch?.ship_to_place,
        state: doc.shipping?.state || dispatch?.ship_to_state,
        pincode: doc.shipping?.pincode,
      } as AddressInfo)
    : doc.party;

  const consignee = partyBlock('consignee', 'Consignee (Ship to)', consigneeSource, dispatch);
  if (consignee) parties.push(consignee);

  const buyer = partyBlock('buyer', 'Buyer (Bill to)', doc.party || doc.billing);
  if (buyer) parties.push(buyer);

  return parties;
}

function mapReferences(
  doc: VoucherDocument,
  printType: CommercialDocumentType
): CommercialPrintModel['references'] {
  const meta = doc.metadata || {};
  const tally = doc.tallyMeta || {};
  const dispatch = doc.dispatchDetails || {};
  const extra: Array<{ label: string; value: string }> = [];

  const placeOfSupply = meta.placeOfSupply || (tally as any).placeOfSupply;
  if (placeOfSupply) extra.push({ label: 'Place of Supply', value: String(placeOfSupply) });

  const validUntil =
    (meta as any).validUntil ||
    (meta as any).validityDate ||
    meta.dueDate ||
    tally.ewayBillValidTill ||
    null;

  const reason =
    tally.adjustmentReason ||
    (meta as any).reason ||
    (meta as any).reasonForNote ||
    null;

  return {
    eWayBillNo: tally.ewayBillNo || meta.eway || null,
    deliveryNoteNo: tally.deliveryNoteNo || null,
    deliveryNoteDate: tally.deliveryNoteDate ? formatClassicDate(tally.deliveryNoteDate) : null,
    paymentTerms: tally.paymentTerms || meta.paymentTerms || null,
    referenceNo: tally.referenceNo || doc.reference || null,
    referenceDate: tally.referenceDate ? formatClassicDate(tally.referenceDate) : null,
    otherReferences: tally.otherReferences || null,
    buyerOrderNo: tally.buyersOrderNo || meta.orderRef || null,
    buyerOrderDate: tally.buyersOrderDate ? formatClassicDate(tally.buyersOrderDate) : null,
    supplierInvoiceNo: tally.supplierInvoiceNo || null,
    supplierInvoiceDate: tally.supplierInvoiceDate
      ? formatClassicDate(tally.supplierInvoiceDate)
      : null,
    originalInvoiceNo: tally.originalInvoiceNo || meta.invoiceRef || null,
    originalInvoiceDate: tally.originalInvoiceDate
      ? formatClassicDate(tally.originalInvoiceDate)
      : null,
    dispatchDocNo: tally.dispatchDocNo || dispatch.transport_doc_no || null,
    dispatchThrough: tally.dispatchedThrough || dispatch.transporter_name || null,
    lrRrNo: tally.billOfLadingNo || dispatch.transport_doc_no || null,
    destination: tally.destination || dispatch.ship_to_destination || null,
    motorVehicleNo: tally.motorVehicleNo || meta.vehicleNo || dispatch.vehicle_number || null,
    termsOfDelivery: tally.termsOfDelivery || meta.deliveryTerms || null,
    expectedDeliveryDate: meta.dueDate && printType !== 'Quotation'
      ? formatClassicDate(meta.dueDate)
      : null,
    validUntil: validUntil ? formatClassicDate(String(validUntil)) : null,
    reasonForNote: reason ? String(reason) : null,
    extra: extra.length ? extra : undefined,
  };
}

function mapItems(items: ItemLine[] = []): CommercialPrintModel['items'] {
  return items.map((item, idx) => {
    const ext = item as ItemLine & {
      secondaryQty?: number;
      alternateQty?: number;
      secondaryUnit?: string;
      alternateUnit?: string;
    };
    const secQty = ext.secondaryQty ?? ext.alternateQty;
    const descLines: string[] = [];
    if (item.description && item.description !== item.name) {
      descLines.push(item.description);
    }

    return {
      sequence: idx + 1,
      itemGuid: item.id || null,
      description: item.name || item.description || '',
      additionalDescriptionLines: descLines.length ? descLines : undefined,
      hsnSac: item.hsn || null,
      quantity: moneyFromNumber(item.qty),
      unit: item.unit || null,
      secondaryQuantity: secQty != null ? moneyFromNumber(secQty) : null,
      secondaryUnit: ext.secondaryUnit || ext.alternateUnit || null,
      rate: item.rate != null ? moneyFromNumber(item.rate) : null,
      ratePer: item.unit || null,
      discountPercent:
        item.discount != null && (item.discountType === '%' || !item.discountType)
          ? moneyFromNumber(item.discount)
          : null,
      discountAmount: item.discountAmount != null ? moneyFromNumber(item.discountAmount) : null,
      taxableAmount: item.taxableAmount != null ? moneyFromNumber(item.taxableAmount) : null,
      amount: moneyFromNumber(item.amount),
    };
  });
}

function mapCharges(doc: VoucherDocument): CommercialChargeLine[] {
  const rows: CommercialChargeLine[] = [];
  let seq = 1;
  for (const c of doc.additionalCharges || []) {
    if (!c.description && !c.amount) continue;
    rows.push({
      sequence: seq++,
      label: c.description || 'Charge',
      amount: moneyFromNumber(c.amount),
      taxable: !!(c.taxes && c.taxes.length > 0),
    });
    for (const t of c.taxes || []) {
      if (!t.amount) continue;
      rows.push({
        sequence: seq++,
        label: t.description || 'Tax',
        amount: moneyFromNumber(t.amount),
        rate: t.rate ? moneyFromNumber(t.rate) : null,
      });
    }
  }
  const roundOff = doc.totals?.roundOff;
  if (roundOff) {
    rows.push({
      sequence: seq++,
      label: doc.totals?.roundOffLabel || 'Round Off',
      amount: moneyFromNumber(roundOff),
    });
  }
  return rows;
}

function mapTaxSummary(
  hsnSummary?: HsnSummaryRow[],
  taxes?: TaxLine[]
): CommercialPrintModel['taxSummary'] {
  if (hsnSummary && hsnSummary.length > 0) {
    return hsnSummary.map((row, idx) => ({
      sequence: idx + 1,
      hsnSac: row.hsn,
      taxableValue: moneyFromNumber(row.taxableAmount),
      cgstRate: row.taxPct != null && row.cgst ? moneyFromNumber(row.taxPct / 2) : null,
      cgstAmount: row.cgst ? moneyFromNumber(row.cgst) : null,
      sgstRate: row.taxPct != null && row.sgst ? moneyFromNumber(row.taxPct / 2) : null,
      sgstAmount: row.sgst ? moneyFromNumber(row.sgst) : null,
      igstRate: row.igst > 0 && row.taxPct != null ? moneyFromNumber(row.taxPct) : null,
      igstAmount: row.igst > 0 ? moneyFromNumber(row.igst) : null,
      cessRate: null,
      cessAmount: row.cess ? moneyFromNumber(row.cess) : null,
      totalTaxAmount: moneyFromNumber(row.totalTax),
    }));
  }

  if (taxes && taxes.length > 0) {
    return taxes.map((t, idx) => ({
      sequence: idx + 1,
      hsnSac: t.description || '',
      taxableValue: moneyFromNumber(t.taxableAmount),
      cgstRate: t.cgst && t.rate ? moneyFromNumber(t.rate / 2) : null,
      cgstAmount: t.cgst != null ? moneyFromNumber(t.cgst) : null,
      sgstRate: t.sgst && t.rate ? moneyFromNumber(t.rate / 2) : null,
      sgstAmount: t.sgst != null ? moneyFromNumber(t.sgst) : null,
      igstRate: t.igst && t.rate ? moneyFromNumber(t.rate) : null,
      igstAmount: t.igst != null ? moneyFromNumber(t.igst) : null,
      cessRate: t.cess && t.rate ? moneyFromNumber(t.rate) : null,
      cessAmount: t.cess != null ? moneyFromNumber(t.cess) : null,
      totalTaxAmount: moneyFromNumber(t.total),
    }));
  }

  return [];
}

/**
 * Spec: Proforma must always print PROFORMA INVOICE (source PDFs may say TAX INVOICE).
 * Quotation / CN / DN / etc. always use locked titles — never invent from stray titles.
 */
function resolveTitle(doc: VoucherDocument, printType: CommercialDocumentType): string {
  if (
    printType === 'ProformaInvoice' ||
    printType === 'Quotation' ||
    printType === 'CreditNote' ||
    printType === 'DebitNote' ||
    printType === 'DeliveryNote' ||
    printType === 'ReceiptNote'
  ) {
    return DEFAULT_TITLE[printType];
  }
  if (doc.layout?.title) {
    const t = doc.layout.title.toUpperCase();
    if (printType === 'SalesInvoice' && /PROFORMA/i.test(t)) return DEFAULT_TITLE.SalesInvoice;
    return t;
  }
  return DEFAULT_TITLE[printType];
}

function extractDistrict(addressLines: string[]): string | null {
  for (const line of addressLines) {
    const m = line.match(/^Distt?:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return null;
}

function resolveTaxAmountInWords(totals: VoucherDocument['totals']): string {
  if (totals.taxAmountInWords) return totals.taxAmountInWords;
  const tax = totals.taxTotal ?? 0;
  if (!tax || Math.abs(tax) < 0.005) return 'NIL';
  return tallyWords(tax);
}

function isNonValuedQtyNote(
  printType: CommercialDocumentType,
  items: ItemLine[],
  grandTotal: number
): boolean {
  if (printType !== 'DeliveryNote' && printType !== 'ReceiptNote') return false;
  if (Math.abs(grandTotal) < 0.005) return true;
  if (!items.length) return true;
  return items.every((i) => !(i.rate > 0) && !(i.amount > 0));
}

/**
 * Build the canonical commercial print model from the mobile VoucherDocument.
 * Templates must not re-map accounting; this adapter is the only mapper.
 */
export function toCommercialPrintModel(
  doc: VoucherDocument,
  opts: { companyGuid?: string; tenantId?: string; logoUrl?: string | null } = {}
): CommercialPrintModel {
  const printType = DOC_TO_PRINT[doc.documentType];
  if (!printType) {
    throw new Error(`Document type ${doc.documentType} is not a commercial document.`);
  }

  const isPurchase =
    PURCHASE_DOC_TYPES.has(doc.documentType) || doc.layout?.partyRole === 'supplier';

  const company = doc.company || ({} as VoucherDocument['company']);
  const addressLines = splitAddress(company.address);
  const district = extractDistrict(addressLines);
  const filteredAddress = addressLines.filter((l) => !/^Distt?:/i.test(l));

  const totals = doc.totals || ({} as VoucherDocument['totals']);
  const grandTotal = totals.total ?? 0;
  const buyerParty = doc.party;
  const items = doc.items || [];
  const hideItemAmounts = isNonValuedQtyNote(printType, items, grandTotal);
  const nonPosting =
    printType === 'ProformaInvoice' || printType === 'Quotation';

  const mappedItems = mapItems(items);
  const secondaryTotal = mappedItems.reduce((sum, it) => {
    const n = parseFloat(String(it.secondaryQuantity || '').replace(/,/g, ''));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const parties = mapParties(doc, isPurchase);
  const supplierParty = parties.find((p) => p.role === 'supplier');
  const authorisedFor =
    isPurchase && supplierParty?.name
      ? supplierParty.name
      : company.name || null;

  // Purchase footer IDs in Tally samples: Company's GSTIN (supplier) + Buyer's PAN (own)
  const footerCompanyGstin = isPurchase
    ? supplierParty?.gstin || company.gstin || null
    : company.gstin || null;
  const footerCompanyPan = isPurchase ? null : company.pan || null;
  const footerBuyerPan = isPurchase
    ? company.pan || null
    : buyerParty?.pan || doc.party?.pan || null;

  const declarationText =
    doc.footerInfo?.declaration || company.declarationText || null;

  const computerGenerated =
    doc.layout?.computerGeneratedText ||
    doc.footerInfo?.systemNote ||
    (nonPosting
      ? 'This is a Computer Generated Document'
      : printType === 'SalesInvoice'
        ? 'This is a Computer Generated Invoice'
        : 'This is a Computer Generated Document');

  return {
    schemaVersion: 1,
    identity: {
      tenantId: opts.tenantId || '',
      companyGuid: opts.companyGuid || '',
      documentGuid: doc.id || '',
      documentType: printType,
      title: resolveTitle(doc, printType),
      documentNumber: doc.documentNumber || '',
      date: formatClassicDate(doc.date),
    },
    company: {
      name: company.name || '',
      addressLines: filteredAddress,
      district,
      state: company.state || null,
      stateName: company.state || null,
      stateCode: company.stateCode || null,
      gstin: company.gstin || null,
      pan: company.pan || null,
      email: company.email || null,
      phone: company.phone || null,
      logoUrl: opts.logoUrl || null,
      extraPrintLines: [],
    },
    parties,
    references: mapReferences(doc, printType),
    items: mappedItems,
    charges: mapCharges(doc),
    taxSummary: mapTaxSummary(doc.hsnSummary, doc.taxes),
    totals: {
      primaryQuantity:
        totals.totalQty != null
          ? moneyFromNumber(totals.totalQty)
          : moneyFromNumber(items.reduce((s, i) => s + (i.qty || 0), 0)),
      secondaryQuantity: secondaryTotal > 0 ? moneyFromNumber(secondaryTotal) : null,
      taxableValue: totals.taxableAmount != null ? moneyFromNumber(totals.taxableAmount) : null,
      taxAmount: totals.taxTotal != null ? moneyFromNumber(totals.taxTotal) : null,
      grandTotal: moneyFromNumber(grandTotal),
      currencyCode: 'INR',
      currencySymbol: '\u20B9',
    },
    amountInWords: totals.totalInWords || tallyWords(grandTotal),
    taxAmountInWords: resolveTaxAmountInWords(totals),
    narration: doc.narration || null,
    terms: doc.terms || null,
    legal: {
      showEoe: true,
      companyPan: footerCompanyPan,
      companyGstin: footerCompanyGstin,
      buyerPan: footerBuyerPan,
      declaration: declarationText,
      jurisdiction: company.jurisdiction || null,
      computerGeneratedText: computerGenerated,
      authorisedFor,
      authorisedSignatoryLabel:
        doc.footerInfo?.authorizedSignatory || 'Authorised Signatory',
    },
    flags: {
      hideItemAmounts,
      nonPostingDocument: nonPosting,
      documentNumberLabel: DOC_NUMBER_LABEL[printType],
    },
  };
}

export function commercialTitle(type: CommercialDocumentType): string {
  return DEFAULT_TITLE[type];
}
