/**
 * A card, menu item or screen outside the member's access: it stays in place, blurred, with a
 * lock; tapping it says "Not in your access". Callers render placeholders, never real figures.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../constants/colors';

export function useNotInAccess() {
  const { t } = useTranslation();
  return () => Toast.show({ type: 'info', text1: t('common.notInYourAccess', { defaultValue: 'Not in your access' }) });
}

/**
 * Drawn inside a card (which must clip with `overflow: 'hidden'`): blurs the card's own content and
 * shows a small lock. The card keeps its own size and layout; it handles the tap itself.
 */
export function LockLayer() {
  return (
    <>
      <BlurView pointerEvents="none" intensity={22} tint="light" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.center]}>
        <View style={s.lockCircle}>
          <Ionicons name="lock-closed" size={13} color={COLORS.textSecondary} />
        </View>
      </View>
    </>
  );
}

type Props = { locked: boolean; children: React.ReactNode; style?: ViewStyle; testID?: string };

/** Wraps a whole area (e.g. a locked screen's placeholder cards); single cards use LockLayer. */
export default function LockedOverlay({ locked, children, style, testID }: Props) {
  const { t } = useTranslation();
  const notInAccess = useNotInAccess();
  if (!locked) return <>{children}</>;
  return (
    <View style={[style, s.clip]} testID={testID || 'locked-overlay'}>
      <View pointerEvents="none">{children}</View>
      <LockLayer />
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={notInAccess}
        accessibilityLabel={t('common.notInYourAccess', { defaultValue: 'Not in your access' })}
      />
    </View>
  );
}

/** The server's "Your 3 parties" label, in the user's language. */
export function useScopeLabel() {
  const { t } = useTranslation();
  return (label?: string | null) => {
    const m = /^Your (\d+) part(?:y|ies)$/.exec(String(label || ''));
    return m ? t('home.yourParties', { count: Number(m[1]), defaultValue: label || '' }) : (label || '');
  };
}

/** A whole screen outside the member's access: placeholder cards behind the blur, with a lock. */
export function LockedScreen({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Text style={s.screenTitle}>{t(titleKey)}</Text>
      <LockedOverlay locked testID="screen-locked">
        <View style={s.screenBody}>
          {[120, 84, 84, 84].map((h, i) => <View key={i} style={[s.placeholder, { height: h }]} />)}
        </View>
      </LockedOverlay>
    </SafeAreaView>
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
  clip: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  lockCircle: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)', borderWidth: 1, borderColor: COLORS.borderDefault,
  },
  hidden: { color: COLORS.textSecondary },
  screen: { flex: 1, backgroundColor: COLORS.pageBg },
  screenTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  screenBody: { padding: 16, gap: 12 },
  placeholder: { borderRadius: 14, backgroundColor: COLORS.cardBg, borderWidth: 1, borderColor: COLORS.borderDefault },
});
