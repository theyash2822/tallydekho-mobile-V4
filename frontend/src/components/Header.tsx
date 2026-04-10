import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';

const FY_YEARS = [
  'FY 2025-26',
  'FY 2024-25',
  'FY 2023-24',
  'FY 2022-23',
  'FY 2021-22',
];

interface HeaderProps {
  companyName?: string;
  fyYear?: string;
  notificationCount?: number;
  onNotificationPress?: () => void;
  onMenuPress?: () => void;
  onCompanyPress?: () => void;
  onFYChange?: (fy: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  companyName = 'Tally Dekho',
  fyYear = 'FY 2025-26',
  notificationCount = 1,
  onNotificationPress,
  onMenuPress,
  onCompanyPress,
  onFYChange,
}) => {
  const router = useRouter();
  const [selectedFY, setSelectedFY] = useState(fyYear);
  const [showFYModal, setShowFYModal] = useState(false);

  const handleNotification = () => {
    onNotificationPress?.();
    router.push('/notifications' as any);
  };

  const handleFYSelect = (fy: string) => {
    setSelectedFY(fy);
    onFYChange?.(fy);
    setShowFYModal(false);
  };

  return (
    <>
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

        {/* Right: FY Dropdown + Bell + Menu */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            testID="fy-selector"
            style={styles.fyPill}
            onPress={() => setShowFYModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.fyText}>{selectedFY}</Text>
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

      {/* FY Year Dropdown Modal */}
      <Modal
        testID="fy-modal"
        visible={showFYModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFYModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setShowFYModal(false)}
          activeOpacity={1}
        >
          <View style={styles.fyDropdown}>
            {/* Arrow pointing up */}
            <View style={styles.dropdownArrow} />
            <Text style={styles.dropdownTitle}>Financial Year</Text>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {FY_YEARS.map(fy => (
                <TouchableOpacity
                  key={fy}
                  testID={`fy-option-${fy}`}
                  style={[
                    styles.fyOption,
                    selectedFY === fy && styles.fyOptionActive,
                  ]}
                  onPress={() => handleFYSelect(fy)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.fyOptionText,
                    selectedFY === fy && styles.fyOptionTextActive,
                  ]}>
                    {fy}
                  </Text>
                  {selectedFY === fy && (
                    <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
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
  // FY Dropdown Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: SPACING.md,
  },
  fyDropdown: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    minWidth: 180,
    borderWidth: 1,
    borderColor: COLORS.borderDefault,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  dropdownArrow: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: COLORS.borderDefault,
    alignSelf: 'flex-end',
    marginRight: 20,
    marginTop: -5,
    transform: [{ rotate: '45deg' }],
  },
  dropdownTitle: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: '700',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  fyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDefault,
  },
  fyOptionActive: {
    backgroundColor: COLORS.activeBg,
  },
  fyOptionText: {
    fontSize: TYPOGRAPHY.base,
    color: COLORS.textPrimary,
    fontWeight: '400',
  },
  fyOptionTextActive: {
    fontWeight: '700',
    color: COLORS.brandPrimary,
  },
});

export default Header;
