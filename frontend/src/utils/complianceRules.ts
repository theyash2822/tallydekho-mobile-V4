/**
 * Compliance rules the mobile screens share (spec 2026-11-04 §2.1–§2.5, §4.3): the e-invoice days-left chip,
 * which invoices the correction screen can take, when an invoice made here registers by itself, the e-way bill
 * document kinds and delivery-note reasons, and the correction prefill from a synced voucher.
 * Pure functions — scripts/verify-compliance-v2.mjs runs them under Node.
 */
import type { GstDepositPostStatus } from '../services/api';

export type DaysLeftTone = 'gray' | 'amber' | 'red';
export type DaysLeftChip = { tone: DaysLeftTone; label: 'daysLeft' | 'dayLeft' | 'lastDay' | 'windowClosed'; count: number };

/** Days-left chip of an e-invoice row: gray above 10, amber 4–10, red 0–3, "Last day today" at 0, "Window closed" after. */
export function daysLeftChip(row: { days_left?: number | string | null; urgency?: string | null } | null | undefined): DaysLeftChip | null {
  if (!row) return null;
  const raw = row.days_left;
  const n = raw == null || raw === '' ? NaN : Number(raw);
  if (row.urgency === 'expired' || (Number.isFinite(n) && n < 0)) return { tone: 'red', label: 'windowClosed', count: 0 };
  if (!Number.isFinite(n)) return null;
  const count = Math.floor(n);
  if (count === 0) return { tone: 'red', label: 'lastDay', count };
  return { tone: count <= 3 ? 'red' : count <= 10 ? 'amber' : 'gray', label: count === 1 ? 'dayLeft' : 'daysLeft', count };
}

/** yyyy-mm-dd today in IST (voucher dates are IST). */
export function todayIst(now: number = Date.now()): string {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

type Gap = { code?: string; message?: string; fix?: { type?: string } | null } | null | undefined;

/** Gaps that are the invoice's own doing; the correction screen can put them right (web GapFixDrawer). */
const INVOICE_GAP_TYPES = new Set(['tally_voucher', 'no_lines', 'portal', 'dispatch', 'other']);
export const gapType = (gap: Gap): string => String(gap?.fix?.type || (gap?.code === 'PORTAL_REJECTED' ? 'portal' : 'other'));
export const isInvoiceGap = (gap: Gap): boolean => INVOICE_GAP_TYPES.has(gapType(gap));

/** Dated today, no IRN and not TallyPrime's own document: the same Tally voucher can be corrected here. */
export function correctableRow(row: { date?: string | null; irn?: string | null; source?: string | null } | null | undefined, today: string = todayIst()): boolean {
  return !!row && String(row.date || '').slice(0, 10) === today && !row.irn && row.source !== 'tally';
}

/** What the portal said about the last attempt, shown on the correction banner. */
export function correctionReason(gaps: Gap[] | null | undefined): string | undefined {
  const g = (gaps || []).find((x) => x?.code === 'PORTAL_REJECTED');
  return g?.message || undefined;
}

/**
 * An invoice created here registers by itself once Tally accepts it (spec §2.3): e-invoicing applies and the Owner
 * chose 'auto' (Auditer) or 'auditer' (TallyPrime), or Auditer invoices follow a company in Auto mode.
 */
export function einvoiceRegistersAppInvoices(cfg: Record<string, any> | null | undefined): boolean {
  if (!cfg || cfg.e_invoice_applicable !== 'applicable_configured') return false;
  const choice = cfg.e_invoice_app_invoices_effective || cfg.e_invoice_app_invoices || (cfg.e_invoice_source === 'tally' ? 'tally' : 'follow_mode');
  if (choice === 'auto' || choice === 'auditer') return true;
  return choice === 'follow_mode' && cfg.e_invoice_mode === 'auto';
}

/** A buyer without a GSTIN registered as Unregistered / Consumer (or not at all) is B2C: never e-invoiced (spec §2.1). */
export function isB2cBuyer(gstin: string | null | undefined, regType: string | null | undefined): boolean {
  if (String(gstin || '').trim()) return false;
  const t = String(regType || '').trim().toLowerCase();
  return !t || /unregistered|consumer/.test(t);
}

/** Extra e-way bill documents Auditer can track besides sales invoices, in the order Settings lists them. */
export const EWB_EXTRA_KINDS = ['delivery_note', 'job_work', 'purchase_return', 'inward_unregistered', 'stock_transfer'] as const;
export type EwbExtraKind = typeof EWB_EXTRA_KINDS[number];

/** The tracked list with one kind switched on or off, kept in the Settings order. */
export function withDocKind(list: readonly string[] | null | undefined, kind: EwbExtraKind, on: boolean): EwbExtraKind[] {
  const set = new Set((list || []).filter((k): k is EwbExtraKind => (EWB_EXTRA_KINDS as readonly string[]).includes(k)));
  if (on) set.add(kind); else set.delete(kind);
  return EWB_EXTRA_KINDS.filter((k) => set.has(k));
}

/** Why a delivery note's goods move: the NIC sub-supply codes the server takes for a delivery note; 8 needs a description. */
export const DELIVERY_NOTE_REASONS = ['4', '5', '10', '12', '11', '8'] as const;
export const SUB_SUPPLY_DESC_MAX = 20;

/** When an incoming e-way bill can no longer be rejected: the server's reject_by (epoch seconds); null when unknown. */
export function rejectDeadline(rejectBy: number | string | null | undefined): Date | null {
  const s = rejectBy == null || rejectBy === '' ? NaN : Number(rejectBy);
  return Number.isFinite(s) && s > 0 ? new Date(s * 1000) : null;
}

/** Reject stays open while now < reject_by, to the second; without a deadline the portal decides. */
export function canRejectIncoming(rejectBy: number | string | null | undefined, now: number = Date.now()): boolean {
  const d = rejectDeadline(rejectBy);
  return !d || now < d.getTime();
}

/** yyyy-mm-dd of a moment on this device's calendar (what the app's date format expects). */
export function localIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "6 Nov, 4:00 pm". */
export function formatDayTime(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "6:02 pm" today, "6 Nov, 4:00 pm" on another day. */
export function formatWhen(d: Date | null | undefined, now: number = Date.now()): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  const n = new Date(now);
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return sameDay ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : formatDayTime(d);
}

/** The shared CSV's file name, as the server names it: einvoice-<company>-<tab>-<yyyy-mm-dd>.csv. */
export function complianceReportFileName(domain: 'einvoice' | 'ewaybill', companyName: string | null | undefined, tab: string, today: string = todayIst()): string {
  const slug = String(companyName || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';
  return `${domain === 'einvoice' ? 'einvoice' : 'ewaybill'}-${slug}-${tab}-${today}.csv`;
}

/** The latest `n` financial years of the turnover estimate, oldest first. */
export function recentTurnoverYears<T extends { fy: string; fy_start?: number }>(years: T[] | null | undefined, n = 3): T[] {
  const key = (y: T) => (Number.isFinite(Number(y.fy_start)) ? Number(y.fy_start) : Number(String(y.fy).slice(0, 4)) || 0);
  return [...(years || [])].sort((a, b) => key(a) - key(b)).slice(-n);
}

// ── GST (spec §2.8, §3.2) ───────────────────────────────────────────────────────────────────────

const CALENDAR_RANK: Record<string, number> = { overdue: 0, due: 1, upcoming: 2 };

/** The due dates worth a glance: overdue, due, then upcoming by date; filed ones (latest first) fill the rest. */
export function pickCalendarRows<T extends { status?: string; due_date?: string }>(rows: T[] | null | undefined, n = 4): T[] {
  const list = rows || [];
  const open = list.filter((r) => r.status !== 'filed')
    .sort((a, b) => (CALENDAR_RANK[a.status || ''] ?? 2) - (CALENDAR_RANK[b.status || ''] ?? 2) || String(a.due_date || '').localeCompare(String(b.due_date || '')));
  const filed = list.filter((r) => r.status === 'filed').sort((a, b) => String(b.due_date || '').localeCompare(String(a.due_date || '')));
  return [...open, ...filed].slice(0, n);
}

/** A GST return period as the portal writes it: MMYYYY. The default is last month (the one being filed). */
export function gstPeriodOf(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
}
export function previousGstPeriod(now: Date = new Date()): string {
  return gstPeriodOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}
export function shiftGstPeriod(period: string, months: number): string {
  const m = Number(period.slice(0, 2)) - 1;
  const y = Number(period.slice(2));
  return gstPeriodOf(new Date(y, m + months, 1));
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** MMYYYY → "Oct 2026". */
export function gstPeriodLabel(period: string): string {
  const m = Number(period.slice(0, 2));
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${period.slice(2)}` : period;
}

const CALENDAR_STATUSES = ['filed', 'due', 'overdue', 'upcoming'] as const;
type CalendarStatus = typeof CALENDAR_STATUSES[number];
const CALENDAR_TONE: Record<CalendarStatus, 'generated' | 'pending' | 'failed' | 'muted'> = { filed: 'generated', due: 'pending', overdue: 'failed', upcoming: 'muted' };

/**
 * The chip of a due-date row. Without the portal's filing status (status_known: false) "due" and "overdue" are
 * only a guess, so the chip stays neutral and an overdue one reads "Status not known".
 */
export function calendarChip(row: { status?: string; status_known?: boolean } | null | undefined): { label: CalendarStatus | 'unknown'; tone: 'generated' | 'pending' | 'failed' | 'muted' } {
  const status: CalendarStatus = (CALENDAR_STATUSES as readonly string[]).includes(String(row?.status)) ? row!.status as CalendarStatus : 'upcoming';
  if (row?.status_known === false && (status === 'due' || status === 'overdue')) return { label: status === 'overdue' ? 'unknown' : 'due', tone: 'muted' };
  return { label: status, tone: CALENDAR_TONE[status] };
}

export type ImsSection = { key: string; label: string; count: number };
/** The IMS section chips: one per entry of the server's `sections`, in its order. */
export function imsSections(list: unknown): ImsSection[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && !!String((s as Record<string, unknown>).key ?? '').trim())
    .map((s) => ({ key: String(s.key).trim(), label: String(s.label ?? '').trim() || String(s.key).trim(), count: Number(s.count) || 0 }));
}

/** A deposit's posting state as the server names it; a row without one reads from `posted`. */
export function depositPostStatus(row: { post_status?: string | null; posted?: boolean | null } | null | undefined): GstDepositPostStatus {
  const s = String(row?.post_status || '');
  if (s === 'not_posted' || s === 'queued' || s === 'posted' || s === 'failed' || s === 'unknown') return s;
  return row?.posted ? 'queued' : 'not_posted';
}

/** Where a deposit stands once Post to Tally answered: Tally took it, it waits for the desktop, or Tally did not confirm. */
export function depositStatusAfterPost(status: string | null | undefined): GstDepositPostStatus {
  if (status === 'success') return 'posted';
  if (status === 'unconfirmed') return 'unknown';
  return 'queued';
}

/** The cash ledger total from the overview, whatever shape it comes in (a number, or heads to add up). */
export function cashBalanceTotal(balance: unknown): number | null {
  if (balance == null) return null;
  if (typeof balance === 'number') return Number.isFinite(balance) ? balance : null;
  if (typeof balance !== 'object') return null;
  const b = balance as Record<string, unknown>;
  if (Number.isFinite(Number(b.total))) return Number(b.total);
  const heads = ['igst', 'cgst', 'sgst', 'cess'].map((k) => Number(b[k])).filter(Number.isFinite);
  return heads.length ? heads.reduce((s, v) => s + v, 0) : null;
}

// ── Correction prefill (web GapFixDrawer CorrectInvoice) ─────────────────────────────────────────

export type CorrectionLine = {
  product: string; qty: string; unit: string; rate: string; warehouse: string; hsn?: string; discount: string;
  taxes: { ledgerName: string; taxRate: string }[];
};
export type CorrectionDispatch = {
  dispatchFrom: string; dispatchFromState: string; dispatchFromAddress1: string; dispatchFromAddress2: string; dispatchFromPincode: string;
  shipTo: string; shipToState: string; shipToAddress1: string; shipToAddress2: string; shipToPincode: string;
  transportMode: string; transporterName: string; transporterId: string; vehicleNumber: string; vehicleType: string;
  transportDocNo: string; transportDocDate: string;
};
export type CorrectionPrefill = {
  voucherNumber: string; party: string; ledger: string; refNo: string; narration: string;
  lines: CorrectionLine[]; dispatch: CorrectionDispatch | null;
};

const TAX_LEDGER = /gst|cgst|sgst|igst|utgst|cess/i;
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const str = (v: unknown): string => (v == null ? '' : String(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The create-invoice form's values from GET /vouchers/:guid ({ voucher, items, ledger_entries, dispatch_details }).
 * GST ledgers go on every line at the voucher's rate (tax ÷ taxable value), so the corrected totals match until a
 * line is changed; the form recomputes the tax from the rate after that.
 */
export function correctionPrefillFromVoucher(full: any): CorrectionPrefill | null {
  const v = full?.voucher;
  if (!v) return null;
  const items: any[] = (Array.isArray(full.items) ? full.items : []).filter((it: any) => it && (it.stock_item_name || it.name));
  const taxable = items.reduce((s, it) => s + (Math.abs(num(it.amount)) || 0), 0);
  const byLedger = new Map<string, number>();
  for (const e of Array.isArray(full.ledger_entries) ? full.ledger_entries : []) {
    const name = str(e?.ledger_name).trim();
    if (!name || !TAX_LEDGER.test(name)) continue;
    byLedger.set(name, (byLedger.get(name) || 0) + (Math.abs(num(e.amount)) || 0));
  }
  const taxes = [...byLedger.entries()].map(([ledgerName, amount]) => ({
    ledgerName,
    taxRate: taxable > 0 ? String(round2((amount / taxable) * 100)) : '',
  }));
  const lines: CorrectionLine[] = items.map((it) => {
    const qty = Math.abs(num(it.actual_qty ?? it.billed_qty ?? it.qty));
    const amount = Math.abs(num(it.amount));
    let rate = Math.abs(num(it.rate));
    if (!Number.isFinite(rate) && Number.isFinite(qty) && qty > 0 && Number.isFinite(amount)) rate = amount / qty;
    const discount = num(it.discount);
    return {
      product: str(it.stock_item_name || it.name),
      qty: Number.isFinite(qty) && qty > 0 ? String(qty) : '1',
      unit: str(it.unit),
      rate: Number.isFinite(rate) ? String(round2(rate)) : '',
      warehouse: str(it.godown_name || it.godown),
      hsn: it.hsn ? str(it.hsn) : undefined,
      discount: Number.isFinite(discount) ? String(Math.abs(discount)) : '0',
      taxes: taxes.map((t) => ({ ...t })),
    };
  });
  const ledgerItem = items.find((it) => it.sales_ledger || it.ledger);
  const dd = full.dispatch_details && typeof full.dispatch_details === 'object' ? full.dispatch_details : null;
  const dispatch: CorrectionDispatch | null = dd ? {
    dispatchFrom: str(dd.dispatch_from || dd.dispatch_from_place),
    dispatchFromState: str(dd.dispatch_from_state || dd.dispatch_state),
    dispatchFromAddress1: str(dd.dispatch_from_address1 || dd.dispatch_address1 || dd.dispatch_from_address),
    dispatchFromAddress2: str(dd.dispatch_from_address2),
    dispatchFromPincode: str(dd.dispatch_from_pincode || dd.dispatch_pincode),
    shipTo: str(dd.ship_to || dd.ship_to_place),
    shipToState: str(dd.ship_to_state || dd.ship_state),
    shipToAddress1: str(dd.ship_to_address1 || dd.ship_address1 || dd.ship_to_address),
    shipToAddress2: str(dd.ship_to_address2),
    shipToPincode: str(dd.ship_to_pincode || dd.ship_pincode),
    transportMode: str(dd.transport_mode_simple || dd.transport_mode),
    transporterName: str(dd.transporter_name),
    transporterId: str(dd.transporter_id),
    vehicleNumber: str(dd.vehicle_number),
    vehicleType: str(dd.vehicle_type),
    transportDocNo: str(dd.transport_doc_no),
    transportDocDate: str(dd.transport_doc_date),
  } : null;
  return {
    voucherNumber: str(v.voucher_number),
    party: str(v.party_name),
    ledger: str(ledgerItem?.sales_ledger || ledgerItem?.ledger),
    refNo: str(v.reference),
    narration: str(v.narration || full.app_narration),
    lines,
    dispatch: dispatch && Object.values(dispatch).some(Boolean) ? dispatch : null,
  };
}
