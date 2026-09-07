/**
 * Offline Spec QA — renders all 9 commercial types × 3 templates.
 * Run: npx tsx src/utils/commercial-print/qaSpecCheck.ts
 */
import {
  toCommercialPrintModel,
  renderCommercialPrintHtml,
  COMMERCIAL_TEMPLATE_IDS,
} from './index';
import { VoucherDocument, DocumentType } from '../../types/document';

const TYPES: { docType: DocumentType; printTitle: string }[] = [
  { docType: 'sales_invoice', printTitle: 'TAX INVOICE' },
  { docType: 'proforma_invoice', printTitle: 'PROFORMA INVOICE' },
  { docType: 'purchase_invoice', printTitle: 'PURCHASE INVOICE' },
  { docType: 'purchase_order', printTitle: 'PURCHASE ORDER' },
  { docType: 'sales_order', printTitle: 'SALES ORDER' },
  { docType: 'credit_note', printTitle: 'CREDIT NOTE' },
  { docType: 'debit_note', printTitle: 'DEBIT NOTE' },
  { docType: 'delivery_note', printTitle: 'DELIVERY NOTE' },
  { docType: 'quotation', printTitle: 'QUOTATION' },
];

function sampleDoc(docType: DocumentType, opts: { zeroAmounts?: boolean } = {}): VoucherDocument {
  const rate = opts.zeroAmounts ? 0 : 500;
  const amount = opts.zeroAmounts ? 0 : 5000;
  return {
    id: `qa-${docType}`,
    documentType: docType,
    documentTitle: docType === 'proforma_invoice' ? 'TAX INVOICE' : undefined, // trap: must not win for Proforma
    documentNumber: 'QA/001',
    date: '2026-09-04',
    company: {
      name: 'Yash Ki Company',
      address: 'New Bus Stand, Rajgarh\nDistt: Dhar',
      gstin: '23ACLPP1226E1ZZ',
      pan: 'ACLPP1226E',
      state: 'Madhya Pradesh',
      stateCode: '23',
      email: 'accounts@example.com',
      jurisdiction: 'SUBJECT TO SARDARPUR JURISDICTION',
      declarationText: 'We declare that this invoice shows the actual price.',
    },
    party: {
      name: 'Sample Buyer',
      address: 'Delhi',
      gstin: '07AABCD1234E1ZP',
      pan: 'AABCD1234E',
      state: 'Delhi',
      stateCode: '07',
    },
    items: [
      {
        id: '1',
        name: 'Maize White 2002 1 KG',
        hsn: '1005',
        qty: 5000,
        unit: 'nos',
        rate,
        discount: opts.zeroAmounts ? 0 : 25,
        discountType: '%',
        amount,
        taxableAmount: amount,
        secondaryQty: 5000,
        secondaryUnit: 'kg',
      } as any,
    ],
    taxes: opts.zeroAmounts
      ? []
      : [{ description: 'CGST', rate: 9, taxableAmount: amount, cgst: 450, total: 450 }],
    hsnSummary: opts.zeroAmounts
      ? []
      : [{ hsn: '1005', taxableAmount: amount, taxPct: 18, cgst: 450, sgst: 450, igst: 0, cess: 0, totalTax: 900 }],
    additionalCharges: opts.zeroAmounts ? [] : [{ description: 'Packing Material Expenses', amount: 100 }],
    totals: {
      subtotal: amount,
      taxableAmount: amount,
      taxTotal: opts.zeroAmounts ? 0 : 900,
      total: opts.zeroAmounts ? 0 : amount + 900 + 100,
      totalQty: 5000,
    },
    metadata: {
      orderRef: 'PO-99',
      invoiceRef: 'INV-ORIG-1',
      paymentTerms: '30 Days',
      placeOfSupply: 'Delhi',
      validUntil: '2026-10-04',
      dueDate: '2026-10-04',
    } as any,
    tallyMeta: {
      buyersOrderNo: 'BO-1',
      originalInvoiceNo: 'INV-ORIG-1',
      adjustmentReason: 'Rate difference',
      ewayBillNo: 'EWB123',
      destination: 'Delhi',
      motorVehicleNo: 'MP09AB1234',
      dispatchedThrough: 'Road',
    } as any,
    narration: 'QA sample',
    terms: 'Payment due in 30 days',
  } as VoucherDocument;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let failures = 0;
const results: string[] = [];

for (const { docType, printTitle } of TYPES) {
  const zero = docType === 'delivery_note';
  const doc = sampleDoc(docType, { zeroAmounts: zero });
  try {
    const model = toCommercialPrintModel(doc, { companyGuid: 'qa-co' });
    assert(model.identity.title === printTitle, `${docType}: title want ${printTitle} got ${model.identity.title}`);
    assert(model.items.length === 1, `${docType}: items`);
    assert(!!model.items[0].secondaryQuantity, `${docType}: secondary qty must not drop`);
    if (docType === 'proforma_invoice' || docType === 'quotation') {
      assert(!!model.flags?.nonPostingDocument, `${docType}: nonPosting`);
    }
    if (docType === 'delivery_note') {
      assert(!!model.flags?.hideItemAmounts, `${docType}: hide amounts`);
    }
    if (docType === 'credit_note' || docType === 'debit_note') {
      assert(!!model.references.originalInvoiceNo, `${docType}: original invoice`);
      assert(!!model.references.reasonForNote, `${docType}: reason`);
    }
    if (docType === 'quotation') {
      assert(!!model.references.validUntil, `${docType}: valid until`);
    }
    assert(!!model.taxAmountInWords, `${docType}: tax words`);

    // Tally Prime Classic party profiles — strict for SI/PI/SO/PO; softer for other sales-path types
    const tallyCore = [
      'sales_invoice',
      'purchase_invoice',
      'sales_order',
      'purchase_order',
    ].includes(docType);
    const salesPathClassic = [
      'sales_invoice',
      'sales_order',
      'proforma_invoice',
      'credit_note',
      'debit_note',
      'delivery_note',
      'quotation',
    ].includes(docType);
    if (tallyCore) {
      if (docType === 'purchase_invoice' || docType === 'purchase_order') {
        assert(
          model.parties.some((p) => p.role === 'consignee'),
          `${docType}: Consignee party`
        );
        assert(
          model.parties.some((p) => p.role === 'supplier'),
          `${docType}: Supplier party`
        );
        assert(
          model.legal.authorisedFor === 'Sample Buyer',
          `${docType}: signatory for supplier`
        );
      } else {
        assert(
          model.parties.some((p) => p.role === 'consignee'),
          `${docType}: Consignee party`
        );
        assert(
          model.parties.some((p) => p.role === 'buyer'),
          `${docType}: Buyer party`
        );
        assert(
          model.legal.authorisedFor === 'Yash Ki Company',
          `${docType}: signatory for own company`
        );
      }
    } else if (salesPathClassic) {
      assert(
        model.parties.some((p) => p.role === 'consignee'),
        `${docType}: Consignee party`
      );
      assert(
        model.parties.some((p) => p.role === 'buyer'),
        `${docType}: Buyer party`
      );
      assert(
        !model.parties.some((p) => p.role === 'supplier'),
        `${docType}: no Supplier on sales-path`
      );
      assert(
        model.legal.authorisedFor === 'Yash Ki Company',
        `${docType}: signatory for own company`
      );
    }

    for (const tid of COMMERCIAL_TEMPLATE_IDS) {
      const html = renderCommercialPrintHtml(model, tid);
      assert(html.includes(printTitle), `${docType}/${tid}: title in HTML`);
      assert(html.includes('Maize White'), `${docType}/${tid}: item`);
      assert(html.includes('5000') || html.includes('5,000'), `${docType}/${tid}: secondary qty`);
      // HSN column kept for all commercial types (including non-valued DN)
      assert(html.includes('HSN') || html.includes('1005'), `${docType}/${tid}: HSN`);
      if (tid === 'td_thermal_commercial_v1') {
        assert(html.includes('width:72mm'), `${docType}/thermal: 80mm css width`);
        assert(html.includes('Authorised Signatory'), `${docType}/thermal: signatory`);
        assert(html.includes('HSN/SAC') || html.includes('HSN'), `${docType}/thermal: HSN`);
        if (docType === 'delivery_note') {
          assert(html.includes('amounts not applicable'), `${docType}/thermal: hide amounts`);
        }
        if (docType === 'credit_note' || docType === 'debit_note') {
          assert(html.includes('Reason') || html.includes('Original'), `${docType}/thermal: note meta`);
        }
        const html58 = renderCommercialPrintHtml(model, tid, { paperWidth: 58 });
        assert(html58.includes('width:48mm'), `${docType}/thermal: 58mm css width`);
      }
      if (tid === 'tally_classic_commercial_v1') {
        assert(html.includes('Description of Goods'), `${docType}/classic: goods column`);
        assert(html.includes('HSN/SAC'), `${docType}/classic: HSN column`);
        assert(html.includes('Authorised Signatory'), `${docType}/classic: signatory`);
        // Company sits in left header cell — not a separate centered letterhead under title
        assert(
          !html.includes('text-align:center;padding:4px 0 6px'),
          `${docType}/classic: no centered letterhead banner`
        );
        if (tallyCore) {
          assert(html.includes('Consignee'), `${docType}/classic: Consignee label`);
          if (docType === 'purchase_invoice' || docType === 'purchase_order') {
            assert(html.includes('Supplier'), `${docType}/classic: Supplier label`);
            assert(html.includes('for <b>Sample Buyer</b>'), `${docType}/classic: for supplier`);
          } else {
            assert(html.includes('Buyer'), `${docType}/classic: Buyer label`);
            assert(html.includes('for <b>Yash Ki Company</b>'), `${docType}/classic: for own co`);
          }
        } else if (salesPathClassic) {
          assert(html.includes('Consignee'), `${docType}/classic: Consignee label`);
          assert(html.includes('Buyer'), `${docType}/classic: Buyer label`);
          assert(html.includes('for <b>Yash Ki Company</b>'), `${docType}/classic: for own co`);
          assert(!html.includes('Supplier (Bill from)'), `${docType}/classic: no Supplier`);
        }
        if (docType === 'credit_note' || docType === 'debit_note') {
          assert(html.includes('Reason for Note'), `${docType}/classic: note reason meta`);
          assert(html.includes('Original Invoice'), `${docType}/classic: original invoice meta`);
        }
        if (docType === 'quotation' || docType === 'proforma_invoice') {
          assert(html.includes('Valid Until'), `${docType}/classic: valid until meta`);
        }
        if (docType === 'delivery_note') {
          assert(html.includes('Dispatch Doc'), `${docType}/classic: dispatch meta`);
          assert(
            html.includes('amounts not applicable'),
            `${docType}/classic: hide amounts wording`
          );
        }
      }
    }
    results.push(`OK  ${docType}`);
  } catch (e: any) {
    failures += 1;
    results.push(`FAIL ${docType}: ${e.message}`);
  }
}

console.log(results.join('\n'));
console.log(failures === 0 ? '\nQA Spec check: PASS' : `\nQA Spec check: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
