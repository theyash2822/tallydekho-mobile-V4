import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { getCompanies, getCompanyYears } from '../services/api';
import { safePush } from '../utils/safeNavigation';
import { filterCompaniesForPairing } from '../utils/isDemoCompany';
import { fyEquals, normalizeFy } from '../utils/fyIdentity';
import { toAuthCompany, companyExternalId } from '../utils/companyIdentity';

type FyObj = { label: string; startDate: string; endDate: string; finYear?: string };

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
 * Home header with company + FY dropdowns.
 * - Demo Mode: company switch disabled (Demo Company only).
 * - Each Modal is mounted only while open, and a company / FY change is applied only
 *   after its Modal has unmounted: either re-renders the whole app, and doing that while
 *   a Modal is closing is what froze Android under bottom-sheet.
 */
const Header: React.FC<HeaderProps> = ({
  companyName = 'YK Industries Pvt. Ltd.',
  fyYear = 'FY 2025-26',
  notificationCount = 1,
  lastSyncTime,
  userName = 'Ashish Agarwal',
  onNotificationPress,
  onFYChange,
  onSettingsPress,
  onCompanyChange,
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { company, setCompany, lastSyncAt, selectedFY: contextFY, setSelectedFY: setContextFY } = useAuth();
  const { pairingStatus, filterScoped, demoMode } = useWorkspace();
  const [selectedFY, setSelectedFY] = useState(contextFY?.label || fyYear);
  const [selectedCompany, setSelectedCompany] = useState(company?.name || companyName);
  const [companies, setCompanies] = useState<any[]>([]);
  const companyCount = companies.length;
  const [fyLoading, setFyLoading] = useState(false);
  const [showFYModal, setShowFYModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const pendingCompanyRef = useRef<any | null>(null);
  const pendingFyRef = useRef<FyObj | null>(null);
  const contextFyStartRef = useRef<string | undefined>(contextFY?.startDate);
  useEffect(() => {
    contextFyStartRef.current = contextFY?.startDate;
  });

  const [prevCompanyName, setPrevCompanyName] = useState(company?.name);
  if (prevCompanyName !== company?.name) {
    setPrevCompanyName(company?.name);
    if (company?.name) setSelectedCompany(company.name);
  }

  const [prevFyLabel, setPrevFyLabel] = useState(contextFY?.label);
  if (prevFyLabel !== contextFY?.label) {
    setPrevFyLabel(contextFY?.label);
    if (contextFY?.label) setSelectedFY(contextFY.label);
  }

  const [prevDemoMode, setPrevDemoMode] = useState(demoMode);
  if (prevDemoMode !== demoMode) {
    setPrevDemoMode(demoMode);
    if (demoMode) {
      setCompanies([]);
      setShowCompanyModal(false);
    }
  }

  const fyLoadDeps = [company?.guid, lastSyncAt, demoMode, pairingStatus, setContextFY];
  const [prevFyLoadDeps, setPrevFyLoadDeps] = useState<unknown[] | null>(null);
  if (prevFyLoadDeps === null || fyLoadDeps.some((d, i) => d !== prevFyLoadDeps[i])) {
    setPrevFyLoadDeps(fyLoadDeps);
    if (company?.guid) setFyLoading(true);
  }

  // Switchable live companies (Demo = never switchable)
  useEffect(() => {
    let cancelled = false;
    if (demoMode) return;
    getCompanies()
      .then((res: any) => {
        if (cancelled) return;
        const paired = filterCompaniesForPairing(res?.data ?? [], pairingStatus);
        const live = ['CONNECTED', 'RECONNECTING'].includes(String(pairingStatus || '').toUpperCase());
        setCompanies(live ? filterScoped(paired, 'companies') : paired);
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      });
    return () => { cancelled = true; };
  }, [pairingStatus, lastSyncAt, filterScoped, demoMode]);

  // Load FY years into Auth + local dropdown list
  const [liveFYObjects, setLiveFYObjects] = useState<FyObj[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (!company?.guid) return;
    getCompanyYears(company.guid)
      .then((res: any) => {
        if (cancelled) return;
        const rows = res?.data ?? [];
        if (!rows.length) {
          setLiveFYObjects([]);
          return;
        }
        const mapped: FyObj[] = rows.map((r: any) => normalizeFy({
          label: r.label,
          startDate: r.begin_date || r.startDate,
          endDate: r.end_date || r.endDate,
          finYear: r.fin_year || r.finYear,
        })).filter((f: FyObj | null): f is FyObj => !!f);
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
        const keep = fyObjs.some((f) => fyEquals(f, { startDate: contextFyStartRef.current, label: '' }));
        if (!keep) setContextFY(fyObjs[0]);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFyLoading(false);
      });
    return () => { cancelled = true; };
    // filterScoped omitted on purpose — identity churn caused loops
  }, [company?.guid, lastSyncAt, demoMode, pairingStatus, setContextFY]);

  // Runs after the commit that unmounted the company Modal.
  useEffect(() => {
    const co = pendingCompanyRef.current;
    if (!co || showCompanyModal) return;
    pendingCompanyRef.current = null;
    const guid = companyExternalId(co);
    setCompany(toAuthCompany({ ...co, guid }) || { guid, name: co.name, gstin: co.gstin || null })
      .then(() => onCompanyChange?.(co.name))
      .catch(() => {});
  }, [showCompanyModal, setCompany, onCompanyChange]);

  // Same for FY: Home refetches on FY change, so apply it once the FY Modal is gone.
  useEffect(() => {
    const fy = pendingFyRef.current;
    if (!fy || showFYModal) return;
    pendingFyRef.current = null;
    setContextFY(fy);
    onFYChange?.(fy.label);
  }, [showFYModal, setContextFY, onFYChange]);

  const canSwitchCompany = !demoMode && companyCount > 1;
  const dropdownTop = insets.top + 58;

  const openCompanySwitcher = useCallback(() => {
    if (demoMode) return;
    if (companyCount <= 1) {
      Toast.show({
        type: 'info',
        text1: t('screens.componentsHeader.onlyOneCompany'),
        text2: t('screens.componentsHeader.noOtherCompany'),
        visibilityTime: 2200,
      });
      return;
    }
    setShowFYModal(false);
    setShowCompanyModal(true);
  }, [demoMode, companyCount, t]);

  const handleCompanySelect = useCallback((co: any) => {
    const guid = companyExternalId(co);
    if (guid && guid !== companyExternalId(company) && !demoMode) pendingCompanyRef.current = co;
    setShowCompanyModal(false);
  }, [company, demoMode]);

  const openFySwitcher = useCallback(() => {
    if (!company?.guid) {
      Toast.show({ type: 'info', text1: t('screens.componentsHeader.selectCompanyFirst') });
      return;
    }
    if (!liveFYObjects.length && !fyLoading) {
      Toast.show({ type: 'info', text1: t('screens.componentsHeader.noFinancialYears') });
      return;
    }
    setShowCompanyModal(false);
    setShowFYModal(true);
  }, [company?.guid, liveFYObjects.length, fyLoading, t]);

  const handleFYSelect = useCallback((fy: FyObj) => {
    pendingFyRef.current = fy;
    setSelectedFY(fy.label);
    setShowFYModal(false);
  }, []);

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
  const activeGuid = companyExternalId(company);

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
                  {t('screens.componentsHeader.synced', { time: lastSyncTime })}
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

      {showCompanyModal ? (
        <Modal
          visible
          transparent
          statusBarTranslucent
          animationType="none"
          onRequestClose={() => setShowCompanyModal(false)}
        >
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              onPress={() => setShowCompanyModal(false)}
              activeOpacity={1}
            />
            <View style={[styles.dropdown, { top: dropdownTop, left: SPACING.md }]}>
              <View style={styles.dropdownArrowLeft} />
              <Text style={styles.dropdownTitle}>{t('screens.switchCompany.title')}</Text>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
                {companies.map((co) => {
                  const guid = companyExternalId(co);
                  const active = !!guid && guid === activeGuid;
                  return (
                    <TouchableOpacity
                      key={guid || co.name}
                      testID={`company-option-${guid}`}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => handleCompanySelect(co)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionLeft}>
                        <View style={[styles.coIcon, active && styles.coIconActive]}>
                          <Text style={[styles.coIconText, active && { color: COLORS.white }]}>
                            {co.name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                            {co.name}
                          </Text>
                          {!!co.gstin && (
                            <Text style={styles.optionSub} numberOfLines={1}>{co.gstin}</Text>
                          )}
                        </View>
                      </View>
                      {active && (
                        <Ionicons name="checkmark-circle" size={18} color={COLORS.brandPrimary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {showFYModal ? (
        <Modal
          visible
          transparent
          statusBarTranslucent
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
              <Text style={styles.dropdownTitle}>{t('screens.componentsHeader.financialYear')}</Text>
              <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {liveFYObjects.map((fy) => {
                  const active = contextFY ? fyEquals(fy, contextFY) : selectedFY === fy.label;
                  return (
                    <TouchableOpacity
                      key={fy.startDate || fy.label}
                      testID={`fy-option-${fy.startDate || fy.label}`}
                      style={[styles.optionRow, active && styles.optionRowActive]}
                      onPress={() => handleFYSelect(fy)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{fy.label}</Text>
                      {active && <Ionicons name="checkmark" size={16} color={COLORS.brandPrimary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
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
    minWidth: 220, maxWidth: 280, borderWidth: 1, borderColor: COLORS.borderDefault,
    overflow: 'hidden', elevation: 16,
    boxShadow: '0 6px 14px rgba(0, 0, 0, 0.18)',
  },
  dropdownArrowLeft: {
    width: 10, height: 10, backgroundColor: COLORS.cardBg,
    borderTopWidth: 1, borderLeftWidth: 1, borderColor: COLORS.borderDefault,
    alignSelf: 'flex-start', marginLeft: 20, marginTop: -5,
    transform: [{ rotate: '45deg' }],
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
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  coIcon: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.borderDefault,
    alignItems: 'center', justifyContent: 'center',
  },
  coIconActive: { backgroundColor: COLORS.brandPrimary },
  coIconText: { fontSize: TYPOGRAPHY.sm, fontWeight: '700', color: COLORS.textPrimary },
  optionText: { fontSize: TYPOGRAPHY.sm, color: COLORS.textPrimary, fontWeight: '500' },
  optionTextActive: { fontWeight: '700', color: COLORS.brandPrimary },
  optionSub: { fontSize: 10, color: COLORS.textTertiary, marginTop: 1 },
});

export default Header;
