/**
 * Multi-select share helpers — Day Book / stock register / multi-page voucher PDF
 * (same pattern as shareMultiStatementPdf — one PDF, page breaks, one share sheet).
 * ZIP is intentionally not used (unreliable on device share sheets).
 */
import { Alert, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DocumentType, VoucherDocument } from '../types/document';
import { toVoucherDocument } from './voucherDocumentAdapter';
import { getVoucherById, getInvoicePreview } from '../services/api';
import { resolvePdfOptions } from './voucherPdf';
import { generateDocumentHTML } from './documentHelpers';
import { DayBookInput, DayBookRow, renderDayBookHTML, RegisterCompany } from './pdf/dayBookSheet';
import { StockRegisterInput, renderStockRegisterHTML } from './pdf/stockRegisterSheet';
import {
  ComplianceVoucher,
  ComplianceCompany,
  renderEInvoiceSheetHTML,
  renderEWayBillSheetHTML,
} from './pdf/complianceSheet';
import { TX_TO_DOC_TYPE } from './documentHelpers';
import { thermalPageSize } from './pdf/thermalShared';

const A4 = { width: 595, height: 842 };

function pageSizeFromHtml(html: string): { width: number; height: number } {
  if (html.includes('width:48mm')) return thermalPageSize(58);
  if (html.includes('width:72mm')) return thermalPageSize(80);
  return A4;
}

export type ShareMode = 'individual' | 'combined';

/** Ask: each voucher as pages in one PDF vs one combined register list PDF. */
export function promptShareMode(
  opts: {
    title?: string;
    message?: string;
    onChoose: (mode: ShareMode) => void;
  }
): void {
  Alert.alert(
    opts.title || 'Share PDF',
    opts.message ||
      'Share each voucher as its own page(s) in one PDF, or one combined register list PDF?',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Each voucher (one PDF)', onPress: () => opts.onChoose('individual') },
      { text: 'One combined PDF', onPress: () => opts.onChoose('combined') },
    ]
  );
}

export function companyFromAuth(company: any): RegisterCompany {
  return {
    name: company?.name,
    address: company?.address,
    email: company?.email,
    gstin: company?.gstin,
    state: company?.state,
  };
}

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

/** Stitch full HTML documents into one multi-page PDF (ledger multi-select style). */
export async function shareMultiPageHtmlPdf(
  htmlDocuments: string[],
  opts: { fileName?: string; onBeforeShare?: () => void } = {}
): Promise<void> {
  if (!htmlDocuments.length) throw new Error('No documents to share.');
  if (htmlDocuments.length === 1) {
    await shareHtmlPdf(htmlDocuments[0], opts.fileName || 'Document.pdf', opts.onBeforeShare);
    return;
  }

  const sections = htmlDocuments
    .map((full, idx) => {
      const body = extractBody(full);
      const breakStyle = idx === 0 ? '' : 'page-break-before:always;';
      return `<div style="${breakStyle}">${body}</div>`;
    })
    .join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
  table{width:100%;border-collapse:collapse}
</style></head><body>${sections}</body></html>`;

  await shareHtmlPdf(html, opts.fileName || `Documents (${htmlDocuments.length}).pdf`, opts.onBeforeShare);
}

async function shareHtmlPdf(html: string, fileName: string, onBeforeShare?: () => void): Promise<void> {
  const page = pageSizeFromHtml(html);
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...page });
  onBeforeShare?.();
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
    return;
  }
  await Share.share({ url: uri, title: fileName });
}

export async function shareDayBookPdf(
  input: DayBookInput,
  opts: { fileName?: string; onBeforeShare?: () => void } = {}
): Promise<void> {
  const html = renderDayBookHTML(input);
  await shareHtmlPdf(html, opts.fileName || `${input.title}.pdf`, opts.onBeforeShare);
}

export async function shareStockRegisterPdf(
  input: StockRegisterInput,
  opts: { fileName?: string; onBeforeShare?: () => void } = {}
): Promise<void> {
  const html = renderStockRegisterHTML(input);
  await shareHtmlPdf(html, opts.fileName || `${input.title}.pdf`, opts.onBeforeShare);
}

/** Load voucher + Spec HTML. Returns null on failure. */
export async function buildVoucherHtmlByRef(
  companyGuid: string,
  ref: { guid?: string | null; tdkRef?: string | null; documentType?: DocumentType | string | null }
): Promise<string | null> {
  try {
    let raw: any = null;
    if (ref.tdkRef) {
      const res: any = await getInvoicePreview(ref.tdkRef, companyGuid);
      raw = res?.data;
    } else if (ref.guid) {
      const res: any = await getVoucherById(companyGuid, ref.guid);
      raw = res?.data || res;
    }
    if (!raw) return null;

    const typeHint =
      (ref.documentType as DocumentType) ||
      (raw.documentType as DocumentType) ||
      TX_TO_DOC_TYPE[raw.voucher_type || raw.type || ''] ||
      undefined;

    const doc: VoucherDocument = toVoucherDocument(
      raw,
      typeHint ? { documentType: typeHint } : {}
    );
    const options = await resolvePdfOptions(doc, companyGuid);
    return generateDocumentHTML(
      doc,
      options.logoUri ?? null,
      options.format ?? 'tally',
      options.terms ?? [],
      options.qrImage ?? null,
      options.bankInfo ?? null,
      { thermalPaperWidth: options.thermalPaperWidth }
    );
  } catch {
    return null;
  }
}

export type VoucherShareRef = {
  guid?: string | null;
  tdkRef?: string | null;
  documentType?: DocumentType | string | null;
  label?: string;
};

/**
 * Spec voucher HTML for each ref → one multi-page PDF → one share sheet
 * (same approach as multi-ledger `shareMultiStatementPdf`).
 */
export async function shareVouchersAsMultiPagePdf(
  companyGuid: string,
  refs: VoucherShareRef[],
  opts: {
    fileName?: string;
    onBeforeShare?: () => void;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<{ shared: number; failed: number }> {
  const htmlDocs: string[] = [];
  let failed = 0;
  for (let i = 0; i < refs.length; i++) {
    const html = await buildVoucherHtmlByRef(companyGuid, refs[i]);
    opts.onProgress?.(i + 1, refs.length);
    if (html) htmlDocs.push(html);
    else failed += 1;
  }
  if (!htmlDocs.length) throw new Error('Could not build PDFs for the selected vouchers.');

  await shareMultiPageHtmlPdf(htmlDocs, {
    fileName: opts.fileName || `Vouchers (${htmlDocs.length}).pdf`,
    onBeforeShare: opts.onBeforeShare,
  });
  return { shared: htmlDocs.length, failed };
}

/** @deprecated Use shareVouchersAsMultiPagePdf — kept so older imports keep working. */
export const shareVouchersAsIndividualZip = shareVouchersAsMultiPagePdf;

/** Simple print-style summary table (GST, AI Insights, stock lists). */
export type SummaryTableInput = {
  company?: RegisterCompany;
  title: string;
  period?: string | null;
  metrics?: { label: string; value: string }[];
  columns?: string[];
  rows?: (string | number | null | undefined)[][];
};

function escHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderSummaryTableHTML(input: SummaryTableInput): string {
  const c = input.company || {};
  const metrics = (input.metrics || [])
    .map(
      (m) =>
        `<tr>
      <td style="padding:3px 4px;font-size:9px">${escHtml(m.label)}</td>
      <td style="padding:3px 4px;font-size:9px;text-align:right;font-weight:bold">${escHtml(m.value)}</td>
    </tr>`
    )
    .join('');
  const colCount = input.columns?.length || 0;
  const head = (input.columns || [])
    .map(
      (h) =>
        `<th style="border-top:1px solid #000;border-bottom:1px solid #000;padding:4px;font-size:9px;text-align:left">${escHtml(h)}</th>`
    )
    .join('');
  const body = (input.rows || [])
    .map((r) => {
      const cells = [];
      for (let i = 0; i < colCount; i++) {
        cells.push(
          `<td style="padding:3px 4px;font-size:9px;vertical-align:top">${escHtml(r[i] ?? '')}</td>`
        );
      }
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 10mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:8mm;font-size:9.5px}
  table{width:100%;border-collapse:collapse}
</style></head><body>
  <div style="text-align:center;margin-bottom:6px">
    <div style="font-size:13px;font-weight:bold">${escHtml(c.name || '')}</div>
    ${c.gstin ? `<div style="font-size:9px">GSTIN/UIN: ${escHtml(c.gstin)}</div>` : ''}
  </div>
  <div style="border-top:1px solid #000;margin:4px 0"></div>
  <div style="text-align:center;font-size:12px;font-weight:bold;margin:4px 0">${escHtml(input.title)}</div>
  ${input.period ? `<div style="font-size:9.5px;margin-bottom:6px">${escHtml(input.period)}</div>` : ''}
  ${metrics ? `<table style="margin-bottom:10px">${metrics}</table>` : ''}
  ${head || body ? `<table>${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${body}</tbody></table>` : ''}
</body></html>`;
}

export async function shareSummaryTablePdf(
  input: SummaryTableInput,
  opts: { fileName?: string; onBeforeShare?: () => void } = {}
): Promise<void> {
  const html = renderSummaryTableHTML(input);
  await shareHtmlPdf(html, opts.fileName || `${input.title}.pdf`, opts.onBeforeShare);
}

/** Compliance sheets → one multi-page PDF (not ZIP). */
export async function shareCompliancePdfsAsMultiPage(
  kind: 'einvoice' | 'ewaybill',
  vouchers: ComplianceVoucher[],
  company: ComplianceCompany | RegisterCompany,
  opts: {
    fileName?: string;
    onBeforeShare?: () => void;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<{ shared: number; failed: number }> {
  const companyNorm: ComplianceCompany = {
    name: company?.name ?? undefined,
    address: (company as any)?.address ?? undefined,
    gstin: company?.gstin ?? undefined,
    state: (company as any)?.state ?? undefined,
  };
  const htmlDocs: string[] = [];
  let failed = 0;
  for (let i = 0; i < vouchers.length; i++) {
    try {
      const html =
        kind === 'einvoice'
          ? renderEInvoiceSheetHTML(vouchers[i], companyNorm)
          : renderEWayBillSheetHTML(vouchers[i], companyNorm);
      htmlDocs.push(html);
    } catch {
      failed += 1;
    }
    opts.onProgress?.(i + 1, vouchers.length);
  }
  if (!htmlDocs.length) throw new Error('Could not build compliance PDFs.');

  const label = kind === 'einvoice' ? 'E-Invoices' : 'E-Way-Bills';
  await shareMultiPageHtmlPdf(htmlDocs, {
    fileName: opts.fileName || `${label} (${htmlDocs.length}).pdf`,
    onBeforeShare: opts.onBeforeShare,
  });
  return { shared: htmlDocs.length, failed };
}

/** @deprecated Use shareCompliancePdfsAsMultiPage */
export const shareCompliancePdfsAsZip = shareCompliancePdfsAsMultiPage;

export function dayBookRowFromListItem(item: {
  date?: string;
  party?: string;
  particulars?: string;
  name?: string;
  type?: string;
  voucherType?: string;
  number?: string;
  voucherNumber?: string;
  amount?: number | string;
  debit?: number;
  credit?: number;
  isDebit?: boolean;
  qty?: string;
  inwardsQty?: string;
  outwardsQty?: string;
}): DayBookRow {
  const particulars = item.particulars || item.party || item.name || '';
  const vchType = item.voucherType || item.type || '';
  const vchNo = item.voucherNumber || item.number || '';
  const amt =
    typeof item.amount === 'number'
      ? item.amount
      : item.amount
        ? parseFloat(String(item.amount).replace(/[^0-9.-]/g, '')) || 0
        : 0;

  if (item.inwardsQty || item.outwardsQty || item.qty) {
    return {
      date: item.date,
      particulars,
      vchType,
      vchNo,
      debitOrInwards: item.inwardsQty || item.qty || '',
      creditOrOutwards: item.outwardsQty || '',
    };
  }

  const debit = item.debit ?? (item.isDebit ? amt : item.credit ? 0 : amt);
  const credit = item.credit ?? (item.isDebit ? 0 : amt);
  return {
    date: item.date,
    particulars,
    vchType,
    vchNo,
    debitOrInwards: debit || null,
    creditOrOutwards: credit || null,
  };
}
