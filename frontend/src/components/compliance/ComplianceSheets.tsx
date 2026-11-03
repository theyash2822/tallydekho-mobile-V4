/**
 * Bottom sheets shared by the e-Invoice and e-Way Bill screens:
 * action menu, generate confirmations (with the dispatch form), cancel with
 * reason, and the "verify signed data" result.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { BottomModalShell } from '../forms/BottomModalShell';
import FormField from '../forms/FormField';
import FormDropdown from '../forms/FormDropdown';
import BrandSwitch from '../forms/BrandSwitch';
import { useSettings } from '../../context/SettingsContext';
import type { DispatchDetails } from '../../services/api';
import { CANCEL_REASONS, GENERATE_CREDITS, TRANSPORT_MODES, dispatchFromPreview, type Option } from './complianceShared';

// ── Footer buttons ────────────────────────────────────────────────────────────
export function SheetFooter({
  onCancel, onConfirm, confirmLabel, busy, destructive, disabled,
}: { onCancel: () => void; onConfirm: () => void; confirmLabel: string; busy?: boolean; destructive?: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={f.row}>
      <TouchableOpacity style={f.cancel} onPress={onCancel} disabled={busy} activeOpacity={0.75}>
        <Text style={f.cancelTxt}>{t('common.cancel')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[f.confirm, destructive && f.confirmDestructive, (busy || disabled) && { opacity: 0.6 }]}
        onPress={onConfirm}
        disabled={busy || disabled}
        activeOpacity={0.85}
      >
        {busy ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={f.confirmTxt}>{confirmLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}
const f = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingBottom: 14 },
  cancel: { flex: 1, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault, alignItems: 'center' },
  cancelTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textSecondary },
  confirm: { flex: 2, paddingVertical: 13, borderRadius: RADIUS.md, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  confirmDestructive: { backgroundColor: COLORS.negative },
  confirmTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});

// ── Key / value rows for previews ─────────────────────────────────────────────
export function KV({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  if (value == null || value === '') return null;
  return (
    <View style={kv.row}>
      <Text style={kv.label}>{label}</Text>
      <Text style={[kv.value, mono && kv.mono]} selectable>{value}</Text>
    </View>
  );
}
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={kv.section}>{children}</Text>;
}
const kv = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  label: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, flexShrink: 0 },
  value: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: TYPOGRAPHY.xs },
  section: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.sm, marginBottom: 4 },
});

// ── Action sheet (⋯ menu) ─────────────────────────────────────────────────────
export interface SheetAction { key: string; label: string; icon: string; destructive?: boolean; disabled?: boolean }
export function ActionSheet({ visible, title, actions, onClose, onSelect }: {
  visible: boolean; title: string; actions: SheetAction[]; onClose: () => void; onSelect: (key: string) => void;
}) {
  return (
    <BottomModalShell visible={visible} onClose={onClose} title={title}>
      {actions.map((a, idx) => (
        <TouchableOpacity
          key={a.key}
          style={[as.row, idx > 0 && as.rowBorder, a.disabled && { opacity: 0.45 }]}
          onPress={() => { if (!a.disabled) { onClose(); onSelect(a.key); } }}
          disabled={a.disabled}
          activeOpacity={0.7}
        >
          <Ionicons name={a.icon as any} size={18} color={a.destructive ? COLORS.negative : COLORS.textSecondary} />
          <Text style={[as.txt, a.destructive && { color: COLORS.negative }]}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </BottomModalShell>
  );
}
const as = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  txt: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary, fontWeight: '500' },
});

// ── Dispatch form (shared by IRN "also EWB", EWB generate, bulk EWB) ──────────
export type DispatchForm = {
  dispatchFrom: string; shipTo: string; transportMode: string; distance: string; vehicleNumber: string; transporterId: string;
};
export const emptyDispatch = (): DispatchForm => ({ dispatchFrom: '', shipTo: '', transportMode: '1', distance: '', vehicleNumber: '', transporterId: '' });
const MODE_NAME: Record<string, string> = { '1': 'Road', '2': 'Rail', '3': 'Air', '4': 'Ship' };
export function toDispatchDetails(d: DispatchForm): DispatchDetails {
  return {
    dispatch_from: d.dispatchFrom.trim() || undefined,
    ship_to: d.shipTo.trim() || undefined,
    transport_mode: MODE_NAME[d.transportMode] || d.transportMode || undefined,
    distance: d.distance.trim() || undefined,
    vehicle_number: d.vehicleNumber.trim().toUpperCase() || undefined,
    transporter_id: d.transporterId.trim().toUpperCase() || undefined,
  };
}

export function DispatchFields({ value, onChange }: { value: DispatchForm; onChange: (v: DispatchForm) => void }) {
  const { t } = useTranslation();
  const set = (k: keyof DispatchForm) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <View>
      <FormField label={t('screens.reportsEwbList.dispatchFrom', { defaultValue: 'Dispatch from' })} value={value.dispatchFrom} onChangeText={set('dispatchFrom')} placeholder={t('screens.reportsEwbList.dispatchFromPh', { defaultValue: 'Place or pincode' })} />
      <FormField label={t('screens.reportsEwbList.shipTo', { defaultValue: 'Ship to' })} value={value.shipTo} onChangeText={set('shipTo')} placeholder={t('screens.reportsEwbList.shipToPh', { defaultValue: 'Place or pincode' })} />
      <FormDropdown label={t('screens.reportsEwbList.mode', { defaultValue: 'Mode' })} value={value.transportMode} options={TRANSPORT_MODES(t)} onSelect={(o) => onChange({ ...value, transportMode: o.value })} />
      <FormField label={t('screens.reportsEwbList.distanceKm', { defaultValue: 'Distance (km)' })} value={value.distance} onChangeText={set('distance')} keyboardType="numeric" placeholder="0" />
      <FormField label={t('screens.reportsEwbList.vehicleNumber', { defaultValue: 'Vehicle number' })} value={value.vehicleNumber} onChangeText={set('vehicleNumber')} autoCapitalize="characters" placeholder="KA01AB1234" />
      <FormField label={t('screens.reportsEwbList.transporterId', { defaultValue: 'Transporter ID' })} value={value.transporterId} onChangeText={set('transporterId')} autoCapitalize="characters" placeholder={t('screens.reportsEwbList.transporterIdPh', { defaultValue: 'When no vehicle is known' })} hint={t('screens.reportsEwbList.vehicleOrTransporter', { defaultValue: 'Vehicle number or transporter ID is required.' })} />
    </View>
  );
}

// ── Preview card (what goes to the portal) ────────────────────────────────────
export function PreviewCard({ preview, docNo, docDate, docType }: { preview: any; docNo?: string; docDate?: string; docType?: string }) {
  const { t } = useTranslation();
  const { formatAmount, formatDate } = useSettings();
  const p = preview || {};
  const doc = p.doc || {};
  const money = (v: any) => (v == null ? undefined : formatAmount(Number(v) || 0));
  const notes: string[] = Array.isArray(p.notes) ? p.notes : [];
  return (
    <View style={pc.card}>
      <SectionTitle>{t('screens.reportsEinvoiceList.document', { defaultValue: 'Document' })}</SectionTitle>
      <KV label={t('screens.reportsEinvoiceList.number', { defaultValue: 'Number' })} value={doc.no || docNo} />
      <KV label={t('pdf.date')} value={doc.date ? formatDate(doc.date) : (docDate ? formatDate(docDate) : undefined)} />
      <KV label={t('screens.reportsEinvoiceList.type', { defaultValue: 'Type' })} value={doc.type || docType} />
      {p.seller ? (
        <>
          <SectionTitle>{t('screens.reportsEinvoiceList.seller', { defaultValue: 'Seller' })}</SectionTitle>
          <KV label={t('company.gstin')} value={p.seller.gstin} mono />
          <KV label={t('screens.reportsEinvoiceList.name', { defaultValue: 'Name' })} value={p.seller.name} />
          <KV label={t('screens.reportsEinvoiceList.state', { defaultValue: 'State' })} value={p.seller.state} />
        </>
      ) : null}
      {p.buyer ? (
        <>
          <SectionTitle>{t('screens.reportsEinvoiceList.buyer', { defaultValue: 'Buyer' })}</SectionTitle>
          <KV label={t('company.gstin')} value={p.buyer.gstin} mono />
          <KV label={t('screens.reportsEinvoiceList.name', { defaultValue: 'Name' })} value={p.buyer.name} />
          <KV label={t('screens.reportsEinvoiceList.placeOfSupply', { defaultValue: 'Place of supply' })} value={p.buyer.pos} />
          <KV label={t('screens.reportsEinvoiceList.pincode', { defaultValue: 'Pincode' })} value={p.buyer.pincode} />
        </>
      ) : null}
      <SectionTitle>{t('screens.reportsEinvoiceList.amounts', { defaultValue: 'Amounts' })}</SectionTitle>
      <KV label={t('screens.reportsEinvoiceList.lines', { defaultValue: 'Lines' })} value={p.lines != null ? String(p.lines) : undefined} />
      <KV label={t('screens.reportsEinvoiceList.taxable', { defaultValue: 'Taxable' })} value={money(p.taxable)} />
      <KV label="CGST" value={p.cgst ? money(p.cgst) : undefined} />
      <KV label="SGST" value={p.sgst ? money(p.sgst) : undefined} />
      <KV label="IGST" value={p.igst ? money(p.igst) : undefined} />
      <KV label={t('pdf.total')} value={money(p.total)} />
      {notes.length > 0 && (
        <View style={pc.notes}>
          {notes.map((n, i) => (
            <View key={i} style={pc.noteRow}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning} />
              <Text style={pc.noteTxt}>{n}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
const pc = StyleSheet.create({
  card: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault, padding: SPACING.sm, marginBottom: SPACING.sm },
  notes: { marginTop: SPACING.sm, gap: 6 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  noteTxt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.warning, lineHeight: 16 },
});

export function CreditsLine({ credits }: { credits: number }) {
  const { t } = useTranslation();
  return (
    <View style={cl.row}>
      <Ionicons name="wallet-outline" size={15} color={COLORS.textSecondary} />
      <Text style={cl.txt}>{t('screens.reportsEinvoiceList.creditsCharged', { count: credits, defaultValue: '{{count}} credits will be charged' })}</Text>
    </View>
  );
}
const cl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  txt: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, fontWeight: '600' },
});

// ── Generate IRN confirmation ─────────────────────────────────────────────────
export function GenerateIrnSheet({ visible, row, busy, onClose, onConfirm }: {
  visible: boolean; row: any | null; busy?: boolean; onClose: () => void;
  onConfirm: (opts: { alsoEwb: boolean; dispatchDetails?: DispatchDetails }) => void;
}) {
  const { t } = useTranslation();
  const preview = row?.preview;
  const transportHas = !!preview?.transport?.has;
  const [alsoEwb, setAlsoEwb] = useState(false);
  const [dispatch, setDispatch] = useState<DispatchForm>(emptyDispatch());
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const rowKey = row ? String(row.guid || row.voucher_number) : null;
  if (visible && rowKey && seededFor !== rowKey) {
    setSeededFor(rowKey);
    setAlsoEwb(transportHas);
    setDispatch({ ...emptyDispatch(), ...dispatchFromPreview(preview, row?.dispatch) });
  }
  const credits = GENERATE_CREDITS + (alsoEwb ? GENERATE_CREDITS : 0);
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.reportsEinvoiceList.registerTitle', { defaultValue: 'Register e-invoice' })}
      footer={(
        <SheetFooter
          onCancel={onClose}
          busy={busy}
          onConfirm={() => onConfirm({ alsoEwb, dispatchDetails: alsoEwb ? toDispatchDetails(dispatch) : undefined })}
          confirmLabel={t('screens.reportsEinvoiceList.generate', { defaultValue: 'Generate' })}
        />
      )}
    >
      <PreviewCard preview={preview} docNo={row?.voucher_number} docDate={row?.date} docType={row?.voucher_type} />
      <CreditsLine credits={credits} />
      <View style={g.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={g.switchLabel}>{t('screens.reportsEinvoiceList.alsoEwb', { defaultValue: 'Also generate e-way bill' })}</Text>
          <Text style={g.switchSub}>{t('screens.reportsEinvoiceList.alsoEwbSub', { count: GENERATE_CREDITS, defaultValue: '{{count}} more credits' })}</Text>
        </View>
        <BrandSwitch value={alsoEwb} onValueChange={setAlsoEwb} />
      </View>
      {alsoEwb && (
        <View style={g.dispatchBox}>
          <SectionTitle>{t('screens.reportsEwbList.dispatchDetails', { defaultValue: 'Dispatch details' })}</SectionTitle>
          <DispatchFields value={dispatch} onChange={setDispatch} />
        </View>
      )}
    </BottomModalShell>
  );
}

// ── Generate EWB confirmation ─────────────────────────────────────────────────
export function GenerateEwbSheet({ visible, row, busy, onClose, onConfirm, bulkCount }: {
  visible: boolean; row: any | null; busy?: boolean; onClose: () => void;
  onConfirm: (dispatchDetails: DispatchDetails) => void;
  /** When set, the sheet is the shared form for a bulk run and shows no preview. */
  bulkCount?: number;
}) {
  const { t } = useTranslation();
  const preview = row?.preview;
  const [dispatch, setDispatch] = useState<DispatchForm>(emptyDispatch());
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const rowKey = row ? String(row.guid || row.voucher_number) : (bulkCount != null ? `bulk-${bulkCount}` : null);
  if (visible && rowKey && seededFor !== rowKey) {
    setSeededFor(rowKey);
    setDispatch({ ...emptyDispatch(), ...dispatchFromPreview(preview, row?.dispatch) });
  }
  const credits = GENERATE_CREDITS * (bulkCount || 1);
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={bulkCount
        ? t('screens.reportsEwbList.generateBulkTitle', { count: bulkCount, defaultValue: 'Generate {{count}} e-way bills' })
        : t('screens.reportsEwbList.generateTitle', { defaultValue: 'Generate e-way bill' })}
      footer={(
        <SheetFooter
          onCancel={onClose}
          busy={busy}
          onConfirm={() => onConfirm(toDispatchDetails(dispatch))}
          confirmLabel={t('screens.reportsEinvoiceList.generate', { defaultValue: 'Generate' })}
        />
      )}
    >
      {!bulkCount && <PreviewCard preview={preview} docNo={row?.voucher_number} docDate={row?.date} docType={row?.voucher_type} />}
      <CreditsLine credits={credits} />
      <SectionTitle>{t('screens.reportsEwbList.dispatchDetails', { defaultValue: 'Dispatch details' })}</SectionTitle>
      <DispatchFields value={dispatch} onChange={setDispatch} />
    </BottomModalShell>
  );
}

// ── Bulk IRN confirmation ─────────────────────────────────────────────────────
export function GenerateIrnBulkSheet({ visible, rows, busy, onClose, onConfirm }: {
  visible: boolean; rows: any[]; busy?: boolean; onClose: () => void; onConfirm: (alsoEwb: boolean) => void;
}) {
  const { t } = useTranslation();
  const [alsoEwb, setAlsoEwb] = useState(false);
  const credits = rows.length * GENERATE_CREDITS * (alsoEwb ? 2 : 1);
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.reportsEinvoiceList.registerBulkTitle', { count: rows.length, defaultValue: 'Register {{count}} e-invoices' })}
      footer={<SheetFooter onCancel={onClose} busy={busy} onConfirm={() => onConfirm(alsoEwb)} confirmLabel={t('screens.reportsEinvoiceList.generate', { defaultValue: 'Generate' })} />}
    >
      {rows.map((r) => (
        <View key={String(r.guid)} style={g.bulkRow}>
          <Text style={g.bulkNo}>{r.voucher_number}</Text>
          <Text style={g.bulkParty} numberOfLines={1}>{r.party_name}</Text>
        </View>
      ))}
      <CreditsLine credits={credits} />
      <View style={g.switchRow}>
        <Text style={[g.switchLabel, { flex: 1 }]}>{t('screens.reportsEinvoiceList.alsoEwbPlural', { defaultValue: 'Also generate e-way bills' })}</Text>
        <BrandSwitch value={alsoEwb} onValueChange={setAlsoEwb} />
      </View>
    </BottomModalShell>
  );
}

const g = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  switchLabel: { fontSize: TYPOGRAPHY.base, fontWeight: '600', color: COLORS.textPrimary },
  switchSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
  dispatchBox: { marginTop: SPACING.sm },
  bulkRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  bulkNo: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  bulkParty: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary },
});

// ── Cancel with reason ────────────────────────────────────────────────────────
export function CancelSheet({ visible, title, hint, busy, onClose, onConfirm, reasons }: {
  visible: boolean; title: string; hint?: string; busy?: boolean; onClose: () => void;
  onConfirm: (reason: string, remarks: string) => void;
  /** Reason codes of the document being cancelled (IRN by default; pass EWB_CANCEL_REASONS for an e-way bill). */
  reasons?: Option[];
}) {
  const { t } = useTranslation();
  const reasonOptions = reasons || CANCEL_REASONS(t);
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  // A fresh form every time the sheet opens.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) { setReason(''); setRemarks(''); }
  }
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={title}
      footer={(
        <SheetFooter
          onCancel={onClose}
          busy={busy}
          destructive
          disabled={!reason || !remarks.trim()}
          onConfirm={() => onConfirm(reason, remarks.trim())}
          confirmLabel={t('screens.reportsEinvoiceList.cancelConfirm', { defaultValue: 'Cancel registration' })}
        />
      )}
    >
      {hint ? <Text style={c.hint}>{hint}</Text> : null}
      <FormDropdown label={t('screens.reportsEinvoiceList.reason', { defaultValue: 'Reason' })} required value={reason} options={reasonOptions} onSelect={(o) => setReason(o.value)} placeholder={t('common.select')} />
      <FormField label={t('screens.reportsEinvoiceList.remarks', { defaultValue: 'Remarks' })} required value={remarks} onChangeText={setRemarks} placeholder={t('screens.reportsEinvoiceList.remarksPh', { defaultValue: 'Why this is being cancelled' })} multiline />
    </BottomModalShell>
  );
}
const c = StyleSheet.create({
  hint: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
});

// ── Verify result ─────────────────────────────────────────────────────────────
export function VerifyResultSheet({ visible, result, onClose }: { visible: boolean; result: any | null; onClose: () => void }) {
  const { t } = useTranslation();
  const matches = !!result?.matches;
  const diffs: any[] = Array.isArray(result?.differences) ? result.differences : [];
  return (
    <BottomModalShell visible={visible} onClose={onClose} title={t('screens.reportsEinvoiceList.verifyTitle', { defaultValue: 'Verify signed data' })}>
      {result ? (
        <>
          <View style={[v.banner, { backgroundColor: matches ? COLORS.positiveBg : COLORS.negativeBg }]}>
            <Ionicons name={matches ? 'shield-checkmark-outline' : 'alert-circle-outline'} size={18} color={matches ? COLORS.positive : COLORS.negative} />
            <Text style={[v.bannerTxt, { color: matches ? COLORS.positive : COLORS.negative }]}>
              {matches
                ? t('screens.reportsEinvoiceList.verifyMatch', { defaultValue: 'Signed data matches this invoice' })
                : t('screens.reportsEinvoiceList.verifyMismatch', { count: diffs.length, defaultValue: '{{count}} differences found' })}
            </Text>
          </View>
          <KV label={t('screens.reportsEinvoiceList.portalStatus', { defaultValue: 'Portal status' })} value={result.portalStatus ? String(result.portalStatus) : undefined} />
          <KV label={t('screens.reportsEinvoiceList.checkedAt', { defaultValue: 'Checked at' })} value={result.checkedAt ? new Date(result.checkedAt).toLocaleString() : undefined} />
          {diffs.map((d, i) => (
            <View key={i} style={v.diff}>
              <Text style={v.diffField}>{String(d.field || d.key || '')}</Text>
              <Text style={v.diffTxt}>{t('screens.reportsEinvoiceList.verifySigned', { defaultValue: 'Signed' })}: {String(d.signed ?? d.expected ?? '')}</Text>
              <Text style={v.diffTxt}>{t('screens.reportsEinvoiceList.verifyLocal', { defaultValue: 'Local' })}: {String(d.local ?? d.actual ?? '')}</Text>
            </View>
          ))}
        </>
      ) : <ActivityIndicator color={COLORS.brandPrimary} />}
    </BottomModalShell>
  );
}
const v = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.sm, borderRadius: RADIUS.md, marginBottom: SPACING.sm },
  bannerTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, fontWeight: '700' },
  diff: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.borderDefault },
  diffField: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  diffTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2 },
});
