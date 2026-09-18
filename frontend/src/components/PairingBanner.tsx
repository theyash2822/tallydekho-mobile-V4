import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { safePush } from '../utils/safeNavigation';
import { COLORS, RADIUS, SPACING } from '../constants/colors';
import { useWorkspace } from '../context/WorkspaceContext';

/**
 * Compact Demo / waiting-for-sync chip on Home.
 * UNPAIRED → connect CTA. RECONNECTING → waiting for first sync.
 */
export const PairingBanner: React.FC = () => {
  const router = useRouter();
  const { pairingStatus } = useWorkspace();
  const reconnecting = String(pairingStatus).toUpperCase() === 'RECONNECTING';

  return (
    <TouchableOpacity
      style={s.banner}
      onPress={() => safePush(router, '/settings/tally-sync' as any)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        reconnecting
          ? 'Paired, waiting for first Tally sync'
          : 'Showing demo data. Tap to connect Tally Prime'
      }
    >
      <View style={s.dot} />
      <Text style={s.title} numberOfLines={1}>
        {reconnecting ? 'Paired · waiting for first sync' : 'Demo data · tap to connect Tally'}
      </Text>
      <Ionicons name="chevron-forward" size={14} color={COLORS.warning} />
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    marginHorizontal: SPACING.md,
    marginTop: 6,
    marginBottom: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningBg,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.28)',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.warning,
  },
  title: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});

export default PairingBanner;
