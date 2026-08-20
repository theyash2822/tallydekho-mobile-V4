/**
 * voucherPdf.ts
 *
 * One place that turns a `VoucherDocument` into a shareable PDF.
 *
 * Previously each create screen and the preview action bar re-implemented this:
 * loading the logo, reading the voucher config, mapping bank details, calling
 * `generateDocumentHTML`, then printing and sharing. The create screens also
 * passed `documentDate` where the renderer reads `date`, so their PDFs printed
 * without a date.
 */
import { Share, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VoucherDocument, DocumentType } from '../types/document';
import { generateDocumentHTML, PDFBankInfo, DocumentFormat, resolveDocumentFormat } from './documentHelpers';
import { toVoucherDocument } from './voucherDocumentAdapter';
import { renderMasterSheetHTML, MasterSheetInput, MasterSheetCompany } from './pdf/masterSheet';
import { renderTallyStatementHTML, StatementInput } from './pdf/tallyLayout';
import {
  renderEInvoiceSheetHTML, renderEWayBillSheetHTML,
  ComplianceVoucher, ComplianceCompany,
} from './pdf/complianceSheet';
import { getUserSettings, getInvoicePreview } from '../services/api';

const VOUCHER_CONFIG_KEY = 'voucherConfig';

/** Voucher-config entry id per document type (mirrors settings/voucher-config.tsx). */
export const DOC_TYPE_TO_CONFIG_ID: Record<string, string> = {
  sales_invoice: 'sales_inv',
  proforma_invoice: 'sales_inv',
  purchase_invoice: 'purchase_inv',
  sales_order: 'sales_order',
  purchase_order: 'purchase_order',
  credit_note: 'credit_note',
  debit_note: 'debit_note',
  delivery_note: 'delivery_note',
  receipt_voucher: 'receipt',
  payment_voucher: 'payment',
  journal_voucher: 'journal',
  contra_voucher: 'contra',
  stock_journal: 'stock_journal',
};

export interface PdfRenderOptions {
  logoUri?: string | null;
  format?: DocumentFormat;
  terms?: string[];
  qrImage?: string | null;
  bankInfo?: PDFBankInfo | null;
}

/** A4 at 72dpi — the size every Tally print template assumes. */
const A4 = { width: 595, height: 842 };

let voucherConfigCache: Record<string, any> | null = null;

/**
 * Loads the saved voucher config. Backend first so the choice follows the user
 * across devices, then the AsyncStorage copy as an offline fallback.
 */
export async function loadVoucherConfig(): Promise<Record<string, any> | null> {
  if (voucherConfigCache) return voucherConfigCache;
  try {
    const res: any = await getUserSettings();
    const serverConfig = res?.data?.voucher_config;
    if (serverConfig) {
      const parsed = typeof serverConfig === 'string' ? JSON.parse(serverConfig) : serverConfig;
      voucherConfigCache = parsed;
      AsyncStorage.setItem(VOUCHER_CONFIG_KEY, JSON.stringify(parsed)).catch(() => {});
      return parsed;
    }
  } catch {
    // fall through to the local copy
  }
  try {
    const json = await AsyncStorage.getItem(VOUCHER_CONFIG_KEY);
    voucherConfigCache = json ? JSON.parse(json) : null;
  } catch {
    voucherConfigCache = null;
  }
  return voucherConfigCache;
}

/** Call after saving settings so the next PDF picks up the new choice. */
export function clearVoucherConfigCache() {
  voucherConfigCache = null;
}

export async function loadCompanyLogo(companyGuid?: string | null): Promise<string | null> {
  if (!companyGuid) return null;
  try {
    return await AsyncStorage.getItem(`company_logo_${companyGuid}`);
  } catch {
    return null;
  }
}

/** Resolves the per-document-type render options from the saved voucher config. */
export async function resolvePdfOptions(
  doc: VoucherDocument,
  companyGuid?: string | null
): Promise<PdfRenderOptions> {
  const [config, logoUri] = await Promise.all([
    loadVoucherConfig(),
    loadCompanyLogo(companyGuid),
  ]);
  const cfg = config?.[DOC_TYPE_TO_CONFIG_ID[doc.documentType] || ''];
  const bankInfo: PDFBankInfo | null = cfg?.bank ? {
    bankName: cfg.bank !== 'Cash' ? cfg.bank : null,
    accountNo: cfg.qrEnabled && cfg.qrType === 'bank' ? cfg.qrAccount || null : null,
    ifsc: cfg.qrEnabled && cfg.qrType === 'bank' ? cfg.qrIfsc || null : null,
    upiId: cfg.qrEnabled && cfg.qrType === 'upi' ? cfg.qrUpiId || null : null,
  } : null;

  return {
    logoUri,
    format: resolveDocumentFormat(cfg?.format),
    terms: (cfg?.terms ?? []) as string[],
    qrImage: cfg?.qrEnabled && cfg?.qrImage ? cfg.qrImage : null,
    bankInfo,
  };
}

/** Renders the document to a local PDF file and returns its URI. */
export async function buildVoucherPdf(
  doc: VoucherDocument,
  options: PdfRenderOptions = {}
): Promise<string> {
  const html = generateDocumentHTML(
    doc,
    options.logoUri ?? null,
    options.format ?? 'tally',
    options.terms ?? [],
    options.qrImage ?? null,
    options.bankInfo ?? null
  );
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...A4 });
  return uri;
}

/**
 * Renders and opens the native share sheet.
 *
 * `onBeforeShare` runs after rendering but before the share sheet opens, so
 * callers can drop their loading state — `shareAsync` blocks until the sheet is
 * dismissed and would otherwise leave a spinner running.
 */
export async function shareVoucherPdf(
  doc: VoucherDocument,
  opts: {
    companyGuid?: string | null;
    dialogTitle?: string;
    fileName?: string;
    options?: PdfRenderOptions;
    onBeforeShare?: () => void;
    fallback?: () => Promise<void>;
  } = {}
): Promise<void> {
  const renderOptions = opts.options ?? await resolvePdfOptions(doc, opts.companyGuid);
  const uri = await buildVoucherPdf(doc, renderOptions);
  opts.onBeforeShare?.();

  const dialogTitle = opts.dialogTitle || opts.fileName || doc.documentNumber;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
    return;
  }
  if (opts.fallback) {
    await opts.fallback();
    return;
  }
  await Share.share({ url: uri, title: doc.documentNumber });
}

/**
 * Fetches the backend snapshot for a TDK reference and shares it as a PDF.
 *
 * Used by the create-screen success overlays, which only hold a `tdkRef` at that
 * point. They previously shared a plain-text summary instead of the document.
 */
export async function shareVoucherPdfByRef(
  tdkRef: string,
  companyGuid: string,
  opts: {
    documentType?: DocumentType;
    fileName?: string;
    onBeforeShare?: () => void;
    fallback?: () => Promise<void>;
  } = {}
): Promise<void> {
  const res: any = await getInvoicePreview(tdkRef, companyGuid);
  if (!res?.status || !res?.data) throw new Error('Could not load the document.');
  const doc = toVoucherDocument(res.data, opts.documentType ? { documentType: opts.documentType } : {});
  await shareVoucherPdf(doc, {
    companyGuid,
    fileName: opts.fileName || res.data.fileName || `${tdkRef}.pdf`,
    onBeforeShare: opts.onBeforeShare,
    fallback: opts.fallback,
  });
}

/**
 * Shares a Family C statement (Ledger Account) as a PDF. The ledger screen used
 * to build its own branded HTML, which was the last renderer outside the shared
 * engine.
 */
export async function shareStatementPdf(
  input: StatementInput,
  opts: { fileName?: string; onBeforeShare?: () => void } = {}
): Promise<void> {
  const html = renderTallyStatementHTML(input);
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...A4 });
  opts.onBeforeShare?.();

  const dialogTitle = opts.fileName || `${input.partyName || input.title}.pdf`;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
    return;
  }
  await Share.share({ url: uri, title: dialogTitle });
}

/**
 * Shares a master (ledger / bank / warehouse / stock item) as a Tally-style
 * summary sheet. Masters carry no `VoucherDocument`, so they get their own
 * renderer but the same print-and-share plumbing.
 */
export async function shareMasterPdf(
  master: MasterSheetInput,
  company: MasterSheetCompany = {},
  opts: { onBeforeShare?: () => void } = {}
): Promise<void> {
  const html = renderMasterSheetHTML(master, company);
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...A4 });
  opts.onBeforeShare?.();

  const dialogTitle = `${master.name || 'Master'}.pdf`;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
    return;
  }
  await Share.share({ url: uri, title: dialogTitle });
}

/**
 * Shares an e-Invoice acknowledgement or e-Way Bill sheet.
 *
 * Neither is a Tally voucher, so they have no `VoucherDocument`; the compliance
 * list rows carry everything the sheet prints.
 */
export async function shareCompliancePdf(
  kind: 'einvoice' | 'ewaybill',
  voucher: ComplianceVoucher,
  company: ComplianceCompany = {},
  opts: { onBeforeShare?: () => void } = {}
): Promise<void> {
  const html = kind === 'einvoice'
    ? renderEInvoiceSheetHTML(voucher, company)
    : renderEWayBillSheetHTML(voucher, company);
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...A4 });
  opts.onBeforeShare?.();

  const label = kind === 'einvoice' ? 'e-Invoice' : 'e-Way Bill';
  const dialogTitle = `${label} ${voucher.voucherNumber || ''}`.trim() + '.pdf';
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
    return;
  }
  await Share.share({ url: uri, title: dialogTitle });
}

/** shareCompliancePdf with the standard error toast, for button handlers. */
export async function shareCompliancePdfSafely(
  kind: 'einvoice' | 'ewaybill',
  voucher: ComplianceVoucher,
  company: ComplianceCompany = {},
  opts: { onBeforeShare?: () => void } = {}
): Promise<void> {
  try {
    await shareCompliancePdf(kind, voucher, company, opts);
  } catch {
    opts.onBeforeShare?.();
    Alert.alert('PDF Error', 'Could not generate the PDF. Please try again.');
  }
}

/** shareVoucherPdf with the standard error toast, for button handlers. */
export async function shareVoucherPdfSafely(
  doc: VoucherDocument,
  opts: Parameters<typeof shareVoucherPdf>[1] = {}
): Promise<void> {
  try {
    await shareVoucherPdf(doc, opts);
  } catch {
    opts.onBeforeShare?.();
    Alert.alert('PDF Error', 'Could not generate PDF. Please try again.');
  }
}
