/**
 * The request card of Settings → Requests: icon, title and time, a pill, details and the two decision
 * buttons. Approvals (Hard Sync, restore) and invitations share it so both tabs read the same way.
 */
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';
import { TONE_COLORS, type IconName, type Tone } from '../settings/SettingsKit';
import { toMs } from '../../hooks/usePendingRequests';

export type Translate = (key: string, options?: Record<string, unknown>) => string;
/** `key` is the card key; `action` is the button that is working. */
export type Busy = { key: string; action: 'approve' | 'reject' } | null;

export function CardHead({ icon, tone, title, when: time, pill }: {
  icon: IconName; tone: Tone; title: string; when?: string | null; pill?: React.ReactNode;
}) {
  const c = TONE_COLORS[tone];
  return (
    <View style={rs.head}>
      <View style={[rs.headIcon, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={18} color={c.fg} />
      </View>
      <View style={rs.grow}>
        <Text style={rs.title} numberOfLines={2}>{title}</Text>
        {time ? <Text style={rs.when}>{time}</Text> : null}
      </View>
      {pill}
    </View>
  );
}

export function Meta({ icon, text, tone }: { icon: IconName; text: string; tone?: Tone | null }) {
  const color = tone ? TONE_COLORS[tone].fg : COLORS.textSecondary;
  return (
    <View style={rs.meta}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[rs.metaTxt, { color }]}>{text}</Text>
    </View>
  );
}

/** Reject / Approve (or Decline / Accept): a spinner on the pressed one, both locked while any card works. */
export function DecisionButtons({ busyKey, busy, approveLabel, rejectLabel, approveDisabled, onApprove, onReject }: {
  busyKey: string;
  busy: Busy;
  approveLabel: string;
  rejectLabel?: string;
  approveDisabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const approving = busy?.key === busyKey && busy.action === 'approve';
  const rejecting = busy?.key === busyKey && busy.action === 'reject';
  const locked = !!busy;
  return (
    <View style={rs.actions}>
      <TouchableOpacity
        style={[rs.btn, rs.rejectBtn, locked && !rejecting && rs.btnDim]}
        disabled={locked}
        onPress={onReject}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked, busy: rejecting }}
      >
        {rejecting
          ? <ActivityIndicator size="small" color={COLORS.negative} />
          : <Text style={rs.rejectTxt}>{rejectLabel ?? t('screens.settingsApprovals.reject')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={[rs.btn, rs.approveBtn, ((locked && !approving) || approveDisabled) && rs.btnDim]}
        disabled={locked || approveDisabled}
        onPress={onApprove}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked || !!approveDisabled, busy: approving }}
      >
        {approving
          ? <ActivityIndicator size="small" color={COLORS.white} />
          : <Text style={rs.approveTxt}>{approveLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}

export function when(value: unknown): string {
  const ms = toMs(value);
  return ms
    ? new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

/** Countdown to a request's expiry, counted from when the list was fetched. */
export function expiryOf(expiresAt: unknown, now: number, t: Translate): { text: string; tone: Tone | null } | null {
  const at = toMs(expiresAt);
  if (!at || !now) return null;
  const minutes = Math.ceil((at - now) / 60000);
  if (minutes <= 0) return { text: t('screens.settingsApprovals.expired', { defaultValue: 'Expired' }), tone: 'negative' };
  if (minutes < 60) {
    return {
      text: t('screens.settingsApprovals.expiresInMinutes', { minutes, defaultValue: 'Expires in {{minutes}} min' }),
      tone: 'warning',
    };
  }
  if (minutes < 48 * 60) {
    return {
      text: t('screens.settingsApprovals.expiresInHours', {
        hours: Math.floor(minutes / 60), minutes: minutes % 60, defaultValue: 'Expires in {{hours}} h {{minutes}} min',
      }),
      tone: null,
    };
  }
  return { text: t('screens.settingsApprovals.expiresAt', { time: when(expiresAt) }), tone: null };
}

export const rs = StyleSheet.create({
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  contentEmpty: { flexGrow: 1 },
  grow: { flex: 1 },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headIcon: { width: 36, height: 36, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPOGRAPHY.base, fontWeight: '700', color: COLORS.textPrimary },
  when: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.xs, marginTop: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  metaTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  btn: {
    flex: 1, minHeight: 44, borderRadius: RADIUS.md, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDim: { opacity: 0.5 },
  rejectBtn: { backgroundColor: COLORS.negativeBg },
  approveBtn: { backgroundColor: COLORS.brandPrimary },
  rejectTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.negative },
  approveTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.white },
});
