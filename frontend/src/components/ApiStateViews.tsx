// ApiStateViews — reusable loading/error/empty state components
// Used by all screens to comply with Strict Production Data Rule
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../constants/colors';

// ── Loading ────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary || '#3F5263'} />
      <Text style={s.subText}>{message}</Text>
    </View>
  );
}

// ── Error ──────────────────────────────────────────────────────
export function ErrorState({
  message,
  onRetry,
}: { message?: string; onRetry?: () => void }) {
  return (
    <View style={s.center}>
      <View style={s.iconCircle}>
        <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
      </View>
      <Text style={s.title}>Something went wrong</Text>
      <Text style={s.subText}>{message || 'Failed to load data'}</Text>
      {onRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Ionicons name="refresh-outline" size={16} color="#fff" />
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
      <View style={[s.iconCircle, { backgroundColor: '#F5F4EF' }]}>
        <Ionicons name={icon} size={32} color="#787774" />
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
  return (
    <View style={s.banner}>
      <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
      <Text style={s.bannerText} numberOfLines={2}>{message}</Text>
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
    padding: SPACING?.lg || 24,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subText: {
    fontSize: 13,
    color: '#787774',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3F5263',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS?.md || 8,
    marginTop: 4,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS?.md || 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  bannerText: { flex: 1, fontSize: 13, color: '#DC2626' },
  bannerRetry: { paddingVertical: 2, paddingHorizontal: 8 },
  bannerRetryText: { fontSize: 13, color: '#DC2626', fontWeight: '600', textDecorationLine: 'underline' },
});
