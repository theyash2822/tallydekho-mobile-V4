/**
 * GST e-Invoice signed QR (NIC/IRP) — decode + classify only. No signature verification
 * (deferred); callers must label results "Not verified".
 *
 * Token = JWS compact: base64url(header).base64url(payload).base64url(signature)
 * payload = { data: "<JSON string of invoice summary>", iss: "NIC" | ... }
 * Summary carries header fields only (no line items, names, qty or rates).
 */

export type EinvoiceDocType = 'INV' | 'CRN' | 'DBN';

export interface EinvoiceQrSummary {
  sellerGstin: string;
  buyerGstin: string;
  docNo: string;
  docType: EinvoiceDocType;
  /** DD/MM/YYYY as issued. */
  docDate: string;
  totalInvoiceValue: number;
  itemCount: number;
  mainHsnCode: string | null;
  irn: string;
  irnDate: string | null;
  issuer: string | null;
}

export type EinvoiceQrParseResult =
  | { kind: 'ok'; summary: EinvoiceQrSummary }
  | { kind: 'not_einvoice'; reason: string }
  | { kind: 'malformed'; reason: string };

/** Genuine NIC QR tokens are ~1–2.5k chars; generous ceiling, still bounded. */
const MAX_TOKEN_LENGTH = 8192;
const MAX_INNER_JSON_LENGTH = 4096;

const JWS_COMPACT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const GSTIN = /^[0-9]{2}[0-9A-Z]{13}$/;
const IRN = /^[0-9a-f]{64}$/i;
const HSN = /^[0-9]{4,8}$/;
const DOC_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DOC_TYPES: readonly EinvoiceDocType[] = ['INV', 'CRN', 'DBN'];

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_LOOKUP: Record<string, number> = (() => {
  const m: Record<string, number> = Object.create(null);
  for (let i = 0; i < B64_ALPHABET.length; i++) m[B64_ALPHABET[i]] = i;
  return m;
})();

/** base64url → bytes. Hermes/RN globals (atob/TextDecoder) are not relied on. */
function base64UrlToBytes(input: string): Uint8Array | null {
  if (input.length % 4 === 1) return null;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i++) {
    const v = B64_LOOKUP[input[i]];
    if (v === undefined) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

/** Strict UTF-8 decode; returns null on invalid sequences. */
function utf8Decode(bytes: Uint8Array): string | null {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) { out += String.fromCharCode(b0); continue; }
    let need = 0;
    let cp = 0;
    if ((b0 & 0xe0) === 0xc0) { need = 1; cp = b0 & 0x1f; }
    else if ((b0 & 0xf0) === 0xe0) { need = 2; cp = b0 & 0x0f; }
    else if ((b0 & 0xf8) === 0xf0) { need = 3; cp = b0 & 0x07; }
    else return null;
    if (i + need > bytes.length) return null;
    for (let k = 0; k < need; k++) {
      const b = bytes[i++];
      if ((b & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (b & 0x3f);
    }
    if ((need === 1 && cp < 0x80) || (need === 2 && cp < 0x800) || (need === 3 && cp < 0x10000) || cp > 0x10ffff) return null;
    out += String.fromCodePoint(cp);
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return isPlainObject(v) ? v : null;
  } catch {
    return null;
  }
}

function decodeSegment(seg: string): Record<string, unknown> | null {
  const bytes = base64UrlToBytes(seg);
  if (!bytes) return null;
  const text = utf8Decode(bytes);
  if (text === null) return null;
  return parseJsonObject(text);
}

function ownString(o: Record<string, unknown>, key: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(o, key)) return null;
  const v = o[key];
  return typeof v === 'string' ? v : null;
}

function ownValue(o: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
}

function isRealDate(dd: number, mm: number, yyyy: number): boolean {
  if (mm < 1 || mm > 12 || dd < 1 || yyyy < 2000 || yyyy > 2100) return false;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

function classifyNonToken(raw: string): EinvoiceQrParseResult {
  const lower = raw.toLowerCase();
  if (lower.startsWith('upi:')) return { kind: 'not_einvoice', reason: 'This is a UPI payment QR, not an e-Invoice QR.' };
  if (lower.startsWith('http://') || lower.startsWith('https://')) return { kind: 'not_einvoice', reason: 'This QR is a web link, not an e-Invoice QR.' };
  if (/^[0-9]{6,14}$/.test(raw)) return { kind: 'not_einvoice', reason: 'This looks like a product barcode, not an e-Invoice QR.' };
  if (raw.startsWith('{')) return { kind: 'not_einvoice', reason: 'This QR has plain data, not a signed government e-Invoice QR.' };
  return { kind: 'not_einvoice', reason: 'This is not a GST e-Invoice QR.' };
}

export function parseEinvoiceQr(input: unknown): EinvoiceQrParseResult {
  if (typeof input !== 'string') return { kind: 'malformed', reason: 'Empty or unreadable QR.' };
  const raw = input.replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, '');
  if (!raw) return { kind: 'malformed', reason: 'Empty QR.' };
  if (raw.length > MAX_TOKEN_LENGTH) return { kind: 'malformed', reason: 'QR content is too large.' };
  if (!JWS_COMPACT.test(raw)) return classifyNonToken(raw);

  const [h, p, sig] = raw.split('.');
  if (sig.length < 16) return { kind: 'not_einvoice', reason: 'This QR is not a signed e-Invoice.' };

  const header = decodeSegment(h);
  const payload = decodeSegment(p);
  if (!header || !payload) return { kind: 'malformed', reason: 'QR token could not be decoded.' };

  const alg = ownString(header, 'alg');
  if (!alg || alg.toLowerCase() === 'none') return { kind: 'not_einvoice', reason: 'This QR is not a signed e-Invoice.' };

  const dataRaw = ownValue(payload, 'data');
  let data: Record<string, unknown> | null = null;
  if (typeof dataRaw === 'string') {
    if (dataRaw.length > MAX_INNER_JSON_LENGTH) return { kind: 'malformed', reason: 'e-Invoice data is too large.' };
    data = parseJsonObject(dataRaw);
    if (!data) return { kind: 'malformed', reason: 'e-Invoice data inside the QR is not valid.' };
  } else if (isPlainObject(dataRaw)) {
    data = dataRaw;
  } else {
    return { kind: 'not_einvoice', reason: 'This signed QR is not an e-Invoice QR.' };
  }

  // A full SignedInvoice carries nested sections; this screen only accepts the QR summary.
  if (ownValue(data, 'ItemList') !== undefined || ownValue(data, 'SellerDtls') !== undefined) {
    return { kind: 'not_einvoice', reason: 'This is a full signed invoice, not the QR summary.' };
  }

  const sellerGstin = ownString(data, 'SellerGstin');
  const buyerGstin = ownString(data, 'BuyerGstin');
  const docNo = ownString(data, 'DocNo');
  const docTyp = ownString(data, 'DocTyp');
  const docDt = ownString(data, 'DocDt');
  const irn = ownString(data, 'Irn');
  const totRaw = ownValue(data, 'TotInvVal');
  const cntRaw = ownValue(data, 'ItemCnt');
  const hsnRaw = ownValue(data, 'MainHsnCode');
  const irnDt = ownString(data, 'IrnDt');

  if (!sellerGstin && !irn && !docNo) return { kind: 'not_einvoice', reason: 'This signed QR is not an e-Invoice QR.' };

  if (!sellerGstin || !GSTIN.test(sellerGstin)) return { kind: 'malformed', reason: 'Seller GSTIN in the QR is missing or invalid.' };
  if (!buyerGstin) return { kind: 'malformed', reason: 'Buyer GSTIN in the QR is missing.' };
  if (buyerGstin.toUpperCase() === 'URP') {
    return { kind: 'not_einvoice', reason: 'This e-Invoice is for an unregistered/export buyer and cannot be used here.' };
  }
  if (!GSTIN.test(buyerGstin)) return { kind: 'malformed', reason: 'Buyer GSTIN in the QR is invalid.' };
  if (!docNo || docNo.length > 16 || !docNo.trim()) return { kind: 'malformed', reason: 'Invoice number in the QR is missing or invalid.' };
  if (!docTyp || !DOC_TYPES.includes(docTyp as EinvoiceDocType)) return { kind: 'malformed', reason: 'Document type in the QR is missing or unknown.' };
  const dm = docDt ? DOC_DATE.exec(docDt) : null;
  if (!docDt || !dm || !isRealDate(Number(dm[1]), Number(dm[2]), Number(dm[3]))) {
    return { kind: 'malformed', reason: 'Invoice date in the QR is missing or invalid.' };
  }
  if (!irn || !IRN.test(irn)) return { kind: 'malformed', reason: 'IRN in the QR is missing or invalid.' };
  if (typeof totRaw !== 'number' || !Number.isFinite(totRaw) || totRaw < 0) {
    return { kind: 'malformed', reason: 'Invoice total in the QR is missing or invalid.' };
  }
  if (typeof cntRaw !== 'number' || !Number.isInteger(cntRaw) || cntRaw < 0 || cntRaw > 10000) {
    return { kind: 'malformed', reason: 'Item count in the QR is invalid.' };
  }
  let mainHsnCode: string | null = null;
  if (typeof hsnRaw === 'string' && HSN.test(hsnRaw)) mainHsnCode = hsnRaw;
  else if (typeof hsnRaw === 'number' && Number.isInteger(hsnRaw) && HSN.test(String(hsnRaw))) mainHsnCode = String(hsnRaw);

  return {
    kind: 'ok',
    summary: {
      sellerGstin,
      buyerGstin,
      docNo,
      docType: docTyp as EinvoiceDocType,
      docDate: docDt,
      totalInvoiceValue: totRaw,
      itemCount: cntRaw,
      mainHsnCode,
      irn: irn.toLowerCase(),
      irnDate: irnDt && irnDt.length <= 32 ? irnDt : null,
      issuer: ownString(payload, 'iss'),
    },
  };
}

/** DD/MM/YYYY → form's DD/MM/YY. */
export function einvoiceDateToFormDate(docDate: string): string {
  const m = DOC_DATE.exec(docDate);
  return m ? `${m[1]}/${m[2]}/${m[3].slice(-2)}` : '';
}

export const EINVOICE_DOC_TYPE_LABEL: Record<EinvoiceDocType, string> = {
  INV: 'Tax Invoice',
  CRN: 'Credit Note',
  DBN: 'Debit Note',
};

/** Material difference threshold between QR total and computed draft total (round-off tolerance). */
export const EINVOICE_TOTAL_TOLERANCE = 1;
