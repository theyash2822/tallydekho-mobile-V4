import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS } from '../constants/colors';

/**
 * OfflineBadge — shown when isPaired = true but desktop is offline.
 * Communicates clearly that data is cached and may not be current.
 */
export const OfflineBadge: React.FC = () => (
  <View style={s.badge}>
    <Ionicons name="cloud-offline-outline" size={14} color="#92400E" />
    <Text style={s.text}>Desktop offline · Showing last cached data</Text>
  </View>
);

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: 4,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 8,
  },
  text: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});

export default OfflineBadge;
