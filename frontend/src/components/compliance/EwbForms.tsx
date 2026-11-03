/**
 * e-Way Bill forms (spec §2.5): Part B / vehicle, transporter, extend validity,
 * consolidated bill. Each sheet validates the required fields and hands the
 * body to the caller, which owns the API call.
 */
import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/colors';
import { BottomModalShell } from '../forms/BottomModalShell';
import FormField from '../forms/FormField';
import FormDropdown from '../forms/FormDropdown';
import { SheetFooter, SectionTitle } from './ComplianceSheets';
import { CONSIGNMENT_STATUS, EXTEND_REASONS, TRANSPORT_MODES, VEHICLE_REASONS } from './complianceShared';

type Common = { visible: boolean; busy?: boolean; onClose: () => void };

/** Complete Part B (no vehicle yet → reason 4 "First time") or update the vehicle. */
export function EwbVehicleSheet({ visible, busy, onClose, onSubmit, record }: Common & {
  record: any | null;
  onSubmit: (body: { vehicleNo: string; fromPlace: string; fromState: string; reasonCode: string; reasonRem: string; transMode: string; transDocNo?: string; transDocDate?: string }) => void;
}) {
  const { t } = useTranslation();
  const partB = !record?.vehicle_no;
  const [vehicleNo, setVehicleNo] = useState('');
  const [fromPlace, setFromPlace] = useState('');
  const [fromState, setFromState] = useState('');
  const [reasonCode, setReasonCode] = useState(partB ? '4' : '');
  const [reasonRem, setReasonRem] = useState('');
  const [transMode, setTransMode] = useState('1');
  const [transDocNo, setTransDocNo] = useState('');
  const [transDocDate, setTransDocDate] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = record ? String(record.ewb_no || record.ewb_number || '') : null;
  if (visible && key != null && seeded !== key) {
    setSeeded(key);
    setVehicleNo(String(record?.vehicle_no || ''));
    setFromPlace(String(record?.from_place || record?.dispatch_from || ''));
    setFromState(String(record?.from_state || ''));
    setReasonCode(partB ? '4' : '');
    setReasonRem('');
  }
  // Road needs a vehicle; rail / air / ship need the transport document instead (same rule as the server).
  const road = transMode === '1';
  const valid = fromPlace.trim() && fromState.trim() && reasonCode && (road ? vehicleNo.trim() : transDocNo.trim()) && (reasonCode === '4' || reasonRem.trim());
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={partB
        ? t('screens.reportsEwbList.completePartB', { defaultValue: 'Complete Part B' })
        : t('screens.reportsEwbList.updateVehicle', { defaultValue: 'Update vehicle' })}
      footer={<SheetFooter onCancel={onClose} busy={busy} disabled={!valid} confirmLabel={t('common.update')} onConfirm={() => onSubmit({
        vehicleNo: vehicleNo.trim().toUpperCase(), fromPlace: fromPlace.trim(), fromState: fromState.trim(), reasonCode,
        reasonRem: reasonRem.trim() || (reasonCode === '4' ? 'First time' : ''), transMode,
        transDocNo: transDocNo.trim() || undefined, transDocDate: transDocDate.trim() || undefined,
      })} />}
    >
      <FormDropdown label={t('screens.reportsEwbList.mode', { defaultValue: 'Mode' })} value={transMode} options={TRANSPORT_MODES(t)} onSelect={(o) => setTransMode(o.value)} />
      <FormField label={t('screens.reportsEwbList.vehicleNumber', { defaultValue: 'Vehicle number' })} required={road} value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" placeholder="KA01AB1234" />
      <FormField label={t('screens.reportsEwbList.fromPlace', { defaultValue: 'From place' })} required value={fromPlace} onChangeText={setFromPlace} />
      <FormField label={t('screens.reportsEwbList.fromState', { defaultValue: 'From state' })} required value={fromState} onChangeText={setFromState} />
      <FormDropdown label={t('screens.reportsEinvoiceList.reason', { defaultValue: 'Reason' })} required value={reasonCode} options={VEHICLE_REASONS(t)} onSelect={(o) => setReasonCode(o.value)} placeholder={t('common.select')} />
      <FormField label={t('screens.reportsEinvoiceList.remarks', { defaultValue: 'Remarks' })} required={reasonCode !== '4'} value={reasonRem} onChangeText={setReasonRem} />
      <FormField label={t('screens.reportsEwbList.transDocNo', { defaultValue: 'Transport document no.' })} required={!road} value={transDocNo} onChangeText={setTransDocNo} />
      <FormField label={t('screens.reportsEwbList.transDocDate', { defaultValue: 'Transport document date' })} value={transDocDate} onChangeText={setTransDocDate} placeholder="DD/MM/YYYY" />
    </BottomModalShell>
  );
}

export function EwbTransporterSheet({ visible, busy, onClose, onSubmit, current }: Common & { current?: string; onSubmit: (transporterId: string) => void }) {
  const { t } = useTranslation();
  const [transporterId, setTransporterId] = useState(current || '');
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.reportsEwbList.updateTransporter', { defaultValue: 'Update transporter' })}
      footer={<SheetFooter onCancel={onClose} busy={busy} disabled={!transporterId.trim()} confirmLabel={t('common.update')} onConfirm={() => onSubmit(transporterId.trim().toUpperCase())} />}
    >
      <FormField label={t('screens.reportsEwbList.transporterId', { defaultValue: 'Transporter ID' })} required value={transporterId} onChangeText={setTransporterId} autoCapitalize="characters" placeholder="29AAACW1234A1ZX" />
    </BottomModalShell>
  );
}

export function EwbExtendSheet({ visible, busy, onClose, onSubmit, record }: Common & {
  record: any | null;
  onSubmit: (body: {
    vehicleNo: string; fromPlace: string; fromState: string; fromPincode: string; remainingDistance: string;
    transMode: string; extendRsnCode: string; extendRemarks: string; consignmentStatus: 'M' | 'T'; transitType?: string; addressLine1?: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const [vehicleNo, setVehicleNo] = useState(String(record?.vehicle_no || ''));
  const [fromPlace, setFromPlace] = useState('');
  const [fromState, setFromState] = useState('');
  const [fromPincode, setFromPincode] = useState('');
  const [remainingDistance, setRemainingDistance] = useState('');
  const [transMode, setTransMode] = useState('1');
  const [extendRsnCode, setExtendRsnCode] = useState('');
  const [extendRemarks, setExtendRemarks] = useState('');
  const [consignmentStatus, setConsignmentStatus] = useState<'M' | 'T'>('M');
  const [transitType, setTransitType] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const valid = fromPlace.trim() && fromState.trim() && /^\d{6}$/.test(fromPincode.trim()) && remainingDistance.trim() && extendRsnCode && extendRemarks.trim()
    && (consignmentStatus === 'T' || vehicleNo.trim());
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.reportsEwbList.extendValidity', { defaultValue: 'Extend validity' })}
      footer={<SheetFooter onCancel={onClose} busy={busy} disabled={!valid} confirmLabel={t('screens.reportsEwbList.extend', { defaultValue: 'Extend' })} onConfirm={() => onSubmit({
        vehicleNo: vehicleNo.trim().toUpperCase(), fromPlace: fromPlace.trim(), fromState: fromState.trim(), fromPincode: fromPincode.trim(),
        remainingDistance: remainingDistance.trim(), transMode, extendRsnCode, extendRemarks: extendRemarks.trim(), consignmentStatus,
        transitType: consignmentStatus === 'T' ? (transitType.trim() || undefined) : undefined,
        addressLine1: consignmentStatus === 'T' ? (addressLine1.trim() || undefined) : undefined,
      })} />}
    >
      <Text style={s.note}>{t('screens.reportsEwbList.extendWindow', { defaultValue: 'The portal allows an extension only within 8 hours before or after expiry.' })}</Text>
      <FormDropdown label={t('screens.reportsEwbList.consignmentStatus', { defaultValue: 'Consignment' })} value={consignmentStatus} options={CONSIGNMENT_STATUS(t)} onSelect={(o) => setConsignmentStatus(o.value as 'M' | 'T')} />
      <FormField label={t('screens.reportsEwbList.vehicleNumber', { defaultValue: 'Vehicle number' })} required={consignmentStatus === 'M'} value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
      <FormField label={t('screens.reportsEwbList.fromPlace', { defaultValue: 'From place' })} required value={fromPlace} onChangeText={setFromPlace} />
      <FormField label={t('screens.reportsEwbList.fromState', { defaultValue: 'From state' })} required value={fromState} onChangeText={setFromState} />
      <FormField label={t('screens.reportsEwbList.fromPincode', { defaultValue: 'From pincode' })} required value={fromPincode} onChangeText={setFromPincode} keyboardType="numeric" maxLength={6} />
      <FormField label={t('screens.reportsEwbList.remainingDistance', { defaultValue: 'Remaining distance (km)' })} required value={remainingDistance} onChangeText={setRemainingDistance} keyboardType="numeric" />
      <FormDropdown label={t('screens.reportsEwbList.mode', { defaultValue: 'Mode' })} value={transMode} options={TRANSPORT_MODES(t)} onSelect={(o) => setTransMode(o.value)} />
      <FormDropdown label={t('screens.reportsEinvoiceList.reason', { defaultValue: 'Reason' })} required value={extendRsnCode} options={EXTEND_REASONS(t)} onSelect={(o) => setExtendRsnCode(o.value)} placeholder={t('common.select')} />
      <FormField label={t('screens.reportsEinvoiceList.remarks', { defaultValue: 'Remarks' })} required value={extendRemarks} onChangeText={setExtendRemarks} />
      {consignmentStatus === 'T' && (
        <>
          <SectionTitle>{t('screens.reportsEwbList.transitDetails', { defaultValue: 'Transit details' })}</SectionTitle>
          <FormField label={t('screens.reportsEwbList.transitType', { defaultValue: 'Transit type (R road, W warehouse, O others)' })} value={transitType} onChangeText={setTransitType} autoCapitalize="characters" maxLength={1} />
          <FormField label={t('screens.reportsEwbList.addressLine1', { defaultValue: 'Address line 1' })} value={addressLine1} onChangeText={setAddressLine1} />
        </>
      )}
    </BottomModalShell>
  );
}

export function ConsolidateSheet({ visible, busy, onClose, onSubmit, ewbNos }: Common & {
  ewbNos: string[];
  onSubmit: (body: { fromPlace: string; fromState: string; vehicleNo: string; transMode: string; transDocNo?: string; transDocDate?: string }) => void;
}) {
  const { t } = useTranslation();
  const [fromPlace, setFromPlace] = useState('');
  const [fromState, setFromState] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transMode, setTransMode] = useState('1');
  const [transDocNo, setTransDocNo] = useState('');
  const [transDocDate, setTransDocDate] = useState('');
  const valid = fromPlace.trim() && fromState.trim() && vehicleNo.trim() && ewbNos.length > 0;
  return (
    <BottomModalShell
      visible={visible}
      onClose={onClose}
      title={t('screens.reportsEwbList.consolidateTitle', { count: ewbNos.length, defaultValue: 'Consolidate {{count}} bills' })}
      footer={<SheetFooter onCancel={onClose} busy={busy} disabled={!valid} confirmLabel={t('screens.reportsEwbList.consolidate', { defaultValue: 'Consolidate' })} onConfirm={() => onSubmit({
        fromPlace: fromPlace.trim(), fromState: fromState.trim(), vehicleNo: vehicleNo.trim().toUpperCase(), transMode,
        transDocNo: transDocNo.trim() || undefined, transDocDate: transDocDate.trim() || undefined,
      })} />}
    >
      <Text style={s.note}>{ewbNos.join(' · ')}</Text>
      <FormField label={t('screens.reportsEwbList.vehicleNumber', { defaultValue: 'Vehicle number' })} required value={vehicleNo} onChangeText={setVehicleNo} autoCapitalize="characters" />
      <FormField label={t('screens.reportsEwbList.fromPlace', { defaultValue: 'From place' })} required value={fromPlace} onChangeText={setFromPlace} />
      <FormField label={t('screens.reportsEwbList.fromState', { defaultValue: 'From state' })} required value={fromState} onChangeText={setFromState} />
      <FormDropdown label={t('screens.reportsEwbList.mode', { defaultValue: 'Mode' })} value={transMode} options={TRANSPORT_MODES(t)} onSelect={(o) => setTransMode(o.value)} />
      <FormField label={t('screens.reportsEwbList.transDocNo', { defaultValue: 'Transport document no.' })} value={transDocNo} onChangeText={setTransDocNo} />
      <FormField label={t('screens.reportsEwbList.transDocDate', { defaultValue: 'Transport document date' })} value={transDocDate} onChangeText={setTransDocDate} placeholder="DD/MM/YYYY" />
    </BottomModalShell>
  );
}

const s = StyleSheet.create({
  note: { fontSize: TYPOGRAPHY.sm, color: COLORS.textSecondary, marginBottom: SPACING.sm, lineHeight: 20 },
});
