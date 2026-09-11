/**
 * Voucher PDF config helpers — aligned with td-web-portal/src/utils/voucherConfig.js
 * (auto QR, bank resolve, local cache = format + thermal only).
 */
import { Buffer } from 'buffer';
import * as QRCodeLib from 'qrcode';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { sanitizeImageSrc } from './sanitizeImageSrc';
import { PDFBankInfo, DocumentFormat, resolveDocumentFormat } from './documentHelpers';
import {
  ThermalPaperWidth,
  DEFAULT_THERMAL_PAPER_WIDTH,
  isThermalTemplateId,
} from './pdf/thermalShared';

// qrcode expects Node Buffer — Expo/Hermes does not always provide it.
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

/** Metro/CJS interop: `import QRCode from 'qrcode'` often has no `.default`. */
function getQRCode(): {
  toDataURL?: (text: string, opts?: object) => Promise<string>;
  toString?: (text: string, opts?: object) => Promise<string>;
} {
  const mod: any = QRCodeLib;
  return mod?.toDataURL ? mod : (mod?.default ?? mod);
}

export const VOUCHER_CONFIG_KEY = 'voucherConfig';

export type BankLedgerRow = {
  name?: string;
  account_number?: string;
  accountNo?: string;
  ifsc?: string;
  ifsc_code?: string;
  [key: string]: unknown;
};

export function normalizeThermalWidth(v: unknown): ThermalPaperWidth {
  return v === 58 || v === '58' ? 58 : DEFAULT_THERMAL_PAPER_WIDTH;
}

/** Only non-sensitive layout prefs belong in AsyncStorage (no bank/UPI/QR). */
export function toLocalVoucherConfigCache(
  configs: Record<string, any> | null | undefined
): Record<string, { format: DocumentFormat; thermalPaperWidth: ThermalPaperWidth; _updatedAt?: number }> {
  if (!configs || typeof configs !== 'object') return {};
  const out: Record<string, any> = {};
  Object.keys(configs).forEach((k) => {
    const c = configs[k];
    if (!c || typeof c !== 'object') return;
    out[k] = {
      format: resolveDocumentFormat(c.format),
      thermalPaperWidth: normalizeThermalWidth(c.thermalPaperWidth),
      ...(c._updatedAt != null ? { _updatedAt: c._updatedAt } : {}),
    };
  });
  return out;
}

export async function writeLocalVoucherConfig(configs: Record<string, any>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      VOUCHER_CONFIG_KEY,
      JSON.stringify(toLocalVoucherConfigCache(configs))
    );
  } catch {
    /* ignore quota */
  }
}

/** Read local cache; rewrite if legacy blob still held bank/UPI/QR. */
export async function readLocalVoucherConfig(): Promise<Record<string, any> | null> {
  try {
    const raw = await AsyncStorage.getItem(VOUCHER_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const cleaned = toLocalVoucherConfigCache(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(cleaned)) {
      await writeLocalVoucherConfig(cleaned);
    }
    return cleaned;
  } catch {
    return null;
  }
}

/**
 * Merge server full config with local format/thermal prefs (same rules as web).
 */
export function resolveVoucherConfigSource(
  serverVc: Record<string, any> | null | undefined,
  local: Record<string, any> | null
): Record<string, any> | null {
  let parsed = serverVc;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed as any);
    } catch {
      parsed = null;
    }
  }
  const serverEmpty = !parsed || typeof parsed !== 'object' || !Object.keys(parsed).length;
  if (serverEmpty) {
    return local && Object.keys(local).length ? { ...local } : null;
  }
  const merged: Record<string, any> = { ...parsed };
  if (local) {
    Object.keys(local).forEach((k) => {
      if (!merged[k] || !local[k]) return;
      const localFmt = resolveDocumentFormat(local[k].format);
      const serverFmt = resolveDocumentFormat(merged[k].format);
      if (localFmt !== 'tally_classic_v1' && serverFmt === 'tally_classic_v1') {
        merged[k] = {
          ...merged[k],
          ...local[k],
          format: localFmt,
          thermalPaperWidth: normalizeThermalWidth(
            local[k].thermalPaperWidth ?? merged[k].thermalPaperWidth
          ),
        };
      } else if (
        localFmt !== serverFmt &&
        (local[k]._updatedAt || 0) > (merged[k]._updatedAt || 0)
      ) {
        merged[k] = {
          ...merged[k],
          ...local[k],
          format: localFmt,
          thermalPaperWidth: normalizeThermalWidth(
            local[k].thermalPaperWidth ?? merged[k].thermalPaperWidth
          ),
        };
      } else if (isThermalTemplateId(serverFmt) && local[k].thermalPaperWidth != null) {
        if ((local[k]._updatedAt || 0) >= (merged[k]._updatedAt || 0)) {
          merged[k].thermalPaperWidth = normalizeThermalWidth(local[k].thermalPaperWidth);
        }
      }
    });
  }
  return merged;
}

export function bankInfoFromConfig(
  cfg: Record<string, any> | null | undefined,
  bankRows: BankLedgerRow[] = []
): PDFBankInfo | null {
  if (!cfg?.bank) return null;
  const name = cfg.bank || 'Cash';
  const row = bankRows.find((b) => (b.name || (b as any)) === name);

  // UPI text on PDF when QR is on and Generate from UPI is selected
  const mode =
    cfg.qrMode === 'upload' || cfg.qrMode === 'generate'
      ? cfg.qrMode
      : cfg.qrImage
        ? 'upload'
        : 'generate';
  const upiId =
    cfg?.qrEnabled && mode === 'generate' && String(cfg.qrUpiId || '').trim()
      ? String(cfg.qrUpiId).trim()
      : null;

  if (name === 'Cash') {
    return {
      bankName: null,
      // A/C + IFSC come from Default Bank ledger only
      accountNo: null,
      ifsc: null,
      upiId,
    };
  }
  return {
    bankName: name,
    accountNo: row?.account_number || row?.accountNo || null,
    ifsc: row?.ifsc || row?.ifsc_code || null,
    upiId,
  };
}

function qrPayloadFromConfig(cfg: Record<string, any> | null | undefined): string | null {
  if (!cfg?.qrEnabled) return null;
  // Upload mode never auto-generates
  if (cfg.qrMode === 'upload') return null;
  // Generate mode: UPI only
  const upi = String(cfg.qrUpiId || '').trim();
  if (!upi) return null;
  return `upi://pay?pa=${upi}`;
}

/** Public helper for live UI preview (react-native-qrcode-svg). */
export function getQrPayloadFromConfig(
  cfg: Record<string, any> | null | undefined
): string | null {
  return qrPayloadFromConfig(cfg);
}

async function buildQrDataUrl(payload: string): Promise<string | null> {
  const QR = getQRCode();
  // Prefer PNG data URL (best for expo-print <img>)
  if (typeof QR.toDataURL === 'function') {
    try {
      const dataUrl = await QR.toDataURL(payload, {
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      const safe = sanitizeImageSrc(dataUrl);
      if (safe) return safe;
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) return dataUrl;
    } catch {
      /* fall through to SVG */
    }
  }
  // Fallback: SVG → data URL (works when PNG encoder/canvas is missing in RN)
  if (typeof QR.toString === 'function') {
    try {
      const svg = await QR.toString(payload, {
        type: 'svg',
        width: 160,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      if (!svg) return null;
      const b64 = Buffer.from(String(svg), 'utf8').toString('base64');
      return `data:image/svg+xml;base64,${b64}`;
    } catch {
      return null;
    }
  }
  return null;
}

/** Client-side QR data URL — never sends UPI/bank data to third parties. */
export async function qrDataUrlFromConfig(
  cfg: Record<string, any> | null | undefined
): Promise<string | null> {
  if (!cfg?.qrEnabled) return null;

  const mode =
    cfg.qrMode === 'upload' || cfg.qrMode === 'generate'
      ? cfg.qrMode
      : cfg.qrImage
        ? 'upload'
        : 'generate';

  if (mode === 'upload') {
    return toSafePdfImageSrc(cfg.qrImage);
  }

  const payload = qrPayloadFromConfig({ ...cfg, qrMode: 'generate', qrImage: null });
  if (!payload) return null;
  return buildQrDataUrl(payload);
}

/**
 * Convert local file/content URIs to data:image for PDF HTML, then sanitize.
 * https / data: pass through sanitizeImageSrc.
 */
export async function toSafePdfImageSrc(
  url: string | null | undefined
): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;

  const already = sanitizeImageSrc(raw);
  if (already) return already;

  if (/^(file|content):/i.test(raw)) {
    try {
      const b64 = await FileSystem.readAsStringAsync(raw, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const lower = raw.toLowerCase();
      const mime = lower.endsWith('.png')
        ? 'image/png'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : 'image/jpeg';
      return sanitizeImageSrc(`data:${mime};base64,${b64}`);
    } catch {
      return null;
    }
  }
  return null;
}
