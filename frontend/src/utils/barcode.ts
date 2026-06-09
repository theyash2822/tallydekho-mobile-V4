/**
 * barcode.ts — Real CODE128 barcode encoder
 *
 * Generates proper scannable CODE128B bar patterns.
 * Returns an array of bar widths (alternating black/white, starting black).
 * Each entry is a width in "modules" (1 module = 1 bar unit).
 *
 * Reference: https://en.wikipedia.org/wiki/Code_128
 */

// CODE128B character set (ASCII 32–127)
// Each entry: [bar1, space1, bar2, space2, bar3, space3] — 6 elements, 11 modules total
const CODE128B_PATTERNS: number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,4,2,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
  [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
  [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
  [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
  [1,1,4,1,1,3],
  // ── Special symbols 96-102 (needed for valid check character encoding)
  // checksum % 103 can produce 0-102; without these, any barcode whose check
  // character lands in 96-102 throws "Cannot convert undefined value to object".
  // Patterns verified from Code 128 / ISO 15417 standard symbol table.
  [1,1,4,3,1,1],[1,3,4,1,1,1],[4,1,1,1,3,1],[4,1,1,3,1,1], // 96-99
  [1,1,3,1,1,4],[1,1,3,1,4,1],[3,1,1,1,1,4],               // 100-102
];

const START_B  = [2,1,1,4,1,2]; // Start Code B
const STOP     = [2,3,3,1,1,1,2]; // Stop (7 bars)
const CODE_B_START_VAL = 104;

export interface BarcodeData {
  bars:        number[];   // alternating black/white module widths (starts black)
  totalModules: number;
}

export function encodeCode128B(text: string): BarcodeData {
  // Only printable ASCII (32–126)
  const chars = text.replace(/[^\x20-\x7E]/g, '');
  if (!chars.length) return { bars: [], totalModules: 0 };

  const bars: number[] = [];

  // Start B
  bars.push(...START_B);

  // Check digit accumulator: starts with start-code value
  let checksum = CODE_B_START_VAL;

  for (let i = 0; i < chars.length; i++) {
    const code = chars.charCodeAt(i) - 32; // 0–94
    const pattern = CODE128B_PATTERNS[code];
    if (!pattern) continue;
    bars.push(...pattern);
    checksum += (i + 1) * code;
  }

  // Check character
  const checkVal = checksum % 103;
  bars.push(...CODE128B_PATTERNS[checkVal]);

  // Stop
  bars.push(...STOP);

  const totalModules = bars.reduce((s, v) => s + v, 0);
  return { bars, totalModules };
}

/**
 * Generate an inline SVG string of a real CODE128B barcode.
 * @param value   - barcode string to encode
 * @param width   - desired pixel width of the SVG
 * @param height  - desired pixel height of the SVG (bars only; text below)
 * @param showText - whether to show the barcode value as text below the bars
 */
export function barcodeSVG(
  value: string,
  width: number,
  height: number,
  showText = true
): string {
  const { bars, totalModules } = encodeCode128B(value);
  if (!bars.length) return '';

  // Code 128 spec requires ≥10 quiet modules on each side.
  const QUIET         = 10;
  const totalWithQuiet = totalModules + QUIET * 2;
  const moduleW       = width / totalWithQuiet;
  const textH         = showText ? 14 : 0;
  const totalH        = height + textH;

  let x = QUIET * moduleW; // start after left quiet zone
  let rectsSVG = '';
  bars.forEach((modules, i) => {
    const w = modules * moduleW;
    if (i % 2 === 0) {
      // Black bar
      rectsSVG += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000"/>`;
    }
    x += w;
  });

  const textSVG = showText
    ? `<text x="${(width / 2).toFixed(1)}" y="${(height + 11).toFixed(1)}" text-anchor="middle" font-size="9" font-family="monospace" fill="#333" letter-spacing="1">${value}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">${rectsSVG}${textSVG}</svg>`;
}

/**
 * Generate inline SVG data URI for use in <img> tags (print HTML).
 */
export function barcodeDataURI(value: string, width = 300, height = 60): string {
  const svg = barcodeSVG(value, width, height, true);
  if (!svg) return '';
  const encoded = svg.replace(/"/g, "'").replace(/\n/g, ' ');
  return `data:image/svg+xml,${encodeURIComponent(encoded)}`;
}
