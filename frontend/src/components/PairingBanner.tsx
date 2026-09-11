import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../utils/safeNavigation';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

/**
 * PairingBanner — shown at the top of the dashboard when isPaired = false.
 * Tapping navigates to Settings › Tally Sync so the user can pair.
 * Displays demo data notice so users understand what they're seeing.
 */
export const PairingBanner: React.FC = () => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={s.banner}
      onPress={() => safePush(router, '/settings/tally-sync' as any)}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="Connect Tally Prime to see real data"
    >
      <View style={s.iconWrap}>
        <Ionicons name="link-outline" size={20} color={COLORS.white} />
      </View>
      <View style={s.textBlock}>
        <Text style={s.title}>Showing demo data</Text>
        <Text style={s.sub}>Tap to connect Tally Prime and see real numbers</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandPrimary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: 4,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1 },
  title: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  sub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    lineHeight: 15,
  },
});

export default PairingBanner;
