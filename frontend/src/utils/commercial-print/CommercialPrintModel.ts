/**
 * Canonical print model for commercial documents (invoices, orders, notes, quotations).
 * All three PDF templates consume this model only.
 * Spec: TallyDekho_Commercial_PDF_3_Layout_Implementation_Spec_v1.md §11
 */

/** Decimal money as a string — never use JS floats for accounting math. */
export type Money = string;

export type CommercialChargeLine = {
  sequence: number;
  label: string;
  amount: Money;
  /** Present on tax-on-charge rows (GST on freight, etc.). */
  rate?: Money | null;
  taxable?: boolean;
};

export type CommercialDocumentType =
  | 'SalesInvoice'
  | 'ProformaInvoice'
  | 'PurchaseInvoice'
  | 'PurchaseOrder'
  | 'SalesOrder'
  | 'CreditNote'
  | 'DebitNote'
  | 'DeliveryNote'
  | 'ReceiptNote'
  | 'Quotation';

export type CommercialPrintModel = {
  schemaVersion: 1;

  identity: {
    tenantId: string;
    companyGuid: string;
    documentGuid: string;
    documentType: CommercialDocumentType;
    title: string;
    documentNumber: string;
    date: string;
  };

  company: {
    name: string;
    addressLines: string[];
    district?: string | null;
    state?: string | null;
    stateName?: string | null;
    stateCode?: string | null;
    country?: string | null;
    gstin?: string | null;
    pan?: string | null;
    email?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
    extraPrintLines?: string[];
  };

  parties: Array<{
    role: string;
    label: string;
    name: string;
    addressLines: string[];
    city?: string | null;
    district?: string | null;
    state?: string | null;
    stateCode?: string | null;
    country?: string | null;
    gstin?: string | null;
    pan?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;

  references: {
    eWayBillNo?: string | null;
    deliveryNoteNo?: string | null;
    deliveryNoteDate?: string | null;
    paymentTerms?: string | null;
    referenceNo?: string | null;
    referenceDate?: string | null;
    otherReferences?: string | null;
    buyerOrderNo?: string | null;
    buyerOrderDate?: string | null;
    supplierInvoiceNo?: string | null;
    supplierInvoiceDate?: string | null;
    originalInvoiceNo?: string | null;
    originalInvoiceDate?: string | null;
    dispatchDocNo?: string | null;
    dispatchThrough?: string | null;
    lrRrNo?: string | null;
    destination?: string | null;
    motorVehicleNo?: string | null;
    termsOfDelivery?: string | null;
    expectedDeliveryDate?: string | null;
    validUntil?: string | null;
    reasonForNote?: string | null;
    extra?: Array<{ label: string; value: string }>;
  };

  items: Array<{
    sequence: number;
    itemGuid?: string | null;
    description: string;
    additionalDescriptionLines?: string[];
    hsnSac?: string | null;
    quantity: Money;
    unit?: string | null;
    secondaryQuantity?: Money | null;
    secondaryUnit?: string | null;
    rate?: Money | null;
    ratePer?: string | null;
    discountPercent?: Money | null;
    discountAmount?: Money | null;
    taxableAmount?: Money | null;
    amount: Money;
  }>;

  charges: CommercialChargeLine[];

  taxSummary: Array<{
    sequence: number;
    hsnSac: string;
    taxableValue: Money;
    cgstRate?: Money | null;
    cgstAmount?: Money | null;
    sgstRate?: Money | null;
    sgstAmount?: Money | null;
    igstRate?: Money | null;
    igstAmount?: Money | null;
    cessRate?: Money | null;
    cessAmount?: Money | null;
    totalTaxAmount?: Money | null;
  }>;

  totals: {
    primaryQuantity?: Money | null;
    secondaryQuantity?: Money | null;
    taxableValue?: Money | null;
    taxAmount?: Money | null;
    grandTotal: Money;
    currencyCode?: string | null;
    currencySymbol?: string | null;
  };

  amountInWords?: string | null;
  taxAmountInWords?: string | null;

  narration?: string | null;
  terms?: string | null;

  legal: {
    showEoe?: boolean;
    companyPan?: string | null;
    companyGstin?: string | null;
    buyerPan?: string | null;
    declaration?: string | null;
    jurisdiction?: string | null;
    computerGeneratedText?: string | null;
    authorisedFor?: string | null;
    authorisedSignatoryLabel?: string | null;
  };

  /** Presentation flags — never invent accounting; only hide empty presentation. */
  flags?: {
    /** Delivery Note without values — hide rate/amount columns. */
    hideItemAmounts?: boolean;
    /** Proforma / Quotation — footer must not imply posting. */
    nonPostingDocument?: boolean;
    /** Label for document number cell (Invoice No. / Quotation No. / …). */
    documentNumberLabel?: string;
  };
};
