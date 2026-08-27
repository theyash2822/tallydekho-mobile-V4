import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, RADIUS } from '../constants/colors';

type OfflineVariant = 'desktop' | 'device';

interface OfflineBadgeProps {
  /** desktop = Tally/desktop offline chip; device = phone has no internet */
  variant?: OfflineVariant;
  message?: string;
  onRetry?: () => void;
}

/**
 * OfflineBadge — distinct copy for device network vs desktop/Tally offline.
 */
export const OfflineBadge: React.FC<OfflineBadgeProps> = ({
  variant = 'desktop',
  message,
  onRetry,
}) => {
  const { t } = useTranslation();
  const isDevice = variant === 'device';
  const text =
    message ||
    (isDevice
      ? t('errors.noInternet', 'No internet connection')
      : t('errors.desktopOffline', 'Desktop offline · Showing last cached data'));

  return (
    <View style={[s.badge, isDevice ? s.device : s.desktop]}>
      <Ionicons
        name={isDevice ? 'wifi-outline' : 'cloud-offline-outline'}
        size={14}
        color={isDevice ? '#991B1B' : '#92400E'}
      />
      <Text style={[s.text, isDevice ? s.deviceText : s.desktopText]} numberOfLines={2}>
        {text}
      </Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[s.retry, isDevice ? s.deviceText : s.desktopText]}>
            {t('common.retry', 'Retry')}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: 4,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 8,
  },
  desktop: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  device: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  desktopText: { color: '#92400E' },
  deviceText: { color: '#991B1B' },
  retry: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default OfflineBadge;
