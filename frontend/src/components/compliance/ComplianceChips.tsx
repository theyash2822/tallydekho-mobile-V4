/**
 * IRN / EWB status chips used on sales rows and the compliance record screen, the e-invoice
 * days-left chip and the e-way bill document kind tag (spec 2026-11-04 §4.3).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, RADIUS } from '../../constants/colors';
import type { EwbStatus, IrnStatus } from './complianceShared';
import { daysLeftChip } from '../../utils/complianceRules';

const TONE: Record<string, { bg: string; fg: string }> = {
  generated: { bg: COLORS.positiveBg, fg: COLORS.positive },
  pending:   { bg: COLORS.warningBg, fg: COLORS.warning },
  failed:    { bg: COLORS.negativeBg, fg: COLORS.negative },
  expired:   { bg: COLORS.negativeBg, fg: COLORS.negative },
  cancelled: { bg: COLORS.hoverBg, fg: COLORS.textSecondary },
  none:      { bg: COLORS.hoverBg, fg: COLORS.textTertiary },
  muted:     { bg: COLORS.hoverBg, fg: COLORS.textSecondary },
  info:      { bg: COLORS.infoBg, fg: COLORS.info },
};

export function StatusChip({ label, tone, onPress, testID }: { label: string; tone: keyof typeof TONE; onPress?: () => void; testID?: string }) {
  const c = TONE[tone] || TONE.none;
  const body = (
    <View style={[s.chip, { backgroundColor: c.bg }]} testID={onPress ? undefined : testID}>
      <Text style={[s.txt, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} testID={testID}>{body}</TouchableOpacity>;
}

export function IrnChip({ status, onPress }: { status: IrnStatus; onPress?: () => void }) {
  const { t } = useTranslation();
  if (status === 'none') return null;
  const label = {
    generated: t('screens.reportsEinvoiceList.chipIrnDone', { defaultValue: 'IRN generated' }),
    pending: t('screens.reportsEinvoiceList.chipIrnPending', { defaultValue: 'IRN pending' }),
    failed: t('screens.reportsEinvoiceList.chipIrnFailed', { defaultValue: 'IRN failed' }),
    cancelled: t('screens.reportsEinvoiceList.chipIrnCancelled', { defaultValue: 'IRN cancelled' }),
  }[status];
  return <StatusChip label={label} tone={status} onPress={onPress} />;
}

export function EwbChip({ status, onPress }: { status: EwbStatus; onPress?: () => void }) {
  const { t } = useTranslation();
  if (status === 'none') return null;
  const label = {
    generated: t('screens.reportsEwbList.chipEwbDone', { defaultValue: 'EWB generated' }),
    pending: t('screens.reportsEwbList.chipEwbPending', { defaultValue: 'EWB pending' }),
    expired: t('screens.reportsEwbList.chipEwbExpired', { defaultValue: 'EWB expired' }),
    cancelled: t('screens.reportsEwbList.chipEwbCancelled', { defaultValue: 'EWB cancelled' }),
  }[status];
  return <StatusChip label={label} tone={status} onPress={onPress} />;
}

/** How long the IRP still accepts this e-invoice: gray above 10 days, amber 4–10, red 0–3, then "Window closed". */
export function DaysLeftChip({ row }: { row: { days_left?: number | null; urgency?: string | null } }) {
  const { t } = useTranslation();
  const chip = daysLeftChip(row);
  if (!chip) return null;
  const label = chip.label === 'windowClosed' ? t('screens.reportsEinvoiceList.windowClosed')
    : chip.label === 'lastDay' ? t('screens.reportsEinvoiceList.lastDayToday')
      : chip.label === 'dayLeft' ? t('screens.reportsEinvoiceList.dayLeft')
        : t('screens.reportsEinvoiceList.daysLeft', { count: chip.count });
  return <StatusChip label={label} tone={chip.tone === 'red' ? 'failed' : chip.tone === 'amber' ? 'pending' : 'muted'} testID="days-left-chip" />;
}

/** The e-way bill document kind on a row (sales invoices carry no tag). */
export function DocKindTag({ kind }: { kind?: string | null }) {
  const { t } = useTranslation();
  if (!kind || kind === 'sales') return null;
  const label = t(`screens.reportsEwbList.kind_${kind}`, { defaultValue: '' });
  if (!label) return null;
  return <StatusChip label={label} tone="info" testID="ewb-kind-tag" />;
}

const s = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  txt: { fontSize: 10, fontWeight: '700' },
});
