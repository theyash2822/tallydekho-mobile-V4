/**
 * labelPrint.ts — Shared label-printing utility
 *
 * Single source of truth for:
 *  - Label size definitions (mm)
 *  - Grid calculation (how many fit on A4)
 *  - HTML generation (real CODE128B barcodes, grid layout, always A4 paper)
 */

import { barcodeDataURI } from './barcode';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PrintItem {
  stockGuid:   string;
  displayName: string;
  sku:         string | null;
  barcode:     string | null;
  closingRate: number;
}

export interface GridInfo {
  cols:    number;
  rows:    number;
  perPage: number;
  total:   number;   // items × copies
  sheets:  number;   // pages of A4 needed
}

export interface BuildOpts {
  labelSize:  string;
  copies:     number;
  showSku:    boolean;
  showPrice:  boolean;
  showBatch:  boolean;   // show 'BATCH: ___' placeholder line on label
}

// ─── Label size catalogue ─────────────────────────────────────────────────────
// Physical sticker dimensions in mm.
// Paper is ALWAYS A4 — these are the sticker sizes on the sheet.
export const LABEL_CATALOGUE: Record<string, { w: number; h: number; display: string }> = {
  '50×30 mm':  { w: 50,  h: 30,  display: '50×30 mm  (small)'   },
  '38×25 mm':  { w: 38,  h: 25,  display: '38×25 mm  (tiny)'    },
  '100×50 mm': { w: 100, h: 50,  display: '100×50 mm (medium)'  },
  'Full Page': { w: 190, h: 277, display: 'Full Page (A4 sheet)' },
};

export const LABEL_SIZE_KEYS = Object.keys(LABEL_CATALOGUE) as (keyof typeof LABEL_CATALOGUE)[];

export function getLabelDims(sizeKey: string): { w: number; h: number } {
  return LABEL_CATALOGUE[sizeKey] ?? LABEL_CATALOGUE['50×30 mm'];
}

// ─── A4 usable area ───────────────────────────────────────────────────────────
const PAGE_W = 200; // mm  (210 − 2 × 5mm margin)
const PAGE_H = 287; // mm  (297 − 2 × 5mm margin)
const GAP    = 2;   // mm  gap between labels

// ─── Grid calculator ──────────────────────────────────────────────────────────
export function computeGrid(sizeKey: string, copies: number, itemCount: number): GridInfo {
  const isFullPage = sizeKey === 'Full Page';
  const { w, h } = getLabelDims(sizeKey);
  const cols    = isFullPage ? 1 : Math.max(1, Math.floor((PAGE_W + GAP) / (w + GAP)));
  const rows    = isFullPage ? 1 : Math.max(1, Math.floor((PAGE_H + GAP) / (h + GAP)));
  const perPage = cols * rows;
  const total   = itemCount * copies;
  const sheets  = total > 0 ? Math.ceil(total / perPage) : 0;
  return { cols, rows, perPage, total, sheets };
}

// ─── HTML generator ───────────────────────────────────────────────────────────
export function buildLabelHTML(items: PrintItem[], opts: BuildOpts): string {
  const { labelSize, copies, showSku, showPrice, showBatch } = opts;
  const isFullPage = labelSize === 'Full Page';
  const { w, h }   = getLabelDims(labelSize);
  const { cols, perPage } = computeGrid(labelSize, copies, items.length);

  // Expand items × copies → flat label list
  const allLabels = items.flatMap(item => Array.from({ length: copies }, () => item));

  // Chunk into pages
  const pages: PrintItem[][] = [];
  for (let i = 0; i < allLabels.length; i += perPage) {
    pages.push(allLabels.slice(i, i + perPage));
  }

  // Typography scale relative to label area
  const area        = w * h;
  const nameFS      = isFullPage ? '16pt' : area > 4000 ? '8pt' : '6pt';
  const codeFS      = isFullPage ? '10pt' : '5pt';
  const fieldFS     = isFullPage ? '9pt'  : '4.5pt';
  const padLabel    = isFullPage ? '8mm'  : '1.5mm';

  // Barcode image dimensions
  // bcImgH = FIXED height (not max-height) so bars are always tall enough.
  // iOS AVFoundation needs ≥10mm bar height to scan printed CODE128 reliably.
  // Android ML Kit works even at 6-7mm — that's why Android printed fine but iOS didn't.
  // We use h * 0.55 so bars scale with label size, minimum 11mm enforced.
  const bcRenderW = isFullPage ? 600 : 400;
  const bcRenderH = isFullPage ? 120 : 80;  // taller source = better quality at small print sizes
  const bcImgH    = isFullPage ? '25mm' : `${Math.max(11, Math.round(h * 0.55))}mm`;

  const makeLabel = (item: PrintItem): string => {
    const price = item.closingRate > 0
      ? `₹${item.closingRate.toLocaleString('en-IN')}` : '';
    const bcImg = item.barcode
      ? `<img src="${barcodeDataURI(item.barcode, bcRenderW, bcRenderH)}"
           style="width:92%;height:${bcImgH};display:block;margin:0.5mm auto" alt="${item.barcode}"/>`
      : `<span style="font-size:5pt;color:#aaa">no barcode</span>`;
    return `
      <div style="
        width:${w}mm;height:${h}mm;
        box-sizing:border-box;border:0.3mm solid #ccc;
        padding:${padLabel};
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        overflow:hidden;page-break-inside:avoid">
        <div style="font-weight:700;font-size:${nameFS};text-align:center;
          max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
          margin-bottom:0.8mm">${item.displayName}</div>
        ${bcImg}
        <div style="font-size:${codeFS};letter-spacing:1.5pt;color:#333;
          margin:0.4mm 0">${item.barcode ?? '—'}</div>
        ${showSku && item.sku   ? `<div style="font-size:${fieldFS};color:#555">SKU: ${item.sku}</div>`       : ''}
        ${showPrice && price    ? `<div style="font-size:${fieldFS};color:#555">${price}</div>`                  : ''}
        ${showBatch             ? `<div style="font-size:${fieldFS};color:#555">Batch/Exp: ___________</div>`    : ''}
      </div>`;
  };

  const containerW = isFullPage
    ? w
    : Math.min(PAGE_W, cols * (w + GAP) - GAP);

  const pagesHTML = pages.map((pageItems, idx) => `
    <div style="
      width:${containerW}mm;
      display:flex;flex-wrap:wrap;
      gap:${GAP}mm;align-content:flex-start;
      ${idx < pages.length - 1 ? 'page-break-after:always;' : ''}">
      ${pageItems.map(makeLabel).join('')}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { margin:5mm; size:A4 }
  body  { margin:0; padding:0; font-family:Arial,sans-serif }
  img   { display:block }
</style>
</head><body>${pagesHTML}</body></html>`;
}
