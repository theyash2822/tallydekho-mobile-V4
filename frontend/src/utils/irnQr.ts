/**
 * The IRP's signed QR (a JWT, text) as an image for the printed / shared invoice and the e-invoice
 * acknowledgement — drawn on the device with `qrcode` as SVG, nothing is sent anywhere (same output as the
 * web portal's utils/irnQr.js). A value that is already an image is used as is.
 */
import { Buffer } from 'buffer';
import * as QRCodeLib from 'qrcode';
import type { VoucherDocument } from '../types/document';
import { sanitizeImageSrc } from './sanitizeImageSrc';

type QrLib = { toString: (text: string, opts?: object) => Promise<string> };

/** Metro and Node expose the CommonJS module as `default`; fall back to the namespace. */
function qrLib(): QrLib | null {
  const mod: any = QRCodeLib;
  const lib = mod?.default && typeof mod.default.create === 'function' ? mod.default : mod;
  return lib && typeof lib.create === 'function' && typeof lib.toString === 'function' ? lib : null;
}

export async function irnQrDataUrl(signedQr: unknown): Promise<string | null> {
  const text = String(signedQr ?? '').trim();
  if (!text) return null;
  if (/^data:image\//i.test(text)) return sanitizeImageSrc(text);
  const QR = qrLib();
  if (!QR) return null;
  try {
    // A signed QR runs to ~1–2.5 KB; error correction L keeps it inside the QR capacity at a printable size.
    const svg = await QR.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'L' });
    if (!svg) return null;
    return sanitizeImageSrc(`data:image/svg+xml;base64,${Buffer.from(String(svg), 'utf8').toString('base64')}`);
  } catch {
    return null;
  }
}

/** The document with `tallyMeta.irnQrImage` drawn from `tallyMeta.irnSignedQr` (only when it carries an IRN). */
export async function withIrnQrImage(doc: VoucherDocument): Promise<VoucherDocument> {
  const meta = doc?.tallyMeta;
  if (!meta?.irn || meta.irnQrImage || !meta.irnSignedQr) return doc;
  const image = await irnQrDataUrl(meta.irnSignedQr);
  return image ? { ...doc, tallyMeta: { ...meta, irnQrImage: image } } : doc;
}
