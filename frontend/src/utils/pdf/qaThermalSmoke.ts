/**
 * Offline Thermal smoke — voucher + commercial 80/58 + legacy Ledger→Thermal map.
 * Run: npx tsx src/utils/pdf/qaThermalSmoke.ts
 */
import {
  toCommercialPrintModel,
  renderCommercialPrintHtml,
  resolveCommercialTemplateId,
} from '../commercial-print';
import {
  toVoucherPrintModel,
  renderVoucherPrintHtml,
  resolveVoucherTemplateId,
} from '../voucher-print';
import { resolveDocumentFormat } from '../documentHelpers';
import { isThermalTemplateId } from './thermalShared';
import { VoucherDocument, DocumentType } from '../../types/document';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const commercialDoc: VoucherDocument = {
  id: 'thermal-si',
  documentType: 'sales_invoice',
  documentNumber: 'TH/001',
  date: '2026-09-07',
  company: {
    name: 'Thermal Co',
    address: 'Rajgarh',
    gstin: '23ACLPP1226E1ZZ',
    pan: 'ACLPP1226E',
    state: 'Madhya Pradesh',
    stateCode: '23',
  },
  party: {
    name: 'Buyer',
    address: 'Delhi',
    gstin: '07AABCD1234E1ZP',
    state: 'Delhi',
    stateCode: '07',
  },
  items: [
    {
      id: '1',
      name: 'Maize White',
      hsn: '1005',
      qty: 10,
      unit: 'kg',
      rate: 100,
      amount: 1000,
      taxableAmount: 1000,
    } as any,
  ],
  taxes: [{ description: 'CGST', rate: 9, taxableAmount: 1000, cgst: 90, total: 90 }],
  hsnSummary: [
    { hsn: '1005', taxableAmount: 1000, taxPct: 18, cgst: 90, sgst: 90, igst: 0, cess: 0, totalTax: 180 },
  ],
  totals: { subtotal: 1000, taxableAmount: 1000, taxTotal: 180, total: 1180, totalQty: 10 },
  narration: 'Thermal smoke',
} as VoucherDocument;

const paymentDoc: VoucherDocument = {
  id: 'thermal-pay',
  documentType: 'payment_voucher' as DocumentType,
  documentNumber: 'PAY/1',
  date: '2026-09-07',
  company: {
    name: 'Thermal Co',
    address: 'Rajgarh',
    gstin: '23ACLPP1226E1ZZ',
    state: 'Madhya Pradesh',
    stateCode: '23',
  },
  party: { name: 'Vendor', address: 'Indore' },
  ledgerEntries: [
    { id: '1', particulars: 'Vendor', debit: 1180 },
    { id: '2', particulars: 'Cash', credit: 1180 },
  ],
  totals: { total: 1180, drTotal: 1180, crTotal: 1180 },
  narration: 'Payment smoke',
} as VoucherDocument;

let failures = 0;
const results: string[] = [];

try {
  assert(resolveDocumentFormat('td_ledger_v1') === 'td_thermal_v1', 'legacy ledger → thermal');
  assert(resolveDocumentFormat('modern_a') === 'td_thermal_v1', 'modern_a → thermal');
  assert(resolveDocumentFormat(2) === 'td_thermal_v1', 'format 2 → thermal');
  assert(resolveVoucherTemplateId('td_ledger_v1') === 'td_thermal_v1', 'voucher id map');
  assert(
    resolveCommercialTemplateId('td_ledger_commercial_v1') === 'td_thermal_commercial_v1',
    'commercial id map'
  );
  assert(isThermalTemplateId('td_thermal_v1'), 'isThermal thermal');
  assert(isThermalTemplateId('td_ledger_v1'), 'isThermal legacy ledger');
  results.push('OK  legacy maps');
} catch (e: any) {
  failures += 1;
  results.push(`FAIL legacy: ${e.message}`);
}

try {
  const model = toCommercialPrintModel(commercialDoc, { companyGuid: 'g' });
  const h80 = renderCommercialPrintHtml(model, 'td_thermal_commercial_v1', { paperWidth: 80 });
  const h58 = renderCommercialPrintHtml(model, 'td_thermal_commercial_v1', { paperWidth: 58 });
  assert(h80.includes('TAX INVOICE'), 'SI title');
  assert(h80.includes('Maize White'), 'SI item');
  assert(h80.includes('width:72mm'), '80mm');
  assert(h58.includes('width:48mm'), '58mm');
  assert(h80.includes('HSN'), 'HSN');
  assert(h80.includes('TOTAL'), 'TOTAL');
  results.push('OK  commercial thermal 80/58');
} catch (e: any) {
  failures += 1;
  results.push(`FAIL commercial: ${e.message}`);
}

try {
  const model = toVoucherPrintModel(paymentDoc, { companyGuid: 'g' });
  const h80 = renderVoucherPrintHtml(model, 'td_thermal_v1', { paperWidth: 80 });
  const h58 = renderVoucherPrintHtml(model, 'td_thermal_v1', { paperWidth: 58 });
  assert(h80.includes('PAYMENT') || h80.includes('Payment'), 'payment title');
  assert(h80.includes('Vendor') || h80.includes('Cash'), 'ledgers');
  assert(h80.includes('width:72mm'), '80mm');
  assert(h58.includes('width:48mm'), '58mm');
  assert(h58.includes('No:') && h58.includes('Date:'), '58 stacks no/date');
  results.push('OK  voucher thermal 80/58');
} catch (e: any) {
  failures += 1;
  results.push(`FAIL voucher: ${e.message}`);
}

console.log(results.join('\n'));
console.log(failures === 0 ? '\nThermal smoke: PASS' : `\nThermal smoke: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
