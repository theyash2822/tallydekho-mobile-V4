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
import { getUserSettings, getInvoicePreview, getBankLedgers, getCompanyLogo } from '../services/api';
import {
  ThermalPaperWidth,
  DEFAULT_THERMAL_PAPER_WIDTH,
  isThermalTemplateId,
  thermalPageSize,
} from './pdf/thermalShared';
import { sanitizeImageSrc } from './sanitizeImageSrc';
import {
  normalizeThermalWidth,
  writeLocalVoucherConfig,
  readLocalVoucherConfig,
  resolveVoucherConfigSource,
  bankInfoFromConfig,
  qrDataUrlFromConfig,
  toSafePdfImageSrc,
  BankLedgerRow,
} from './voucherPdfConfig';
import { assertCanSharePdf } from './rbasGate';

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
  /** Inventory inbound — reuse Delivery Note print format settings. */
  receipt_note: 'delivery_note',
  receipt_voucher: 'receipt',
  payment_voucher: 'payment',
  journal_voucher: 'journal',
  contra_voucher: 'contra',
  expense_voucher: 'expense',
  quotation: 'sales_inv',
  // stock_journal: cream preview only — no Settings PDF row
};

export interface PdfRenderOptions {
  logoUri?: string | null;
  format?: DocumentFormat;
  terms?: string[];
  qrImage?: string | null;
  bankInfo?: PDFBankInfo | null;
  /** 80 (default) or 58 — only used when format is Thermal. */
  thermalPaperWidth?: ThermalPaperWidth;
}

/** A4 at 72dpi — Classic / Executive. Thermal uses thermalPageSize(). */
const A4 = { width: 595, height: 842 };

function resolvePrintPageSize(options: PdfRenderOptions): { width: number; height: number } {
  const format = resolveDocumentFormat(options.format);
  if (isThermalTemplateId(format)) {
    return thermalPageSize(options.thermalPaperWidth ?? DEFAULT_THERMAL_PAPER_WIDTH);
  }
  return A4;
}

let voucherConfigCache: Record<string, any> | null = null;

/**
 * Loads the saved voucher config. Backend first (full config in memory);
 * AsyncStorage only keeps format + thermal width (no bank/UPI/QR).
 */
export async function loadVoucherConfig(): Promise<Record<string, any> | null> {
  if (voucherConfigCache) return voucherConfigCache;
  let serverParsed: Record<string, any> | null = null;
  try {
    const res: any = await getUserSettings();
    const serverConfig = res?.data?.voucher_config;
    if (serverConfig) {
      serverParsed = typeof serverConfig === 'string' ? JSON.parse(serverConfig) : serverConfig;
    }
  } catch {
    // fall through — merge with local layout prefs
  }
  const local = await readLocalVoucherConfig();
  const merged = resolveVoucherConfigSource(serverParsed, local);
  voucherConfigCache = merged;
  if (merged) writeLocalVoucherConfig(merged).catch(() => {});
  return voucherConfigCache;
}

/** Call after saving settings so the next PDF picks up the new choice. */
export function clearVoucherConfigCache() {
  voucherConfigCache = null;
}

export async function loadCompanyLogo(companyGuid?: string | null): Promise<string | null> {
  if (!companyGuid) return null;
  try {
    const res: any = await getCompanyLogo(companyGuid);
    const url = res?.data?.logo_url;
    if (url) {
      const safe = await toSafePdfImageSrc(url);
      if (safe) return safe;
    }
  } catch {
    /* fall through to cache */
  }
  try {
    const { currentTenantKey, logoFeature, dropLegacyKeys } = await import('./tenantStorage');
    await dropLegacyKeys([`company_logo_${companyGuid}`]);
    const cached = await AsyncStorage.getItem(currentTenantKey(companyGuid, logoFeature()));
    return await toSafePdfImageSrc(cached);
  } catch {
    return null;
  }
}

async function loadBankRows(companyGuid?: string | null): Promise<BankLedgerRow[]> {
  if (!companyGuid) return [];
  try {
    const res: any = await getBankLedgers(companyGuid, 'bank');
    const rows = res?.data;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** Resolves the per-document-type render options from the saved voucher config. */
export async function resolvePdfOptions(
  doc: VoucherDocument,
  companyGuid?: string | null
): Promise<PdfRenderOptions> {
  const [config, logoUri, bankRows] = await Promise.all([
    loadVoucherConfig(),
    loadCompanyLogo(companyGuid),
    loadBankRows(companyGuid),
  ]);
  const cfg = config?.[DOC_TYPE_TO_CONFIG_ID[doc.documentType] || ''];
  const bankInfo = bankInfoFromConfig(cfg, bankRows);
  const qrRaw = cfg?.qrEnabled ? await qrDataUrlFromConfig(cfg) : null;

  return {
    logoUri: logoUri ?? null,
    format: resolveDocumentFormat(cfg?.format),
    terms: (cfg?.terms ?? []) as string[],
    qrImage: sanitizeImageSrc(qrRaw),
    bankInfo,
    thermalPaperWidth: normalizeThermalWidth(cfg?.thermalPaperWidth),
  };
}
/** Renders the document to a local PDF file and returns its URI. */
export async function buildVoucherPdf(
  doc: VoucherDocument,
  options: PdfRenderOptions = {}
): Promise<string> {
  const safeLogo = await toSafePdfImageSrc(options.logoUri ?? null);
  const safeQr = sanitizeImageSrc(options.qrImage ?? null);
  const html = generateDocumentHTML(
    doc,
    safeLogo,
    options.format ?? 'tally',
    options.terms ?? [],
    safeQr,
    options.bankInfo ?? null,
    { thermalPaperWidth: options.thermalPaperWidth }
  );
  const page = resolvePrintPageSize(options);
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...page });
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
  if (!assertCanSharePdf()) return;
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
  if (!assertCanSharePdf()) return;
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
 * Shares multiple ledger statements as a single PDF (page-break between each).
 * Same Family C layout as `shareStatementPdf`.
 */
export async function shareMultiStatementPdf(
  inputs: StatementInput[],
  opts: { fileName?: string; onBeforeShare?: () => void } = {}
): Promise<void> {
  if (!assertCanSharePdf()) return;
  if (!inputs.length) throw new Error('No ledgers to share');
  if (inputs.length === 1) {
    await shareStatementPdf(inputs[0], opts);
    return;
  }

  const sections = inputs.map((input, idx) => {
    const full = renderTallyStatementHTML(input);
    const match = full.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const body = match ? match[1] : full;
    const breakStyle = idx === 0 ? '' : 'page-break-before:always;';
    return `<div style="${breakStyle}padding:10mm">${body}</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff}
  table{width:100%;border-collapse:collapse}
</style></head><body>${sections}</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false, ...A4 });
  opts.onBeforeShare?.();

  const dialogTitle = opts.fileName || `Ledgers (${inputs.length}) — Statements.pdf`;
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
  if (!assertCanSharePdf()) return;
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
/** Build a local compliance PDF file without opening the share sheet. */
export async function buildCompliancePdfFile(
  kind: 'einvoice' | 'ewaybill',
  voucher: ComplianceVoucher,
  company: ComplianceCompany = {},
): Promise<{ uri: string; name: string }> {
  const html = kind === 'einvoice'
    ? renderEInvoiceSheetHTML(voucher, company)
    : renderEWayBillSheetHTML(voucher, company);
  const { uri } = await Print.printToFileAsync({ html, base64: false, ...A4 });
  const label = kind === 'einvoice' ? 'e-Invoice' : 'e-Way Bill';
  const name = `${label} ${voucher.voucherNumber || voucher.irn || voucher.ewbNo || 'doc'}`.trim() + '.pdf';
  return { uri, name };
}

export async function shareCompliancePdf(
  kind: 'einvoice' | 'ewaybill',
  voucher: ComplianceVoucher,
  company: ComplianceCompany = {},
  opts: { onBeforeShare?: () => void } = {}
): Promise<void> {
  if (!assertCanSharePdf()) return;
  const { uri, name } = await buildCompliancePdfFile(kind, voucher, company);
  opts.onBeforeShare?.();

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' });
    return;
  }
  await Share.share({ url: uri, title: name });
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
