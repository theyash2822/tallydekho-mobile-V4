/**
 * Compliance alerts (spec 2026-11-04 §1.4, §2.6): one row per alert kind with an on / off switch and the
 * Push · Email · WhatsApp channels, plus how many hours before expiry the e-way bill warning goes out.
 * GET /api/alert-settings returns `compliance_alerts` whole (defaults filled) and `whatsapp_compliance_ready`;
 * each change is a PATCH the server merges kind by kind. WhatsApp stays off until the template is approved.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { getAlertSettings, updateAlertSettings } from '../../services/api';
import { toastRbasError } from '../../utils/rbasErrors';
import BrandSwitch from '../forms/BrandSwitch';

type Channel = 'push' | 'email' | 'whatsapp';
type KindSetting = { enabled: boolean; channels: Record<Channel, boolean>; hours_before?: number };
type Change = { enabled?: boolean; channels?: Partial<Record<Channel, boolean>>; hours_before?: number };

const GROUPS: { titleKey: string; kinds: string[] }[] = [
  { titleKey: 'screens.settingsComplianceReminders.eInvoice', kinds: ['einvoice_deadline', 'einvoice_expired', 'auto_failure'] },
  { titleKey: 'screens.settingsComplianceReminders.eWayBill', kinds: ['ewb_expiry', 'ewb_incoming'] },
  { titleKey: 'reports.gst', kinds: ['gst_due', 'gst_deposit', 'gst_session'] },
  { titleKey: 'screens.settingsComplianceReminders.groupGeneral', kinds: ['desktop_stale', 'turnover'] },
];
const CHANNELS: { key: Channel; labelKey?: string; label?: string }[] = [
  { key: 'push', labelKey: 'screens.settingsComplianceReminders.channelPush' },
  { key: 'email', labelKey: 'screens.settingsComplianceReminders.channelEmail' },
  { key: 'whatsapp', label: 'WhatsApp' },
];

export default function ComplianceAlertsCard({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<Record<string, KindSetting> | null>(null);
  const [whatsappReady, setWhatsappReady] = useState(false);
  const [canEdit, setCanEdit] = useState(canManage);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAlertSettings()
      .then((res: any) => {
        if (cancelled) return;
        const d = res?.data ?? res ?? {};
        setAlerts(d.compliance_alerts && typeof d.compliance_alerts === 'object' ? d.compliance_alerts : {});
        setWhatsappReady(d.whatsapp_compliance_ready === true);
        if (typeof d.can_edit_workspace_alerts === 'boolean') setCanEdit(d.can_edit_workspace_alerts);
        setFailed(false);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const change = async (kind: string, delta: Change) => {
    if (!canEdit || !alerts?.[kind]) return;
    const before = alerts;
    const cur = alerts[kind];
    setAlerts({ ...alerts, [kind]: { ...cur, ...delta, channels: { ...cur.channels, ...(delta.channels || {}) } } });
    try {
      await updateAlertSettings({ compliance_alerts: { [kind]: delta } });
    } catch (e) {
      setAlerts(before);
      toastRbasError(e) || Toast.show({ type: 'error', text1: t('common.error'), text2: t('screens.settingsComplianceReminders.couldNotSave') });
    }
  };

  return (
    <View style={st.card} testID="compliance-alerts-card">
      <View style={st.hdr}>
        <Ionicons name="notifications-outline" size={18} color={COLORS.brandPrimary} />
        <Text style={st.title}>{t('screens.settingsComplianceReminders.alertsTitle')}</Text>
      </View>
      <Text style={st.sub}>{t('screens.settingsComplianceReminders.alertsSub')}</Text>
      {!canEdit && <Text style={st.sub}>{t('common.ownerAdminOnly')}</Text>}
      {!whatsappReady && alerts && <Text style={st.waNote}>{t('screens.settingsComplianceReminders.whatsappPending')}</Text>}

      {failed ? (
        <TouchableOpacity onPress={() => setReloadKey((k) => k + 1)} activeOpacity={0.7} style={{ paddingVertical: 8 }}>
          <Text style={st.error}>{t('screens.settingsComplianceReminders.alertsLoadFailed')}</Text>
        </TouchableOpacity>
      ) : !alerts ? (
        <ActivityIndicator color={COLORS.brandPrimary} style={{ marginVertical: 12 }} />
      ) : (
        GROUPS.map((g) => (
          <View key={g.titleKey}>
            <Text style={st.group}>{t(g.titleKey)}</Text>
            {g.kinds.filter((k) => alerts[k]).map((kind) => {
              const a = alerts[kind];
              const hours = Number(a.hours_before) || 8;
              return (
                <View key={kind} style={st.kind}>
                  <View style={st.kindRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.kindTitle}>{t(`screens.settingsComplianceReminders.alert_${kind}`)}</Text>
                      <Text style={st.kindHelp}>{t(`screens.settingsComplianceReminders.alert_${kind}Help`)}</Text>
                    </View>
                    <BrandSwitch value={!!a.enabled} onValueChange={(v: boolean) => change(kind, { enabled: v })} disabled={!canEdit} />
                  </View>
                  {a.enabled && (
                    <View style={st.chips}>
                      {CHANNELS.map((ch) => {
                        const blocked = ch.key === 'whatsapp' && !whatsappReady;
                        const on = !!a.channels?.[ch.key] && !blocked;
                        return (
                          <TouchableOpacity
                            key={ch.key}
                            style={[st.chip, on && st.chipOn, (blocked || !canEdit) && { opacity: 0.45 }]}
                            onPress={() => change(kind, { channels: { [ch.key]: !a.channels?.[ch.key] } })}
                            disabled={blocked || !canEdit}
                            activeOpacity={0.7}
                            testID={`alert-${kind}-${ch.key}`}
                          >
                            <Text style={[st.chipTxt, on && st.chipTxtOn]}>{ch.labelKey ? t(ch.labelKey) : ch.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {kind === 'ewb_expiry' && a.enabled && (
                    <View style={st.stepper}>
                      <Text style={st.stepLabel}>{t('screens.settingsComplianceReminders.hoursBeforeExpiry')}</Text>
                      <TouchableOpacity style={[st.stepBtn, (hours <= 1 || !canEdit) && { opacity: 0.4 }]} onPress={() => change(kind, { hours_before: hours - 1 })} disabled={hours <= 1 || !canEdit} activeOpacity={0.7}>
                        <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                      <Text style={st.stepVal}>{hours}</Text>
                      <TouchableOpacity style={[st.stepBtn, (hours >= 24 || !canEdit) && { opacity: 0.4 }]} onPress={() => change(kind, { hours_before: hours + 1 })} disabled={hours >= 24 || !canEdit} activeOpacity={0.7}>
                        <Ionicons name="add" size={16} color={COLORS.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 17, marginBottom: 6 },
  waNote: { fontSize: TYPOGRAPHY.xs, color: COLORS.warning, lineHeight: 17, marginBottom: 6 },
  error: { fontSize: TYPOGRAPHY.sm, color: COLORS.negative },
  group: { fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: SPACING.md, marginBottom: 2 },
  kind: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kindTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  kindHelp: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, lineHeight: 16, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg, borderWidth: 1.5, borderColor: COLORS.borderDefault },
  chipOn: { backgroundColor: COLORS.brandPrimary, borderColor: COLORS.brandPrimary },
  chipTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600', color: COLORS.textSecondary },
  chipTxtOn: { color: COLORS.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stepLabel: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderDefault },
  stepVal: { minWidth: 28, textAlign: 'center', fontSize: TYPOGRAPHY.base, fontWeight: '800', color: COLORS.textPrimary },
});
