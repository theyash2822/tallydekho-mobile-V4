/**
 * "Check vehicle" beside a vehicle number (spec 2026-11-04 §2.5): POST /ewaybills/vehicle-check asks Vahan for the
 * registration, insurance, PUC and fitness dates. Hidden for the rest of the session once the server says Vahan
 * is not set up (`available: false`).
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, RADIUS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { checkEwbVehicle, type VehicleCheckResult } from '../../services/api';

let vahanUnavailable = false;

export default function VehicleCheck({ vehicleNo }: { vehicleNo: string }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(vahanUnavailable);
  const [result, setResult] = useState<{ number: string; data?: VehicleCheckResult; error?: string } | null>(null);
  const number = String(vehicleNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (hidden || vahanUnavailable) return null;
  const shown = result && result.number === number ? result : null;

  const check = async () => {
    if (!company?.guid || !number) return;
    setBusy(true);
    try {
      const res: any = await checkEwbVehicle(company.guid, number);
      const data: VehicleCheckResult = res?.data ?? res ?? {};
      if (data.available === false) {
        vahanUnavailable = true;
        setHidden(true);
        return;
      }
      setResult({ number, data });
    } catch (e: any) {
      setResult({ number, error: e?.message || t('screens.reportsEwbList.vehicleCheckFailed') });
    } finally {
      setBusy(false);
    }
  };

  const d = shown?.data;
  const dates = d?.found ? [
    d.insurance_upto ? t('screens.reportsEwbList.vehicleInsurance', { date: d.insurance_upto }) : '',
    d.puc_upto ? t('screens.reportsEwbList.vehiclePuc', { date: d.puc_upto }) : '',
    d.fitness_upto ? t('screens.reportsEwbList.vehicleFitness', { date: d.fitness_upto }) : '',
  ].filter(Boolean).join(' · ') : '';

  return (
    <View style={s.wrap}>
      <TouchableOpacity style={[s.btn, number.length < 6 && { opacity: 0.5 }]} onPress={check} disabled={busy || number.length < 6} activeOpacity={0.7} testID="vehicle-check">
        {busy ? <ActivityIndicator size="small" color={COLORS.info} /> : <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.info} />}
        <Text style={s.btnTxt}>{t('screens.reportsEwbList.checkVehicle')}</Text>
      </TouchableOpacity>
      {d && d.found && (
        <View style={s.result}>
          <Text style={s.title}>{[d.vehicle_no || number, d.vehicle_class, d.maker_model].filter(Boolean).join(' · ')}</Text>
          {!!d.owner_name_masked && <Text style={s.line}>{t('screens.reportsEwbList.vehicleOwner', { name: d.owner_name_masked })}</Text>}
          {!!dates && <Text style={s.line}>{dates}</Text>}
          {!!d.status_note && <Text style={[s.line, { color: COLORS.warning }]}>{d.status_note}</Text>}
        </View>
      )}
      {d && d.found === false && <Text style={[s.line, { color: COLORS.warning }]}>{t('screens.reportsEwbList.vehicleNotFound')}</Text>}
      {!!shown?.error && <Text style={[s.line, { color: COLORS.negative }]}>{shown.error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: -8, marginBottom: 12, gap: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.info },
  btnTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.info },
  result: { backgroundColor: COLORS.pageBg, borderRadius: RADIUS.md, padding: 10, gap: 3 },
  title: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  line: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17 },
});
