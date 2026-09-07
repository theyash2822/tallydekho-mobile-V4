/**
 * Shared thermal PDF helpers — 80mm / 58mm roll profiles (Spec).
 * Not a scaled A4 page: fixed narrow width + long height.
 */

export type ThermalPaperWidth = 80 | 58;

export const DEFAULT_THERMAL_PAPER_WIDTH: ThermalPaperWidth = 80;

/** expo-print / PDF points (~72pt per inch). */
export function thermalPageSize(width: ThermalPaperWidth = 80): { width: number; height: number } {
  // 80mm ≈ 226pt printable ~204pt; use full roll width in points.
  // 58mm ≈ 164pt.
  // Tall height so roll content rarely clips in thermal PDF preview/share.
  if (width === 58) return { width: 164, height: 2400 };
  return { width: 226, height: 2400 };
}

export function thermalCssWidthMm(width: ThermalPaperWidth = 80): number {
  return width === 58 ? 48 : 72;
}

export function thermalDash(width: ThermalPaperWidth = 80): string {
  return width === 58 ? '------------------------' : '--------------------------------';
}

export function thermalDouble(width: ThermalPaperWidth = 80): string {
  return width === 58 ? '========================' : '================================';
}

export function wrapThermalHtml(
  body: string,
  opts: { paperWidth?: ThermalPaperWidth } = {}
): string {
  const w = opts.paperWidth ?? DEFAULT_THERMAL_PAPER_WIDTH;
  const mm = thermalCssWidthMm(w);
  const page = thermalPageSize(w);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { size: ${page.width}pt ${page.height}pt; margin: 2mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family: Arial, Helvetica, "Noto Sans", "DejaVu Sans", sans-serif;
    color:#000; background:#fff;
    width:${mm}mm; max-width:100%;
    padding:2mm;
    font-size:${w === 58 ? '9px' : '10px'};
    line-height:1.35;
  }
  .c{text-align:center}
  .r{text-align:right}
  .b{font-weight:bold}
  .sep{white-space:pre;font-size:${w === 58 ? '8px' : '9px'};letter-spacing:0;margin:4px 0;overflow:hidden}
  .row{display:flex;justify-content:space-between;gap:6px;margin:1px 0}
  .muted{color:#222}
</style></head><body>${body}</body></html>`;
}

export function isThermalTemplateId(id: string | null | undefined): boolean {
  if (!id) return false;
  const s = String(id);
  return (
    s === 'td_thermal_v1' ||
    s === 'td_thermal_commercial_v1' ||
    s === 'td_ledger_v1' ||
    s === 'td_ledger_commercial_v1' ||
    s === 'modern_a'
  );
}
