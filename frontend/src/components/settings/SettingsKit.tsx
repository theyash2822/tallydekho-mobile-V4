/**
 * Pieces shared by the account screens (Approvals, My Access, Billing & Credits, Notifications): the card,
 * row, pill and notice styles of Settings → Company Information, and a header icon button that matches
 * the ScreenHeader back button.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/colors';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type Tone = 'positive' | 'warning' | 'negative' | 'info' | 'neutral';

export const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  positive: { fg: COLORS.positive, bg: COLORS.positiveBg },
  warning: { fg: COLORS.warning, bg: COLORS.warningBg },
  negative: { fg: COLORS.negative, bg: COLORS.negativeBg },
  info: { fg: COLORS.info, bg: COLORS.infoBg },
  neutral: { fg: COLORS.textSecondary, bg: COLORS.hoverBg },
};

const CALLOUT_ICON: Record<Tone, IconName> = {
  positive: 'checkmark-circle-outline',
  warning: 'warning-outline',
  negative: 'alert-circle-outline',
  info: 'information-circle-outline',
  neutral: 'information-circle-outline',
};

const HEADER_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

/** Uppercase caption above a group of cards. */
export function SectionLabel({ title, style }: { title: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.sectionLabel, style]}>{title}</Text>;
}

/** White bordered card with an optional uppercase title inside it. */
export function SettingsCard({ title, style, children, testID }: {
  title?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={[s.card, style]} testID={testID}>
      {title ? <Text style={s.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

/** Label above its value; a rule under it unless it is the last row of the card. */
export function InfoRow({ label, value, right, last, children }: {
  label: string;
  /** Leave out to show only `children` under the label. */
  value?: string | null;
  right?: React.ReactNode;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={[s.row, !last && s.rowRule]}>
      <View style={s.rowMain}>
        <Text style={s.infoLabel}>{label}</Text>
        {value !== undefined ? <Text style={s.infoValue} selectable>{value || '—'}</Text> : null}
        {children}
      </View>
      {right}
    </View>
  );
}

/** Icon circle, title and subtitle, then `right`; a chevron when the row opens something. */
export function ListRow({ icon, tone, title, subtitle, right, onPress, last, dimmed, testID }: {
  icon?: IconName;
  /** Tints the icon circle; without a tone it is the neutral Settings circle. */
  tone?: Tone;
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  dimmed?: boolean;
  testID?: string;
}) {
  const tint = tone ? TONE_COLORS[tone] : null;
  const iconColor = dimmed ? COLORS.textTertiary : tint ? tint.fg : COLORS.textSecondary;
  const content = (
    <>
      {icon ? (
        <View style={[s.iconCircle, tint && { backgroundColor: tint.bg, borderColor: tint.bg }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      ) : null}
      <View style={s.rowMain}>
        <Text style={[s.listTitle, dimmed && s.dimmed]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={s.listSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} /> : null}
    </>
  );
  if (!onPress) return <View style={[s.row, !last && s.rowRule]} testID={testID}>{content}</View>;
  return (
    <TouchableOpacity
      style={[s.row, !last && s.rowRule]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      testID={testID}
    >
      {content}
    </TouchableOpacity>
  );
}

export function StatusPill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = TONE_COLORS[tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <Text style={[s.pillTxt, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Tinted notice with an icon, like the Tally notice on Company Information. */
export function Callout({ text, tone = 'info', icon, style, testID }: {
  text: string;
  tone?: Tone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = TONE_COLORS[tone];
  return (
    <View style={[s.callout, { backgroundColor: c.bg }, style]} testID={testID}>
      <Ionicons name={icon ?? CALLOUT_ICON[tone]} size={18} color={c.fg} />
      <Text style={s.calloutTxt}>{text}</Text>
    </View>
  );
}

/** Round icon button for the ScreenHeader `right` slot, the size of its back button. */
export function HeaderIconButton({ icon, label, onPress, disabled, busy, testID }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={s.headerBtn}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.7}
      hitSlop={HEADER_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      testID={testID}
    >
      {busy
        ? <ActivityIndicator size="small" color={COLORS.textPrimary} />
        : <Ionicons name={icon} size={20} color={disabled ? COLORS.textTertiary : COLORS.textPrimary} />}
    </TouchableOpacity>
  );
}

export function HeaderActions({ children }: { children: React.ReactNode }) {
  return <View style={s.headerActions}>{children}</View>;
}

const s = StyleSheet.create({
  sectionLabel: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: SPACING.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  rowMain: { flex: 1 },
  infoLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.textTertiary, marginBottom: 5 },
  infoValue: { fontSize: TYPOGRAPHY.base, color: COLORS.textPrimary },
  iconCircle: {
    width: 32, height: 32, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.pageBg, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  listTitle: { fontSize: TYPOGRAPHY.sm, fontWeight: '600', color: COLORS.textPrimary },
  listSub: { fontSize: TYPOGRAPHY.xs, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },
  dimmed: { color: COLORS.textTertiary },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full,
  },
  pillTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: '700' },
  callout: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: 12,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  calloutTxt: { flex: 1, fontSize: TYPOGRAPHY.sm, lineHeight: 19, color: COLORS.textPrimary, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerBtn: {
    width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.pageBg,
    alignItems: 'center', justifyContent: 'center',
  },
});
