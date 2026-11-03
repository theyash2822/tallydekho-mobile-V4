/**
 * IRN / EWB status chips used on sales rows and the compliance record screen.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, RADIUS } from '../../constants/colors';
import type { EwbStatus, IrnStatus } from './complianceShared';

const TONE: Record<string, { bg: string; fg: string }> = {
  generated: { bg: COLORS.positiveBg, fg: COLORS.positive },
  pending:   { bg: COLORS.warningBg, fg: COLORS.warning },
  failed:    { bg: COLORS.negativeBg, fg: COLORS.negative },
  expired:   { bg: COLORS.negativeBg, fg: COLORS.negative },
  cancelled: { bg: COLORS.hoverBg, fg: COLORS.textSecondary },
  none:      { bg: COLORS.hoverBg, fg: COLORS.textTertiary },
};

export function StatusChip({ label, tone, onPress }: { label: string; tone: keyof typeof TONE; onPress?: () => void }) {
  const c = TONE[tone] || TONE.none;
  const body = (
    <View style={[s.chip, { backgroundColor: c.bg }]}>
      <Text style={[s.txt, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>{body}</TouchableOpacity>;
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

const s = StyleSheet.create({
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, alignSelf: 'flex-start' },
  txt: { fontSize: 10, fontWeight: '700' },
});
