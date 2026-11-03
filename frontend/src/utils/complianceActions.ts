/**
 * Device-side compliance actions shared by the lists, the record screen and
 * the sales screens: share PDFs (existing sheets), share the signed JSON as a
 * file, and record the share / download events on the server.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import i18n from '../i18n';
import {
  getEinvoiceSignedJson,
  recordComplianceEvent,
} from '../services/api';
import { shareCompliancePdfSafely } from './voucherPdf';
import { rowAmount, rowDate, rowEwbNo, rowIrn, rowNumber, rowParty, rowType } from '../components/compliance/complianceShared';

export type ComplianceCompanyInfo = { name?: string; address?: string; gstin?: string } | null | undefined;

const companyInfo = (company: any): { name?: string; address?: string; gstin?: string } => ({
  name: company?.name,
  address: company?.address,
  gstin: company?.gstin,
});

/** e-Invoice acknowledgement sheet → share; records `share` for the history. */
export async function shareEinvoicePdf(companyGuid: string, row: any, company: any, onBeforeShare?: () => void) {
  await shareCompliancePdfSafely('einvoice', {
    irn: rowIrn(row),
    ackNo: row?.ack_no || row?.ackNo || '',
    ackDate: row?.ack_date || row?.ackDate || '',
    qrImage: row?.qr_code || row?.qrCode || null,
    voucherNumber: rowNumber(row),
    voucherType: rowType(row),
    date: rowDate(row),
    partyName: rowParty(row),
    partyGstin: row?.party_gstin || row?.buyer_gstin || undefined,
    amount: rowAmount(row),
  }, companyInfo(company), { onBeforeShare });
  const guid = row?.guid || row?.voucher_guid;
  if (guid) recordComplianceEvent({ companyGuid, voucherGuid: String(guid), domain: 'einvoice', action: 'share' }).catch(() => {});
}

/** e-Way Bill sheet → share; records `share`. */
export async function shareEwbPdf(companyGuid: string, row: any, company: any, onBeforeShare?: () => void) {
  await shareCompliancePdfSafely('ewaybill', {
    ewbNo: rowEwbNo(row),
    ewbDate: row?.ewb_date || rowDate(row),
    validTill: row?.ewb_valid_till || row?.valid_till || '',
    vehicleNo: row?.vehicle_no || '',
    transporterId: row?.transporter_id || '',
    distanceKm: row?.distance_km || '',
    supplyType: row?.supply_type || '',
    subSupplyType: row?.sub_supply_type || '',
    voucherNumber: rowNumber(row),
    voucherType: rowType(row),
    date: rowDate(row),
    partyName: rowParty(row),
    shipTo: row?.route || row?.ship_to || '',
    amount: rowAmount(row),
  }, companyInfo(company), { onBeforeShare });
  const guid = row?.guid || row?.voucher_guid;
  if (guid) recordComplianceEvent({ companyGuid, voucherGuid: String(guid), domain: 'ewaybill', action: 'share' }).catch(() => {});
}

/**
 * GET /einvoice/:voucherGuid/signed-json → write `IRN-<irn>.json` to the cache
 * and open the share sheet, the same way PDFs are shared.
 */
export async function shareSignedJson(companyGuid: string, voucherGuid: string, irn?: string): Promise<boolean> {
  const text = await getEinvoiceSignedJson(companyGuid, voucherGuid);
  const safe = String(irn || voucherGuid).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'einvoice';
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const path = `${dir}IRN-${safe}.json`;
  await FileSystem.writeAsStringAsync(path, typeof text === 'string' ? text : JSON.stringify(text), { encoding: FileSystem.EncodingType.UTF8 });
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(
      i18n.t('screens.reportsEinvoiceList.sharingUnavailable', { defaultValue: 'Sharing is not available on this device' }),
      path,
    );
    return false;
  }
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: `IRN-${safe}.json`, UTI: 'public.json' });
  return true;
}

/** Today as dd/mm/yyyy — the format the incoming e-way bill endpoint takes. */
export function todayDdMmYyyy(d: Date = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
/** DD/MM/YY (DatePickerModal) → dd/mm/yyyy. */
export function dmyToDdMmYyyy(dmy: string): string {
  const [dd, mm, yy] = String(dmy || '').split('/');
  if (!dd || !mm || !yy) return todayDdMmYyyy();
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${year}`;
}
