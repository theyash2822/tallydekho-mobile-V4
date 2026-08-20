/**
 * masterSheet.ts
 *
 * Tally-style master summary sheet for ledgers, banks, warehouses and stock
 * items. Tally prints masters as a plain ruled label/value sheet rather than an
 * invoice grid, so this reuses the monochrome ruled style of the voucher
 * layouts without the item/tax machinery.
 */

const esc = (v: any): string => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export interface MasterSheetInput {
  typeLabel?: string;
  name?: string;
  parent?: string | null;
  postingTag?: string;
  tallyGuid?: string | null;
  payload?: Record<string, any>;
}

export interface MasterSheetCompany {
  name?: string;
  address?: string;
  gstin?: string;
}

/** label / value pairs in Tally's master-display order; blanks are dropped. */
function detailRows(master: MasterSheetInput): { label: string; value: string }[] {
  const p = master.payload || {};
  const money = (v: any) => `${Number(v).toLocaleString('en-IN')}`;
  const candidates: (null | { label: string; value: any })[] = [
    { label: 'Name', value: master.name },
    { label: 'Type', value: master.typeLabel },
    { label: 'Under', value: master.parent },
    { label: 'GSTIN/UIN', value: p.gstin },
    { label: 'Registration Type', value: p.gstRegType },
    { label: 'PAN/IT No.', value: p.pan },
    { label: 'Address', value: p.address },
    { label: 'State', value: p.state },
    { label: 'Pincode', value: p.pincode },
    { label: 'Phone', value: p.phone },
    { label: 'E-Mail', value: p.email },
    p.openingBalance != null && Number(p.openingBalance) !== 0
      ? { label: 'Opening Balance', value: `${money(p.openingBalance)} ${p.isCr ? 'Cr' : 'Dr'}` }
      : null,
    { label: 'Duty/Tax Category', value: p.dutyCategory },
    { label: 'Type of Duty/Tax', value: p.taxType },
    p.percentage != null && Number(p.percentage) !== 0
      ? { label: 'Rate', value: `${p.percentage}%` } : null,
    { label: 'GST Applicable', value: p.gstApplicable },
    { label: 'HSN/SAC', value: p.hsnCode },
    p.igstRate != null && Number(p.igstRate) !== 0
      ? { label: 'GST Rate', value: `${p.igstRate}%` } : null,
    { label: 'Unit of Measure', value: p.unit },
    p.openingQty != null && Number(p.openingQty) !== 0
      ? { label: 'Opening Quantity', value: String(p.openingQty) } : null,
    p.openingRate != null && Number(p.openingRate) !== 0
      ? { label: 'Opening Rate', value: money(p.openingRate) } : null,
    { label: 'Godown', value: p.warehouse },
    { label: 'A/c No.', value: p.accountNumber || p.bankDetails?.accountNo },
    { label: 'IFS Code', value: p.ifsc || p.bankDetails?.ifsc },
    { label: 'Account Type', value: p.accountType },
    { label: 'Tally Master ID', value: master.tallyGuid },
  ];

  return candidates
    .filter((r): r is { label: string; value: any } => !!r && String(r.value ?? '').trim() !== '')
    .map(r => ({ label: r.label, value: String(r.value).trim() }));
}

export function renderMasterSheetHTML(
  master: MasterSheetInput,
  company: MasterSheetCompany = {}
): string {
  const rows = detailRows(master);
  const title = (master.typeLabel || 'Master').toUpperCase();

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:10mm}
  table{width:100%;border-collapse:collapse}
</style></head><body>
<div style="border:1px solid #000">
  <div style="text-align:center;font-size:13px;font-weight:bold;padding:4px;border-bottom:1px solid #000">${esc(title)}</div>
  <div style="padding:5px 6px;border-bottom:1px solid #000">
    <div style="font-size:12px;font-weight:bold">${esc(company.name || '')}</div>
    <div style="font-size:9px">${esc(company.address || '')}</div>
    ${company.gstin ? `<div style="font-size:9px">GSTIN/UIN : ${esc(company.gstin)}</div>` : ''}
  </div>
  <table>
    <tbody>${rows.map(r => `<tr>
      <td style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:190px">${esc(r.label)}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:9.5px">${esc(r.value)}</td>
    </tr>`).join('')}</tbody>
  </table>
  ${master.postingTag ? `<div style="border-top:1px solid #000;padding:4px 6px;font-size:9px">Status : ${esc(master.postingTag)}</div>` : ''}
  <div style="border-top:1px solid #000;padding:4px 6px;text-align:right">
    <div style="height:34px"></div>
    <div style="font-size:9px">Authorised Signatory</div>
  </div>
</div>
<div style="text-align:center;font-size:9px;margin-top:3px">-- 1 of 1 --</div>
</body></html>`;
}
