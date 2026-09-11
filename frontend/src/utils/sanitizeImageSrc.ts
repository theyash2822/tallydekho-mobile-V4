/**
 * Safe image URLs for PDF / print HTML <img src>.
 * Allows data:image/*;base64 and https: (rejects javascript:, file:, http:, private hosts).
 * Local file:// logos must be converted to data: URLs before calling this.
 */
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i;

function isPrivateHostname(hostname: string): boolean {
  const h = String(hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function sanitizeImageSrc(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;
  if (DATA_IMAGE_RE.test(raw.replace(/\s+/g, ''))) {
    return raw.replace(/\s+/g, '');
  }
  if (/^data:/i.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    if (isPrivateHostname(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
