// ApiStateViews — reusable loading/error/empty state components
// Used by all screens to comply with Strict Production Data Rule
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../constants/colors';
import { friendlyUserMessage } from '../services/apiErrors';

// ── Loading ────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.brandPrimary} />
      <Text style={s.subText}>{message}</Text>
    </View>
  );
}

// ── Error ──────────────────────────────────────────────────────
export function ErrorState({
  message,
  onRetry,
  title = 'Something went wrong',
}: { message?: string; onRetry?: () => void; title?: string }) {
  const detail = friendlyUserMessage(message);
  return (
    <View style={s.center}>
      <View style={s.iconCircle}>
        <Ionicons name="alert-circle-outline" size={32} color={COLORS.negative} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.subText}>{detail}</Text>
      {onRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={16} color={COLORS.white} />
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Empty ──────────────────────────────────────────────────────
export function EmptyState({
  title = 'No data available',
  subtitle,
  icon = 'document-outline',
}: { title?: string; subtitle?: string; icon?: any }) {
  return (
    <View style={s.center}>
      <View style={[s.iconCircle, { backgroundColor: COLORS.activeBg }]}>
        <Ionicons name={icon} size={32} color={COLORS.textSecondary} />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subText}>{subtitle}</Text>}
    </View>
  );
}

// ── Inline Error Banner (for screens with partial data) ────────
export function ErrorBanner({
  message,
  onRetry,
}: { message: string; onRetry?: () => void }) {
  const detail = friendlyUserMessage(message);
  return (
    <View style={s.banner}>
      <Ionicons name="alert-circle-outline" size={16} color={COLORS.negative} />
      <Text style={s.bannerText} numberOfLines={2}>{detail}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={s.bannerRetry}>
          <Text style={s.bannerRetryText}>Retry</Text>
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
  const detail = friendlyUserMessage(message);
  return (
    <View style={s.sectionErr}>
      <Ionicons name="alert-circle-outline" size={16} color={COLORS.negative} />
      <Text style={s.sectionErrText} numberOfLines={2}>{detail}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={s.bannerRetry}>
          <Text style={s.bannerRetryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
