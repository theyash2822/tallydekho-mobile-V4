import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { MOCK_COMPANIES } from '../data/mockData';

const FY_YEARS = [
  'FY 2025-26', 'FY 2024-25', 'FY 2023-24', 'FY 2022-23', 'FY 2021-22',
];

// Mock last synced time — will be replaced by real state/context when backend is integrated
const MOCK_LAST_SYNCED = '15 Jun 2025, 11:42 AM';

interface HeaderProps {
  companyName?: string;
  fyYear?: string;
  notificationCount?: number;
  lastSyncTime?: string;
  userName?: string;
  onNotificationPress?: () => void;
  onFYChange?: (fy: string) => void;
  onSettingsPress?: () => void;
  onCompanyChange?: (company: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  companyName = 'YK Industries Pvt. Ltd.',
  fyYear = 'FY 2025-26',
  notificationCount = 1,
  lastSyncTime = MOCK_LAST_SYNCED,
  userName = 'Ashish Agarwal',
  onNotificationPress,
  onFYChange,
  onSettingsPress,
  onCompanyChange,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFY,      setSelectedFY]      = useState(fyYear);
  const [selectedCompany, setSelectedCompany] = useState(companyName);
  const [showFYModal,      setShowFYModal]      = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  const dropdownTop = insets.top + 58;

  const handleNotification = () => {
    onNotificationPress?.();
    router.push('/notifications' as any);
  };

  const handleSettings = () => {
    if (onSettingsPress) onSettingsPress();
    else router.push('/settings' as any);
  };

  const handleFYSelect = (fy: string) => {
    setSelectedFY(fy);
    onFYChange?.(fy);
    setShowFYModal(false);
  };

  const handleCompanySelect = (name: string) => {
    setSelectedCompany(name);
    onCompanyChange?.(name);
    setShowCompanyModal(false);
  };

  // Abbreviate long company names
  const shortCompany = selectedCompany.length > 24
    ? selectedCompany.substring(0, 22) + '\u2026'
    : selectedCompany;

  return (
    <>
      <View testID="app-header" style={styles.container}>
        {/* Left: Logo + Company Dropdown + Sync time */}
        <TouchableOpacity
          testID="company-selector"
          style={styles.leftSection}
          onPress={() => setShowCompanyModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.companyBlock}>
            <View style={styles.companyRow}>
              <Text style={styles.companyName} numberOfLines={1}>{shortCompany}</Text>
              <Ionicons name="chevron-down" size={12} color={COLORS.brandPrimary} />
            </View>
            {lastSyncTime ? (
              <View style={styles.syncRow}>
                <Ionicons name="sync-outline" size={9} color={COLORS.textTertiary} />
                <Text style={styles.syncTxt} numberOfLines={1}>
                  Synced {lastSyncTime}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Right: FY + Bell + Avatar */}
        <View style={styles.rightSection}>
          <TouchableOpacity
            testID="fy-selector"
            style={styles.fyPill}
            onPress={() => setShowFYModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.fyText}>{selectedFY}</Text>
            <Ionicons name="chevron-down" size={10} color={COLORS.brandPrimary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={handleNotification} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={21} color={COLORS.textPrimary} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={handleSettings} activeOpacity={0.7}>
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarText}>{userName[0]?.toUpperCase() || 'A'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Company Dropdown Modal */}
      <Modal visible={showCompanyModal} transparent animationType="none" onRequestClose={() => setShowCompanyModal(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowCompanyModal(false)} activeOpacity={1} />
          <View style={[styles.dropdown, { top: dropdownTop, left: SPACING.md }]}>
            <View style={styles.dropdownArrowLeft} />
            <Text style={styles.dropdownTitle}>Switch Company</Text>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {MOCK_COMPANIES.map(co => (
                <TouchableOpacity
                  key={co.id}
                  style={[styles.optionRow, selectedCompany === co.name && styles.optionRowActive]}
                  onPress={() => handleCompanySelect(co.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLeft}>
                    <View style={[styles.coIcon, selectedCompany === co.name && styles.coIconActive]}>
                      <Text style={[styles.coIconText, selectedCompany === co.name && { color: COLORS.white }]}>
                        {co.name[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.optionText, selectedCompany === co.name && styles.optionTextActive]} numberOfLines={1}>
                        {co.name}
                      </Text>
                      <Text style={styles.optionSub} numberOfLines={1}>{co.gstin}</Text>
                    </View>
                  </View>
                  {selectedCompany === co.name && (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.brandPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FY Dropdown Modal */}
      <Modal visible={showFYModal} transparent animationType="none" onRequestClose={() => setShowFYModal(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowFYModal(false)} activeOpacity={1} />
          <View style={[styles.dropdown, { top: dropdownTop, right: SPACING.md }]}>
            <View style={styles.dropdownArrowRight} />
            <Text style={styles.dropdownTitle}>Financial Year</Text>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {FY_YEARS.map(fy => (
                <TouchableOpacity
                  key={fy}
                  style={[styles.optionRow, selectedFY === fy && styles.optionRowActive]}
                  onPress={() => handleFYSelect(fy)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, selectedFY === fy && styles.optionTextActive]}>{fy}</Text>
                  {selectedFY === fy && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  leftSection:  { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  companyBlock: { flex: 1 },
  companyRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  companyName:  { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  syncRow:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  syncTxt:      { fontSize: 9, color: COLORS.textTertiary, fontWeight: '500', flex: 1 },
  rightSection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderRadius: 6, borderStyle: 'dashed',
  },
  fyText:     { fontSize: 10, fontWeight: '700', color: COLORS.brandPrimary },
  iconBtn:    { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarSmall:{ width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.white },
  badge: {
    position: 'absolute', top: 2, right: 2,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 8, color: COLORS.white, fontWeight: '700' },
  dropdown: {
    position: 'absolute', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    minWidth: 220, maxWidth: 280, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden', elevation: 16,
    boxShadow: '0 6px 14px rgba(0, 0, 0, 0.18)',
  },
  dropdownArrowLeft:  { width: 10, height: 10, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'flex-start', marginLeft: 20, marginTop: -5, transform: [{ rotate: '45deg' }] },
  dropdownArrowRight: { width: 10, height: 10, backgroundColor: COLORS.cardBg, borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.borderDefault, alignSelf: 'flex-end', marginRight: 20, marginTop: -5, transform: [{ rotate: '45deg' }] },
  dropdownTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  optionRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault },
  optionRowActive: { backgroundColor: COLORS.activeBg },
  optionLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  coIcon:          { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.borderDefault, alignItems: 'center', justifyContent: 'center' },
  coIconActive:    { backgroundColor: COLORS.brandPrimary },
  coIconText:      { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  optionText:      { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  optionTextActive:{ fontWeight: '700', color: COLORS.brandPrimary },
  optionSub:       { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
});

export default Header;
