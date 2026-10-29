/**
 * The code inside pasted or auto-filled text: a standalone run of exactly `length` digits
 * (so a phone number next to it is not taken), else the last `length` digits when the text
 * is only digits (autofill appended to a digit already in the box).
 */
export function extractCode(text: string, length: number): string | null {
  const raw = String(text || '');
  const standalone = raw.match(new RegExp(`(?:^|\\D)(\\d{${length}})(?=\\D|$)`));
  if (standalone) return standalone[1];
  const digits = raw.replace(/\D/g, '');
  return /^\d+$/.test(raw.trim()) && digits.length >= length ? digits.slice(-length) : null;
}
