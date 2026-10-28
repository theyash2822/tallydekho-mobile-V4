// ApiStateViews — reusable loading/error/empty state components
// Used by all screens to comply with Strict Production Data Rule
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/colors';
import { friendlyUserMessage, isAccessMessage } from '../services/apiErrors';

// ── Loading ────────────────────────────────────────────────────
export function LoadingState({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      <Text style={s.subText}>{message ?? t('common.loading')}</Text>
    </View>
  );
}

// ── Error ──────────────────────────────────────────────────────
export function ErrorState({
  message,
  onRetry,
  title,
}: { message?: string; onRetry?: () => void; title?: string }) {
  const { t } = useTranslation();
  // Outside the member's access: a lock, not an error, and nothing to retry.
  if (isAccessMessage(message)) {
    return (
      <View style={s.center}>
        <View style={[s.iconCircle, { backgroundColor: COLORS.activeBg }]}>
          <Ionicons name="lock-closed-outline" size={30} color={COLORS.textSecondary} />
        </View>
        <Text style={s.title}>{t('common.notInYourAccess', { defaultValue: 'Not in your access' })}</Text>
        <Text style={s.subText}>{t('common.askOwnerForAccess', { defaultValue: 'Ask the Workspace Owner if you need this for this company.' })}</Text>
      </View>
    );
  }
  const detail = friendlyUserMessage(message);
  return (
    <View style={s.center}>
      <View style={s.iconCircle}>
        <Ionicons name="alert-circle-outline" size={32} color={COLORS.negative} />
      </View>
      <Text style={s.title}>{title ?? t('common.somethingWentWrong')}</Text>
      <Text style={s.subText}>{detail}</Text>
      {onRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.white} />
          <Text style={s.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Empty ──────────────────────────────────────────────────────
export function EmptyState({
  title,
  subtitle,
  icon = 'document-outline',
}: { title?: string; subtitle?: string; icon?: any }) {
  const { t } = useTranslation();
  return (
    <View style={s.center}>
      <View style={[s.iconCircle, { backgroundColor: COLORS.activeBg }]}>
        <Ionicons name={icon} size={32} color={COLORS.textSecondary} />
      </View>
      <Text style={s.title}>{title ?? t('common.noData')}</Text>
      {subtitle && <Text style={s.subText}>{subtitle}</Text>}
    </View>
  );
}

// ── Inline Error Banner (for screens with partial data) ────────
export function ErrorBanner({
  message,
  onRetry,
}: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (isAccessMessage(message)) return <LockedNote />;
  const detail = friendlyUserMessage(message);
  return (
    <View style={s.banner}>
      <Ionicons name="alert-circle-outline" size={16} color={COLORS.negative} />
      <Text style={s.bannerText} numberOfLines={2}>{detail}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={s.bannerRetry}>
          <Text style={s.bannerRetryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Compact section-level error (e.g. Cashflow failed while Home still shows KPIs) */
export function SectionError({
  message,
  onRetry,
}: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  if (isAccessMessage(message)) return <LockedNote />;
  const detail = friendlyUserMessage(message);
  return (
    <View style={s.sectionErr}>
      <Ionicons name="alert-circle-outline" size={16} color={COLORS.negative} />
      <Text style={s.sectionErrText} numberOfLines={2}>{detail}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={s.bannerRetry}>
          <Text style={s.bannerRetryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** One-line lock note used in place of an error banner when the member's access refuses the data. */
function LockedNote() {
  const { t } = useTranslation();
  return (
    <View style={s.lockedNote}>
      <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
      <Text style={s.lockedNoteText} numberOfLines={2}>{t('common.notInYourAccess', { defaultValue: 'Not in your access' })}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  lockedNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: SPACING.md, marginVertical: SPACING.sm, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: RADIUS.md, backgroundColor: COLORS.activeBg,
  },
  lockedNoteText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    gap: 12,
    backgroundColor: COLORS.pageBg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.negativeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.brandPrimary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  retryText: { color: COLORS.white, fontSize: TYPOGRAPHY.sm, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.negativeBg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bannerText: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.negative },
  bannerRetry: { paddingVertical: 2, paddingHorizontal: 8 },
  bannerRetryText: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.brandPrimary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  sectionErr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.negativeBg,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 12,
    minHeight: 48,
  },
  sectionErrText: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.negative },
});
