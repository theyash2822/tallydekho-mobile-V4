/**
 * complianceSheet.ts
 *
 * Print layouts for the two GST compliance documents that are not vouchers:
 * the e-Invoice (IRP acknowledgement) extract and the e-Way Bill.
 *
 * Neither exists as a Tally voucher type, so there is no Tally print to
 * replicate. These follow the same monochrome ruled sheet style as the master
 * summary, with the field order the portals use on their own printouts.
 */

const esc = (v: any): string => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const money = (v: any): string =>
  Math.abs(Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface ComplianceCompany {
  name?: string;
  address?: string;
  gstin?: string;
  state?: string;
}

export interface ComplianceVoucher {
  voucherNumber?: string;
  voucherType?: string;
  date?: string;
  partyName?: string;
  partyGstin?: string;
  amount?: number | string;
  /** e-Invoice */
  irn?: string;
  ackNo?: string;
  ackDate?: string;
  qrImage?: string | null;
  /** e-Way Bill */
  ewbNo?: string;
  ewbDate?: string;
  validTill?: string;
  vehicleNo?: string;
  transporterId?: string;
  transporterName?: string;
  distanceKm?: number | string;
  supplyType?: string;
  subSupplyType?: string;
  dispatchFrom?: string;
  shipTo?: string;
  transportMode?: string;
}

type Row = { label: string; value: any };

function rowsHtml(rows: Row[]): string {
  return rows
    .filter(r => String(r.value ?? '').trim() !== '')
    .map(r => `<tr>
      <td style="border:1px solid #000;padding:4px 6px;font-size:9.5px;width:190px">${esc(r.label)}</td>
      <td style="border:1px solid #000;padding:4px 6px;font-size:9.5px">${esc(r.value)}</td>
    </tr>`).join('');
}

function sheet(
  title: string,
  company: ComplianceCompany,
  rows: Row[],
  opts: { qrImage?: string | null; note?: string } = {}
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#000;background:#fff;padding:10mm}
  table{width:100%;border-collapse:collapse}
</style></head><body>
<div style="border:1px solid #000">
  <div style="text-align:center;font-size:13px;font-weight:bold;padding:4px;border-bottom:1px solid #000">${esc(title)}</div>
  <table>
    <tr>
      <td style="padding:5px 6px;vertical-align:top;border-bottom:1px solid #000">
        <div style="font-size:12px;font-weight:bold">${esc(company.name || '')}</div>
        <div style="font-size:9px">${esc(company.address || '')}</div>
        ${company.gstin ? `<div style="font-size:9px">GSTIN/UIN : ${esc(company.gstin)}</div>` : ''}
      </td>
      ${opts.qrImage ? `<td style="width:90px;padding:5px 6px;text-align:right;vertical-align:top;border-bottom:1px solid #000">
        <img src="${opts.qrImage}" style="width:74px;height:74px;object-fit:contain" />
      </td>` : ''}
    </tr>
  </table>
  <table><tbody>${rowsHtml(rows)}</tbody></table>
  ${opts.note ? `<div style="border-top:1px solid #000;padding:4px 6px;font-size:9px">${esc(opts.note)}</div>` : ''}
  <div style="border-top:1px solid #000;padding:4px 6px;text-align:right">
    <div style="height:34px"></div>
    <div style="font-size:9px">Authorised Signatory</div>
  </div>
</div>
<div style="text-align:center;font-size:9px;margin-top:3px">-- 1 of 1 --</div>
</body></html>`;
}

export function renderEInvoiceSheetHTML(v: ComplianceVoucher, company: ComplianceCompany = {}): string {
  return sheet('e-INVOICE ACKNOWLEDGEMENT', company, [
    { label: 'IRN', value: v.irn },
    { label: 'Ack No.', value: v.ackNo },
    { label: 'Ack Date', value: v.ackDate },
    { label: 'Document Type', value: v.voucherType },
    { label: 'Document No.', value: v.voucherNumber },
    { label: 'Document Date', value: v.date },
    { label: 'Buyer', value: v.partyName },
    { label: 'Buyer GSTIN/UIN', value: v.partyGstin },
    { label: 'Invoice Value', value: v.amount != null ? money(v.amount) : '' },
  ], {
    qrImage: v.qrImage,
    note: 'Reported to the Invoice Registration Portal. The signed QR code above is the IRP acknowledgement.',
  });
}

export function renderEWayBillSheetHTML(v: ComplianceVoucher, company: ComplianceCompany = {}): string {
  return sheet('e-WAY BILL', company, [
    { label: 'e-Way Bill No.', value: v.ewbNo },
    { label: 'Generated On', value: v.ewbDate },
    { label: 'Valid Until', value: v.validTill },
    { label: 'Supply Type', value: v.supplyType },
    { label: 'Sub Supply Type', value: v.subSupplyType },
    { label: 'Document Type', value: v.voucherType },
    { label: 'Document No.', value: v.voucherNumber },
    { label: 'Document Date', value: v.date },
    { label: 'Consignor', value: company.name },
    { label: 'Consignee', value: v.partyName },
    { label: 'Consignee GSTIN/UIN', value: v.partyGstin },
    { label: 'Dispatch From', value: v.dispatchFrom },
    { label: 'Ship To', value: v.shipTo },
    { label: 'Mode of Transport', value: v.transportMode },
    { label: 'Vehicle No.', value: v.vehicleNo },
    { label: 'Transporter', value: v.transporterName },
    { label: 'Transporter ID', value: v.transporterId },
    { label: 'Approx. Distance', value: v.distanceKm ? `${v.distanceKm} km` : '' },
    { label: 'Consignment Value', value: v.amount != null ? money(v.amount) : '' },
  ], {
    note: 'Carry this with the consignment. Validity is counted from the generation time as per the e-Way Bill rules.',
  });
}
