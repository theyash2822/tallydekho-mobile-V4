/**
 * complianceShared — codes, labels and row accessors shared by the e-Invoice /
 * e-Way Bill lists, the record screen and the sales screens (spec 2026-11-03 §4).
 */
import type { TFunction } from 'i18next';
import { ApiError } from '../../services/api';
import type { ReadinessRow } from '../../services/api';

export type Option = { label: string; value: string };

export const TRANSPORT_MODES = (t: TFunction): Option[] => [
  { value: '1', label: t('screens.reportsEwbList.modeRoad', { defaultValue: 'Road' }) },
  { value: '2', label: t('screens.reportsEwbList.modeRail', { defaultValue: 'Rail' }) },
  { value: '3', label: t('screens.reportsEwbList.modeAir', { defaultValue: 'Air' }) },
  { value: '4', label: t('screens.reportsEwbList.modeShip', { defaultValue: 'Ship' }) },
];

/** NIC IRN cancel reasons: 1 Duplicate · 2 Data entry mistake · 3 Order cancelled · 4 Others. */
export const CANCEL_REASONS = (t: TFunction): Option[] => [
  { value: '1', label: t('screens.reportsEinvoiceList.cancelDuplicate', { defaultValue: 'Duplicate' }) },
  { value: '2', label: t('screens.reportsEinvoiceList.cancelDataEntry', { defaultValue: 'Data entry mistake' }) },
  { value: '3', label: t('screens.reportsEinvoiceList.cancelOrderCancelled', { defaultValue: 'Order cancelled' }) },
  { value: '4', label: t('screens.reportsEinvoiceList.cancelOthers', { defaultValue: 'Others' }) },
];

/** NIC e-way bill cancel reasons differ from the IRN ones in codes 2 and 3: 1 Duplicate · 2 Order cancelled · 3 Data entry mistake · 4 Others (server: perione/client.js ewaybill.cancel). */
export const EWB_CANCEL_REASONS = (t: TFunction): Option[] => [
  { value: '1', label: t('screens.reportsEinvoiceList.cancelDuplicate', { defaultValue: 'Duplicate' }) },
  { value: '2', label: t('screens.reportsEinvoiceList.cancelOrderCancelled', { defaultValue: 'Order cancelled' }) },
  { value: '3', label: t('screens.reportsEinvoiceList.cancelDataEntry', { defaultValue: 'Data entry mistake' }) },
  { value: '4', label: t('screens.reportsEinvoiceList.cancelOthers', { defaultValue: 'Others' }) },
];

export const VEHICLE_REASONS = (t: TFunction): Option[] => [
  { value: '1', label: t('screens.reportsEwbList.vehicleBreakdown', { defaultValue: 'Due to break down' }) },
  { value: '2', label: t('screens.reportsEwbList.vehicleTranshipment', { defaultValue: 'Transhipment' }) },
  { value: '3', label: t('screens.reportsEwbList.vehicleOthers', { defaultValue: 'Others' }) },
  { value: '4', label: t('screens.reportsEwbList.vehicleFirstTime', { defaultValue: 'First time' }) },
];

export const EXTEND_REASONS = (t: TFunction): Option[] => [
  { value: '1', label: t('screens.reportsEwbList.extendCalamity', { defaultValue: 'Natural calamity' }) },
  { value: '2', label: t('screens.reportsEwbList.extendLawOrder', { defaultValue: 'Law and order' }) },
  { value: '3', label: t('screens.reportsEwbList.extendTranshipment', { defaultValue: 'Transhipment' }) },
  { value: '4', label: t('screens.reportsEwbList.extendAccident', { defaultValue: 'Accident' }) },
  { value: '5', label: t('screens.reportsEwbList.extendOthers', { defaultValue: 'Others' }) },
];

export const CONSIGNMENT_STATUS = (t: TFunction): Option[] => [
  { value: 'M', label: t('screens.reportsEwbList.inMovement', { defaultValue: 'In movement' }) },
  { value: 'T', label: t('screens.reportsEwbList.inTransit', { defaultValue: 'In transit' }) },
];

/** Credits charged per generation (spec §1.2); the server is the source of truth, this is the label. */
export const GENERATE_CREDITS = 2;

// ── Row accessors (server field names vary between the readiness, list and record endpoints) ──
export const rowGuid = (r: any): string => String(r?.guid || r?.voucher_guid || r?.voucherGuid || '');
export const rowNumber = (r: any): string => String(r?.voucher_number || r?.voucher_no || r?.voucherNumber || r?.number || '');
export const rowParty = (r: any): string => String(r?.party_name || r?.party || r?.partyName || '');
export const rowDate = (r: any): string => String(r?.date || r?.voucher_date || '');
export const rowAmount = (r: any): number => Math.abs(Number(r?.amount ?? r?.total ?? r?.value ?? 0) || 0);
export const rowType = (r: any): string => String(r?.voucher_type || r?.voucherType || '');
export const rowIrn = (r: any): string => String(r?.irn || '');
export const rowEwbNo = (r: any): string => String(r?.ewb_number || r?.ewb_no || r?.ewbNo || '');
export const firstGap = (r: ReadinessRow): { code: string; message: string; fix?: any } | null =>
  Array.isArray(r?.gaps) && r.gaps.length ? r.gaps[0] : null;

const MODE_CODE: Record<string, string> = { road: '1', rail: '2', air: '3', ship: '4', '1': '1', '2': '2', '3': '3', '4': '4' };

/** Dispatch form prefilled from the readiness row: `dispatch` (merged Tally / app values) over `preview.transport`. */
export function dispatchFromPreview(preview: any, dispatch?: any) {
  const tr = preview?.transport || {};
  const d = dispatch || {};
  return {
    dispatchFrom: String(d.dispatch_from || preview?.seller?.place || ''),
    shipTo: String(d.ship_to || preview?.buyer?.place || ''),
    transportMode: MODE_CODE[String(d.transport_mode || tr.mode || 'road').toLowerCase()] || '1',
    distance: d.distance != null && d.distance !== '' ? String(d.distance) : (tr.distance != null ? String(tr.distance) : ''),
    vehicleNumber: String(d.vehicle_number || tr.vehicle || ''),
    transporterId: String(d.transporter_id || tr.transporter_id || ''),
  };
}

/** compliance_events.created_at is epoch seconds; other writers may send milliseconds or ISO text. */
export function eventDate(v: any): Date | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export type IrnStatus = 'generated' | 'pending' | 'failed' | 'cancelled' | 'none';
export type EwbStatus = 'generated' | 'pending' | 'expired' | 'cancelled' | 'none';

/** Status chips for a sales row (`/api/sales/*` carries irn / ewb_number / einvoice_status). */
export function irnStatusOf(row: any): IrnStatus {
  if (!row) return 'none';
  const st = String(row.einvoice_status || row.irn_status || '').toLowerCase();
  if (row.irn_cancelled === true || st === 'cancelled') return 'cancelled';
  if (row.irn) return 'generated';
  if (st === 'failed' || st === 'error') return 'failed';
  return 'pending';
}
export function ewbStatusOf(row: any): EwbStatus {
  if (!row) return 'none';
  const st = String(row.ewb_status || '').toLowerCase();
  if (st === 'cancelled') return 'cancelled';
  if (st === 'expired') return 'expired';
  if (rowEwbNo(row)) {
    const till = row.ewb_valid_till || row.valid_till;
    if (till && new Date(till).getTime() < Date.now()) return 'expired';
    return 'generated';
  }
  return 'pending';
}

/** Error text for portal / credit failures, with the credit case called out. */
export function complianceErrorText(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    if (err.code === 'INSUFFICIENT_CREDITS' || err.code === 'BILLING_INSUFFICIENT_CREDITS' || err.status === 402) {
      return t('screens.reportsEinvoiceList.insufficientCredits', { defaultValue: 'Not enough credits. Ask the Workspace Owner to recharge.' });
    }
    if (err.code === 'EWB_ACTIVE') {
      return t('screens.reportsEinvoiceList.ewbActiveFirst', { defaultValue: 'Cancel the e-way bill first.' });
    }
  }
  const msg = (err as any)?.message;
  return msg ? String(msg) : t('screens.reportsEinvoiceList.unknownError');
}

export const isNotConfiguredError = (err: unknown): boolean => {
  const m = String((err as any)?.message || '');
  const code = (err as any)?.code;
  return code === 'NOT_CONFIGURED' || code === 'INTEGRATION_NOT_ACTIVE'
    || /not yet provisioned|not configured|IRP credentials|not active/i.test(m);
};
