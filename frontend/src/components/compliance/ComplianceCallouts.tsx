/**
 * One-line notices above the e-invoice / e-way bill lists (spec 2026-11-04 §4.3): Tally has stopped syncing,
 * and the ₹10 Cr question that decides the 30-day limit is still unanswered.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { safePush } from '../../utils/safeNavigation';

export function ComplianceCallout({ text, icon, tone = 'warn', onPress, testID }: {
  text: string; icon: string; tone?: 'warn' | 'info'; onPress?: () => void; testID?: string;
}) {
  const fg = tone === 'warn' ? COLORS.warning : COLORS.info;
  const body = (
    <View style={[s.box, { backgroundColor: tone === 'warn' ? COLORS.warningBg : COLORS.infoBg }]}>
      <Ionicons name={icon as any} size={16} color={fg} />
      <Text style={s.txt}>{text}</Text>
      {onPress ? <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.8} testID={testID}>{body}</TouchableOpacity>;
}

/** Tally has not synced for a day: invoices entered since then are missing from the list. */
export function StaleDesktopBanner({ desktop }: { desktop?: { stale?: boolean; hours?: number | null } | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (!desktop?.stale) return null;
  const hours = Math.round(Number(desktop.hours) || 0);
  return (
    <ComplianceCallout
      testID="stale-desktop-banner"
      icon="cloud-offline-outline"
      text={hours > 0 ? t('screens.reportsEinvoiceList.staleDesktop', { hours }) : t('screens.reportsEinvoiceList.staleDesktopNoHours')}
      onPress={() => safePush(router, '/settings/tally-sync' as any)}
    />
  );
}

/** The ₹10 Cr answer is missing: nothing is blocked yet, but the 30-day limit may apply (spec §2.2). */
export function Rule30Callout({ rule30Days, canConfigure }: { rule30Days?: boolean | null; canConfigure: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (rule30Days !== null || !canConfigure) return null;
  return (
    <ComplianceCallout
      testID="rule30-callout"
      tone="info"
      icon="help-circle-outline"
      text={t('screens.reportsEinvoiceList.rule30Unanswered')}
      onPress={() => safePush(router, '/settings/einvoice' as any)}
    />
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: SPACING.sm },
  txt: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.textPrimary, lineHeight: 17 },
});
