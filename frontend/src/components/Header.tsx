import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/colors';

interface HeaderProps {
  companyName?: string;
  fyYear?: string;
  notificationCount?: number;
  onNotificationPress?: () => void;
  onMenuPress?: () => void;
  onCompanyPress?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  companyName = 'Tally Dekho',
  fyYear = 'FY 2025-26',
  notificationCount = 1,
  onNotificationPress,
  onMenuPress,
  onCompanyPress,
}) => {
  const router = useRouter();

  const handleNotification = () => {
    onNotificationPress?.();
    router.push('/notifications' as any);
  };

  return (
    <View testID="app-header" style={styles.container}>
      {/* Left: Logo + Company Name */}
      <TouchableOpacity
        testID="company-selector"
        style={styles.leftSection}
        onPress={onCompanyPress}
        activeOpacity={0.7}
      >
        <View style={styles.logoBox}>
          <Ionicons name="stats-chart" size={16} color={COLORS.brandPrimary} />
        </View>
        <Text style={styles.companyName} numberOfLines={1}>
          {companyName}
        </Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Right: FY + Bell + Menu */}
      <View style={styles.rightSection}>
        <TouchableOpacity testID="fy-selector" style={styles.fyPill} activeOpacity={0.7}>
          <Text style={styles.fyText}>{fyYear}</Text>
          <Ionicons name="chevron-down" size={11} color={COLORS.brandPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="notification-btn"
          style={styles.iconBtn}
          onPress={handleNotification}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
          {notificationCount > 0 && (
            <View testID="notification-badge" style={styles.badge}>
              <Text style={styles.badgeText}>{notificationCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          testID="menu-btn"
          style={styles.iconBtn}
          onPress={onMenuPress}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: SPACING.sm,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.activeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: TYPOGRAPHY.base,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
    borderRadius: 6,
    borderStyle: 'dashed',
  },
  fyText: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '600',
    color: COLORS.brandPrimary,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    color: COLORS.white,
    fontWeight: '700',
  },
});

export default Header;
