import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getCompanies, getCompanyYears } from '../services/api';
import { safePush } from '../utils/safeNavigation';

function companyGuid(c: any): string {
  return String(c?.guid || c?.id || '').trim();
}

function isDemoCompany(c: any): boolean {
  const name = String(c?.name || '').toLowerCase().trim();
  const guid = companyGuid(c);
  return name.startsWith('demo') || guid.startsWith('dddddddd-dddd-4ddd-8ddd-') || guid.startsWith('DEMO');
}

function filterCompaniesForPairing(list: any[], pairingStatus: string): any[] {
  const rows = Array.isArray(list) ? list : [];
  const status = String(pairingStatus || '').toUpperCase();
  if (status === 'CONNECTED') return rows.filter((c) => !isDemoCompany(c));
  return rows.filter((c) => isDemoCompany(c));
}

type FyObj = { label: string; startDate: string; endDate: string; finYear?: string };

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

/**
 * Home header.
 * - Demo Mode: company switch disabled (Demo Company only).
 * - CONNECTED: company switch via dedicated screen (avoids Android Modal hang).
 * - FY: compact dropdown Modal (previous UX), not a full page.
 */
const Header: React.FC<HeaderProps> = ({
  companyName = 'YK Industries Pvt. Ltd.',
  fyYear = 'FY 2025-26',
  notificationCount = 1,
  lastSyncTime = MOCK_LAST_SYNCED,
  userName = 'Ashish Agarwal',
  onNotificationPress,
  onFYChange,
  onSettingsPress,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { company, lastSyncAt, selectedFY: contextFY, setSelectedFY: setContextFY } = useAuth();
  const { pairingStatus, filterScoped, demoMode } = useWorkspace();
  const [selectedFY, setSelectedFY] = useState(contextFY?.label || fyYear);
  const [selectedCompany, setSelectedCompany] = useState(companyName);
  const [companyCount, setCompanyCount] = useState(0);
  const [fyLoading, setFyLoading] = useState(false);
  const [showFYModal, setShowFYModal] = useState(false);
  const [liveFYObjects, setLiveFYObjects] = useState<FyObj[]>([]);
  const contextFyStartRef = useRef<string | undefined>(contextFY?.startDate);
  contextFyStartRef.current = contextFY?.startDate;

  useEffect(() => {
    if (company?.name) setSelectedCompany(company.name);
  }, [company?.name]);

  useEffect(() => {
    if (contextFY?.label) setSelectedFY(contextFY.label);
  }, [contextFY?.label]);

  // Count switchable live companies (Demo = never switchable)
  useEffect(() => {
    let cancelled = false;
    if (demoMode) {
      setCompanyCount(0);
      return;
    }
    getCompanies()
      .then((res: any) => {
        if (cancelled) return;
        const paired = filterCompaniesForPairing(res?.data ?? [], pairingStatus);
        const cos = String(pairingStatus).toUpperCase() === 'CONNECTED'
          ? filterScoped(paired, 'companies')
          : paired;
        setCompanyCount(cos.length);
      })
      .catch(() => {
        if (!cancelled) setCompanyCount(0);
      });
    return () => { cancelled = true; };
  }, [pairingStatus, lastSyncAt, filterScoped, demoMode]);

  // Load FY years into Auth + local dropdown list
  useEffect(() => {
    let cancelled = false;
    if (!company?.guid) return;
    setFyLoading(true);
    getCompanyYears(company.guid)
      .then((res: any) => {
        if (cancelled) return;
        const rows = res?.data ?? [];
        if (!rows.length) {
          setLiveFYObjects([]);
          return;
        }
        const mapped: FyObj[] = rows.map((r: any) => ({
          label: r.label,
          startDate: r.begin_date,
          endDate: r.end_date,
          finYear: r.fin_year,
        }));
        const fyObjs = (demoMode || String(pairingStatus).toUpperCase() !== 'CONNECTED')
          ? mapped
          : (filterScoped(mapped, 'fys') as FyObj[]);
        if (!fyObjs.length) {
          setLiveFYObjects([]);
          return;
        }
        setLiveFYObjects(fyObjs);
        const labels = fyObjs.map((f) => f.label);
        setSelectedFY((prev) => (prev && labels.includes(prev) ? prev : labels[0]));
        const keep =
          !!contextFyStartRef.current &&
          fyObjs.some((f) => f.startDate === contextFyStartRef.current);
        if (!keep) setContextFY(fyObjs[0]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFyLoading(false);
      });
    return () => { cancelled = true; };
    // filterScoped omitted on purpose — identity churn caused loops
  }, [company?.guid, lastSyncAt, demoMode, pairingStatus, setContextFY]);

  const canSwitchCompany = !demoMode && companyCount > 1;
  const dropdownTop = insets.top + 58;

  const openCompanySwitcher = useCallback(() => {
    // Demo Company: never open switcher
    if (demoMode) return;
    if (companyCount <= 1) {
      Toast.show({
        type: 'info',
        text1: 'Only one company',
        text2: 'No other live company to switch to',
        visibilityTime: 2200,
      });
      return;
    }
    safePush(router, '/switch-company' as any);
  }, [demoMode, companyCount, router]);

  const openFySwitcher = useCallback(() => {
    if (!company?.guid) {
      Toast.show({ type: 'info', text1: 'Select a company first' });
      return;
    }
    if (!liveFYObjects.length && !fyLoading) {
      Toast.show({ type: 'info', text1: 'No financial years found' });
      return;
    }
    setShowFYModal(true);
  }, [company?.guid, liveFYObjects.length, fyLoading]);

  const handleFYSelect = useCallback((fy: FyObj) => {
    setSelectedFY(fy.label);
    setContextFY(fy);
    onFYChange?.(fy.label);
    setShowFYModal(false);
  }, [setContextFY, onFYChange]);

  const handleNotification = () => {
    onNotificationPress?.();
    safePush(router, '/notifications' as any);
  };

  const handleSettings = () => {
    if (onSettingsPress) onSettingsPress();
    else safePush(router, '/settings' as any);
  };

  const shortCompany = selectedCompany.length > 24
    ? `${selectedCompany.substring(0, 22)}\u2026`
    : selectedCompany;

  return (
    <>
      <View testID="app-header" style={styles.container}>
        <TouchableOpacity
          testID="company-selector"
          style={styles.leftSection}
          onPress={openCompanySwitcher}
          activeOpacity={demoMode ? 1 : 0.7}
          disabled={demoMode}
          accessibilityState={{ disabled: demoMode }}
        >
          <View style={styles.companyBlock}>
            <View style={styles.companyRow}>
              <Text style={styles.companyName} numberOfLines={1}>{shortCompany}</Text>
              {canSwitchCompany ? (
                <Ionicons name="chevron-down" size={12} color={COLORS.brandPrimary} />
              ) : null}
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

        <View style={styles.rightSection}>
          <TouchableOpacity
            testID="fy-selector"
            style={styles.fyPill}
            onPress={openFySwitcher}
            activeOpacity={0.7}
          >
            {fyLoading ? (
              <ActivityIndicator size="small" color={COLORS.brandPrimary} />
            ) : (
              <>
                <Text style={styles.fyText}>{selectedFY}</Text>
                <Ionicons name="chevron-down" size={10} color={COLORS.brandPrimary} />
              </>
            )}
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

      {/* FY dropdown — previous compact Modal UX (not a full page) */}
      <Modal
        visible={showFYModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowFYModal(false)}
      >
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowFYModal(false)}
            activeOpacity={1}
          />
          <View style={[styles.dropdown, { top: dropdownTop, right: SPACING.md }]}>
            <View style={styles.dropdownArrowRight} />
            <Text style={styles.dropdownTitle}>Financial Year</Text>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              {liveFYObjects.map((fy) => {
                const active = selectedFY === fy.label;
                return (
                  <TouchableOpacity
                    key={fy.startDate || fy.label}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => handleFYSelect(fy)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {fy.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                  </TouchableOpacity>
                );
              })}
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
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  companyBlock: { flex: 1 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  companyName: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  syncTxt: { fontSize: 9, color: COLORS.textTertiary, fontWeight: '500', flex: 1 },
  rightSection: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5, minWidth: 72, justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.borderStrong,
    borderRadius: 6, borderStyle: 'dashed',
  },
  fyText: { fontSize: 10, fontWeight: '700', color: COLORS.brandPrimary },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarSmall: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.brandPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: TYPOGRAPHY.xs, fontWeight: '800', color: COLORS.white },
  badge: {
    position: 'absolute', top: 2, right: 2,
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontSize: 8, color: COLORS.white, fontWeight: '700' },
  dropdown: {
    position: 'absolute', backgroundColor: COLORS.cardBg, borderRadius: RADIUS.lg,
    minWidth: 180, maxWidth: 240, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden', elevation: 16,
  },
  dropdownArrowRight: {
    width: 10, height: 10, backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'flex-end', marginRight: 20, marginTop: -5,
    transform: [{ rotate: '45deg' }],
  },
  dropdownTitle: {
    fontSize: TYPOGRAPHY.xs, fontWeight: '700', color: COLORS.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderDefault,
  },
  optionRowActive: { backgroundColor: COLORS.activeBg },
  optionText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  optionTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
});

export default Header;
