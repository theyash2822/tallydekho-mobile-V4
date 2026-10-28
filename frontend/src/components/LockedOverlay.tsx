/**
 * A card, menu item or screen outside the member's access: it stays in place, blurred, with a
 * lock; tapping it says "Not in your access". Callers render placeholders, never real figures.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants/colors';

export function useNotInAccess() {
  const { t } = useTranslation();
  return () => Toast.show({ type: 'info', text1: t('common.notInYourAccess', { defaultValue: 'Not in your access' }) });
}

type Props = { locked: boolean; children: React.ReactNode; style?: ViewStyle; compact?: boolean; testID?: string };

export default function LockedOverlay({ locked, children, style, compact = false, testID }: Props) {
  const { t } = useTranslation();
  const notInAccess = useNotInAccess();
  if (!locked) return <>{children}</>;
  return (
    <View style={style} testID={testID || 'locked-overlay'}>
      <View pointerEvents="none">{children}</View>
      <BlurView intensity={18} tint="light" style={[StyleSheet.absoluteFill, s.round]} />
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, s.center]}
        activeOpacity={0.8}
        onPress={notInAccess}
        accessibilityLabel={t('common.notInYourAccess', { defaultValue: 'Not in your access' })}
      >
        <View style={s.badge}>
          <Ionicons name="lock-closed" size={12} color={COLORS.textSecondary} />
          {!compact && <Text style={s.badgeText}>{t('common.notInYourAccess', { defaultValue: 'Not in your access' })}</Text>}
        </View>
      </TouchableOpacity>
    </View>
  );
}

/** A hidden sensitive value: a lock and "Hidden", never a zero. */
export function HiddenValue({ style }: { style?: any }) {
  const { t } = useTranslation();
  return (
    <Text style={[s.hidden, style]}>
      <Ionicons name="lock-closed" size={11} color={COLORS.textSecondary} /> {t('common.hidden', { defaultValue: 'Hidden' })}
    </Text>
  );
}

const s = StyleSheet.create({
  round: { borderRadius: 14, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  hidden: { color: COLORS.textSecondary },
});
